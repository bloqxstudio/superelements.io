import { toast } from 'sonner'
import { create } from 'zustand'
import { openPreview } from './Preview'

/**
 * O trabalho assíncrono da empresa: cada pedido a um agente (pesquisa, escrita,
 * posts de criativos…) vira um job aqui. O job vive no módulo, não na tela:
 * sair do documento não para o agente, e a tela Agentes vê tudo o que está
 * rodando, por área. Só guarda o andamento; o resultado é gravado pelo próprio
 * trabalho (documento, conjunto de criativos…).
 */

export type Area = 'criativos' | 'copy' | 'landing' | 'sites'

export const AREAS: Record<Area, { label: string; hint: string }> = {
  criativos: { label: 'Criativos', hint: 'Posts, carrosséis e stories' },
  copy: { label: 'Copy', hint: 'Pesquisas e textos' },
  landing: { label: 'Landing pages', hint: 'Copy e páginas de captação' },
  sites: { label: 'Sites', hint: 'Projetos e páginas no Space' },
}

export interface Job {
  id: string
  area: Area
  /** O tipo do trabalho: "Pesquisa", "Escrita", "Edição"… */
  kind: string
  /** Sobre o quê: o título do documento, o pedido. */
  label: string
  /** Quem trabalha: "Pesquisador · Claude Code". */
  agent: string
  color?: string
  step: string
  status: 'running' | 'done' | 'error'
  startedAt: number
  endedAt?: number
  error?: string
  /** Para abrir o que está sendo feito. */
  href?: string
  docId?: string
  /** Sem aviso ao terminar (o resultado de verdade é anunciado por quem grava a entrega). */
  silent?: boolean
  /** O que o agente foi fazendo, do mais antigo ao mais novo. */
  log?: { at: number; text: string }[]
}

interface State {
  jobs: Job[]
}

const KEEP = 60

const STORE = 'agentes-entregas'

/** As entregas (trabalhos que terminaram) ficam neste navegador: voltam ao recarregar. */
const readDone = (): Job[] => {
  try {
    const list = JSON.parse(localStorage.getItem(STORE) ?? '[]') as Job[]
    return Array.isArray(list) ? list.filter((j) => j?.id && j.status !== 'running').slice(0, KEEP) : []
  } catch {
    return []
  }
}

export const useJobs = create<State>()(() => ({ jobs: readDone() }))

useJobs.subscribe((s, prev) => {
  if (s.jobs === prev.jobs) return
  try {
    localStorage.setItem(STORE, JSON.stringify(s.jobs.filter((j) => j.status !== 'running').map((j) => ({ ...j, log: j.log?.slice(-12) })).slice(0, KEEP)))
  } catch {
    // sem armazenamento: vale até fechar a aba
  }
})

const stops = new Map<string, AbortController>()

export function startJob(init: Pick<Job, 'area' | 'kind' | 'label' | 'agent'> & Partial<Pick<Job, 'color' | 'href' | 'docId' | 'step' | 'silent'>>, controller?: AbortController): string {
  const id = crypto.randomUUID()
  if (controller) stops.set(id, controller)
  useJobs.setState((s) => ({ jobs: [{ ...init, id, step: init.step ?? 'Começando', status: 'running' as const, startedAt: Date.now(), log: [{ at: Date.now(), text: init.step ?? 'Começando' }] }, ...s.jobs].slice(0, KEEP) }))
  return id
}

export const patchJob = (id: string, patch: Partial<Job>) => useJobs.setState((s) => ({ jobs: s.jobs.map((j) => (j.id === id && j.status === 'running' ? { ...j, ...patch } : j)) }))

/** Uma linha no diário do trabalho (a busca que o agente faz, a página que lê). */
export const noteJob = (id: string, text: string) =>
  useJobs.setState((s) => ({
    jobs: s.jobs.map((j) => (j.id === id && j.log?.at(-1)?.text !== text ? { ...j, log: [...(j.log ?? []), { at: Date.now(), text }].slice(-40) } : j)),
  }))

export function finishJob(id: string, error?: unknown) {
  stops.delete(id)
  const stopped = (error as Error | undefined)?.name === 'AbortError'
  // Avisa onde quer que a pessoa esteja: terminou, e como ver o resultado
  const job = useJobs.getState().jobs.find((j) => j.id === id)
  if (job && !error && !job.silent) toast.success(`${job.kind} pronto: ${job.label}`.slice(0, 110), job.href ? { action: { label: 'Ver aqui', onClick: () => openPreview({ href: job.href!, title: `${job.kind} · ${job.label}` }) } } : undefined)
  useJobs.setState((s) => ({
    jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: error && !stopped ? 'error' : 'done', step: error ? (stopped ? 'Parado' : 'Não terminou') : 'Pronto', error: error && !stopped ? (error instanceof Error ? error.message : String(error)) : undefined, endedAt: Date.now() } : j)),
  }))
}

/** Avisa que uma entrega ficou pronta, com o caminho para ver só ela. */
export const announce = (message: string, href: string, title: string) => toast.success(message, { action: { label: 'Ver aqui', onClick: () => openPreview({ href, title }) } })

/** Uma entrega que não passou por um agente aqui (um post ou uma página enviados): entra direto na lista. */
export function recordDelivery(init: Pick<Job, 'area' | 'kind' | 'label' | 'agent'> & Partial<Pick<Job, 'href' | 'docId'>>) {
  const at = Date.now()
  useJobs.setState((s) => ({ jobs: [{ ...init, id: crypto.randomUUID(), step: 'Entregue', status: 'done' as const, startedAt: at, endedAt: at }, ...s.jobs].slice(0, KEEP) }))
}

/** Para o trabalho em andamento (o Claude Code é interrompido). */
export const stopJob = (id: string) => stops.get(id)?.abort()

/** O trabalho em andamento de um documento, se houver. */
export const runningFor = (docId: string | undefined) => useJobs.getState().jobs.find((j) => j.docId === docId && j.status === 'running')
export const useRunningFor = (docId: string | undefined) => useJobs((s) => s.jobs.find((j) => j.docId === docId && j.status === 'running'))

/** Pedido avulso à IA (criativos): registra enquanto roda. */
export async function trackJob<T>(init: Parameters<typeof startJob>[0], run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const id = startJob(init, controller)
  try {
    const result = await run(controller.signal)
    finishJob(id)
    return result
  } catch (error) {
    finishJob(id, error)
    throw error
  }
}
