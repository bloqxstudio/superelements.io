import type { SupabaseClient } from '@supabase/supabase-js'
import { anuncios, funil, norm, periodOf, readOnly, site, type Period } from './comandos.ts'
import { CHART_KINDS, makeChart, type ChartKind } from './graficos.ts'
import { aiEnabled, answerAi, findClaude, planAi, type AiContext, type Turn } from './ia.ts'

/**
 * Central de relacionamento: quem está em `crm_whatsapp_client_contacts` escreve para o
 * número da Avence e recebe os dados da PRÓPRIA conta (site, anúncios, funil). Guard-rails:
 * a conta vem do cadastro, nunca da mensagem; só os assuntos liberados e os módulos ligados
 * na conta; só leitura; erros internos nunca chegam ao cliente.
 */

type Db = SupabaseClient

export type Topic = 'site' | 'anuncios' | 'funil' | 'instagram' | 'posts' | 'caixa' | 'projetos'

export interface ClientContact {
  phone: string
  accountId: string
  name: string
  topics: Topic[]
}

/** Todos os assuntos: o comandante da equipe vê todos, sem depender do cadastro */
export const ALL_TOPICS: Topic[] = ['site', 'anuncios', 'funil', 'instagram', 'posts', 'caixa', 'projetos']

/** Cada assunto depende de um módulo da conta (`src/features/crm/modules.ts`) */
const MODULE: Record<Topic, string> = { site: 'site', anuncios: 'instagram', funil: 'crm', instagram: 'instagram', posts: 'instagram', caixa: 'instagram', projetos: 'projetos' }
const LABEL: Record<Topic, string> = {
  site: 'Site (visitas e contatos)',
  anuncios: 'Anúncios (gasto e resultados)',
  funil: 'Funil de vendas',
  instagram: 'Instagram (seguidores e alcance)',
  posts: 'Melhores posts',
  caixa: 'Comentários e mensagens em aberto',
  projetos: 'Projetos e andamento',
}
/** Palavras que levam a cada assunto, na ordem em que valem */
const WORDS: [Topic, RegExp][] = [
  ['posts', /(post|reel|story|stories|publicac)/],
  ['caixa', /(comentario|mensagem|direct|\bdm\b|caixa)/],
  ['instagram', /(instagram|seguidor|alcance|perfil)/],
  ['anuncios', /(anuncio|marketing|gast|custo|invest|campanha|meta ads|google ads)/],
  ['site', /(site|acesso|visita|visitante|online|trafego)/],
  ['funil', /(funil|oportunidade|card|prospec|lead|venda|fechad)/],
  ['projetos', /(projeto|andamento|pagina|status)/],
]

/** Os números do menu são fixos: o 2 é sempre anúncios, mesmo com o 1 desligado */
const NUMBER: Record<Topic, number> = { site: 1, anuncios: 2, funil: 3, instagram: 4, posts: 5, caixa: 6, projetos: 7 }

const GENERIC_ERROR = 'Não consegui buscar isso agora. A equipe da Avence foi avisada.'

/** Tira do texto o que é instrução interna da equipe */
function clean(text: string): string {
  if (/^(Não consegui|Deu erro)/m.test(text)) return GENERIC_ERROR
  return text
    .replace(/Abra a aba Anúncios uma vez para a Meta ser lida\./g, 'A equipe ainda vai atualizar esse período.')
    .replace(/Nenhuma conta de anúncios conectada \(CRM › Instagram › Anúncios\)\./g, 'Ainda não há conta de anúncios conectada.')
    .replace(/Nenhum site registrado \(CRM › Site\)\./g, 'Ainda não há site conectado.')
    .replace(/^\*(.+?)\*: (?!sem relatório).*$/gm, (line) => (/Falta|rpc|function|relation|permission/i.test(line) ? GENERIC_ERROR : line))
}

const int = (n: number | undefined) => Math.round(n ?? 0).toLocaleString('pt-BR')
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

