import { useAgent, type AgentPhase } from '@/features/criativos/agentStore'
import { useEditor } from '@/features/criativos/store'
import type { CreativeSet } from '@/features/criativos/types'

/**
 * Acompanhar a Iara (2026-11-05, o usuário: "mostre o agente trabalhando na tela… ver os criativos
 * em tempo real, não quero que precise recarregar"). Com o modo ligado (o padrão), antes de mexer
 * num conjunto a Iara abre o editor dele nesta aba, escolhe o post e mostra o cursor e a etiqueta
 * do agente no canvas (`useAgent`, o mesmo do chat do editor). As mudanças entram pelo próprio
 * editor (`useEditor.edit`): aparecem na hora, viram um passo desfazível, são salvas e vão ao vivo
 * para quem mais estiver com o conjunto aberto. Sem o modo, ou com o editor fechado, grava direto.
 */

const KEY = 'iara-acompanhar'

export const followOn = () => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export const setFollow = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // vale até recarregar
  }
}

let navigateRef: ((to: string) => void) | undefined
export const setFollowNavigate = (fn: (to: string) => void) => {
  navigateRef = fn
}
export const goTo = (to: string) => navigateRef?.(to)

/** O editor desta aba está com este conjunto aberto e pronto. */
export const editorHas = (setId: string) => {
  const s = useEditor.getState()
  return s.status === 'ready' && s.set?.id === setId
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Leva a pessoa ao editor do conjunto (se o modo estiver ligado) e espera ele abrir.
 * Devolve se o editor ficou com o conjunto: aí as mudanças devem entrar por ele.
 */
export async function openInEditor(setId: string, projectId?: string, postId?: string): Promise<boolean> {
  if (!editorHas(setId)) {
    if (!followOn() || !navigateRef) return false
    const here = window.location.pathname === `/criativos/${setId}`
    if (!here) navigateRef(`/criativos/${setId}${projectId ? `?projeto=${projectId}` : ''}`)
    for (let i = 0; i < 60 && !editorHas(setId); i++) await wait(250)
    if (!editorHas(setId)) return false
  }
  if (postId && useEditor.getState().set?.posts.some((p) => p.id === postId)) useEditor.getState().selectPost(postId)
  return true
}

/** O conjunto como está agora no editor (com o que a pessoa ainda não salvou), ou o lido do armazenamento. */
export const liveSet = (set: CreativeSet): CreativeSet => (editorHas(set.id) ? (useEditor.getState().set ?? set) : set)

/** Aplica o conjunto novo pelo editor: um passo desfazível, salvo e transmitido. */
export function applyInEditor(next: CreativeSet, touchedSlides: string[] = [], selectPostId?: string): boolean {
  if (!editorHas(next.id)) return false
  useEditor.getState().edit(() => next)
  if (selectPostId && next.posts.some((p) => p.id === selectPostId)) useEditor.getState().selectPost(selectPostId)
  if (touchedSlides.length) useAgent.getState().highlight(touchedSlides)
  return true
}

/** O agente trabalhando no canvas: cursor no slide e a etiqueta com o passo. */
export function agentBegin(post: { id: string; slides: { id: string }[] } | undefined, label: string, agent: 'claude' | 'codex') {
  if (!post) return
  useAgent.getState().begin({ scope: 'post', postId: post.id, slideId: post.slides[0]?.id }, label, agent)
}
export const agentPhase = (phase: AgentPhase) => useAgent.getState().phase(phase)
export const agentEnd = () => useAgent.getState().end()
