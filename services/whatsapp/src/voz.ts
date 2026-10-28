import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Mensagem de voz: o navegador grava WebM/Opus (ou MP4 no Safari) e o WhatsApp só toca
 * como voz o OGG/Opus. Converte com o ffmpeg do Mac (o instalador o põe pelo Homebrew).
 * Sem ffmpeg ou com erro, devolve `undefined` e o envio cai para áudio comum.
 */

// O serviço roda pelo launchd, cujo PATH não inclui o Homebrew
const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find((path) => existsSync(path)) ?? 'ffmpeg'

/** Roda o ffmpeg com o arquivo na entrada e devolve o que sai (ou `undefined` se falhar) */
function ffmpeg(args: string[], input: Buffer): Promise<Buffer | undefined> {
  return new Promise((resolve) => {
    const out: Buffer[] = []
    const child = spawn(FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-vn', ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000)
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => console.error(`ffmpeg: ${chunk.toString().trim()}`))
    child.on('error', (error) => {
      clearTimeout(timer)
      console.error(`ffmpeg não rodou (${error.message}): a mensagem de voz não será enviada.`)
      resolve(undefined)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const buffer = Buffer.concat(out)
      resolve(code === 0 && buffer.length > 0 ? buffer : undefined)
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

export interface Voice {
  ogg: Buffer
  /** Duração em segundos, como o WhatsApp mostra */
  seconds: number
  /** 64 barras de 0 a 100: a forma de onda que o celular desenha na mensagem de voz */
  waveform: Uint8Array
}

/** OGG/Opus mono 48 kHz com a duração e a forma de onda (o app do celular manda as duas) */
export async function toVoice(input: Buffer): Promise<Voice | undefined> {
  const ogg = await ffmpeg(['-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-avoid_negative_ts', 'make_zero', '-f', 'ogg', 'pipe:1'], input)
  if (!ogg) return undefined
  // As amostras vêm do próprio OGG, então a duração e as barras são do que será enviado
  const pcm = await ffmpeg(['-f', 's16le', '-ac', '1', '-ar', '8000', 'pipe:1'], ogg)
  const samples = pcm ? Math.floor(pcm.length / 2) : 0
  if (!pcm || samples < 800) return { ogg, seconds: Math.max(1, Math.round(samples / 8000)), waveform: new Uint8Array(64).fill(20) }
  const bars = 64
  const block = Math.floor(samples / bars)
  const level: number[] = []
  for (let i = 0; i < bars; i++) {
    let sum = 0
    for (let j = 0; j < block; j++) sum += Math.abs(pcm.readInt16LE((i * block + j) * 2))
    level.push(sum / block)
  }
  const peak = Math.max(...level, 1)
  return { ogg, seconds: Math.max(1, Math.round(samples / 8000)), waveform: Uint8Array.from(level, (v) => Math.floor((100 * v) / peak)) }
}
