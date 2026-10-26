import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, ChevronLeft, ChevronRight, CircleAlert, ExternalLink, Loader2, Pencil, Play, RefreshCw, Send, Settings2, Sparkles, Square, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { slidePreview } from '@/features/criativos/ai'
import { useCreativeLink } from '@/features/criativos/link'
import { listSets, loadSet } from '@/features/criativos/storage'
import type { CreativeSet, SetSummary } from '@/features/criativos/types'
import { profileNow } from '@/features/ia/perfis'
import { useIa } from '@/features/ia/porTarefa'
import { describeFreq, nextRunAfter, useRoutines } from '@/features/ia/rotinas'
import { listProjects } from '@/features/projects/storage'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import { CHAT_AGENTS } from '@/features/space/chat/protocol'
import { cn } from '@/lib/utils'
import { compact, creativeImages, percent, type IgAccount } from './instagram'
import { nameOf, useTeamPeople } from './people'
import {
  approveStory,
  discardStory,
  nowSlot,
  publishNow,
  rescheduleStory,
  runRedo,
  runWeek,
  stopWeek,
  unapproveStory,
  useStoryRun,
} from './storyPipeline'
import {
  NoStoryTablesError,
  STATUS_LABEL,
  WEEKDAYS_SHORT,
  addWeeks,
  defaultSettings,
  listStories,
  loadStorySettings,
  sameSlot,
  saveStorySettings,
  storyNumbers,
  updateStory,
  useStoryFeed,
  weekLabel,
  weekSlots,
  weekStart,
  type Story,
  type StorySettings,
  type StoryStatus,
} from './stories'
import type { StoryPillar } from './storyPlan'
import { FIELD, Surface, plural, whenLabel } from './ui'

/**
 * Instagram › Stories: a semana de stories da equipe. A esteira dos agentes
 * (Estrategista, Editor, Designer, Ilustradora, com o Codex) monta os
 * horários livres; a equipe vê cada sequência, aprova, muda o horário ou
 * pede para refazer; o servidor publica na hora, mesmo com este computador
 * desligado, e lê os números antes de a Meta apagar o story.
 */

const STATUS_TONE: Record<StoryStatus, string> = {
  ideia: 'bg-gray-100 text-gray-700',
  criativo: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
  agendado: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/20',
  publicando: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-600/20',
  publicado: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  falhou: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-600/20',
  descartado: 'bg-gray-50 text-gray-400',
}

const hhmm = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const localInput = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
const editorHref = (s: Story) => `/criativos/${s.setId}?${s.setProjectId ? `projeto=${s.setProjectId}&` : ''}post=${s.postId}`

const StatusChip: React.FC<{ status: StoryStatus; className?: string }> = ({ status, className }) => (
  <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium', STATUS_TONE[status], className)}>{STATUS_LABEL[status]}</span>
)

// ---------- as miniaturas (do conjunto de criativos, com o mesmo desenho da exportação) ----------

type Previews = Record<string, string[]>

