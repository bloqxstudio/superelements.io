import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { personName } from '@/features/projects/access'
import { useLiveCursors, useLiveProject, type LivePerson } from '@/features/projects/liveProject'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { agentStatus, useProjectAgents } from '@/features/space/bridge/agentsStore'
import { useClaudeBridge } from '@/features/space/bridge/bridgeStore'
import { useAgentCursors } from '@/features/space/chat/cursorStore'
import { useChat } from '@/features/space/chat/chatStore'
import { CHAT_AGENTS, agentInfoByName } from '@/features/space/chat/protocol'
import { useSpaceStore } from '@/store/spaceStore'

/**
 * Quem está no projeto agora: as pessoas com ele aberto (canal ao vivo) e os
 * agentes trabalhando nele (chat, ponte do dev). A barra de cima mostra todos;
 * o rótulo de cada página, só quem está nela (o mouse da pessoa, o cursor ou o
 * trabalho do agente).
 */

// Cor fixa por pessoa: a do cursor, do avatar e do nome são a mesma
const PERSON_COLORS = ['#0284C7', '#059669', '#7C3AED', '#D97706', '#E11D48', '#0D9488', '#4F46E5', '#C026D3']

export const personColor = (userId: string) => PERSON_COLORS[[...userId].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PERSON_COLORS.length]

/** "igor.nascimento@…" vira "Igor". */
export const displayName = (email: string) => {
  const first = personName(email).split(/[._-]/)[0] || personName(email)
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export interface Presence {
  key: string
  kind: 'me' | 'person' | 'agent'
  name: string
  /** Letra do avatar. */
  initial: string
  color: string
  ink: string
  /** O que está fazendo, na dica do avatar. */
  doing?: string
}

const personPresence = (person: LivePerson, kind: 'me' | 'person'): Presence => ({
  key: person.userId,
  kind,
  name: kind === 'me' ? 'Você' : displayName(person.email),
  initial: (person.email.charAt(0) || '?').toUpperCase(),
  color: personColor(person.userId),
  ink: '#FFFFFF',
  doing: kind === 'me' ? undefined : person.email,
})

const agentPresence = (name: string, doing?: string): Presence => {
  const info = agentInfoByName(name)
  // O agente de outra pessoa vem com o dono no nome ("Claude Code · Pedro") e é outra bolinha
  const remote = name.includes(' · ')
  return {
    key: remote ? `agent:${name}` : `agent:${info?.id ?? name}`,
    kind: 'agent',
    name: remote ? name : info?.name ?? name,
    initial: (info?.name ?? name).charAt(0).toUpperCase(),
    // A bolinha mostra as iniciais do agente; o dono aparece na dica
    color: info?.color ?? '#7C3AED',
    ink: info?.ink ?? '#FFFFFF',
    doing,
  }
}

/** Agentes com algum sinal de trabalho no projeto (ou numa página dele). */
function useAgentsAt(pageId?: string): Presence[] {
  const projectId = useProjectSync((s) => s.openId)
  const runs = useProjectAgents(projectId)
  const cursors = useAgentCursors((s) => s.cursors)
  const working = useClaudeBridge((s) => s.working)
  const chatRunning = useChat(useShallow((s) => (projectId ? s.conversations[projectId]?.running ?? [] : [])))
  const pages = useSpaceStore((s) => s.pages)

  return useMemo(() => {
    const page = pageId ? pages.find((p) => p.id === pageId) : undefined
    const onPage = (target: { pageId?: string; sectionId?: string }) =>
      !pageId || target.pageId === pageId || (!!target.sectionId && !!page?.sectionIds.includes(target.sectionId))
    const found = new Map<string, Presence>()
    const add = (p: Presence) => !found.has(p.key) && found.set(p.key, p)

    for (const cursor of Object.values(cursors)) if (cursor.mode !== 'gone' && onPage(cursor.target)) add(agentPresence(cursor.agent, cursor.text))
    for (const [id, mark] of Object.entries(working)) if (onPage({ pageId: id, sectionId: id })) add(agentPresence(mark.agent, mark.text))
    for (const run of runs) if (agentStatus(run) === 'working' && onPage({ pageId: run.pageId, sectionId: run.sectionId })) add(agentPresence(run.agent, run.now))
    if (!pageId) for (const id of chatRunning) add(agentPresence(CHAT_AGENTS[id].name, 'Trabalhando pelo chat'))
    return [...found.values()]
  }, [pageId, pages, cursors, working, runs, chatRunning])
}

/** Todos no projeto: você, as outras pessoas e os agentes trabalhando. */
export function useProjectPresence(): Presence[] {
  const { me, people } = useLiveProject(useShallow((s) => ({ me: s.me, people: s.people })))
  const agents = useAgentsAt()
  return useMemo(() => [...(me ? [personPresence(me, 'me')] : []), ...people.map((p) => personPresence(p, 'person')), ...agents], [me, people, agents])
}

/** Quem está numa página: o mouse das pessoas sobre ela e os agentes mexendo nela. */
export function usePagePresence(pageId: string): Presence[] {
  const people = useLiveProject((s) => s.people)
  const cursors = useLiveCursors((s) => s.cursors)
  const agents = useAgentsAt(pageId)
  return useMemo(() => {
    const here = people.filter((p) => cursors[p.userId]?.pageId === pageId).map((p) => personPresence(p, 'person'))
    return [...here, ...agents]
  }, [people, cursors, pageId, agents])
}
