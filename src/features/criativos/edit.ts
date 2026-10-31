/**
 * Pedido de edição por conversa: a IA recebe o conjunto (ou o trecho
 * selecionado) e devolve operações pequenas sobre os slides e as camadas, que o
 * editor aplica num único passo desfazível. Sem imports de `@/`: o servidor de
 * desenvolvimento (Node) lê este arquivo também.
 */

import { ILLUSTRATION_IDS, TEMPLATE_IDS, type SlideSpec } from './plan.ts'

export const EDIT_OPS = ['update_layer', 'add_layer', 'delete_layer', 'move_layer', 'update_slide', 'add_slide', 'duplicate_slide', 'delete_slide', 'update_post', 'add_post', 'delete_post', 'spread_layer'] as const
export type EditOpName = (typeof EDIT_OPS)[number]

/** Campos que uma camada pode ter; cada tipo usa os seus e o editor ignora o resto. */
export interface LayerFields {
  type?: 'text' | 'image' | 'rect' | 'ring' | 'dots'
  name?: string
  x?: number
  y?: number
  w?: number
  h?: number
  opacity?: number
  rotation?: number
  text?: string
  font?: string
  weight?: number
  size?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  upper?: boolean
  emphasis?: boolean
  emphasisColor?: string
  src?: string
  fit?: 'cover' | 'contain'
  radius?: number
  frame?: 'none' | 'browser' | 'phone'
  focusY?: number
  /** Imagem a gerar (camada de imagem): descrição da cena, em inglês. */
  prompt?: string
  fill?: string
  /** Degradê: segunda cor da forma (a mesma cor com alfa 0 faz sumir). */
  fill2?: string
  /** Direção do degradê em graus (180 desce, 90 vai para a direita, 0 sobe). */
  angle?: number
  stroke?: string
  strokeWidth?: number
  gap?: number
  dot?: number
}

/** Um slide por camadas (sem modelo): o fundo e as camadas, de baixo para cima. */
export interface SlideDef {
  background?: string
  /** Em vez de camadas: um modelo pronto. */
  spec?: SlideSpec
  layers?: LayerFields[]
}

export interface PostDef {
  name?: string
  /** Formato pronto (4x5, 1x1, 9x16, 16x9, link, 2x3) ou tamanho livre ("1200x628"). */
  format?: string
  caption?: string
  slides?: SlideDef[]
}

export interface EditOp {
  op: EditOpName
  postId?: string
  slideId?: string
  layerId?: string
  layer?: LayerFields
  background?: string
  /** add_slide: modelo e conteúdo do slide novo (entra depois de `slideId`, ou no fim do post). */
  spec?: SlideSpec
  /** move_layer */
  direction?: 'front' | 'back' | 'up' | 'down'
  /** update_post */
  name?: string
  caption?: string
  /** update_post: muda o formato e reacomoda as camadas. */
  format?: string
  /** add_slide: slide por camadas, no lugar de `spec`. */
  slide?: SlideDef
  /** add_post */
  post?: PostDef
}

export interface EditRequest {
  /** Qual IA desta máquina faz o trabalho. */
  agent?: 'claude' | 'codex'
  /** Perfil do agente (quem é, como trabalha, regras). */
  persona?: string
  message: string
  /** Briefing do plano da empresa, quando o conjunto nasceu de um conteúdo (Conteúdos). */
  brief?: string
  /** Escopo da conversa: o que estava selecionado. */
  scope: 'layer' | 'slide' | 'post' | 'set'
  postId?: string
  slideId?: string
  layerId?: string
  /** Vários componentes escolhidos (o `layerId` é o último). */
  layerIds?: string[]
  brand: { name: string; colors: { name: string; hex: string }[]; headingFont: string; bodyFont: string; emphasisFont?: string }
  /** Conjunto resumido para a IA ler (ids, textos, caixas). */
  posts: unknown
  /** Fontes e imagens que ela pode usar. */
  fonts: string[]
  images: { src: string; label: string }[]
  cases: { slug: string; name: string; segment: string; summary: string }[]
  /** JPEG (data URL) do slide selecionado, para ela ver o que a pessoa vê. */
  image?: string
  /** Prints e imagens que a pessoa anexou (referências); `src` é onde ficaram no conjunto, para usar numa camada. */
  attachments?: { name: string; src: string; data: string }[]
  /** Escopo post: uma imagem de cada slide do post, na ordem (para a IA ver a fileira inteira). */
  previews?: string[]
  /** O que a pessoa marcou com @ para trazer ao pedido (posts, slides, projetos, cases), já resumido. */
  references?: { kind: string; label: string; text: string; images?: string[] }[]
  /** Projetos da conta (nomes), para a IA saber o que existe e pedir o @ certo. */
  projects?: string[]
  /** Há uma chave de imagens neste computador: a IA pode pedir imagens (`prompt` numa camada de imagem). */
  canGenerateImages?: boolean
  /** Skill escolhida: um jeito de trabalhar para este pedido. */
  skill?: { name: string; instructions: string }
  history?: { role: 'user' | 'ai'; text: string }[]
}

