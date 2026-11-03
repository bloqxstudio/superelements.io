import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Os números da conta para a IA analisar: site, anúncios da Meta, Instagram e funil. Só leitura,
 * sempre filtrado pela conta da chave. Volta JSON enxuto (listas cortadas), sem telefone nem e-mail
 * de clientes: a IA analisa, não exporta contatos.
 */

type Db = SupabaseClient
const SP = -3

export interface Period {
  label: string
  from: Date
  to: Date
  /** Relatório salvo dos Anúncios: last_7d, last_30d, last_90d, this_month ou dia:AAAA-MM-DD. */
  preset: string
  /** Janela do Instagram que a Meta dá (7 ou 30 dias). */
  igDays: '7' | '30'
}

const dayStart = (daysAgo: number) => {
  const sp = new Date(Date.now() + SP * 3_600_000)
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - daysAgo) - SP * 3_600_000)
}
const isoDay = (d: Date) => new Date(d.getTime() + SP * 3_600_000).toISOString().slice(0, 10)

/** "hoje", "ontem", "7", "30", "90", "mes" ou "AAAA-MM-DD" (um dia). Sem nada: 30 dias. */
export function periodOf(raw: unknown): Period {
  const text = String(raw ?? '30').trim().toLowerCase()
  const now = new Date()
  const day = /^(?:dia:)?(\d{4}-\d{2}-\d{2})$/.exec(text)
  if (day) {
    const from = new Date(`${day[1]}T03:00:00Z`)
    return { label: `dia ${day[1]}`, from, to: new Date(from.getTime() + 86_400_000), preset: `dia:${day[1]}`, igDays: '7' }
  }
  if (text === 'hoje') return { label: 'hoje', from: dayStart(0), to: now, preset: `dia:${isoDay(now)}`, igDays: '7' }
  if (text === 'ontem') return { label: 'ontem', from: dayStart(1), to: dayStart(0), preset: `dia:${isoDay(dayStart(1))}`, igDays: '7' }
  if (/^(mes|mês|this_month)$/.test(text)) {
    const sp = new Date(Date.now() + SP * 3_600_000)
    return { label: 'este mês', from: new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1) - SP * 3_600_000), to: now, preset: 'this_month', igDays: '30' }
  }
  if (/^(90|last_90d)$/.test(text)) return { label: '90 dias', from: dayStart(89), to: now, preset: 'last_90d', igDays: '30' }
  if (/^(7|last_7d)$/.test(text)) return { label: '7 dias', from: dayStart(6), to: now, preset: 'last_7d', igDays: '7' }
  return { label: '30 dias', from: dayStart(29), to: now, preset: 'last_30d', igDays: '30' }
}

const top = <T>(list: T[] | undefined, n: number) => (list ?? []).slice(0, n)

export async function siteData(db: Db, teamId: string, period: Period) {
  const { data: trackers, error } = await db.from('site_trackers').select('id, name, domain').eq('team_id', teamId).limit(3)
  if (error) throw new Error('Não consegui ler os sites da conta.')
  if (!trackers?.length) return { periodo: period.label, aviso: 'Nenhum site conectado (Sinfy › Site › Instalação).' }
  const sites = []
  for (const t of trackers) {
    const { data, error: e } = await db.rpc('site_report', { p_site: t.id, p_from: period.from.toISOString(), p_to: period.to.toISOString() })
    if (e || !data) {
      sites.push({ site: t.domain, erro: 'Relatório indisponível agora.' })
      continue
    }
    const r = data as Record<string, unknown[] | Record<string, unknown> | string | undefined>
    sites.push({
      site: t.domain,
      nome: t.name,
      totais: r.totals,
      periodo_anterior: r.previous,
      moeda: r.currency,
      por_dia: r.days,
      canais: top(r.channels as unknown[], 12),
      campanhas: top(r.campaigns as unknown[], 12),
      anuncios: top(r.ads as unknown[], 12),
      paginas: top(r.pages as unknown[], 15),
      entradas: top(r.landings as unknown[], 10),
      paginas_de_contato: top(r.conversionPages as unknown[], 8),
      cliques: top(r.clicks as unknown[], 15),
      eventos: top(r.events as unknown[], 15),
      aparelhos: top(r.devices as unknown[], 5),
      estados: top(r.regions as unknown[], 12),
      cidades: top(r.cities as unknown[], 12),
      horarios: r.hours,
      produtos: top(r.products as unknown[], 15),
      nao_encontradas: top(r.notFound as unknown[], 8),
    })
  }
  return { periodo: period.label, de: period.from.toISOString(), ate: period.to.toISOString(), sites }
}

