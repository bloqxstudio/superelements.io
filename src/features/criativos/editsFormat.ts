/**
 * As partes do pacote do Edits que não dependem do navegador (`edits.ts`): o nome da pasta (o mesmo da função
 * `sinfy-mcp`), WAV, SRT e os trechos de fala. Sem imports, para os testes em `scripts/tests/` lerem direto.
 */

type AudioLike = { numberOfChannels: number; length: number; sampleRate: number; getChannelData: (c: number) => Float32Array }

/** O nome da pasta do vídeo: o mesmo que a função `sinfy-mcp` calcula (`editsFolder`). */
export function editsFolder(scene: { id: string; name: string }): string {
  const base = scene.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '')
  const id = scene.id.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${base || 'video'}-${id}`.slice(0, 80)
}

export const EDITS_PATH = '~/Sinfy/Edits'

// ---------- arquivos ----------

/** AudioBuffer em WAV 16 bits (estéreo, 48 kHz): o Edits e qualquer editor abrem. */
export function wavOf(buffer: AudioLike): Blob {
  const channels = Math.min(2, buffer.numberOfChannels)
  const frames = buffer.length
  const bytes = frames * channels * 2
  const view = new DataView(new ArrayBuffer(44 + bytes))
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)) }
  str(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, bytes, true)
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c))
  let at = 44
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(at, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      at += 2
    }
  return new Blob([view], { type: 'audio/wav' })
}

/** Áudio que não tem nada (sem voz ou sem efeitos): não vai no pacote. */
export const silent = (buffer: AudioLike) => {
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i += 64) if (Math.abs(d[i]) > 0.0005) return false
  }
  return true
}

const srtTime = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}

type Word = { w: string; s: number; e: number }

/** Frases curtas para a legenda: até 5 palavras ou 2,6 s, quebrando nas pausas e na pontuação. */
export function phrases(words: Word[]): { text: string; s: number; e: number }[] {
  const out: { text: string; s: number; e: number }[] = []
  let cur: Word[] = []
  const flush = () => {
    if (cur.length) out.push({ text: cur.map((w) => w.w.trim()).join(' '), s: cur[0].s, e: cur[cur.length - 1].e })
    cur = []
  }
  words.forEach((w, i) => {
    cur.push(w)
    const next = words[i + 1]
    if (!next || cur.length >= 5 || w.e - cur[0].s >= 2.6 || next.s - w.e > 0.45 || /[.!?;:,]$/.test(w.w.trim())) flush()
  })
  return out
}

export function srtOf(lines: { text: string; s: number; e: number }[]): string {
  return lines.filter((l) => l.text.trim()).map((l, i) => `${i + 1}\n${srtTime(l.s)} --> ${srtTime(Math.max(l.e, l.s + 0.3))}\n${l.text.trim()}\n`).join('\n')
}

/** Os trechos com fala (para abaixar a música no Edits): palavras juntas até 0,7 s de pausa. */
export function speechSpans(words: Word[]): { inicio: number; fim: number }[] {
  const out: { inicio: number; fim: number }[] = []
  for (const w of words) {
    const last = out[out.length - 1]
    if (last && w.s - last.fim <= 0.7) last.fim = r2(w.e)
    else out.push({ inicio: r2(w.s), fim: r2(w.e) })
  }
  return out
}

export const r2 = (n: number) => Math.round(n * 100) / 100