/** As telas de cada story em JPEG pequeno, lidas do conjunto como está agora. */
function useStoryPreviews(stories: Story[], side: number) {
  const [previews, setPreviews] = useState<Previews>({})
  const [sets, setSets] = useState<Record<string, CreativeSet | null>>({})
  const key = stories.map((s) => `${s.id}:${s.postId ?? ''}:${s.updatedAt}`).join('|')
  useEffect(() => {
    let alive = true
    const withPost = stories.filter((s) => s.setId && s.postId)
    if (!withPost.length) return
    const bySet = new Map<string, Story[]>()
    for (const s of withPost) bySet.set(`${s.setProjectId ?? ''}/${s.setId}`, [...(bySet.get(`${s.setProjectId ?? ''}/${s.setId}`) ?? []), s])
    void (async () => {
      const next: Previews = {}
      const loaded: Record<string, CreativeSet | null> = {}
      for (const [where, list] of bySet) {
        const set = await loadSet(list[0].setId!, list[0].setProjectId).catch(() => undefined)
        loaded[where] = set ?? null
        if (!set) continue
        const posts = list.map((s) => set.posts.find((p) => p.id === s.postId)).filter((p): p is NonNullable<typeof p> => !!p)
        const images = await creativeImages(set, posts.flatMap((p) => p.slides)).catch(() => undefined)
        if (!images) continue
        for (const s of list) {
          const post = set.posts.find((p) => p.id === s.postId)
          if (post) next[s.id] = post.slides.map((slide) => slidePreview(slide, post.format, images, side))
        }
      }
      if (!alive) return
      setPreviews(next)
      setSets(loaded)
    })()
    return () => {
      alive = false
    }
    // `key` resume a lista: só relê quando um story muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, side])
  return { previews, sets }
}

// ---------- a IA conectada ----------

const AiStrip: React.FC = () => {
  const connected = useCreativeLink((s) => s.connected)
  const stale = useCreativeLink((s) => s.stale)
  const agents = useCreativeLink((s) => s.agents)
  const { ia, pick } = useIa('stories')
  const [open, setOpen] = useState(false)
  const available = agents.filter((a) => a.available)
  if (!connected || stale) {
    if (import.meta.hot) return <p className="text-xs text-gray-500">{stale ? 'O servidor de dev não conhece a esteira: reinicie o npm run dev.' : 'A IA do servidor de dev não respondeu.'}</p>
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span>{stale ? 'O conector está desatualizado: baixe de novo.' : 'Conecte o Codex deste computador para montar a semana.'}</span>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}>
          Conectar
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm gap-0 p-0">
            <DialogTitle className="sr-only">Conectar meus agentes</DialogTitle>
            <ConnectorPrompt />
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  if (!available.length) return <p className="text-xs text-gray-500">Nenhuma IA neste computador. Instale o Codex (ou o Claude Code).</p>
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHAT_AGENTS[ia].color }} aria-hidden />
      {available.length > 1 ? (
        <select value={ia} onChange={(e) => pick(e.target.value as typeof ia)} aria-label="IA que monta os stories" className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900">
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {CHAT_AGENTS[a.id].name}
            </option>
          ))}
        </select>
      ) : (
        <span className="font-medium text-gray-900">{CHAT_AGENTS[ia].name}</span>
      )}
      <span>conectado</span>
    </div>
  )
}

// ---------- ajustes ----------

interface SetChoice {
  id: string
  projectId?: string
  label: string
  shared: boolean
}

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]

