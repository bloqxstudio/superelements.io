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
  /** Escondida: não aparece no card nem na imagem exportada. */
  hidden?: boolean
  /** Travada: não se escolhe nem se arrasta pelo canvas (só pelo painel de camadas). */
  locked?: boolean
  /** Grupo a que pertence: camadas com o mesmo id se escolhem, movem e duplicam juntas. */
  group?: string
  /**
   * Faixa contínua: a mesma peça atravessa todos os cards do post (cada card guarda
   * uma cópia deslocada de uma largura de card por posição). `index` é a posição do
   * card na faixa; mudar uma cópia muda as outras.
   */
  span?: { id: string; index: number }
  /** Como a camada entra no vídeo (aba Motion). Sem isto, ela já está na tela desde o começo. */
  motion?: LayerMotion
}

/** Efeitos de entrada do motion (`motion.ts` desenha cada um). */
export type MotionFx = 'fade' | 'rise' | 'drop' | 'left' | 'right' | 'pop' | 'zoom' | 'wipe' | 'wipe-up' | 'ken' | 'pulse' | 'words' | 'letters' | 'move' | 'keys'

/** Curva de um trecho entre keyframes (do anterior até este). */
export type KeyEase = MotionEase | 'salto' | 'acelera' | 'segura'

/**
 * Um ponto da animação livre (`fx: 'keys'`): no segundo `t` do slide a camada está
 * deslocada `x`/`y` px do lugar dela, na escala e no giro dados. `sx`/`sy` amassam
 * e esticam (o pão que cai e achata). O que não vem repete o ponto anterior.
 */
export interface MotionKey {
  t: number
  x?: number
  y?: number
  scale?: number
  sx?: number
  sy?: number
  rotate?: number
  opacity?: number
  ease?: KeyEase
}

/** Movimento contínuo depois da entrada (o lanche que respira, a etiqueta que balança). */
export type MotionLoop = 'girar' | 'flutuar' | 'respirar' | 'balancar' | 'pulsar'

/** Um impacto: a camada (ou a tela) treme a partir de `t`. */
export interface MotionShake {
  t: number
  /** Segundos (0,35 sem o campo). */
  dur?: number
  /** Px (18 sem o campo). */
  amp?: number
}

/** Clarão da tela inteira (corte publicitário na batida). */
export interface MotionFlash {
  t: number
  dur?: number
  color?: string
}

/** Saídas: a camada sai antes do fim do slide. */
export type MotionExit = 'fade' | 'rise' | 'drop' | 'left' | 'right' | 'zoom' | 'pop'

/** Curva da entrada. */
export type MotionEase = 'suave' | 'forte' | 'linear' | 'elastico'

/** Movimento de câmera no slide inteiro (o fundo fica parado). */
export type SlideCamera = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down'

export interface LayerMotion {
  fx: MotionFx
  /** Segundos desde o começo do slide. */
  start: number
  /** Segundos da entrada. */
  dur: number
  /** Texto com número: conta de 0 até ele durante a entrada. */
  count?: boolean
  /** Curva da entrada; sem ela, suave. */
  ease?: MotionEase
  /** `move`: de onde a camada vem (px a partir do lugar dela, escala e giro iniciais). */
  from?: { dx?: number; dy?: number; scale?: number; rotate?: number }
  /** Sai antes do fim do slide. */
  exit?: MotionExit
  /** Segundos da saída (0,4 sem o campo). */
  exitDur?: number
  /** `fx: 'keys'`: os pontos da animação livre, em segundos do slide. */
  keys?: MotionKey[]
  /** Movimento contínuo depois da entrada. */
  loop?: MotionLoop
  /** Velocidade do loop (1 sem o campo). */
  loopSpeed?: number
  /** Rastro de velocidade (motion blur) nos movimentos rápidos. */
  blur?: boolean
  /** Tremidas da camada. */
  shakes?: MotionShake[]
}

/** Transição de um slide para o próximo no vídeo do post. */
export type MotionTransition = 'cut' | 'fade' | 'push' | 'zoom'

export interface PostMotion {
  /** Segundos de cada slide; 0 ou ausente = o tempo das entradas mais uma pausa para ler. */
  slideDur?: number
  transition?: MotionTransition
  /** Segundos da transição. */
  transitionDur?: number
  /** Trilha ou narração do vídeo (um áudio enviado ao conjunto). */
  audio?: MotionAudio
  /**
   * O que o post vira: um vídeo só com todos os slides (reels e story; o padrão), ou um
   * carrossel em que cada slide é um item: os animados viram vídeo, os parados, imagem.
   */
  output?: 'video' | 'carousel'
  /** Batidas da trilha (segundos do vídeo), lidas do áudio: os cortes e impactos se encaixam nelas. */
  beats?: number[]
  bpm?: number
}

export interface MotionAudio {
  /** `asset:<id>` de um áudio do conjunto. */
  src: string
  name: string
  /** 0 a 1 */
  volume: number
  /** De onde a trilha começa (segundos dentro do arquivo). */
  offset: number
  fadeIn: number
  fadeOut: number
}

