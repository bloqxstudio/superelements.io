import type { Opportunity, Stage } from '../../src/features/prospects/funnel.ts'
import { draftOffer } from '../../src/features/prospects/offer.ts'
import type { Lead } from '../../src/features/prospects/types.ts'
import { getJson, putJson, shared } from './cloud.ts'

/**
 * O funil da equipe pelo terminal (`--site`, `--fila`): o mesmo arquivo que a
 * tela usa, na nuvem (`prospeccao/funnel.json`). Até 2026-10-13 ele ficava em
 * `data/prospeccao/funil.json`, e o que se fazia aqui não chegava à equipe.
 * As gravações passam por uma fila, para duas mudanças deste processo não
 * apagarem uma à outra.
 */
const FILE = shared('funnel.json')

let queue: Promise<unknown> = Promise.resolve()
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

export const readFunnel = async (): Promise<Opportunity[]> => (await getJson<Opportunity[]>(FILE)) ?? []

const writeFunnel = (list: Opportunity[]) => putJson(FILE, list)

/** Põe empresas no funil. As que já estão mantêm a etapa, a não ser que `stage` seja dada. */
export const addToFunnel = (leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage; projectName?: string }) =>
  serial(async () => {
    const list = await readFunnel()
    const byId = new Map(list.map((o) => [o.id, o]))
    const now = new Date().toISOString()
    for (const lead of leads) {
      const current = byId.get(lead.id)
      if (current) {
        const moved = meta.stage && meta.stage !== current.stage
        byId.set(lead.id, {
          ...current,
          lead,
          stage: meta.stage ?? current.stage,
          projectName: meta.projectName ?? current.projectName,
          history: moved ? [...current.history, { at: now, stage: meta.stage! }] : current.history,
          updatedAt: now,
        })
      } else {
        const stage = meta.stage ?? 'mapeado'
        // Toda oportunidade nasce com a oferta e o roteiro de venda padrão, para ajustar depois
        const { offer, brief } = draftOffer(lead)
        byId.set(lead.id, {
          offer,
          brief,
          id: lead.id,
          lead,
          searchId: meta.searchId,
          region: meta.region,
          stage,
          projectName: meta.projectName,
          history: [{ at: now, stage }],
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    const next = [...byId.values()]
    await writeFunnel(next)
    return next
  })
