import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, CircleAlert, Download, ExternalLink, FilePlus2, Globe, Loader2, ShoppingBag, SkipForward } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/features/crm/crmStore'
import { ModuleToggles } from '@/features/crm/ModuleToggles'
import { productModules, type ModuleId, type ProductId } from '@/features/crm/modules'
import { ProductPicker } from '@/features/crm/ProductPicker'
import { createAccount } from '@/features/crm/teams'
import { createTracker, type SiteTracker } from '@/features/crm/site'
import { FIELD } from '@/features/crm/ui'
import { useProject, useProjectStore } from '@/features/projects/projectStore'
import { loadWordPressConnection } from '@/features/projects/storage'
import { useProjectSession, useProjectSync } from '@/features/projects/useProjectSession'
import { CONNECTOR_ZIP, openAdmin } from '@/features/wordpress/autologin'
import { authorizationUrl, canReturnHere, completeConnection, listenConnections } from '@/features/wordpress/connect'
import { pingConnector } from '@/features/wordpress/pluginPing'
import { diagnoseSite } from '@/features/prospects/api'
import { restUrl, siteCandidates, type WordPressSite } from '@/features/wordpress/rest'
import { syncSiteConfig } from '@/features/wordpress/siteConfig'
import type { WordPressConnection } from '@/features/wordpress/types'
import { openApprovalWindow } from '@/features/wordpress/WordPressDialog'
import { cn } from '@/lib/utils'
import { importWholeSite } from './importSite'
import { detectSiteKind, type SiteKind } from './siteKind'
import { manualStore, readShopifyStore, type ShopifyStore } from './shopify'
import { ShopifyOnboarding } from './ShopifyOnboarding'

/**
 * Assistente de conta nova: o tipo de site, o cadastro básico e, para WordPress, conectar, instalar o
 * plugin e importar o site. O projeto abre em segundo plano (sem o editor) e a pessoa cai na tela
 * principal quando termina. Loja Shopify (escolhida no começo, ou achada pelo endereço em "Já tem um
 * site"): a conta nasce sem Projetos e com o Analytics do site, a loja já cadastrada nele, e segue
 * para o onboarding da loja (`ShopifyOnboarding`: os dois códigos e a conferência ao vivo).
 */

const EMPTY = { name: '', segment: '', website: '', contactName: '', contactEmail: '', contactPhone: '' }

type Origin = 'new' | 'url' | 'shopify'
type Phase = 'origin' | 'details' | 'run' | 'shopify'

/** Loja Shopify: sem o Space (Projetos), com o Analytics do site */
const SHOPIFY_MODULES: Record<string, boolean> = { projetos: false, site: true }
type Status = 'wait' | 'doing' | 'done' | 'skipped' | 'error'
type TaskId = 'account' | 'connect' | 'plugin' | 'import'

const TASKS: { id: TaskId; label: string }[] = [
  { id: 'account', label: 'Criar a conta e o projeto' },
  { id: 'connect', label: 'Conectar o WordPress' },
  { id: 'plugin', label: 'Instalar o plugin Superelements Connector' },
  { id: 'import', label: 'Importar o site' },
]

/** Abre o projeto em segundo plano: o conteúdo carrega e salva sem o editor aparecer. */
const BackgroundProject: React.FC<{ projectId: string; onReady: () => void }> = ({ projectId, onReady }) => {
  const project = useProject(projectId)
  const { state } = useProjectSession(project?.id)
  useEffect(() => {
    if (state === 'ready') onReady()
  }, [state, onReady])
  return null
}

/** Usuários que o site mostra na API pública (autores), mais o `admin`, para tentar com a senha. */
async function guessLogins(site: WordPressSite): Promise<string[]> {
  const found: string[] = []
  try {
    const response = await fetch(restUrl(site.restRoot, 'wp/v2/users', { per_page: '20', _fields: 'slug' }), { headers: { Accept: 'application/json' } })
    if (response.ok) for (const user of (await response.json()) as { slug?: string }[]) if (user.slug) found.push(user.slug)
  } catch {
    // sem a lista pública, só resta pedir o usuário
  }
  return [...new Set([...found, 'admin'])]
}

