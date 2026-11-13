/**
 * Roteiro de Reels em tempos (o `beats.py` do instagram-agent-skill, MIT, em português).
 *
 * Estima quanto cada linha leva para ser dita, empilha em minutagem e aponta as quatro coisas que
 * matam um Reels na edição: gancho passando de 3 s, uma batida longa a ponto de a pessoa sair,
 * uma sequência de linhas sem nada concreto, e o fim que não volta ao começo (sem loop).
 * É estimativa por palavras por minuto: serve para planejar, não substitui gravar.
 */
import { fold, NUMBER, PROPER, words } from './texto.ts'

export const HOOK_WINDOW = 3 // segundos: depois disso o polegar já decidiu
export const MAX_BEAT = 4 // segundos numa ideia sem mudar a tela
const ABSTRACT_RUN = 3 // batidas seguidas sem nada que dê para conferir
/** Português falado em Reels: 150 a 180 palavras por minuto; 160 é o padrão. */
export const DEFAULT_WPM = 160

const STOP = new Set(
  ['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas', 'se', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'pra', 'pro', 'para', 'com', 'que', 'isso', 'isto', 'esse', 'essa', 'este', 'esta', 'é', 'são', 'foi', 'era', 'ser', 'ter', 'tem', 'tinha', 'você', 'voce', 'vc', 'seu', 'sua', 'eu', 'meu', 'minha', 'me', 'nós', 'nosso', 'nossa', 'a gente', 'eles', 'elas', 'ele', 'ela', 'então', 'só', 'não', 'nao', 'já', 'vai', 'vou', 'faz', 'fiz', 'ao', 'aos', 'à', 'às', 'lá', 'aqui', 'tudo', 'todo', 'toda', 'mais', 'muito', 'como', 'quando', 'até'].map(fold)
)

const concreteCount = (t: string) => (t.match(NUMBER) ?? []).filter((s) => s.trim()).length + (t.match(PROPER) ?? []).length

/** Uma linha é uma batida, a menos que seja longa demais para ser uma. */
function splitBeats(raw: string, wps: number) {
  const beats: string[] = []
  for (const line of raw.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (words(line).length / wps <= MAX_BEAT * 1.5) {
      beats.push(line)
      continue
    }
    // Parágrafo longo: quebra no fim das frases, para a minutagem fazer sentido
    let buf = ''
    for (const part of (line.match(/[^.!?]+[.!?]*/g) ?? []).map((p) => p.trim()).filter(Boolean)) {
      const candidate = `${buf} ${part}`.trim()
      if (buf && words(candidate).length / wps > MAX_BEAT) {
        beats.push(buf)
        buf = part
      } else buf = candidate
    }
    if (buf) beats.push(buf)
  }
  return beats
}

export interface Beat {
  n: number
  inicio: number
  duracao: number
  palavras: number
  texto: string
  concreto: number
  marca: '' | 'GANCHO' | 'MEIO' | 'CHAMADA' | 'GANCHO/CHAMADA'
  alertas: string[]
}

export interface BeatSheet {
  ppm: number
  alvo?: number
  segundos: number
  palavras: number
  batidas: Beat[]
  notas: string[]
  loop: boolean
}
const sec = (s: number) => `${s.toFixed(1).replace('.', ',')} s`

export function beatSheet(raw: string, opts: { ppm?: number; alvo?: number } = {}): BeatSheet | null {
  const ppm = opts.ppm && opts.ppm > 60 ? opts.ppm : DEFAULT_WPM
  const wps = ppm / 60
  const texts = splitBeats(raw, wps)
  if (!texts.length) return null
  let clock = 0
  const rows: Beat[] = texts.map((texto, i) => {
    const n = words(texto).length
    const duracao = n / wps
    const row: Beat = { n: i + 1, inicio: Math.round(clock * 100) / 100, duracao: Math.round(duracao * 100) / 100, palavras: n, texto, concreto: concreteCount(texto), marca: '', alertas: [] }
    clock += duracao
    return row
  })
  const total = clock

  for (const r of rows) if (r.n === 1 || r.inicio + r.duracao <= HOOK_WINDOW) r.marca = 'GANCHO'
  const last = rows[rows.length - 1]
  last.marca = last.marca === 'GANCHO' ? 'GANCHO/CHAMADA' : 'CHAMADA'
  const half = total / 2
  for (const r of rows) if (!r.marca && r.inicio <= half && half < r.inicio + r.duracao) r.marca = 'MEIO'

  const notas: string[] = []
  const first = rows[0]
  if (first.duracao > HOOK_WINDOW) {
    first.alertas.push(`o gancho leva ${sec(first.duracao)}, passa dos ${HOOK_WINDOW} s`)
    notas.push(`A batida 1 leva ${sec(first.duracao)} para ser dita. Corte para ${Math.floor(HOOK_WINDOW * wps)} palavras ou menos, ou o gancho chega depois que a pessoa já decidiu.`)
  }
  if (!first.concreto) notas.push('A batida 1 não tem número nem nome. Gancho sem nada que dê para conferir é o que a pessoa passa.')

  const longs = rows.filter((r) => r.duracao > MAX_BEAT)
  for (const r of longs) r.alertas.push(`${sec(r.duracao)} numa batida só`)
  if (longs.length) notas.push(`Batida(s) ${longs.map((r) => r.n).join(', ')} passam de ${MAX_BEAT} s. Divida a linha ou mude o que está na tela no meio dela: quadro parado é onde as pessoas saem.`)

  let run = 0
  let start = 0
  for (const r of rows) {
    if (!r.concreto) {
      if (!run) start = r.n
      run++
      if (run === ABSTRACT_RUN) notas.push(`As batidas ${start} a ${r.n} não têm nada concreto. Ponha um número, um nome ou um preço em uma delas.`)
    } else run = 0
  }

  // O fim devolve para o começo? Uma palavra do gancho repetida no fim faz o replay "colar".
  const key = (t: string) => new Set(words(t).map(fold).filter((w) => !STOP.has(w) && w.length > 2))
  const a = key(first.texto)
  const shared = [...key(last.texto)].filter((w) => a.has(w)).sort()
  const loop = shared.length > 0 && rows.length > 1
  notas.push(loop ? `Tem loop: a última batida repete "${shared.slice(0, 3).join(', ')}" do gancho. Segunda visualização é alcance de graça.` : 'Sem loop. A última batida não repete nenhuma palavra do gancho, então o vídeo termina reto. Repetir uma palavra da batida 1 é o replay mais barato que existe.')

  if (opts.alvo) {
    const delta = total - opts.alvo
    if (Math.abs(delta) <= opts.alvo * 0.1) notas.push(`Duração no alvo (${sec(total)} para ${opts.alvo} s).`)
    else if (delta > 0) notas.push(`${sec(delta)} acima do alvo. Corte umas ${Math.round(delta * wps)} palavras.`)
    else notas.push(`${sec(-delta)} abaixo do alvo. Acrescente umas ${Math.round(-delta * wps)} palavras ou grave curto. Curto costuma ser o certo.`)
  }

  return { ppm, ...(opts.alvo ? { alvo: opts.alvo } : {}), segundos: Math.round(total * 10) / 10, palavras: rows.reduce((s, r) => s + r.palavras, 0), batidas: rows, notas, loop }
}
