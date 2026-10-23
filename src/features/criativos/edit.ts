/**
 * Pedido de edição por conversa: a IA recebe o conjunto (ou o trecho
 * selecionado) e devolve operações pequenas sobre os slides e as camadas, que o
 * editor aplica num único passo desfazível. Sem imports de `@/`: o servidor de
 * desenvolvimento (Node) lê este arquivo também.
 */

import { ILLUSTRATION_IDS, TEMPLATE_IDS, type SlideSpec } from './plan.ts'

export const EDIT_OPS = ['update_layer', 'add_layer', 'delete_layer', 'move_layer', 'update_slide', 'add_slide', 'duplicate_slide', 'delete_slide', 'update_post'] as const
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
  fill?: string
  stroke?: string
  strokeWidth?: number
  gap?: number
  dot?: number
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
}

export interface EditRequest {
  message: string
  /** Escopo da conversa: o que estava selecionado. */
  scope: 'layer' | 'slide' | 'post' | 'set'
  postId?: string
  slideId?: string
  layerId?: string
  brand: { name: string; colors: { name: string; hex: string }[]; headingFont: string; bodyFont: string; emphasisFont?: string }
  /** Conjunto resumido para a IA ler (ids, textos, caixas). */
  posts: unknown
  /** Fontes e imagens que ela pode usar. */
  fonts: string[]
  images: { src: string; label: string }[]
  cases: { slug: string; name: string; segment: string; summary: string }[]
  /** JPEG (data URL) do slide selecionado, para ela ver o que a pessoa vê. */
  image?: string
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
  fill: { type: 'string' },
  stroke: { type: 'string' },
  strokeWidth: { type: 'number' },
  gap: { type: 'number' },
  dot: { type: 'number' },
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
          layer: { type: 'object', additionalProperties: false, properties: layerProps },
          background: { type: 'string' },
          spec: {
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
            },
          },
          direction: { type: 'string', enum: ['front', 'back', 'up', 'down'] },
          name: { type: 'string' },
          caption: { type: 'string' },
        },
      },
    },
  },
} as const
