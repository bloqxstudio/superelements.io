import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Modelos do Elementor do site do cliente (cabeçalho, rodapé e seções salvas),
 * lidos e gravados pelo servidor, com a conexão WordPress do projeto.
 *
 * Do navegador não dá: o Elementor bloqueia, por segurança, toda chamada à
 * `elementor_library` sem um administrador logado, e a consulta prévia de
 * CORS que o navegador faz antes de cada chamada nunca leva login. Daqui a
 * chamada vai direto, com a senha de aplicação do projeto: o Elementor
 * entrega o modelo puro (o JSON dele, com os ids) e grava pelo próprio
 * WordPress. A condição de exibição do Theme Builder passa pelo Site Editor
 * do Elementor Pro, que grava pelo Theme Builder e refaz o cache dele.
 *
 * Só fala com o site ligado a um projeto que a pessoa logada pode ler (a
 * leitura da conexão passa pelas regras de acesso do banco).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Tipo de documento do Elementor de cada componente do Space. */
const TYPES: Record<string, string> = { header: 'header', footer: 'footer', section: 'container' }
const THEME = new Set(['header', 'footer'])

interface Body {
  projectId?: string
  action?: 'status' | 'get' | 'save'
  id?: number
  kind?: string
  title?: string
  /** JSON do Elementor; sem ele, o conteúdo do modelo fica como está. */
  elements?: string
  /** "include/general", "exclude/singular/page/12"… */
  conditions?: string[]
  /** Outros modelos do mesmo lugar que saem do site (ficam salvos, sem condição). */
  release?: number[]
}

interface Site {
  restRoot: string
  userLogin: string
  password: string
  adminUrl: string
}

class SiteError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'site_error'
  ) {
    super(message)
  }
}

