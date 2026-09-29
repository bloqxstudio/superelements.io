import type { SectionElement } from '@/features/space/landingPage'
import { settingsOf } from './tree'

/**
 * Ajustes feitos à mão no painel de propriedades valem por cima da marca: a
 * marca troca cores, fontes e cantos da seção inteira, e sem isso um título
 * pintado de vermelho voltaria para a cor da marca mais próxima.
 *
 * `pinned` guarda, por id do elemento, as chaves de settings que o usuário
 * definiu. Depois da marca, essas chaves voltam ao valor do JSON de base.
 */
export type PinnedSettings = Record<string, string[]>

const index = (elements: SectionElement[], into = new Map<string, SectionElement>()) => {
  for (const element of elements) {
    if (element.id) into.set(element.id, element)
    index(element.elements ?? [], into)
  }
  return into
}

/** Devolve `branded` com as chaves fixadas copiadas de `base`. Muda `branded` no lugar (ele já é uma cópia da marca). */
export function restorePinned(branded: SectionElement[], base: SectionElement[], pinned: PinnedSettings | undefined): SectionElement[] {
  if (!pinned) return branded
  const ids = Object.keys(pinned).filter((id) => pinned[id]?.length)
  if (!ids.length) return branded
  const baseById = index(base)
  const brandedById = index(branded)
  for (const id of ids) {
    const source = baseById.get(id)
    const target = brandedById.get(id)
    if (!source || !target) continue
    const from = settingsOf(source)
    if (!target.settings || Array.isArray(target.settings)) target.settings = {}
    const to = target.settings as Record<string, unknown>
    for (const key of pinned[id]) {
      if (key in from) to[key] = structuredClone(from[key])
      else delete to[key]
      const globals = to.__globals__
      if (globals && typeof globals === 'object' && key in globals) delete (globals as Record<string, unknown>)[key]
    }
  }
  return branded
}

/** Junta chaves novas às fixadas do elemento. */
export function pinKeys(pinned: PinnedSettings | undefined, id: string, keys: string[]): PinnedSettings {
  const current = pinned?.[id] ?? []
  const next = [...new Set([...current, ...keys])]
  return next.length === current.length ? pinned ?? {} : { ...pinned, [id]: next }
}

/** As chaves fixadas dos elementos copiados passam para as cópias. */
export function copyPins(pinned: PinnedSettings | undefined, ids: Map<string, string>): PinnedSettings | undefined {
  if (!pinned) return pinned
  let next: PinnedSettings | undefined
  for (const [from, to] of ids) {
    if (!pinned[from]?.length) continue
    next = { ...(next ?? pinned), [to]: [...pinned[from]] }
  }
  return next ?? pinned
}
