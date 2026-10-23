import { AV_CASES } from '@/features/avence/cases'
import type { EditOp, LayerFields, SlideDef } from './edit'
import { LIBRARY } from './library'
import { alpha } from './color'
import { reformat } from './store'
import { measureText, widestLine } from './render'
import { buildSlide } from './templates'
import { parseFormat, sizeOf, uid, type CreativeSet, type FormatId, type Layer, type Post, type Slide } from './types'

/**
 * Aplica o que a IA devolveu. Cada operação é conferida contra o conjunto
 * (ids que existem, campos que a camada tem, cores e imagens válidas): o que não
 * passa é pulado e contado, o resto vira uma única mudança desfazível.
 */

const COMMON = ['name', 'x', 'y', 'w', 'h', 'opacity', 'rotation'] as const
const BY_TYPE: Record<Layer['type'], readonly string[]> = {
  text: ['text', 'font', 'weight', 'size', 'color', 'align', 'lineHeight', 'letterSpacing', 'upper', 'emphasis', 'emphasisColor'],
  image: ['src', 'fit', 'radius', 'frame', 'focusY', 'prompt'],
  rect: ['fill', 'fill2', 'angle', 'radius', 'stroke', 'strokeWidth'],
  ring: ['stroke', 'strokeWidth'],
  dots: ['color', 'gap', 'dot'],
}

const NUMBERS: Record<string, [number, number]> = {
  x: [-3000, 5000], y: [-3000, 5000], w: [1, 5000], h: [0, 5000], opacity: [0, 1], rotation: [-360, 360], weight: [100, 900], size: [8, 700],
  lineHeight: [0.6, 3], letterSpacing: [-0.5, 1], radius: [0, 2000], focusY: [0, 1], angle: [-360, 720], strokeWidth: [0, 100], gap: [4, 400], dot: [1, 100],
}
const COLORS = new Set(['color', 'emphasisColor', 'fill', 'fill2', 'stroke'])
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|transparent)$/i
const ENUMS: Record<string, string[]> = { align: ['left', 'center', 'right'], fit: ['cover', 'contain'], frame: ['none', 'browser', 'phone'] }
const BOOLS = new Set(['upper', 'emphasis'])
const STRINGS = new Set(['name', 'text', 'font', 'src', 'prompt'])

const clamp = (n: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, n))

/** Só o que a camada daquele tipo aceita, com valores dentro do que o editor desenha. */
function clean(type: Layer['type'], fields: LayerFields | undefined, set: CreativeSet, base?: Layer): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const allowed = new Set<string>([...COMMON, ...BY_TYPE[type]])
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (!allowed.has(key) || value === undefined || value === null) continue
    if (key in NUMBERS) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = clamp(value, NUMBERS[key])
    } else if (COLORS.has(key)) {
      if (typeof value === 'string' && COLOR.test(value.trim())) out[key] = value.trim()
    } else if (key in ENUMS) {
      if (typeof value === 'string' && ENUMS[key].includes(value)) out[key] = value
    } else if (BOOLS.has(key)) {
      if (typeof value === 'boolean') out[key] = value
    } else if (key === 'src') {
      if (typeof value === 'string' && imageOk(value, set)) out[key] = value
    } else if (STRINGS.has(key) && typeof value === 'string') out[key] = value.slice(0, 2000)
  }
  // "transparent" num degradê vira a cor vizinha com alfa 0: sem isso o degradê passa por um cinza sujo
  const baseFill = base?.type === 'rect' ? base.fill : undefined
  const baseFill2 = base?.type === 'rect' ? base.fill2 : undefined
  if (out.fill2 === 'transparent') out.fill2 = alpha(String(out.fill ?? baseFill ?? '#000000'), 0)
  if (out.fill === 'transparent') out.fill = alpha(String(out.fill2 ?? baseFill2 ?? '#000000'), 0)
  return out
}

/** Imagem que existe: a da biblioteca, o logo da marca, uma enviada ao conjunto. */
export const imageOk = (src: string, set: CreativeSet) =>
  src === '' || LIBRARY.some((i) => i.src === src) || src === set.brand.logoOnLight || src === set.brand.logoOnDark || (src.startsWith('asset:') && set.assets.some((a) => a.id === src.slice(6)))

