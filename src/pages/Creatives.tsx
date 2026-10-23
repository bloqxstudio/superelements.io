import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Images, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { parseDesignMd } from '@/features/space/brand/designMd'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { loadProjectDoc } from '@/features/projects/storage'
import { setBrandFrom } from '@/features/criativos/brand'
import { deleteSet, listSets, saveSet } from '@/features/criativos/storage'
import { IMPORTED_NAME, importedSet } from '@/features/criativos/imported'
import { POST_MODELS, buildPost } from '@/features/criativos/templates'
import { generatePosts, type AiForm } from '@/features/criativos/ai'
import { useAiAvailable } from '@/features/criativos/link'
import { AiFields, EMPTY_AI } from '@/features/criativos/AiFields'
import { uid, type CreativeSet, type SetBrand, type SetSummary } from '@/features/criativos/types'

/**
 * Criativos: os conjuntos de posts de Instagram. Cada conjunto nasce na marca
 * de um projeto (cores, fontes e logo do DESIGN.md) e já vem com os modelos
 * de post escolhidos; daí se edita no editor e se baixa em PNG ou JPG.
 */

/** O endereço do conjunto: os compartilhados dizem de que projeto são. */
export const setLink = (s: Pick<SetSummary, 'id' | 'projectId' | 'shared'>) => `/criativos/${s.id}${s.shared && s.projectId ? `?projeto=${s.projectId}` : ''}`

const when = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

