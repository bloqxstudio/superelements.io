import { outBeats, outWords, segments } from './timeline'
import type { ExplainerBeat, ExplainerData, SfxId } from './types'

/**
 * O som do vídeo explicativo, mixado num AudioBuffer de 48 kHz que vai direto ao MP4
 * (`encodeMp4({ mixed })`) e toca igual na prévia (2026-11-08, o usuário: "quero deixar melhor com
 * voz e efeitos melhores"):
 * - **Voz**: só os trechos mantidos (cortes com 8 ms de fade, sem estalo); tratada como num
 *   estúdio de podcast (corta graves abaixo de 80 Hz, tira o "embolado" em 280 Hz, presença em
 *   3,2 kHz, brilho em 9 kHz, compressor) e nivelada no volume de redes (RMS ~ −18 dBFS); nas
 *   pausas entre frases o ruído do ambiente desce 12 dB, pelos tempos da transcrição.
 * - **Trilha de fundo** (opcional, áudio do conjunto): em loop, entra e sai suave e abaixa sozinha
 *   enquanto há fala ("ducking").
 * - **Efeitos** sintetizados aqui (sem arquivo e sem licença de terceiros), com espaço (reverb
 *   curto) e estéreo: whoosh que cruza da esquerda para a direita, swish leve, pop, impacto com
 *   sub, clique de interface, digitação, ding de sino e subida antes de revelar.
 */

const RATE = 48000

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 7) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(seconds * ctx.sampleRate)), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let x = seed
  for (let i = 0; i < d.length; i++) {
    x = (x * 1664525 + 1013904223) >>> 0
    d[i] = x / 2147483648 - 1
  }
  return buf
}
const noise = (ctx: BaseAudioContext, seconds: number, seed?: number) => Object.assign(ctx.createBufferSource(), { buffer: noiseBuffer(ctx, seconds, seed) })

/** Sala curta (reverb) gerada: ruído estéreo que decai em ~0,9 s. */
export function room(ctx: BaseAudioContext) {
  const len = Math.ceil(0.9 * ctx.sampleRate)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let x = 11 + ch * 97
    for (let i = 0; i < len; i++) {
      x = (x * 1664525 + 1013904223) >>> 0
      d[i] = (x / 2147483648 - 1) * Math.pow(1 - i / len, 3)
    }
  }
  const c = ctx.createConvolver()
  c.buffer = buf
  return c
}

const env = (g: GainNode, at: number, peak: number, attack: number, decay: number) => {
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
}

