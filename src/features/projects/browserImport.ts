import { supabase } from '@/integrations/supabase/client'
import { parseDesignMd } from '@/features/space/brand/designMd'
import type { BrandSnapshot } from '@/features/space/brand/brandStore'
import type { SpaceCanvas } from '@/store/spaceStore'
import { readBrowserBackups, readBrowserConnection, readBrowserDoc } from './browserDb'
import { summarize } from './projectStore'
import { insertProject, loadDocHead, savePublishBackups, saveProjectDoc, saveWordPressConnection } from './storage'
import type { Project, ProjectDoc } from './types'

/**
 * Antes da conta os projetos ficavam só no navegador: a lista no localStorage
 * e o conteúdo no IndexedDB (e, antes dos projetos, um canvas só). Levados
 * para a conta pela pessoa, uma vez por navegador; as cópias daqui ficam.
 */
const LIST_KEY = 'superelements-projects'
const LEGACY_CANVAS = 'space-canvas'
const LEGACY_BRAND = 'space-brand'
const LEGACY_IMPORTED = 'superelements-projects-legacy-imported'
/** Ids já levados para uma conta a partir deste navegador. */
const MOVED_KEY = 'superelements-projects-in-account'

const readJson = <T>(key: string): T | undefined => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? undefined
  } catch {
    return undefined
  }
}

const readMoved = () => new Set(readJson<string[]>(MOVED_KEY) ?? [])

const markMoved = (id: string) => {
  const moved = readMoved()
  moved.add(id)
  localStorage.setItem(MOVED_KEY, JSON.stringify([...moved]))
}

/** O canvas de antes dos projetos, se ainda não virou projeto. */
function readLegacy(): { project: Project; doc: ProjectDoc } | undefined {
  if (localStorage.getItem(LEGACY_IMPORTED)) return undefined
  const canvas = readJson<{ state?: Partial<SpaceCanvas> }>(LEGACY_CANVAS)?.state
  const brand = readJson<{ state?: Partial<BrandSnapshot> }>(LEGACY_BRAND)?.state
  const nodes = canvas?.nodes ?? []
  const source = brand?.source ?? ''
  if (!nodes.length && !source.trim()) return undefined

  const parsed = source.trim() ? parseDesignMd(source).brand : null
  const now = Date.now()
  return {
    project: {
      // Id fixo pelo navegador: tentar de novo não cria dois
      id: readJson<string>(`${LEGACY_IMPORTED}-id`) ?? rememberLegacyId(),
      name: parsed?.name || 'Meu primeiro projeto',
      context: '',
      createdAt: now,
      updatedAt: now,
      summary: summarize(nodes, parsed),
    },
    doc: {
      canvas: {
        nodes,
        connections: canvas?.connections ?? [],
        canvasTransform: canvas?.canvasTransform ?? { x: 0, y: 0, zoom: 1 },
      },
      brand: { source, enabled: brand?.enabled ?? true, logoRatios: brand?.logoRatios ?? {} },
    },
  }
}

function rememberLegacyId() {
  const id = crypto.randomUUID()
  localStorage.setItem(`${LEGACY_IMPORTED}-id`, JSON.stringify(id))
  return id
}

/** Projetos deste navegador que ainda não estão em nenhuma conta. */
export function browserProjects(): Project[] {
  const moved = readMoved()
  const listed = (readJson<{ state?: { projects?: Project[] } }>(LIST_KEY)?.state?.projects ?? []).filter((p) => !moved.has(p.id))
  const legacy = readLegacy()
  return legacy ? [...listed, legacy.project] : listed
}

/** Sobe um projeto com tudo o que ele tinha aqui: conteúdo, conexão com o WordPress e versões anteriores. */
async function moveProject(project: Project, doc: ProjectDoc | undefined) {
  const head = await loadDocHead(project.id)
  // Já tem conteúdo na conta: subiu antes, e pode ter sido editado lá
  if (head && head.revision > 0) return
  if (!head) await insertProject(project)

  const connection = await readBrowserConnection(project.id)
  if (connection) await saveWordPressConnection(project.id, connection)
  for (const { postId, backups } of await readBrowserBackups(project.id)) {
    if (backups.length) await savePublishBackups(project.id, postId, backups)
  }
  // Por último: com o conteúdo a revisão sobe, e é ela que diz que o projeto subiu inteiro
  if (doc) await saveProjectDoc(project.id, doc, { base: 0, previousPath: null, summary: project.summary, edited: false })
}

/** Leva para a conta aberta os projetos deste navegador; devolve quantos foram e quantos falharam. */
export async function moveBrowserProjects(): Promise<{ moved: number; failed: number }> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Entre na sua conta para levar os projetos.')

  const moved = readMoved()
  const listed = (readJson<{ state?: { projects?: Project[] } }>(LIST_KEY)?.state?.projects ?? []).filter((p) => !moved.has(p.id))
  let ok = 0
  let failed = 0

  for (const project of listed) {
    try {
      await moveProject(project, await readBrowserDoc(project.id))
      markMoved(project.id)
      ok++
    } catch (error) {
      console.error('[projetos] falha ao levar para a conta', project.name, error)
      failed++
    }
  }

  const legacy = readLegacy()
  if (legacy) {
    try {
      await moveProject(legacy.project, legacy.doc)
      localStorage.setItem(LEGACY_IMPORTED, '1')
      ok++
    } catch (error) {
      console.error('[projetos] falha ao levar o canvas antigo para a conta', error)
      failed++
    }
  }

  return { moved: ok, failed }
}
