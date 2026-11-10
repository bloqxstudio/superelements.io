/**
 * Motor dos testes de reels (trial reels, 2026-11-09). O Instagram mostra o teste só a quem não
 * segue a conta; este motor lê os números do teste e diz se vale levar aos seguidores, esperar mais
 * ou refazer o vídeo. Sem imports `@/`: os testes em `scripts/tests/trial-reels.test.mjs` rodam no Node.
 *
 * O que pesa, do mais forte ao mais fraco:
 * - Retenção: tempo médio assistido ÷ duração do vídeo. Quem não segue decide em segundos; é o que
 *   o Instagram mais usa para continuar mostrando o vídeo.
 * - Compartilhamentos e salvos por mil visualizações: o sinal de que o vídeo vale para quem não conhece.
 * - Interações por alcance.
 * - Visualizações comparadas aos reels normais da conta (que chegam também aos seguidores, por isso
 *   a referência é a metade da mediana deles).
 * Sem reels normais para comparar, usa referências fixas (retenção 40%, 10 comp.+salvos por mil, 4%).
 */

export type TrialStrategy = 'MANUAL' | 'SS_PERFORMANCE'
export type TrialDecision = 'levar' | 'refazer' | 'arquivar'
export type TrialVerdict = 'processando' | 'cedo' | 'levar' | 'esperar' | 'refazer'

export const STRATEGY_LABEL: Record<TrialStrategy, string> = {
  MANUAL: 'Eu decido',
  SS_PERFORMANCE: 'Automático pelo Instagram',
}
export const STRATEGY_HINT: Record<TrialStrategy, string> = {
  MANUAL: 'Fica só para quem não segue até você levar aos seguidores no app do Instagram (o motor diz quando vale).',
  SS_PERFORMANCE: 'O Instagram leva aos seguidores sozinho se o vídeo for bem com quem não segue.',
}

export interface TrialMetrics {
  reach?: number
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saved?: number
  total_interactions?: number
  /** ms */
  ig_reels_avg_watch_time?: number
}

export interface TrialInput {
  status: 'processando' | 'no_ar' | 'falhou'
  publishedAt?: number
  durationS?: number | null
  insights: TrialMetrics
}

/** Os reels normais da conta (não testes) dos últimos 90 dias. */
export interface ReelSample {
  insights: TrialMetrics
}

export interface Baseline {
  reels: number
  views?: number
  interactionRate?: number
  sharesSavesPerK?: number
}

export interface Signal {
  id: 'retencao' | 'compartilhar' | 'interacoes' | 'visualizacoes'
  label: string
  value: string
  reference: string
  /** 0 a 1: quanto do esperado o teste alcançou (1 = no esperado ou acima) */
  score: number | null
  weight: number
}

export interface TrialReading {
  verdict: TrialVerdict
  /** 0 a 100; null sem números */
  score: number | null
  hours: number
  headline: string
  detail: string
  signals: Signal[]
}

/** Antes disso o teste ainda está sendo mostrado: o veredito é provisório. */
export const EARLY_HOURS = 24
/** Até aqui um teste fraco ainda pode crescer; depois, refazer. */
export const SETTLED_HOURS = 72
/** Abaixo disso de visualizações o número não diz nada. */
export const MIN_VIEWS = 100

const REF = { retention: 0.4, sharesSavesPerK: 10, interactionRate: 0.04 }

const median = (values: number[]) => {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!list.length) return undefined
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

const viewsOf = (m: TrialMetrics) => m.views ?? m.reach
const interactionsOf = (m: TrialMetrics) => m.total_interactions ?? (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saved ?? 0)
const sharesSavesPerK = (m: TrialMetrics) => {
  const views = viewsOf(m)
  return views ? (((m.shares ?? 0) + (m.saved ?? 0)) / views) * 1000 : undefined
}
const interactionRate = (m: TrialMetrics) => (m.reach ? interactionsOf(m) / m.reach : undefined)

