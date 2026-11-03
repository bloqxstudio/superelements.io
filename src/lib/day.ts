/**
 * Um dia escolhido no calendário das telas de métricas.
 * O período de um dia é o texto `dia:2026-10-30` (no fuso de quem abre), ao lado dos períodos
 * de sempre (hoje, 7, 30, 90 dias), para caber nos tipos de período de cada tela.
 */

export type DayPeriod = `dia:${string}`

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const isDayKey = (value: unknown): value is string => typeof value === 'string' && DAY_RE.test(value)
export const isDayPeriod = (value: unknown): value is DayPeriod => typeof value === 'string' && value.startsWith('dia:') && DAY_RE.test(value.slice(4))
export const dayPeriod = (key: string): DayPeriod => `dia:${key}`
export const dayOfPeriod = (period: DayPeriod) => period.slice(4)

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
