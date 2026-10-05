import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_SETTINGS, type FunnelSettings, type Opportunity, type OpportunityPatch, type Stage } from '../../src/features/prospects/funnel.ts'
import { draftOffer } from '../../src/features/prospects/offer.ts'
import type { Lead } from '../../src/features/prospects/types.ts'
import { DEFAULT_DIR } from './engine.ts'

/**
 * O funil fica num arquivo só, ao lado das buscas (`data/prospeccao/funil.json`,
 * fora do git). As gravações passam por uma fila, para duas mudanças ao mesmo
 * tempo não apagarem uma à outra.
 */
const FILE = path.join(DEFAULT_DIR, 'funil.json')
const SETTINGS_FILE = path.join(DEFAULT_DIR, 'funil-config.json')

let queue: Promise<unknown> = Promise.resolve()
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

export const readFunnel = async (): Promise<Opportunity[]> => {
  try {
    return JSON.parse(await readFile(FILE, 'utf8')) as Opportunity[]
  } catch {
    return []
  }
}

const writeFunnel = async (list: Opportunity[]) => {
  await mkdir(DEFAULT_DIR, { recursive: true })
  // Grava ao lado e troca: um arquivo pela metade nunca fica no lugar do funil
  const temp = `${FILE}.tmp`
  await writeFile(temp, JSON.stringify(list, null, 1))
  await rename(temp, FILE)
}

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

export const updateOpportunity = (id: string, patch: OpportunityPatch) =>
  serial(async () => {
    const list = await readFunnel()
    const at = list.findIndex((o) => o.id === id)
    if (at < 0) return null
    const current = list[at]
    const now = new Date().toISOString()
    const moved = patch.stage && patch.stage !== current.stage
    const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v]))
    list[at] = { ...current, ...clean, history: moved ? [...current.history, { at: now, stage: patch.stage! }] : current.history, updatedAt: now }
    await writeFunnel(list)
    return list[at]
  })

export const removeOpportunity = (id: string) =>
  serial(async () => {
    const list = await readFunnel()
    await writeFunnel(list.filter((o) => o.id !== id))
  })

export const readSettings = async (): Promise<FunnelSettings> => {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(await readFile(SETTINGS_FILE, 'utf8')) as Partial<FunnelSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const writeSettings = (patch: Partial<FunnelSettings>) =>
  serial(async () => {
    const next = { ...(await readSettings()), ...patch }
    await mkdir(DEFAULT_DIR, { recursive: true })
    await writeFile(SETTINGS_FILE, JSON.stringify(next, null, 1))
    return next
  })