const DEFAULTS: Record<Layer['type'], (set: CreativeSet) => Record<string, unknown>> = {
  text: (set) => ({ text: 'Texto', h: 0, w: 600, font: set.brand.bodyFont, weight: 500, size: 56, color: '#111111', align: 'left', lineHeight: 1.15, letterSpacing: 0 }),
  image: () => ({ src: '', w: 600, h: 400, fit: 'cover', radius: 0, frame: 'none' }),
  rect: (set) => ({ w: 300, h: 300, fill: set.brand.colors[0]?.hex ?? '#2b3cf0', radius: 0 }),
  ring: () => ({ w: 400, h: 400, stroke: '#ffffff', strokeWidth: 2 }),
  dots: () => ({ w: 400, h: 400, color: '#ffffff', gap: 40, dot: 3, opacity: 0.07 }),
}

const NAMES: Record<Layer['type'], string> = { text: 'Texto', image: 'Imagem', rect: 'Forma', ring: 'Anel', dots: 'Pontos' }

/** Camada nova a partir dos campos que a IA mandou; sem tipo válido, nada. */
function makeLayer(fields: LayerFields | undefined, set: CreativeSet): Layer | undefined {
  const type = fields?.type
  if (!type || !(type in BY_TYPE)) return undefined
  return { id: uid(), type, name: NAMES[type], x: 84, y: 200, ...DEFAULTS[type](set), ...clean(type, fields, set) } as Layer
}

/**
 * Arruma o que a IA desenhou camada por camada: o texto não passa das margens
 * nem do fim do slide (diminui o corpo aos poucos), e entrelinha e largura ficam
 * em faixas legíveis. Slides de modelo já nascem certos.
 */
function polishSlide(slide: Slide, format: FormatId): Slide {
  const { width, height } = sizeOf(format)
  const margin = Math.round(Math.min(width, height) * 0.07)
  return {
    ...slide,
    layers: slide.layers.map((l) => {
      if (l.type !== 'text') return l
      let layer = { ...l, lineHeight: Math.min(1.8, Math.max(0.85, l.lineHeight)), x: Math.min(Math.max(0, l.x), width - 240) }
      layer.w = Math.max(200, Math.min(layer.w, width - Math.round(margin / 2) - layer.x))
      for (let i = 0; i < 6 && (layer.y + measureText(layer).height > height - margin * 0.6 || widestLine(layer) > layer.w + 0.5) && layer.size > 20; i++) layer = { ...layer, size: Math.round(layer.size * 0.92) }
      return layer
    }),
  }
}

/** Slide novo: por camadas, ou por um modelo pronto. */
function makeSlide(def: SlideDef | undefined, set: CreativeSet, format: FormatId): Slide | undefined {
  if (!def) return undefined
  if (def.spec) {
    const known = new Set(AV_CASES.map((c) => c.slug))
    return buildSlide({ ...def.spec, case: def.spec.case && known.has(def.spec.case) ? def.spec.case : AV_CASES[0].slug }, set.brand, format)
  }
  const background = def.background && COLOR.test(def.background.trim()) ? def.background.trim() : '#ffffff'
  return polishSlide({ id: uid(), background, layers: (def.layers ?? []).flatMap((l) => makeLayer(l, set) ?? []) }, format)
}

export interface Applied {
  set: CreativeSet
  applied: number
  skipped: string[]
  /** O que a pessoa deve ver depois: o último slide e a última camada tocados. */
  focus?: { postId: string; slideId: string; layerId?: string }
  /** Slides que mudaram (ou nasceram), para o canvas destacar. */
  touched: string[]
  /** Imagens a gerar: camadas com `prompt` novo ou mudado. */
  toGenerate: { slideId: string; layerId: string; prompt: string }[]
}

