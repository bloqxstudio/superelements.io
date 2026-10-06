import { useEffect } from 'react'
import { broadcastLive, onLive, useLiveProject } from '@/features/projects/liveProject'
import { useAgentCursors, type AgentCursor, type CursorTarget } from '@/features/space/chat/cursorStore'
import type { CursorMode } from '@/features/space/chat/protocol'
import { displayName } from './presence'

/**
 * O cursor do agente que roda na minha máquina aparece também para quem mais
 * está no projeto, e o deles para mim. Cada mudança do cursor local (ir até
 * uma seção, ler, editar, gravar, sair) vai pelo canal ao vivo; do outro lado
 * ele entra como um cursor a mais, com o nome de quem é o agente.
 */

/** Cursores que vieram de outra pessoa: não voltam para o canal. */
const REMOTE = 'r:'

interface AgentCursorMessage {
  key: string
  agent: string
  owner: string
  mode: CursorMode
  target?: CursorTarget
  text?: string
  click?: boolean
}

const messageOf = (cursor: AgentCursor, before: AgentCursor | undefined, owner: string): AgentCursorMessage => ({
  key: cursor.key,
  agent: cursor.agent,
  owner,
  mode: cursor.mode,
  target: cursor.target,
  text: cursor.text,
  click: !!cursor.clickAt && cursor.clickAt !== before?.clickAt,
})

const owner = () => {
  const me = useLiveProject.getState().me
  return me ? displayName(me.email) : ''
}

/** Liga a troca de cursores de agente com o canal ao vivo enquanto o projeto está aberto. */
export function useShareAgentCursors() {
  useEffect(() => {
    // O que muda aqui vai para os outros
    const offLocal = useAgentCursors.subscribe((state, prev) => {
      for (const [key, cursor] of Object.entries(state.cursors)) {
        if (key.startsWith(REMOTE) || cursor === prev.cursors[key]) continue
        broadcastLive('agent-cursor', { ...messageOf(cursor, prev.cursors[key], owner()) })
      }
      for (const key of Object.keys(prev.cursors)) {
        if (!key.startsWith(REMOTE) && !state.cursors[key]) broadcastLive('agent-cursor', { key, agent: prev.cursors[key].agent, owner: owner(), mode: 'gone' })
      }
    })

    // O que vem dos outros entra como um cursor a mais, com o dono no nome
    const offRemote = onLive('agent-cursor', (payload, from) => {
      const message = payload as Partial<AgentCursorMessage>
      if (!message.key || !message.agent || !message.mode) return
      useAgentCursors.getState().point(`${REMOTE}${from}:${message.key}`, {
        agent: message.owner ? `${message.agent} · ${message.owner}` : message.agent,
        mode: message.mode,
        target: message.target,
        text: message.text,
        click: message.click,
      })
    })

    // Quem chega ao projeto recebe os cursores que já estão no ar; quem sai leva os dele
    let present = new Set(useLiveProject.getState().people.map((p) => p.userId))
    const offPeople = useLiveProject.subscribe((state) => {
      const now = new Set(state.people.map((p) => p.userId))
      const arrived = [...now].some((id) => !present.has(id))
      const left = [...present].filter((id) => !now.has(id))
      present = now
      if (arrived) {
        for (const cursor of Object.values(useAgentCursors.getState().cursors)) {
          if (!cursor.key.startsWith(REMOTE) && cursor.mode !== 'gone') broadcastLive('agent-cursor', { ...messageOf(cursor, undefined, owner()) })
        }
      }
      for (const userId of left) {
        for (const key of Object.keys(useAgentCursors.getState().cursors)) if (key.startsWith(`${REMOTE}${userId}:`)) useAgentCursors.getState().remove(key)
      }
    })

    return () => {
      offLocal()
      offRemote()
      offPeople()
    }
  }, [])
}
