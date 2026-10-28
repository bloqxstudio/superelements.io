import { useCrm } from './crmStore'

/**
 * A pasta pessoal de quem está logado, separada por conta: o que a pessoa guarda
 * (conjuntos de Criativos, documentos de Copy) fica na conta aberta, e trocar de conta
 * mostra outro ambiente. A conta da casa (Avence) e quem não tem conta usam a pasta de
 * sempre (`<pessoa>/…`), então nada que já existia muda de lugar.
 */
export function personalFolder(userId: string): string {
  const { status, team } = useCrm.getState()
  return status === 'ready' && team && !team.isHome ? `${userId}/contas/${team.id}` : userId
}
