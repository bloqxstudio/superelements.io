import type { SupabaseClient } from '@supabase/supabase-js'
import type { Period } from './comandos.ts'

/**
 * O que as telas do produto mostram além do resumo: estados, cidades, campanhas, anúncios, páginas,
 * cliques, aparelhos, público e números do Instagram. Só leitura, tudo da conta de quem pergunta.
 * É o que a IA lê na conversa para responder "e por estado?", "qual anúncio converteu?", "qual página mais vista?".
 */

type Db = SupabaseClient

const int = (n: number | undefined) => Math.round(n ?? 0).toLocaleString('pt-BR')
const money = (n: number | undefined, currency = 'BRL') => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency })
const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(1).replace('.', ',')}%` : '—')
const top = <T,>(list: T[] | undefined, n: number) => (list ?? []).slice(0, n)
const section = (title: string, lines: string[]) => (lines.length ? [`*${title}*`, ...lines].join('\n') : '')
const DAYS = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

interface SiteReport {
  totals?: { sessions?: number; bounces?: number; activeMs?: number; pageviews?: number; converted?: number }
  regions?: { name: string; region: string; country: string; sessions: number; converted: number }[]
  cities?: { city: string; region: string; sessions: number; converted: number }[]
  campaigns?: { campaign: string; channel: string; sessions: number; converted: number }[]
  ads?: { ad: string; adset?: string; campaign?: string; sessions?: number; converted?: number; forms?: number; channel?: string }[]
  pages?: { path: string; title?: string; views: number; visitors: number; scroll?: number; activeMs?: number }[]
  landings?: { path: string; sessions: number; bounces: number; converted: number }[]
  conversionPages?: { path: string; total: number; sessions: number }[]
  clicks?: { name: string; label?: string; section?: string; total: number }[]
  events?: { name: string; total: number; sessions: number }[]
  devices?: { key: string; sessions: number }[]
  browsers?: { key: string; sessions: number }[]
  os?: { key: string; sessions: number }[]
  countries?: { key: string; sessions: number }[]
  hours?: { dow: number; hour: number; sessions: number }[]
  notFound?: { path: string; views: number }[]
}

/** Tudo do painel de visitas no período, em texto compacto */
export async function siteDetalhe(db: Db, teamId: string, period: Period): Promise<string> {
  const { data: trackers } = await db.from('site_trackers').select('id, name, domain').eq('team_id', teamId).limit(3)
  const out: string[] = []
  for (const tracker of trackers ?? []) {
    const { data, error } = await db.rpc('site_report', { p_site: tracker.id, p_from: period.from.toISOString(), p_to: period.to.toISOString() })
    if (error || !data) continue
    const r = data as SiteReport
    const sessions = r.totals?.sessions ?? 0
    const peak = new Map<string, number>()
    for (const h of r.hours ?? []) peak.set(`${h.dow}-${h.hour}`, (peak.get(`${h.dow}-${h.hour}`) ?? 0) + h.sessions)
    const byHour = new Map<number, number>()
    for (const h of r.hours ?? []) byHour.set(h.hour, (byHour.get(h.hour) ?? 0) + h.sessions)
    const byDow = new Map<number, number>()
    for (const h of r.hours ?? []) byDow.set(h.dow, (byDow.get(h.dow) ?? 0) + h.sessions)
    const best = <K,>(m: Map<K, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    const blocks = [
      `*Detalhes do site ${tracker.name || tracker.domain}* · ${period.label}`,
      `Rejeição: ${pct(r.totals?.bounces ?? 0, sessions)} das visitas; tempo ativo médio: ${sessions ? Math.round((r.totals?.activeMs ?? 0) / 1000) : 0} s por visita (${int(r.totals?.pageviews)} páginas vistas).`,
      section('Por estado', top(r.regions, 10).map((x) => `• ${x.name || x.region}${x.country && x.country !== 'BR' ? ` (${x.country})` : ''}: ${int(x.sessions)} visitas${x.converted ? `, ${int(x.converted)} contato${x.converted > 1 ? 's' : ''}` : ''}`)),
      section('Por cidade', top(r.cities, 10).map((x) => `• ${x.city}${x.region ? `/${x.region}` : ''}: ${int(x.sessions)} visitas${x.converted ? `, ${int(x.converted)} contato${x.converted > 1 ? 's' : ''}` : ''}`)),
      section('Campanhas (UTM)', top(r.campaigns, 6).map((x) => `• ${x.campaign || '(sem nome)'} · ${x.channel}: ${int(x.sessions)} visitas, ${int(x.converted)} contatos`)),
      section('Anúncios que trouxeram visitas', top(r.ads, 6).map((x) => `• ${x.ad || '(sem nome)'}${x.adset ? ` [${x.adset.slice(0, 50)}]` : ''}: ${int(x.sessions)} visitas, ${int(x.converted)} contatos${x.forms ? `, ${int(x.forms)} formulário(s)` : ''}`)),
      section('Páginas mais vistas', top(r.pages, 6).map((x) => `• ${x.path}: ${int(x.views)} views, ${int(x.visitors)} pessoas${x.scroll ? `, rolagem média ${Math.round(x.scroll)}%` : ''}`)),
      section('Páginas de entrada', top(r.landings, 5).map((x) => `• ${x.path}: ${int(x.sessions)} entradas, ${pct(x.bounces, x.sessions)} saíram logo, ${int(x.converted)} contatos`)),
      section('Páginas onde fizeram contato', top(r.conversionPages, 5).map((x) => `• ${x.path}: ${int(x.total)}`)),
      section('Cliques em botões e links', top(r.clicks, 8).map((x) => `• ${x.label || x.name}${x.section ? ` (${x.section})` : ''}: ${int(x.total)}`)),
      section('Eventos', top(r.events, 8).map((x) => `• ${x.name}: ${int(x.total)} em ${int(x.sessions)} visitas`)),
      section('Aparelhos', top(r.devices, 3).map((x) => `• ${x.key || 'Outro'}: ${int(x.sessions)} (${pct(x.sessions, sessions)})`)),
      section('Navegadores e sistemas', [...top(r.browsers, 4).map((x) => `• ${x.key}: ${int(x.sessions)}`), ...top(r.os, 3).map((x) => `• ${x.key}: ${int(x.sessions)}`)]),
      section('Países', top(r.countries, 4).map((x) => `• ${x.key}: ${int(x.sessions)}`)),
      section('Horário e dia de pico', [`• Horas com mais visitas: ${best(byHour, 3).map(([h, n]) => `${h}h (${n})`).join(', ') || '—'}`, `• Dias da semana: ${best(byDow, 3).map(([d, n]) => `${DAYS[d]} (${n})`).join(', ') || '—'}`]),
      section('Páginas não encontradas (404)', top(r.notFound, 4).map((x) => `• ${x.path}: ${int(x.views)}`)),
    ]
    out.push(blocks.filter(Boolean).join('\n\n'))
  }
  return out.join('\n\n')
}

interface Bag {
  spend?: number
  clicks?: number
  linkClicks?: number
  impressions?: number
  leads?: number
  conversations?: number
}
interface AdsReport {
  currency?: string
  campaigns?: { name: string; status?: string; metrics?: Bag; result?: { cost?: number; type?: string; value?: number } }[]
  ads?: { name: string; status?: string; metrics?: Bag; result?: { cost?: number; value?: number } }[]
  regions?: { key: string; metrics?: Bag }[]
  audience?: { age: string; gender: string; metrics?: Bag }[]
  platforms?: { key: string; metrics?: Bag }[]
}

const sumBy = <T,>(rows: T[], key: (r: T) => string, get: (r: T) => Bag | undefined) => {
  const map = new Map<string, Bag>()
  for (const row of rows) {
    const k = key(row)
    const m = get(row) ?? {}
    const cur = map.get(k) ?? {}
    map.set(k, { spend: (cur.spend ?? 0) + (m.spend ?? 0), clicks: (cur.clicks ?? 0) + (m.clicks ?? 0), linkClicks: (cur.linkClicks ?? 0) + (m.linkClicks ?? 0), impressions: (cur.impressions ?? 0) + (m.impressions ?? 0), leads: (cur.leads ?? 0) + (m.leads ?? 0), conversations: (cur.conversations ?? 0) + (m.conversations ?? 0) })
  }
  return [...map.entries()].sort((a, b) => (b[1].spend ?? 0) - (a[1].spend ?? 0))
}

/** Campanhas, anúncios, estados e público dos anúncios da Meta (do relatório salvo para o período) */
export async function anunciosDetalhe(db: Db, teamId: string, period: Period): Promise<string> {
  const { data: accounts } = await db.from('crm_ad_accounts').select('id, name, currency').eq('team_id', teamId).limit(3)
  const out: string[] = []
  for (const account of accounts ?? []) {
    const { data: report } = await db.from('crm_ad_reports').select('data').eq('account_id', account.id).eq('preset', period.preset).maybeSingle()
    const r = report?.data as AdsReport | undefined
    if (!r) continue
    const cur = (account.currency as string) || r.currency || 'BRL'
    const line = (b: Bag | undefined) => `${money(b?.spend, cur)}, ${int(b?.linkClicks ?? b?.clicks)} cliques, ${int(b?.impressions)} impressões${(b?.leads ?? 0) + (b?.conversations ?? 0) ? `, ${int((b?.leads ?? 0) + (b?.conversations ?? 0))} contatos` : ''}`
    const blocks = [
      `*Detalhes dos anúncios ${account.name}* · ${period.preset === 'this_month' ? 'este mês' : period.preset === 'last_7d' ? '7 dias' : period.preset === 'last_30d' ? '30 dias' : '90 dias'}`,
      section('Campanhas', top(r.campaigns, 6).map((c) => `• ${c.name}${c.status ? ` [${c.status === 'ACTIVE' ? 'ativa' : c.status === 'PAUSED' ? 'pausada' : c.status}]` : ''}: ${line(c.metrics)}${c.result?.value ? `; resultado: ${int(c.result.value)}${c.result.cost ? ` a ${money(c.result.cost, cur)} cada` : ''}` : ''}`)),
      section('Anúncios que mais gastaram', top(r.ads, 6).map((a) => `• ${a.name}: ${line(a.metrics)}${a.result?.value ? `; resultado: ${int(a.result.value)}${a.result.cost ? ` a ${money(a.result.cost, cur)}` : ''}` : ''}`)),
      section('Por estado (onde os anúncios foram vistos)', top(sumBy(r.regions ?? [], (x) => x.key, (x) => x.metrics), 8).map(([k, b]) => `• ${k}: ${line(b)}`)),
      section('Público (idade e gênero)', top(sumBy(r.audience ?? [], (x) => `${x.age} ${x.gender === 'female' ? 'mulheres' : x.gender === 'male' ? 'homens' : x.gender}`, (x) => x.metrics), 8).map(([k, b]) => `• ${k}: ${money(b.spend, cur)}, ${int(b.impressions)} impressões`)),
      section('Plataformas', top(sumBy(r.platforms ?? [], (x) => x.key, (x) => x.metrics), 5).map(([k, b]) => `• ${k}: ${line(b)}`)),
    ]
    out.push(blocks.filter(Boolean).join('\n\n'))
  }
  return out.join('\n\n')
}

/** Números completos do Instagram (7 e 30 dias) e o que Meta devolve do público */
export async function instagramDetalhe(db: Db, teamId: string): Promise<string> {
  const { data: accounts } = await db.from('crm_instagram_accounts').select('username, followers_count, follows_count, media_count, totals, audience').eq('team_id', teamId).limit(2)
  const label: Record<string, string> = { reach: 'alcance', views: 'visualizações', likes: 'curtidas', comments: 'comentários', saves: 'salvamentos', shares: 'compartilhamentos', accounts_engaged: 'contas engajadas', total_interactions: 'interações', reach_non_followers: 'alcance fora dos seguidores', profile_links_taps: 'toques nos links do perfil', replies: 'respostas' }
  const out: string[] = []
  for (const a of accounts ?? []) {
    const totals = (a.totals ?? {}) as Record<string, Record<string, number>>
    const blocks = [`*Detalhes do Instagram @${a.username}* · ${int(a.followers_count as number)} seguidores, seguindo ${int(a.follows_count as number)}, ${int(a.media_count as number)} posts`]
    for (const days of ['7', '30']) {
      const t = totals[days]
      if (t) blocks.push(`${days} dias: ${Object.entries(label).filter(([k]) => t[k] !== undefined).map(([k, l]) => `${l} ${int(t[k])}`).join(', ')}`)
    }
    const audience = a.audience as Record<string, unknown> | null
    if (audience && Object.keys(audience).length) blocks.push(`Público: ${JSON.stringify(audience).slice(0, 700)}`)
    out.push(blocks.join('\n'))
  }
  return out.join('\n\n')
}
