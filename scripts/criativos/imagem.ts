import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Geração de imagens para os posts (pessoas, cenas, objetos). O Claude Code e o
 * Codex não geram imagem: quem gera é a API do OpenAI ou a do Google (Gemini),
 * chamada daqui, do computador de quem usa. A chave nunca vai para o navegador
 * nem para a nuvem: fica num arquivo da pasta da pessoa (`~/.superelements`) ou
 * numa variável de ambiente. Não há teste automático contra as APIs: sem chave,
 * nada daqui roda.
 */

export type ImageProvider = 'openai' | 'gemini'
export type ImageRatio = 'square' | 'portrait' | 'landscape'

const FILE = path.join(os.homedir(), '.superelements', 'chaves.json')

const readKeys = (): Partial<Record<ImageProvider, string>> => {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

/** Guarda (ou apaga, com texto vazio) a chave de um serviço neste computador. */
export function saveImageKey(provider: ImageProvider, key: string) {
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

const keyOf = (provider: ImageProvider) => {
  const env = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  return (env || readKeys()[provider] || '').trim() || undefined
}

/** Qual serviço está pronto para gerar (o do OpenAI primeiro); nenhum, sem chave. */
export function imageProvider(): ImageProvider | null {
  return keyOf('openai') ? 'openai' : keyOf('gemini') ? 'gemini' : null
}

export const hasKey = (provider: ImageProvider) => !!keyOf(provider)

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

export interface GeneratedImage {
  data: string
  provider: ImageProvider
  model: string
}

export async function generateImage(prompt: string, ratio: ImageRatio, signal?: AbortSignal): Promise<GeneratedImage> {
  const provider = imageProvider()
  if (!provider) throw new Error('Nenhuma chave de imagem configurada neste computador.')
  const clean = prompt.trim().slice(0, 3500)
  if (!clean) throw new Error('Faltou descrever a imagem.')
  const out = provider === 'openai' ? await viaOpenAI(clean, ratio, signal) : await viaGemini(clean, ratio, signal)
  return { ...out, provider }
}

export const keyFileExists = () => existsSync(FILE)
