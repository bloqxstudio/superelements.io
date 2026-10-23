/**
 * Criativos: posts de Instagram montados num editor de camadas (como o Canva),
 * a partir da marca de um projeto do Space. Tudo é desenhado num canvas 2D no
 * tamanho real de exportação, então o que se vê é o que se baixa.
 */

/** Um formato pronto (`4x5`) ou um tamanho livre (`1200x628px`). */
export type FormatId = string

export interface Format {
  id: FormatId
  label: string
  use: string
  width: number
  height: number
}

export const FORMATS: Record<string, Format> = {
  '4x5': { id: '4x5', label: 'Feed 4:5', use: 'Feed e anúncio', width: 1080, height: 1350 },
  '1x1': { id: '1x1', label: 'Quadrado 1:1', use: 'Feed e carrossel', width: 1080, height: 1080 },
  '9x16': { id: '9x16', label: 'Story 9:16', use: 'Stories e Reels', width: 1080, height: 1920 },
  '16x9': { id: '16x9', label: 'Paisagem 16:9', use: 'Capa, YouTube e apresentação', width: 1920, height: 1080 },
  link: { id: 'link', label: 'Link 1.91:1', use: 'Anúncio de link e LinkedIn', width: 1200, height: 628 },
  '2x3': { id: '2x3', label: 'Vertical 2:3', use: 'Pinterest', width: 1000, height: 1500 },
}

const CUSTOM = /^(\d{3,4})x(\d{3,4})px$/

/** Tamanho livre como id de formato. Cada lado fica entre 200 e 4000 px. */
export const customFormat = (width: number, height: number): FormatId => `${Math.min(4000, Math.max(200, Math.round(width)))}x${Math.min(4000, Math.max(200, Math.round(height)))}px`

/** "1080x1350", "1080 × 1350 px" ou o id de um formato pronto; nada que se leia: undefined. */
export function parseFormat(text: string | undefined): FormatId | undefined {
  const raw = (text ?? '').trim().toLowerCase()
  if (raw in FORMATS) return raw
  const m = /^(\d{3,4})\s*[x×]\s*(\d{3,4})\s*(px)?$/.exec(raw)
  return m ? customFormat(Number(m[1]), Number(m[2])) : undefined
}

/** Largura e altura de um formato, pronto ou livre. */
export function sizeOf(id: FormatId): Format {
  const known = FORMATS[id]
  if (known) return known
  const m = CUSTOM.exec(id)
  return m ? { id, label: `${m[1]}×${m[2]}`, use: 'Tamanho livre', width: Number(m[1]), height: Number(m[2]) } : FORMATS['4x5']
}

export const FORMAT_LIST = Object.values(FORMATS)

interface LayerBase {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  /** 0 a 1 */
  opacity?: number
  /** Graus, em volta do centro da camada. */
  rotation?: number
}

export type TextAlign = 'left' | 'center' | 'right'

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  font: string
  weight: number
  size: number
  color: string
  align: TextAlign
  /** Proporção do tamanho (1.1) */
  lineHeight: number
  /** em */
  letterSpacing: number
  upper?: boolean
  /** `*palavra*` vira o destaque em serifa itálica na cor de destaque da marca. */
  emphasis?: boolean
  emphasisColor?: string
}

/** Moldura em volta da imagem: a tela de um site num navegador ou num celular. */
export type ImageFrame = 'none' | 'browser' | 'phone'

export interface ImageLayer extends LayerBase {
  type: 'image'
  /** `asset:<id>` (enviada para o conjunto), ou um endereço. */
  src: string
  fit: 'cover' | 'contain'
  radius: number
  frame: ImageFrame
  /** Posição vertical da imagem dentro da moldura (0 topo, 1 fim); serve para páginas altas. */
  focusY?: number
  /** O que pediu à IA de imagens; sem `src` ainda, a camada mostra "gerando". */
  prompt?: string
  /** A última tentativa de gerar esta imagem falhou. */
  genFailed?: boolean
}

export interface ShapeLayer extends LayerBase {
  type: 'rect'
  fill: string
  /** Segunda cor: com ela a forma vira um degradê de `fill` para `fill2`. */
  fill2?: string
  /** Direção do degradê em graus, como no CSS: 180 desce (de cima para baixo), 90 vai para a direita, 0 sobe. */
  angle?: number
  radius: number
  stroke?: string
  strokeWidth?: number
}

/** Círculo só de contorno (os anéis finos da identidade). */
export interface RingLayer extends LayerBase {
  type: 'ring'
  stroke: string
  strokeWidth: number
}

/** Grade de pontos (textura dos fundos escuros). */
export interface DotsLayer extends LayerBase {
  type: 'dots'
  color: string
  gap: number
  dot: number
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | RingLayer | DotsLayer

export interface Slide {
  id: string
  background: string
  layers: Layer[]
}

export interface Post {
  id: string
  name: string
  format: FormatId
  /** Guias de edição deste post (margens, colunas, terços, zonas do Instagram) e o ímã. */
  grid?: import('./grid').PostGrid
  slides: Slide[]
  /** Legenda para publicar junto com o post. */
  caption?: string
}

export interface SetBrand {
  name: string
  /** #rrggbb, em ordem de importância na marca. */
  colors: { name: string; hex: string }[]
  headingFont: string
  bodyFont: string
  /** Serifa dos destaques (Instrument Serif itálico, na Avence). */
  emphasisFont?: string
  /** Logo para fundo claro / escuro. */
  logoOnLight?: string
  logoOnDark?: string
}

export interface SetAsset {
  id: string
  name: string
  path: string
  width: number
  height: number
}

export interface CreativeSet {
  id: string
  name: string
  projectId?: string
  projectName?: string
  /** Guardado na pasta do projeto: a equipe dele abre e edita junto, ao vivo. */
  shared?: boolean
  brand: SetBrand
  posts: Post[]
  assets: SetAsset[]
  createdAt: number
  updatedAt: number
}

/** O que a lista mostra sem abrir o conjunto. */
export interface SetSummary {
  id: string
  name: string
  projectId?: string
  projectName?: string
  shared?: boolean
  posts: number
  colors: string[]
  updatedAt: number
}

export const uid = () => Math.random().toString(36).slice(2, 10)