async function instagram(db: Db, accountId: string, period: Period): Promise<string> {
  const { data: accounts, error } = await db.from('crm_instagram_accounts').select('id, username, followers_count, media_count, totals, synced_at').eq('team_id', accountId)
  if (error) return `Não consegui ler: ${error.message}`
  if (!accounts?.length) return 'Ainda não há Instagram conectado.'
  const key = period.preset === 'last_30d' || period.preset === 'this_month' || period.preset === 'last_90d' ? '30' : '7'
  const out: string[] = []
  for (const a of accounts) {
    const t = ((a.totals ?? {}) as Record<string, Record<string, number> | undefined>)[key] ?? {}
    const since = new Date(Date.now() - Number(key) * 86_400_000).toISOString().slice(0, 10)
    const { data: days } = await db.from('crm_instagram_daily').select('day, followers').eq('account_id', a.id).gte('day', since).not('followers', 'is', null).order('day')
    const first = days?.[0]?.followers as number | undefined
    const gain = first !== undefined && a.followers_count != null ? (a.followers_count as number) - first : undefined
    out.push(
      [
        `*@${a.username}* · ${key} dias`,
        `• Seguidores: ${int(a.followers_count as number)}${gain !== undefined ? ` (${gain >= 0 ? '+' : ''}${int(gain)} no período)` : ''}`,
        t.reach != null ? `• Alcance: ${int(t.reach)}` : '',
        t.views != null ? `• Visualizações: ${int(t.views)}` : '',
        t.total_interactions != null ? `• Interações: ${int(t.total_interactions)}` : '',
        t.profile_links_taps ? `• Toques no link do perfil: ${int(t.profile_links_taps)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }
  return out.join('\n\n')
}

async function posts(db: Db, accountId: string): Promise<string> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await db.from('crm_instagram_media').select('product_type, posted_at, permalink, insights').eq('team_id', accountId).gte('posted_at', since).neq('product_type', 'STORY')
  if (error) return `Não consegui ler: ${error.message}`
  const rows = (data ?? []).map((r) => ({ ...r, reach: Number((r.insights as Record<string, number>)?.reach ?? 0), inter: Number((r.insights as Record<string, number>)?.total_interactions ?? 0) })).sort((a, b) => b.reach - a.reach).slice(0, 5)
  if (!rows.length) return 'Nenhum post nos últimos 30 dias.'
  const label: Record<string, string> = { FEED: 'Feed', REELS: 'Reels' }
  return ['*Melhores posts* · 30 dias (por alcance)', ...rows.map((r) => `• ${label[r.product_type as string] ?? 'Post'} de ${day(r.posted_at as string)}: alcance ${int(r.reach)}, interações ${int(r.inter)}${r.permalink ? `\n  ${r.permalink}` : ''}`)].join('\n')
}

async function caixa(db: Db, accountId: string): Promise<string> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ count: comments, error }, { data: threads }] = await Promise.all([
    db.from('crm_instagram_comments').select('comment_id', { count: 'exact', head: true }).eq('team_id', accountId).eq('handled', false).eq('own', false).gte('ts', since),
    db.from('crm_instagram_threads').select('unread').eq('team_id', accountId),
  ])
  if (error) return `Não consegui ler: ${error.message}`
  const unread = (threads ?? []).reduce((sum, t) => sum + Number(t.unread ?? 0), 0)
  return ['*Caixa do Instagram*', `• Comentários em aberto (30 dias): ${int(comments ?? 0)}`, `• Mensagens diretas não lidas: ${int(unread)}`].join('\n')
}

async function projetos(db: Db, accountId: string, isHome: boolean, text = ''): Promise<string> {
  // Os projetos sem conta (todos os antigos) são da conta da casa
  const query = db.from('space_projects').select('name, updated_at')
  const { data, error } = await (isHome ? query.or(`team_id.eq.${accountId},team_id.is.null`) : query.eq('team_id', accountId)).order('updated_at', { ascending: false }).limit(10)
  if (error) return `Não consegui ler: ${error.message}`
  if (!data?.length) return 'Ainda não há projetos na sua conta.'
  // "projetos zena": só os que têm o nome
  const word = norm(text).replace(/\b(projetos?|status|como|esta|andamento|me|diga|qual|quais|do|da|de|o|a|\d+)\b/g, '').trim()
  const found = word ? data.filter((p) => norm(p.name as string).includes(word)) : []
  const ago = (iso: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
    return minutes < 60 ? `há ${minutes} min` : minutes < 1440 ? `há ${Math.round(minutes / 60)} h` : `há ${Math.round(minutes / 1440)} d`
  }
  return [found.length ? `*Projetos com "${word}"*` : '*Projetos*', ...(found.length ? found : data).map((p) => `• ${p.name}: atualizado ${ago(p.updated_at as string)}`)].join('\n')
}

const read = (db: Db, topic: Topic, accountId: string, period: Period, isHome = false, text = ''): Promise<string> =>
  topic === 'site' ? site(db, accountId, period)
  : topic === 'anuncios' ? anuncios(db, accountId, period)
  : topic === 'funil' ? funil(db, accountId)
  : topic === 'instagram' ? instagram(db, accountId, period)
  : topic === 'posts' ? posts(db, accountId)
  : topic === 'caixa' ? caixa(db, accountId)
  : projetos(db, accountId, isHome, text)

const SP_OFFSET = '-03:00'
const spDate = (text: string, fallback: Date) => {
  const d = new Date(`${text.slice(0, 16)}:00${SP_OFFSET}`)
  return Number.isNaN(d.getTime()) ? fallback : d
}

/** Período exato pedido pela conversa; anúncios e Instagram só guardam relatórios por dia (preset mais próximo) */
function periodBetween(from: Date, to: Date): Period {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))
  const sp = new Date(to.getTime() - 3 * 3_600_000)
  const monthStart = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1) + 3 * 3_600_000)
  const preset: Period['preset'] = Math.abs(from.getTime() - monthStart.getTime()) < 86_400_000 && days > 7 ? 'this_month' : days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d'
  const fmt = (d: Date) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  return { label: `${fmt(from)} a ${fmt(to)}`, from, to, preset }
}

const TOPICS = Object.keys(NUMBER) as Topic[]

/**
 * A conversa com quem escreveu: a IA do computador lê a conversa, decide o que consultar (e o período
 * exato), lê os dados da PRÓPRIA conta (só leitura, só os assuntos liberados) e responde em linguagem natural.
 * Sem menu nem palavras-chave. Se a IA não estiver disponível, uma frase simples (nunca um menu).
 */
export async function answerClient(rawDb: Db, contact: ClientContact, rawText: string, history: Turn[] = []): Promise<{ reply: string; topic?: Topic; ai?: boolean; image?: Buffer }> {
  const db = readOnly(rawDb)
  const { data: account } = await rawDb.from('crm_teams').select('name, status, modules, is_home').eq('id', contact.accountId).maybeSingle()
  if (!account) return { reply: 'Não achei a sua conta. Fale com a Avence.' }
  if (account.status === 'pausada') return { reply: 'A sua conta está pausada. Fale com a Avence.' }
  const modules = (account.modules ?? {}) as Record<string, boolean>
  const allowed = contact.topics.filter((t) => modules[MODULE[t]] !== false)
  if (!allowed.length) return { reply: 'Ainda não há nada liberado para o seu número. Fale com a Avence.' }
  if (!aiEnabled() || !findClaude()) return { reply: 'Não consegui te atender automaticamente agora. Me manda de novo daqui a pouco, ou fale direto com a equipe da Avence.' }

  const ctx: AiContext = { accountName: account.name as string, firstName: contact.name.split(' ')[0] ?? '', abilities: allowed.map((t) => LABEL[t]), history, question: rawText }
  try {
    const plan = await planAi(ctx)
    const queries = plan.queries.filter((q) => TOPICS.includes(q.topic as Topic) && allowed.includes(q.topic as Topic)).slice(0, 4)
    if (!queries.length) {
      if (plan.reply) return { reply: plan.reply, ai: true }
      return { reply: await answerAi(ctx, ''), ai: true }
    }
    const parts: string[] = []
    let chartPeriod: Period | undefined
    for (const q of queries) {
      const now = new Date()
      const to = new Date(Math.min(spDate(q.to, now).getTime(), now.getTime()))
      const from = spDate(q.from, new Date(to.getTime() - 7 * 86_400_000))
      try {
        const period = periodBetween(from, to > from ? to : now)
        if (q.topic === (plan.chart === 'anuncios_dia' ? 'anuncios' : 'site')) chartPeriod ??= period
        parts.push(clean(await read(db, q.topic as Topic, contact.accountId, period, account.is_home === true, q.search ?? '')))
      } catch (error) {
        console.error(`consulta ${q.topic}: ${error instanceof Error ? error.message : error}`)
      }
    }
    const reply = await answerAi(ctx, parts.join('\n\n'))
    // Gráfico em imagem, quando a conversa pediu e o assunto está liberado; sem dados, só o texto
    let image: Buffer | undefined
    const kind = plan.chart as ChartKind
    if (CHART_KINDS.includes(kind) && chartPeriod && allowed.includes(kind === 'anuncios_dia' ? 'anuncios' : 'site')) {
      image = await makeChart(db, contact.accountId, kind, chartPeriod).catch((e) => (console.error(`gráfico ${kind}: ${e instanceof Error ? e.message : e}`), undefined))
    }
    return { reply, topic: queries[0].topic as Topic, ai: true, image }
  } catch (error) {
    console.error(`ia ${contact.phone.slice(-4)}: ${error instanceof Error ? error.message : error}`)
    return { reply: 'Não consegui te responder agora. Me manda de novo daqui a pouco, ou fale direto com a equipe da Avence.' }
  }
}

/** O resumo agendado de um número cadastrado: os assuntos liberados dele, com os dados da conta dele */
export async function clientReport(rawDb: Db, contact: ClientContact, kind: 'diario' | 'semanal'): Promise<string | undefined> {
  const db = readOnly(rawDb)
  const { data: account } = await rawDb.from('crm_teams').select('name, status, modules, is_home').eq('id', contact.accountId).maybeSingle()
  if (!account || account.status === 'pausada') return undefined
  const modules = (account.modules ?? {}) as Record<string, boolean>
  const topics = contact.topics.filter((t) => modules[MODULE[t]] !== false)
  if (!topics.length) return undefined
  const days = (daily: string, weekly: string) => periodOf(kind === 'diario' ? daily : weekly)
  const parts: string[] = []
  for (const topic of topics) {
    // Site olha o dia anterior no diário; anúncios e Instagram olham a semana (o mês no semanal)
    const period = topic === 'site' ? days('ontem', '7') : days('7', '30')
    try {
      parts.push(clean(await read(db, topic, contact.accountId, period, account.is_home === true)))
    } catch (error) {
      console.error(`relatório ${contact.phone.slice(-4)} ${topic}: ${error instanceof Error ? error.message : error}`)
    }
  }
  if (!parts.length) return undefined
  const first = contact.name.split(' ')[0]
  return [`*${kind === 'diario' ? 'Resumo do dia' : 'Resumo da semana'}* · ${account.name}${first ? ` · ${first}` : ''}`, ...parts].join('\n\n')
}

export type ReportKind = 'diario' | 'semanal' | 'mensal'

const REPORT_NAME: Record<ReportKind, string> = { diario: 'o resumo de ontem', semanal: 'o resumo da última semana', mensal: 'o resumo do mês' }

/**
 * O relatório agendado de um cliente: 2 ou 3 frases escritas pela IA com os dados da conta dele
 * (comparando com o período anterior) e um gráfico quadrado do site (ou do gasto, sem site).
 * Sem IA, cai no resumo de texto de `clientReport`.
 */
export async function clientReportMessage(rawDb: Db, contact: ClientContact, kind: ReportKind): Promise<{ text: string; image?: Buffer } | undefined> {
  const fallback = async () => {
    const text = await clientReport(rawDb, contact, kind === 'mensal' ? 'semanal' : kind)
    return text ? { text: text.slice(0, 3500) } : undefined
  }
  if (!aiEnabled() || !findClaude()) return fallback()
  const db = readOnly(rawDb)
  const { data: account } = await rawDb.from('crm_teams').select('name, status, modules, is_home').eq('id', contact.accountId).maybeSingle()
  if (!account || account.status === 'pausada') return undefined
  const modules = (account.modules ?? {}) as Record<string, boolean>
  const topics = contact.topics.filter((t) => modules[MODULE[t]] !== false)
  if (!topics.length) return undefined
  const word = kind === 'diario' ? ['ontem', '7', '7'] : kind === 'semanal' ? ['7', '7', '7'] : ['mês', 'mês', 'mês']
  try {
    const parts: string[] = []
    for (const topic of topics) {
      const text = topic === 'site' ? word[0] : topic === 'anuncios' ? word[1] : word[2]
      try {
        parts.push(clean(await read(db, topic, contact.accountId, periodOf(text), account.is_home === true)))
      } catch (error) {
        console.error(`relatório ${contact.phone.slice(-4)} ${topic}: ${error instanceof Error ? error.message : error}`)
      }
    }
    if (!parts.length) return fallback()
    const ctx: AiContext = {
      accountName: account.name as string,
      firstName: contact.name.split(' ')[0] ?? '',
      abilities: topics.map((t) => LABEL[t]),
      history: [],
      question: `Escreva ${REPORT_NAME[kind]} para o cliente, que vai receber sem ter pedido: cumprimente pelo nome, diga o que mais importa em 2 ou 3 frases curtas com os números (compare com o período anterior quando os dados trouxerem) e feche dizendo que ele pode responder para ver mais.`,
    }
    const text = (await answerAi(ctx, parts.join('\n\n'))).slice(0, 900)
    const chartKind: ChartKind | undefined = topics.includes('site') ? 'site_dia' : topics.includes('anuncios') ? 'anuncios_dia' : undefined
    const image = chartKind ? await makeChart(db, contact.accountId, chartKind, chartKind === 'site_dia' && kind === 'mensal' ? periodOf('mês') : periodOf(chartKind === 'site_dia' ? '7' : kind === 'mensal' ? 'mês' : '7')).catch(() => undefined) : undefined
    return { text, image }
  } catch (error) {
    console.error(`relatório IA ${contact.phone.slice(-4)}: ${error instanceof Error ? error.message : error}`)
    return fallback()
  }
}
