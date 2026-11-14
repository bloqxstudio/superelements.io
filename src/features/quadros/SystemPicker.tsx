import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, BarChart3, FileText, Filter, Globe, Image as ImageIcon, LayoutTemplate, Link2, Loader2, Palette } from 'lucide-react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { listForms, type CrmForm } from '@/features/crm/forms'
import { listFunnels, pipelineFunnel, type Funnel } from '@/features/funnels/funnels'
import { listProjects } from '@/features/projects/storage'
import type { Project } from '@/features/projects/types'
import { useSitesLink } from '@/features/sites/link'
import { accountSets } from '@/features/criativos/accountSets'
import { useCovers } from '@/features/criativos/covers'
import { coverUrls, loadSet } from '@/features/criativos/storage'
import type { CreativeSet, Post, SetSummary } from '@/features/criativos/types'
import { renderCreative } from '@/features/crm/instagram'
import { refreshAccount, useInsumos } from '@/features/criativos/insumos'
import { DASHBOARDS, insertImages, insertSystemEmbed, type SystemRef } from './embed'

/** "Do sistema": escolhe um item da conta e põe no quadro (tela ao vivo ou imagens). */

type Tab = 'criativos' | 'arquivos' | 'paginas' | 'sites' | 'formularios' | 'funis' | 'dashboards' | 'link'
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'criativos', label: 'Criativos', icon: Palette },
  { id: 'arquivos', label: 'Arquivos', icon: ImageIcon },
  { id: 'paginas', label: 'Páginas', icon: LayoutTemplate },
  { id: 'sites', label: 'Sites', icon: Globe },
  { id: 'formularios', label: 'Formulários', icon: FileText },
  { id: 'funis', label: 'Funis', icon: Filter },
  { id: 'dashboards', label: 'Dashboards', icon: BarChart3 },
  { id: 'link', label: 'Link', icon: Link2 },
]

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="py-10 text-center text-sm text-gray-500">{children}</p>
const Loading = () => <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>

