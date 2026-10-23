import type { ChildProcess } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findBin, kill, launch } from '../space/chatPlugin.ts'

/**
 * Geração de imagens para os posts (pessoas, cenas, objetos), no computador de
 * quem usa. O caminho principal é o Codex: ele tem uma ferramenta de imagem
 * embutida (`image_gen`) que usa o login do ChatGPT, sem chave de API, e grava o
 * arquivo em `~/.codex/generated_images/`. Como alternativa, a API do OpenAI ou
 * a do Google (Gemini), com uma chave que fica só num arquivo da pasta da
 * pessoa (`~/.superelements`) ou numa variável de ambiente, nunca no navegador
 * nem na nuvem. Sem acesso às contas, nada daqui foi testado contra os serviços.
 */

export type ImageProvider = 'codex' | 'openai' | 'gemini'
export type ImageRatio = 'square' | 'portrait' | 'landscape'

const FILE = path.join(os.homedir(), '.superelements', 'chaves.json')

const readKeys = (): Partial<Record<'openai' | 'gemini', string>> => {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

/** Guarda (ou apaga, com texto vazio) a chave de um serviço neste computador. */
export function saveImageKey(provider: 'openai' | 'gemini', key: string) {
  const keys = readKeys()
  const clean = key.trim()
  if (clean) keys[provider] = clean
  else delete keys[provider]
  mkdirSync(path.dirname(FILE), { recursive: true })
  writeFileSync(FILE, JSON.stringify(keys, null, 2), { mode: 0o600 })
  try {
    chmodSync(FILE, 0o600)
  } catch {
    // Windows: as permissões da pasta do usuário já valem
  }
}

const keyOf = (provider: 'openai' | 'gemini') => {
  const env = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  return (env || readKeys()[provider] || '').trim() || undefined
}

/** Os serviços prontos neste computador, do preferido ao último: o Codex (sem chave), depois os de chave. */
export function imageProviders(): ImageProvider[] {
  return [...(findBin('codex') ? (['codex'] as const) : []), ...(keyOf('openai') ? (['openai'] as const) : []), ...(keyOf('gemini') ? (['gemini'] as const) : [])]
}

/** O primeiro serviço pronto; nenhum, se não há Codex nem chave. */
export const imageProvider = (): ImageProvider | null => imageProviders()[0] ?? null

export const hasKey = (provider: 'openai' | 'gemini') => !!keyOf(provider)

const OPENAI_MODEL = () => process.env.SE_OPENAI_IMAGE_MODEL || 'gpt-image-1'
const GEMINI_MODEL = () => process.env.SE_GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview'

const OPENAI_SIZE: Record<ImageRatio, string> = { square: '1024x1024', portrait: '1024x1536', landscape: '1536x1024' }
const GEMINI_RATIO: Record<ImageRatio, string> = { square: '1:1', portrait: '3:4', landscape: '4:3' }

const fail = async (res: Response, who: string): Promise<never> => {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string }; message?: string }
    detail = String(body?.error?.message ?? body?.message ?? '').slice(0, 300)
  } catch {
    // corpo que não é JSON
  }
  if (res.status === 401 || res.status === 403) throw new Error(`${who} recusou a chave (${res.status}). Confira se ela está certa e tem acesso à geração de imagens.${detail ? ` ${detail}` : ''}`)
  if (res.status === 429) throw new Error(`${who}: limite de uso ou de créditos atingido. ${detail}`.trim())
  throw new Error(`${who} respondeu ${res.status}.${detail ? ` ${detail}` : ''}`)
}

