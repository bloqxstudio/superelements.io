import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Code2, ExternalLink, GitBranch, Loader2, Monitor, MousePointer2, Navigation, Play, RefreshCw, Smartphone, Sparkles, Square, Tablet, TerminalSquare, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useIara, useIaraScreen } from '@/features/iara/store'
import { callSites, clearLog, useSitesLink } from '@/features/sites/link'
import type { ElementInfo, PickedElement, SiteEnv, SitePage, SiteStatus, TextHit } from '@/features/sites/protocol'
import { PublishDialog } from '@/features/sites/PublishDialog'
import { PREVIEW_TEXT, errorText, relFile } from '@/features/sites/ui'

/**
 * O editor visual de um site em código (Astro). A prévia é o `astro dev` do site rodando nesta
 * máquina, num iframe; o script de edição dentro dela (`scripts/sites/overlay.ts`) diz qual
 * elemento foi clicado (arquivo e posição no código) e manda o texto editado ali mesmo. O painel
 * da direita mostra o elemento: textos, links, imagem, e o que vem de dados. Mudanças maiores vão
 * pela Iara, que roda o agente na pasta do site. Publicar é um commit e um push.
 */

type Device = 'desktop' | 'tablet' | 'phone'
const DEVICES: Record<Device, { label: string; width: number | null; icon: typeof Monitor }> = {
  desktop: { label: 'Computador', width: null, icon: Monitor },
  tablet: { label: 'Tablet', width: 820, icon: Tablet },
  phone: { label: 'Celular', width: 390, icon: Smartphone },
}

interface Picked extends PickedElement {
  text?: string
}

