import { mix } from '@/features/space/brand/color'
import { paletteOf, type Palette } from './brand'
import { alpha } from './color'
import { EDITORIAL, type SlideAt } from './editorial'
import { measureText, widestLine } from './render'
import { caseBySlug, caseImage, ILLUSTRATIONS } from './library'
import type { CaseView, SlideSpec, TemplateId } from './plan'
import { sizeOf, uid, type FormatId, type ImageLayer, type Layer, type Post, type SetBrand, type ShapeLayer, type Slide, type TextLayer } from './types'

/**
 * Modelos de post na linguagem da identidade: tinta e papel, título justo com
 * uma palavra em serifa itálica, rótulo no canto, anéis finos, grade de pontos
 * nos fundos escuros, o quadrado girado e as telas reais dos cases. Cada modelo
 * é uma função da marca, do formato e do conteúdo (`SlideSpec`); a IA só
 * escolhe o modelo e escreve os textos. Para crescer a base, acrescente um
 * item em `TEMPLATES` (e o id em `plan.ts`) ou uma sequência em `POST_MODELS`.
 */

interface Ctx {
  brand: SetBrand
  p: Palette
  w: number
  h: number
  m: number
  /** Margem de cima e de baixo do texto: no story, as faixas que o Instagram cobre (barra de progresso e perfil em cima, resposta embaixo). */
  top: number
  bottom: number
  /** 9:16: cada slide é uma tela de story (tocar, não arrastar). */
  story: boolean
  dark: boolean
  /** Destaque que lê bem no fundo atual. */
  hi: string
  fg: string
  soft: string
}

/** Faixas do story sem texto: cerca de 13% em cima e 16% embaixo de 1920 px. */
export const STORY_SAFE = { top: 250, bottom: 300 }

const ctxOf = (brand: SetBrand, format: FormatId, dark: boolean): Ctx => {
  const p = paletteOf(brand)
  const { width: w, height: h } = sizeOf(format)
  const story = h / w > 1.7
  return { brand, p, w, h, m: 84, top: story ? STORY_SAFE.top : 84, bottom: story ? STORY_SAFE.bottom : 84, story, dark, hi: dark ? mix(p.accent, '#ffffff', 0.5) : p.accent, fg: dark ? p.paper : p.ink, soft: dark ? 'rgba(255,255,255,0.62)' : p.muted }
}

const text = (c: Ctx, name: string, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'size'>): TextLayer => ({
  id: uid(), type: 'text', name, text: t, h: 0, font: c.brand.bodyFont, weight: 400, color: c.fg, align: 'left', lineHeight: 1.15, letterSpacing: 0, emphasisColor: c.hi, ...o,
})

const title = (c: Ctx, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'size'> & { maxLines?: number }) => {
  const { maxLines, ...rest } = o
  return fit(text(c, 'Título', t, { font: c.brand.headingFont, weight: 500, lineHeight: 0.98, letterSpacing: -0.05, emphasis: true, ...rest }), maxLines ?? 4)
}

/** Altura que um texto ocupa com a quebra do editor. */
function heightOf(layer: TextLayer) {
  return measureText(layer).height
}

/** Encolhe o texto aos poucos até caber (sem passar de 62% do tamanho original). */
function fit(layer: TextLayer, maxLines: number, floor = 0.62): TextLayer {
  let current = layer
  const min = layer.size * floor
  // Encolhe enquanto passar de `maxLines` linhas ou uma palavra for mais larga que a caixa
  while (current.size > min && (measureText(current).lines.length > maxLines || widestLine(current) > current.w + 0.5)) current = { ...current, size: Math.round(current.size * 0.94) }
  return current
}