/** Endereço de uma rota na API do site (com links permanentes ou pelo `?rest_route=`). */
function restUrl(root: string, route: string, params: Record<string, string> = {}) {
  const url = new URL(root)
  const path = route.replace(/^\/+/, '')
  if (url.searchParams.has('rest_route')) url.searchParams.set('rest_route', `/${path}`)
  else url.pathname = `${url.pathname.replace(/\/*$/, '/')}${path}`
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

async function call<T>(site: Site, route: string, init: { method?: string; params?: Record<string, string>; json?: unknown; form?: URLSearchParams } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Basic ${btoa(unescape(encodeURIComponent(`${site.userLogin}:${site.password}`)))}` }
  let body: string | undefined
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  } else if (init.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    body = init.form.toString()
  }
  const response = await fetch(restUrl(site.restRoot, route, init.params), { method: init.method ?? 'GET', headers, body, signal: AbortSignal.timeout(40_000) })
  const text = await response.text()
  let data: unknown = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }
  if (!response.ok) {
    const error = (data ?? {}) as { code?: string; message?: string }
    throw new SiteError(error.message ? String(error.message).replace(/<[^>]+>/g, '') : `O site respondeu com erro ${response.status}.`, response.status, error.code ?? 'site_error')
  }
  return data as T
}

interface LibraryPost {
  id: number
  title?: { raw?: string; rendered?: string }
  status: string
  modified_gmt: string
  meta?: { _elementor_template_type?: string; _elementor_data?: string }
}

const conditionText = (c: { type: string; name: string; sub_name?: string; sub_id?: string | number }) =>
  [c.type, c.name, c.sub_name ?? '', String(c.sub_id ?? '')].join('/').replace(/\/+$/, '')

/** As condições como o Site Editor recebe: um formulário com type, name, sub_name e sub_id de cada uma. */
function conditionsForm(conditions: string[]) {
  const form = new URLSearchParams()
  conditions.forEach((condition, i) => {
    if (!/^(include|exclude)(\/[a-z0-9_-]+){1,3}$/.test(condition)) throw new SiteError(`Condição inválida: ${condition}`)
    const [type = '', name = '', subName = '', subId = ''] = condition.split('/')
    form.set(`conditions[${i}][type]`, type)
    form.set(`conditions[${i}][name]`, name)
    form.set(`conditions[${i}][sub_name]`, subName)
    form.set(`conditions[${i}][sub_id]`, subId)
  })
  return form
}

/** O modelo como a plataforma lê: tipo, condições, data da última mudança e o JSON do Elementor. */
async function readPart(site: Site, id: number) {
  let post: LibraryPost
  try {
    post = await call<LibraryPost>(site, `wp/v2/elementor_library/${id}`, { params: { context: 'edit', _fields: 'id,title,status,modified_gmt,meta' } })
  } catch (error) {
    if (error instanceof SiteError && error.status === 404) throw new SiteError('O modelo não existe mais no site (foi apagado ou está na lixeira).', 404, 'gone')
    throw error
  }
  if (post.status === 'trash') throw new SiteError('O modelo está na lixeira do site.', 404, 'gone')
  const type = post.meta?._elementor_template_type ?? ''
  const conditions = THEME.has(type)
    ? await call<{ type: string; name: string; sub_name?: string; sub_id?: string }[]>(site, `elementor/v1/site-editor/templates-conditions/${id}`).then(
        (list) => (Array.isArray(list) ? list.map(conditionText) : []),
        () => []
      )
    : []
  return {
    id: post.id,
    title: post.title?.raw ?? post.title?.rendered ?? '',
    type,
    status: post.status,
    modified_gmt: post.modified_gmt,
    conditions,
    edit_url: `${site.adminUrl}post.php?post=${post.id}&action=elementor`,
    elementor_data: post.meta?._elementor_data ?? '',
  }
}

async function saveConditions(site: Site, id: number, conditions: string[]) {
  const saved = await call<unknown>(site, `elementor/v1/site-editor/templates-conditions/${id}`, { method: 'POST', form: conditionsForm(conditions) })
  if (saved !== true) throw new SiteError('O Elementor não gravou a condição do modelo (alguém pode estar com ele aberto no editor).', 409)
}

/** Cria (sem id) ou atualiza o modelo: o conteúdo, o nome e, no Theme Builder, a condição. */
async function savePart(site: Site, body: Body) {
  // O tipo do Global Widget fica num campo que a API do WordPress não grava: esse vai pelo plugin
  if (body.kind === 'widget') throw new SiteError('O Global Widget pede o plugin Superelements Connector no site.', 400, 'needs_connector')
  const type = TYPES[body.kind ?? '']
  if (!type) throw new SiteError(`Tipo de componente desconhecido: ${body.kind}`)
  if (body.elements !== undefined) {
    try {
      if (!Array.isArray(JSON.parse(body.elements))) throw new Error()
    } catch {
      throw new SiteError('O conteúdo não é um JSON do Elementor.')
    }
  }
  let id = body.id
  if (id) {
    const current = await readPart(site, id)
    if (current.type !== type) throw new SiteError(`Esse modelo do site não é um ${type} do Elementor.`, 409, 'wrong_type')
    const fields: Record<string, unknown> = {}
    if (body.title && body.title !== current.title) fields.title = body.title
    if (body.elements !== undefined) fields.meta = { _elementor_data: body.elements }
    if (Object.keys(fields).length) await call(site, `wp/v2/elementor_library/${id}`, { method: 'POST', params: { _fields: 'id' }, json: fields })
  } else {
    if (body.elements === undefined) throw new SiteError('Falta o conteúdo do modelo.')
    const created = await call<{ id: number }>(site, 'wp/v2/elementor_library', {
      method: 'POST',
      params: { _fields: 'id' },
      json: { title: body.title || 'Superelements', status: 'publish', meta: { _elementor_edit_mode: 'builder', _elementor_template_type: type, _elementor_data: body.elements } },
    })
    id = created.id
  }
  if (THEME.has(body.kind!)) {
    for (const other of body.release ?? []) if (other !== id) await saveConditions(site, other, [])
    if (body.conditions) await saveConditions(site, id, body.conditions)
  }
  const saved = await readPart(site, id)
  return { ...saved, elementor_data: undefined }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return json({ error: 'Entre na conta para falar com o WordPress do projeto.' }, 401)

    const body = (await req.json()) as Body
    if (!body.projectId) return json({ error: 'Falta o projeto.' }, 400)
    // A conexão só vem se a pessoa pode ler o projeto (regras de acesso do banco)
    const { data: row, error } = await supabase.from('space_wordpress_connections').select('connection, password').eq('project_id', body.projectId).maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!row) return json({ error: 'O projeto não tem WordPress conectado (ou você não tem acesso a ele).' }, 404)
    const connection = row.connection as { site?: { restRoot?: string; siteUrl?: string; authorizeUrl?: string }; userLogin?: string }
    if (!connection.site?.restRoot || !connection.userLogin) return json({ error: 'A conexão do projeto está incompleta: conecte o WordPress de novo.' }, 400)
    const siteUrl = (connection.site.siteUrl ?? '').replace(/\/+$/, '')
    const site: Site = {
      restRoot: connection.site.restRoot,
      userLogin: connection.userLogin,
      password: row.password as string,
      adminUrl: connection.site.authorizeUrl?.replace(/authorize-application\.php.*$/, '') ?? `${siteUrl}/wp-admin/`,
    }

    // O Space pergunta antes de mostrar o caminho: a função está no ar e o projeto tem conexão
    if (body.action === 'status') return json({ ok: true })
    if (body.action === 'get') {
      if (!body.id) return json({ error: 'Falta o id do modelo.' }, 400)
      return json(await readPart(site, body.id))
    }
    if (body.action === 'save') return json(await savePart(site, body))
    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (error) {
    if (error instanceof SiteError) return json({ error: error.message, code: error.code, status: error.status }, 200)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
