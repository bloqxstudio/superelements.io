import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Baixa um reel ou vídeo público do Instagram pelo link, para servir de REFERÊNCIA de estilo no
 * vídeo explicativo (2026-11-07, o usuário: "permita enviar um video do instagram como
 * referencia"; escolheu baixar pelo link sabendo que muda a regra de não raspar o Instagram e
 * que os termos da Meta não permitem). Só um link por vez, digitado pela pessoa; nada
 * automatizado em perfis, sem login, sem cookies. Roda no computador de quem usa, pelo yt-dlp
 * (`brew install yt-dlp`), nunca no servidor. O vídeo só vira quadros para a IA ver o estilo:
 * não entra no conjunto nem é publicado.
 */

const MAX_BYTES = 40 * 1024 * 1024
const TIMEOUT = 120_000

const BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', path.join(os.homedir(), '.local/bin')]

function findYtDlp(): string | undefined {
  if (process.env.SE_YTDLP_BIN && existsSync(process.env.SE_YTDLP_BIN)) return process.env.SE_YTDLP_BIN
  const names = process.platform === 'win32' ? ['yt-dlp.exe'] : ['yt-dlp']
  const dirs = [...(process.env.PATH ?? '').split(path.delimiter), ...BIN_DIRS]
  for (const dir of dirs) for (const n of names) if (dir && existsSync(path.join(dir, n))) return path.join(dir, n)
  return undefined
}

export const reelSupported = () => !!findYtDlp()

/** Aceita só links de post, reel ou vídeo do Instagram (sem perfis, stories ou listas). */
export function reelUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('Cole o link completo do reel (https://www.instagram.com/reel/…).')
  }
  if (!/^(www\.)?instagram\.com$/i.test(url.hostname)) throw new Error('O link precisa ser do instagram.com.')
  const m = url.pathname.match(/^\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]{5,40})\/?$/)
  if (!m) throw new Error('Use o link de um reel ou post de vídeo (instagram.com/reel/… ou /p/…), não de um perfil ou story.')
  return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`
}

export async function downloadReel(raw: string, signal?: AbortSignal, onStep?: (detail: string) => void): Promise<{ data: string; type: string; name: string }> {
  const url = reelUrl(raw)
  const bin = findYtDlp()
  if (!bin) throw new Error('Para baixar do Instagram, instale o yt-dlp neste computador (no Mac: brew install yt-dlp) e tente de novo. Ou baixe o reel e envie o arquivo.')
  const dir = mkdtempSync(path.join(os.tmpdir(), 'se-reel-'))
  try {
    onStep?.('Baixando o reel…')
    await new Promise<void>((resolve, reject) => {
      // Sem shell e sem cookies; o menor MP4 que ainda mostra bem o estilo
      const child = spawn(bin, ['--no-playlist', '--no-warnings', '--no-progress', '--max-filesize', '40M', '-f', 'best[height<=720][ext=mp4]/best[ext=mp4]/best', '-o', path.join(dir, 'reel.%(ext)s'), url], { stdio: ['ignore', 'ignore', 'pipe'] })
      let err = ''
      child.stderr?.on('data', (d) => (err = (err + String(d)).slice(-2000)))
      const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT)
      const abort = () => child.kill('SIGKILL')
      signal?.addEventListener('abort', abort)
      child.on('error', (e) => reject(e))
      child.on('close', (code) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        if (signal?.aborted) return reject(new Error('Cancelado.'))
        if (code === 0) return resolve()
        if (/login|log in|rate-limit|private|not available/i.test(err)) return reject(new Error('O Instagram não liberou esse vídeo sem login (perfil privado ou limite de acessos). Baixe pelo celular e envie o arquivo.'))
        reject(new Error(`Não consegui baixar o reel: ${err.split('\n').filter(Boolean).pop()?.replace(/^ERROR:\s*/, '').slice(0, 200) || `yt-dlp saiu com ${code}`}`))
      })
    })
    const file = readdirSync(dir).find((f) => f.startsWith('reel.'))
    if (!file) throw new Error('O Instagram não devolveu um vídeo nesse link (é uma foto?).')
    const full = path.join(dir, file)
    if (statSync(full).size > MAX_BYTES) throw new Error('O vídeo passa de 40 MB.')
    const ext = path.extname(file).slice(1).toLowerCase()
    const type = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'
    return { data: `data:${type};base64,${readFileSync(full).toString('base64')}`, type, name: `${url.split('/').filter(Boolean).pop()}.${ext}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