const label = (c: Ctx, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w'>) =>
  text(c, 'Rótulo', t, { size: 24, weight: 600, letterSpacing: 0.16, upper: true, color: c.hi, ...o })

const rect = (name: string, o: Partial<ShapeLayer> & Pick<ShapeLayer, 'x' | 'y' | 'w' | 'h' | 'fill'>): ShapeLayer => ({ id: uid(), type: 'rect', name, radius: 0, ...o })

const image = (name: string, src: string, o: Partial<ImageLayer> & Pick<ImageLayer, 'x' | 'y' | 'w' | 'h'>): ImageLayer => ({ id: uid(), type: 'image', name, src, fit: 'cover', radius: 0, frame: 'none', ...o })

const ring = (name: string, x: number, y: number, d: number, color: string, opacity: number): Layer => ({ id: uid(), type: 'ring', name, x, y, w: d, h: d, stroke: color, strokeWidth: 2, opacity })

/** Fundo da identidade: grade de pontos (só no escuro) e anéis finos saindo da borda. */
const backdrop = (c: Ctx, rings: [number, number, number][]): Layer[] => [
  ...(c.dark ? [{ id: uid(), type: 'dots', name: 'Grade de pontos', x: 0, y: 0, w: c.w, h: c.h, color: '#ffffff', gap: 40, dot: 3, opacity: 0.07 } as Layer] : []),
  ...rings.flatMap(([x, y, d], i) => [ring(`Anel ${i + 1}a`, x, y, d, c.fg, 0.14), ring(`Anel ${i + 1}b`, x + d * 0.18, y + d * 0.18, d * 0.64, c.fg, 0.1)]),
]

const square = (c: Ctx, x: number, y: number, size: number): Layer => rect('Quadrado', { x, y, w: size, h: size, fill: c.hi, rotation: 45 })

/** Cabeçalho do post: logo à esquerda, rótulo à direita. */
const header = (c: Ctx, tag?: string): Layer[] => {
  const src = c.dark ? c.brand.logoOnDark ?? c.brand.logoOnLight : c.brand.logoOnLight ?? c.brand.logoOnDark
  const mark: Layer = src
    ? image('Logo', src, { x: c.m, y: c.top - 4, w: 210, h: 60, fit: 'contain' })
    : text(c, 'Logo', c.brand.name, { x: c.m, y: c.top, w: 500, size: 36, weight: 600, font: c.brand.headingFont, letterSpacing: -0.04 })
  return tag ? [mark, label(c, tag, { x: c.w - c.m - 560, y: c.top + 8, w: 560, align: 'right' })] : [mark]
}

const slide = (background: string, layers: Layer[]): Slide => ({ id: uid(), background, layers })

const bg = (c: Ctx) => (c.dark ? c.p.ink : c.p.paper)

type Build = (brand: SetBrand, format: FormatId, spec: SlideSpec) => Slide

const caseOf = (spec: SlideSpec) => caseBySlug(spec.case ?? '') ?? caseBySlug('processbase')!

const caseFoot = (c: Ctx, name: string, place?: string): Layer =>
  text(c, 'Rodapé', `${name}${place ? ` · ${place}` : ''}`, { x: c.m, y: c.h - c.bottom - (c.story ? 40 : 30), w: c.w - c.m * 2, size: 28, weight: 500, color: c.soft })

/** Escurece a base da imagem com um degradê, para o título ler sobre a foto. */
const scrim = (c: Ctx, from: number, color: string): Layer[] => {
  const top = Math.round(c.h * from)
  return [rect('Degradê', { x: 0, y: top, w: c.w, h: c.h - top, fill: alpha(color, 0), fill2: alpha(color, 0.94), angle: 180 })]
}

const scene = (spec: SlideSpec, fallback: string) => (spec.prompt?.trim() ? spec.prompt.trim() : `Editorial photograph, cinematic natural light, no text, no logos. Subject: ${fallback}`)

/** Contador discreto do carrossel e a chamada para arrastar (story não arrasta: o Instagram já mostra as telas). */
const swipe = (c: Ctx, cue = 'Arraste'): Layer[] => c.story ? [] : [
  text(c, 'Arraste', `${cue} →`.trim(), { x: c.w - c.m - 360, y: c.h - c.bottom - 26, w: 360, size: 26, weight: 600, letterSpacing: 0.12, upper: true, align: 'right', color: c.soft }),
]

const BUILDERS: Record<TemplateId, Build> = {
  // Carrossel viral: foto grande, título pesado, número e dado em destaque

  'viral-capa': (brand, format, spec) => {
    const c = ctxOf(brand, format, true)
    const tall = c.h > 1500
    const bottom = c.h - c.bottom - (c.story ? 24 : 96)
    const body = spec.body ? fit(text(c, 'Apoio', spec.body, { x: c.m, y: 0, w: c.w - c.m * 2, size: 34, weight: 500, lineHeight: 1.28, color: 'rgba(255,255,255,0.8)' }), 2, 0.8) : undefined
    const bodyBox = body ? { ...body, y: bottom - heightOf(body) } : undefined
    const head = title(c, spec.title ?? 'Como a marca *conquistou* todo mundo', { x: c.m, y: 0, w: c.w - c.m * 2, size: tall ? 148 : 124, weight: 800, lineHeight: 0.96, letterSpacing: -0.028, color: '#ffffff', emphasisColor: c.hi, maxLines: 5 })
    const headBox = { ...head, y: (bodyBox ? bodyBox.y - 40 : bottom) - heightOf(head) }
    return slide(c.p.ink, [
      image('Foto de capa', '', { x: 0, y: 0, w: c.w, h: c.h, prompt: scene(spec, spec.title ?? 'a person at work, candid portrait') }),
      ...scrim(c, 0.28, c.p.ink),
      rect('Degradê do topo', { x: 0, y: 0, w: c.w, h: Math.round(c.h * 0.18), fill: alpha(c.p.ink, 0.55), fill2: alpha(c.p.ink, 0), angle: 180 }),
      rect('Selo', { x: c.m, y: c.top, w: 16, h: 16, fill: c.p.accent }),
      text(c, 'Rótulo', spec.label ?? 'Análise', { x: c.m + 34, y: c.top - 6, w: c.w - c.m * 2 - 34, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: '#ffffff' }),
      headBox,
      ...(bodyBox ? [bodyBox] : []),
      ...swipe(c),
    ])
  },

  'viral-foto': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const limit = c.h - c.bottom - (c.story ? 24 : 96)
    const numH = 150
    const head0 = title(c, spec.title ?? 'O detalhe que *ninguém* percebeu', { x: c.m, y: 0, w: c.w - c.m * 2, size: c.h > 1500 ? 84 : 74, weight: 800, lineHeight: 1, letterSpacing: -0.022, maxLines: 3 })
    const body0 = fit(text(c, 'Apoio', spec.body ?? 'Uma frase curta que explica o ponto e faz a pessoa querer ver o próximo slide.', { x: c.m, y: 0, w: c.w - c.m * 2, size: 34, weight: 400, lineHeight: 1.3, color: c.soft }), 3, 0.78)
    // O texto manda: a foto ocupa o que sobra (entre 34% e 50% da altura), sem nada se tocar
    const textH = numH + 20 + heightOf(head0) + 28 + heightOf(body0)
    const imgH = Math.round(Math.min(c.h * 0.5, Math.max(c.h * 0.34, limit - textH - 56)))
    const numY = imgH + 44
    const headY = numY + numH + 20
    return slide(bg(c), [
      image('Foto', '', { x: 0, y: 0, w: c.w, h: imgH, prompt: scene(spec, spec.title ?? 'a candid editorial photograph') }),
      rect('Faixa', { x: 0, y: imgH, w: c.w, h: 10, fill: c.p.accent }),
      text(c, 'Número', spec.number ?? '01', { x: c.m, y: numY, w: 300, size: numH, weight: 800, letterSpacing: -0.04, lineHeight: 1, color: c.hi, font: c.brand.headingFont }),
      { ...head0, y: headY },
      { ...body0, y: headY + heightOf(head0) + 28 },
      ...swipe(c, ''),
    ])
  },

  'viral-dado': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const tall = c.h > 1500
    const numY = c.h * (tall ? 0.2 : 0.17)
    const numSize = tall ? 400 : 340
    const head = title(c, spec.title ?? 'das pessoas decidem *em segundos*', { x: c.m, y: numY + numSize + 92, w: c.w - c.m * 2, size: tall ? 96 : 84, weight: 800, lineHeight: 1, letterSpacing: -0.022, maxLines: 4 })
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 460, -220, 800]]),
      text(c, 'Rótulo', spec.label ?? 'O número', { x: c.m, y: c.top, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
      text(c, 'Dado', spec.number ?? '73%', { x: c.m - 8, y: numY, w: c.w - c.m * 2 + 16, size: numSize, weight: 800, letterSpacing: -0.045, lineHeight: 0.95, color: c.hi, font: c.brand.headingFont }),
      rect('Linha', { x: c.m, y: numY + numSize + 36, w: 140, h: 10, fill: c.fg }),
      head,
      ...(spec.body ? [text(c, 'Fonte', spec.body, { x: c.m, y: c.h - c.bottom - 70, w: c.w - c.m * 2 - 360, size: 26, weight: 500, color: c.soft })] : []),
      ...swipe(c),
    ])
  },

  'viral-frase': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const tall = c.h > 1500
    const top = c.h * 0.22
    const head = title(c, spec.title ?? 'Marca forte não *explica*. Ela se faz lembrar.', { x: c.m + 56, y: top, w: c.w - c.m * 2 - 56, size: tall ? 120 : 100, weight: 800, lineHeight: 1.02, letterSpacing: -0.025, maxLines: 6 })
    const h = heightOf(head)
    return slide(bg(c), [
      rect('Barra', { x: c.m, y: top, w: 14, h, fill: c.p.accent }),
      text(c, 'Rótulo', spec.label ?? 'O insight', { x: c.m + 56, y: top - 70, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
      head,
      ...(spec.body ? [fit(text(c, 'Fonte', spec.body, { x: c.m + 56, y: top + h + 44, w: c.w - c.m * 2 - 56, size: 34, weight: 500, lineHeight: 1.3, color: c.soft }), 3, 0.8)] : []),
      ...swipe(c),
    ])
  },

  'viral-fecho': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const rows = spec.items?.length ? spec.items : ['Salve para consultar depois', 'Envie para quem precisa ver', 'Siga para ver o próximo']
    const top = c.h * 0.5
    return slide(bg(c), [
      ...backdrop(c, [[-260, c.h - 560, 700]]),
      text(c, 'Rótulo', spec.label ?? 'Gostou?', { x: c.m, y: c.top, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
      title(c, spec.title ?? 'Isso vale *ouro*. Não deixe passar.', { x: c.m, y: c.h * 0.16, w: c.w - c.m * 2, size: c.h > 1500 ? 128 : 108, weight: 800, lineHeight: 0.98, letterSpacing: -0.028 }),
      ...rows.slice(0, 4).flatMap((r, i): Layer[] => [
        rect(`Linha ${i + 1}`, { x: c.m, y: top + i * 130, w: c.w - c.m * 2, h: 2, fill: c.fg, opacity: 0.16 }),
        rect(`Ponto ${i + 1}`, { x: c.m, y: top + i * 130 + 48, w: 22, h: 22, fill: c.hi }),
        text(c, `Item ${i + 1}`, r, { x: c.m + 56, y: top + i * 130 + 34, w: c.w - c.m * 2 - 56, size: 46, weight: 600, letterSpacing: -0.02 }),
      ]),
      text(c, 'Contato', spec.body ?? '@seuperfil', { x: c.m, y: c.h - c.bottom - 40, w: c.w - c.m * 2 - 120, size: 36, weight: 700, color: c.hi }),
      square(c, c.w - c.m - 70, c.h - c.bottom - 70, 48),
    ])
  },

  manifesto: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const tall = c.h > 1500
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 420, -160, 760], [-260, c.h - 520, 640]]),
      ...header(c, spec.label ?? 'Avence Studio'),
      title(c, spec.title ?? 'Sites com *acabamento* de estúdio.', { x: c.m, y: c.h * (tall ? 0.3 : 0.27), w: c.w - c.m * 2, size: tall ? 150 : 132 }),
      text(c, 'Apoio', spec.body ?? 'Identidade, texto e movimento trabalhando juntos.', { x: c.m, y: c.h - c.bottom - 190, w: c.w - c.m * 2 - 220, size: 38, color: c.soft, lineHeight: 1.3 }),
      square(c, c.w - c.m - 70, c.h - c.bottom - 70, 48),
    ])
  },

  'case-janela': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const k = caseOf(spec)
    const view: CaseView = spec.view ?? 'pagina'
    const img = caseImage(k, view === 'celular' ? 'pagina' : view)
    const winW = c.w - c.m * 2
    const winH = Math.min(Math.round(winW * (view === 'capa' ? 0.64 : 0.74)), c.h - 520)
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 360, -200, 560]]),
      ...header(c, spec.label ?? `Case · ${k.segment}`),
      title(c, spec.title ?? `${k.name}, *em tela cheia*.`, { x: c.m, y: c.top + 120, w: winW, size: c.h > 1500 ? 108 : 92 }),
      image('Tela do case', img.src, { x: c.m, y: c.h - c.bottom - 60 - winH, w: winW, h: winH, frame: 'browser', focusY: spec.focus ?? 0 }),
      caseFoot(c, k.name, k.place),
    ])
  },

  'case-duo': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const k = caseOf(spec)
    const page = caseImage(k, 'pagina')
    const phone = caseImage(k, 'celular')
    const winW = Math.round(c.w * 0.74)
    const winH = Math.round(winW * 0.7)
    const phW = Math.round(c.w * 0.3)
    const phH = Math.round(phW * 2.05)
    const baseY = c.h - c.bottom - 60
    return slide(bg(c), [
      ...backdrop(c, [[-280, c.h * 0.3, 700]]),
      ...header(c, spec.label ?? 'Computador e celular'),
      title(c, spec.title ?? `${k.name} nas *duas telas*.`, { x: c.m, y: c.top + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 104 : 88 }),
      image('Tela do computador', page.src, { x: c.m, y: baseY - winH - phH * 0.18, w: winW, h: winH, frame: 'browser', focusY: spec.focus ?? 0 }),
      image('Tela do celular', phone.src, { x: c.w - c.m - phW, y: baseY - phH, w: phW, h: phH, frame: 'phone', focusY: spec.focus ?? 0 }),
      caseFoot(c, k.name, k.place),
    ])
  },

  'case-capa': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const k = caseOf(spec)
    const cover = caseImage(k, 'capa')
    const imgH = Math.round(c.h * (c.story ? 0.42 : 0.52))
    return slide(bg(c), [
      image('Capa do case', cover.src, { x: 0, y: 0, w: c.w, h: imgH, focusY: 0 }),
      label(c, spec.label ?? k.segment, { x: c.m, y: imgH + 70, w: c.w - c.m * 2 }),
      title(c, spec.title ?? `${k.name}.`, { x: c.m, y: imgH + 120, w: c.w - c.m * 2, size: 140 }),
      text(c, 'Apoio', spec.body ?? k.summary, { x: c.m, y: c.h - c.bottom - 150, w: c.w - c.m * 2 - 100, size: 32, color: c.soft, lineHeight: 1.3 }),
      square(c, c.w - c.m - 56, c.h - c.bottom - 56, 36),
    ])
  },

  ilustracao: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const art = ILLUSTRATIONS.find((i) => i.id === spec.illustration) ?? ILLUSTRATIONS[0]
    const artW = c.w - c.m * 2
    const artH = Math.min(Math.round((artW * art.height) / art.width), Math.round(c.h * 0.42))
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 300, c.h * 0.5, 600]]),
      ...header(c, spec.label),
      title(c, spec.title ?? 'Seu site tem *poucos segundos*.', { x: c.m, y: c.top + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 112 : 96 }),
      image('Ilustração', art.src, { x: c.m, y: c.h - c.bottom - 150 - artH, w: artW, h: artH, fit: 'contain' }),
      text(c, 'Apoio', spec.body ?? '', { x: c.m, y: c.h - c.bottom - 120, w: c.w - c.m * 2, size: 34, color: c.soft, lineHeight: 1.3 }),
    ])
  },

  lista: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const rows = spec.items?.length ? spec.items : ['O site não aparece quando procuram.', 'Quem chega no celular desiste.', 'O WhatsApp quase não toca.']
    const top = c.h * 0.4
    const step = Math.min(200, (c.h - top - c.bottom - 40) / rows.length)
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 380, -240, 620]]),
      ...header(c, spec.label ?? 'Soa familiar?'),
      title(c, spec.title ?? 'Seu site *faz isso*?', { x: c.m, y: c.top + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 120 : 104 }),
      ...rows.slice(0, 4).flatMap((r, i): Layer[] => [
        rect(`Linha ${i + 1}`, { x: c.m, y: top + i * step, w: c.w - c.m * 2, h: 2, fill: c.fg, opacity: 0.16 }),
        rect(`Ponto ${i + 1}`, { x: c.m, y: top + i * step + 62, w: 22, h: 22, fill: c.hi }),
        text(c, `Item ${i + 1}`, r, { x: c.m + 66, y: top + i * step + 40, w: c.w - c.m * 2 - 66, size: 50, weight: 500, letterSpacing: -0.02 }),
      ]),
    ])
  },

  cta: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const y = c.h * 0.3
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 460, c.h - 560, 760], [-300, -200, 560]]),
      ...header(c, spec.label ?? 'Próximo passo'),
      title(c, spec.title ?? 'Veja o site do seu negócio *antes* de fechar.', { x: c.m, y, w: c.w - c.m * 2, size: c.h > 1500 ? 128 : 112 }),
      rect('Botão', { x: c.m, y: y + 520, w: 520, h: 104, fill: c.p.accent }),
      text(c, 'Botão', spec.cta ?? 'Peça uma prévia', { x: c.m + 44, y: y + 520 + 30, w: 440, size: 38, weight: 600, color: c.p.onAccent }),
      text(c, 'Contato', spec.body ?? '@avencestudio', { x: c.m, y: c.h - c.bottom - 40, w: c.w - c.m * 2, size: 34, color: c.soft }),
      square(c, c.w - c.m - 70, c.h - c.bottom - 70, 48),
    ])
  },
}