interface Bag { spend?: number; clicks?: number; linkClicks?: number; impressions?: number; reach?: number; leads?: number; conversations?: number }

const slimCampaign = (c: Record<string, unknown>) => ({ nome: c.name, id: c.id, status: c.status, objetivo: c.objective, inicio: c.start, orcamento_diario: c.dailyBudget, metricas: c.metrics })

export async function adsData(db: Db, teamId: string, period: Period) {
  const { data: accounts, error } = await db.from('crm_ad_accounts').select('id, name, currency').eq('team_id', teamId).limit(3)
  if (error) throw new Error('Não consegui ler as contas de anúncios.')
  if (!accounts?.length) return { periodo: period.label, aviso: 'Nenhuma conta de anúncios conectada (Sinfy › Anúncios).' }
  const out = []
  for (const a of accounts) {
    const { data: report } = await db.from('crm_ad_reports').select('data, fetched_at').eq('account_id', a.id).eq('preset', period.preset).maybeSingle()
    const r = report?.data as Record<string, unknown> | undefined
    if (!r) {
      out.push({ conta: a.name, aviso: `Sem relatório salvo para ${period.label}. Abra a aba Anúncios nesse período uma vez para a Meta ser lida.` })
      continue
    }
    const sum = (rows: { key?: string; age?: string; gender?: string; metrics?: Bag }[], key: (x: { key?: string; age?: string; gender?: string }) => string) => {
      const map = new Map<string, Bag>()
      for (const row of rows) {
        const k = key(row)
        const m = row.metrics ?? {}
        const cur = map.get(k) ?? {}
        map.set(k, { spend: (cur.spend ?? 0) + (m.spend ?? 0), impressions: (cur.impressions ?? 0) + (m.impressions ?? 0), linkClicks: (cur.linkClicks ?? 0) + (m.linkClicks ?? m.clicks ?? 0), leads: (cur.leads ?? 0) + (m.leads ?? 0), conversations: (cur.conversations ?? 0) + (m.conversations ?? 0) })
      }
      return [...map.entries()].sort((x, y) => (y[1].spend ?? 0) - (x[1].spend ?? 0)).slice(0, 12).map(([k, v]) => ({ chave: k, ...v }))
    }
    const campaigns = (r.campaigns ?? []) as Record<string, unknown>[]
    const regions = (r.regions ?? []) as { key?: string; metrics?: Bag }[]
    const audience = (r.audience ?? []) as { age?: string; gender?: string; metrics?: Bag }[]
    const platforms = (r.platforms ?? []) as { key?: string; metrics?: Bag }[]
    out.push({
      conta: a.name,
      moeda: a.currency || r.currency || 'BRL',
      lido_em: report?.fetched_at,
      totais: r.totals,
      por_dia: r.days,
      campanhas: top(campaigns, 20).map(slimCampaign),
      anuncios: top((r.ads ?? []) as Record<string, unknown>[], 20).map((x) => ({ nome: x.name, campanha: x.campaignName, conjunto: x.adsetName, metricas: x.metrics })),
      estados: sum(regions, (x) => x.key ?? '?'),
      publico: sum(audience, (x) => `${x.age ?? '?'} ${x.gender ?? ''}`.trim()),
      plataformas: sum(platforms, (x) => x.key ?? '?'),
    })
  }
  return { periodo: period.label, contas: out }
}