/** Carrega uma lista quando a aba abre. */
function useList<T>(on: boolean, key: string | undefined, load: () => Promise<T[]>) {
  const [state, setState] = useState<{ key?: string; items?: T[]; error?: string }>({})
  useEffect(() => {
    if (!on || !key || state.key === key) return
    let live = true
    setState({ key })
    load().then((items) => live && setState({ key, items })).catch((e) => live && setState({ key, items: [], error: (e as Error).message }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key])
  return state
}

const Row: React.FC<{ title: string; hint?: string; thumb?: React.ReactNode; onClick: () => void; extra?: React.ReactNode; disabled?: boolean }> = ({ title, hint, thumb, onClick, extra, disabled }) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5 transition hover:border-gray-300 hover:shadow-sm">
    <button type="button" disabled={disabled} onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60">
      {thumb && <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">{thumb}</span>}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
        {hint && <span className="block truncate text-xs text-gray-500">{hint}</span>}
      </span>
    </button>
    {extra}
  </div>
)

export const SystemPicker: React.FC<{ api: ExcalidrawImperativeAPI; open: boolean; onOpenChange: (v: boolean) => void }> = ({ api, open, onOpenChange }) => {
  const team = useCrm((s) => s.team)
  const [tab, setTab] = useState<Tab>('criativos')
  const [busy, setBusy] = useState<string | null>(null)

  const embed = (ref: SystemRef) => { insertSystemEmbed(api, ref); onOpenChange(false) }
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn(); onOpenChange(false) } catch (e) { toast.error((e as Error).message || 'Não consegui pôr no quadro.') } finally { setBusy(null) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="gap-3">
        <DialogHeader>
          <DialogTitle>Pôr no quadro</DialogTitle>
          <DialogDescription>Itens desta conta. Páginas, sites, formulários, funis e dashboards aparecem como estão hoje, ao vivo; criativos e arquivos entram como imagem, com o link para abrir.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm', tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-[320px]">
          {!team ? <Loading /> : (
            <>
              {tab === 'criativos' && <CreativesTab teamId={team.id} isHome={!!team.isHome} busy={busy} run={run} api={api} />}
              {tab === 'arquivos' && <FilesTab team={team} busy={busy} run={run} api={api} />}
              {tab === 'paginas' && <PagesTab team={team} embed={embed} />}
              {tab === 'sites' && <SitesTab teamId={team.id} embed={embed} />}
              {tab === 'formularios' && <FormsTab teamId={team.id} embed={embed} />}
              {tab === 'funis' && <FunnelsTab teamId={team.id} embed={embed} />}
              {tab === 'dashboards' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {DASHBOARDS.map((d) => <Row key={d.path} title={d.name} hint={d.hint} thumb={<BarChart3 className="h-5 w-5 text-gray-500" />} onClick={() => embed({ kind: 'dashboard', name: d.name, path: d.path })} />)}
                </div>
              )}
              {tab === 'link' && <LinkTab embed={embed} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Run = (key: string, fn: () => Promise<void>) => Promise<void>

const MAX_POSTS = 12
async function creativeRows(set: CreativeSet, posts: Post[]) {
  const rows = []
  for (const post of posts.slice(0, MAX_POSTS)) rows.push({ title: post.name, blobs: await renderCreative(set, post) })
  return rows
}

const CreativesTab: React.FC<{ teamId: string; isHome: boolean; busy: string | null; run: Run; api: ExcalidrawImperativeAPI }> = ({ teamId, isHome, busy, run, api }) => {
  const list = useList<SetSummary>(true, teamId, () => accountSets(teamId, isHome))
  const { sets, urls } = useCovers(list.items ?? null)
  const [picked, setPicked] = useState<SetSummary | null>(null)
  const [full, setFull] = useState<CreativeSet | null>(null)
  const [postUrls, setPostUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!picked) { setFull(null); return }
    let live = true
    loadSet(picked.id, picked.shared ? picked.projectId : undefined).then((s) => live && setFull(s ?? null)).catch(() => live && setFull(null))
    const paths = (picked.postsInfo ?? []).flatMap((p) => (p.cover ? [p.cover] : []))
    if (paths.length) void coverUrls(paths).then((u) => live && setPostUrls(u))
    return () => { live = false }
  }, [picked])

  if (list.items === undefined) return <Loading />
  if (list.error) return <Empty>{list.error}</Empty>
  if (!sets?.length) return <Empty>Esta conta ainda não tem criativos.</Empty>

  if (picked) {
    const link = `/criativos/${picked.id}`
    const coverOf = (postId: string) => { const c = picked.postsInfo?.find((p) => p.id === postId)?.cover; return c ? postUrls[c] : undefined }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /> Criativos</button>
          <span className="truncate text-sm font-semibold">{picked.name}</span>
          {full && full.posts.length > 1 && (
            <button type="button" disabled={!!busy} className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
              onClick={() => run('todos', async () => insertImages(api, await creativeRows(full, full.posts), { frame: `Criativo · ${full.name}`, link }))}>
              {busy === 'todos' ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pôr todos (${Math.min(full.posts.length, MAX_POSTS)})`}
            </button>
          )}
        </div>
        {!full ? <Loading /> : !full.posts.length ? <Empty>Este conjunto não tem posts.</Empty> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {full.posts.map((post) => (
              <button key={post.id} type="button" disabled={!!busy} className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left hover:border-gray-300 disabled:opacity-60"
                onClick={() => run(post.id, async () => insertImages(api, await creativeRows(full, [post]), { frame: `Criativo · ${full.name} · ${post.name}`, link }))}>
                <span className="relative flex aspect-[4/5] items-center justify-center bg-gray-100">
                  {coverOf(post.id) ? <img src={coverOf(post.id)} alt="" className="h-full w-full object-cover" /> : <Palette className="h-6 w-6 text-gray-300" />}
                  {busy === post.id && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                </span>
                <span className="block truncate px-2 py-1.5 text-xs font-medium">{post.name}</span>
                <span className="block px-2 pb-2 text-[11px] text-gray-500">{post.slides.length} {post.slides.length === 1 ? 'slide' : 'slides'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {sets.map((s) => {
        const cover = s.postsInfo?.[0]?.cover
        return (
          <button key={s.id} type="button" onClick={() => setPicked(s)} className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left hover:border-gray-300">
            <span className="flex aspect-[4/5] items-center justify-center bg-gray-100">
              {cover && urls[cover] ? <img src={urls[cover]} alt="" className="h-full w-full object-cover" /> : <Palette className="h-6 w-6 text-gray-300" />}
            </span>
            <span className="block truncate px-2 pt-1.5 text-xs font-medium">{s.name}</span>
            <span className="block px-2 pb-2 text-[11px] text-gray-500">{s.posts} {s.posts === 1 ? 'post' : 'posts'}</span>
          </button>
        )
      })}
    </div>
  )
}

const FilesTab: React.FC<{ team: { id: string; name: string; isHome?: boolean }; busy: string | null; run: Run; api: ExcalidrawImperativeAPI }> = ({ team, busy, run, api }) => {
  const { files, logos, loadingFiles, error } = useInsumos()
  useEffect(() => { void refreshAccount(team as Parameters<typeof refreshAccount>[0]) }, [team])
  const items = useMemo(() => [
    ...logos.map((l) => ({ key: l.key, url: l.src, name: l.name })),
    ...(files ?? []).map((f) => ({ key: f.path, url: f.url!, name: f.path.split('/').pop() ?? f.path })),
  ].filter((i) => i.url), [files, logos])
  const put = (i: { key: string; url: string }) => run(i.key, async () => {
    const res = await fetch(i.url)
    if (!res.ok) throw new Error(`Arquivo indisponível (${res.status})`)
    await insertImages(api, [{ blobs: [await res.blob()] }], { rowHeight: 360 })
  })
  if (!items.length && loadingFiles) return <Loading />
  if (!items.length) return <Empty>{error ?? 'Nenhum logo ou imagem no Cérebro desta conta.'}</Empty>
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {items.map((i) => (
        <button key={i.key} type="button" disabled={!!busy} onClick={() => void put(i)} className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left hover:border-gray-300 disabled:opacity-60" title={i.name}>
          <span className="relative flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
            <img src={i.url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
            {busy === i.key && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
          </span>
          <span className="block truncate px-2 py-1.5 text-[11px] text-gray-600">{i.name}</span>
        </button>
      ))}
    </div>
  )
}

const PagesTab: React.FC<{ team: { id: string; isHome?: boolean }; embed: (r: SystemRef) => void }> = ({ team, embed }) => {
  const list = useList<Project>(true, team.id, () => listProjects({ id: team.id, isHome: !!team.isHome }))
  if (list.items === undefined) return <Loading />
  const items = list.items.filter((p) => !p.archivedAt)
  if (!items.length) return <Empty>{list.error ?? 'Nenhum projeto (página de cliente) nesta conta.'}</Empty>
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((p) => (
        <Row key={p.id} title={p.name} hint={`${p.summary?.pages ?? 1} página(s) · ${p.summary?.sections ?? 0} seções`}
          thumb={p.summary?.logo ? <img src={p.summary.logo} alt="" className="max-h-9 max-w-9 object-contain" /> : <span className="flex h-full w-full">{(p.summary?.colors ?? []).slice(0, 3).map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</span>}
          onClick={() => embed({ kind: 'pagina', name: p.name, path: `/projetos/${p.id}` })} />
      ))}
    </div>
  )
}

const SitesTab: React.FC<{ teamId: string; embed: (r: SystemRef) => void }> = ({ teamId, embed }) => {
  const { connected, state } = useSitesLink()
  const sites = (state?.sites ?? []).filter((s) => !s.accountId || s.accountId === teamId)
  if (!connected && !sites.length) return <Empty>Os sites em código vêm do conector deste computador. Abra o conector para listar os sites.</Empty>
  if (!sites.length) return <Empty>Nenhum site em código nesta conta.</Empty>
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sites.map((s) => (
        <Row key={s.id} title={s.name} hint={s.url ?? s.framework} thumb={<Globe className="h-5 w-5 text-gray-500" />}
          onClick={() => embed({ kind: 'site', name: s.name, path: `/sites/${s.id}` })}
          extra={s.url ? <button type="button" className="shrink-0 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => embed({ kind: 'site', name: `${s.name} (no ar)`, path: s.url! })}>No ar</button> : undefined} />
      ))}
    </div>
  )
}

const FormsTab: React.FC<{ teamId: string; embed: (r: SystemRef) => void }> = ({ teamId, embed }) => {
  const list = useList<CrmForm>(true, teamId, () => listForms(teamId))
  if (list.items === undefined) return <Loading />
  if (!list.items.length) return <Empty>{list.error ?? 'Nenhum formulário nesta conta.'}</Empty>
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.items.map((f) => {
        const published = f.status === 'published'
        const editor: SystemRef = { kind: 'formulario', name: `${f.name} (editor)`, path: `/crm/formularios/${f.id}` }
        return (
          <Row key={f.id} title={f.name} hint={`${f.kind === 'quiz' ? 'Quiz' : 'Formulário'} · ${published ? 'publicado: abre como o cliente vê' : 'rascunho: abre o editor'}`}
            thumb={<FileText className="h-5 w-5 text-gray-500" />}
            onClick={() => embed(published ? { kind: 'formulario', name: f.name, path: `/crm/formularios/${f.id}`, publicPath: `/f/${f.slug || f.id}` } : editor)}
            extra={published ? <button type="button" className="shrink-0 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => embed(editor)}>Editor</button> : undefined} />
        )
      })}
    </div>
  )
}

const FunnelsTab: React.FC<{ teamId: string; embed: (r: SystemRef) => void }> = ({ teamId, embed }) => {
  const list = useList<Funnel>(true, teamId, async () => [pipelineFunnel(teamId), ...(await listFunnels(teamId))])
  if (list.items === undefined) return <Loading />
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.items.map((f) => (
        <Row key={f.id} title={f.name} hint={`${f.steps.length} etapas${f.objective ? ` · ${f.objective}` : ''}`} thumb={<Filter className="h-5 w-5 text-gray-500" />}
          onClick={() => embed({ kind: 'funil', name: f.name, path: `/crm/funis/${f.id}` })} />
      ))}
    </div>
  )
}

const LinkTab: React.FC<{ embed: (r: SystemRef) => void }> = ({ embed }) => {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    let u: URL
    try { u = new URL(url.trim(), window.location.origin) } catch { toast.error('Esse link não é válido.'); return }
    if (!/^https?:$/.test(u.protocol)) { toast.error('Use um link http(s).'); return }
    const inApp = u.origin === window.location.origin || /^\//.test(url.trim())
    embed({ kind: 'link', name: name.trim() || (inApp ? u.pathname : u.host), path: inApp ? `${u.pathname}${u.search}` : u.toString() })
  }
  return (
    <form onSubmit={submit} className="space-y-3 py-2">
      <p className="text-sm text-gray-600">Cole uma tela do app (ex.: o endereço de uma página de vendas, de um conteúdo ou de um relatório) ou um site de fora. Sites de fora que bloqueiam ser mostrados em outra página aparecem em branco: abra pelo botão "Abrir".</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… ou /crm/site" className="h-10 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-violet-400 sm:text-sm" autoFocus />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" className="h-10 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-violet-400 sm:text-sm" />
      <button type="submit" disabled={!url.trim()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Pôr no quadro</button>
    </form>
  )
}
