import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Microscope, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { FORMATS, NICHES, formatById, nicheById, type FormatGroup, type FormatSpec } from '@/features/copy/knowledge'
import { escapeHtml } from '@/features/copy/html'
import { deleteDoc, listDocs, saveDoc } from '@/features/copy/storage'
import { block, EMPTY_BRIEF, uid, type CopyDoc, type CopySummary, type FormatId } from '@/features/copy/types'

/**
 * Copy: os documentos de texto da empresa. Posts, landing pages, sites,
 * campanhas, stories, e-mails, artigos e pesquisas, escritos com os agentes e a
 * equipe, e enviados depois para um post de Criativos ou uma página de Projetos.
 */

const when = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const GROUPS: FormatGroup[] = ['Redes sociais', 'Site e páginas', 'Campanhas', 'Mensagens', 'Conteúdo longo', 'Pesquisa', 'Livre']

export const setLink = (d: Pick<CopySummary, 'id' | 'projectId' | 'shared'>) => `/copy/${d.id}${d.shared && d.projectId ? `?projeto=${d.projectId}` : ''}`

const NewDoc: React.FC<{ open: boolean; research: boolean; onClose: () => void }> = ({ open, research, onClose }) => {
  const navigate = useNavigate()
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const [format, setFormat] = useState<FormatId>('post-instagram')
  const [niche, setNiche] = useState('')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [projectId, setProjectId] = useState('')
  const [share, setShare] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setFormat(research ? 'pesquisa' : 'post-instagram')
  }, [open, research])

  const spec = formatById(format)
  const project = projects.find((p) => p.id === projectId)

  const create = async () => {
    setBusy(true)
    try {
      const now = Date.now()
      const label = nicheById(niche)?.label
      const doc: CopyDoc = {
        id: uid(),
        title: title.trim() || (format === 'pesquisa' && topic.trim() ? `Pesquisa · ${topic.trim().slice(0, 60)}` : `${spec.label}${label ? ` · ${label}` : ''}`),
        format,
        niche: niche || undefined,
        projectId: project?.id,
        projectName: project?.name,
        shared: !!project && share,
        brief: { ...EMPTY_BRIEF, ...(format === 'pesquisa' ? { objective: 'Mapear dores, desejos, objeções, clientes, jornada, campanhas e posts de referência para criar conteúdo', notes: topic.trim() } : {}) },
        blocks: spec.skeleton.map((b) => block(b.type, escapeHtml(b.text ?? ''), b.label)),
        comments: [],
        createdAt: now,
        updatedAt: now,
      }
      await saveDoc(doc)
      navigate(`${setLink(doc)}${format === 'pesquisa' && topic.trim() ? `${doc.shared ? '&' : '?'}rodar=pesquisa` : ''}`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Não consegui criar o documento.')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{research ? 'Nova pesquisa' : 'Novo documento'}</DialogTitle>
          <DialogDescription>{research ? 'Dê um assunto e o Pesquisador mapeia dores, clientes, jornada e referências na web.' : 'Escolha o formato: ele já vem com a estrutura certa, e os agentes escrevem em cima dela.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!research && (
            <div className="space-y-3">
              {GROUPS.filter((g) => g !== 'Pesquisa').map((g) => (
                <fieldset key={g}>
                  <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g}</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {FORMATS.filter((f: FormatSpec) => f.group === g).map((f) => (
                      <button key={f.id} type="button" onClick={() => setFormat(f.id)} className={cn('rounded-lg border px-3 py-2 text-left', format === f.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}>
                        <span className="block text-sm font-medium text-gray-900">{f.label}{f.sendTo && <span className="ml-1.5 text-[10px] font-normal text-gray-400">→ {f.sendTo === 'criativos' ? 'Criativos' : 'Projetos'}</span>}</span>
                        <span className="block text-xs text-gray-500">{f.hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
          {research && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">Assunto da pesquisa</span>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="Ex.: como donos de escritório de arquitetura escolhem quem faz o site, e o que os concorrentes publicam sobre isso" className="w-full resize-none rounded-md border border-gray-200 px-2.5 py-2 text-sm" autoFocus />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">Nicho</span>
              <select value={niche} onChange={(e) => setNiche(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                <option value="">Sem nicho</option>
                {NICHES.map((n) => (<option key={n.id} value={n.id}>{n.label}</option>))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">Projeto (opcional)</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                <option value="">Só meu</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
          </div>
          {project && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-1" checked={share} onChange={(e) => setShare(e.target.checked)} />
              <span>Compartilhar com a equipe do projeto<span className="block text-xs text-gray-500">Quem está no projeto edita junto, ao vivo, e vê onde cada um escreve, os comentários e os agentes.</span></span>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Título (opcional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${spec.label}${nicheById(niche) ? ` · ${nicheById(niche)!.label}` : ''}`} className="h-9 w-full rounded-md border border-gray-200 px-2 text-sm" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void create()} disabled={busy || (research && !topic.trim())}>{busy ? 'Criando…' : research ? 'Pesquisar' : 'Criar documento'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Copy: React.FC = () => {
  const [docs, setDocs] = useState<CopySummary[] | null>(null)
  const [error, setError] = useState(false)
  const [creating, setCreating] = useState<null | 'doc' | 'research'>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<FormatGroup | 'Todos'>('Todos')
  useProjectList()
  const projectIds = useProjectStore((s) => s.projects).map((p) => p.id).join(',')

  const load = () =>
    listDocs(projectIds ? projectIds.split(',') : [])
      .then((d) => {
        setDocs(d)
        setError(false)
      })
      .catch((err) => {
        console.error(err)
        setError(true)
      })

  useEffect(() => void load(), [projectIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (docs ?? []).filter((d) => (group === 'Todos' || formatById(d.format).group === group) && (!q || `${d.title} ${nicheById(d.niche)?.label ?? ''} ${d.projectName ?? ''}`.toLowerCase().includes(q)))
  }, [docs, query, group])

  const remove = async (d: CopySummary) => {
    if (!window.confirm(`Excluir "${d.title}"?`)) return
    try {
      await deleteDoc(d)
      setDocs((list) => list?.filter((x) => x.id !== d.id) ?? null)
    } catch {
      toast.error('Não consegui excluir.')
    }
  }

  return (
    <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Copy</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">O documento de texto da empresa: posts, landing pages, sites, campanhas, stories, e-mails e pesquisas. Os agentes escrevem e revisam com você acompanhando, a equipe edita e comenta ao vivo, e o texto segue para Criativos ou Projetos.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5 bg-white" onClick={() => setCreating('research')}><Microscope className="h-4 w-4" /> Nova pesquisa</Button>
            <Button className="gap-1.5" onClick={() => setCreating('doc')}><Plus className="h-4 w-4" /> Novo documento</Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="h-9 w-56 rounded-md border border-gray-200 bg-white pl-8 pr-2 text-sm" />
          </div>
          {(['Todos', ...GROUPS] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)} className={cn('rounded-full px-3 py-1 text-xs font-medium', group === g ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50')}>{g}</button>
          ))}
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Não consegui ler os documentos da conta. <button className="underline" onClick={() => void load()}>Tentar de novo</button></p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs === null && !error && [0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />)}
          {shown.map((d) => {
            const f = formatById(d.format)
            return (
              <div key={d.id} className="group relative rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_6px_16px_-6px_rgb(0_0_0/0.14)]">
                <Link to={setLink(d)} className="block rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">{f.id === 'pesquisa' ? <Microscope className="h-3 w-3" /> : <FileText className="h-3 w-3" />}{f.label}</span>
                  <p className="mt-3 truncate text-sm font-semibold text-gray-900">{d.title || 'Documento sem título'}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{[nicheById(d.niche)?.label, d.projectName && `${d.projectName}${d.shared ? ' (equipe)' : ''}`, `${d.words} palavras`, when(d.updatedAt)].filter(Boolean).join(' · ')}</p>
                </Link>
                <button type="button" aria-label={`Excluir ${d.title}`} onClick={() => void remove(d)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 hover:bg-gray-100 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>

        {docs?.length === 0 && (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]"><FileText className="h-5 w-5" /></span>
            <h3 className="mt-4 text-sm font-semibold text-gray-900">Nenhum documento ainda</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">Comece por uma pesquisa de um assunto ou por um formato (post, landing page, campanha…) e deixe o agente escrever a primeira versão.</p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="gap-1.5 bg-white" onClick={() => setCreating('research')}><Microscope className="h-4 w-4" /> Nova pesquisa</Button>
              <Button className="gap-1.5" onClick={() => setCreating('doc')}><Plus className="h-4 w-4" /> Novo documento</Button>
            </div>
          </div>
        )}
      </div>
      <NewDoc open={!!creating} research={creating === 'research'} onClose={() => setCreating(null)} />
    </div>
  )
}

export default Copy