const waitSaved = async (projectId: string) => {
  // A sessão salva sozinha; espera o salvamento terminar antes de sair da tela
  await new Promise((r) => setTimeout(r, 2500))
  for (let i = 0; i < 20; i++) {
    const sync = useProjectSync.getState()
    if (sync.projectId !== projectId || sync.status === 'saved') return
    await new Promise((r) => setTimeout(r, 750))
  }
}

export const AccountWizard: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const load = useCrm((s) => s.load)
  const select = useCrm((s) => s.select)

  const [phase, setPhase] = useState<Phase>('origin')
  const [origin, setOrigin] = useState<Origin>('new')
  const [form, setForm] = useState(EMPTY)
  const [modules, setModules] = useState<Record<string, boolean>>({})
  const [product, setProduct] = useState<ProductId>('completo')
  const [kind, setKind] = useState<SiteKind | 'checking' | null>(null)
  const checkSeq = useRef(0)

  const [status, setStatus] = useState<Record<TaskId, Status>>({ account: 'wait', connect: 'wait', plugin: 'wait', import: 'wait' })
  const [detail, setDetail] = useState<Partial<Record<TaskId, string>>>({})
  const [projectId, setProjectId] = useState<string>()
  const [ready, setReady] = useState(false)
  const [connection, setConnection] = useState<WordPressConnection | null>(null)
  const [pluginVersion, setPluginVersion] = useState<string | null>(null)
  const [skipPlugin, setSkipPlugin] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const approval = useRef<{ href: string } | null>(null)
  // Sem retorno (app em http, ou site que não devolve): a senha aparece no WordPress e é colada aqui
  const [manual, setManual] = useState(false)
  const [login, setLogin] = useState('')
  const [needLogin, setNeedLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [pasting, setPasting] = useState(false)
  const started = useRef(false)
  // Loja Shopify: lida do `/meta.json` enquanto o endereço é digitado; depois, o site cadastrado no Analytics
  const [shop, setShop] = useState<ShopifyStore | 'checking' | null>(null)
  const [shopTracker, setShopTracker] = useState<SiteTracker | null>(null)
  const shopSeq = useRef(0)

  // Campos que a pessoa mexeu: o que vem do site nunca escreve por cima
  const touched = useRef(new Set<string>())
  const [filled, setFilled] = useState(false)
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    touched.current.add(key)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const fill = useCallback((values: Partial<typeof EMPTY>) => {
    const next = Object.entries(values).filter(([key, value]) => value && !touched.current.has(key))
    if (!next.length) return
    setForm((f) => ({ ...f, ...Object.fromEntries(next.filter(([key]) => !f[key as keyof typeof EMPTY])) }))
    setFilled(true)
  }, [])
  const mark = (id: TaskId, value: Status, text?: string) => {
    setStatus((s) => ({ ...s, [id]: value }))
    setDetail((d) => ({ ...d, [id]: text }))
  }

  // Descobre o tipo do site enquanto o endereço é digitado
  useEffect(() => {
    if (origin !== 'url') return
    const text = form.website.trim()
    if (!siteCandidates(text).length) {
      checkSeq.current++
      setKind(null)
      return
    }
    const id = ++checkSeq.current
    setKind('checking')
    const timer = setTimeout(() => {
      void detectSiteKind(text).then((result) => id === checkSeq.current && setKind(result))
    }, 600)
    return () => clearTimeout(timer)
  }, [form.website, origin])

  // Loja Shopify: confirma pelo endereço e preenche o nome
  useEffect(() => {
    if (origin !== 'shopify') return
    const text = form.website.trim()
    if (!siteCandidates(text).length) {
      shopSeq.current++
      setShop(null)
      return
    }
    const id = ++shopSeq.current
    setShop('checking')
    const timer = setTimeout(() => {
      void readShopifyStore(text).then((store) => {
        if (id !== shopSeq.current) return
        setShop(store)
        if (store) fill({ name: store.name })
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [form.website, origin, fill])
  const store = origin === 'shopify' && shop && shop !== 'checking' ? shop : null

  /** Em "Já tem um site" o endereço era de uma loja Shopify: segue pelo onboarding dela */
  const switchToShopify = (found: ShopifyStore) => {
    setOrigin('shopify')
    setModules((m) => ({ ...m, ...SHOPIFY_MODULES }))
    shopSeq.current++
    setShop(found)
    fill({ name: found.name })
  }

  // Achou o site: o nome vem do próprio WordPress e o contato, da leitura da página inicial (se a função estiver no ar)
  const detectedSite = kind && kind !== 'checking' && kind.kind === 'wordpress' ? kind.site : null
  useEffect(() => {
    if (!detectedSite) return
    fill({ name: detectedSite.name })
    let active = true
    void diagnoseSite(form.website.trim())
      .then(({ scan }) => {
        if (!active) return
        fill({ contactEmail: scan.emails[0], contactPhone: scan.whatsapp ?? scan.phones[0] })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
    // só quando o site detectado muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedSite?.siteUrl, fill])

  const wordpress = origin === 'url' && kind && kind !== 'checking' && kind.kind === 'wordpress' && !kind.blocked ? kind : null

  // ---- execução ----

  const finish = useCallback(
    async (id: string) => {
      await waitSaved(id)
      toast.success(`Conta ${form.name.trim()} pronta`)
      navigate('/', { replace: true })
    },
    [form.name, navigate]
  )

  const start = async () => {
    if (!user || !form.name.trim() || started.current || (origin === 'shopify' && !store)) return
    started.current = true
    // A janela de aprovação precisa abrir neste clique; o endereço entra quando a conta existir
    const popup = wordpress ? openApprovalWindow() : null
    setPhase('run')
    mark('account', 'doing')
    if (origin === 'shopify' && store) {
      try {
        const teamId = await createAccount({ ...form, website: form.website.trim() || store.domain, modules: { ...modules, site: true }, product })
        await load(user.id, true)
        await select(teamId)
        const name = form.name.trim() || store.name
        const id = await createTracker(teamId, store.domain, name)
        setShopTracker({ id, teamId, name, domain: store.domain, createdAt: Date.now() })
        mark('account', 'done')
        setPhase('shopify')
      } catch (error) {
        started.current = false
        setFailure(error instanceof Error ? error.message : 'Não foi possível criar a conta.')
        mark('account', 'error')
      }
      return
    }
    try {
      const teamId = await createAccount({ ...form, modules, product })
      await load(user.id, true)
      await select(teamId)
      const project = await useProjectStore.getState().create({ name: form.name.trim(), context: form.website.trim() ? `Site: ${form.website.trim()}` : '' })
      setProjectId(project.id)
      mark('account', 'done')
      if (!wordpress) {
        popup?.close()
        await new Promise((r) => setTimeout(r, 300))
        return void (await finish(project.id))
      }
      const returnHere = canReturnHere(wordpress.site)
      setManual(!returnHere)
      mark('connect', 'doing', returnHere ? 'Aprove o acesso na janela do WordPress.' : 'Aprove na janela do WordPress, copie a senha que ele mostrar e cole abaixo.')
      const href = authorizationUrl({ projectId: project.id, projectName: form.name.trim(), site: wordpress.site, mode: 'popup', returnHere })
      approval.current = { href }
      if (popup) {
        popup.location.href = href
        popup.focus()
      }
    } catch (error) {
      started.current = false
      setFailure(error instanceof Error ? error.message : 'Não foi possível criar a conta.')
      mark('account', 'error')
    }
  }

  // A janela de aprovação avisa que conectou
  useEffect(() => {
    if (!projectId || !wordpress) return
    return listenConnections((message) => {
      if (message.projectId !== projectId) return
      if (message.type === 'connected') {
        void loadWordPressConnection(projectId).then((saved) => {
          if (!saved) return
          setConnection(saved)
          mark('connect', 'done', saved.site.name)
          mark('plugin', 'doing')
        })
      } else if (message.type === 'rejected') {
        mark('connect', 'error', 'O acesso foi recusado na tela do WordPress.')
      } else if (message.type === 'failed') {
        mark('connect', 'error', message.error)
      }
    })
  }, [projectId, wordpress])

  const savePasted = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!projectId || !wordpress) return
    setPasting(true)
    try {
      // O WordPress pede usuário e senha, mas só a senha é mostrada: o usuário vem da lista pública do site
      const candidates = login.trim() ? [login.trim()] : await guessLogins(wordpress.site)
      let saved: WordPressConnection | null = null
      for (const candidate of candidates) {
        saved = await completeConnection(projectId, wordpress.site, candidate, password).catch(() => null)
        if (saved) break
      }
      if (!saved) {
        setNeedLogin(true)
        throw new Error(login.trim() ? 'O WordPress não aceitou o usuário e a senha.' : 'Não consegui descobrir o usuário do WordPress. Informe-o abaixo.')
      }
      setPassword('')
      setConnection(saved)
      mark('connect', 'done', saved.site.name)
      mark('plugin', 'doing')
    } catch (error) {
      mark('connect', 'error', error instanceof Error ? error.message : 'Não foi possível conectar.')
    } finally {
      setPasting(false)
    }
  }

  const reopenApproval = () => {
    if (!approval.current) return
    mark('connect', 'doing', manual ? 'Aprove na janela do WordPress, copie a senha que ele mostrar e cole abaixo.' : 'Aprove o acesso na janela do WordPress.')
    const popup = openApprovalWindow()
    if (popup) {
      popup.location.href = approval.current.href
      popup.focus()
    }
  }

  // Plugin: procura a cada poucos segundos até ficar ativo
  useEffect(() => {
    if (status.plugin !== 'doing' || !connection) return
    let active = true
    const run = async () => {
      const version = await pingConnector(connection.site)
      if (!active) return
      setPluginVersion(version)
      if (version && version >= '0.5') {
        mark('plugin', 'done', `Versão ${version}`)
        void syncSiteConfig(projectId ?? '', connection).catch(() => undefined)
      }
    }
    void run()
    const timer = setInterval(run, 4000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [status.plugin, connection, projectId])

  useEffect(() => {
    if (skipPlugin && status.plugin === 'doing') mark('plugin', 'skipped', 'Dá para instalar depois, pelo menu do projeto.')
  }, [skipPlugin, status.plugin])

  // Importação: sozinha, quando o plugin foi resolvido e o projeto já abriu em segundo plano
  const importing = useRef(false)
  useEffect(() => {
    if (!connection || !projectId || !ready || importing.current) return
    if (status.plugin !== 'done' && status.plugin !== 'skipped') return
    importing.current = true
    mark('import', 'doing', 'Começando…')
    void importWholeSite(connection, (text) => setDetail((d) => ({ ...d, import: text })))
      .then(async (result) => {
        mark('import', 'done', `${result.pages} página(s)${result.globals ? ` e ${result.globals} modelo(s)` : ''}`)
        if (result.failed.length) toast.message('Algumas páginas não vieram', { description: result.failed.join('\n') })
        await finish(projectId)
      })
      .catch((error) => {
        mark('import', 'error', error instanceof Error ? error.message : 'Falha ao importar.')
        importing.current = false
      })
  }, [connection, projectId, ready, status.plugin, finish])

  const openUpload = async () => {
    if (!connection) return
    try {
      await openAdmin(connection, 'plugin-install.php?tab=upload')
    } catch {
      toast.error('Não consegui abrir o painel do WordPress.')
    }
  }

  const onReady = useCallback(() => setReady(true), [])

  // ---- telas ----

  const card = 'rounded-2xl border bg-white p-6 shadow-sm'

  if (phase === 'origin') {
    const choose = (next: Origin) => {
      setOrigin(next)
      if (next === 'shopify') setModules((m) => ({ ...m, ...SHOPIFY_MODULES }))
      setPhase('details')
    }
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-gray-900">Nova conta</h1>
        <p className="mt-1 text-sm text-gray-600">O cliente já tem um site, tem uma loja Shopify ou vamos começar do zero?</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => choose('url')} className={cn(card, 'flex flex-col items-start justify-start text-left transition-colors hover:border-gray-400')}>
            <Globe className="h-5 w-5 text-gray-700" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-gray-900">Já tem um site</p>
            <p className="mt-1 text-sm text-gray-600">Informe o endereço. Se for WordPress, conectamos, instalamos o plugin e importamos as páginas.</p>
          </button>
          <button type="button" onClick={() => choose('shopify')} className={cn(card, 'flex flex-col items-start justify-start text-left transition-colors hover:border-gray-400')}>
            <ShoppingBag className="h-5 w-5 text-gray-700" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-gray-900">Loja Shopify</p>
            <p className="mt-1 text-sm text-gray-600">Visitas, origem, carrinho e vendas da loja no Analytics. Dois códigos no admin, sem plugin.</p>
          </button>
          <button type="button" onClick={() => choose('new')} className={cn(card, 'flex flex-col items-start justify-start text-left transition-colors hover:border-gray-400')}>
            <FilePlus2 className="h-5 w-5 text-gray-700" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-gray-900">Site novo</p>
            <p className="mt-1 text-sm text-gray-600">Cria a conta e o projeto vazio. O site é construído depois.</p>
          </button>
        </div>
        <Button variant="ghost" className="mt-4 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Cancelar
        </Button>
      </div>
    )
  }

  if (phase === 'details') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-gray-900">{origin === 'url' ? 'Dados da conta e do site' : origin === 'shopify' ? 'Dados da conta e da loja' : 'Dados da conta'}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void start()
          }}
          className={cn(card, 'mt-6 grid gap-5')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {origin === 'shopify' && (
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-gray-700">Endereço da loja</span>
                <input value={form.website} onChange={set('website')} maxLength={200} placeholder="minhaloja.com.br ou minhaloja.myshopify.com" required autoFocus className={`${FIELD} h-10`} />
                <span className="flex min-h-5 items-center gap-1.5 text-xs text-gray-600">
                  {shop === 'checking' && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Procurando a loja…
                    </>
                  )}
                  {store && (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Loja Shopify{store.headless ? ' (headless)' : ''}: {store.name} · {store.domain}
                      {store.currency ? ` · ${store.currency}` : ''}
                    </>
                  )}
                  {shop === null && form.website.trim() && siteCandidates(form.website.trim()).length > 0 && (
                    <>
                      <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                      <span>
                        Não achei uma loja Shopify com tema neste endereço. Confira o domínio (ou use o .myshopify.com).{' '}
                        {manualStore(form.website, form.name) && (
                          <button
                            type="button"
                            onClick={() => {
                              shopSeq.current++
                              setShop(manualStore(form.website, form.name))
                            }}
                            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
                          >
                            É Shopify (headless): continuar com este domínio
                          </button>
                        )}
                      </span>
                    </>
                  )}
                </span>
              </label>
            )}
            {origin === 'url' && (
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-gray-700">Endereço do site</span>
                <input value={form.website} onChange={set('website')} maxLength={200} placeholder="cliente.com.br" required autoFocus className={`${FIELD} h-10`} />
                <span className="flex min-h-5 items-center gap-1.5 text-xs text-gray-600">
                  {kind === 'checking' && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Identificando o tipo do site…
                    </>
                  )}
                  {kind && kind !== 'checking' && kind.kind === 'wordpress' && !kind.blocked && (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> WordPress{kind.site.elementor ? ' com Elementor' : ''}: {kind.site.name}
                    </>
                  )}
                  {kind && kind !== 'checking' && kind.kind === 'wordpress' && kind.blocked && (
                    <>
                      <CircleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden /> WordPress, mas: {kind.blocked}
                    </>
                  )}
                  {kind && kind !== 'checking' && kind.kind === 'shopify' && (
                    <>
                      <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Loja Shopify: {kind.store.name}.
                      <button type="button" onClick={() => switchToShopify(kind.store)} className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700">
                        Seguir pelo onboarding da Shopify
                      </button>
                    </>
                  )}
                  {kind && kind !== 'checking' && kind.kind === 'other' && (
                    <>
                      <CircleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden /> Não é um WordPress que a plataforma consiga conectar. A conta é criada sem importar o site.
                    </>
                  )}
                </span>
              </label>
            )}
            {filled && <p className="text-xs text-gray-500 sm:col-span-2">Preenchido a partir do site. Confira e corrija o que precisar.</p>}
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-700">Nome da empresa</span>
              <input value={form.name} onChange={set('name')} maxLength={120} required autoFocus={origin === 'new'} className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-700">Segmento</span>
              <input value={form.segment} onChange={set('segment')} maxLength={120} placeholder="Ex.: escritório de arquitetura" className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-gray-700">Pessoa de contato</span>
              <input value={form.contactName} onChange={set('contactName')} maxLength={120} className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-gray-700">E-mail do contato</span>
              <input type="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={160} className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-700">Telefone ou WhatsApp</span>
              <input value={form.contactPhone} onChange={set('contactPhone')} maxLength={40} className={`${FIELD} h-10`} />
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">Produto</p>
            <ProductPicker value={product} onChange={(p) => { setProduct(p); setModules(productModules(p)) }} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">Módulos que já nascem ligados</p>
            <ModuleToggles value={modules} onChange={(id: ModuleId, on) => setModules((m) => ({ ...m, [id]: on }))} />
            <p className="mt-2 text-xs text-gray-500">Dá para mudar depois em Contas.</p>
          </div>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" className="gap-2" onClick={() => setPhase('origin')}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
            </Button>
            <Button type="submit" disabled={!form.name.trim() || (origin === 'url' && !form.website.trim()) || (origin === 'shopify' && !store)}>
              {wordpress ? 'Criar e conectar o WordPress' : origin === 'shopify' ? 'Criar e conectar a loja' : 'Criar conta'}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  if (phase === 'shopify' && store && shopTracker) {
    return (
      <ShopifyOnboarding
        store={store}
        tracker={shopTracker}
        accountName={form.name.trim() || store.name}
        onOpenSite={() => navigate('/crm/site', { replace: true })}
        onLater={() => navigate('/', { replace: true })}
      />
    )
  }

  const tasks = TASKS.filter((t) => wordpress || t.id === 'account')
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      {projectId && !failure?.startsWith('Não foi possível criar') && <BackgroundProject projectId={projectId} onReady={onReady} />}
      <h1 className="text-xl font-semibold text-gray-900">Preparando {form.name.trim()}</h1>
      <p className="mt-1 text-sm text-gray-600">Mantenha esta tela aberta. Ao terminar, você cai na tela principal.</p>
      <ol className={cn(card, 'mt-6 grid gap-4')}>
        {tasks.map((task) => {
          const s = status[task.id]
          return (
            <li key={task.id} className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                  s === 'done' && 'bg-emerald-500 text-white',
                  s === 'skipped' && 'bg-zinc-300 text-white',
                  s === 'error' && 'bg-red-500 text-white',
                  (s === 'wait' || s === 'doing') && 'bg-zinc-200 text-gray-600'
                )}
              >
                {s === 'doing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : s === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden /> : s === 'skipped' ? <SkipForward className="h-3 w-3" aria-hidden /> : s === 'error' ? '!' : ''}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', s === 'wait' ? 'text-gray-400' : 'text-gray-900')}>{task.label}</p>
                {detail[task.id] && <p className={cn('mt-0.5 text-xs', s === 'error' ? 'text-red-600' : 'text-gray-500')}>{detail[task.id]}</p>}
                {task.id === 'connect' && (s === 'doing' || s === 'error') && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={reopenApproval}>
                    Abrir a aprovação no WordPress
                  </Button>
                )}
                {task.id === 'connect' && manual && (s === 'doing' || s === 'error') && (
                  <form onSubmit={(e) => void savePasted(e)} className="mt-3 grid gap-2">
                    <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Cole aqui a senha mostrada pelo WordPress" autoComplete="off" required autoFocus className={`${FIELD} h-9 font-mono`} />
                    {needLogin && <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Usuário do WordPress (o que você usa para entrar)" autoComplete="off" required className={`${FIELD} h-9`} />}
                    <Button type="submit" size="sm" className="w-fit" disabled={pasting || !password.trim() || (needLogin && !login.trim())}>
                      {pasting ? 'Conferindo…' : 'Conectar'}
                    </Button>
                  </form>
                )}
                {task.id === 'plugin' && s === 'doing' && (
                  <div className="mt-2 grid gap-2">
                    <p className="text-xs text-gray-600">No painel do WordPress: Plugins › Adicionar novo › Enviar plugin; escolha o arquivo e ative. A tela avança sozinha.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild className="gap-2">
                        <a href={CONNECTOR_ZIP} download>
                          <Download className="h-4 w-4" aria-hidden /> 1. Baixar o plugin
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => void openUpload()}>
                        <ExternalLink className="h-4 w-4" aria-hidden /> 2. Abrir o envio no WordPress
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSkipPlugin(true)}>
                        Pular
                      </Button>
                    </div>
                    {pluginVersion && pluginVersion < '0.5' && <p className="text-xs text-amber-700">O site tem o plugin {pluginVersion}, antigo. Envie este arquivo para atualizar.</p>}
                  </div>
                )}
                {task.id === 'import' && s === 'error' && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => projectId && navigate(`/projetos/${projectId}`)}>
                    Abrir o projeto e importar de lá
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {failure && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p>{failure}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('/', { replace: true })}>
              Ir para a tela principal
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