const SettingsPanel: React.FC<{ settings: StorySettings; accounts: IgAccount[]; onSaved: (s: StorySettings) => void; onClose: () => void }> = ({ settings, accounts, onSaved, onClose }) => {
  const [draft, setDraft] = useState<StorySettings>(settings)
  const [sets, setSets] = useState<SetChoice[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTime, setNewTime] = useState('18:00')
  const routines = useRoutines((s) => s.routines)
  const addRoutine = useRoutines((s) => s.add)
  const updateRoutine = useRoutines((s) => s.update)
  const routine = routines.find((r) => r.task === 'stories')

  useEffect(() => {
    void (async () => {
      try {
        const projects = await listProjects()
        const names = new Map(projects.map((p) => [p.id, p.name]))
        const list: SetSummary[] = await listSets(projects.map((p) => p.id))
        setSets(list.map((s) => ({ id: s.id, projectId: s.shared ? s.projectId : undefined, shared: !!s.shared, label: s.shared ? `${s.name} · ${names.get(s.projectId ?? '') ?? s.projectName ?? 'projeto'}` : `${s.name} · só seu` })))
      } catch {
        setSets([])
      }
    })()
  }, [])

  const set = <K extends keyof StorySettings>(key: K, value: StorySettings[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setKey = draft.setId ? `${draft.setProjectId ?? ''}/${draft.setId}` : ''
  const chosen = sets?.find((s) => `${s.projectId ?? ''}/${s.id}` === setKey)
  const pillar = (i: number, patch: Partial<StoryPillar>) => set('pillars', draft.pillars.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const save = async () => {
    setSaving(true)
    try {
      await saveStorySettings(draft)
      onSaved({ ...draft, fresh: false })
      toast.success('Ajustes dos stories salvos')
      onClose()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Surface title="Ajustes dos stories" action={<button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-900">Fechar</button>}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <label className="block text-xs font-medium text-gray-700">
            Conta que publica
            <select className={cn(FIELD, 'mt-1 h-9')} value={draft.accountId ?? ''} onChange={(e) => set('accountId', e.target.value || undefined)}>
              <option value="">Escolha a conta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Conjunto de criativos que recebe as sequências
            <select
              className={cn(FIELD, 'mt-1 h-9')}
              value={setKey}
              disabled={!sets}
              onChange={(e) => {
                const found = sets?.find((s) => `${s.projectId ?? ''}/${s.id}` === e.target.value)
                setDraft((d) => ({ ...d, setId: found?.id, setProjectId: found?.projectId }))
              }}
            >
              <option value="">{sets ? 'Escolha o conjunto' : 'Lendo os conjuntos…'}</option>
              {sets?.map((s) => (
                <option key={`${s.projectId ?? ''}/${s.id}`} value={`${s.projectId ?? ''}/${s.id}`}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              {chosen && !chosen.shared
                ? 'Este conjunto é só seu: quem mais aprovar não consegue abrir as telas. Compartilhe-o com o projeto da Avence no Criativos.'
                : 'Use um conjunto com a marca da Avence, compartilhado com um projeto, para toda a equipe abrir e aprovar. '}
              <Link to="/criativos" className="underline underline-offset-2">
                Abrir o Criativos
              </Link>
            </span>
          </label>
          <div>
            <p className="text-xs font-medium text-gray-700">Dias</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAYS_ORDER.map((d) => {
                const on = draft.days.includes(d)
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => set('days', on ? draft.days.filter((x) => x !== d) : [...draft.days, d])} className={cn('h-8 rounded-full px-3 text-xs font-medium', on ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')}>
                    {WEEKDAYS_SHORT[d]}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700">Horários (um story por horário)</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {draft.times.map((t) => (
                <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-white pl-3 pr-1 text-xs text-gray-900 ring-1 ring-inset ring-gray-200">
                  {t}
                  <button type="button" onClick={() => set('times', draft.times.filter((x) => x !== t))} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900" aria-label={`Tirar ${t}`}>
                    ×
                  </button>
                </span>
              ))}
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className={cn(FIELD, 'h-8 w-28 text-xs')} aria-label="Novo horário" />
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => newTime && !draft.times.includes(newTime) && set('times', [...draft.times, newTime].sort())}>
                Pôr
              </Button>
            </div>
          </div>
          <label className="block text-xs font-medium text-gray-700">
            Telas por story, no máximo
            <input type="number" min={1} max={10} className={cn(FIELD, 'mt-1 h-9 w-24')} value={draft.framesMax} onChange={(e) => set('framesMax', Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <div className="grid gap-2 text-xs text-gray-700">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5" checked={draft.photos} onChange={(e) => set('photos', e.target.checked)} />
              <span>
                Fotos geradas pelo Codex nas telas (a {profileNow('lia').name} gera; a que não sair vira uma tela sem foto)
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5" checked={draft.web} onChange={(e) => set('web', e.target.checked)} />
              <span>A {profileNow('nina').name} pode pesquisar na web o que está em alta para o público</span>
            </label>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-xs text-gray-700">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!routine?.enabled}
                onChange={(e) => {
                  if (routine) updateRoutine(routine.id, { enabled: e.target.checked })
                  else if (e.target.checked) addRoutine({ name: 'Stories da semana', task: 'stories', params: {}, freq: 'semanal', every: 24, time: '10:00', weekday: 5, enabled: true })
                }}
              />
              <span>
                Montar sozinho toda semana {routine ? `(${describeFreq(routine)})` : '(sexta às 10:00)'}: a esteira completa esta semana e monta a próxima, e fica tudo para aprovar.
              </span>
            </label>
            {routine && (
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                <select className={cn(FIELD, 'h-8 w-auto text-xs')} value={routine.weekday} onChange={(e) => updateRoutine(routine.id, { weekday: Number(e.target.value), freq: 'semanal' })} aria-label="Dia da rotina">
                  {DAYS_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {WEEKDAYS_SHORT[d]}
                    </option>
                  ))}
                </select>
                <input type="time" className={cn(FIELD, 'h-8 w-28 text-xs')} value={routine.time} onChange={(e) => updateRoutine(routine.id, { time: e.target.value, freq: 'semanal' })} aria-label="Hora da rotina" />
                <span className="text-gray-500">Próxima: {routine.enabled ? whenLabel(routine.nextRun || nextRunAfter(routine)) : 'desligada'}</span>
              </div>
            )}
            <p className="mt-2 pl-6 text-[11px] text-gray-500">A rotina roda neste navegador, com o app aberto e o Codex conectado. A publicação não depende disso: é o servidor que publica.</p>
          </div>
        </div>
        <div className="grid content-start gap-4">
          <label className="block text-xs font-medium text-gray-700">
            Recado do mês (o que a equipe quer dizer agora)
            <textarea className={cn(FIELD, 'mt-1 resize-y py-2')} rows={4} value={draft.brief} onChange={(e) => set('brief', e.target.value)} placeholder="Ex.: mostrar a prévia do site novo; falar com donos de clínica que anunciam no Google." />
          </label>
          <div>
            <p className="text-xs font-medium text-gray-700">Pilares (a {profileNow('nina').name} varia entre eles)</p>
            <div className="mt-1 grid gap-2">
              {draft.pillars.map((p, i) => (
                <div key={i} className="grid gap-1 rounded-lg bg-white p-2 ring-1 ring-inset ring-gray-200">
                  <div className="flex items-center gap-2">
                    <input className={cn(FIELD, 'h-8 text-xs font-medium')} value={p.label} onChange={(e) => pillar(i, { label: e.target.value })} aria-label="Nome do pilar" />
                    <button type="button" onClick={() => set('pillars', draft.pillars.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Tirar o pilar ${p.label}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea className={cn(FIELD, 'resize-y py-1.5 text-xs')} rows={2} value={p.hint} onChange={(e) => pillar(i, { hint: e.target.value })} aria-label="O que entra no pilar" />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => set('pillars', [...draft.pillars, { id: `p${Date.now().toString(36)}`, label: 'Novo pilar', hint: '' }])}>
                Pôr um pilar
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <Button onClick={() => void save()} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar ajustes
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Surface>
  )
}

// ---------- um story aberto ----------

const StoryPanel: React.FC<{
  story: Story
  previews: string[] | undefined
  settings: StorySettings
  approver?: string
  onClose: () => void
  onChanged: (s: Story) => void
}> = ({ story, previews, settings, approver, onClose, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [redo, setRedo] = useState(false)
  const redoing = useStoryRun((s) => s.redoing === story.id)
  const numbers = storyNumbers(story)
  const idea = story.idea
  const out = story.frames.some((f) => f.mediaId)
  const pillar = settings.pillars.find((p) => p.id === story.pillar)?.label ?? story.pillar

  const act = async (label: string, job: () => Promise<Story>, done: string) => {
    setBusy(label)
    try {
      const next = await job()
      onChanged(next)
      toast.success(done)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={story.status} />
            <span className="text-xs text-gray-500">
              {whenLabel(story.publishAt)} · {pillar}
            </span>
          </div>
          <DialogTitle className="text-lg">{story.title}</DialogTitle>
          {idea.hook && <DialogDescription>Gancho: “{idea.hook}”</DialogDescription>}
        </DialogHeader>

        {story.review?.ok === false && story.review.note && (
          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">{profileNow('teo').name}, o editor: </span>
              {story.review.note}
            </p>
          </div>
        )}
        {story.error && story.status !== 'publicado' && (
          <div className="flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/20">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{story.error}</p>
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pb-2">
          {previews?.length
            ? previews.map((src, i) => (
                <figure key={i} className="w-[170px] shrink-0">
                  <img src={src} alt={`Tela ${i + 1}`} className="aspect-[9/16] w-full rounded-lg object-cover ring-1 ring-gray-200" />
                  <figcaption className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Tela {i + 1}</span>
                    {story.frames[i]?.permalink && (
                      <a href={story.frames[i].permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-gray-900">
                        no ar <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </figcaption>
                  {story.frames[i]?.insights && (
                    <p className="text-[11px] tabular-nums text-gray-600">
                      {compact(story.frames[i].insights?.reach)} alcance · {story.frames[i].insights?.replies ?? 0} resp.
                    </p>
                  )}
                </figure>
              ))
            : (idea.frames ?? []).map((f, i) => (
                <div key={i} className="flex aspect-[9/16] w-[170px] shrink-0 flex-col justify-between rounded-lg bg-zinc-50 p-3 text-xs text-gray-700 ring-1 ring-inset ring-gray-200">
                  <span className="text-[11px] text-gray-400">Tela {i + 1}</span>
                  <p className="font-medium text-gray-900">{f.text}</p>
                  <span className="text-[11px] text-gray-500">{f.visual}</span>
                </div>
              ))}
        </div>

        {numbers && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">Alcance da 1ª tela</p>
              <p className="text-base font-semibold text-gray-900">{compact(numbers.reach)}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">Chegaram ao fim</p>
              <p className="text-base font-semibold text-gray-900">{percent(numbers.kept, 0)}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">Respostas</p>
              <p className="text-base font-semibold text-gray-900">{numbers.replies}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">Saíram no meio</p>
              <p className="text-base font-semibold text-gray-900">{numbers.exits}</p>
            </div>
          </div>
        )}

        <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
          {idea.angle && (
            <p>
              <span className="text-xs font-medium text-gray-500">Ângulo · </span>
              {idea.angle}
            </p>
          )}
          {idea.objective && (
            <p>
              <span className="text-xs font-medium text-gray-500">Objetivo · </span>
              {idea.objective}
            </p>
          )}
          {idea.cta && (
            <p>
              <span className="text-xs font-medium text-gray-500">Convite · </span>
              {idea.cta}
            </p>
          )}
          {idea.why && (
            <p>
              <span className="text-xs font-medium text-gray-500">Por que agora · </span>
              {idea.why}
            </p>
          )}
        </div>

        {story.approvedAt && (
          <p className="text-xs text-gray-500">
            Aprovado {approver ? `por ${approver} ` : ''}em {whenLabel(story.approvedAt)}
            {story.publishedAt ? ` · no ar em ${whenLabel(story.publishedAt)}` : ''}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          {(story.status === 'criativo' || (story.status === 'falhou' && !story.frames.length)) && (
            <Button onClick={() => void act('aprovar', () => approveStory(story, settings.accountId), 'Aprovado e agendado')} disabled={!!busy || !story.postId} className="gap-1.5">
              {busy === 'aprovar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar e agendar
            </Button>
          )}
          {(story.status === 'agendado' || (story.status === 'falhou' && story.frames.length > 0)) && (
            <Button onClick={() => void act('agora', () => publishNow(story), 'Sai no próximo minuto')} disabled={!!busy} className="gap-1.5">
              {busy === 'agora' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {story.status === 'falhou' ? 'Tentar de novo agora' : 'Publicar agora'}
            </Button>
          )}
          {(story.status === 'agendado' || story.status === 'falhou') && story.frames.length > 0 && !out && (
            <Button variant="outline" onClick={() => void act('desaprovar', () => unapproveStory(story), 'Voltou para aprovação')} disabled={!!busy} className="gap-1.5">
              <Undo2 className="h-4 w-4" /> Desaprovar
            </Button>
          )}
          {story.postId && story.status !== 'publicado' && story.status !== 'publicando' && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link to={editorHref(story)}>
                <Pencil className="h-4 w-4" /> Editar no Criativos
              </Link>
            </Button>
          )}
          {(story.status === 'ideia' || story.status === 'criativo' || (story.status === 'falhou' && !story.frames.length)) && (
            <Button variant="outline" onClick={() => (story.status === 'ideia' ? void runRedo(story, '') : setRedo((v) => !v))} disabled={redoing} className="gap-1.5">
              {redoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {story.status === 'ideia' ? 'Montar as telas' : 'Refazer'}
            </Button>
          )}
          {story.status === 'descartado' && story.postId && (
            <Button variant="outline" onClick={() => void act('voltar', () => updateStory(story.id, { status: 'criativo' }), 'Voltou para aprovação')} disabled={!!busy}>
              Voltar para aprovação
            </Button>
          )}
          {story.status !== 'publicado' && story.status !== 'publicando' && story.status !== 'descartado' && !out && (
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
              <CalendarClock className="h-4 w-4" />
              <input
                type="datetime-local"
                className={cn(FIELD, 'h-8 w-auto text-xs')}
                defaultValue={localInput(story.publishAt)}
                onBlur={(e) => {
                  const at = Date.parse(e.target.value)
                  if (Number.isFinite(at) && !sameSlot(at, story.publishAt)) void act('hora', () => rescheduleStory(story, at), `Novo horário: ${whenLabel(at)}`)
                }}
                aria-label="Horário do story"
              />
            </label>
          )}
          {story.status !== 'publicado' && story.status !== 'publicando' && story.status !== 'descartado' && !out && (
            <Button variant="ghost" onClick={() => void act('descartar', () => discardStory(story), 'Descartado')} disabled={!!busy} className="gap-1.5 text-gray-500 hover:text-rose-700">
              <Trash2 className="h-4 w-4" /> Descartar
            </Button>
          )}
        </div>

        {redo && (
          <div className="grid gap-2 rounded-lg bg-zinc-50 p-3">
            <label className="text-xs font-medium text-gray-700">
              O que mudar (a {profileNow('dani').name} refaz as telas com o mesmo roteiro e o seu pedido)
              <textarea className={cn(FIELD, 'mt-1 resize-y py-2')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: menos texto na segunda tela; mostrar o case no celular." />
            </label>
            <Button
              size="sm"
              className="justify-self-start gap-1.5"
              disabled={redoing}
              onClick={() => {
                setRedo(false)
                void runRedo(story, note)
              }}
            >
              <Sparkles className="h-4 w-4" /> Refazer as telas
            </Button>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-gray-500">
          Aprovar gera as imagens das telas como estão agora no Criativos. O servidor publica na hora marcada, uma tela depois da outra, mesmo com este computador desligado. A API do Instagram não aceita figurinhas (enquete, perguntas, link): a última tela convida a responder o story.
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ---------- a semana ----------

const StoryCard: React.FC<{ story: Story; previews?: string[]; onOpen: () => void }> = ({ story, previews, onOpen }) => {
  const numbers = storyNumbers(story)
  const redoing = useStoryRun((s) => s.redoing === story.id)
  return (
    <button type="button" onClick={onOpen} className={cn('grid w-full gap-2 rounded-lg bg-white p-2 text-left ring-1 ring-inset ring-gray-200 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', story.status === 'descartado' && 'opacity-60')}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold tabular-nums text-gray-900">{hhmm(story.publishAt)}</span>
        {redoing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : <StatusChip status={story.status} />}
      </div>
      {previews?.length ? (
        <div className="flex gap-1 overflow-hidden">
          {previews.slice(0, 4).map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-[9/16] w-[calc(25%-3px)] rounded object-cover ring-1 ring-gray-200" />
          ))}
        </div>
      ) : (
        <div className="flex aspect-[9/8] items-center justify-center rounded bg-zinc-50 px-2 text-center text-[11px] text-gray-500">{story.idea.hook || 'Ideia'}</div>
      )}
      <p className="line-clamp-2 text-xs font-medium text-gray-900">{story.title}</p>
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
        <span>{plural(story.idea.frames?.length ?? story.frames.length, 'tela', 'telas')}</span>
        {story.review?.ok === false && (
          <span className="inline-flex items-center gap-0.5 text-amber-700">
            <CircleAlert className="h-3 w-3" /> nota do editor
          </span>
        )}
        {story.error && story.status !== 'publicado' && <span className="text-rose-700">com erro</span>}
        {numbers?.reach !== undefined && <span className="tabular-nums">{compact(numbers.reach)} alcance</span>}
      </div>
    </button>
  )
}

export const StoriesArea: React.FC<{ teamId: string; accounts: IgAccount[] }> = ({ teamId, accounts }) => {
  const [week, setWeek] = useState(() => weekStart())
  const [settings, setSettings] = useState<StorySettings | null>(null)
  const [stories, setStories] = useState<Story[] | null>(null)
  const [error, setError] = useState<'sem-tabelas' | string | null>(null)
  const [editing, setEditing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [showDiscarded, setShowDiscarded] = useState(false)
  const running = useStoryRun((s) => s.running)
  const last = useStoryRun((s) => s.last)
  const people = useTeamPeople(teamId)

  const reload = useCallback(async () => {
    try {
      const list = await listStories(teamId, week, addWeeks(week, 1))
      setStories(list)
      setError(null)
    } catch (e) {
      setError(e instanceof NoStoryTablesError ? 'sem-tabelas' : errorText(e))
      setStories([])
    }
  }, [teamId, week])

  useEffect(() => {
    setStories(null)
    void reload()
  }, [reload])

  useEffect(() => {
    void loadStorySettings(teamId).then(
      (s) => {
        // Uma conta só: já vem escolhida
        const ready = !s.accountId && accounts.length === 1 ? { ...s, accountId: accounts[0].id } : s
        setSettings(ready)
        if (!ready.setId) setEditing(true)
      },
      (e) => {
        if (e instanceof NoStoryTablesError) setError('sem-tabelas')
        setSettings(defaultSettings(teamId))
      }
    )
  }, [teamId, accounts])

  useStoryFeed(teamId, () => void reload())
  // A esteira que terminou (aqui ou na rotina) mostra o que fez
  useEffect(() => {
    if (!running) void reload()
  }, [running, reload])

  const visible = useMemo(() => (stories ?? []).filter((s) => showDiscarded || s.status !== 'descartado'), [stories, showDiscarded])
  const { previews } = useStoryPreviews(visible, 180)
  const open = stories?.find((s) => s.id === openId)
  const toApprove = visible.filter((s) => s.status === 'criativo')
  const flagged = toApprove.filter((s) => s.review?.ok === false)
  const slots = settings ? weekSlots(settings, week) : []
  const thisWeek = weekStart()
  // A semana ainda tem horário para montar (a partir de 30 minutos daqui)
  const future = slots.some((at) => at > Date.now() + 30 * 60_000)

  /** Um story só, para daqui a uns 20 minutos: a tela vai para a semana dele e mostra a esteira trabalhando. */
  const storyNow = () => {
    const at = nowSlot()
    setWeek(weekStart(at))
    void runWeek(teamId, weekStart(at), false, at)
  }

  const approveWeek = async () => {
    if (!settings) return
    setApproving(true)
    let ok = 0
    try {
      for (const s of toApprove.filter((x) => x.review?.ok !== false)) {
        try {
          await approveStory(s, settings.accountId)
          ok++
        } catch (e) {
          toast.error(`${s.title}: ${errorText(e)}`)
        }
      }
      toast.success(`${plural(ok, 'story aprovado', 'stories aprovados')}${flagged.length ? ` · ${plural(flagged.length, 'tem', 'têm')} nota do editor e ficou para você ver` : ''}`)
      await reload()
    } finally {
      setApproving(false)
    }
  }

  if (error === 'sem-tabelas')
    return (
      <Surface className="mx-auto max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">Falta preparar o banco</h2>
        <p className="mt-1 text-sm text-gray-600">
          Aplique a migração <code className="text-xs">supabase/migrations/20261026090000_crm_stories.sql</code> no Supabase. Para publicar na hora marcada, ligue também pg_cron e pg_net, guarde no Vault <code className="text-xs">stories_function_url</code> e{' '}
          <code className="text-xs">stories_cron_secret</code>, o mesmo segredo em <code className="text-xs">STORIES_CRON_SECRET</code> e publique a função <code className="text-xs">instagram</code> com <code className="text-xs">--no-verify-jwt</code>.
        </p>
      </Surface>
    )

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Stories programados</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            A {profileNow('nina').name} faz a pauta, o {profileNow('teo').name} revisa, a {profileNow('dani').name} monta e a {profileNow('lia').name} gera as fotos. Você aprova; o servidor publica na hora.
          </p>
        </div>
        <AiStrip />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200">
          <button type="button" onClick={() => setWeek(addWeeks(week, -1))} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100" aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[132px] px-1 text-center text-xs font-medium tabular-nums text-gray-900">{weekLabel(week)}</span>
          <button type="button" onClick={() => setWeek(addWeeks(week, 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100" aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {week !== thisWeek && (
          <button type="button" onClick={() => setWeek(thisWeek)} className="text-xs text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">
            Esta semana
          </button>
        )}
        {settings && !future && !running && (
          <button type="button" onClick={() => setWeek(addWeeks(week, 1))} className="text-xs text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">
            Os horários desta semana já passaram: ver a próxima →
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Ajustes
          </Button>
          {toApprove.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => void approveWeek()} disabled={approving || !!running} className="gap-1.5">
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar a semana ({toApprove.length - flagged.length})
            </Button>
          )}
          {running ? (
            <Button size="sm" variant="outline" onClick={stopWeek} className="gap-1.5">
              <Square className="h-3.5 w-3.5" /> Parar
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={storyNow} disabled={!settings?.setId} className="gap-1.5" title="Uma sequência para daqui a uns 20 minutos, com a esteira inteira; depois de aprovar, Publicar agora leva no próximo minuto">
                <Sparkles className="h-4 w-4" /> Um story agora
              </Button>
              <Button size="sm" onClick={() => void runWeek(teamId, week)} disabled={!settings?.setId || !future} title={future ? undefined : 'Os horários desta semana já passaram'} className="gap-1.5">
                <Play className="h-4 w-4" /> Montar a semana
              </Button>
            </>
          )}
        </div>
      </div>

      {running && (
        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 ring-1 ring-inset ring-violet-600/20">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <p className="min-w-0 flex-1">
            {running.step}
            {running.week !== week ? ` (semana de ${weekLabel(running.week)})` : ''}. Cada etapa grava o que fez: dá para sair desta tela.{' '}
            <Link to="/agentes" className="font-medium underline underline-offset-2">
              Ver no Escritório
            </Link>
          </p>
        </div>
      )}
      {!running && last && last.week === week && Date.now() - last.at < 10 * 60_000 && (
        <p className={cn('text-xs', last.error ? 'text-rose-700' : 'text-gray-600')}>{last.message}</p>
      )}

      {editing && settings && (
        <SettingsPanel
          settings={settings}
          accounts={accounts}
          onSaved={(s) => {
            setSettings(s)
            void reload()
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {stories === null || !settings ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo a pauta…
        </p>
      ) : error ? (
        <Surface>
          <p className="text-sm text-rose-700">{error}</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(week)
            day.setDate(day.getDate() + i)
            const from = day.getTime()
            const next = new Date(day)
            next.setDate(next.getDate() + 1)
            const mine = visible.filter((s) => s.publishAt >= from && s.publishAt < next.getTime())
            const free = slots.filter((at) => at >= from && at < next.getTime() && !mine.some((s) => sameSlot(s.publishAt, at)))
            const today = new Date().toDateString() === day.toDateString()
            return (
              <div key={i} className={cn('grid content-start gap-2 rounded-xl bg-zinc-100/70 p-2', today && 'ring-2 ring-inset ring-gray-900/10')}>
                <p className={cn('px-1 text-xs font-semibold', today ? 'text-gray-900' : 'text-gray-600')}>
                  {WEEKDAYS_SHORT[day.getDay()]} {day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
                {mine.map((s) => (
                  <StoryCard key={s.id} story={s} previews={previews[s.id]} onOpen={() => setOpenId(s.id)} />
                ))}
                {free.map((at) => (
                  <div key={at} className="rounded-lg border border-dashed border-gray-300 px-2 py-3 text-center text-[11px] text-gray-400">
                    {hhmm(at)} · livre
                  </div>
                ))}
                {!mine.length && !free.length && <p className="px-1 py-2 text-[11px] text-gray-400">Sem stories</p>}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <span>
          {plural(visible.filter((s) => s.status === 'agendado').length, 'agendado', 'agendados')} · {plural(visible.filter((s) => s.status === 'publicado').length, 'no ar', 'no ar')} · {plural(toApprove.length, 'para aprovar', 'para aprovar')}
        </span>
        <span>A API do Instagram não publica figurinhas (enquete, perguntas, link): a última tela convida a responder o story.</span>
        <label className="ml-auto flex items-center gap-1.5">
          <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} /> Mostrar descartados
        </label>
      </div>

      {open && settings && (
        <StoryPanel
          key={open.id + open.updatedAt}
          story={open}
          previews={previews[open.id]}
          settings={settings}
          approver={open.approvedBy ? nameOf(people, open.approvedBy) ?? 'alguém da equipe' : undefined}
          onClose={() => setOpenId(null)}
          onChanged={(next) => setStories((list) => (list ?? []).map((s) => (s.id === next.id ? next : s)))}
        />
      )}
    </div>
  )
}
