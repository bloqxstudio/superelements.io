import { useEffect } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { useCreativeLink } from '@/features/criativos/link'
import { executeTask, taskById, type TaskId } from './tarefas'

/**
 * Rotinas: tarefas dos agentes que se repetem sozinhas (rever o funil, fazer
 * pesquisas, criar postagens). Rodam neste navegador, enquanto o app está
 * aberto e o conector (ou o servidor de dev) está ligado; se o computador
 * estava fechado na hora, a rotina atrasada roda uma vez quando o app abre.
 */

export type Freq = 'horas' | 'diaria' | 'semanal'

export interface Routine {
  id: string
  name: string
  task: TaskId
  params: Record<string, string>
  freq: Freq
  /** A cada quantas horas (freq = horas). */
  every: number
  /** HH:MM (diária e semanal). */
  time: string
  /** 0 = domingo (semanal). */
  weekday: number
  enabled: boolean
  nextRun: number
  lastRun?: number
  lastStatus?: 'ok' | 'erro'
  lastMessage?: string
  /** Cartões já trabalhados (não repete). */
  done: string[]
}

const KEY = 'agentes-rotinas'

const read = (): Routine[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? (v as Routine[]).filter((r) => r?.id && r.task) : []
  } catch {
    return []
  }
}

const write = (list: Routine[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // vale até recarregar
  }
}

/** A próxima vez que a rotina deve rodar depois de `from`. */
export function nextRunAfter(r: Pick<Routine, 'freq' | 'every' | 'time' | 'weekday'>, from = Date.now()): number {
  if (r.freq === 'horas') return from + Math.max(1, r.every || 1) * 3_600_000
  const [h, m] = (r.time || '08:00').split(':').map((n) => Number(n) || 0)
  const d = new Date(from)
  d.setHours(h, m, 0, 0)
  if (r.freq === 'diaria') {
    if (d.getTime() <= from) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  let add = (r.weekday - d.getDay() + 7) % 7
  if (add === 0 && d.getTime() <= from) add = 7
  d.setDate(d.getDate() + add)
  return d.getTime()
}

export const describeFreq = (r: Pick<Routine, 'freq' | 'every' | 'time' | 'weekday'>) =>
  r.freq === 'horas' ? `A cada ${r.every} h` : r.freq === 'diaria' ? `Todo dia às ${r.time}` : `${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][r.weekday]} às ${r.time}`

interface State {
  routines: Routine[]
  running: string | null
  add: (r: Omit<Routine, 'id' | 'nextRun' | 'done'>) => void
  update: (id: string, patch: Partial<Routine>) => void
  remove: (id: string) => void
  reload: () => void
}

export const useRoutines = create<State>()((set, get) => {
  const commit = (routines: Routine[]) => {
    write(routines)
    set({ routines })
  }
  return {
    routines: read(),
    running: null,
    add: (r) => commit([...get().routines, { ...r, id: crypto.randomUUID(), done: [], nextRun: nextRunAfter(r) }]),
    update: (id, patch) =>
      commit(
        get().routines.map((r) => {
          if (r.id !== id) return r
          const next = { ...r, ...patch }
          // Mudou quando roda: recalcula
          return 'freq' in patch || 'every' in patch || 'time' in patch || 'weekday' in patch || patch.enabled === true ? { ...next, nextRun: nextRunAfter(next) } : next
        })
      ),
    remove: (id) => commit(get().routines.filter((r) => r.id !== id)),
    reload: () => set({ routines: read() }),
  }
})

const LOCK = 'agentes-rotinas-rodando'
/** Duas abas abertas não rodam a mesma rotina: quem começa primeiro marca. */
const claim = (id: string) => {
  try {
    const cur = JSON.parse(localStorage.getItem(LOCK) ?? 'null') as { id: string; at: number } | null
    if (cur && cur.id === id && Date.now() - cur.at < 20 * 60_000) return false
    localStorage.setItem(LOCK, JSON.stringify({ id, at: Date.now() }))
  } catch {
    // sem armazenamento: segue
  }
  return true
}

export async function runRoutine(id: string, manual = false) {
  const store = useRoutines.getState()
  if (store.running) return toast.info('Já há uma rotina rodando.')
  store.reload()
  const routine = useRoutines.getState().routines.find((r) => r.id === id)
  if (!routine) return
  if (!manual && (!routine.enabled || routine.nextRun > Date.now())) return
  if (!manual && !claim(id)) return
  const link = useCreativeLink.getState()
  if (!link.connected || link.stale) {
    if (manual) toast.error('A IA não está conectada. Abra o app local ou o conector.')
    return
  }
  useRoutines.setState({ running: id })
  const controller = new AbortController()
  let lastStatus: Routine['lastStatus'] = 'ok'
  let lastMessage = ''
  let done = routine.done
  try {
    const result = await executeTask(routine.task, { params: routine.params, done: routine.done, signal: controller.signal })
    lastMessage = result.message
    if (result.done) done = [...routine.done, ...result.done].slice(-400)
    if (manual) toast.success(`${routine.name}: pronto`)
  } catch (e) {
    lastStatus = 'erro'
    lastMessage = e instanceof Error ? e.message : 'Não terminou.'
    toast.error(`${routine.name}: ${lastMessage}`.slice(0, 160))
  } finally {
    useRoutines.setState({ running: null })
    const now = Date.now()
    const current = useRoutines.getState().routines.find((r) => r.id === id)
    if (current) useRoutines.getState().update(id, { lastRun: now, lastStatus, lastMessage: lastMessage.slice(0, 900), done, nextRun: nextRunAfter(current, now) })
  }
}

/** Confere a cada meio minuto se alguma rotina venceu. Uma só no app inteiro (no modo embutido não roda). */
export function useRoutineScheduler(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      const { routines, running } = useRoutines.getState()
      if (running) return
      const due = routines.filter((r) => r.enabled && r.nextRun <= Date.now()).sort((a, b) => a.nextRun - b.nextRun)[0]
      if (due) void runRoutine(due.id)
    }
    const onStorage = (e: StorageEvent) => e.key === KEY && useRoutines.getState().reload()
    window.addEventListener('storage', onStorage)
    const first = window.setTimeout(tick, 8000)
    const timer = window.setInterval(tick, 30_000)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [enabled])
}

export { taskById }
