import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Comandos por WhatsApp: quem está em `crm_whatsapp_commanders` pergunta ao
 * número da equipe e recebe a resposta na mesma conversa. Só leitura (funil,
 * anúncios, site, projetos); nada aqui muda dado nem manda mensagem a cliente.
 * Quem não está na lista nunca chega até aqui.
 */

export const norm = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const digits = (text: string) => text.replace(/\D/g, '')

/** Compara pelos 8 últimos dígitos: o WhatsApp ora tem o 9 do celular, ora não */
export const samePhone = (a: string, b: string) => {
  const x = digits(a)
  const y = digits(b)
  return x.length >= 8 && y.length >= 8 && x.slice(-8) === y.slice(-8)
}

const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const money = (n: number, currency = 'BRL') => n.toLocaleString('pt-BR', { style: 'currency', currency })
const per = (a: number, b: number) => (b > 0 ? a / b : undefined)

// O Brasil não tem horário de verão desde 2019: o dia de São Paulo começa às 03:00 UTC
const SP = -3
const dayStart = (daysAgo: number) => {
  const now = new Date(Date.now() + SP * 3_600_000)
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo) - SP * 3_600_000
  return new Date(start)
}

type Db = SupabaseClient

const WRITES = new Set(['insert', 'update', 'upsert', 'delete'])
const READ_RPC = new Set(['site_report'])

/**
 * Guard-rail: o que responde a um comando só lê. Escrita em tabela, RPC fora da lista e
 * storage/auth falham aqui, mesmo que uma mudança futura tente.
 */
export function readOnly(db: Db): Db {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) =>
          new Proxy(target.from(table), {
            get(builder, method) {
              if (typeof method === 'string' && WRITES.has(method)) throw new Error(`Comando só lê: ${method} em ${table} bloqueado.`)
              const value = Reflect.get(builder, method)
              return typeof value === 'function' ? value.bind(builder) : value
            },
          })
      }
      if (prop === 'rpc') {
        return (name: string, args?: object) => {
          if (!READ_RPC.has(name)) throw new Error(`Comando só lê: rpc ${name} bloqueada.`)
          return target.rpc(name, args)
        }
      }
      if (prop === 'storage' || prop === 'auth' || prop === 'functions') throw new Error(`Comando só lê: ${String(prop)} bloqueado.`)
      return Reflect.get(target, prop, receiver)
    },
  })
}

export interface Period {
  label: string
  from: Date
  to: Date
  preset: 'last_7d' | 'last_30d' | 'last_90d' | 'this_month'
}

/** "hoje", "ontem", "7", "30", "mês"… (sem nada, 7 dias) */
export function periodOf(text: string): Period {
  const now = new Date()
  if (/\bhoje\b/.test(text)) return { label: 'hoje', from: dayStart(0), to: now, preset: 'last_7d' }
  if (/\bontem\b/.test(text)) return { label: 'ontem', from: dayStart(1), to: dayStart(0), preset: 'last_7d' }
  if (/\b(mes|mensal)\b/.test(text)) {
    const sp = new Date(Date.now() + SP * 3_600_000)
    const from = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1) - SP * 3_600_000)
    return { label: 'este mês', from, to: now, preset: 'this_month' }
  }
  if (/\b90\b/.test(text)) return { label: '90 dias', from: dayStart(89), to: now, preset: 'last_90d' }
  if (/\b30\b/.test(text)) return { label: '30 dias', from: dayStart(29), to: now, preset: 'last_30d' }
  return { label: '7 dias', from: dayStart(6), to: now, preset: 'last_7d' }
}

const HELP = [
  '*O que eu respondo*',
  '• *funil*: cards por etapa e o que mexeu',
  '• *anúncios* [hoje | 7 | 30 | mês]: gasto, resultados e custo',
  '• *site* [hoje | ontem | 7 | 30]: visitas, contatos, origens e quem está online',
  '• *projetos*: os projetos e quando mexeram neles',
  '',
  'Pode escrever do seu jeito: "quanto gastamos com anúncio esse mês?", "quantos acessos hoje?".',
].join('\n')

// ---------- funil ----------

const STAGE_LABEL: Record<string, string> = {
  mapeado: 'Mapeado',
  selecionado: 'Fila da página',
  pagina: 'Página pronta',
  contatado: 'Contatado',
  conversa: 'Em conversa',
  proposta: 'Proposta',
  fechado: 'Fechado',
  perdido: 'Perdido',
}
const STAGE_ORDER = Object.keys(STAGE_LABEL)

