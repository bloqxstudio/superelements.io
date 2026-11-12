/**
 * Um dia ou um intervalo de dias escolhido no calendário das telas de métricas.
 * O período é o texto `dia:2026-10-30` (um dia) ou `dia:2026-10-25~2026-10-31` (do dia 25 ao 31, inclusive),
 * no fuso de quem abre, ao lado dos períodos de sempre (hoje, 7, 30, 90 dias), para caber nos tipos de
 * período de cada tela. A parte depois de `dia:` é o "trecho" (`DaySpan`), que também vai na URL do Início
 * e da Operação (`?periodo=2026-10-25~2026-10-31`).
 */

export type DayPeriod = `dia:${string}`
/** `2026-10-30` ou `2026-10-25~2026-10-31` */
export type DaySpan = string

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const SPAN_RE = /^(\d{4}-\d{2}-\d{2})(?:~(\d{4}-\d{2}-\d{2}))?$/

export const isDayKey = (value: unknown): value is string => typeof value === 'string' && DAY_RE.test(value)
export const isDaySpan = (value: unknown): value is DaySpan => {
  if (typeof value !== 'string') return false
  const m = SPAN_RE.exec(value)
  return !!m && (!m[2] || m[2] > m[1])
}
export const isDayPeriod = (value: unknown): value is DayPeriod => typeof value === 'string' && value.startsWith('dia:') && isDaySpan(value.slice(4))
/** O período de um dia (`dayPeriod('2026-10-30')`) ou de um trecho (`dayPeriod('2026-10-25~2026-10-31')`) */
export const dayPeriod = (span: DaySpan): DayPeriod => `dia:${span}`
export const spanOfPeriod = (period: DayPeriod): DaySpan => period.slice(4)

/** O trecho de `from` a `to` (inclusive); um dia só quando são iguais. Aceita os dois em qualquer ordem. */
export function daySpan(from: string, to: string = from): DaySpan {
  const [a, b] = from <= to ? [from, to] : [to, from]
  return a === b ? a : `${a}~${b}`
}
/** Primeiro e último dia (inclusive) */
export function spanBounds(span: DaySpan): { from: string; to: string } {
  const [from, to = from] = span.split('~')
  return { from, to }
}
export const isSingleDay = (span: DaySpan) => !span.includes('~')
/** Último dia do trecho */
export const spanEnd = (span: DaySpan) => spanBounds(span).to
/** Quantos dias o trecho tem */
export function spanLength(span: DaySpan) {
  const { from, to } = spanBounds(span)
  return Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000) + 1
}
/** Os dias do trecho, em ordem */
export function spanDays(span: DaySpan) {
  const { from, to } = spanBounds(span)
  const out: string[] = []
  for (let key = from; key <= to && out.length < 1200; key = addDays(key, 1)) out.push(key)
  return out
}
/** Da meia-noite do primeiro dia à meia-noite depois do último (local) */
export function spanRange(span: DaySpan) {
  const { from, to } = spanBounds(span)
  return { from: dayStart(from), to: dayStart(addDays(to, 1)) }
}

/** `2026-10-25` no fuso de quem abre */
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const todayKey = () => dayKey(new Date())

/** Meia-noite local do dia */
export function dayStart(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number) {
  const date = dayStart(key)
  date.setDate(date.getDate() + n)
  return dayKey(date)
}

/** Do começo do dia ao começo do seguinte (local) */
export function dayRange(key: string) {
  return { from: dayStart(key), to: dayStart(addDays(key, 1)) }
}

/** "30 out." ou, fora deste ano, "30 out. 2025" */
export function dayShort(key: string) {
  const date = dayStart(key)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "sexta, 30 de outubro" (com o ano se não for este), ou "hoje"/"ontem" */
export function dayLong(key: string) {
  if (key === todayKey()) return 'hoje'
  if (key === addDays(todayKey(), -1)) return 'ontem'
  const date = dayStart(key)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).replace('-feira', '')
}

/** "em 30 out." / "hoje" / "ontem", para frases como "Nenhuma visita em 30 out." */
export function dayIn(key: string) {
  const long = dayLong(key)
  return long === 'hoje' || long === 'ontem' ? long : `em ${dayShort(key)}`
}

/** "30 out." ou "25–31 out." ou "28 out. – 3 nov." (com o ano quando não for este) */
export function spanShort(span: DaySpan) {
  const { from, to } = spanBounds(span)
  if (from === to) return dayShort(from)
  const a = dayStart(from)
  const b = dayStart(to)
  const thisYear = new Date().getFullYear()
  const year = a.getFullYear() !== thisYear || b.getFullYear() !== thisYear
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })}`
  const fmt = (d: Date, withYear: boolean) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  return `${fmt(a, year && a.getFullYear() !== b.getFullYear())} – ${fmt(b, year)}`
}

/** "sexta, 30 de outubro" para um dia; "de 25 a 31 out." para um trecho */
export function spanLong(span: DaySpan) {
  if (isSingleDay(span)) return dayLong(span)
  return `de ${spanShort(span).replace(/\s?[–]\s?/, ' a ')}`
}

/** "em 30 out." / "hoje" / "ontem" / "de 25 a 31 out.", para frases como "Nenhuma visita em 30 out." */
export function spanIn(span: DaySpan) {
  return isSingleDay(span) ? dayIn(span) : spanLong(span)
}
