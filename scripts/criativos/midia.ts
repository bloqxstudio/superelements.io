import { apiKey } from './imagem.ts'
import { assertPublic } from './baixar.ts'

/**
 * Mídia real para o vídeo explicativo (2026-11-08, o usuário: "permita a Iara usar imagens reais, do
 * painel, da moto… usar vídeos… podemos usar o GPT para gerar esses vídeos… só vídeos de poucos
 * segundos"). Roda no conector:
 * - fotos com licença livre para uso comercial (Openverse: Wikimedia, Flickr e outros acervos CC),
 *   com autor, licença e página para o crédito; nada de foto qualquer da internet (direitos autorais);
 * - download de uma imagem ou vídeo público (até 15 MB), sem as travas de CORS do navegador;
 * - clipes curtos gerados pela OpenAI (Sora 2, 4 s, vertical), com a chave da OpenAI deste computador.
 */

export interface FreeImage { id: string; url: string; thumb?: string; title: string; creator?: string; license: string; licenseUrl?: string; page?: string; width: number; height: number; source: string }

export async function searchFreeImages(q: string, signal?: AbortSignal): Promise<FreeImage[]> {
  const query = q.trim().slice(0, 120)
  if (!query) return []
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&page_size=20&mature=false`
  const res = await fetch(url, { signal, headers: { 'user-agent': 'Sinfy (criativos)' } })
  if (!res.ok) throw new Error(`A busca de fotos livres falhou (${res.status}).`)
  const j = (await res.json()) as { results?: { id: string; url: string; thumbnail?: string; title?: string; creator?: string; license: string; license_version?: string; license_url?: string; foreign_landing_url?: string; width?: number; height?: number; source?: string }[] }
  return (j.results ?? [])
    .filter((r) => (r.width ?? 0) >= 800 && (r.height ?? 0) >= 600 && !/^(nd|by-nd|by-nc)/.test(r.license))
    .map((r) => ({ id: r.id, url: r.url, thumb: r.thumbnail, title: (r.title ?? '').slice(0, 120), creator: r.creator?.slice(0, 80), license: `CC ${r.license.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`, licenseUrl: r.license_url, page: r.foreign_landing_url, width: r.width ?? 0, height: r.height ?? 0, source: r.source ?? '' }))
}

const MAX_MEDIA = 15 * 1024 * 1024

export async function downloadMedia(rawUrl: string, signal?: AbortSignal): Promise<{ data: string; type: string }> {
  let url = new URL(rawUrl)
  for (let hop = 0; hop <= 4; hop++) {
    await assertPublic(url)
    const res = await fetch(url, { redirect: 'manual', signal, headers: { 'user-agent': 'Sinfy (criativos)' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url)
      continue
    }
    if (!res.ok) throw new Error(`O arquivo respondeu ${res.status}.`)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!/^(image\/(png|jpe?g|webp|gif)|video\/(mp4|webm|quicktime))$/.test(type)) throw new Error('O endereço não é uma imagem ou vídeo.')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_MEDIA) throw new Error('O arquivo passa de 15 MB.')
    return { data: `data:${type};base64,${buf.toString('base64')}`, type }
  }
  throw new Error('Redirecionamentos demais.')
}

/** Um clipe curto (4 s, vertical) gerado pela OpenAI. Sem marcas, logos nem texto no prompt. */
export async function generateClip(req: { prompt: string; seconds?: number }, signal?: AbortSignal, onStep?: (detail: string) => void): Promise<{ data: string; type: string; seconds: number }> {
  const key = apiKey('openai')
  if (!key) throw new Error('Sem chave da OpenAI neste computador para gerar vídeo.')
  const prompt = String(req.prompt ?? '').trim().slice(0, 1500)
  if (!prompt) throw new Error('O pedido do vídeo veio vazio.')
  const seconds = [4, 8].includes(Number(req.seconds)) ? Number(req.seconds) : 4
  const model = process.env.SE_OPENAI_VIDEO_MODEL || 'sora-2'
  const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  const created = await fetch('https://api.openai.com/v1/videos', { method: 'POST', signal, headers, body: JSON.stringify({ model, prompt, seconds: String(seconds), size: '720x1280' }) })
  if (created.status === 404) throw new Error('A conta da OpenAI não tem o Sora (vídeo) liberado. Libere em platform.openai.com; até lá o vídeo usa as fotos reais.')
  if (!created.ok) throw new Error(`A OpenAI não começou o vídeo (${created.status}): ${(await created.text().catch(() => '')).slice(0, 240)}`)
  const job = (await created.json()) as { id: string }
  const until = Date.now() + 8 * 60_000
  for (;;) {
    if (signal?.aborted) throw new Error('Cancelado.')
    if (Date.now() > until) throw new Error('O vídeo da OpenAI passou de 8 minutos.')
    await new Promise((r) => setTimeout(r, 5000))
    const st = await fetch(`https://api.openai.com/v1/videos/${job.id}`, { signal, headers })
    if (!st.ok) continue
    const j = (await st.json()) as { status: string; progress?: number; error?: { message?: string } }
    if (j.status === 'failed') throw new Error(`A OpenAI recusou o vídeo: ${j.error?.message ?? 'sem motivo'}`)
    if (j.status === 'completed') break
    onStep?.(`Gerando o clipe… ${Math.round(j.progress ?? 0)}%`)
  }
  const content = await fetch(`https://api.openai.com/v1/videos/${job.id}/content`, { signal, headers: { authorization: `Bearer ${key}` } })
  if (!content.ok) throw new Error(`Não consegui baixar o vídeo da OpenAI (${content.status}).`)
  const buf = Buffer.from(await content.arrayBuffer())
  return { data: `data:video/mp4;base64,${buf.toString('base64')}`, type: 'video/mp4', seconds }
}
