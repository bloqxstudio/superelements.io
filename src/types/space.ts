import type { MotionSpec } from '@/features/space/brand/layers'

export type NodeType = 'section' | 'text' | 'color-palette'

/**
 * Movimento de uma seção, escolhido no nível Movimento: seguir a marca, manter
 * o que a seção trouxe ou um movimento próprio. Sem valor, segue a marca.
 */
export type SectionMotion = { source: 'brand' } | { source: 'original' } | { source: 'custom'; spec: MotionSpec }

/** Ajustes de uma seção feitos nos níveis de edição; entram depois da marca. */
export interface SectionLevels {
  motion?: SectionMotion
}

/** Camada que o Space está editando. 'structure' é o canvas de sempre (ordem e conteúdo das seções). */
export type EditLevel = 'structure' | 'motion' | 'colors' | 'typography' | 'shape' | 'photos'

/** Seção importada do WordPress do cliente: fica como veio, sem a troca de cores e fontes da marca. */
export interface SectionOrigin {
  kind: 'wordpress'
  siteUrl: string
  postId: number
}

export interface SectionNodeData {
  title: string
  elementorJson: string
  /** Id da seção no pack Section Express, quando veio da biblioteca. */
  sourceId?: string
  /** Nomes amigáveis das camadas no Navigator, por id do elemento. Não entram no export Elementor. */
  navigatorLabels?: Record<string, string>
  levels?: SectionLevels
  origin?: SectionOrigin
  /** Settings ajustadas à mão no painel de propriedades, por id do elemento: valem por cima da marca. */
  pinned?: Record<string, string[]>
  /**
   * Instância de um componente: a seção não tem conteúdo próprio e mostra as
   * seções da folha do componente (`SpacePage.part.kind === 'section'`), sem
   * cópia. No site com Elementor Pro, vira o widget Modelo apontando para ele.
   */
  instanceOf?: string
}

/** Elemento aberto no Navigator. Vive só na sessão e não entra no JSON do projeto. */
export interface NavigatorSelection {
  sectionId: string
  elementId: string
}

/** Tamanho de tela em que o canvas desenha as seções e o painel grava os ajustes. */
export type EditorDevice = 'desktop' | 'tablet' | 'mobile'

export interface TextNodeData {
  content: string
}

export interface ColorPaletteNodeData {
  name: string
  colors: string[]
}

export type SpaceNodeData = SectionNodeData | TextNodeData | ColorPaletteNodeData

export interface SpaceNode {
  id: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  data: SpaceNodeData
}

/**
 * Página do canvas: agrupa seções numa coluna, na ordem em que vão para o site.
 * Seção de uma página não se arrasta sozinha; fora de página, fica solta.
 */
export interface SpacePage {
  id: string
  name: string
  /** Canto de cima à esquerda do quadro da página, no mundo do canvas. */
  x: number
  y: number
  /** Seções da página, de cima para baixo. */
  sectionIds: string[]
  /** Página do WordPress do cliente que esta página atualiza ao publicar. */
  wordpress?: PageWordPressLink
  /** Título, endereço, SEO e imagem destacada que vão junto ao publicar. */
  details?: PageDetails
  /** Esta folha é uma parte do site (cabeçalho ou rodapé), não uma página: aparece nas outras. */
  part?: PagePart
}

/** Cabeçalho e rodapé aparecem sozinhos em todas as páginas; a seção (componente livre) entra onde for posta. */
export type PagePartKind = 'header' | 'footer' | 'section'

/**
 * Parte que se repete no site, como os modelos de cabeçalho e rodapé do Theme
 * Builder do Elementor: as seções existem uma vez só, na folha da parte, e
 * cada página mostra a mesma parte em cima (ou embaixo). Mudou nela, muda em
 * todas.
 */
export interface PagePart {
  kind: PagePartKind
  /** Páginas que ficam sem esta parte (a exceção da condição do Elementor). Sem nenhuma, vale para o site inteiro. */
  exclude?: string[]
}

/** O que a página leva ao site além das seções. Campo vazio fica com o padrão do WordPress ou do plugin de SEO. */
export interface PageDetails {
  /** Título da página no WordPress; sem ele vale o nome da página no canvas. */
  title?: string
  /** Endereço (slug); sem ele o WordPress cria pelo título. */
  slug?: string
  seoTitle?: string
  /** Meta descrição, a que aparece no Google. */
  description?: string
  focusKeyword?: string
  featured?: FeaturedImage
}

/** Campos do modelo de imagem destacada, para abrir de novo e editar. */
export interface FeaturedFields {
  title: string
  subtitle?: string
  /** Foto do modelo: endereço ou data URL. */
  photo?: string
  /** Cor de fundo, em hex. */
  color?: string
  logo: boolean
}

/**
 * Imagem destacada: montada por um modelo (a imagem pronta vai em data URL),
 * um arquivo enviado daqui, uma imagem que já está na biblioteca do site, ou
 * nenhuma (tira a que o site tem). Sem valor, a do site fica como está.
 */
export type FeaturedImage =
  | { kind: 'template'; template: string; fields: FeaturedFields; image: string }
  | { kind: 'upload'; image: string; name: string }
  | { kind: 'media'; id: number; url: string }
  | { kind: 'none' }

export interface PageWordPressLink {
  siteUrl: string
  postId: number
  title: string
  link: string
  status: string
  /** `modified_gmt` do WordPress na última importação ou publicação, para saber se alguém mexeu depois. */
  modifiedGmt: string
  syncedAt: number
  /** Componente: resumo do conteúdo publicado, para saber se a folha mudou depois. */
  contentHash?: string
}

/** Onde uma seção arrastada entraria: página e posição na coluna (contada sem a própria seção). */
export interface PageDropTarget {
  pageId: string
  index: number
  /** Seção do canvas sendo arrastada; sem ela, vem da biblioteca. */
  sectionId?: string
}

export interface SpaceConnection {
  id: string
  sourceId: string
  targetId: string
  type: 'apply-copy' | 'apply-colors'
}

export interface CanvasTransform {
  x: number
  y: number
  zoom: number
}

export interface PendingConnection {
  sourceId: string
  sourceX: number
  sourceY: number
  currentX: number
  currentY: number
}
