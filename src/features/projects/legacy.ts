import { parseDesignMd } from '@/features/space/brand/designMd'
import type { BrandSnapshot } from '@/features/space/brand/brandStore'
import type { SpaceCanvas } from '@/store/spaceStore'
import { summarize, useProjectStore } from './projectStore'
import { saveProjectDoc } from './storage'

/**
 * Antes dos projetos o Space tinha um canvas e uma marca só, no localStorage.
 * Na primeira visita eles viram um projeto; as chaves antigas ficam como estão.
 */
const LEGACY_CANVAS = 'space-canvas'
const LEGACY_BRAND = 'space-brand'
const IMPORTED = 'superelements-projects-legacy-imported'

const readPersisted = <T>(key: string): Partial<T> | undefined => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')?.state
  } catch {
    return undefined
  }
}

let importing: Promise<void> | null = null

export const importLegacySpace = () =>
  (importing ??= (async () => {
    if (localStorage.getItem(IMPORTED)) return
    const canvas = readPersisted<SpaceCanvas>(LEGACY_CANVAS)
    const brand = readPersisted<BrandSnapshot>(LEGACY_BRAND)
    const nodes = canvas?.nodes ?? []
    const source = brand?.source ?? ''

    if (nodes.length || source.trim()) {
      const parsed = source.trim() ? parseDesignMd(source).brand : null
      const store = useProjectStore.getState()
      const project = store.create({ name: parsed?.name || 'Meu primeiro projeto' })
      try {
        await saveProjectDoc(project.id, {
          canvas: {
            nodes,
            connections: canvas?.connections ?? [],
            canvasTransform: canvas?.canvasTransform ?? { x: 0, y: 0, zoom: 1 },
          },
          brand: { source, enabled: brand?.enabled ?? true, logoRatios: brand?.logoRatios ?? {} },
        })
      } catch (error) {
        // Sem o conteúdo o projeto ficaria vazio; tenta de novo na próxima visita
        await store.remove(project.id).catch(() => {})
        throw error
      }
      store.saved(project.id, summarize(nodes, parsed), false)
    }
    localStorage.setItem(IMPORTED, '1')
  })().catch((error) => {
    importing = null
    console.error('[projetos] falha ao importar o canvas antigo', error)
  }))