export async function funil(db: Db, teamId: string): Promise<string> {
  const { data, error } = await db.from('crm_opportunities').select('stage, offer, updated_at, closed_at').eq('team_id', teamId)
  if (error) return `Não consegui ler o funil: ${error.message}`
  const rows = data ?? []
  if (!rows.length) return 'O funil está vazio.'
  const count = new Map<string, number>()
  for (const r of rows) count.set(r.stage as string, (count.get(r.stage as string) ?? 0) + 1)
  const lines = STAGE_ORDER.filter((s) => count.has(s)).map((s) => `• ${STAGE_LABEL[s]}: ${count.get(s)}`)
  const week = dayStart(6).getTime()
  const moved = rows.filter((r) => new Date(r.updated_at as string).getTime() >= week).length
  const won = rows.filter((r) => r.stage === 'fechado' && r.closed_at && new Date(r.closed_at as string).getTime() >= week).length
  return [`*Funil* (${rows.length} cards)`, ...lines, '', `Nos últimos 7 dias: ${moved} cards mexidos${won ? `, ${won} fechado${won > 1 ? 's' : ''}` : ''}.`].join('\n')
}

// ---------- anúncios ----------

interface AdTotals {
  spend?: number
  impressions?: number
  linkClicks?: number
  leads?: number
  conversations?: number
  reach?: number
}

export async function anuncios(db: Db, teamId: string, period: Period): Promise<string> {
  const { data: accounts, error } = await db.from('crm_ad_accounts').select('id, name, currency').eq('team_id', teamId)
  if (error) return `Não consegui ler os anúncios: ${error.message}`
  if (!accounts?.length) return 'Nenhuma conta de anúncios conectada (CRM › Instagram › Anúncios).'
  const out: string[] = []
  for (const account of accounts) {
    const { data: report } = await db.from('crm_ad_reports').select('data, fetched_at').eq('account_id', account.id).eq('preset', period.preset).maybeSingle()
    const totals = (report?.data as { totals?: AdTotals } | undefined)?.totals
    const currency = (account.currency as string) || 'BRL'
    if (!totals) {
      out.push(`*${account.name}*: sem relatório de ${period.preset === 'this_month' ? 'este mês' : period.label} salvo. Abra a aba Anúncios uma vez para a Meta ser lida.`)
      continue
    }
    const spend = totals.spend ?? 0
    const contacts = (totals.conversations ?? 0) + (totals.leads ?? 0)
    const rows = [
      `*${account.name}* · ${period.preset === 'this_month' ? 'este mês' : period.preset === 'last_7d' ? '7 dias' : period.preset === 'last_30d' ? '30 dias' : '90 dias'}`,
      `• Valor usado: ${money(spend, currency)}`,
      totals.impressions ? `• Impressões: ${int(totals.impressions)}` : '',
      totals.linkClicks ? `• Cliques no link: ${int(totals.linkClicks)}${per(spend, totals.linkClicks) ? ` (${money(per(spend, totals.linkClicks)!, currency)} cada)` : ''}` : '',
      contacts ? `• Contatos (conversas + leads): ${int(contacts)}${per(spend, contacts) ? ` (${money(per(spend, contacts)!, currency)} cada)` : ''}` : '',
    ].filter(Boolean)
    const age = report?.fetched_at ? Math.round((Date.now() - new Date(report.fetched_at as string).getTime()) / 3_600_000) : undefined
    if (age !== undefined && age >= 1) rows.push(`_Lido da Meta há ${age} h._`)
    out.push(rows.join('\n'))
  }
  return out.join('\n\n')
}

// ---------- site ----------

interface SiteTotals {
  sessions?: number
  visitors?: number
  newVisitors?: number
  pageviews?: number
  converted?: number
  bounces?: number
}

