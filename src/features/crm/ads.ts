import { supabase } from '@/integrations/supabase/client'
import { publicAppUrl } from '@/features/approval/shares'

/**
 * Os anúncios da equipe (tela `/crm/anuncios`): as contas de
 * anúncios da Meta ligadas à equipe e o relatório de cada período
 * (investimento, contatos, campanhas, plataformas, público, anúncios). Quem
 * fala com a Meta é a função `meta-ads` do Supabase (o token fica só lá);
 * daqui se leem as tabelas que ela grava (`crm_ad_accounts`, `crm_ad_reports`)
 * e se pede cada ação. Só leitura: nada muda campanha nem orçamento.
 */

export const ADS_CALLBACK_PATH = '/anuncios/retorno'

export type AdPreset = 'last_7d' | 'last_30d' | 'last_90d' | 'this_month'
export const AD_PRESETS: AdPreset[] = ['last_7d', 'last_30d', 'last_90d', 'this_month']
export const PRESET_LABEL: Record<AdPreset, string> = { last_7d: '7 dias', last_30d: '30 dias', last_90d: '90 dias', this_month: 'Este mês' }

export interface AdMetrics {
  spend: number
  impressions: number
  /** Não soma entre dias, idades ou gêneros: só vem onde a Meta conta. */
  reach?: number
  frequency?: number
  clicks: number
  linkClicks: number
  /** Formulário da Meta e cadastro no site (pixel). */
  leads: number
  /** Conversas iniciadas no WhatsApp, Direct ou Messenger. */
  conversations: number
  actions?: Record<string, number>
}

export interface AdResult {
  /** Ação da Meta (`lead`, `link_click`…) ou `reach` */
  type: string
  value: number
  cost?: number
}

export interface AdCampaign {
  id: string
  name: string
  objective?: string
  status?: string
  dailyBudget?: number
  lifetimeBudget?: number
  start?: string
  stop?: string
  metrics: AdMetrics
  result?: AdResult
}

/** Um dia da conta inteira (o alcance do dia é exato só aqui). */
export interface AdDay {
  day: string
  metrics: AdMetrics
}

/** Um dia de uma campanha, com o resultado dela naquele dia. */
export interface AdCampaignDay {
  campaignId: string
  day: string
  metrics: AdMetrics
  result?: number
}

/** Um pedaço de uma campanha: plataforma ou região. */
export interface AdCut {
  campaignId: string
  key: string
  metrics: AdMetrics
}

export interface AdAudienceRow {
  campaignId: string
  age: string
  gender: string
  metrics: AdMetrics
}

export interface AdCreative {
  id: string
  name: string
  adsetName?: string
  campaignId?: string
  campaignName?: string
  thumbnail?: string
  /** Post do Instagram do anúncio */
  permalink?: string
  /** Prévia da Meta para abrir no navegador */
  previewLink?: string
  metrics: AdMetrics
  result?: AdResult
}

/** Formato dos relatórios que esta tela lê (o da função `meta-ads`); outro formato é relido. */
export const AD_REPORT_VERSION = 2

export interface AdReport {
  version: number
  preset: AdPreset
  since: string | null
  until: string | null
  currency: string
  accountStatus: number | null
  disableReason: number | null
  totals: AdMetrics
  days: AdDay[]
  campaigns: AdCampaign[]
  campaignDays: AdCampaignDay[]
  platforms: AdCut[]
  audience: AdAudienceRow[]
  regions: AdCut[]
  ads: AdCreative[]
  /** Partes que a Meta não devolveu nesta leitura */
  missing: string[]
  fetchedAt: number
}

export interface AdAccount {
  id: string
  teamId: string
  adAccountId: string
  name: string
  currency: string
  timezoneName?: string
  status?: number
  businessName?: string
  connectedBy?: string
  /** Quem autorizou no Facebook (pode ser alguém de fora da equipe, como o gestor de tráfego). */
  connectedName?: string
  connectedAt: number
  /** `user`: vale até `tokenExpiresAt`; `system`: não expira */
  tokenKind?: 'user' | 'system'
  tokenExpiresAt?: number
  syncedAt?: number
  syncError?: string
}

export class NoAdTablesError extends Error {}

/** Erro da função, com o código (`token`: conectar de novo; `not_configured`: falta o app da Meta). */
export class AdsError extends Error {
  constructor(
    message: string,
    readonly code = 'error'
  ) {
    super(message)
  }
}

const time = (value: string | null | undefined) => (value ? Date.parse(value) : undefined)

