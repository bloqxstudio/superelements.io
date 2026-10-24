import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, FileText, FolderOpen, MessageSquare, Redo2, Send, Sparkles, Undo2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { AgentPanel, type Pending } from './AgentPanel'
import { CommentsPanel, type Composer } from './Comments'
import { elapsed, useSeconds } from '@/features/operations/JobFeed'
import { useRunningFor } from '@/features/operations/jobs'
import { DocEditor } from './DocEditor'
import { FolderPanel } from './FolderPanel'
import { formatById } from './knowledge'
import { joinDocLive, useCopyLive } from './live'
import { useCopyChat } from './runner'
import { SendDialog } from './SendDialog'
import { BriefPanel, SourcesPanel } from './SidePanels'
import { shareDoc } from './storage'
import { useCopy } from './store'

/** A tela do documento: o texto no meio, o painel do agente, dos comentários e do briefing ao lado, e quem está junto no topo. */

type Tab = 'pasta' | 'agente' | 'comentarios' | 'briefing' | 'fontes'

/** Logo após o clique: quem está trabalhando neste documento, há quanto tempo e o passo de agora. */
const RunBanner: React.FC<{ docId: string }> = ({ docId }) => {
  const job = useRunningFor(docId)
  const now = useSeconds(!!job)
  if (!job) return null
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-30 flex items-center gap-2.5 border-b px-4 py-2 text-sm backdrop-blur" style={{ background: `${job.color ?? '#7c3aed'}14` }}>
      <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: job.color }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: job.color }} /></span>
      <span className="font-semibold text-gray-900">{job.agent}</span>
      <span className="min-w-0 flex-1 truncate text-gray-600">{job.kind === 'Pesquisa' ? 'pesquisando' : 'escrevendo'} · {job.step}</span>
      <span className="tabular-nums text-xs text-gray-500">{elapsed(job.startedAt, now)}</span>
      <span className="hidden text-xs text-gray-500 sm:inline">Pode sair desta tela: ele continua.</span>
    </div>
  )
}

