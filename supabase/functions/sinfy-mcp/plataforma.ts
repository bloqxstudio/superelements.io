import postgres from 'npm:postgres@3.4.5'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { cleanDefinition, cleanSettings, cleanTheme, formIssues, SETTINGS_DEFAULT, THEME_DEFAULT } from '../_shared/forms.ts'

/**
 * A plataforma inteira pelo MCP, como a pessoa da chave. Cada leitura e gravação abre uma transação
 * no banco com o papel `authenticated` e o `sub` da pessoa (o que o PostgREST faz para a tela), então
 * valem as mesmas políticas (RLS), papéis e módulos do navegador. Por cima disso: lista fechada de
 * tabelas (nada de tokens, chaves, convites ou sessões do WhatsApp), conta da chave forçada em toda
 * consulta, no máximo 25 linhas mudadas por pedido, apagar só com `confirmar`, e o WhatsApp com o
 * mesmo limite de 30 envios por pessoa por dia da tela.
 */

export interface PlatformCaller {
  keyId: string
  userId: string
  role: string
  team: { id: string; name: string; status: string; modules: Record<string, boolean> | null; is_home: boolean }
}

export interface PlatformDeps {
  admin: SupabaseClient
  appUrl: string
  fail: (message: string) => never
}

type Args = Record<string, unknown>

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 })