export interface EditResponse {
  reply: string
  ops: EditOp[]
}

const layerProps = {
  type: { type: 'string', enum: ['text', 'image', 'rect', 'ring', 'dots'] },
  name: { type: 'string' },
  x: { type: 'number' },
  y: { type: 'number' },
  w: { type: 'number' },
  h: { type: 'number' },
  opacity: { type: 'number' },
  rotation: { type: 'number' },
  text: { type: 'string' },
  font: { type: 'string' },
  weight: { type: 'number' },
  size: { type: 'number' },
  color: { type: 'string' },
  align: { type: 'string', enum: ['left', 'center', 'right'] },
  lineHeight: { type: 'number' },
  letterSpacing: { type: 'number' },
  upper: { type: 'boolean' },
  emphasis: { type: 'boolean' },
  emphasisColor: { type: 'string' },
  src: { type: 'string' },
  fit: { type: 'string', enum: ['cover', 'contain'] },
  radius: { type: 'number' },
  frame: { type: 'string', enum: ['none', 'browser', 'phone'] },
  focusY: { type: 'number' },
  prompt: { type: 'string' },
  fill: { type: 'string' },
  fill2: { type: 'string' },
  angle: { type: 'number' },
  stroke: { type: 'string' },
  strokeWidth: { type: 'number' },
  gap: { type: 'number' },
  dot: { type: 'number' },
} as const

const specSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['template'],
  properties: {
    template: { type: 'string', enum: [...TEMPLATE_IDS] },
    label: { type: 'string' },
    title: { type: 'string' },
    body: { type: 'string' },
    items: { type: 'array', maxItems: 4, items: { type: 'string' } },
    cta: { type: 'string' },
    case: { type: 'string' },
    view: { type: 'string', enum: ['capa', 'pagina', 'celular'] },
    illustration: { type: 'string', enum: [...ILLUSTRATION_IDS] },
    focus: { type: 'number' },
    dark: { type: 'boolean' },
    prompt: { type: 'string' },
    number: { type: 'string' },
  },
} as const

const layerSchema = { type: 'object', additionalProperties: false, properties: layerProps } as const

const slideSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { background: { type: 'string' }, spec: specSchema, layers: { type: 'array', maxItems: 60, items: layerSchema } },
} as const

export const EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ops'],
  properties: {
    reply: { type: 'string' },
    ops: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op'],
        properties: {
          op: { type: 'string', enum: [...EDIT_OPS] },
          postId: { type: 'string' },
          slideId: { type: 'string' },
          layerId: { type: 'string' },
          layer: layerSchema,
          background: { type: 'string' },
          spec: specSchema,
          slide: slideSchema,
          post: {
            type: 'object',
            additionalProperties: false,
            properties: { name: { type: 'string' }, format: { type: 'string' }, caption: { type: 'string' }, slides: { type: 'array', maxItems: 12, items: slideSchema } },
          },
          format: { type: 'string' },
          direction: { type: 'string', enum: ['front', 'back', 'up', 'down'] },
          name: { type: 'string' },
          caption: { type: 'string' },
        },
      },
    },
  },
} as const
