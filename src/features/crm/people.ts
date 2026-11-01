import { useEffect, useState } from 'react'
import { displayName, initialsOf } from '@/features/profile/profile'
import { listPeople } from './teams'
import type { TeamPerson } from './types'

/**
 * As pessoas da equipe como as telas do CRM mostram: o nome do perfil (/perfil)
 * ou, quando a pessoa não escreveu um, o que sai do e-mail
 * ("igor.nascimento@…" → "Igor Nascimento").
 */

export const personLabel = (email: string | undefined) => displayName(undefined, email)

export { initialsOf }

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
  return person?.name
}
