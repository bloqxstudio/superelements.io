import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { clipViaLink, freeImagesViaLink, mediaViaLink, useCreativeLink } from '../link'
import { uploadAsset } from '../storage'
import type { CreativeSet, SetAsset } from '../types'
import type { ExplainerData } from './types'

/**
 * Mídia real para o vídeo (2026-11-08, o usuário: "a Iara precisa conseguir usar imagens das motos
 * reais, do painel, usar vídeos… podemos usar o GPT para gerar esses vídeos… só vídeos de poucos
 * segundos"). Junta, nesta ordem:
 * 1. o catálogo de produtos da conta (o campo "Encontrar produto" dos formulários): o produto que
 *    combina com o tema, com a foto real (ex.: "Película do painel Tiger 900" da Vizor);
 * 2. fotos reais com licença livre para uso comercial (Openverse), com o crédito que a licença pede;
 * 3. clipes curtos (4 s) gerados pela OpenAI, de cena genérica, sem marca, logo nem texto.
 * Tudo sobe para o conjunto; a IA do roteiro escolhe em que cena entra cada um.
 */

export type Photo = ExplainerData['photos'][number]
export interface CatalogHit { brand: string; model: string; year?: string; name?: string; image: string; url?: string; codes?: { label: string; code: string }[] }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '').slice(0, 20)

/** Os produtos do catálogo da conta (todos os formulários com o campo de encontrar produto). */
export async function catalogItems(teamId: string): Promise<CatalogHit[]> {
  // Tabela fora dos tipos gerados do Supabase: consulta sem os tipos
  const db = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: unknown[] | null }> } } }
  const { data } = await db.from('crm_forms').select('*').eq('team_id', teamId)
  const out: CatalogHit[] = []
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    const o = v as Record<string, unknown>
    if (typeof o.model === 'string' && typeof o.image === 'string' && typeof o.brand === 'string') out.push({ brand: o.brand, model: o.model, year: o.year as string | undefined, name: o.name as string | undefined, image: o.image, url: o.url as string | undefined, codes: o.codes as CatalogHit['codes'] })
    for (const x of Object.values(o)) walk(x)
  }
  walk(data ?? [])
  const seen = new Set<string>()
  return out.filter((x) => !seen.has(x.brand + x.model + x.image) && seen.add(x.brand + x.model + x.image))
}

/** Os produtos do catálogo que o tema cita (modelo ou marca + modelo). */
export function matchCatalog(items: CatalogHit[], topic: string): CatalogHit[] {
  const t = ` ${norm(topic).replace(/[^a-z0-9]+/g, ' ')} `
  const score = (x: CatalogHit) => {
    const model = norm(x.model).replace(/[^a-z0-9]+/g, ' ').trim()
    const words = model.split(' ').filter((w) => w.length >= 3)
    if (!words.length) return 0
    const hit = words.filter((w) => t.includes(` ${w} `)).length
    return hit === 0 ? 0 : hit / words.length + (t.includes(` ${norm(x.brand)} `) ? 0.5 : 0) + (t.includes(` ${model} `) ? 1 : 0)
  }
  return items.map((x) => [x, score(x)] as const).filter(([, s]) => s >= 0.5).sort((a, b) => b[1] - a[1]).map(([x]) => x).slice(0, 2)
}

async function blobFrom(url: string): Promise<Blob> {
  // Imagens do próprio app (as da marca em /brands): direto; o resto pelo conector (sem CORS)
  try {
    const u = new URL(url, window.location.href)
    const local = u.origin === window.location.origin || /(^|\.)avencestudio\.com$/.test(u.hostname)
    if (local) {
      const res = await fetch(u.origin === window.location.origin ? u.href : u.pathname)
      if (res.ok) return res.blob()
    }
  } catch {
    // segue pelo conector
  }
  const out = await mediaViaLink(url)
  return (await fetch(out.data)).blob()
}

const extOf = (type: string) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : type.includes('mp4') ? 'mp4' : type.includes('webm') ? 'webm' : 'jpg')