/** `defaults`: o que estava escolhido; vale quando a IA esquece um id. */
export function applyOps(start: CreativeSet, ops: EditOp[], defaults?: { postId?: string; slideId?: string; layerId?: string }): Applied {
  let set = start
  let applied = 0
  let focus: Applied['focus']
  const skipped: string[] = []
  const touched = new Set<string>()

  const findSlide = (op: EditOp) => {
    const all = set.posts.flatMap((post) => post.slides.map((slide) => ({ post, slide })))
    // O slide pelo id; sem ele (ou com um id que não existe), pela camada; por fim, o que estava escolhido
    return (
      (op.slideId && all.find((x) => x.slide.id === op.slideId)) ||
      (op.layerId && all.find((x) => x.slide.layers.some((l) => l.id === op.layerId))) ||
      (op.postId && all.find((x) => x.post.id === op.postId && x.slide.id === defaults?.slideId)) ||
      (defaults?.slideId ? all.find((x) => x.slide.id === defaults.slideId) : undefined) ||
      undefined
    )
  }
  const mapSlide = (slideId: string, fn: (slide: Slide, post: Post) => Slide) => {
    set = { ...set, posts: set.posts.map((p) => ({ ...p, slides: p.slides.map((s) => (s.id === slideId ? fn(s, p) : s)) })) }
  }

  ops.forEach((op, i) => {
    const label = `${i + 1}. ${op.op}`
    const prior = focus
    try {
      if (op.op === 'update_post') {
        const post = set.posts.find((p) => p.id === op.postId)
        if (!post) return skipped.push(`${label}: post não existe`)
        const def = op.post
        const format = parseFormat(def?.format ?? op.format)
        const name = def?.name ?? op.name
        const caption = def?.caption ?? op.caption
        // `post.slides` refaz o post inteiro: os slides de hoje saem e entram os novos, no formato do post
        const target = format ?? post.format
        const slides = def?.slides?.length ? def.slides.flatMap((d) => makeSlide(d, set, target) ?? []) : undefined
        set = {
          ...set,
          posts: set.posts.map((p) => {
            if (p.id !== post.id) return p
            let next: Post = format && format !== p.format ? reformat(p, format) : p
            if (slides?.length) next = { ...next, slides }
            return { ...next, ...(name ? { name: name.slice(0, 120) } : {}), ...(caption !== undefined ? { caption: caption.slice(0, 2200) } : {}) }
          }),
        }
        if (slides?.length) {
          for (const created of slides) touched.add(created.id)
          focus = { postId: post.id, slideId: slides[0].id }
        }
        return void applied++
      }

      if (op.op === 'add_post') {
        const def = op.post
        if (!def) return skipped.push(`${label}: faltou o post`)
        const format = parseFormat(def.format) ?? '4x5'
        const slides = (def.slides ?? []).flatMap((d) => makeSlide(d, set, format) ?? [])
        const post: Post = { id: uid(), name: (def.name || 'Post novo').slice(0, 120), format, caption: def.caption?.slice(0, 2200), slides: slides.length ? slides : [{ id: uid(), background: '#ffffff', layers: [] }] }
        set = { ...set, posts: [...set.posts, post] }
        focus = { postId: post.id, slideId: post.slides[0].id }
        for (const created of post.slides) touched.add(created.id)
        return void applied++
      }
      if (op.op === 'delete_post') {
        if (set.posts.length < 2 || !set.posts.some((p) => p.id === op.postId)) return skipped.push(`${label}: o conjunto precisa de pelo menos um post`)
        set = { ...set, posts: set.posts.filter((p) => p.id !== op.postId) }
        return void applied++
      }

      if (op.op === 'add_slide') {
        const post = set.posts.find((p) => p.id === op.postId) ?? findSlide(op)?.post
        const slide = makeSlide(op.slide ?? (op.spec ? { spec: op.spec } : undefined), set, post?.format ?? '4x5')
        if (!post || !slide) return skipped.push(`${label}: faltou o post ou o conteúdo do slide`)
        const at = op.slideId ? post.slides.findIndex((s) => s.id === op.slideId) + 1 : post.slides.length
        set = { ...set, posts: set.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: [...p.slides.slice(0, at), slide, ...p.slides.slice(at)] })) }
        focus = { postId: post.id, slideId: slide.id }
        return void applied++
      }

      const hit = findSlide(op)
      if (!hit) return skipped.push(`${label}: slide não existe`)
      const { post, slide } = hit

      if (op.op === 'update_slide') {
        if (!op.background || !COLOR.test(op.background.trim())) return skipped.push(`${label}: cor inválida`)
        mapSlide(slide.id, (s) => ({ ...s, background: op.background!.trim() }))
        focus = { postId: post.id, slideId: slide.id }
        return void applied++
      }
      if (op.op === 'delete_slide') {
        if (post.slides.length < 2) return skipped.push(`${label}: o post precisa de pelo menos um slide`)
        set = { ...set, posts: set.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: p.slides.filter((s) => s.id !== slide.id) })) }
        return void applied++
      }
      if (op.op === 'duplicate_slide') {
        const copy: Slide = { ...slide, id: uid(), layers: slide.layers.map((l) => ({ ...l, id: uid() })) }
        const at = post.slides.findIndex((s) => s.id === slide.id) + 1
        set = { ...set, posts: set.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: [...p.slides.slice(0, at), copy, ...p.slides.slice(at)] })) }
        focus = { postId: post.id, slideId: copy.id }
        return void applied++
      }

      if (op.op === 'add_layer') {
        const layer = makeLayer(op.layer, set)
        if (!layer) return skipped.push(`${label}: faltou o tipo da camada`)
        mapSlide(slide.id, (s) => ({ ...s, layers: [...s.layers, layer] }))
        focus = { postId: post.id, slideId: slide.id, layerId: layer.id }
        return void applied++
      }

      const layer = slide.layers.find((l) => l.id === (op.layerId ?? defaults?.layerId))
      if (!layer) return skipped.push(`${label}: camada não existe`)
      focus = { postId: post.id, slideId: slide.id, layerId: layer.id }

      if (op.op === 'delete_layer') {
        mapSlide(slide.id, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== layer.id) }))
        focus.layerId = undefined
        return void applied++
      }
      if (op.op === 'move_layer') {
        mapSlide(slide.id, (s) => {
          const from = s.layers.findIndex((l) => l.id === layer.id)
          const to = op.direction === 'front' ? s.layers.length - 1 : op.direction === 'back' ? 0 : Math.min(s.layers.length - 1, Math.max(0, from + (op.direction === 'up' ? 1 : -1)))
          const layers = [...s.layers]
          layers.splice(to, 0, layers.splice(from, 1)[0])
          return { ...s, layers }
        })
        return void applied++
      }
      if (op.op === 'update_layer') {
        const fields = clean(layer.type, op.layer, set, layer)
        if (!Object.keys(fields).length) return skipped.push(`${label}: nada para mudar`)
        mapSlide(slide.id, (s) => ({ ...s, layers: s.layers.map((l) => (l.id === layer.id ? ({ ...l, ...fields } as Layer) : l)) }))
        return void applied++
      }
      skipped.push(`${label}: operação desconhecida`)
    } catch (error) {
      skipped.push(`${label}: ${error instanceof Error ? error.message : 'erro'}`)
    } finally {
      if (focus && focus !== prior) touched.add(focus.slideId)
    }
  })

  // Imagens a gerar: prompt novo ou mudado, sem uma imagem nova posta junto
  const before = new Map(start.posts.flatMap((p) => p.slides.flatMap((sl) => sl.layers.map((l) => [l.id, l] as const))))
  const toGenerate = set.posts.flatMap((p) =>
    p.slides.flatMap((sl) =>
      sl.layers.flatMap((l) => {
        if (l.type !== 'image' || !l.prompt?.trim()) return []
        const old = before.get(l.id)
        const was = old?.type === 'image' ? old : undefined
        return !was || (was.prompt !== l.prompt && (!l.src || l.src === was.src)) ? [{ slideId: sl.id, layerId: l.id, prompt: l.prompt.trim() }] : []
      })
    )
  )
  return { set, applied, skipped, focus, touched: [...touched], toGenerate }
}
