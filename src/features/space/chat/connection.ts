import { useProjectSync } from '@/features/projects/useProjectSession'
import { useClaudeBridge } from '@/features/space/bridge/bridgeStore'
import type { AgentChannel } from '@/features/space/connector/channel'
import { useChat } from './chatStore'
import { useAgentCursors } from './cursorStore'
import { CHAT_AGENTS, CHAT_EVENTS, chatSession, type ChatAgentId, type ChatConversation, type ChatCursorHint, type ChatStateEvent } from './protocol'

/**
 * Lado do navegador do chat com os agentes (o servidor fica em
 * `scripts/space/chatPlugin.ts`, no dev ou dentro do conector). Pede a conversa do projeto aberto,
 * manda as mensagens e recebe o que o agente faz, aos pedaços.
 */

type Hot = AgentChannel

/** Agente que parou: some a marca de "trabalhando" que ele deixou nas seções. */
function stopped(projectId: string, agents: ChatAgentId[], epoch: number) {
  const bridge = useClaudeBridge.getState()
  const names = new Set(agents.map((id) => CHAT_AGENTS[id].name))
  const marks = Object.entries(bridge.working).filter(([, mark]) => names.has(mark.agent)).map(([id]) => id)
  if (marks.length) bridge.clearWorking(marks)
  const cursors = useAgentCursors.getState()
  for (const id of agents) {
    const key = chatSession(projectId, id, epoch)
    const cursor = cursors.cursors[key]
    if (cursor && cursor.mode !== 'done' && cursor.mode !== 'gone') cursors.point(key, { agent: cursor.agent, mode: 'done' })
  }
}

export function startSpaceChat(hot: Hot) {
  const hello = () => hot.send(CHAT_EVENTS.hello, { projectId: useProjectSync.getState().openId })

  const onState = (event: ChatStateEvent) => {
    const { conversations } = useChat.getState()
    const patch: Partial<ReturnType<typeof useChat.getState>> = { connected: true }
    if (event.agents) patch.agents = event.agents
    const id = event.projectId
    if (id) {
      const before = conversations[id]
      let next: ChatConversation | undefined = before
      if (event.conversation !== undefined) next = event.conversation ?? undefined
      else if (event.message && before) {
        const i = before.messages.findIndex((m) => m.id === event.message!.id)
        const messages = i < 0 ? [...before.messages, event.message] : before.messages.map((m, j) => (j === i ? event.message! : m))
        next = { ...before, messages, running: event.running ?? before.running, epoch: event.epoch ?? before.epoch }
      }
      if (next !== before) {
        patch.conversations = { ...conversations }
        if (next) patch.conversations[id] = next
        else delete patch.conversations[id]
        const ended = (before?.running ?? []).filter((a) => !next?.running.includes(a))
        if (ended.length && before) stopped(id, ended, before.epoch)
      }
    }
    useChat.setState(patch)
  }

  const onCursor = (hint: ChatCursorHint) => {
    if (!hint?.session || hint.projectId !== useProjectSync.getState().openId) return
    useAgentCursors.getState().point(hint.session, {
      agent: hint.agent,
      mode: hint.mode,
      text: hint.text,
      target: hint.sectionId || hint.pageId ? { sectionId: hint.sectionId, pageId: hint.pageId, elementId: hint.elementId } : undefined,
    })
  }

  hot.on(CHAT_EVENTS.state, onState)
  hot.on(CHAT_EVENTS.cursor, onCursor)
  hot.on('vite:ws:connect', hello)
  const unsubscribe = useProjectSync.subscribe((s, prev) => s.openId !== prev.openId && hello())
  useChat.setState({
    send: (payload) => hot.send(CHAT_EVENTS.send, payload),
    stop: (projectId, agent) => hot.send(CHAT_EVENTS.stop, { projectId, agent }),
    reset: (projectId) => hot.send(CHAT_EVENTS.reset, { projectId }),
  })
  hello()

  return () => {
    hot.off(CHAT_EVENTS.state, onState)
    hot.off(CHAT_EVENTS.cursor, onCursor)
    hot.off('vite:ws:connect', hello)
    unsubscribe()
    useChat.setState({ connected: false, send: undefined, stop: undefined, reset: undefined })
  }
}

