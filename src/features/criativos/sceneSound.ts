import { room, scheduleSfx } from './explicativo/sfx'
import { SFX, type SfxId } from './explicativo/types'

/**
 * Efeitos sonoros numa animação em código (2026-11-09; o usuário: "aplique efeitos sonoros também"). Os mesmos
 * efeitos sintetizados do vídeo explicativo (`explicativo/sfx.ts`: whoosh, swish, pop, impacto, clique, digitação,
 * ding, subida; sem arquivo nem licença de terceiros), marcados no tempo da animação (`data.sfx`) e mixados com a
 * narração num WAV só. Esse WAV vira a trilha da cena: a prévia, o MP4 e o reels tocam igual.
 */

export interface SceneCue { at: number; kind: SfxId; volume?: number }
export const SFX_LABEL = SFX

const RATE = 48000

/** Voz + efeitos (com um pouco de sala), com limitador, do tamanho do vídeo. */
export async function bakeSceneAudio(voice: ArrayBuffer | undefined, cues: SceneCue[], total: number, opts: { sfxVolume?: number; voiceVolume?: number } = {}): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * RATE)), RATE)
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -4
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.1
  const ceiling = ctx.createGain()
  ceiling.gain.value = 0.84
  limiter.connect(ceiling).connect(ctx.destination)
  const bus = ctx.createGain()
  bus.connect(limiter)
  if (voice) {
    const src = ctx.createBufferSource()
    src.buffer = await ctx.decodeAudioData(voice.slice(0))
    const g = ctx.createGain()
    g.gain.value = opts.voiceVolume ?? 1
    src.connect(g).connect(bus)
    src.start(0)
  }
  const sfx = ctx.createGain()
  sfx.gain.value = opts.sfxVolume ?? 0.6
  sfx.connect(bus)
  const wet = room(ctx)
  const wetOut = ctx.createGain()
  wetOut.gain.value = 0.5
  wet.connect(wetOut).connect(sfx)
  for (const c of cues) if (c.at >= 0 && c.at < total) scheduleSfx(ctx, sfx, wet, c.kind, c.at, c.volume ?? 1)
  return ctx.startRendering()
}

/** O AudioBuffer em WAV 16 bits (a trilha sobe ao conjunto como um áudio comum). */
export function wavOf(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels, len = buffer.length, rate = buffer.sampleRate
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2))
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(at + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, rate, true)
  out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * ch * 2, true)
  const data = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i))
  let at = 44
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(at, v < 0 ? v * 0x8000 : v * 0x7fff, true); at += 2 }
  return new Blob([out.buffer], { type: 'audio/wav' })
}
