/**
 * Radar da operação no Início (nova jornada de criação, Fase 3, 2026-11-09; o usuário: "pode ser sempre
 * ativo… como um radar da operação mesmo, mostrando o que temos completo e o que falta"). As cinco
 * etapas da jornada, sempre à vista, cada uma com o que está em dia e o que falta agora, calculado do
 * que existe no banco. Sem imports: roda no navegador e nos testes do Node.
 */

export interface RadarContent {
  status: 'ideia' | 'producao' | 'revisao' | 'aprovado'
  /** `AAAA-MM-DD` */
  editorialDate?: string
  clientStatus?: 'enviado' | 'aprovado' | 'ajuste'
  hasCreative: boolean
}

export interface RadarFacts {
  /** README.md do Cérebro com texto de verdade (não só o esqueleto). */
  brain: boolean
  /** Campos do Plano (oferta, público, tom, pilares). */
  plan: { offer: boolean; audience: boolean; tone: boolean; pillars: boolean }
  /** A marca escrita no Cérebro (`brand_md`). */
  brand: boolean
  /** Padrões de post salvos no Cérebro. */
  patterns: number
  contents: RadarContent[]
  /** Hoje, `AAAA-MM-DD`. */
  today: string
}

export type RadarState = 'ok' | 'falta' | 'atencao'

export interface RadarStep {
  id: 'cerebro' | 'marca' | 'pauta' | 'criativo' | 'aprovacao'
  title: string
  state: RadarState
  /** O que está em dia (números). */
  have: string
  /** O que falta agora; vazio quando está em dia. */
  missing: string
  to: string
  action: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Soma dias a uma data `AAAA-MM-DD` (sem fuso). */
export function addDaysKey(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

export function radarSteps(f: RadarFacts): RadarStep[] {
  const planMissing = ([['oferta', f.plan.offer], ['público', f.plan.audience], ['tom', f.plan.tone], ['pilares', f.plan.pillars]] as const).filter(([, ok]) => !ok).map(([k]) => k)
  const cerebroOk = f.brain && planMissing.length === 0

  const horizon = addDaysKey(f.today, 14)
  const upcoming = f.contents.filter((c) => c.editorialDate && c.editorialDate >= f.today && c.editorialDate <= horizon).length
  const late = f.contents.filter((c) => c.editorialDate && c.editorialDate < f.today && c.status !== 'aprovado').length

  const inWork = f.contents.filter((c) => c.status !== 'ideia')
  const withCreative = f.contents.filter((c) => c.hasCreative).length
  const noCreative = inWork.filter((c) => !c.hasCreative).length

  const manager = f.contents.filter((c) => c.status === 'revisao').length
  const ready = f.contents.filter((c) => c.status === 'aprovado' && !c.clientStatus).length
  const client = f.contents.filter((c) => c.status === 'aprovado' && c.clientStatus === 'enviado').length
  const adjust = f.contents.filter((c) => c.clientStatus === 'ajuste').length
  const approved = f.contents.filter((c) => c.clientStatus === 'aprovado').length

  return [
    {
      id: 'cerebro',
      title: 'Cérebro',
      state: cerebroOk ? 'ok' : 'falta',
      have: [f.brain ? 'visão geral escrita' : '', planMissing.length < 4 ? `Plano com ${4 - planMissing.length} de 4 campos` : ''].filter(Boolean).join(' · ') || 'Nada escrito ainda',
      missing: !f.brain ? 'Escreva quem é a empresa e o que vende' : planMissing.length ? `Falta no Plano: ${planMissing.join(', ')}` : '',
      to: !f.brain ? '/cerebro' : '/plano',
      action: !f.brain ? 'Abrir o Cérebro' : 'Completar o Plano',
    },
    {
      id: 'marca',
      title: 'Marca',
      state: f.brand && f.patterns > 0 ? 'ok' : 'falta',
      have: [f.brand ? 'marca escrita' : '', f.patterns ? plural(f.patterns, 'padrão de post', 'padrões de post') : ''].filter(Boolean).join(' · ') || 'Sem marca no Cérebro',
      missing: !f.brand ? 'Escreva cores, fontes, logo e voz' : f.patterns === 0 ? 'Salve um padrão de post quando um ficar bom' : '',
      to: '/cerebro',
      action: !f.brand ? 'Escrever a marca' : 'Ver a marca',
    },
    {
      id: 'pauta',
      title: 'Pauta',
      state: f.contents.length === 0 || upcoming === 0 ? 'falta' : late > 0 ? 'atencao' : 'ok',
      have: f.contents.length ? `${plural(f.contents.length, 'conteúdo', 'conteúdos')} · ${upcoming} nas próximas 2 semanas` : 'Nenhum conteúdo',
      missing: f.contents.length === 0 ? 'Monte a primeira pauta' : upcoming === 0 ? 'Nada com data nas próximas 2 semanas' : late > 0 ? `${plural(late, 'conteúdo com data vencida', 'conteúdos com data vencida')}` : '',
      to: late > 0 && upcoming > 0 ? '/conteudos?estado=atrasado' : '/pauta',
      action: late > 0 && upcoming > 0 ? 'Ver os vencidos' : 'Abrir a Pauta',
    },
    {
      id: 'criativo',
      title: 'Criativos',
      state: withCreative === 0 ? 'falta' : noCreative > 0 ? 'atencao' : 'ok',
      have: withCreative ? `${plural(withCreative, 'conteúdo com criativo', 'conteúdos com criativo')}` : 'Nenhum criativo ligado',
      missing: withCreative === 0 && inWork.length === 0 ? 'Produza o primeiro criativo de um conteúdo' : noCreative > 0 ? `${plural(noCreative, 'conteúdo em andamento sem criativo', 'conteúdos em andamento sem criativo')}` : withCreative === 0 ? 'Produza o primeiro criativo' : '',
      to: noCreative > 0 ? '/conteudos?estado=sem-criativo' : '/conteudos',
      action: noCreative > 0 ? 'Ver os sem criativo' : 'Abrir os conteúdos',
    },
    {
      id: 'aprovacao',
      title: 'Aprovação',
      state: adjust > 0 || manager > 0 ? 'atencao' : approved + client + ready === 0 ? 'falta' : 'ok',
      have: [approved ? plural(approved, 'aprovado pelo cliente', 'aprovados pelo cliente') : '', client ? `${client} com o cliente` : '', ready ? `${ready} pronto${ready === 1 ? '' : 's'} para enviar` : ''].filter(Boolean).join(' · ') || 'Nada enviado ao cliente',
      missing: [adjust ? plural(adjust, 'pedido de ajuste do cliente', 'pedidos de ajuste do cliente') : '', manager ? `${manager} esperando o gestor` : '', !adjust && !manager && approved + client + ready === 0 ? 'Aprove e mande o primeiro ao cliente' : ''].filter(Boolean).join(' · '),
      to: manager > 0 && !adjust ? '/conteudos?estado=revisao' : '/pauta',
      action: manager > 0 && !adjust ? 'Ver os que esperam o gestor' : 'Abrir a Pauta',
    },
  ]
}

/** Quantas etapas estão em dia. */
export const radarScore = (steps: RadarStep[]) => steps.filter((s) => s.state === 'ok').length
