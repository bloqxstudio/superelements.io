import { useEffect, useState } from 'react'
import { listPeople } from './teams'
import type { TeamPerson } from './types'

/**
 * As pessoas da equipe como as telas do CRM mostram: o nome sai do e-mail da
 * conta ("igor.nascimento@…" → "Igor Nascimento"), porque a conta não guarda
 * outro nome.
 */

export const personLabel = (email: string | undefined) => {
  const words = (email?.split('@')[0] ?? '').split(/[._\-+]+/).filter(Boolean)
  if (!words.length) return email || 'Alguém'
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const initialsOf = (label: string) =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?'

/** As pessoas da equipe aberta; undefined enquanto lê. */
export function useTeamPeople(teamId: string | undefined): TeamPerson[] | undefined {
  const [people, setPeople] = useState<TeamPerson[]>()
  useEffect(() => {
    if (!teamId) return
    let alive = true
    listPeople(teamId)
      .then((list) => alive && setPeople(list))
      .catch((error) => {
        console.error('[crm] falha ao ler as pessoas da equipe', error)
        if (alive) setPeople([])
      })
    return () => {
      alive = false
    }
  }, [teamId])
  return people
}

/** Nome de quem tem a conta `userId`, pelas pessoas da equipe. */
export const nameOf = (people: TeamPerson[] | undefined, userId: string | undefined) => {
  if (!userId) return undefined
  const person = people?.find((p) => p.userId === userId)
  return person ? personLabel(person.email) : undefined
}
