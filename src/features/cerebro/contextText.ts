/**
 * O contexto da conta em texto, para toda criação (nova jornada de criação, Fase 1, 2026-11-09: "o
 * cérebro deve vir primeiro de qualquer coisa, é o contexto básico"). Junta, nesta ordem: a visão geral
 * do Cérebro (README.md: quem é, o que vende, para quem), o Plano da empresa (oferta, público, tom,
 * objetivo, restrições, pilares) e a marca/padrões de post (`standardBlock`). Sem imports: roda no
 * navegador, no conector e nos testes do Node. Quem carrega é `accountContext.ts`.
 */

export interface PlanFields {
  offer: string
  audience: string
  tone: string
  goal: string
  restrictions: string
  pillars: string[]
}

export interface ContextParts {
  name: string
  /** README.md do Cérebro da conta. */
  overview?: string
  plan?: PlanFields | null
  /** Marca e padrões de post (texto já pronto de `standardBlock`). */
  standard?: string
  /** A nota de aprendizados mais recente (`learnings.ts`): o que funcionou e o que o cliente pediu. */
  learnings?: string
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** Tira o front matter e os comentários do modelo; vazio quando só sobrou o esqueleto. */
export function cleanOverview(md: string | undefined): string {
  if (!md) return ''
  const body = md.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/<!--[\s\S]*?-->/g, '').trim()
  // Só títulos e linhas vazias: o README ainda é o esqueleto de "Criar a estrutura"
  const real = body.split('\n').filter((l) => l.trim() && !/^#{1,6}\s/.test(l.trim()))
  return real.length ? body : ''
}

export function planText(p: PlanFields | null | undefined): string {
  if (!p) return ''
  return [
    p.offer.trim() && `Oferta: ${clip(p.offer.trim(), 900)}`,
    p.audience.trim() && `Público: ${clip(p.audience.trim(), 700)}`,
    p.tone.trim() && `Tom: ${clip(p.tone.trim(), 400)}`,
    p.goal.trim() && `Objetivo: ${clip(p.goal.trim(), 400)}`,
    p.restrictions.trim() && `Restrições (não fazer): ${clip(p.restrictions.trim(), 600)}`,
    p.pillars.length > 0 && `Pilares: ${p.pillars.join(' · ')}`,
  ].filter(Boolean).join('\n')
}

/** O bloco "Contexto da empresa" que vai em todo pedido de criação; vazio quando a conta não tem nada. */
export function contextText(parts: ContextParts): string {
  const overview = cleanOverview(parts.overview)
  const plan = planText(parts.plan)
  const standard = parts.standard?.trim() ?? ''
  const learnings = parts.learnings?.trim() ?? ''
  if (!overview && !plan && !standard && !learnings) return ''
  return [
    `# Contexto da empresa: ${parts.name} (do Cérebro da conta; é a fonte de verdade sobre a empresa)`,
    overview && `## Quem é (visão geral do Cérebro)\n${clip(overview, 2500)}`,
    plan && `## Plano da empresa\n${plan}`,
    standard && `## Marca e padrões\n${standard}`,
    learnings && `## O que a operação já ensinou (use para repetir o que funcionou e evitar o que o cliente pediu para ajustar)\n${clip(learnings.replace(/^# .*\n/, ''), 2500)}`,
  ].filter(Boolean).join('\n\n')
}

/**
 * A voz da Avence (texto fixo em `copy/knowledge.ts`) só vale para a conta da casa. Nas outras contas
 * o tom vem do Cérebro; sem conta (uso antigo, sem conta aberta), vale a voz da Avence como antes.
 */
export const usesHouseVoice = (account: { isHome?: boolean } | undefined | null) => !account || !!account.isHome

/**
 * As áreas que criam com o Cérebro e o arquivo de cada uma (a garantia fica em
 * scripts/tests/cerebro-conectado.test.mjs: se uma delas deixar de ler o contexto, o teste falha).
 * O radar do Início mostra esta lista na etapa Cérebro.
 */
export const CONNECTED_AREAS: { area: string; file: string; uses: string }[] = [
  { area: 'Textos', file: 'src/features/copy/runner.ts', uses: 'accountContext(' },
  { area: 'Criativos', file: 'src/features/criativos/ai.ts', uses: 'accountContext(' },
  { area: 'Roteiro da Pauta', file: 'src/features/conteudos/produce.ts', uses: 'accountContext(' },
  { area: 'Vídeo explicativo', file: 'src/features/criativos/explicativo/roteiro.ts', uses: 'accountContext(' },
  { area: 'Pesquisa do vídeo', file: 'src/features/criativos/explicativo/pesquisa.ts', uses: 'accountContext(' },
  { area: 'Iara, canvas e sites', file: 'src/features/iara/engine.ts', uses: 'brandContext(team)' },
  { area: 'Marca dos sites', file: 'src/features/projects/useProjectSession.ts', uses: 'accountBrandSource(' },
  { area: 'Marca dos criativos', file: 'src/pages/Creatives.tsx', uses: 'accountBrand(' },
  { area: 'Stories programados', file: 'src/features/crm/storyPipeline.ts', uses: 'accountContext(' },
  { area: 'Análise do Instagram', file: 'src/features/crm/profileAnalysis.ts', uses: 'accountContext(' },
  { area: 'Agentes comerciais', file: 'src/features/ia/tarefas.ts', uses: 'accountContext(' },
  { area: 'Aprendizados no contexto', file: 'src/features/cerebro/accountContext.ts', uses: 'learningsForContext(' },
  { area: 'Aprendizados gravados', file: 'src/features/onboarding/OperationRadar.tsx', uses: 'syncLearnings(' },
]
