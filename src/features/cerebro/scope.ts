import { isAutoPath, loadAccountVault, type BrainTeam, type LoadedVault } from './data'

/**
 * A empresa ativa dita o cérebro (o usuário, 2026-11-06: "a empresa dita tudo"; 2026-11-07: "somente
 * daquela empresa"). Cada conta tem o próprio cérebro, guardado no app (`data.ts`), e só ele aparece
 * na tela /cerebro e para a Iara. Para ver o de outra empresa, troca-se de conta no menu.
 */

export interface BrainScope {
  /** O que pode ser gravado: tudo menos a pasta montada pela plataforma. */
  allowed: (path: string) => boolean
  label: string
}

export const scopeOf = (team: BrainTeam): BrainScope => ({ allowed: (p) => !!p && !isAutoPath(p), label: team.name })

// O cofre lido por último (a Iara lê várias vezes seguidas): 5 s de reaproveitamento por conta
let cached: { at: number; team: string; vault: LoadedVault } | null = null
export async function loadScoped(team: BrainTeam | undefined | null): Promise<{ vault: LoadedVault; scope: BrainScope }> {
  if (!team) throw new Error('Nenhuma conta aberta.')
  if (!cached || cached.team !== team.id || Date.now() - cached.at > 5000) cached = { at: Date.now(), team: team.id, vault: await loadAccountVault(team) }
  return { vault: cached.vault, scope: scopeOf(team) }
}
export const forgetBrain = () => { cached = null }
