import { useAgentCursors, type CursorTarget } from './cursorStore'
import type { CursorMode } from './protocol'

/**
 * Pedido de agente que chegou pela ponte e rodou nesta aba: move o cursor
 * dele. A sessão (SPACE_SESSION) separa os cursores; sem ela, vale o nome.
 */
export function cursorFromCall(who: { agent: string; session?: string }, method: string, params: unknown, result: unknown) {
  const key = who.session || `agente:${who.agent}`
  const p = (params ?? {}) as Record<string, unknown>
  const r = (result ?? {}) as Record<string, unknown>
  const first = (value: unknown) => (Array.isArray(value) && typeof value[0] === 'string' ? (value[0] as string) : undefined)
  const text = (value: unknown, max = 70) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined)
  const point = (mode: CursorMode, extra: { target?: CursorTarget; text?: string; click?: boolean } = {}) =>
    useAgentCursors.getState().point(key, { agent: who.agent, mode, ...extra })
  const known = !!useAgentCursors.getState().cursors[key]

  switch (method) {
    case 'status':
      return point('think', { text: 'Olhando o projeto' })
    case 'pull': {
      // Quem já tem um alvo continua nele; quem chega agora vai para a página que leu
      const content = r.content as Array<{ id: string }> | undefined
      return point('read', { text: 'Lendo a página', target: !known && content?.length === 1 ? { pageId: content[0].id } : undefined })
    }
    case 'work':
      if (p.done) return point('think', { text: 'Conferindo' })
      return point('edit', {
        text: text(p.text) ?? 'Trabalhando',
        target: { sectionId: first(r.sectionIds), pageId: r.pageId as string | undefined, elementId: text(p.element, 40) },
      })
    case 'apply': {
      const touched = Object.keys((r.touched as object) ?? {})
      return point('write', { text: text(p.label) ?? 'Gravando', click: true, target: { sectionId: touched[0], pageId: first(r.pageIds) } })
    }
    case 'plan':
      return point('write', { text: 'Planejando a página', click: true, target: { pageId: r.pageId as string | undefined } })
    case 'say': {
      const sectionId = first(r.sectionIds)
      return point(p.kind === 'done' ? 'done' : 'think', { text: text(p.text), target: sectionId ? { sectionId } : undefined })
    }
    case 'focus':
      return point('think', { target: { sectionId: r.sectionId as string | undefined, pageId: r.pageId as string | undefined } })
  }
}