/** Geometria da janela de navegador de um card com a página de um site: a largura útil e a altura visível da página dentro dela. */
function pageWindow(format: FormatId, imgW: number, imgH: number) {
  const { width: w, height: h } = sizeOf(format)
  const m = 84
  const winW = w - m * 2
  // Janela grande: a página é o assunto do card (o título ocupa até duas linhas em cima)
  const winH = Math.min(Math.round(winW * (h > 1500 ? 1.45 : 0.9)), h - 544)
  const bar = Math.max(34, Math.round(winW * 0.045))
  const visible = winH - bar
  return { m, winW, winH, visible, scaled: imgH * (winW / imgW) }
}

/** Quantos cards a página importada ocupa, rolando de cima para baixo (com uma sobra entre eles). */
export const pageSlideCount = (format: FormatId, imgW: number, imgH: number) => {
  const g = pageWindow(format, imgW, imgH)
  return Math.min(8, Math.max(1, Math.ceil((g.scaled - g.visible * 0.15) / (g.visible * 0.85))))
}

/** Um card da página importada: a janela de navegador mostra um trecho dela (`index` de `total`), do topo ao fim. */
export function pageWindowSlide(brand: SetBrand, format: FormatId, o: { src: string; imgW: number; imgH: number; index: number; total: number; title: string; label: string; dark: boolean }): Slide {
  const c = ctxOf(brand, format, o.dark)
  const g = pageWindow(format, o.imgW, o.imgH)
  return slide(bg(c), [
    ...backdrop(c, [[c.w - 360, -200, 560]]),
    ...header(c, `${o.label} · ${o.index + 1}/${o.total}`),
    title(c, o.title, { x: c.m, y: c.m + 120, w: g.winW, size: c.h > 1500 ? 96 : 84, maxLines: 2 }),
    image('Página importada', o.src, { x: c.m, y: c.h - c.m - 60 - g.winH, w: g.winW, h: g.winH, frame: 'browser', focusY: o.total > 1 ? Math.round((o.index / (o.total - 1)) * 100) / 100 : 0 }),
  ])
}

