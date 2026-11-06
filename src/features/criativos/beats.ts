/**
 * Batidas de uma trilha, lidas no próprio navegador: a energia do som em janelas
 * de ~23 ms vira uma curva de "ataques" (onde o som cresce de repente: bumbo,
 * caixa), o andamento sai da autocorrelação dessa curva (70 a 180 BPM) e a grade
 * de batidas é encaixada na fase que mais coincide com os ataques. É o que os
 * editores de vídeo fazem para cortar "na batida"; não é perfeito em músicas
 * sem percussão, e a tela deixa ajustar o BPM à mão.
 */

const RATE = 22050
const HOP = 512

export interface BeatMap {
  bpm: number
  /** Segundos desde `offset` da trilha (o tempo do vídeo). */
  beats: number[]
}

/** Lê as batidas do arquivo de áudio a partir de `offset` segundos, por `duration` segundos. */
export async function detectBeats(data: ArrayBuffer, offset = 0, duration = 60): Promise<BeatMap> {
  const decoder = new OfflineAudioContext(1, 1, RATE)
  const decoded = await decoder.decodeAudioData(data.slice(0))
  // Reamostra para mono 22 kHz
  const len = Math.max(1, Math.ceil(Math.min(decoded.duration - offset, duration) * RATE))
  const off = new OfflineAudioContext(1, len, RATE)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start(0, Math.max(0, Math.min(decoded.duration - 0.01, offset)))
  const mono = (await off.startRendering()).getChannelData(0)
  return beatsFromSamples(mono, RATE)
}

/** O mesmo, sobre amostras já em mono (testes). */
export function beatsFromSamples(mono: Float32Array, rate: number): BeatMap {
  const frames = Math.floor(mono.length / HOP)
  const fps = rate / HOP
  // Energia em log por janela, e o ataque = o quanto ela subiu
  const energy = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let j = i * HOP; j < (i + 1) * HOP; j++) sum += mono[j] * mono[j]
    energy[i] = Math.log(1e-6 + sum / HOP)
  }
  const onset = new Float32Array(frames)
  for (let i = 1; i < frames; i++) onset[i] = Math.max(0, energy[i] - energy[i - 1])
  // Tira a média local para os ataques sobressaírem
  const w = Math.round(fps * 0.5)
  const flux = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let s = 0
    let n = 0
    for (let j = Math.max(0, i - w); j <= Math.min(frames - 1, i + w); j++) {
      s += onset[j]
      n++
    }
    flux[i] = Math.max(0, onset[i] - s / n)
  }

  // Andamento: o atraso com a maior autocorrelação, preferindo perto de 120 BPM
  const minLag = Math.floor((60 / 180) * fps)
  const maxLag = Math.ceil((60 / 70) * fps)
  const ac = (lag: number) => {
    let s = 0
    for (let i = lag; i < frames; i++) s += flux[i] * flux[i - lag]
    return s
  }
  let bestLag = Math.round(fps * 0.5)
  let bestScore = -1
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag
    const bias = Math.exp(-Math.pow(Math.log2(bpm / 120), 2) / 0.5)
    const score = ac(lag) * (0.6 + 0.4 * bias)
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  // Período fracionário pela parábola em volta do pico
  const a0 = ac(bestLag - 1)
  const a1 = ac(bestLag)
  const a2 = ac(bestLag + 1)
  const den = a0 - 2 * a1 + a2
  let period = bestLag + (den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a0 - a2)) / den)) : 0)

  const strongest = (c: number, r: number) => {
    let best = Math.max(0, Math.min(frames - 1, c))
    for (let j = c - r; j <= c + r; j++) if (j >= 0 && j < frames && flux[j] > flux[best]) best = j
    return best
  }
  const phaseOf = (p: number) => {
    let bestPhase = 0
    let phaseScore = -1
    for (let ph = 0; ph < p; ph += 0.5) {
      let s = 0
      for (let x = ph; x < frames; x += p) {
        const i = Math.round(x)
        s += flux[i] + 0.5 * (flux[i - 1] ?? 0) + 0.5 * (flux[i + 1] ?? 0)
      }
      if (s > phaseScore) {
        phaseScore = s
        bestPhase = ph
      }
    }
    return bestPhase
  }
  // Duas passadas: grade, encaixe nos ataques reais, reta (início e período) pelos encaixes
  let phase = phaseOf(period)
  const mean = flux.reduce((acc, v) => acc + v, 0) / Math.max(1, frames)
  for (let pass = 0; pass < 2; pass++) {
    const pts: [number, number][] = []
    for (let k = 0; phase + k * period < frames; k++) {
      const j = strongest(Math.round(phase + k * period), 3)
      if (flux[j] > mean * 2) pts.push([k, j])
    }
    if (pts.length < 4) break
    const n = pts.length
    const sx = pts.reduce((acc, [k]) => acc + k, 0)
    const sy = pts.reduce((acc, [, j]) => acc + j, 0)
    const sxx = pts.reduce((acc, [k]) => acc + k * k, 0)
    const sxy = pts.reduce((acc, [k, j]) => acc + k * j, 0)
    const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx)
    if (!(slope > minLag * 0.8 && slope < maxLag * 1.2)) break
    period = slope
    phase = (sy - slope * sx) / n
    while (phase - period >= 0) phase -= period
    while (phase < 0) phase += period
  }

  const bpm = Math.round(((60 * fps) / period) * 10) / 10
  const beats: number[] = []
  // A grade segue a batida, e cada ponto se ajusta ao ataque real mais perto (até 2 janelas)
  for (let x = phase; x < frames && beats.length < 600; x += period) beats.push(Math.round((strongest(Math.round(x), 2) / fps) * 1000) / 1000)
  return { bpm, beats }
}

/** Grade de batidas sem trilha (ou quando a pessoa digita o BPM). */
export function gridBeats(bpm: number, total: number, first = 0): number[] {
  const step = 60 / Math.min(240, Math.max(40, bpm))
  const out: number[] = []
  for (let t = first; t <= total + 1e-6 && out.length < 600; t += step) out.push(Math.round(t * 1000) / 1000)
  return out
}