/** Agenda um efeito em `at` (segundos). `dry` é a saída direta; `wet` vai para a sala. */
export function scheduleSfx(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, kind: SfxId, at: number, volume: number) {
  if (kind === 'nenhum' || volume <= 0) return
  const v = volume
  const out = (node: AudioNode, wetAmount = 0.25, pan?: StereoPannerNode) => {
    const target = pan ?? node
    if (pan) node.connect(pan)
    target.connect(dry)
    const w = ctx.createGain()
    w.gain.value = wetAmount
    target.connect(w).connect(wet)
  }

  if (kind === 'whoosh' || kind === 'swish') {
    const len = kind === 'whoosh' ? 0.5 : 0.28
    // Duas camadas de ar: uma grave que dá corpo, uma aguda que dá velocidade
    for (const [lo, hi, q, gain, seed] of [[260, 1800, 0.9, 0.5, 3], [1400, 7000, 1.4, 0.32, 9]] as const) {
      const src = noise(ctx, len, seed)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = q
      bp.frequency.setValueAtTime(lo, at)
      bp.frequency.exponentialRampToValueAtTime(hi, at + len * 0.7)
      bp.frequency.exponentialRampToValueAtTime(hi * 0.7, at + len)
      const g = ctx.createGain()
      env(g, at, gain * v * (kind === 'swish' ? 0.6 : 1), len * 0.55, len * 0.45)
      const pan = ctx.createStereoPanner()
      pan.pan.setValueAtTime(-0.7, at)
      pan.pan.linearRampToValueAtTime(0.7, at + len)
      src.connect(bp).connect(g)
      out(g, 0.18, pan)
      src.start(at)
      src.stop(at + len + 0.05)
    }
    return
  }
  if (kind === 'subida') {
    const len = 0.85
    const src = noise(ctx, len, 21)
    const hp = ctx.createBiquadFilter()
    hp.type = 'bandpass'
    hp.Q.value = 2
    hp.frequency.setValueAtTime(300, at)
    hp.frequency.exponentialRampToValueAtTime(6000, at + len)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.45 * v, at + len * 0.95)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.04)
    src.connect(hp).connect(g)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(180, at)
    o.frequency.exponentialRampToValueAtTime(900, at + len)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, at)
    og.gain.exponentialRampToValueAtTime(0.12 * v, at + len * 0.95)
    og.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.04)
    o.connect(og)
    out(g, 0.3)
    out(og, 0.2)
    src.start(at)
    o.start(at)
    o.stop(at + len + 0.1)
    return
  }
  if (kind === 'pop') {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(720, at)
    o.frequency.exponentialRampToValueAtTime(240, at + 0.08)
    const g = ctx.createGain()
    env(g, at, 0.5 * v, 0.004, 0.11)
    o.connect(g)
    out(g, 0.15)
    o.start(at)
    o.stop(at + 0.15)
    // estalo curto na frente
    const n = noise(ctx, 0.015, 5)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3000
    const ng = ctx.createGain()
    env(ng, at, 0.25 * v, 0.001, 0.012)
    n.connect(hp).connect(ng)
    out(ng, 0.05)
    n.start(at)
    return
  }
  if (kind === 'clique' || kind === 'digitar') {
    const hits = kind === 'clique' ? [0] : [0, 0.09, 0.16, 0.27, 0.34, 0.46, 0.55, 0.63]
    hits.forEach((d, i) => {
      const t = at + d
      const n = noise(ctx, 0.02, 30 + i)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = kind === 'clique' ? 3200 : 2200 + (i % 3) * 500
      bp.Q.value = 3
      const g = ctx.createGain()
      env(g, t, (kind === 'clique' ? 0.7 : 0.35) * v, 0.0015, 0.02)
      n.connect(bp).connect(g)
      const o = ctx.createOscillator()
      o.frequency.value = kind === 'clique' ? 1800 : 1200
      const og = ctx.createGain()
      env(og, t, (kind === 'clique' ? 0.12 : 0.05) * v, 0.001, 0.025)
      o.connect(og)
      out(g, 0.08)
      out(og, 0.05)
      n.start(t)
      o.start(t)
      o.stop(t + 0.04)
    })
    return
  }
  if (kind === 'ding') {
    // Sino: parciais inarmônicos que decaem em tempos diferentes
    for (const [f, k, d] of [[1046.5, 1, 1.4], [2093, 0.45, 0.9], [2637, 0.25, 0.7], [3520, 0.12, 0.4]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      env(g, at, 0.22 * v * k, 0.004, d)
      o.connect(g)
      out(g, 0.35)
      o.start(at)
      o.stop(at + d + 0.1)
    }
    return
  }
  // impacto: sub que cai + corpo + ruído curto, com sala
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(110, at)
  o.frequency.exponentialRampToValueAtTime(36, at + 0.45)
  const og = ctx.createGain()
  env(og, at, 0.9 * v, 0.006, 0.55)
  o.connect(og)
  out(og, 0.1)
  o.start(at)
  o.stop(at + 0.65)
  const n = noise(ctx, 0.25, 41)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(3500, at)
  lp.frequency.exponentialRampToValueAtTime(400, at + 0.2)
  const ng = ctx.createGain()
  env(ng, at, 0.45 * v, 0.002, 0.22)
  n.connect(lp).connect(ng)
  out(ng, 0.4)
  n.start(at)
}

/** O instante do efeito de um momento: um pouco antes, para o som cair junto com a imagem. */
export const sfxAt = (beat: ExplainerBeat) => Math.max(0, beat.start - (beat.sfx === 'whoosh' ? 0.22 : beat.sfx === 'swish' ? 0.12 : beat.sfx === 'subida' ? 0.8 : 0))

const dbToGain = (db: number) => Math.pow(10, db / 20)

/** Ganho para levar a fala a ~−18 dBFS RMS (o volume que funciona no celular). */
function levelGain(buffer: AudioBuffer, spans: { s: number; e: number }[]) {
  const d = buffer.getChannelData(0)
  let sum = 0
  let n = 0
  for (const sp of spans.length ? spans : [{ s: 0, e: buffer.duration }]) {
    const a = Math.floor(sp.s * buffer.sampleRate)
    const b = Math.min(d.length, Math.floor(sp.e * buffer.sampleRate))
    for (let i = a; i < b; i += 4) {
      sum += d[i] * d[i]
      n++
    }
  }
  if (!n) return 1
  const rms = Math.sqrt(sum / n)
  if (rms < 1e-5) return 1
  return Math.min(6, Math.max(0.4, dbToGain(-18) / rms))
}

export interface MixOptions {
  voiceVolume: number
  sfxVolume: number
  enhance?: boolean
  gate?: boolean
  music?: { data: ArrayBuffer; volume: number }
}