const NewSet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate()
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [models, setModels] = useState<string[]>(['carrossel-5'])
  const [busy, setBusy] = useState(false)
  const [share, setShare] = useState(true)
  const [mode, setMode] = useState<'models' | 'ai'>('models')
  const ai = useAiAvailable()
  const [form, setForm] = useState<AiForm>(EMPTY_AI)

  const project = projects.find((p) => p.id === projectId)

  const create = async () => {
    setBusy(true)
    try {
      let brand: SetBrand = setBrandFrom(null, name || 'Marca')
      if (project) {
        const cloud = await loadProjectDoc(project.id)
        const source = cloud?.doc?.brand?.source
        const parsed = source?.trim() ? parseDesignMd(source).brand : null
        brand = setBrandFrom(parsed, project.name)
        if (!parsed) toast.message('Este projeto ainda não tem um DESIGN.md. Usei cores e fontes neutras.')
      }
      const now = Date.now()
      const set: CreativeSet = {
        id: uid(),
        name: name.trim() || (project ? `${project.name} · criativos` : 'Novo conjunto'),
        projectId: project?.id,
        projectName: project?.name,
        shared: !!project && share,
        brand,
        posts: mode === 'ai' ? await generatePosts(form, brand) : POST_MODELS.filter((m) => models.includes(m.id)).map((m) => buildPost(m, brand)),
        assets: [],
        createdAt: now,
        updatedAt: now,
      }
      await saveSet(set)
      navigate(setLink(set))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Não consegui criar o conjunto.')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo conjunto de criativos</DialogTitle>
          <DialogDescription>Escolha o projeto de quem são os posts e os modelos para começar. Você muda tudo no editor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Projeto (marca)</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
              <option value="">Sem projeto (cores neutras)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {project && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-1" checked={share} onChange={(e) => setShare(e.target.checked)} />
              <span>Compartilhar com a equipe do projeto<span className="block text-xs text-gray-500">Quem está no projeto abre e edita junto, ao vivo, e vê o mouse e o agente de cada um.</span></span>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Nome do conjunto</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={project ? `${project.name} · criativos` : 'Novo conjunto'} className="h-9 w-full rounded-md border border-gray-200 px-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium">
            <button type="button" onClick={() => setMode('models')} className={cn('h-8 rounded-md', mode === 'models' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>Modelos prontos</button>
            <button type="button" disabled={ai === false} title={ai === false ? 'A IA roda no app local (servidor de desenvolvimento com o Claude Code).' : undefined} onClick={() => setMode('ai')} className={cn('h-8 rounded-md disabled:opacity-40', mode === 'ai' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>Gerar com IA</button>
          </div>
          {mode === 'ai' ? <AiFields form={form} onChange={setForm} disabled={busy} /> : (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-800">Modelos de post</legend>
            <div className="grid gap-1.5">
              {POST_MODELS.map((m) => {
                const on = models.includes(m.id)
                return (
                  <label key={m.id} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2', on ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}>
                    <input type="checkbox" className="mt-1" checked={on} onChange={() => setModels(on ? models.filter((x) => x !== m.id) : [...models, m.id])} />
                    <span className="text-sm">
                      <span className="block font-medium text-gray-900">{m.name} <span className="font-normal text-gray-500">· {m.format.replace('x', ':')}</span></span>
                      <span className="block text-xs text-gray-500">{m.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void create()} disabled={busy || (mode === 'ai' && !form.brief.trim())}>{busy ? (mode === 'ai' ? 'A IA está montando…' : 'Criando…') : 'Criar conjunto'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Creatives: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const [error, setError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const navigate = useNavigate()
  useProjectList()
  const projectIds = useProjectStore((s) => s.projects).map((p) => p.id).join(',')

  const load = () =>
    listSets(projectIds ? projectIds.split(',') : [])
      .then((s) => {
        setSets(s)
        setError(false)
      })
      .catch((err) => {
        console.error(err)
        setError(true)
      })

  useEffect(() => void load(), [projectIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const bringReady = async () => {
    const existing = sets?.find((x) => x.name === IMPORTED_NAME)
    if (existing && !window.confirm('Os criativos prontos já estão na sua conta. Trazer uma segunda cópia?')) return navigate(setLink(existing))
    setImporting(true)
    try {
      const set = importedSet()
      await saveSet(set)
      navigate(`/criativos/${set.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Não consegui trazer os criativos.')
      setImporting(false)
    }
  }

  const remove = async (set: SetSummary) => {
    if (!window.confirm(`Excluir "${set.name}" e as imagens enviadas para ele?`)) return
    try {
      await deleteSet(set)
      setSets((list) => list?.filter((s) => s.id !== set.id) ?? null)
    } catch {
      toast.error('Não consegui excluir.')
    }
  }

  return (
    <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Criativos</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Posts de Instagram na marca de cada projeto. Edite como no Canva e baixe em PNG ou JPG no tamanho do feed, do quadrado e do story.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5 bg-white" disabled={importing} onClick={() => void bringReady()}><Images className="h-4 w-4" /> {importing ? 'Trazendo…' : 'Trazer criativos prontos'}</Button>
            <Button className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Novo conjunto</Button>
          </div>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Não consegui ler os conjuntos da conta. <button className="underline" onClick={() => void load()}>Tentar de novo</button></p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets === null && !error && [0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />)}
          {sets?.map((s) => (
            <div key={s.id} className="group relative rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_6px_16px_-6px_rgb(0_0_0/0.14)]">
              <Link to={setLink(s)} className="block rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex gap-1">
                  {s.colors.length ? s.colors.map((c) => <span key={c} className="h-5 w-5 rounded-md ring-1 ring-black/10" style={{ background: c }} />) : <span className="h-5 text-xs text-gray-400">Sem marca</span>}
                </div>
                <p className="mt-4 truncate text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{s.projectName ? `${s.projectName}${s.shared ? ' (equipe)' : ''} · ` : ''}{s.posts} {s.posts === 1 ? 'post' : 'posts'} · {when(s.updatedAt)}</p>
              </Link>
              <button type="button" aria-label={`Excluir ${s.name}`} onClick={() => void remove(s)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 hover:bg-gray-100 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {sets?.length === 0 && (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]"><Images className="h-5 w-5" /></span>
            <h3 className="mt-4 text-sm font-semibold text-gray-900">Nenhum conjunto ainda</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">Crie um a partir de um projeto: ele já vem com as cores, as fontes e o logo da marca e com os modelos de post.</p>
            <Button className="mt-5 gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Criar conjunto</Button>
          </div>
        )}
      </div>
      <NewSet open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export default Creatives