export async function loadAdAccounts(teamId: string): Promise<AdAccount[]> {
  const { data, error } = await supabase.from('crm_ad_accounts').select('*').eq('team_id', teamId).order('name')
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') throw new NoAdTablesError(error.message)
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    adAccountId: r.ad_account_id,
    name: r.name || `Conta ${r.ad_account_id}`,
    currency: r.currency || 'BRL',
    timezoneName: r.timezone_name ?? undefined,
    status: r.account_status ?? undefined,
    businessName: r.business_name ?? undefined,
    connectedBy: r.connected_by ?? undefined,
    connectedName: r.connected_name ?? undefined,
    connectedAt: Date.parse(r.connected_at),
    tokenKind: r.token_kind === 'user' || r.token_kind === 'system' ? r.token_kind : undefined,
    tokenExpiresAt: time(r.token_expires_at),
    syncedAt: time(r.synced_at),
    syncError: r.sync_error ?? undefined,
  }))
}

const metricsOf = (m: Partial<AdMetrics> | undefined): AdMetrics => ({
  spend: m?.spend ?? 0,
  impressions: m?.impressions ?? 0,
  reach: m?.reach,
  frequency: m?.frequency,
  clicks: m?.clicks ?? 0,
  linkClicks: m?.linkClicks ?? 0,
  leads: m?.leads ?? 0,
  conversations: m?.conversations ?? 0,
  actions: m?.actions ?? {},
})

const listOf = <T extends { metrics?: Partial<AdMetrics> }>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]).map((row) => ({ ...row, metrics: metricsOf(row.metrics) })) : []

/** O relatório como a tela lê, com toda lista e número presentes; `null` num formato que esta tela não lê. */
function asReport(raw: unknown, fetchedAt: number): AdReport | null {
  const r = raw as Partial<AdReport> | null
  if (!r || r.version !== AD_REPORT_VERSION) return null
  return {
    ...r,
    version: AD_REPORT_VERSION,
    preset: r.preset ?? 'last_30d',
    since: r.since ?? null,
    until: r.until ?? null,
    currency: r.currency || 'BRL',
    accountStatus: r.accountStatus ?? null,
    disableReason: r.disableReason ?? null,
    totals: metricsOf(r.totals),
    days: listOf<AdDay>(r.days),
    campaigns: listOf<AdCampaign>(r.campaigns),
    campaignDays: listOf<AdCampaignDay>(r.campaignDays),
    platforms: listOf<AdCut>(r.platforms),
    audience: listOf<AdAudienceRow>(r.audience),
    regions: listOf<AdCut>(r.regions),
    ads: listOf<AdCreative>(r.ads),
    missing: Array.isArray(r.missing) ? r.missing : [],
    fetchedAt,
  }
}

/** O último relatório guardado do período, se houver (num formato antigo, conta como não haver: a tela relê). */
export async function loadAdReport(accountId: string, preset: AdPreset): Promise<AdReport | null> {
  const { data, error } = await supabase.from('crm_ad_reports').select('data, fetched_at').eq('account_id', accountId).eq('preset', preset).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return asReport(data.data, Date.parse(data.fetched_at))
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  let result: { data: unknown; error: unknown }
  try {
    result = await supabase.functions.invoke('meta-ads', { body: { action, ...body } })
  } catch {
    throw new AdsError('A função meta-ads não respondeu.', 'unavailable')
  }
  const { data, error } = result
  if (!error && data && typeof data === 'object' && !('error' in data)) return data as T
  const context = (error as { context?: unknown } | null)?.context
  const response = context instanceof Response ? context : undefined
  const failure = response
    ? await response.json().then((b: { error?: unknown; code?: unknown }) => b, () => undefined)
    : (data as { error?: unknown; code?: unknown } | null)
  if (response?.status === 404 && !failure?.error) throw new AdsError('A função meta-ads não está publicada no Supabase.', 'unavailable')
  if (typeof failure?.error === 'string') throw new AdsError(failure.error, typeof failure.code === 'string' ? failure.code : 'error')
  throw new AdsError(response ? `A função meta-ads respondeu com erro ${response.status}.` : 'A função meta-ads não respondeu.', 'unavailable')
}

export const adsStatus = () => call<{ configured: boolean; systemLogin: boolean; version: string }>('status')

/** O endereço de volta cadastrado no app da Meta (login do Facebook para empresas). */
export const adsRedirectUri = () => `${publicAppUrl()}${ADS_CALLBACK_PATH}`

/** Abre o login do Facebook nesta aba; a volta cai em `/anuncios/retorno`. */
export async function startAdsConnect(teamId: string) {
  const { url } = await call<{ url: string }>('auth_url', { teamId, redirectUri: adsRedirectUri() })
  window.location.assign(url)
}

