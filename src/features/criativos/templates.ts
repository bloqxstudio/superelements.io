import { mix } from '@/features/space/brand/color'
import { paletteOf, type Palette } from './brand'
import { caseBySlug, caseImage, ILLUSTRATIONS } from './library'
import type { CaseView, SlideSpec, TemplateId } from './plan'
import { FORMATS, uid, type FormatId, type ImageLayer, type Layer, type Post, type SetBrand, type ShapeLayer, type Slide, type TextLayer } from './types'

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
  dark: boolean
  /** Destaque que lê bem no fundo atual. */
  hi: string
  fg: string
  soft: string
}

const ctxOf = (brand: SetBrand, format: FormatId, dark: boolean): Ctx => {
  const p = paletteOf(brand)
  const { width: w, height: h } = FORMATS[format]
  return { brand, p, w, h, m: 84, dark, hi: dark ? mix(p.accent, '#ffffff', 0.5) : p.accent, fg: dark ? p.paper : p.ink, soft: dark ? 'rgba(255,255,255,0.62)' : p.muted }
}

const text = (c: Ctx, name: string, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'size'>): TextLayer => ({
  id: uid(), type: 'text', name, text: t, h: 0, font: c.brand.bodyFont, weight: 400, color: c.fg, align: 'left', lineHeight: 1.15, letterSpacing: 0, emphasisColor: c.hi, ...o,
})

const title = (c: Ctx, t: string, o: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'size'>) =>
  text(c, 'Título', t, { font: c.brand.headingFont, weight: 500, lineHeight: 0.98, letterSpacing: -0.05, emphasis: true, ...o })

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
    ? image('Logo', src, { x: c.m, y: c.m - 4, w: 210, h: 60, fit: 'contain' })
    : text(c, 'Logo', c.brand.name, { x: c.m, y: c.m, w: 500, size: 36, weight: 600, font: c.brand.headingFont, letterSpacing: -0.04 })
  return tag ? [mark, label(c, tag, { x: c.w - c.m - 560, y: c.m + 8, w: 560, align: 'right' })] : [mark]
}

const slide = (background: string, layers: Layer[]): Slide => ({ id: uid(), background, layers })

const bg = (c: Ctx) => (c.dark ? c.p.ink : c.p.paper)

type Build = (brand: SetBrand, format: FormatId, spec: SlideSpec) => Slide

const caseOf = (spec: SlideSpec) => caseBySlug(spec.case ?? '') ?? caseBySlug('processbase')!

const caseFoot = (c: Ctx, name: string, place?: string): Layer =>
  text(c, 'Rodapé', `${name}${place ? ` · ${place}` : ''}`, { x: c.m, y: c.h - c.m - 30, w: c.w - c.m * 2, size: 28, weight: 500, color: c.soft })

const BUILDERS: Record<TemplateId, Build> = {
  manifesto: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true)
    const tall = c.h > 1500
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 420, -160, 760], [-260, c.h - 520, 640]]),
      ...header(c, spec.label ?? 'Avence Studio'),
      title(c, spec.title ?? 'Sites com *acabamento* de estúdio.', { x: c.m, y: c.h * (tall ? 0.3 : 0.27), w: c.w - c.m * 2, size: tall ? 150 : 132 }),
      text(c, 'Apoio', spec.body ?? 'Identidade, texto e movimento trabalhando juntos.', { x: c.m, y: c.h - c.m - 190, w: c.w - c.m * 2 - 220, size: 38, color: c.soft, lineHeight: 1.3 }),
      square(c, c.w - c.m - 70, c.h - c.m - 70, 48),
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
      title(c, spec.title ?? `${k.name}, *em tela cheia*.`, { x: c.m, y: c.m + 120, w: winW, size: c.h > 1500 ? 108 : 92 }),
      image('Tela do case', img.src, { x: c.m, y: c.h - c.m - 60 - winH, w: winW, h: winH, frame: 'browser', focusY: spec.focus ?? 0 }),
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
    const baseY = c.h - c.m - 60
    return slide(bg(c), [
      ...backdrop(c, [[-280, c.h * 0.3, 700]]),
      ...header(c, spec.label ?? 'Computador e celular'),
      title(c, spec.title ?? `${k.name} nas *duas telas*.`, { x: c.m, y: c.m + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 104 : 88 }),
      image('Tela do computador', page.src, { x: c.m, y: baseY - winH - phH * 0.18, w: winW, h: winH, frame: 'browser', focusY: spec.focus ?? 0 }),
      image('Tela do celular', phone.src, { x: c.w - c.m - phW, y: baseY - phH, w: phW, h: phH, frame: 'phone', focusY: spec.focus ?? 0 }),
      caseFoot(c, k.name, k.place),
    ])
  },

  'case-capa': (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const k = caseOf(spec)
    const cover = caseImage(k, 'capa')
    const imgH = Math.round(c.h * 0.52)
    return slide(bg(c), [
      image('Capa do case', cover.src, { x: 0, y: 0, w: c.w, h: imgH, focusY: 0 }),
      label(c, spec.label ?? k.segment, { x: c.m, y: imgH + 70, w: c.w - c.m * 2 }),
      title(c, spec.title ?? `${k.name}.`, { x: c.m, y: imgH + 120, w: c.w - c.m * 2, size: 140 }),
      text(c, 'Apoio', spec.body ?? k.summary, { x: c.m, y: c.h - c.m - 150, w: c.w - c.m * 2 - 100, size: 32, color: c.soft, lineHeight: 1.3 }),
      square(c, c.w - c.m - 56, c.h - c.m - 56, 36),
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
      title(c, spec.title ?? 'Seu site tem *poucos segundos*.', { x: c.m, y: c.m + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 112 : 96 }),
      image('Ilustração', art.src, { x: c.m, y: c.h - c.m - 150 - artH, w: artW, h: artH, fit: 'contain' }),
      text(c, 'Apoio', spec.body ?? '', { x: c.m, y: c.h - c.m - 120, w: c.w - c.m * 2, size: 34, color: c.soft, lineHeight: 1.3 }),
    ])
  },

  lista: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false)
    const rows = spec.items?.length ? spec.items : ['O site não aparece quando procuram.', 'Quem chega no celular desiste.', 'O WhatsApp quase não toca.']
    const top = c.h * 0.4
    const step = Math.min(200, (c.h - top - c.m - 40) / rows.length)
    return slide(bg(c), [
      ...backdrop(c, [[c.w - 380, -240, 620]]),
      ...header(c, spec.label ?? 'Soa familiar?'),
      title(c, spec.title ?? 'Seu site *faz isso*?', { x: c.m, y: c.m + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 120 : 104 }),
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
      text(c, 'Contato', spec.body ?? '@avencestudio', { x: c.m, y: c.h - c.m - 40, w: c.w - c.m * 2, size: 34, color: c.soft }),
      square(c, c.w - c.m - 70, c.h - c.m - 70, 48),
    ])
  },
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
]

export const buildSlide = (spec: SlideSpec | TemplateId, brand: SetBrand, format: FormatId): Slide => {
  const s: SlideSpec = typeof spec === 'string' ? { template: spec } : spec
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

export const buildPost = (model: Pick<PostModel, 'name' | 'format' | 'slides'> & { caption?: string }, brand: SetBrand): Post => ({
  id: uid(),
  name: model.name,
  format: model.format,
  caption: model.caption,
  slides: model.slides.map((s) => buildSlide(s, brand, model.format)),
})
