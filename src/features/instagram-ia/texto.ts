/**
 * Base de texto da inteligência de Instagram (ganchos, tempos, legenda, humanizador, virais).
 * Português do Brasil: palavras com acento, "R$ 18.000", "18 mil". Sem imports (testes em Node).
 */

/** `\b` do JavaScript não conhece acento ("\bé" falha); este é o limite de palavra em Unicode. */
const UB = '(?:(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}]))'

/** Regex com `\b` que funciona em português (flags `iu` por padrão). */
export const rx = (source: string, flags = 'iu') => new RegExp(source.replace(/\\b/g, UB), flags.includes('u') ? flags : `${flags}u`)

export const clamp = (n: number) => Math.max(0, Math.min(100, n))
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const pstdev = (xs: number[]) => {
  if (!xs.length) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
export const round1 = (n: number) => Math.round(n * 10) / 10

/** Minúsculas sem acento, para comparar palavras. */
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const WORD = /[\p{L}\p{N}$%'’-]+/gu

/**
 * As palavras como são faladas: "18.000" e "R$ 18.000" contam uma só ("dezoito mil" é o número),
 * "R$" grudado no número.
 */
export function words(text: string): string[] {
  const t = text.replace(/(?<=\d)[.,](?=\d{3}\b)/g, '').replace(/R\$\s+(?=\d)/g, 'R$')
  return t.match(WORD) ?? []
}

/** Frases com mais de 2 palavras. */
export const sentences = (text: string) => (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 2)

/** Número com unidade, dinheiro em real (e dólar), porcentagem. */
export const NUMBER = /R\$\s?\d[\d.]*(?:,\d+)?(?:\s?mil\b)?|US?\$\s?\d[\d.,]*|\b\d[\d.]*(?:,\d+)?\s?(?:%|mil\b|k\b|x\b|h\b|horas?\b|min\b|minutos?\b|seg\b|segundos?\b|dias?\b|semanas?\b|meses\b|mês\b|anos?\b)?/giu

/** Nome próprio (maiúscula no meio da frase): marca, cidade, pessoa. */
export const PROPER = /(?<![.!?]\s)(?<!^)(?<![\p{L}])\p{Lu}\p{Ll}{2,}/gmu

/** Números ditos por extenso: "vinte mil" é tão concreto quanto "20.000". "um" e "primeiro" ficam de fora (quase sempre enchimento). */
export const SPOKEN_NUMBERS = new Set(
  ['zero', 'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quinze', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento', 'duzentos', 'trezentos', 'quinhentos', 'mil', 'milhao', 'milhoes', 'bilhao', 'duzia', 'metade', 'dobro', 'triplo', 'dobrou', 'triplicou'].map(fold)
)
export const MONEY_WORDS = new Set(['reais', 'real', 'conto', 'contos', 'pila', 'dolares', 'faturamento', 'faturei', 'lucro', 'salario', 'aluguel', 'centavos', 'porcento', 'prejuizo', 'multa', 'boleto'].map(fold))

/** Um caractere de emoji (faixa usada no Instagram). */
export const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu

export const HASHTAG = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu
export const MENTION = /(?:^|\s)(@[\p{L}\p{N}_.]+)/gu
export const LINK = /https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com\.br|com|br|co|io|net|org|ai|app|me|link)\/?\S*/giu

export const count = (re: RegExp, text: string) => (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length
export const all = (re: RegExp, text: string, group = 0) => [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))].map((m) => m[group] ?? m[0])