export function baselineOf(reels: ReelSample[]): Baseline {
  const usable = reels.filter((r) => (viewsOf(r.insights) ?? 0) > 0)
  return {
    reels: usable.length,
    views: median(usable.map((r) => viewsOf(r.insights)!)),
    interactionRate: median(usable.map((r) => interactionRate(r.insights)).filter((v): v is number => v !== undefined)),
    sharesSavesPerK: median(usable.map((r) => sharesSavesPerK(r.insights)).filter((v): v is number => v !== undefined)),
  }
}

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0).replace('.', ',')}%`
const num = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : Math.round(n).toLocaleString('pt-BR'))
const per = (n: number) => n.toFixed(n < 10 ? 1 : 0).replace('.', ',')

/** O quanto chegou do esperado: 1 no esperado; acima disso conta até 1,5× para compensar um sinal fraco. */
const ratio = (value: number, expected: number) => (expected > 0 ? Math.min(1.5, value / expected) : null)

export function readTrial(trial: TrialInput, baseline: Baseline, now = Date.now()): TrialReading {
  const hours = trial.publishedAt ? Math.max(0, (now - trial.publishedAt) / 3_600_000) : 0
  if (trial.status === 'falhou')
    return { verdict: 'refazer', score: null, hours, headline: 'O Instagram recusou o vídeo', detail: 'O vídeo não passou no processamento da Meta. Confira o formato (MP4, 9:16, 3 s a 15 min) e publique de novo.', signals: [] }
  if (trial.status === 'processando' || !trial.publishedAt)
    return { verdict: 'processando', score: null, hours, headline: 'Processando o vídeo', detail: 'O Instagram ainda está preparando o vídeo. Ele aparece aqui quando entrar no ar.', signals: [] }

  const m = trial.insights
  const views = viewsOf(m)
  const signals: Signal[] = []

  const watch = m.ig_reels_avg_watch_time
  const retention = watch !== undefined && trial.durationS ? Math.min(1, watch / 1000 / trial.durationS) : undefined
  signals.push({
    id: 'retencao',
    label: 'Retenção',
    value: retention !== undefined ? `${pct(retention)} (${per(watch! / 1000)} s de ${per(trial.durationS!)} s)` : watch !== undefined ? `${per(watch / 1000)} s em média` : '—',
    reference: `${pct(REF.retention)} ou mais`,
    score: retention !== undefined ? ratio(retention, REF.retention) : null,
    weight: 35,
  })

  const ssk = sharesSavesPerK(m)
  const sskRef = baseline.sharesSavesPerK && baseline.reels >= 3 ? Math.max(baseline.sharesSavesPerK, 2) : REF.sharesSavesPerK
  signals.push({
    id: 'compartilhar',
    label: 'Compartilhamentos e salvos',
    value: ssk !== undefined ? `${per(ssk)} por mil (${m.shares ?? 0} comp., ${m.saved ?? 0} salvos)` : '—',
    reference: `${per(sskRef)} por mil${baseline.reels >= 3 ? ' (seus reels)' : ''}`,
    score: ssk !== undefined ? ratio(ssk, sskRef) : null,
    weight: 30,
  })

  const ir = interactionRate(m)
  const irRef = baseline.interactionRate && baseline.reels >= 3 ? baseline.interactionRate : REF.interactionRate
  signals.push({
    id: 'interacoes',
    label: 'Interações por alcance',
    value: ir !== undefined ? pct(ir) : '—',
    reference: `${pct(irRef)}${baseline.reels >= 3 ? ' (seus reels)' : ''}`,
    // Quem não segue interage menos: 70% da referência já é bom
    score: ir !== undefined ? ratio(ir, irRef * 0.7) : null,
    weight: 20,
  })

  const viewsRef = baseline.views && baseline.reels >= 3 ? baseline.views / 2 : undefined
  signals.push({
    id: 'visualizacoes',
    label: 'Visualizações',
    value: views !== undefined ? num(views) : '—',
    reference: viewsRef !== undefined ? `${num(viewsRef)} (metade da mediana dos seus reels)` : 'sem reels para comparar',
    score: views !== undefined && viewsRef !== undefined ? ratio(views, viewsRef) : null,
    weight: 15,
  })

  const scored = signals.filter((s) => s.score !== null)
  const weight = scored.reduce((sum, s) => sum + s.weight, 0)
  const score = weight ? Math.round((scored.reduce((sum, s) => sum + Math.min(1, s.score!) * s.weight, 0) / weight) * 100) : null
  // Um sinal acima do esperado compensa outro abaixo, até o teto
  const bonus = weight ? scored.reduce((sum, s) => sum + Math.max(0, s.score! - 1) * s.weight, 0) / weight : 0
  const final = score === null ? null : Math.min(100, Math.round(score + bonus * 40))

  if (views === undefined || views < MIN_VIEWS) {
    const early = hours < SETTLED_HOURS
    return {
      verdict: early ? 'cedo' : 'refazer',
      score: final,
      hours,
      headline: early ? 'Poucas visualizações ainda' : 'O teste não ganhou distribuição',
      detail: early
        ? `Com menos de ${MIN_VIEWS} visualizações qualquer número engana. Espere o teste rodar (até ${SETTLED_HOURS} h).`
        : `Depois de ${SETTLED_HOURS} h, menos de ${MIN_VIEWS} visualizações: o Instagram parou de mostrar. Troque o gancho dos primeiros 2 segundos e teste de novo.`,
      signals,
    }
  }
  if (hours < EARLY_HOURS)
    return { verdict: 'cedo', score: final, hours, headline: 'Leitura provisória', detail: `O teste ainda está sendo mostrado. O veredito vale a partir de ${EARLY_HOURS} h.`, signals }

  const weakest = scored.filter((s) => (s.score ?? 0) < 0.7).sort((a, b) => b.weight - a.weight)[0]
  const fix: Record<Signal['id'], string> = {
    retencao: 'as pessoas saem cedo: corte o começo, ponha o resultado nos 2 primeiros segundos e encurte o vídeo',
    compartilhar: 'pouca gente salva ou manda: dê uma dica que valha guardar ou algo que dê vontade de mandar a alguém',
    interacoes: 'quase ninguém reage: termine com uma pergunta ou chamada clara',
    visualizacoes: 'o Instagram mostrou pouco: troque a capa e o gancho',
  }
  if (final !== null && final >= 70)
    return { verdict: 'levar', score: final, hours, headline: 'Vale levar aos seguidores', detail: 'Foi bem com quem não segue. No app do Instagram, abra o reel e toque em "Compartilhar com seguidores".', signals }
  if (final !== null && final < 45 && hours >= SETTLED_HOURS)
    return { verdict: 'refazer', score: final, hours, headline: 'Refazer antes de levar', detail: weakest ? `O ponto fraco: ${fix[weakest.id]}.` : 'Os números ficaram abaixo do esperado.', signals }
  return {
    verdict: 'esperar',
    score: final,
    hours,
    headline: hours < SETTLED_HOURS ? 'Esperar mais um pouco' : 'No meio do caminho',
    detail:
      hours < SETTLED_HOURS
        ? `Ainda pode crescer: a próxima leitura que conta é a de ${SETTLED_HOURS} h.${weakest ? ` Ponto de atenção: ${fix[weakest.id]}.` : ''}`
        : `Não foi mal, mas também não se destacou.${weakest ? ` Para a próxima versão: ${fix[weakest.id]}.` : ''} Leve se o assunto for importante para a conta.`,
    signals,
  }
}

export const VERDICT_LABEL: Record<TrialVerdict, string> = {
  processando: 'Processando',
  cedo: 'Rodando',
  levar: 'Levar aos seguidores',
  esperar: 'Esperar',
  refazer: 'Refazer',
}

export const DECISION_LABEL: Record<TrialDecision, string> = {
  levar: 'Levado aos seguidores',
  refazer: 'Vai ser refeito',
  arquivar: 'Arquivado',
}