export async function instagramData(db: Db, teamId: string, period: Period) {
  const { data: accounts, error } = await db.from('crm_instagram_accounts').select('id, username, name, biography, followers_count, follows_count, media_count, totals, audience, synced_at').eq('team_id', teamId).limit(2)
  if (error) throw new Error('Não consegui ler o Instagram da conta.')
  if (!accounts?.length) return { aviso: 'Nenhum Instagram conectado (Sinfy › Instagram).' }
  const since = period.from.toISOString()
  const out = []
  for (const a of accounts) {
    const [{ data: days }, { data: media }] = await Promise.all([
      db.from('crm_instagram_daily').select('day, followers, reach').eq('account_id', a.id).gte('day', isoDay(period.from)).order('day'),
      db.from('crm_instagram_media').select('media_type, product_type, caption, permalink, posted_at, like_count, comments_count, insights').eq('account_id', a.id).gte('posted_at', since).order('posted_at', { ascending: false }).limit(60),
    ])
    const posts = (media ?? [])
      .map((m) => ({ formato: m.product_type === 'REELS' ? 'reels' : m.product_type === 'STORY' ? 'story' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'feed', data: m.posted_at, legenda: String(m.caption ?? '').slice(0, 280), link: m.permalink, curtidas: m.like_count, comentarios: m.comments_count, insights: m.insights }))
      .sort((x, y) => Number((y.insights as Record<string, number>)?.reach ?? 0) - Number((x.insights as Record<string, number>)?.reach ?? 0))
    out.push({
      perfil: `@${a.username}`,
      nome: a.name,
      bio: a.biography,
      seguidores: a.followers_count,
      seguindo: a.follows_count,
      posts_total: a.media_count,
      lido_em: a.synced_at,
      [`totais_${period.igDays}_dias`]: ((a.totals ?? {}) as Record<string, unknown>)[period.igDays],
      publico: a.audience,
      por_dia: days,
      posts_do_periodo_por_alcance: posts.slice(0, 25),
    })
  }
  return { periodo: period.label, contas: out }
}

const STAGES: Record<string, string> = { novo: 'Novo lead', mapeado: 'Mapeado', selecionado: 'Fila da página', pagina: 'Página pronta', contatado: 'Contatado', conversa: 'Em conversa', proposta: 'Proposta', fechado: 'Fechado', perdido: 'Perdido' }

export async function funnelData(db: Db, teamId: string, period: Period) {
  const { data, error } = await db
    .from('crm_opportunities')
    .select('id, stage, offer, origin, next_step, next_date, created_at, closed_at, crm_clients(name, segment, city, source)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error('Não consegui ler o funil da conta.')
  const rows = data ?? []
  const byStage: Record<string, { cartoes: number; valor: number }> = {}
  for (const r of rows) {
    const label = STAGES[r.stage as string] ?? (r.stage as string)
    const price = Number((r.offer as { price?: number } | null)?.price ?? 0)
    byStage[label] = { cartoes: (byStage[label]?.cartoes ?? 0) + 1, valor: (byStage[label]?.valor ?? 0) + (Number.isFinite(price) ? price : 0) }

  }
  const inPeriod = rows.filter((r) => new Date(r.created_at as string) >= period.from)
  const channels: Record<string, number> = {}
  for (const r of inPeriod) {
    const ch = ((r.origin as { channel?: string } | null)?.channel) ?? 'sem origem'
    channels[ch] = (channels[ch] ?? 0) + 1
  }
  return {
    periodo: period.label,
    por_etapa: byStage,
    novos_no_periodo: inPeriod.length,
    novos_por_canal: channels,
    fechados_no_periodo: rows.filter((r) => r.stage === 'fechado' && r.closed_at && new Date(r.closed_at as string) >= period.from).length,
    recentes: inPeriod.slice(0, 25).map((r) => {
      const c = r.crm_clients as { name?: string; segment?: string; city?: string; source?: string } | null
      const o = r.origin as { channel?: string; campaign?: { name?: string }; page?: string; utm?: Record<string, string> } | null
      return { id: r.id, empresa: c?.name, segmento: c?.segment, cidade: c?.city, etapa: STAGES[r.stage as string] ?? r.stage, canal: o?.channel, campanha: o?.campaign?.name ?? o?.utm?.utm_campaign, pagina: o?.page, proximo_passo: r.next_step, criado_em: r.created_at }
    }),
  }
}