const SiteEditor: React.FC = () => {
  const { siteId = '' } = useParams()
  const { ready, state, logs } = useSitesLink()
  const site = state?.sites.find((s) => s.id === siteId)
  const preview = state?.previews.find((p) => p.siteId === siteId)
  const frame = useRef<HTMLIFrameElement>(null)

  const [pages, setPages] = useState<SitePage[]>([])
  const [path, setPath] = useState('/')
  const [frameKey, setFrameKey] = useState(0)
  const [device, setDevice] = useState<Device>('desktop')
  const [edit, setEdit] = useState(true)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [info, setInfo] = useState<ElementInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [status, setStatus] = useState<SiteStatus | null>(null)
  const [terminal, setTerminal] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [annotated, setAnnotated] = useState(true)
  const pickedRef = useRef<Picked | null>(null)
  pickedRef.current = picked

  const running = preview?.state === 'rodando' && preview.url
  const src = running ? `${preview.url}${path}` : undefined

  // Abre a prévia sozinho, e de novo se a máquina reiniciar (não depois de a pessoa clicar em Parar)
  const stoppedByUser = useRef(false)
  const previewState = preview?.state
  useEffect(() => {
    if (!site || !ready || stoppedByUser.current) return
    if (!previewState || previewState === 'parada') void callSites('start', { siteId: site.id }).catch((e) => toast.error(errorText(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, ready, previewState])
  useEffect(() => {
    if (preview?.state === 'erro' || preview?.state === 'instalando') setTerminal(true)
  }, [preview?.state])

  // Variáveis do .env que o clone não trouxe (o .env não vai para o GitHub)
  const [env, setEnv] = useState<SiteEnv | null>(null)
  useEffect(() => {
    if (!site || !ready) return
    void callSites<SiteEnv>('env', { siteId: site.id }).then(setEnv).catch(() => {})
  }, [site?.id, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!site || !ready) return
    void callSites<SitePage[]>('pages', { siteId: site.id }).then(setPages).catch(() => {})
  }, [site?.id, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStatus = useCallback(
    (fetch = false) => {
      if (!site) return
      void callSites<SiteStatus>('status', { siteId: site.id, fetch })
        .then(setStatus)
        .catch(() => {})
    },
    [site]
  )
  // O agente também muda arquivos: o estado do git é relido sempre (é local e rápido)
  useEffect(() => {
    if (!site || !ready) return
    refreshStatus(true)
    const timer = setInterval(() => document.visibilityState === 'visible' && refreshStatus(), 5000)
    return () => clearInterval(timer)
  }, [site?.id, ready, refreshStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const post = useCallback((data: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(data, '*'), [])
  useEffect(() => post({ se: 'mode', edit }), [edit, post])

  const inspect = useCallback(
    async (el: Picked) => {
      if (!site) return
      setInfoError(null)
      try {
        setInfo(await callSites<ElementInfo>('inspect', { siteId: site.id, el }))
      } catch (error) {
        setInfo(null)
        setInfoError(errorText(error))
      }
    },
    [site]
  )

  const saveText = useCallback(
    async (el: PickedElement, after: string[]) => {
      if (!site) return
      try {
        const changes = await callSites<Array<{ file: string; via: string }>>('text', { siteId: site.id, el, after })
        if (changes.length) toast.success(changes.some((c) => c.via === 'busca') ? `Texto trocado em ${changes.map((c) => c.file).join(', ')}` : 'Texto salvo no código')
        refreshStatus()
      } catch (error) {
        toast.error(errorText(error))
        // A prévia mostra o texto que a pessoa digitou: volta ao que está no código
        setFrameKey((k) => k + 1)
      }
    },
    [site, refreshStatus]
  )

  // O que a prévia conta
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow || !e.data?.seEditor) return
      const m = e.data as { se: string; path?: string; el?: Picked; after?: string[]; annotated?: boolean }
      if (m.se === 'ready') {
        if (m.path) setPath(m.path)
        post({ se: 'mode', edit })
        setAnnotated(m.annotated !== false)
        const current = pickedRef.current
        if (current) post({ se: 'select', file: current.file, loc: current.loc })
      } else if (m.se === 'picked' && m.el) {
        if (!m.el.file || !m.el.loc) return void setAnnotated(false)
        setPicked(m.el)
        void inspect(m.el)
      } else if (m.se === 'text' && m.el && m.after) {
        void saveText(m.el, m.after)
      } else if (m.se === 'lost') {
        setPicked(null)
        setInfo(null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [edit, inspect, post, saveText])

  const changes = status?.changes.length ?? 0

  useIaraScreen(
    site
      ? {
          id: `site-${site.id}`,
          title: `Editor do site ${site.name}`,
          describe: () =>
            [
              `Site em código (Astro) "${site.name}"${site.repo ? `, repositório ${site.repo}` : ''}, pasta ${site.dir}.`,
              `Página aberta na prévia: ${path}.`,
              status ? `Branch ${status.branch}; ${changes ? `${changes} arquivo(s) com mudança ainda não publicada: ${status.changes.map((c) => c.file).slice(0, 12).join(', ')}` : 'nada a publicar'}.` : '',
              picked && info
                ? `Elemento escolhido: <${info.tag}> em ${info.file}, linha ${info.line} (${info.snippet}). Texto: "${picked.text ?? picked.segments.join(' ')}".${info.kind === 'dinamico' ? ` O texto vem de ${info.expressions.join(', ')}.` : ''}${info.repeated ? ' Ele se repete (está dentro de uma lista).' : ''}`
                : 'Nenhum elemento escolhido.',
            ]
              .filter(Boolean)
              .join('\n'),
          selection: () => (picked && info ? `<${info.tag}> ${info.file}:${info.line}` : ''),
          actions: [],
        }
      : null
  )

  if (!ready)
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center text-sm text-gray-500">
        Esperando esta máquina (conector ou npm run dev)…
      </div>
    )
  if (!site)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center text-sm text-gray-500">
        Este site não está ligado nesta máquina.
        <Button asChild variant="outline" size="sm">
          <Link to="/sites">Ver sites em código</Link>
        </Button>
      </div>
    )

  const width = DEVICES[device].width
  const behind = status?.behind ?? 0
  const onReview = status && status.branch !== status.defaultBranch

  return (
    <div className="flex h-screen min-w-0 flex-col bg-[#f4f4f5]">
      {/* Barra do topo */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3">
        <Link to="/sites" aria-label="Voltar para Sites em código" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <Code2 className="h-4 w-4 text-gray-400" aria-hidden />
        <span className="max-w-[180px] truncate text-sm font-medium text-gray-900">{site.name}</span>
        {status && (
          <span title={onReview ? 'Revisão: as edições entram neste PR' : 'Branch principal'} className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-xs md:flex ${onReview ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
            <GitBranch className="h-3 w-3" aria-hidden /> {status.branch}
          </span>
        )}

        <div className="mx-2 hidden min-w-0 items-center gap-1 lg:flex">
          <select
            value={pages.some((p) => p.route === path) ? path : ''}
            onChange={(e) => {
              setPath(e.target.value)
              setPicked(null)
              setInfo(null)
              setFrameKey((k) => k + 1)
            }}
            aria-label="Página"
            className="h-8 max-w-[220px] rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700"
          >
            {!pages.some((p) => p.route === path) && <option value="">{path}</option>}
            {pages.map((p) => (
              <option key={p.file} value={p.route} disabled={p.route.includes('[')}>
                {p.route === '/' ? 'Início (/)' : p.route}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="hidden items-center rounded-md border border-gray-200 p-0.5 md:flex" role="group" aria-label="Modo">
            <button type="button" onClick={() => setEdit(true)} aria-pressed={edit} className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${edit ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              <MousePointer2 className="h-3.5 w-3.5" aria-hidden /> Editar
            </button>
            <button type="button" onClick={() => setEdit(false)} aria-pressed={!edit} className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${!edit ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              <Navigation className="h-3.5 w-3.5" aria-hidden /> Navegar
            </button>
          </div>
          <div className="hidden items-center rounded-md border border-gray-200 p-0.5 sm:flex" role="group" aria-label="Tamanho da prévia">
            {(Object.keys(DEVICES) as Device[]).map((d) => {
              const Icon = DEVICES[d].icon
              return (
                <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={DEVICES[d].label} title={DEVICES[d].label} className={`rounded p-1.5 ${device === d ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => setFrameKey((k) => k + 1)} aria-label="Recarregar a prévia" title="Recarregar a prévia" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setTerminal((v) => !v)} aria-pressed={terminal} aria-label="Terminal da prévia" title="Terminal da prévia" className={`rounded-md p-2 hover:bg-gray-100 ${terminal ? 'text-gray-900' : 'text-gray-500'}`}>
            <TerminalSquare className="h-4 w-4" aria-hidden />
          </button>
          {site.url && (
            <a href={site.url} target="_blank" rel="noreferrer" title="Ver no ar" aria-label="Ver o site no ar" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <Button size="sm" className="ml-1" onClick={() => setPublishing(true)} disabled={!status}>
            Publicar{changes ? ` (${changes})` : ''}
          </Button>
        </div>
      </header>

      {env && env.missing.length > 0 && <EnvBanner siteId={site.id} env={env} onSaved={setEnv} />}

      {behind > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          O GitHub tem {behind} mudança(s) mais nova(s) que esta máquina.
          <button
            type="button"
            className="font-medium underline"
            onClick={() =>
              void callSites<SiteStatus>('pull', { siteId: site.id })
                .then((s) => {
                  setStatus(s)
                  toast.success('Atualizado do GitHub')
                })
                .catch((e) => toast.error(errorText(e)))
            }
          >
            Atualizar
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Prévia */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-auto p-3">
            {src ? (
              <iframe
                key={frameKey}
                ref={frame}
                src={src}
                title={`Prévia de ${site.name}`}
                className="h-full rounded-lg border border-gray-200 bg-white shadow-sm transition-[width] duration-200"
                style={{ width: width ? `${width}px` : '100%', maxWidth: '100%' }}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
                {preview?.state === 'erro' || (!preview && stoppedByUser.current) ? (
                  <>
                    {preview?.error ? <p className="max-w-md text-red-600">{preview.error}</p> : <p>Prévia parada.</p>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        stoppedByUser.current = false
                        void callSites('start', { siteId: site.id }).catch((e) => toast.error(errorText(e)))
                      }}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {preview?.state === 'erro' ? 'Tentar de novo' : 'Iniciar a prévia'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
                    <p>Prévia {PREVIEW_TEXT[preview?.state ?? 'iniciando']}…</p>
                    {preview?.state === 'instalando' && <p className="text-xs text-gray-400">A primeira vez instala as dependências do site (pode levar alguns minutos).</p>}
                  </>
                )}
              </div>
            )}
          </div>
          {terminal && (
            <div className="h-48 shrink-0 border-t border-gray-800 bg-gray-950 font-mono text-[11px] text-gray-300">
              <div className="flex items-center justify-between border-b border-gray-800 px-3 py-1 text-gray-500">
                <span>Terminal · prévia {PREVIEW_TEXT[preview?.state ?? 'parada']}{preview?.url ? ` · ${preview.url}` : ''}</span>
                <div className="flex items-center gap-3">
                  {running && (
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-gray-200"
                      onClick={() => {
                        stoppedByUser.current = true
                        void callSites('stop', { siteId: site.id })
                      }}
                    >
                      <Square className="h-3 w-3" aria-hidden /> Parar
                    </button>
                  )}
                  <button type="button" className="hover:text-gray-200" onClick={() => clearLog(site.id)}>Limpar</button>
                </div>
              </div>
              <pre className="h-[calc(100%-25px)] overflow-auto whitespace-pre-wrap px-3 py-2">{(logs[site.id] ?? []).join('\n') || 'Sem saída ainda.'}</pre>
            </div>
          )}
        </div>

        {/* Painel do elemento */}
        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white md:block">
          {!annotated ? (
            <p className="p-4 text-sm text-amber-800">A prévia não trouxe as marcas de código. A barra de ferramentas do Astro está desligada nas preferências desta máquina: rode <code>npx astro preferences enable devToolbar</code> na pasta do site e recarregue.</p>
          ) : picked ? (
            <ElementPanel key={`${picked.file}:${picked.loc}`} siteId={site.id} siteDir={site.dir} picked={picked} info={info} error={infoError} onSaveText={saveText} onChanged={() => refreshStatus()} />
          ) : (
            <div className="p-5 text-sm text-gray-500">
              <p className="font-medium text-gray-900">Escolha um elemento</p>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed">
                <li><strong className="font-medium text-gray-700">Clique</strong> num elemento da prévia para ver de onde ele vem no código.</li>
                <li><strong className="font-medium text-gray-700">Duplo clique</strong> num texto para editar ali mesmo. Enter salva, Esc desfaz.</li>
                <li>Para mudar layout, criar seção ou componente, peça à <strong className="font-medium text-gray-700">Iara</strong>: ela trabalha na pasta do site e a prévia recarrega sozinha.</li>
              </ul>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => useIara.setState({ open: true })}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Abrir a Iara
              </Button>
            </div>
          )}
        </aside>
      </div>

      {publishing && status && (
        <PublishDialog
          site={site}
          status={status}
          onClose={() => setPublishing(false)}
          onDone={(s) => {
            setStatus(s)
            setFrameKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

// ---------- variáveis de ambiente ----------

const EnvBanner: React.FC<{ siteId: string; env: SiteEnv; onSaved: (env: SiteEnv) => void }> = ({ siteId, env, onSaved }) => {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      onSaved(await callSites<SiteEnv>('env-set', { siteId, values }))
      toast.success('Variáveis salvas no .env desta máquina. Reiniciando a prévia.')
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <p>
        O site espera variáveis de ambiente que não vêm do GitHub (o <code>.env</code> fica fora do repositório). Faltam {env.missing.length} do <code>{env.example}</code>; sem elas, partes do site podem dar erro na prévia.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        {env.missing.map((key) => (
          <label key={key} className="flex min-w-[220px] flex-1 flex-col gap-0.5">
            <span className="font-mono text-[11px]">{key}</span>
            <input
              value={values[key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
              className="h-8 rounded-md border border-amber-300 bg-white px-2 font-mono text-xs text-gray-900"
            />
          </label>
        ))}
        <Button size="sm" type="submit" disabled={saving || !Object.values(values).some((v) => v.trim())}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />} Salvar e reiniciar a prévia
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-amber-800">Fica só no .env desta máquina, que o git ignora: nunca é publicado.</p>
    </form>
  )
}

// ---------- o painel do elemento ----------

const EDITABLE_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'title'],
  img: ['src', 'alt'],
  source: ['srcset'],
  video: ['src', 'poster'],
  iframe: ['src', 'title'],
  input: ['placeholder'],
  textarea: ['placeholder'],
  button: ['aria-label'],
}

const ATTR_LABEL: Record<string, string> = { href: 'Link', target: 'Abrir em', title: 'Dica (title)', src: 'Arquivo', alt: 'Texto alternativo', placeholder: 'Texto de exemplo', poster: 'Capa', srcset: 'Fontes', 'aria-label': 'Nome acessível' }

const ElementPanel: React.FC<{
  siteId: string
  siteDir: string
  picked: Picked
  info: ElementInfo | null
  error: string | null
  onSaveText: (el: PickedElement, after: string[]) => Promise<void>
  onChanged: () => void
}> = ({ siteId, siteDir, picked, info, error, onSaveText, onChanged }) => {
  const [texts, setTexts] = useState<string[]>(picked.segments)
  const [saving, setSaving] = useState(false)
  useEffect(() => setTexts(picked.segments), [picked])
  const dirty = texts.some((t, i) => t !== picked.segments[i])
  const components = picked.chain.map((f) => relFile(siteDir, f))

  const attrNames = useMemo(() => {
    const names = new Set(EDITABLE_ATTRS[picked.tag] ?? [])
    for (const a of info?.attrs ?? []) if (a.editable && (EDITABLE_ATTRS[picked.tag] ?? []).includes(a.name)) names.add(a.name)
    return [...names]
  }, [info, picked.tag])

  const save = async () => {
    setSaving(true)
    await onSaveText(picked, texts)
    setSaving(false)
  }

  return (
    <div className="p-4">
      <div className="flex items-baseline gap-2">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-xs text-violet-800">{`<${picked.tag}>`}</span>
        <span className="min-w-0 truncate font-mono text-xs text-gray-500" title={info ? `${info.file}:${info.line}` : relFile(siteDir, picked.file)}>
          {info ? `${info.file}:${info.line}` : relFile(siteDir, picked.file)}
        </span>
      </div>
      {components.length > 1 && (
        <p className="mt-1.5 truncate text-[11px] text-gray-400" title={components.join(' › ')}>
          dentro de {components.slice(1).map((f) => f.split('/').pop()).join(' › ')}
        </p>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {info?.repeated && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Este elemento está dentro de uma lista: mudar a estrutura dele muda todos os itens.</p>}

      {/* Texto */}
      {picked.segments.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Texto</h3>
          {info?.kind === 'dinamico' && (
            <p className="mt-1.5 text-xs text-gray-500">
              Vem de <code className="rounded bg-gray-100 px-1">{info.expressions.slice(0, 3).join(' ')}</code>. Ao salvar, o editor procura onde ele está escrito (uma lista, um arquivo de conteúdo) e troca lá.
            </p>
          )}
          <div className="mt-2 space-y-2">
            {texts.map((t, i) => (
              <textarea
                key={i}
                value={t}
                onChange={(e) => setTexts((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                rows={Math.min(5, Math.max(1, Math.ceil(t.length / 34)))}
                aria-label={texts.length > 1 ? `Trecho ${i + 1}` : 'Texto'}
                className="w-full resize-y rounded-md border border-gray-200 px-2.5 py-1.5 text-sm leading-snug text-gray-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            ))}
          </div>
          {texts.length > 1 && <p className="mt-1 text-[11px] text-gray-400">Um campo por trecho: negrito, quebras e links entre eles continuam no código.</p>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />} Salvar texto
            </Button>
            {dirty && (
              <Button size="sm" variant="ghost" onClick={() => setTexts(picked.segments)}>
                Desfazer
              </Button>
            )}
          </div>
          <FindInCode siteId={siteId} texts={picked.segments} onChanged={onChanged} />
        </section>
      )}

      {/* Imagem e atributos */}
      {picked.tag === 'img' && <ImageSwap siteId={siteId} picked={picked} editable={!info || info.attrs.find((a) => a.name === 'src')?.editable !== false} onChanged={onChanged} />}
      {attrNames.length > 0 && (
        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Propriedades</h3>
          <div className="mt-2 space-y-3">
            {attrNames.map((name) => {
              const fromCode = info?.attrs.find((a) => a.name === name)
              return <AttrField key={name} siteId={siteId} picked={picked} name={name} value={fromCode?.value ?? picked.attrs[name] ?? ''} locked={fromCode ? !fromCode.editable : false} onChanged={onChanged} />
            })}
          </div>
        </section>
      )}

      <section className="mt-6 border-t border-gray-100 pt-4">
        <Button variant="outline" size="sm" className="w-full" onClick={() => useIara.setState({ open: true })}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Pedir à Iara sobre este elemento
        </Button>
        <p className="mt-1.5 text-[11px] text-gray-400">Ela recebe o arquivo e a linha. Ex.: "deixa este botão maior no celular".</p>
      </section>
    </div>
  )
}

const AttrField: React.FC<{ siteId: string; picked: PickedElement; name: string; value: string; locked: boolean; onChanged: () => void }> = ({ siteId, picked, name, value, locked, onChanged }) => {
  const [v, setV] = useState(value)
  const [saving, setSaving] = useState(false)
  useEffect(() => setV(value), [value])
  const save = async () => {
    setSaving(true)
    try {
      await callSites('attr', { siteId, el: picked, name, value: v })
      toast.success(`${ATTR_LABEL[name] ?? name} salvo no código`)
      onChanged()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{ATTR_LABEL[name] ?? name}</span>
      <div className="mt-1 flex gap-1.5">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && v !== value && void save()}
          disabled={locked}
          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2 font-mono text-xs text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {v !== value && (
          <Button size="sm" className="h-8" disabled={saving} onClick={() => void save()}>
            Salvar
          </Button>
        )}
      </div>
      {locked && <span className="mt-0.5 block text-[11px] text-gray-400">Vem do código: peça à Iara para trocar.</span>}
    </label>
  )
}

const ImageSwap: React.FC<{ siteId: string; picked: PickedElement; editable: boolean; onChanged: () => void }> = ({ siteId, picked, editable, onChanged }) => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (file: File) => {
    setBusy(true)
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Não consegui ler a imagem.'))
        reader.readAsDataURL(file)
      })
      await callSites('image', { siteId, el: picked, name: file.name, data })
      toast.success('Imagem trocada')
      onChanged()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Imagem</h3>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <Button size="sm" variant="outline" className="mt-2 w-full" disabled={!editable || busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />} Trocar imagem
      </Button>
      <p className="mt-1 text-[11px] text-gray-400">{editable ? 'A imagem vai para public/sinfy/ no repositório do site.' : 'A imagem vem de um import no código: peça à Iara para trocar.'}</p>
    </section>
  )
}

/** Onde mais esse texto aparece no código, para trocar num lugar escolhido. */
const FindInCode: React.FC<{ siteId: string; texts: string[]; onChanged: () => void }> = ({ siteId, texts, onChanged }) => {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Array<{ text: string; hits: TextHit[] }> | null>(null)
  const [next, setNext] = useState<Record<string, string>>({})
  const search = async () => {
    setOpen(true)
    const found = await Promise.all(texts.slice(0, 6).map(async (text) => ({ text, hits: await callSites<TextHit[]>('find', { siteId, text }).catch(() => []) })))
    setResults(found)
  }
  const replace = async (text: string, hit: TextHit) => {
    const key = `${text}|${hit.file}:${hit.line}`
    try {
      await callSites('replace', { siteId, text, next: next[key] ?? text, file: hit.file, line: hit.line })
      toast.success(`Trocado em ${hit.file}:${hit.line}`)
      onChanged()
    } catch (error) {
      toast.error(errorText(error))
    }
  }
  if (!open)
    return (
      <button type="button" onClick={() => void search()} className="mt-3 text-xs text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">
        Onde mais esse texto aparece no código?
      </button>
    )
  return (
    <div className="mt-3 space-y-3 rounded-md bg-gray-50 p-2.5">
      {!results && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />}
      {results?.map(({ text, hits }) => (
        <div key={text}>
          <p className="truncate text-xs font-medium text-gray-700">“{text}”</p>
          {!hits.length && <p className="text-[11px] text-gray-400">Não está escrito assim no código (é montado por uma conta).</p>}
          {hits.slice(0, 8).map((hit) => {
            const key = `${text}|${hit.file}:${hit.line}`
            return (
              <div key={key} className="mt-1.5">
                <p className="truncate font-mono text-[11px] text-gray-500" title={hit.snippet}>{hit.file}:{hit.line}</p>
                <div className="mt-0.5 flex gap-1">
                  <input value={next[key] ?? text} onChange={(e) => setNext((n) => ({ ...n, [key]: e.target.value }))} className="h-7 min-w-0 flex-1 rounded border border-gray-200 bg-white px-1.5 text-xs" aria-label={`Texto novo em ${hit.file}:${hit.line}`} />
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={(next[key] ?? text) === text} onClick={() => void replace(text, hit)}>
                    Trocar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default SiteEditor
