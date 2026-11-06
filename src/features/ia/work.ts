import { create } from 'zustand'

/**
 * Pausar e parar o trabalho longo da Iara (2026-11-05, o usuário: "permita pausar um processo… no meio de uma
 * entrega, apenas pedir pra pausar"). Um trabalho por vez (o de criativos que a Iara começa, a equipe de agentes).
 * Todo pedido à IA desta aba passa por `checkpoint` antes de sair (`callAiRaw` em `criativos/link.ts`):
 * - pausar: o passo que está rodando termina, e o próximo espera até continuar;
 * - parar: cancela na hora o pedido em andamento (o sinal de `workSignal`) e o trabalho termina com o que já ficou pronto.
 */
interface WorkState {
  running: boolean
  paused: boolean
  label?: string
}

export const useWork = create<WorkState>()(() => ({ running: false, paused: false }))

let controller: AbortController | undefined
let waiters: (() => void)[] = []

const wake = () => {
  const list = waiters
  waiters = []
  list.forEach((w) => w())
}

export const isStopped = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export async function runWork<T>(label: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const mine = new AbortController()
  controller = mine
  useWork.setState({ running: true, paused: false, label })
  try {
    return await fn(mine.signal)
  } finally {
    if (controller === mine) {
      controller = undefined
      useWork.setState({ running: false, paused: false, label: undefined })
      wake()
    }
  }
}

/** O sinal do trabalho em andamento (para cancelar o pedido que está no ar). */
export const workSignal = () => controller?.signal

export function pauseWork(): boolean {
  if (!controller) return false
  useWork.setState({ paused: true })
  return true
}

export function resumeWork(): boolean {
  if (!useWork.getState().paused) return false
  useWork.setState({ paused: false })
  wake()
  return true
}

export function stopWork(): boolean {
  if (!controller) return false
  controller.abort()
  useWork.setState({ paused: false })
  wake()
  return true
}

/** Espera enquanto o trabalho está pausado; lança se ele foi parado. */
export async function checkpoint(): Promise<void> {
  const stopped = () => {
    if (controller?.signal.aborted) throw new DOMException('Parou', 'AbortError')
  }
  stopped()
  while (controller && useWork.getState().paused) {
    await new Promise<void>((r) => waiters.push(r))
    stopped()
  }
}

/** Um sinal que dispara com qualquer um dos dois. */
export function joinSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a || !b) return a ?? b
  const c = new AbortController()
  const fire = () => c.abort()
  if (a.aborted || b.aborted) c.abort()
  a.addEventListener('abort', fire, { once: true })
  b.addEventListener('abort', fire, { once: true })
  return c.signal
}