/** Roda `fn` numa transação como a pessoa: RLS, `auth.uid()` e papéis iguais aos da tela. */
export async function asUser<T>(caller: PlatformCaller, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: caller.userId, role: 'authenticated' })}, true), set_config('request.jwt.claim.sub', ${caller.userId}, true)`
    await tx.unsafe('set local role authenticated')
    await tx.unsafe("set local statement_timeout = '15s'")
    return fn(tx)
  })) as T
}

const moduleOn = (caller: PlatformCaller, key: string) => caller.team.status !== 'pausada' && (caller.team.modules ?? {})[key] !== false

// ---------- tabelas ----------

interface TableInfo {
  module?: string
  label: string
  write?: boolean
  remove?: boolean
}

const TABLES: Record<string, TableInfo> = {
  crm_clients: { module: 'crm', label: 'Clientes (empresas): contatos, origem, status lead/cliente/ex-cliente, redes, notas.', write: true },
  crm_contacts: { module: 'crm', label: 'Pessoas de contato de cada cliente.', write: true, remove: true },
  crm_opportunities: { module: 'crm', label: 'Oportunidades do funil: etapa (novo, mapeado, selecionado, pagina, contatado, conversa, proposta, fechado, perdido), oferta, próximo passo, origem do lead, responsável.', write: true },
  crm_activities: { module: 'crm', label: 'Linha do tempo do cliente: notas, ligações, WhatsApp, e-mail, reuniões, comentários de cartão (opportunity_id).', write: true, remove: true },
  crm_pipelines: { module: 'crm', label: 'Funis de vendas e configurações.' },
  crm_flows: { module: 'whatsapp', label: 'Fluxos de mensagens (sequência com espera em dias).', write: true },
  crm_flow_runs: { module: 'whatsapp', label: 'Clientes dentro de um fluxo (passo, próximo envio).', write: true, remove: true },
  crm_whatsapp_chats: { module: 'whatsapp', label: 'Conversas do WhatsApp da conta (última mensagem, não lidas, etiquetas).' },
  crm_whatsapp_messages: { module: 'whatsapp', label: 'Mensagens do WhatsApp (from_me, body, kind, status, ts, chat_jid).' },
  crm_forms: { module: 'formularios', label: 'Formulários e quizzes (definição, tema, status). Para criar ou mudar use sinfy_formulario_salvar.' },
  crm_form_submissions: { module: 'formularios', label: 'Respostas dos formulários (respostas, pontuação, qualificado, origem).' },
  crm_funnels: { module: 'funis', label: 'Funis visuais (objetivo, modelo, desenho).', write: true },
  crm_funnel_steps: { module: 'funis', label: 'Etapas de cada funil visual.', write: true, remove: true },
  crm_instagram_accounts: { module: 'instagram', label: 'Conta do Instagram: perfil, seguidores, totais, público.' },
  crm_instagram_media: { module: 'instagram', label: 'Posts, reels e stories com legenda e números (insights).' },
  crm_instagram_daily: { module: 'instagram', label: 'Alcance e seguidores por dia.' },
  crm_instagram_comments: { module: 'instagram', label: 'Comentários dos posts (handled = resolvido, own = nosso).' },
  crm_instagram_threads: { module: 'instagram', label: 'Conversas de DM do Instagram.' },
  crm_instagram_dms: { module: 'instagram', label: 'Mensagens das DMs do Instagram.' },
  crm_instagram_analyses: { module: 'instagram', label: 'Análises de perfil salvas.', write: true },
  crm_stories: { module: 'instagram', label: 'Stories programados (ideia, criativo, agendado, publicado) e seus números.' },
  crm_ad_accounts: { module: 'instagram', label: 'Contas de anúncios da Meta conectadas.' },
  crm_ad_reports: { module: 'instagram', label: 'Relatórios salvos dos anúncios por período (preset).' },
  site_trackers: { module: 'site', label: 'Sites medidos pela conta.' },
  site_sessions: { module: 'site', label: 'Visitas do site: origem, campanha, aparelho, cidade, páginas, tempo, contato (converted), pedidos.' },
  site_events: { module: 'site', label: 'Eventos de cada visita em ordem (páginas, cliques, formulários, compras).' },
  crm_contents: { module: 'copy', label: 'Conteúdos do Plano editorial. Para criar ou mudar use sinfy_conteudo_*.' },
  crm_account_context: { module: 'copy', label: 'O Plano da empresa (oferta, público, tom, pilares).' },
  space_projects: { module: 'projetos', label: 'Projetos de site no Space.' },
  crm_story_settings: { module: 'instagram', label: 'Ajustes dos stories programados (dias, horários, pilares, briefing).' },
  crm_content_comments: { module: 'copy', label: 'Comentários nos conteúdos da Pauta (da equipe e do cliente na aprovação).', write: true },
  crm_approval_items: { module: 'copy', label: 'Itens mandados ao cliente para aprovar e a resposta dele (só leitura: aprovar é na tela).' },
  crm_content_tags: { module: 'copy', label: 'Etiquetas da Pauta.' },
  crm_references: { label: 'Referências visuais da conta. Para salvar use sinfy_referencia_salvar.' },
  crm_knowledge_notes: { label: 'Notas do Cérebro da conta. Para ler e gravar use sinfy_cerebro_*.' },
}

interface Column { name: string; type: string; udt: string }
const columnsCache = new Map<string, Column[]>()

async function columnsOf(table: string): Promise<Column[]> {
  const cached = columnsCache.get(table)
  if (cached) return cached
  const rows = await sql`select column_name, data_type, udt_name from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`
  const cols = rows.map((r) => ({ name: r.column_name as string, type: r.data_type as string, udt: r.udt_name as string }))
  columnsCache.set(table, cols)
  return cols
}

function tableFor(caller: PlatformCaller, deps: PlatformDeps, raw: unknown) {
  const name = String(raw ?? '')
  const info = TABLES[name]
  if (!info) deps.fail(`Tabela fora da lista. Use sinfy_dados_tabelas para ver as disponíveis.`)
  if (info.module && !moduleOn(caller, info.module)) deps.fail(`O módulo dessa tabela (${info.module}) está desligado nesta conta.`)
  return { name, info }
}

const castOf = (c: Column) => (c.type === 'ARRAY' ? `${c.udt.replace(/^_/, '')}[]` : c.type === 'USER-DEFINED' ? c.udt : c.udt)

interface Filter { coluna: string; op?: string; valor?: unknown }
const OPS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }

/** WHERE com a conta da chave e os filtros pedidos, tudo parametrizado. */
function whereOf(cols: Column[], filters: unknown, teamId: string, deps: PlatformDeps, params: unknown[]) {
  const byName = new Map(cols.map((c) => [c.name, c]))
  const parts: string[] = []
  if (byName.has('team_id')) {
    params.push(teamId)
    parts.push(`team_id = $${params.length}::uuid`)
  }
  for (const f of (Array.isArray(filters) ? filters : []) as Filter[]) {
    const col = byName.get(String(f?.coluna ?? ''))
    if (!col) deps.fail(`Coluna desconhecida no filtro: ${String(f?.coluna)}.`)
    const op = String(f.op ?? 'eq')
    const id = `"${col.name}"`
    if (op === 'is_null' || op === 'not_null') parts.push(`${id} is ${op === 'is_null' ? '' : 'not '}null`)
    else if (op === 'like' || op === 'ilike') {
      params.push(String(f.valor ?? ''))
      parts.push(`${id}::text ${op} $${params.length}`)
    } else if (op === 'in') {
      const values = (Array.isArray(f.valor) ? f.valor : [f.valor]).slice(0, 100)
      if (!values.length) deps.fail('Filtro "in" sem valores.')
      parts.push(`${id} in (${values.map((v) => (params.push(String(v)), `$${params.length}::${castOf(col)}`)).join(', ')})`)
    } else if (op === 'contains' && col.type === 'ARRAY') {
      params.push(`{${(Array.isArray(f.valor) ? f.valor : [f.valor]).map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',')}}`)
      parts.push(`${id} @> $${params.length}::${castOf(col)}`)
    } else if (OPS[op]) {
      params.push(typeof f.valor === 'object' ? JSON.stringify(f.valor) : String(f.valor ?? ''))
      parts.push(`${id} ${OPS[op]} $${params.length}::${castOf(col)}`)
    } else deps.fail(`Operador desconhecido: ${op}. Use eq, neq, gt, gte, lt, lte, like, ilike, in, contains, is_null ou not_null.`)
  }
  return parts.length ? `where ${parts.join(' and ')}` : ''
}

/** Corta textos longos e o tamanho total, para a resposta caber no chat. */
function trimRows(rows: Record<string, unknown>[], budget = 180_000) {
  const out: Record<string, unknown>[] = []
  let used = 0
  for (const row of rows) {
    const slim = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' && v.length > 4000 ? `${v.slice(0, 4000)}… (+${v.length - 4000})` : v]))
    const size = JSON.stringify(slim).length
    if (used + size > budget && out.length) return { rows: out, cortado: true }
    used += size
    out.push(slim)
  }
  return { rows: out, cortado: false }
}

// ---------- WhatsApp ----------

const WHATSAPP_DAILY_LIMIT = 30
const digits = (s: string) => s.replace(/\D/g, '')

async function findChat(caller: PlatformCaller, ref: string) {
  return asUser(caller, async (tx) => {
    if (ref.includes('@')) return (await tx`select jid, phone, name from crm_whatsapp_chats where team_id = ${caller.team.id} and jid = ${ref} limit 1`)[0]
    const tail = digits(ref).slice(-8)
    if (tail.length < 8) return undefined
    return (await tx`select jid, phone, name from crm_whatsapp_chats where team_id = ${caller.team.id} and right(regexp_replace(coalesce(phone, jid), '\\D', '', 'g'), 8) = ${tail} order by last_at desc nulls last limit 1`)[0]
  })
}

const extOf = (mime: string, name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin')
const kindOf = (mime: string) => (mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'document')

/** Baixa um arquivo (endereço https ou base64) com limite de tamanho. */
export async function fetchFile(deps: PlatformDeps, a: Args, max = 25 * 1024 * 1024): Promise<{ bytes: Uint8Array; mime: string; name: string }> {
  const name = String(a.nome_arquivo ?? a.nome ?? 'arquivo').slice(0, 120)
  if (typeof a.base64 === 'string' && a.base64) {
    const raw = a.base64.replace(/^data:[^;]+;base64,/, '')
    const mime = /^data:([^;]+);/.exec(a.base64)?.[1] ?? String(a.mime ?? 'application/octet-stream')
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    if (bytes.length > max) deps.fail('Arquivo grande demais.')
    return { bytes, mime, name }
  }
  const url = String(a.url ?? a.arquivo_url ?? '')
  if (!/^https:\/\//.test(url)) deps.fail('Mande o arquivo por um endereço https (url) ou em base64.')
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' })
  if (!res.ok) deps.fail(`Não consegui baixar o arquivo (${res.status}).`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > max) deps.fail('Arquivo grande demais (até 25 MB).')
  const mime = (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]
  return { bytes, mime, name: a.nome_arquivo ? name : decodeURIComponent(url.split('?')[0].split('/').pop() || name) }
}

// ---------- ferramentas ----------

export interface PlatformTool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: Record<string, unknown>
  run: (caller: PlatformCaller, args: Args) => Promise<unknown>
}

const FILTERS = {
  type: 'array',
  description: 'Filtros, todos juntos (E): [{"coluna":"stage","op":"eq","valor":"novo"}]. Operadores: eq, neq, gt, gte, lt, lte, like, ilike (com %), in (valor = lista), contains (colunas de lista), is_null, not_null.',
  items: { type: 'object', required: ['coluna'], properties: { coluna: { type: 'string' }, op: { type: 'string' }, valor: {} } },
}

export function platformTools(deps: PlatformDeps): PlatformTool[] {
  const { admin, appUrl, fail } = deps
  const needModule = (caller: PlatformCaller, key: string, label: string) => {
    if (!moduleOn(caller, key)) fail(`O módulo ${label} está desligado nesta conta.`)
  }

  return [
    {
      name: 'sinfy_dados_tabelas',
      title: 'Tabelas da plataforma',
      description: 'Lista os dados da conta que você pode ler (e quais pode gravar) com as colunas de cada tabela. Use antes de sinfy_dados_ler ou sinfy_dados_gravar.',
      inputSchema: { type: 'object', properties: { tabela: { type: 'string', description: 'Uma tabela só, com as colunas e os tipos.' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (caller, a) => {
        const names = a.tabela ? [tableFor(caller, deps, a.tabela).name] : Object.keys(TABLES).filter((t) => !TABLES[t].module || moduleOn(caller, TABLES[t].module!))
        return Promise.all(
          names.map(async (t) => ({
            tabela: t,
            o_que_e: TABLES[t].label,
            pode_gravar: !!TABLES[t].write,
            pode_apagar: !!TABLES[t].remove,
            colunas: a.tabela ? (await columnsOf(t)).map((c) => `${c.name} (${castOf(c)})`) : (await columnsOf(t)).map((c) => c.name),
          }))
        )
      },
    },
    {
      name: 'sinfy_dados_ler',
      title: 'Ler dados',
      description: 'Lê linhas de uma tabela da conta (clientes, oportunidades, atividades, conversas e mensagens do WhatsApp, formulários e respostas, visitas do site, Instagram, anúncios, conteúdos…), com filtros, ordem e limite. Sempre só a conta da chave e só o que a pessoa da chave pode ver. Para contar, peça `contar: true`.',
      inputSchema: {
        type: 'object',
        required: ['tabela'],
        properties: {
          tabela: { type: 'string' },
          colunas: { type: 'array', items: { type: 'string' }, description: 'Padrão: todas.' },
          filtros: FILTERS,
          ordem: { type: 'object', properties: { coluna: { type: 'string' }, desc: { type: 'boolean' } } },
          limite: { type: 'integer', minimum: 1, maximum: 200, description: 'Padrão 50.' },
          pular: { type: 'integer', minimum: 0, description: 'Para paginar.' },
          contar: { type: 'boolean', description: 'Devolve só a contagem.' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      run: async (caller, a) => {
        const { name } = tableFor(caller, deps, a.tabela)
        const cols = await columnsOf(name)
        const known = new Set(cols.map((c) => c.name))
        const picked = Array.isArray(a.colunas) && a.colunas.length ? a.colunas.map(String) : cols.map((c) => c.name)
        const bad = picked.find((c) => !known.has(c))
        if (bad) fail(`Coluna desconhecida: ${bad}.`)
        const params: unknown[] = []
        const where = whereOf(cols, a.filtros, caller.team.id, deps, params)
        const order = a.ordem && typeof a.ordem === 'object' ? (a.ordem as { coluna?: string; desc?: boolean }) : undefined
        if (order?.coluna && !known.has(order.coluna)) fail(`Coluna desconhecida na ordem: ${order.coluna}.`)
        const orderBy = order?.coluna ? `order by "${order.coluna}" ${order.desc ? 'desc' : 'asc'} nulls last` : known.has('created_at') ? 'order by created_at desc' : known.has('ts') ? 'order by ts desc' : ''
        const limit = Math.min(200, Math.max(1, Number(a.limite) || 50))
        const offset = Math.max(0, Number(a.pular) || 0)
        return asUser(caller, async (tx) => {
          if (a.contar) {
            const [row] = await tx.unsafe(`select count(*)::int as total from public."${name}" ${where}`, params as never[])
            return { tabela: name, total: row.total }
          }
          const rows = await tx.unsafe(`select ${picked.map((c) => `"${c}"`).join(', ')} from public."${name}" ${where} ${orderBy} limit ${limit} offset ${offset}`, params as never[])
          const { rows: out, cortado } = trimRows(rows as unknown as Record<string, unknown>[])
          return { tabela: name, linhas: out.length, mais: rows.length === limit ? `pode haver mais: use pular=${offset + limit}` : undefined, cortado: cortado || undefined, dados: out }
        })
      },
    },
    {
      name: 'sinfy_dados_gravar',
      title: 'Gravar dados',
      description: 'Cria, muda ou apaga linhas nas tabelas que aceitam gravação (veja sinfy_dados_tabelas): clientes, contatos, oportunidades (mover de etapa, próximo passo, notas), atividades e comentários na linha do tempo, fluxos, funis. Grava como a pessoa da chave, com as permissões dela. Mudar ou apagar exige filtros e afeta no máximo 25 linhas; apagar exige confirmar=true. Confirme com a pessoa antes de mudanças em massa.',
      inputSchema: {
        type: 'object',
        required: ['tabela', 'acao'],
        properties: {
          tabela: { type: 'string' },
          acao: { type: 'string', enum: ['inserir', 'atualizar', 'apagar'] },
          valores: { type: 'object', description: 'Colunas e valores (inserir/atualizar). A conta (team_id) é posta sozinha.' },
          filtros: FILTERS,
          confirmar: { type: 'boolean', description: 'Obrigatório para apagar.' },
        },
        additionalProperties: false,
      },
      run: async (caller, a) => {
        const { name, info } = tableFor(caller, deps, a.tabela)
        if (!info.write) fail('Esta tabela é só de leitura pelo MCP.')
        const cols = await columnsOf(name)
        const known = new Set(cols.map((c) => c.name))
        const action = String(a.acao)
        const values = (a.valores && typeof a.valores === 'object' ? { ...(a.valores as Record<string, unknown>) } : {}) as Record<string, unknown>
        for (const k of ['team_id', 'created_by', 'created_at']) delete values[k]
        const bad = Object.keys(values).find((k) => !known.has(k))
        if (bad) fail(`Coluna desconhecida: ${bad}.`)
        if (known.has('updated_at') && action === 'atualizar') values.updated_at = new Date().toISOString()
        return asUser(caller, async (tx) => {
          if (action === 'inserir') {
            if (known.has('team_id')) values.team_id = caller.team.id
            if (known.has('created_by')) values.created_by = caller.userId
            const keys = Object.keys(values)
            if (!keys.length) fail('Mande os valores.')
            const list = keys.map((k) => `"${k}"`).join(', ')
            const rows = await tx.unsafe(`insert into public."${name}" (${list}) select ${list} from jsonb_populate_record(null::public."${name}", $1::jsonb) returning *`, [JSON.stringify(values)] as never[])
            return { ok: true, criado: rows[0] }
          }
          const filters = Array.isArray(a.filtros) ? a.filtros : []
          if (!filters.length) fail('Mudar ou apagar exige filtros (por exemplo o id).')
          const params: unknown[] = []
          const where = whereOf(cols, filters, caller.team.id, deps, params)
          const [{ total }] = await tx.unsafe(`select count(*)::int as total from public."${name}" ${where}`, params as never[])
          if (total > 25) fail(`O filtro pega ${total} linhas; o máximo por pedido é 25. Refine o filtro.`)
          if (!total) return { ok: true, linhas: 0, aviso: 'Nenhuma linha com esse filtro (ou sem permissão para vê-la).' }
          if (action === 'apagar') {
            if (!info.remove) fail('Esta tabela não aceita apagar pelo MCP.')
            if (a.confirmar !== true) fail('Para apagar, confirme com a pessoa e mande confirmar=true.')
            const rows = await tx.unsafe(`delete from public."${name}" ${where} returning id`, params as never[])
            return { ok: true, apagadas: rows.length }
          }
          const keys = Object.keys(values)
          if (!keys.length) fail('Mande os valores a mudar.')
          params.push(JSON.stringify(values))
          const list = keys.map((k) => `"${k}"`).join(', ')
          const rows = await tx.unsafe(`update public."${name}" set (${list}) = (select ${list} from jsonb_populate_record(null::public."${name}", $${params.length}::jsonb)) ${where} returning *`, params as never[])
          if (rows.length !== total) fail('Sem permissão para mudar todas essas linhas.')
          return { ok: true, linhas: rows.length, dados: trimRows(rows as unknown as Record<string, unknown>[]).rows }
        })
      },
    },
    {
      name: 'sinfy_whatsapp_conversas',
      title: 'Conversas do WhatsApp',
      description: 'As conversas do WhatsApp da conta, da mais recente à mais antiga: nome, telefone, última mensagem, se foi nossa ou do cliente, não lidas e etiquetas (Quente, Morno, Frio…). Use "respondeu" para ver só onde o cliente falou por último.',
      inputSchema: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Parte do nome ou do telefone.' },
          nao_lidas: { type: 'boolean' },
          respondeu: { type: 'boolean', description: 'Só conversas cuja última mensagem é do cliente.' },
          etiqueta: { type: 'string' },
          limite: { type: 'integer', minimum: 1, maximum: 100 },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      run: async (caller, a) => {
        needModule(caller, 'whatsapp', 'WhatsApp')
        const limit = Math.min(100, Math.max(1, Number(a.limite) || 30))
        const like = a.busca ? `%${String(a.busca)}%` : null
        return asUser(caller, (tx) =>
          tx`select jid, name as nome, phone as telefone, last_text as ultima, case when last_from_me then 'nós' else 'cliente' end as quem, last_at as quando, unread as nao_lidas, tags as etiquetas
             from crm_whatsapp_chats
             where team_id = ${caller.team.id}
               and (${like}::text is null or name ilike ${like} or phone ilike ${like})
               and (${a.nao_lidas === true} = false or unread > 0)
               and (${a.respondeu === true} = false or last_from_me = false)
               and (${a.etiqueta ? String(a.etiqueta) : null}::text is null or ${a.etiqueta ? String(a.etiqueta) : ''} = any(tags))
             order by last_at desc nulls last limit ${limit}`
        )
      },
    },
    {
      name: 'sinfy_whatsapp_mensagens',
      title: 'Mensagens de uma conversa',
      description: 'As mensagens de uma conversa do WhatsApp, em ordem (as mais recentes no fim). Diga a conversa pelo jid (de sinfy_whatsapp_conversas) ou pelo telefone.',
      inputSchema: { type: 'object', required: ['conversa'], properties: { conversa: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 200 }, marcar_lida: { type: 'boolean', description: 'Zera as não lidas, como abrir na tela.' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (caller, a) => {
        needModule(caller, 'whatsapp', 'WhatsApp')
        const chat = await findChat(caller, String(a.conversa ?? ''))
        if (!chat) return fail('Conversa não encontrada nesta conta.')
        const limit = Math.min(200, Math.max(1, Number(a.limite) || 40))
        const rows = await asUser(caller, async (tx) => {
          const list = await tx`select ts as quando, case when from_me then 'nós' else 'cliente' end as quem, body as texto, kind as tipo, status, media_name as arquivo from crm_whatsapp_messages where team_id = ${caller.team.id} and chat_jid = ${chat.jid} order by ts desc limit ${limit}`
          if (a.marcar_lida) await tx`select crm_whatsapp_read(${caller.team.id}::uuid, ${chat.jid}::text)`
          return list
        })
        return { conversa: { jid: chat.jid, nome: chat.name, telefone: chat.phone }, mensagens: [...rows].reverse() }
      },
    },
    {
      name: 'sinfy_whatsapp_enviar',
      title: 'Enviar no WhatsApp',
      description: `Envia uma mensagem (e, se quiser, um arquivo: foto, vídeo, áudio ou documento até 25 MB, por url https ou base64) pelo WhatsApp da conta, numa conversa existente ou para um número novo (sem DDI = Brasil). Sai em nome da pessoa da chave, no mesmo limite da tela: ${WHATSAPP_DAILY_LIMIT} envios por pessoa por dia. Antes de mandar para um cliente, mostre o texto à pessoa e confirme.`,
      inputSchema: {
        type: 'object',
        properties: {
          conversa: { type: 'string', description: 'jid de uma conversa existente.' },
          numero: { type: 'string', description: 'Telefone (para conversa nova ou para achar a existente).' },
          texto: { type: 'string', description: 'A mensagem (ou a legenda do arquivo).' },
          arquivo_url: { type: 'string', description: 'Endereço https do arquivo.' },
          base64: { type: 'string', description: 'Ou o arquivo em base64 (data URL).' },
          nome_arquivo: { type: 'string' },
        },
        additionalProperties: false,
      },
      run: async (caller, a) => {
        needModule(caller, 'whatsapp', 'WhatsApp')
        const text = String(a.texto ?? '').trim().slice(0, 4000)
        const hasFile = !!(a.arquivo_url || a.base64)
        if (!text && !hasFile) fail('Mande o texto ou um arquivo.')
        const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
        const [{ sent }] = await asUser(caller, (tx) => tx`select count(*)::int as sent from crm_whatsapp_messages where team_id = ${caller.team.id} and from_me and sent_by = ${caller.userId}::uuid and ts >= (${today}::date + time '03:00') at time zone 'UTC'`)
        if (sent >= WHATSAPP_DAILY_LIMIT) fail(`Limite de ${WHATSAPP_DAILY_LIMIT} envios por pessoa hoje alcançado (protege o número de bloqueio).`)

        let chat = a.conversa ? await findChat(caller, String(a.conversa)) : a.numero ? await findChat(caller, String(a.numero)) : undefined
        if (!chat) {
          if (!a.numero) fail('Conversa não encontrada: mande o número para abrir uma nova.')
          if (hasFile) fail('Para um número novo, mande primeiro só o texto; o arquivo vai depois, na conversa aberta.')
          const jid = await asUser(caller, async (tx) => (await tx`select crm_whatsapp_new_chat(${caller.team.id}::uuid, ${String(a.numero)}::text, ${text}::text) as jid`)[0].jid)
          return { ok: true, conversa: jid, enviado: 'na fila (sai em segundos pelo serviço do WhatsApp)', envios_hoje: sent + 1 }
        }
        if (hasFile) {
          const file = await fetchFile(deps, a)
          const path = `${caller.team.id}/saida/${crypto.randomUUID()}.${extOf(file.mime, file.name)}`
          const { error } = await admin.storage.from('crm-whatsapp').upload(path, file.bytes, { contentType: file.mime, upsert: false })
          if (error) fail(`Não consegui subir o arquivo (${error.message}).`)
          await asUser(caller, (tx) => tx`select crm_whatsapp_send_media(${caller.team.id}::uuid, ${chat!.jid}::text, ${text}::text, ${path}::text, ${file.mime}::text, ${file.name}::text, ${kindOf(file.mime)}::text)`)
          return { ok: true, conversa: chat.jid, para: chat.name ?? chat.phone, enviado: `${kindOf(file.mime)} na fila`, envios_hoje: sent + 1 }
        }
        await asUser(caller, (tx) => tx`select crm_whatsapp_send(${caller.team.id}::uuid, ${chat!.jid}::text, ${text}::text)`)
        return { ok: true, conversa: chat.jid, para: chat.name ?? chat.phone, enviado: 'na fila (sai em segundos pelo serviço do WhatsApp)', envios_hoje: sent + 1 }
      },
    },
    {
      name: 'sinfy_whatsapp_etiquetas',
      title: 'Etiquetas da conversa',
      description: 'Troca as etiquetas de uma conversa do WhatsApp (até 8): Quente, Morno, Frio, Cliente, Perdido ou outras.',
      inputSchema: { type: 'object', required: ['conversa', 'etiquetas'], properties: { conversa: { type: 'string' }, etiquetas: { type: 'array', items: { type: 'string' }, maxItems: 8 } }, additionalProperties: false },
      run: async (caller, a) => {
        needModule(caller, 'whatsapp', 'WhatsApp')
        const chat = await findChat(caller, String(a.conversa ?? ''))
        if (!chat) return fail('Conversa não encontrada nesta conta.')
        const tags = (Array.isArray(a.etiquetas) ? a.etiquetas : []).map((t) => String(t).trim().slice(0, 24)).filter(Boolean).slice(0, 8)
        await asUser(caller, (tx) => tx`select crm_whatsapp_set_tags(${caller.team.id}::uuid, ${chat!.jid}::text, ${tags}::text[])`)
        return { ok: true, conversa: chat.jid, etiquetas: tags }
      },
    },
    {
      name: 'sinfy_formulario_salvar',
      title: 'Criar ou mudar página de formulário',
      description: [
        'Cria ou muda um formulário ou quiz da conta, que tem página pública própria (link /f/<id>) e pode ir no site. Bom para testar uma oferta: a página com a proposta, as perguntas que qualificam e o botão de WhatsApp no fim. As respostas caem em Leads (crm_form_submissions) e viram oportunidade.',
        'definicao: {"kind":"form"|"quiz","steps":[{"title","description","fields":[{"id","type","label","help","placeholder","required","options":[{"id","label","score"}],"map":"name"|"email"|"phone"|"message","width":"half"}]}],"results":[{"min","title","text","ctaLabel","ctaUrl","qualified"}]}. Tipos de campo: short, long, email, phone, number, choice, multi, select, yesno, rating. Use map para nome, e-mail e telefone. No quiz, cada opção soma score e o resultado sai pela faixa (min).',
        'tema: {"primary","background","text","field","radius","font":"inherit"|"Inter"|"system","frame":"card"|"plain"}. config: {"submitLabel","nextLabel","successTitle","successText","redirectUrl","whatsapp":{"number","text"},"autoAdvance","showProgress","footnote"}.',
        'publicar=true deixa a página no ar; sem isso fica rascunho. Para mudar, mande o id.',
      ].join('\n'),
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Para mudar um formulário existente.' },
          nome: { type: 'string' },
          definicao: { type: 'object' },
          tema: { type: 'object' },
          config: { type: 'object' },
          publicar: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      run: async (caller, a) => {
        needModule(caller, 'formularios', 'Formulários')
        const current = a.id
          ? (await asUser(caller, (tx) => tx`select id, name, status, definition, theme, settings from crm_forms where id = ${String(a.id)}::uuid and team_id = ${caller.team.id}`))[0]
          : undefined
        if (a.id && !current) fail('Formulário não encontrado nesta conta.')
        const definition = cleanDefinition(a.definicao ?? current?.definition)
        if (!definition.steps.some((s) => s.fields.length)) fail('O formulário precisa de ao menos um campo.')
        const theme = cleanTheme({ ...THEME_DEFAULT, ...(current?.theme ?? {}), ...((a.tema as object) ?? {}) })
        const settings = cleanSettings({ ...SETTINGS_DEFAULT, ...(current?.settings ?? {}), ...((a.config as object) ?? {}) })
        const status = a.publicar === true ? 'published' : a.publicar === false ? 'draft' : current?.status ?? 'draft'
        const name = String(a.nome ?? current?.name ?? 'Novo formulário').trim().slice(0, 120) || 'Novo formulário'
        // Publicar passa pela mesma conferência do editor: com erro, não vai para o ar
        const problems = formIssues(definition, settings).filter((i) => i.level === 'error')
        if (status === 'published' && problems.length) fail(`Não publiquei: ${problems.map((i) => i.text).join(' ')}`)
        // `live` é a versão no ar (as outras colunas são o rascunho do editor); publicar grava as duas
        const live = status === 'published' ? { name, definition, theme, settings } : null
        const row = await asUser(caller, async (tx) =>
          current
            ? live
              ? (await tx`update crm_forms set name = ${name}, kind = ${definition.kind}, status = ${status}, definition = ${tx.json(definition as never)}, theme = ${tx.json(theme as never)}, settings = ${tx.json(settings as never)}, live = ${tx.json(live as never)}, live_at = now(), updated_at = now() where id = ${current.id} returning id`)[0]
              : (await tx`update crm_forms set name = ${name}, kind = ${definition.kind}, status = ${status}, definition = ${tx.json(definition as never)}, theme = ${tx.json(theme as never)}, settings = ${tx.json(settings as never)}, updated_at = now() where id = ${current.id} returning id`)[0]
            : (await tx`insert into crm_forms (team_id, name, kind, status, definition, theme, settings, live, live_at, created_by) values (${caller.team.id}, ${name}, ${definition.kind}, ${status}, ${tx.json(definition as never)}, ${tx.json(theme as never)}, ${tx.json(settings as never)}, ${live ? tx.json(live as never) : null}, ${live ? new Date() : null}, ${caller.userId}) returning id`)[0]
        )
        if (!row) fail('Sem permissão para salvar formulários nesta conta.')
        // A configuração pública (o mesmo arquivo que a tela grava): publicado grava, rascunho apaga
        const path = `${caller.team.id}/${row.id}.json`
        if (status === 'published') await admin.storage.from('crm-forms').upload(path, new Blob([JSON.stringify({ id: row.id, name, definition, theme, settings })], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '30' })
        else await admin.storage.from('crm-forms').remove([path])
        return {
          ok: true,
          id: row.id,
          status: status === 'published' ? 'no ar' : 'rascunho',
          pagina: `${appUrl}/f/${row.id}`,
          editar: `${appUrl}/crm/formularios/${row.id}`,
          respostas: 'Leia com sinfy_dados_ler na tabela crm_form_submissions, filtro form_id.',
        }
      },
    },
  ]
}