export const CopyEditorPage: React.FC = () => {
  const { docId = '' } = useParams()
  const projectParam = useSearchParams()[0].get('projeto') ?? undefined
  const autoRun = useSearchParams()[0].get('rodar')
  const [search, setSearch] = useSearchParams()
  const autoSend = search.get('enviar')
  const navigate = useNavigate()
  const status = useCopy((s) => s.status)
  const doc = useCopy((s) => s.doc)
  const saving = useCopy((s) => s.saving)
  const canUndo = useCopy((s) => s.past.length > 0)
  const canRedo = useCopy((s) => s.future.length > 0)
  const people = useCopyLive((s) => s.people)
  const live = useCopyLive((s) => s.live)
  useProjectList()
  const projects = useProjectStore((s) => s.projects)

  const [tab, setTab] = useState<Tab>('agente')
  const [composer, setComposer] = useState<Composer | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [send, setSend] = useState(false)
  const [sharing, setSharing] = useState<{ projectId: string; busy: boolean } | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    ran.current = false
    void useCopy.getState().open(docId, projectParam)
    return () => useCopy.getState().close()
  }, [docId, projectParam])

  // Documento compartilhado: entra no canal ao vivo do projeto
  const sharedId = doc?.shared ? doc.id : undefined
  useEffect(() => {
    if (status !== 'ready' || !sharedId) return
    const current = useCopy.getState().doc
    return current ? joinDocLive(current) : undefined
  }, [status, sharedId, doc?.projectId])

  // Uma pesquisa nova já começa a rodar
  useEffect(() => {
    if (status === 'ready' && doc && autoRun && !ran.current) {
      ran.current = true
      useCopyChat.getState().ensure(doc.id)
      setPending({ message: autoRun === 'pesquisa' ? 'Faça a pesquisa completa sobre o assunto do briefing: dores, desejos, objeções, clientes, jornada, campanhas e posts de referência e ângulos de conteúdo.' : autoRun, blockIds: [], nonce: Date.now() })
      setTab('agente')
    }
  }, [status, doc, autoRun])

  // Vindo da pasta com "Enviar": abre o envio
  useEffect(() => {
    if (status === 'ready' && autoSend) setSend(true)
  }, [status, autoSend])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault()
        if (e.shiftKey) useCopy.getState().redo()
        else useCopy.getState().undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => useCopy.getState().saving !== 'saved' && e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const savingLabel = useMemo(() => ({ saved: 'Salvo', dirty: 'Alterações…', saving: 'Salvando…', error: 'Erro ao salvar' })[saving], [saving])
  const openComments = useMemo(() => (doc?.comments ?? []).filter((c) => !c.resolved).length, [doc?.comments])

  if (status === 'loading') return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500">Abrindo o documento…</div>
  if (status !== 'ready' || !doc)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-sm text-gray-600">
        <p>{status === 'missing' ? 'Este documento não está na sua conta.' : 'Não consegui abrir o documento.'}</p>
        <Link to="/copy" className="mt-3 inline-block font-medium text-gray-900 underline">Voltar à Copy</Link>
      </div>
    )

  const format = formatById(doc.format)
  const share = async () => {
    if (!sharing) return
    const project = projects.find((p) => p.id === sharing.projectId)
    if (!project) return
    setSharing({ ...sharing, busy: true })
    try {
      await useCopy.getState().flush()
      const moved = await shareDoc(useCopy.getState().doc!, project.id, project.name)
      toast.success(`Compartilhado com a equipe de ${project.name}.`)
      navigate(`/copy/${moved.id}?projeto=${project.id}`, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui compartilhar o documento.')
      setSharing({ ...sharing, busy: false })
    }
  }

  const tabs: [Tab, string, React.ComponentType<{ className?: string }>, number?][] = [
    ...(doc.folderId ? ([['pasta', 'Pasta', FolderOpen]] as [Tab, string, React.ComponentType<{ className?: string }>, number?][]) : []),
    ['agente', 'Agente', Sparkles],
    ['comentarios', 'Comentários', MessageSquare, openComments],
    ['briefing', 'Briefing', FileText],
    ...(format.id === 'pesquisa' || (doc.sources?.length ?? 0) > 0 ? ([['fontes', 'Fontes', FileText, doc.sources?.length]] as [Tab, string, React.ComponentType<{ className?: string }>, number?][]) : []),
  ]

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[560px] flex-col md:h-screen">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link to="/copy" aria-label="Voltar à Copy" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
        <input aria-label="Título do documento" value={doc.title} onChange={(e) => useCopy.getState().edit((d) => ({ ...d, title: e.target.value }))} placeholder="Documento sem título" className="h-8 w-64 rounded-md border border-transparent px-2 text-sm font-semibold text-gray-900 hover:border-gray-200 focus-visible:border-gray-300 focus-visible:outline-none" />
        <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 sm:inline">{format.label}</span>
        <span className="text-xs text-gray-500">{savingLabel}</span>
        {doc.shared ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700" title={live ? 'Ao vivo com a equipe do projeto' : 'Conectando ao canal ao vivo…'}>
              <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-amber-400')} /> {doc.projectName ?? 'Equipe'}
            </span>
            <div className="flex -space-x-1.5">
              {people.map((p) => (
                <span key={p.userId} title={`${p.name} está neste documento`} className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white" style={{ background: p.color }}>{p.name.charAt(0)}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => setSharing(sharing ? null : { projectId: doc.projectId ?? projects[0]?.id ?? '', busy: false })} disabled={!projects.length}><Users className="h-4 w-4" /> Compartilhar</Button>
            {sharing && (
              <div className="absolute left-0 top-10 z-40 w-72 space-y-2 rounded-xl border bg-white p-3 shadow-xl">
                <p className="text-xs text-gray-600">A equipe do projeto abre e edita este documento junto, ao vivo: cada um vê onde o outro está escrevendo, os comentários e os agentes trabalhando.</p>
                <select value={sharing.projectId} onChange={(e) => setSharing({ ...sharing, projectId: e.target.value })} className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <div className="flex justify-end gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => setSharing(null)} disabled={sharing.busy}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={() => void share()} disabled={sharing.busy || !sharing.projectId}>{sharing.busy ? 'Compartilhando…' : 'Compartilhar'}</Button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={() => useCopy.getState().undo()}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Refazer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => useCopy.getState().redo()}><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setSend(true)}><Send className="h-4 w-4" /> Enviar para…</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto bg-white" data-scroll>
          <RunBanner docId={doc.id} />
          <DocEditor
            onComment={(blockId, quote) => {
              setComposer({ blockId, quote })
              setTab('comentarios')
            }}
            onAsk={(message, blockIds) => {
              setTab('agente')
              setPending({ message, blockIds, nonce: Date.now() })
            }}
          />
        </main>

        <aside className="hidden w-[380px] shrink-0 flex-col border-l bg-white lg:flex">
          <div className="flex h-10 shrink-0 border-b" role="tablist">
            {tabs.map(([id, label, Icon, count]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('flex flex-1 items-center justify-center gap-1.5 border-b-2 text-xs font-semibold', tab === id ? 'border-violet-600 text-violet-800' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                <Icon className="h-3.5 w-3.5" /> {label}
                {!!count && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">{count}</span>}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === 'pasta' && <FolderPanel />}
            {tab === 'agente' && <AgentPanel pending={pending} />}
            {tab === 'comentarios' && <CommentsPanel composer={composer} onClose={() => setComposer(null)} />}
            {tab === 'briefing' && <BriefPanel />}
            {tab === 'fontes' && <SourcesPanel />}
          </div>
        </aside>
      </div>
      <SendDialog open={send} onClose={() => {
          setSend(false)
          if (autoSend) {
            const next = new URLSearchParams(search)
            next.delete('enviar')
            setSearch(next, { replace: true })
          }
        }} initial={autoSend === 'pasta' ? 'pasta' : undefined} />
    </div>
  )
}