/** Voz (com cortes e tratamento) + trilha (com ducking) + efeitos, do tamanho exato do vídeo. */
export async function mixExplainer(voice: ArrayBuffer | undefined, data: ExplainerData, total: number, opts: MixOptions): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * RATE)), RATE)
  // Limitador no fim: nada estoura, a voz fica na frente
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -4
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.1
  // Margem de 1 dB depois do limitador: o compressor do navegador deixa passar picos rápidos (no teste da Tiger o pico chegou a 0 dB)
  const ceiling = ctx.createGain()
  ceiling.gain.value = 0.84
  limiter.connect(ceiling).connect(ctx.destination)
  const bus = ctx.createGain()
  bus.connect(limiter)
  const words = outWords(data)

  // ——— Voz ———
  if (voice) {
    const buffer = await ctx.decodeAudioData(voice.slice(0))
    const segs = segments(data)
    let chain: AudioNode = ctx.createGain()
    const input = chain as GainNode
    if (opts.enhance !== false) {
      const hp = Object.assign(ctx.createBiquadFilter(), { type: 'highpass' as BiquadFilterType })
      hp.frequency.value = 80
      hp.Q.value = 0.7
      const mud = Object.assign(ctx.createBiquadFilter(), { type: 'peaking' as BiquadFilterType })
      mud.frequency.value = 280
      mud.Q.value = 1
      mud.gain.value = -2.5
      const presence = Object.assign(ctx.createBiquadFilter(), { type: 'peaking' as BiquadFilterType })
      presence.frequency.value = 3200
      presence.Q.value = 0.9
      presence.gain.value = 3
      const air = Object.assign(ctx.createBiquadFilter(), { type: 'highshelf' as BiquadFilterType })
      air.frequency.value = 9000
      air.gain.value = 2
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -24
      comp.knee.value = 6
      comp.ratio.value = 3.5
      comp.attack.value = 0.005
      comp.release.value = 0.12
      const makeup = ctx.createGain()
      makeup.gain.value = levelGain(buffer, segs) * dbToGain(3)
      chain.connect(hp).connect(mud).connect(presence).connect(air).connect(comp).connect(makeup)
      chain = makeup
    }
    // Ruído entre as frases: desce 12 dB nas pausas (tempo do vídeo)
    const gate = ctx.createGain()
    gate.gain.value = 1
    if (opts.gate !== false && words.length) {
      const low = dbToGain(-12)
      gate.gain.setValueAtTime(words[0].s > 0.3 ? low : 1, 0)
      for (let i = 0; i < words.length; i++) {
        const w = words[i]
        const next = words[i + 1]
        gate.gain.setTargetAtTime(1, Math.max(0, w.s - 0.08), 0.015)
        const gapEnd = next ? next.s : total
        if (gapEnd - w.e > 0.35) {
          gate.gain.setTargetAtTime(low, w.e + 0.12, 0.06)
        }
      }
    }
    const vol = ctx.createGain()
    vol.gain.value = Math.min(1.5, Math.max(0, opts.voiceVolume))
    chain.connect(gate).connect(vol).connect(bus)
    // Só os trechos mantidos, cada um com fade curto nas pontas (sem estalo no corte)
    for (const g of segs) {
      const len = g.e - g.s
      if (len <= 0.01) continue
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const f = ctx.createGain()
      const fade = Math.min(0.008, len / 3)
      f.gain.setValueAtTime(0, g.at)
      f.gain.linearRampToValueAtTime(1, g.at + fade)
      f.gain.setValueAtTime(1, g.at + len - fade)
      f.gain.linearRampToValueAtTime(0, g.at + len)
      src.connect(f).connect(input)
      src.start(g.at, g.s, len)
    }
  }

  // ——— Trilha de fundo com ducking ———
  if (opts.music) {
    try {
      const buffer = await ctx.decodeAudioData(opts.music.data.slice(0))
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = buffer.duration < total
      const g = ctx.createGain()
      const base = Math.min(1, Math.max(0, opts.music.volume))
      const duck = voice && words.length ? base * 0.22 : base
      g.gain.setValueAtTime(0, 0)
      g.gain.linearRampToValueAtTime(words.length && words[0].s < 1 ? duck : base, 0.6)
      if (voice) {
        for (let i = 0; i < words.length; i++) {
          const w = words[i]
          const next = words[i + 1]
          g.gain.setTargetAtTime(duck, Math.max(0.6, w.s - 0.15), 0.05)
          if (!next || next.s - w.e > 0.7) g.gain.setTargetAtTime(base, w.e + 0.2, 0.2)
        }
      }
      g.gain.setTargetAtTime(0, Math.max(0.7, total - 1.2), 0.35)
      src.connect(g).connect(bus)
      src.start(0)
    } catch {
      // Trilha que o navegador não lê: segue sem ela
    }
  }

  // ——— Efeitos ———
  const fx = ctx.createGain()
  fx.gain.value = 0.85
  fx.connect(bus)
  const wet = ctx.createGain()
  wet.gain.value = 0.6
  wet.connect(room(ctx)).connect(bus)
  outBeats(data, total).forEach((b, i) => {
    if (i === 0 && b.start < 0.2 && (b.sfx === 'whoosh' || b.sfx === 'subida')) return
    scheduleSfx(ctx, fx, wet, b.sfx, sfxAt(b), opts.sfxVolume)
  })
  return ctx.startRendering()
}