/** Pedidos dos clipes: cena genérica do assunto, vertical, sem marca, logo nem texto (a OpenAI recusa marcas). */
export function clipPrompts(topic: string, n: number): string[] {
  const moto = /moto|motocic|big ?trail|trail|gs\b|tiger|triumph|bmw|honda|yamaha|ducati|ktm|kawasaki|harley|scooter/i.test(topic)
  const base = 'Vertical 9:16 cinematic b-roll, realistic, natural light, shallow depth of field, smooth camera movement. No logos, no brand names, no text, no license plates, no recognizable people.'
  const list = moto
    ? [
        'A large adventure touring motorcycle riding on a gravel mountain road at golden hour, low side tracking shot, dust in the backlight.',
        'Close-up of a modern motorcycle TFT dashboard glowing at dusk, rider in gloves twisting the throttle, reflections sliding over the screen.',
        'Adventure motorcycle parked on a scenic overlook at sunrise, slow push-in from the rear wheel to the handlebars.',
      ]
    : ['Slow cinematic push-in on a detailed close-up of the subject, soft light, gentle movement.', 'Wide establishing shot with slow parallax, warm light.', 'Macro detail shot with shallow focus and light sweep.']
  return list.slice(0, Math.max(0, Math.min(3, n))).map((p) => `${p} ${base}`)
}

export async function gatherMedia(set: CreativeSet, opts: { topic: string; free?: number; clips?: number; onStep?: (s: string) => void; signal?: AbortSignal }): Promise<{ photos: Photo[]; assets: SetAsset[]; notes: string[] }> {
  const photos: Photo[] = []
  const assets: SetAsset[] = []
  const notes: string[] = []
  const add = async (blob: Blob, base: string, photo: Omit<Photo, 'src' | 'name'>) => {
    const name = `${slug(base) || 'midia'}${photos.length + 1}`
    const file = new File([blob], `${name}.${extOf(blob.type)}`, { type: blob.type })
    const asset = await uploadAsset(set, file, file.name)
    assets.push(asset)
    photos.push({ src: `asset:${asset.id}`, name, ...photo })
  }
  // 1. O catálogo da conta
  const team = useCrm.getState().team
  if (team) {
    try {
      opts.onStep?.('Procurando o produto no catálogo da conta…')
      for (const p of matchCatalog(await catalogItems(team.id), opts.topic)) {
        await add(await blobFrom(p.image), p.model, { kind: 'image', origin: 'marca', desc: `foto real do produto da marca: ${p.name ?? `${p.brand} ${p.model}`}${p.year ? ` (${p.year})` : ''}${p.codes?.length ? `, códigos ${p.codes.map((c) => `${c.code} ${c.label}`).join(' / ')}` : ''}` })
        notes.push(`Produto da marca: ${p.name ?? p.model}`)
      }
    } catch {
      notes.push('Não consegui ler o catálogo da conta.')
    }
  }
  // 2. Fotos reais com licença livre
  const free = opts.free ?? 2
  if (free > 0) {
    try {
      opts.onStep?.('Buscando fotos reais com licença livre…')
      const q = opts.topic.replace(/curiosidade|que quase ningu[eé]m conhece|para apaixonados por moto|de alguma/gi, ' ').replace(/\s+/g, ' ').trim()
      const found = await freeImagesViaLink(q, opts.signal)
      for (const f of found.slice(0, free)) {
        try {
          await add(await blobFrom(f.url), f.title || q, { kind: 'image', origin: 'livre', desc: `foto real: ${f.title}`, credit: `${f.creator ? `${f.creator}, ` : ''}${f.license}${f.source ? ` (${f.source})` : ''}` })
        } catch {
          // uma foto que não baixou não para o resto
        }
      }
      if (!found.length) notes.push('Sem fotos livres para esse tema.')
    } catch {
      notes.push('A busca de fotos livres falhou.')
    }
  }
  // 3. Clipes curtos gerados pela OpenAI
  const clips = useCreativeLink.getState().keys.openai ? opts.clips ?? 0 : 0
  if (clips > 0) {
    opts.onStep?.(`Gerando ${clips} clipe${clips > 1 ? 's' : ''} de 4 s pela OpenAI…`)
    const prompts = clipPrompts(opts.topic, clips)
    const made = await Promise.allSettled(prompts.map((p) => clipViaLink(p, 4, opts.signal, (d) => opts.onStep?.(d))))
    for (const [i, r] of made.entries()) {
      if (r.status === 'fulfilled') await add(await (await fetch(r.value.data)).blob(), 'clipe', { kind: 'video', origin: 'gerado', desc: `clipe de 4 s gerado por IA: ${prompts[i].split('.')[0]}` })
      else notes.push(`Um clipe não saiu: ${r.reason instanceof Error ? r.reason.message : 'erro'}`)
    }
  }
  return { photos, assets, notes }
}

/** Os créditos que as licenças pedem, para a legenda do post. */
export const creditsLine = (photos: Photo[], used: Set<string>) => {
  const list = photos.filter((p) => p.credit && used.has(p.name)).map((p) => p.credit!)
  return list.length ? `Fotos: ${[...new Set(list)].join('; ')}` : ''
}