export interface BrandMotion {
  style: 'suave' | 'dinamico' | 'impacto'
  transition?: MotionTransition
  transitionDur?: number
  /** Multiplica o tempo das entradas (0,7 mais rápido, 1,3 mais lento). */
  pace?: number
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
  /** Itálico (a Barlow Condensed em itálico 900 "para impacto", 2026-11-03). */
  italic?: boolean
  /** `*palavra*` vira o destaque em serifa itálica na cor de destaque da marca. */
  emphasis?: boolean
  emphasisColor?: string
  /** Fonte do destaque; sem ela, a serifa itálica dos conjuntos antigos. */
  emphasisFont?: string
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
  /** Câmera do slide no vídeo (aba Motion). */
  camera?: SlideCamera
  /** Segundos do slide no vídeo; sem o campo, o ritmo do post (ou as entradas mais a pausa). */
  dur?: number
  /** Clarões da tela inteira (segundos do slide). */
  flashes?: MotionFlash[]
  /** A tela inteira treme (impacto), em segundos do slide. */
  shakes?: MotionShake[]
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
  /** Marcado como aprovado (é o padrão a seguir; o resto pode ser excluído). */
  approved?: boolean
  /** Ritmo do vídeo do post (aba Motion). */
  motion?: PostMotion
  /**
   * Capa do vídeo no Instagram (reels): um momento do vídeo (`at`, segundos) ou uma
   * imagem enviada ao conjunto (`src`, `asset:<id>`). Sem ela, o fim das entradas do primeiro slide.
   */
  cover?: { at: number } | { src: string }
}

export interface SetBrand {
  name: string
  /** #rrggbb, em ordem de importância na marca. */
  colors: { name: string; hex: string }[]
  headingFont: string
  bodyFont: string
  /**
   * Fonte do destaque (`*palavra*`). Sem o campo, a serifa itálica (Instrument Serif), que é da
   * Avence: marcas novas guardam a própria fonte aqui e o destaque fica só na cor da marca.
   */
  emphasisFont?: string
  /** Canto do botão em px (999 = pílula). Sem o campo, quadrado. */
  buttonRadius?: number
  /** Logo para fundo claro / escuro. */
  logoOnLight?: string
  logoOnDark?: string
  /**
   * Linguagem dos modelos: a editorial (direção criativa de 26/10/2026: metadados
   * no topo, logo pequeno embaixo, sem anéis nem pontos) ou, sem o campo, a
   * clássica (anéis finos, grade de pontos, quadrado girado).
   */
  look?: 'editorial'
  /** O motion da marca: estilo, transição e ritmo que os posts novos recebem ao animar (estúdio › "Guardar como padrão da marca"). */
  motion?: BrandMotion
}

export interface SetAsset {
  id: string
  name: string
  path: string
  width: number
  height: number
  /** Sem o campo, imagem. Vídeo vira camada de imagem que anda; áudio é a trilha do motion. */
  kind?: 'video' | 'audio'
  /** Segundos (vídeo e áudio). */
  duration?: number
}

export interface CreativeSet {
  id: string
  name: string
  projectId?: string
  projectName?: string
  /** Guardado na pasta do projeto: a equipe dele abre e edita junto, ao vivo. */
  shared?: boolean
  brand: SetBrand
  /** O conteúdo do Plano de onde nasceu o conjunto, e o briefing compartilhado que ele recebeu. */
  source?: { contentId: string; contextVersion?: number }
  brief?: string
  posts: Post[]
  assets: SetAsset[]
  /**
   * Posts pedidos por uma IA de fora (MCP da Sinfy) e ainda não desenhados: o roteiro de cada slide.
   * O Criativos monta na marca ao abrir (`materializePending`) e apaga o campo.
   */
  pending?: import('./plan').PostPlan[]
  /** A marca ainda não foi escolhida (veio do MCP): resolve a da conta ao montar. */
  pendingBrand?: boolean
  /** Quem criou fora da tela: `mcp` (uma IA conectada pela chave de uma pessoa). */
  origin?: 'mcp'
  /** Cenas de motion escritas em código (pela IA ou à mão), no estúdio de cena. */
  scenes?: CodeScene[]
  /**
   * O padrão visual do conjunto, aprendido com a pessoa (a Iara grava a cada ajuste: "título nunca
   * passa de duas linhas", "foto sempre à direita"). Vai em toda edição pela IA deste conjunto.
   */
  styleRules?: string[]
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
  /** Os posts com a capa de cada um (o primeiro slide), para as listas acharem o criativo sem abrir o conjunto. */
  postsInfo?: PostInfo[]
}

export interface PostInfo {
  id: string
  name: string
  format: FormatId
  slides: number
  /** Tem animação (aba Motion). */
  motion?: boolean
  approved?: boolean
  /** Assinatura do primeiro slide: a capa vale enquanto ela não muda. */
  hash: string
  /** Caminho da capa no Storage (JPEG pequeno), quando já foi gerada para esse `hash`. */
  cover?: string
}

export const uid = () => Math.random().toString(36).slice(2, 10)

/**
 * Uma cena de motion escrita em código: uma função que desenha cada quadro num
 * canvas (`scene.ts`), rodada num worker isolado e gravada em MP4 como os posts.
 */
export interface CodeScene {
  id: string
  name: string
  format: FormatId
  /** Segundos. */
  duration: number
  /** O código da cena (o contrato está em `scene.ts`). */
  code: string
  /** Imagens do conjunto que a cena usa: `asset:<id>` → nome pelo qual o código as chama. */
  images: { src: string; name: string }[]
  audio?: MotionAudio
  beats?: number[]
  bpm?: number
  /** O último pedido feito à IA. */
  prompt?: string
  /** O criativo de onde a cena nasceu: as camadas desses slides entram na cena como peças (`env.post`). */
  source?: { postId: string; slideIds: string[] }
  updatedAt: number
}