async function viaOpenAI(prompt: string, ratio: ImageRatio, signal?: AbortSignal) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${keyOf('openai')}` },
    body: JSON.stringify({ model: OPENAI_MODEL(), prompt, size: OPENAI_SIZE[ratio], n: 1, quality: 'medium' }),
    signal,
  })
  if (!res.ok) return fail(res, 'O OpenAI')
  const body = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = body.data?.[0]?.b64_json
  if (!b64) throw new Error('O OpenAI não devolveu a imagem.')
  return { data: `data:image/png;base64,${b64}`, model: OPENAI_MODEL() }
}

async function viaGemini(prompt: string, ratio: ImageRatio, signal?: AbortSignal) {
  const model = GEMINI_MODEL()
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': keyOf('gemini') ?? '' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: GEMINI_RATIO[ratio] } } }),
    signal,
  })
  if (!res.ok) return fail(res, 'O Google')
  const body = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; thought?: boolean }[] } }[] }
  // A última imagem que não seja um rascunho do raciocínio
  const part = (body.candidates?.[0]?.content?.parts ?? []).filter((p) => p.inlineData?.data && !p.thought).at(-1)
  if (!part?.inlineData?.data) throw new Error('O Google não devolveu a imagem (a descrição pode ter sido recusada). Tente outra descrição.')
  return { data: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`, model }
}


// ---------- Codex (ferramenta de imagem embutida, login do ChatGPT) ----------

const IMAGE_FILE = /\.(png|jpe?g|webp)$/i
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
const SHAPE: Record<ImageRatio, string> = { square: 'square, 1:1', portrait: 'portrait, vertical 2:3', landscape: 'landscape, horizontal 3:2' }

const codexHome = () => process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex')

/** O arquivo de imagem mais novo (depois de `since`) numa pasta, ou nas pastas dela. */
function newestImage(dir: string, since: number, depth = 1): { file: string; at: number } | undefined {
  let best: { file: string; at: number } | undefined
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return undefined
  }
  for (const name of entries) {
    const full = path.join(dir, name)
    let info
    try {
      info = statSync(full)
    } catch {
      continue
    }
    const found = info.isDirectory() ? (depth > 0 ? newestImage(full, since, depth - 1) : undefined) : IMAGE_FILE.test(name) && info.mtimeMs >= since ? { file: full, at: info.mtimeMs } : undefined
    if (found && (!best || found.at > best.at)) best = found
  }
  return best
}