export interface PendingAccount {
  id: string
  name: string
  currency: string
  timezoneName?: string
  status?: number
  business?: string
  /** Já ligada a esta equipe (escolher de novo renova o acesso). */
  connected: boolean
}

export interface Pending {
  pendingId: string
  accounts: PendingAccount[]
  /** Nome de quem entrou no Facebook */
  who: string | null
  kind: 'user' | 'system' | null
  expiresAt: string | null
}

/** Na tela de volta: o endereço dela é o que foi pedido à Meta. */
export const finishAdsConnect = (code: string, state: string) => call<Pending>('connect', { code, state, redirectUri: `${window.location.origin}${ADS_CALLBACK_PATH}` })

export const connectAdsWithToken = (teamId: string, token: string) => call<Pending>('connect_token', { teamId, token })

export const chooseAdAccounts = (pendingId: string, accountIds: string[]) => call<{ accounts: { id: string; name: string }[] }>('choose', { pendingId, accountIds })

/** Lê a Meta agora. A função publicada numa versão anterior devolve outro formato: a tela pede para publicá-la de novo. */
export async function fetchAdReport(accountId: string, preset: AdPreset): Promise<AdReport> {
  const raw = await call<{ fetchedAt?: string }>('report', { accountId, preset })
  const report = asReport(raw, raw.fetchedAt ? Date.parse(raw.fetchedAt) : Date.now())
  if (!report) throw new AdsError('A função meta-ads publicada no Supabase é a versão anterior. Publique de novo a função meta-ads e clique em Atualizar.', 'outdated')
  return report
}

export const disconnectAdAccount = (accountId: string) => call<{ ok: true }>('disconnect', { accountId })

/** Formatos da prévia nativa da Meta (`ad_format`). */
export const PREVIEW_FORMATS = [
  { key: 'INSTAGRAM_STANDARD', label: 'Feed do Instagram' },
  { key: 'INSTAGRAM_STORY', label: 'Stories' },
  { key: 'INSTAGRAM_REELS', label: 'Reels' },
  { key: 'MOBILE_FEED_STANDARD', label: 'Feed do Facebook' },
] as const
export type PreviewFormat = (typeof PREVIEW_FORMATS)[number]['key']

export interface AdPreview {
  /** Endereço do quadro de prévia da Meta */
  src: string
  width: number | null
  height: number | null
}

export const fetchAdPreview = (accountId: string, adId: string, format: PreviewFormat) => call<AdPreview>('preview', { accountId, adId, format })

// ---------- números ----------

export const contactsOf = (m: AdMetrics) => m.leads + m.conversations

const ratio = (a: number, b: number | undefined) => (b ? a / b : undefined)
export const ctrOf = (m: AdMetrics) => ratio(m.linkClicks, m.impressions)
export const cpcOf = (m: AdMetrics) => ratio(m.spend, m.linkClicks)
export const cpmOf = (m: AdMetrics) => (m.impressions ? (m.spend / m.impressions) * 1000 : undefined)
export const costPerContact = (m: AdMetrics) => ratio(m.spend, contactsOf(m))

const moneyFormats = new Map<string, Intl.NumberFormat>()
/** `R$ 1.234,56`; com `short`, sem centavos a partir de mil. */
export function money(n: number | undefined, currency = 'BRL', short = false) {
  if (n === undefined || !Number.isFinite(n)) return '—'
  const digits = short && Math.abs(n) >= 1000 ? 0 : 2
  const key = `${currency}:${digits}`
  let format = moneyFormats.get(key)
  if (!format) {
    try {
      format = new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
    } catch {
      format = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    }
    moneyFormats.set(key, format)
  }
  return format.format(n)
}

/** Nome do resultado em português: [um, vários]. */
const ACTION_LABEL: Record<string, [string, string]> = {
  lead: ['lead', 'leads'],
  'onsite_conversion.lead_grouped': ['lead no formulário', 'leads no formulário'],
  'offsite_conversion.fb_pixel_lead': ['lead no site', 'leads no site'],
  'onsite_conversion.messaging_conversation_started_7d': ['conversa iniciada', 'conversas iniciadas'],
  'onsite_conversion.messaging_first_reply': ['primeira resposta', 'primeiras respostas'],
  link_click: ['clique no link', 'cliques no link'],
  landing_page_view: ['visita à página', 'visitas à página'],
  purchase: ['compra', 'compras'],
  omni_purchase: ['compra', 'compras'],
  'offsite_conversion.fb_pixel_purchase': ['compra no site', 'compras no site'],
  'offsite_conversion.fb_pixel_complete_registration': ['cadastro no site', 'cadastros no site'],
  complete_registration: ['cadastro', 'cadastros'],
  contact: ['contato', 'contatos'],
  'offsite_conversion.fb_pixel_contact': ['contato no site', 'contatos no site'],
  schedule: ['agendamento', 'agendamentos'],
  post_engagement: ['engajamento', 'engajamentos'],
  page_engagement: ['engajamento', 'engajamentos'],
  post_reaction: ['reação', 'reações'],
  like: ['curtida na página', 'curtidas na página'],
  video_view: ['visualização do vídeo', 'visualizações do vídeo'],
  thruplay: ['ThruPlay', 'ThruPlays'],
  mobile_app_install: ['instalação', 'instalações'],
  app_install: ['instalação', 'instalações'],
  reach: ['pessoa alcançada', 'pessoas alcançadas'],
}