export interface SidewaysInput {
  /** A foto da página inteira (a que está no conjunto). */
  src: string
  imgW: number
  imgH: number
  /** O case: o nome do projeto. */
  title: string
  /** A página: o que o card de conteúdo diz embaixo. */
  sub: string
  /** Rótulo pequeno no topo. */
  label: string
}

/**
 * Carrossel "case + site de lado": o primeiro card é só o case (nome e um
 * trecho do site); os outros formam uma faixa contínua com a página inteira
 * deitada, correndo de card em card até o fim (cada card guarda a fatia dele, e
 * as cópias se mantêm emendadas). Fundo escuro da marca, para o site aparecer.
 */
export function sidewaysSlides(brand: SetBrand, format: FormatId, o: SidewaysInput): Slide[] {
  const c = ctxOf(brand, format, true)
  const { width: W, height: H } = sizeOf(format)
  const top = c.m + 150
  const bottom = H - c.m - 96
  let hv = bottom - top
  let k = hv / o.imgW
  // Cards de conteúdo: a página deitada mais as margens das pontas; no máximo 8
  const n = Math.min(8, Math.max(1, Math.ceil((o.imgH * k + c.m * 2) / W)))
  if (o.imgH * k + c.m * 2 > n * W) {
    k = (n * W - c.m * 2) / o.imgH
    hv = o.imgW * k
  }
  const length = o.imgH * k
  const x0 = c.m + (n * W - c.m * 2 - length) / 2
  const cx = x0 + length / 2
  const cy = top + (bottom - top) / 2
  const span = uid()
  const stripX = (j: number) => cx - hv / 2 - j * W
  const total = n + 1

  const cover = slide(c.p.ink, [
    ...backdrop(c, [[c.w - 460, -220, 800], [-260, c.h - 520, 640]]),
    ...header(c, o.label),
    text(c, 'Rótulo do case', 'Case', { x: c.m, y: c.m + 150, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
    title(c, o.title, { x: c.m, y: c.m + 200, w: c.w - c.m * 2, size: c.h > 1500 ? 168 : 148, weight: 500, lineHeight: 0.96, letterSpacing: -0.05, maxLines: 3 }),
    image('Trecho do site', o.src, { x: c.m, y: H - c.m - 560, w: c.w - c.m * 2, h: 560, frame: 'browser', focusY: 0 }),
    text(c, 'Arraste', 'Arraste para ver o site →', { x: c.m, y: H - c.m - 560 - 64, w: c.w - c.m * 2, size: 26, weight: 600, letterSpacing: 0.12, upper: true, color: c.soft }),
  ])

  const content = Array.from({ length: n }, (_, j) =>
    slide(c.p.ink, [
      ...backdrop(c, []),
      ...header(c, `${o.label} · ${j + 2}/${total}`),
      image('Site de lado', o.src, { x: stripX(j), y: cy - (length / 2), w: hv, h: length, fit: 'cover', radius: 14, frame: 'none', rotation: -90, span: { id: span, index: j } }),
      text(c, 'Página', o.sub, { x: c.m, y: H - c.m - 36, w: c.w - c.m * 2 - 360, size: 26, weight: 600, letterSpacing: 0.1, upper: true, color: c.soft }),
      ...(j < n - 1 ? swipe(c) : []),
    ])
  )
  return [cover, ...content]
}

export interface SlideTemplate {
  id: TemplateId
  name: string
  hint: string
}

export const TEMPLATES: SlideTemplate[] = [
  { id: 'manifesto', name: 'Manifesto', hint: 'Título grande com uma palavra em serifa.' },
  { id: 'case-janela', name: 'Case na janela', hint: 'A página de um case num navegador.' },
  { id: 'case-duo', name: 'Case: computador e celular', hint: 'As duas telas do mesmo case.' },
  { id: 'case-capa', name: 'Capa de case', hint: 'A capa do site e a ficha do case.' },
  { id: 'ilustracao', name: 'Ilustração', hint: 'Uma das ilustrações da identidade, com título.' },
  { id: 'lista', name: 'Lista', hint: 'Pergunta e três linhas que o público reconhece.' },
  { id: 'cta', name: 'Chamada final', hint: 'Convite para a conversa, com botão.' },
  { id: 'viral-capa', name: 'Viral · capa com foto', hint: 'Foto gerada em tela cheia e título pesado.' },
  { id: 'viral-foto', name: 'Viral · foto e ponto', hint: 'Foto, número e um ponto do carrossel.' },
  { id: 'viral-dado', name: 'Viral · dado em destaque', hint: 'Um número enorme e o que ele significa.' },
  { id: 'viral-frase', name: 'Viral · frase', hint: 'Um insight em letras grandes.' },
  { id: 'viral-fecho', name: 'Viral · salve e siga', hint: 'Fecho que pede salvar, enviar e seguir.' },
]

/** Um slide do modelo, na linguagem do conjunto (`brand.look`). `at` diz a posição no post e o assunto da série (a editorial mostra os dois). */
export const buildSlide = (spec: SlideSpec | TemplateId, brand: SetBrand, format: FormatId, at?: SlideAt): Slide => {
  const s: SlideSpec = typeof spec === 'string' ? { template: spec } : spec
  if (brand.look === 'editorial') return (EDITORIAL[s.template] ?? EDITORIAL.manifesto)(brand, format, s, at)
  return (BUILDERS[s.template] ?? BUILDERS.manifesto)(brand, format, s)
}

export interface PostModel {
  id: string
  name: string
  hint: string
  format: FormatId
  slides: SlideSpec[]
}

/** Sequências prontas, na ordem em que contam a história. Os cases do estúdio entram como exemplo. */
export const POST_MODELS: PostModel[] = [
  { id: 'apresentacao', name: 'Apresentação do estúdio', hint: 'Manifesto, três cases e chamada (4:5).', format: '4x5', slides: [{ template: 'manifesto' }, { template: 'case-janela', case: 'processbase', title: 'ProcessBase, *em tela cheia*.' }, { template: 'case-duo', case: 'vizor' }, { template: 'case-capa', case: 'flavia-neto' }, { template: 'cta' }] },
  { id: 'case-unico', name: 'Um case em destaque', hint: 'Capa, janela, celular e chamada (4:5).', format: '4x5', slides: [{ template: 'case-capa', case: 'processbase' }, { template: 'case-janela', case: 'processbase' }, { template: 'case-duo', case: 'processbase' }, { template: 'cta' }] },
  { id: 'dor', name: 'Dor e caminho', hint: 'Lista, ilustração e chamada (4:5).', format: '4x5', slides: [{ template: 'lista' }, { template: 'ilustracao', illustration: 'clique-conversa', body: 'Do anúncio à conversa no WhatsApp.' }, { template: 'cta' }] },
  { id: 'stories', name: 'Sequência de stories', hint: 'Manifesto, case e chamada (9:16).', format: '9x16', slides: [{ template: 'manifesto' }, { template: 'case-duo', case: 'zena-viagens' }, { template: 'cta' }] },
  { id: 'quadrado', name: 'Carrossel quadrado', hint: 'Três lâminas 1:1.', format: '1x1', slides: [{ template: 'manifesto' }, { template: 'case-janela', case: 'contplan' }, { template: 'cta' }] },
]

export const buildPost = (model: Pick<PostModel, 'name' | 'format' | 'slides'> & { caption?: string }, brand: SetBrand, opts: { series?: string } = {}): Post => ({
  id: uid(),
  name: model.name,
  format: model.format,
  caption: model.caption,
  slides: model.slides.map((s, index) => buildSlide(s, brand, model.format, { index, total: model.slides.length, series: opts.series })),
})
