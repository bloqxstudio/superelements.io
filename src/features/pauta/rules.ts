/**
 * Regras da Pauta (calendário editorial com aprovação do cliente, migração 20261105120000).
 * Sem imports: o Node (scripts/tests/pauta.test.mjs) lê este arquivo e as telas também.
 *
 * Fluxo: a IA ou o designer entrega ao gestor (conteúdo em revisão), o gestor aprova, o gestor
 * envia ao cliente por um link, e o cliente aprova ou pede ajuste em cada peça. Só a equipe edita.
 */

export const CHANNELS = [
  { id: 'instagram', label: 'Instagram', short: 'IG' },
  { id: 'facebook', label: 'Facebook', short: 'FB' },
  { id: 'linkedin', label: 'LinkedIn', short: 'IN' },
  { id: 'tiktok', label: 'TikTok', short: 'TT' },
  { id: 'youtube', label: 'YouTube', short: 'YT' },
  { id: 'site', label: 'Site', short: 'Site' },
  { id: 'email', label: 'E-mail', short: 'Mail' },
  { id: 'whatsapp', label: 'WhatsApp', short: 'WA' },
  { id: 'anuncio', label: 'Anúncio', short: 'Ads' },
  { id: 'outro', label: 'Outro', short: '·' },
] as const

export type ChannelId = (typeof CHANNELS)[number]['id']
export const channelLabel = (id?: string) => CHANNELS.find((c) => c.id === id)?.label

/** Canal provável pelo formato, quando o conteúdo ainda não tem canal. */
export function channelOfFormat(format: string): ChannelId | undefined {
  if (['post-instagram', 'carrossel', 'story', 'reels'].includes(format)) return 'instagram'
  if (format === 'linkedin') return 'linkedin'
  if (format === 'email') return 'email'
  if (format === 'whatsapp') return 'whatsapp'
  if (format === 'anuncio') return 'anuncio'
  if (format === 'lp' || format === 'artigo') return 'site'
  return undefined
}

export type Stage = 'ideia' | 'producao' | 'gestor' | 'pronto' | 'cliente' | 'aprovado' | 'ajuste'

export const STAGES: Stage[] = ['ideia', 'producao', 'gestor', 'pronto', 'cliente', 'ajuste', 'aprovado']

export const STAGE_LABEL: Record<Stage, string> = {
  ideia: 'Ideia',
  producao: 'Em produção',
  gestor: 'Com o gestor',
  pronto: 'Pronto para o cliente',
  cliente: 'Com o cliente',
  ajuste: 'Cliente pediu ajuste',
  aprovado: 'Aprovado pelo cliente',
}

/** Classes de cor de cada etapa (chip e borda do card). */
export const STAGE_TONE: Record<Stage, { chip: string; bar: string }> = {
  ideia: { chip: 'bg-gray-100 text-gray-700', bar: 'bg-gray-300' },
  producao: { chip: 'bg-sky-50 text-sky-800', bar: 'bg-sky-400' },
  gestor: { chip: 'bg-violet-50 text-violet-800', bar: 'bg-violet-500' },
  pronto: { chip: 'bg-indigo-50 text-indigo-800', bar: 'bg-indigo-500' },
  cliente: { chip: 'bg-amber-50 text-amber-900', bar: 'bg-amber-400' },
  ajuste: { chip: 'bg-red-50 text-red-800', bar: 'bg-red-500' },
  aprovado: { chip: 'bg-emerald-50 text-emerald-800', bar: 'bg-emerald-500' },
}

export interface StageInput {
  status: 'ideia' | 'producao' | 'revisao' | 'aprovado'
  clientStatus?: 'enviado' | 'aprovado' | 'ajuste'
}

export function stageOf(c: StageInput): Stage {
  if (c.status === 'ideia') return 'ideia'
  if (c.status === 'producao') return c.clientStatus === 'ajuste' ? 'ajuste' : 'producao'
  if (c.status === 'revisao') return 'gestor'
  if (c.clientStatus === 'enviado') return 'cliente'
  if (c.clientStatus === 'aprovado') return 'aprovado'
  if (c.clientStatus === 'ajuste') return 'ajuste'
  return 'pronto'
}

/** Só o que o gestor aprovou pode ir ao cliente. */
export const canSendToClient = (c: StageInput) => c.status === 'aprovado'

// ---------- datas (dias como `AAAA-MM-DD`, sem fuso) ----------

const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dateOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
export const addDays = (iso: string, n: number) => {
  const d = dateOf(iso)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

/** Segunda-feira da semana do dia. */
export const weekStart = (iso: string) => {
  const d = dateOf(iso)
  const dow = (d.getDay() + 6) % 7
  return addDays(iso, -dow)
}

/** As semanas (de segunda a domingo) que cobrem o mês de `iso`. */
export function monthGrid(iso: string): string[][] {
  const d = dateOf(iso)
  const first = isoOf(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  const last = isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
  const weeks: string[][] = []
  let day = weekStart(first)
  while (day <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)))
    day = addDays(day, 7)
  }
  return weeks
}

export const weekDays = (iso: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(iso), i))

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7)

/** Ordem no dia: com horário primeiro, pelo horário; depois os sem horário. */
export const byTime = <T extends { scheduledTime?: string; title: string }>(a: T, b: T) =>
  (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99') || a.title.localeCompare(b.title, 'pt-BR')

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const monthTitle = (iso: string) => `${MONTHS[dateOf(iso).getMonth()]} de ${dateOf(iso).getFullYear()}`

/** "10 a 16 de nov." ou "28 de out. a 3 de nov.": o título sugerido de um envio. */
export function rangeLabel(from: string, to: string): string {
  const a = dateOf(from)
  const b = dateOf(to)
  const mon = (d: Date) => MONTHS[d.getMonth()].slice(0, 3) + '.'
  if (from === to) return `${a.getDate()} de ${mon(a)}`
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${mon(b)}`
  return `${a.getDate()} de ${mon(a)} a ${b.getDate()} de ${mon(b)}`
}

export const dayHeading = (iso: string) => dateOf(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

/** Mensagem para mandar o link ao cliente (WhatsApp ou e-mail). */
export const approvalMessage = (title: string, url: string, count: number) =>
  `Olá! Separamos ${count === 1 ? 'a peça' : `as ${count} peças`} de "${title}" para você aprovar. Dá para ver cada uma, aprovar ou pedir ajuste e deixar comentários aqui: ${url}`
