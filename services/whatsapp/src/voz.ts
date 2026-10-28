import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Mensagem de voz: o navegador grava WebM/Opus (ou MP4 no Safari) e o WhatsApp só toca
 * como voz o OGG/Opus. Converte com o ffmpeg do Mac (o instalador o põe pelo Homebrew).
 * Sem ffmpeg ou com erro, devolve `undefined` e o envio cai para áudio comum.
 */

// O serviço roda pelo launchd, cujo PATH não inclui o Homebrew
const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find((path) => existsSync(path)) ?? 'ffmpeg'

export function toVoice(input: Buffer): Promise<Buffer | undefined> {
  return new Promise((resolve) => {
    const out: Buffer[] = []
    const child = spawn(FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-f', 'ogg', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000)
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => console.error(`ffmpeg: ${chunk.toString().trim()}`))
    child.on('error', (error) => {
      clearTimeout(timer)
      console.error(`ffmpeg não rodou (${error.message}): a mensagem de voz vai como áudio comum.`)
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
