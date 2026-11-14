import type { FormVisit } from './formFunnel.ts'

/**
 * O funil do período na tela Visitas do site (2026-11-14, o usuário: "unificar na mesma tela todos os
 * acessos ao vivo, não só do site mas também do formulário, e contabilizar como uma visita, porque pra
 * nós conta como uma visita no funil: campanha → site ou formulário → agendamento").
 *
 * Regra contra duplicidade (o usuário: "pode ter clientes que nem tenham site, por isso eu colocaria em
 * ambos; se entender que os 2 têm, grava somente o do site"): o formulário pelo link (`/f/`) ou num site
 * SEM o código de visitas conta como visita; num site COM o código (`site_tracked`, ou ligado a uma
 * visita do site por `site_session_id`) a visita é a do site. Visitas antigas dentro do site
 * (`site_tracked` nulo) seguem a regra de antes: não contam. Enviou e agendou contam de todas. Sem imports `@/`: os testes em Node (`scripts/tests/site-funil.test.mjs`) leem este arquivo.
 */

/** A visita ao formulário conta como visita (o site não a viu): pelo link ou num site sem o código de visitas */
export const countsAsVisit = (v: Pick<FormVisit, 'embed' | 'siteTracked' | 'siteSessionId'>) => !v.siteSessionId && (v.embed !== 'site' || v.siteTracked === false)
/** Onde a pessoa abriu o formulário, em palavras */
export const formWhere = (v: Pick<FormVisit, 'embed' | 'siteTracked' | 'siteSessionId'>) =>
  v.embed !== 'site' ? 'pelo link' : countsAsVisit(v) ? 'num site sem o código de visitas' : 'dentro do site'

export interface ChannelRow {
  channel: string
  /** Visitas do site */
  site: number
  /** Visitas pelo link do formulário */
  form: number
  /** Site + link do formulário */
  visits: number
  /** Enviaram um formulário (do site ou do link) */
  submitted: number
  scheduled: number
}

export interface FunnelTotals {
  site: number
  formLink: number
  visits: number
  /** Abriram um formulário (no site ou pelo link) */
  formOpened: number
  submitted: number
  scheduleView: number
  scheduled: number
}

export function funnelTotals(siteSessions: number, formVisits: Pick<FormVisit, 'embed' | 'siteTracked' | 'siteSessionId' | 'submitted' | 'scheduleView' | 'scheduled'>[]): FunnelTotals {
  const formLink = formVisits.filter(countsAsVisit).length
  return {
    site: siteSessions,
    formLink,
    visits: siteSessions + formLink,
    formOpened: formVisits.length,
    submitted: formVisits.filter((v) => v.submitted).length,
    scheduleView: formVisits.filter((v) => v.scheduleView || v.scheduled).length,
    scheduled: formVisits.filter((v) => v.scheduled).length,
  }
}

/** Por canal (a mesma regra de origem do site e do formulário): visitas do site, pelo link, enviaram e agendaram */
export function channelRows(site: { channel: string; sessions: number }[], formVisits: Pick<FormVisit, 'embed' | 'siteTracked' | 'siteSessionId' | 'channel' | 'submitted' | 'scheduled'>[]): ChannelRow[] {
  const map = new Map<string, ChannelRow>()
  const row = (channel: string) => {
    let r = map.get(channel)
    if (!r) map.set(channel, (r = { channel, site: 0, form: 0, visits: 0, submitted: 0, scheduled: 0 }))
    return r
  }
  for (const s of site) {
    const r = row(s.channel || 'Direto')
    r.site += s.sessions
    r.visits += s.sessions
  }
  for (const v of formVisits) {
    const r = row(v.channel || 'Direto')
    if (countsAsVisit(v)) {
      r.form++
      r.visits++
    }
    if (v.submitted) r.submitted++
    if (v.scheduled) r.scheduled++
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.scheduled - a.scheduled || b.submitted - a.submitted)
}

/**
 * Separa as visitas ao formulário do período e do período anterior, do mesmo tamanho. `openEnd`:
 * o período vai até agora (Hoje, 7 dias…), então quem abrir depois da leitura também entra.
 */
export function splitByPeriod<T extends Pick<FormVisit, 'startedAt'>>(visits: T[], from: number, to: number, openEnd = false) {
  const span = to - from
  return {
    current: visits.filter((v) => v.startedAt >= from && (openEnd || v.startedAt < to)),
    previous: visits.filter((v) => v.startedAt >= from - span && v.startedAt < from),
  }
}