export function resultLabel(type: string, value = 2) {
  const known = ACTION_LABEL[type]
  if (known) return value === 1 ? known[0] : known[1]
  const plain = type
    .replace(/^(onsite_conversion|offsite_conversion|onsite_web)\./, '')
    .replace(/^fb_pixel_/, '')
    .replace(/_/g, ' ')
  return plain
}

/** Custo por resultado; para alcance, por mil pessoas, como no Gerenciador. */
export function resultCost(result: AdResult | undefined, currency: string) {
  if (!result?.cost) return '—'
  return result.type === 'reach' ? `${money(result.cost * 1000, currency)} por mil` : money(result.cost, currency)
}

export const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_LEADS: 'Cadastros',
  OUTCOME_APP_PROMOTION: 'Promoção do app',
  OUTCOME_SALES: 'Vendas',
  BRAND_AWARENESS: 'Reconhecimento',
  REACH: 'Alcance',
  LINK_CLICKS: 'Tráfego',
  POST_ENGAGEMENT: 'Engajamento',
  PAGE_LIKES: 'Curtidas na página',
  VIDEO_VIEWS: 'Visualizações do vídeo',
  MESSAGES: 'Mensagens',
  LEAD_GENERATION: 'Cadastros',
  CONVERSIONS: 'Conversões',
  APP_INSTALLS: 'Instalações do app',
}

/** Situação da campanha: rótulo e se está rodando. */
export function campaignStatus(status: string | undefined): { label: string; live: boolean; warn?: boolean } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Ativa', live: true }
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return { label: 'Pausada', live: false }
    case 'IN_PROCESS':
      return { label: 'Processando', live: true }
    case 'PENDING_REVIEW':
      return { label: 'Em análise', live: false }
    case 'WITH_ISSUES':
      return { label: 'Com problemas', live: false, warn: true }
    case 'DISAPPROVED':
      return { label: 'Reprovada', live: false, warn: true }
    case 'PENDING_BILLING_INFO':
      return { label: 'Falta pagamento', live: false, warn: true }
    case 'ARCHIVED':
      return { label: 'Arquivada', live: false }
    case 'DELETED':
      return { label: 'Excluída', live: false }
    default:
      return { label: status ? status.toLowerCase().replace(/_/g, ' ') : '—', live: false }
  }
}

/** A conta de anúncios fora do normal (1 é ativa). */
export const ACCOUNT_STATUS: Record<number, string> = {
  2: 'está desativada',
  3: 'tem pagamento pendente',
  7: 'está em análise de risco',
  8: 'tem um acerto de pagamento pendente',
  9: 'está no período de carência do pagamento',
  100: 'está sendo fechada',
  101: 'foi fechada',
}

export const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  audience_network: 'Audience Network',
  messenger: 'Messenger',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  unknown: 'Outros',
}

export const GENDER_LABEL: Record<string, string> = { female: 'Mulheres', male: 'Homens', unknown: 'Não informado' }

export const MISSING_LABEL: Record<string, string> = {
  results: 'o resultado do Gerenciador (calculado pelo objetivo)',
  campanhas: 'a lista de campanhas',
  'dias por campanha': 'os dias de cada campanha',
  plataformas: 'as plataformas',
  público: 'idade e gênero',
  regiões: 'as regiões',
  anúncios: 'os anúncios',
  criativos: 'as miniaturas dos anúncios',
}

/** Abre a conta (e a campanha) no Gerenciador de Anúncios. */
export const adsManagerAdUrl = (adAccountId: string, adId: string) => `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId}&selected_ad_ids=${adId}`

export const adsManagerUrl = (adAccountId: string, campaignId?: string) =>
  `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}${campaignId ? `&selected_campaign_ids=${campaignId}` : ''}`
