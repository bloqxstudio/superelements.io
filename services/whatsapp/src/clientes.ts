import type { SupabaseClient } from '@supabase/supabase-js'
import { anuncios, funil, norm, periodOf, readOnly, site, type Period } from './comandos.ts'
import { aiEnabled, askAi, findClaude } from './ia.ts'

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

/** A resposta ao que o cliente escreveu e o assunto atendido (para o registro) */
export async function answerClient(rawDb: Db, contact: ClientContact, rawText: string, history: { fromMe: boolean; text: string }[] = []): Promise<{ reply: string; topic?: Topic; ai?: boolean }> {
  const db = readOnly(rawDb)
  const { data: account } = await rawDb.from('crm_teams').select('name, status, modules, is_home').eq('id', contact.accountId).maybeSingle()
  if (!account) return { reply: 'Não achei a sua conta. Fale com a Avence.' }
  if (account.status === 'pausada') return { reply: 'A sua conta está pausada. Fale com a Avence.' }
  const modules = (account.modules ?? {}) as Record<string, boolean>
  const allowed = contact.topics.filter((t) => modules[MODULE[t]] !== false)
  const first = contact.name.split(' ')[0]
  const menu = [
    `Oi${first ? `, ${first}` : ''}! Aqui são os dados da conta *${account.name}*. Responda com o número:`,
    ...allowed.map((t) => `${NUMBER[t]}. ${LABEL[t]}`),
    '',
    'Pode acrescentar o período: hoje, ontem, 7, 30 ou mês (ex.: "2 mês").',
  ].join('\n')
  if (!allowed.length) return { reply: 'Ainda não há nada liberado para o seu número. Fale com a Avence.' }

  const text = norm(rawText)
  const byNumber = text.match(/^([1-9])\b/)
  // Os números são fixos: o 2 é sempre anúncios, mesmo quando o 1 está desligado
  const picked = byNumber ? (Object.keys(NUMBER) as Topic[]).find((t) => NUMBER[t] === Number(byNumber[1])) : undefined
  let topic: Topic | undefined = picked && allowed.includes(picked) ? picked : undefined
  if (!topic && !byNumber) {
    topic = WORDS.find(([, re]) => re.test(text))?.[0]
    if (topic && !allowed.includes(topic)) return { reply: `Esse assunto não está liberado para o seu número.\n\n${menu}` }
  }
  if (!topic) {
    // Sem número nem palavra de assunto: a IA do computador responde com os dados liberados para a pessoa.
    // Número solto ("9") e falha da IA caem no menu.
    if (!byNumber && aiEnabled() && findClaude()) {
      try {
        const period = periodOf(text)
        const parts: string[] = []
        for (const t of allowed) {
          try {
            parts.push(clean(await read(db, t, contact.accountId, period, account.is_home === true, text)))
          } catch {
            // Um assunto que falha não derruba a resposta
          }
        }
        const reply = await askAi({ accountName: account.name as string, firstName: first, question: rawText, data: parts.join('\n\n'), history })
        return { reply, ai: true }
      } catch (error) {
        console.error(`ia ${contact.phone.slice(-4)}: ${error instanceof Error ? error.message : error}`)
      }
    }
    return { reply: menu }
  }

  const period = periodOf(text)
  try {
    const raw = await read(db, topic, contact.accountId, period, account.is_home === true, text)
    return { reply: clean(raw), topic }
  } catch (error) {
    console.error(`cliente ${contact.phone.slice(-4)}: ${error instanceof Error ? error.message : error}`)
    return { reply: GENERIC_ERROR, topic }
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