export async function site(db: Db, teamId: string, period: Period): Promise<string> {
  const { data: trackers, error } = await db.from('site_trackers').select('id, name, domain').eq('team_id', teamId)
  if (error) return `Não consegui ler o site: ${error.message}`
  if (!trackers?.length) return 'Nenhum site registrado (CRM › Site).'
  const out: string[] = []
  for (const tracker of trackers) {
    const { data: report, error: reportError } = await db.rpc('site_report', { p_site: tracker.id, p_from: period.from.toISOString(), p_to: period.to.toISOString() })
    if (reportError) {
      out.push(`*${tracker.domain}*: ${reportError.message}`)
      continue
    }
    const r = report as { totals?: SiteTotals; previous?: SiteTotals; channels?: { channel: string; sessions: number; converted: number }[] }
    const t = r.totals ?? {}
    const sessions = t.sessions ?? 0
    const { count: online } = await db
      .from('site_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', tracker.id)
      .gte('last_at', new Date(Date.now() - 5 * 60_000).toISOString())
    const lines = [
      `*${tracker.name || tracker.domain}* · ${period.label}`,
      `• Visitas: ${int(sessions)} (${int(t.visitors ?? 0)} pessoas, ${int(t.newVisitors ?? 0)} novas)`,
      `• Páginas vistas: ${int(t.pageviews ?? 0)}`,
      `• Contatos (WhatsApp, telefone, e-mail, formulário): ${int(t.converted ?? 0)}${sessions ? ` · ${((100 * (t.converted ?? 0)) / sessions).toFixed(1).replace('.', ',')}% das visitas` : ''}`,
    ]
    const previous = r.previous?.sessions
    if (previous && period.label !== 'hoje') lines.push(`• Período anterior: ${int(previous)} visitas (${sessions >= previous ? '+' : ''}${Math.round((100 * (sessions - previous)) / previous)}%)`)
    const channels = (r.channels ?? []).slice(0, 4)
    if (channels.length) lines.push(`• Origens: ${channels.map((c) => `${c.channel} ${c.sessions}${c.converted ? ` (${c.converted} contato${c.converted > 1 ? 's' : ''})` : ''}`).join(', ')}`)
    lines.push(`• Online agora: ${online ?? 0}`)
    out.push(lines.join('\n'))
  }
  return out.join('\n\n')
}

// ---------- projetos ----------

const ago = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `há ${minutes} min`
  if (minutes < 1440) return `há ${Math.round(minutes / 60)} h`
  return `há ${Math.round(minutes / 1440)} d`
}

async function projetos(db: Db, teamId: string, text: string): Promise<string> {
  // Projetos do Space são de quem os criou; os da equipe são os dos membros dela
  const { data: members } = await db.from('crm_team_members').select('user_id').eq('team_id', teamId)
  const owners = (members ?? []).map((m) => m.user_id as string)
  if (!owners.length) return 'Não achei projetos da equipe.'
  const { data, error } = await db.from('space_projects').select('id, name, updated_at').in('owner_id', owners).order('updated_at', { ascending: false }).limit(40)
  if (error) return `Não consegui ler os projetos: ${error.message}`
  const rows = data ?? []
  const query = norm(text).replace(/\b(projetos?|status|como|esta|esta o|do|da|de|o|a|andamento|me|diga|qual|quais)\b/g, '').trim()
  const found = query ? rows.filter((p) => norm(p.name as string).includes(query)) : []
  const list = (found.length ? found : rows).slice(0, 10)
  const { data: opps } = await db.from('crm_opportunities').select('project_id, stage, build').eq('team_id', teamId).not('project_id', 'is', null)
  const byProject = new Map((opps ?? []).map((o) => [o.project_id as string, o]))
  const lines = list.map((p) => {
    const opp = byProject.get(p.id as string)
    const build = (opp?.build as { status?: string } | null)?.status
    return `• ${p.name}: mexido ${ago(p.updated_at as string)}${opp ? ` · funil: ${STAGE_LABEL[opp.stage as string] ?? opp.stage}` : ''}${build ? ` · página: ${build}` : ''}`
  })
  return [found.length ? `*Projetos com "${query}"*` : '*Projetos* (os mais recentes)', ...lines].join('\n')
}

// ---------- entrada ----------

/** A resposta ao que a pessoa escreveu, ou `undefined` quando não é um pedido que eu entenda */
export async function answer(rawDb: Db, teamId: string, rawText: string): Promise<string> {
  const db = readOnly(rawDb)
  const text = norm(rawText)
  const period = periodOf(text)
  try {
    if (/^(ajuda|help|menu|comandos|oi|ola)\b/.test(text) || text === '?') return HELP
    if (/(anuncio|marketing|meta ads|google ads|gast|custo|invest|campanha|cpc|cpl)/.test(text)) return await anuncios(db, teamId, period)
    if (/(site|acesso|visita|visitante|online|trafego|analytics)/.test(text)) return await site(db, teamId, period)
    if (/(funil|oportunidade|card|lead|prospec|cliente|venda|fechad)/.test(text)) return await funil(db, teamId)
    if (/(projeto|status|andamento|pagina|home)/.test(text)) return await projetos(db, teamId, text)
  } catch (error) {
    return `Deu erro ao buscar isso: ${error instanceof Error ? error.message : String(error)}`
  }
  return `Não entendi. ${HELP}`
}