async function viaCodex(prompt: string, ratio: ImageRatio, signal?: AbortSignal): Promise<{ data: string; model: string }> {
  const bin = findBin('codex')
  if (!bin) throw new Error('O Codex não foi encontrado neste computador.')
  const text = [
    'Use your built-in image generation tool (image_gen) to create exactly ONE image, and nothing else.',
    'Do not write code, do not create or edit project files, do not search the web, do not ask questions.',
    `Image description: ${prompt}`,
    `Orientation: ${SHAPE[ratio]}.`,
    'When the image is generated, reply with the single word OK.',
  ].join('\n')

  const run = (extra: string[]) =>
    new Promise<{ file?: string; reply: string; stderr: string; code: number | null }>((resolve, reject) => {
      const cwd = mkdtempSync(path.join(os.tmpdir(), 'se-imagem-'))
      const startedAt = Date.now() - 2000
      const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
      for (const key of ['CODEX_THREAD_ID', 'CODEX_SESSION_ID']) delete env[key]
      let child: ChildProcess
      try {
        child = launch(bin, ['exec', '--json', '--skip-git-repo-check', '-s', 'workspace-write', '-c', 'approval_policy="never"', ...extra, '-'], { cwd, env })
      } catch (error) {
        rmSync(cwd, { recursive: true, force: true })
        return reject(new Error(`Não consegui abrir o Codex: ${error instanceof Error ? error.message : String(error)}`))
      }
      let buffer = ''
      let stderr = ''
      let reply = ''
      let thread = ''
      let settled = false
      let lastOutput = Date.now()
      const done = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        clearInterval(idle)
        signal?.removeEventListener('abort', abort)
        kill(child)
        // O arquivo que o Codex gravou: na pasta da conversa dele; ou, por garantia, na pasta de trabalho
        const home = path.join(codexHome(), 'generated_images')
        const hit = (thread && newestImage(path.join(home, thread), startedAt, 0)) || newestImage(cwd, startedAt, 1) || newestImage(home, startedAt, 1)
        const file = hit?.file
        let copy = ''
        if (file) {
          try {
            copy = path.join(os.tmpdir(), `se-imagem-${Date.now()}${path.extname(file)}`)
            writeFileSync(copy, readFileSync(file))
          } catch {
            copy = file
          }
        }
        setTimeout(() => {
          try {
            rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
          } catch {
            // fica para a limpeza do sistema
          }
        }, 1000).unref()
        if (error) reject(error)
        else resolve({ file: copy || undefined, reply, stderr, code: child.exitCode })
      }
      const abort = () => done(new DOMException('Parou', 'AbortError'))
      signal?.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(() => done(new Error('O Codex passou de 4 minutos para gerar a imagem.')), 240_000)
      const idle = setInterval(() => {
        if (Date.now() - lastOutput > 150_000) done(new Error('O Codex parou de responder (sem sinal há mais de 2 minutos).'))
      }, 5000)
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', (chunk: string) => {
        lastOutput = Date.now()
        buffer += chunk
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line.startsWith('{')) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'thread.started' && event.thread_id) thread = String(event.thread_id)
            else if (event.type === 'item.completed' && event.item?.type === 'agent_message') reply = String(event.item.text ?? '')
          } catch {
            // linha que não é evento
          }
        }
      })
      child.stderr?.setEncoding('utf8')
      child.stderr?.on('data', (chunk: string) => {
        lastOutput = Date.now()
        stderr = (stderr + chunk).slice(-4000)
      })
      child.on('error', (error) => done(new Error(`Não consegui abrir o Codex: ${error.message}`)))
      child.on('close', () => done())
      child.stdin?.on('error', () => {})
      child.stdin?.end(text)
    })

  // `--enable image_generation` liga a ferramenta em versões que ainda a tratam como recurso opcional; se a versão não conhece a opção, tenta sem ela
  let result = await run(['--enable', 'image_generation'])
  if (!result.file && /(unexpected argument|unknown (feature|option)|unrecognized)/i.test(result.stderr)) result = await run([])
  if (!result.file) {
    const why = result.stderr.split('\n').filter((l) => l.trim() && !/rmcp::|failed to load skill|AuthRequired/.test(l)).slice(-3).join(' ')
    if (/log ?in|not logged|unauthorized|401/i.test(why + result.reply)) throw new Error('O Codex não está logado neste computador. Rode `codex login` no terminal e tente de novo.')
    throw new Error(`O Codex não gerou a imagem.${result.reply && result.reply !== 'OK' ? ` Ele disse: ${result.reply.slice(0, 240)}` : why ? ` ${why.slice(0, 240)}` : ' A ferramenta de imagem pode não estar disponível nesta versão ou conta.'}`)
  }
  const buf = readFileSync(result.file)
  try {
    rmSync(result.file, { force: true })
  } catch {
    // arquivo temporário
  }
  const ext = path.extname(result.file).slice(1).toLowerCase()
  return { data: `data:${MIME[ext] ?? 'image/png'};base64,${buf.toString('base64')}`, model: 'codex image_gen' }
}

export interface GeneratedImage {
  data: string
  provider: ImageProvider
  model: string
}

export async function generateImage(prompt: string, ratio: ImageRatio, signal?: AbortSignal, prefer?: ImageProvider): Promise<GeneratedImage> {
  const ready = imageProviders()
  const provider = prefer && ready.includes(prefer) ? prefer : ready[0]
  if (!provider) throw new Error('Nenhum serviço de imagem pronto neste computador: instale e entre no Codex, ou guarde uma chave do OpenAI ou do Google.')
  const clean = prompt.trim().slice(0, 3500)
  if (!clean) throw new Error('Faltou descrever a imagem.')
  const out = provider === 'codex' ? await viaCodex(clean, ratio, signal) : provider === 'openai' ? await viaOpenAI(clean, ratio, signal) : await viaGemini(clean, ratio, signal)
  return { ...out, provider }
}

export const keyFileExists = () => existsSync(FILE)
