import { useCrm } from '@/features/crm/crmStore'
import { forgetStandard, loadStandard, saveBrand } from './standard'

/**
 * Uma marca só por conta (nova jornada de criação, Fase 4, 2026-11-09; o usuário: "conectando tudo ao
 * cérebro, deixando tudo conectado"). A marca da conta é a nota marca/DESIGN.md do Cérebro
 * (`crm_account_context.brand_md`). Os sites do Space, os conjuntos de Criativos e os vídeos guardam uma
 * cópia para desenhar; estas funções ligam a cópia à marca da conta (usar a da conta, ou gravar a do
 * projeto como a da conta).
 *
 * Na conta da casa (Avence) cada projeto é o site de um cliente, com a marca dele: lá a marca da conta
 * não substitui a dos projetos (`linksProjects` falso).
 */

export interface AccountBrandInfo {
  teamId: string
  teamName: string
  /** O DESIGN.md da conta; vazio quando o Cérebro ainda não tem marca. */
  source: string
  /** Os projetos do Space desta conta seguem a marca dela (falso na conta da casa). */
  linksProjects: boolean
}

export async function accountBrandSource(): Promise<AccountBrandInfo | undefined> {
  const team = useCrm.getState().team
  if (!team) return undefined
  const { brand } = await loadStandard(team.id)
  return { teamId: team.id, teamName: team.name, source: brand, linksProjects: !team.isHome }
}

/** Grava o DESIGN.md como a marca da conta (só gestor; o servidor confere). */
export async function saveAccountBrand(source: string): Promise<void> {
  const team = useCrm.getState().team
  if (!team) throw new Error('Nenhuma conta aberta.')
  await saveBrand(team.id, source)
  forgetStandard()
}

/** Mesmo texto, ignorando espaços nas pontas e finais de linha. */
export const sameBrand = (a: string, b: string) => a.replace(/\r\n/g, '\n').trim() === b.replace(/\r\n/g, '\n').trim()
