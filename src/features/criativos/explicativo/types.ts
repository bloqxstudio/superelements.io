import type { SetBrand } from '../types'
import type { Research } from './pesquisa'
import type { Composition } from './composition'
/**
 * Vídeo explicativo (2026-11-07, o usuário: "eu posso gravar um video ou mandar um audio, isso vai
 * ser gerado uma animacao explicando o audio… animacoes virais, com efeitos de texto, animando
 * coisas… efeitos de som das transicoes, fotos tratadas, textos… animacoes de legendas").
 *
 * A fala (áudio ou vídeo gravado/enviado) vira palavras com o tempo de cada uma (Whisper no
 * navegador), a IA (ou o roteiro automático) divide em momentos e escolhe um padrão de animação
 * para cada um, e o motor fixo (`engine.ts`, uma cena em código) desenha tudo sincronizado com a
 * voz: texto cinético, objetos animados, fotos tratadas, legenda animada palavra a palavra,
 * transições com efeito de som.
 */

/** Uma palavra falada, com início e fim em segundos (no tempo do vídeo). */
export interface ExplainerWord {
  w: string
  s: number
  e: number
}

/** Os padrões de animação de cada momento. */
export const PATTERNS = {
  gancho: { label: 'Gancho', hint: 'Frase de impacto gigante, palavra por palavra, com tremida e clarão. Para abrir.' },
  titulo: { label: 'Título', hint: 'A ideia em poucas palavras, com a palavra-chave marcada.' },
  icone: { label: 'Objeto', hint: 'Um objeto (emoji) grande entra saltando, com um rótulo e partículas.' },
  lista: { label: 'Lista', hint: 'Itens que aparecem um a um, com check.' },
  numero: { label: 'Número', hint: 'Um número gigante contando, com o que ele significa.' },
  comparar: { label: 'Antes × depois', hint: 'Dois lados: o errado (✕) e o certo (✓).' },
  processo: { label: 'Passos', hint: 'Etapas ligadas por uma linha que se desenha.' },
  foto: { label: 'Foto', hint: 'Uma foto tratada (adesivo, polaroid ou duotone) entra girando, com rótulo.' },
  pergunta: { label: 'Pergunta', hint: 'Um ponto de interrogação gigante e a pergunta digitada.' },
  citacao: { label: 'Frase', hint: 'Uma frase forte entre aspas, escrita à mão.' },
  cta: { label: 'Chamada', hint: 'O fecho: salvar, comentar, seguir, com seta e botão pulsando.' },
} as const
export type PatternId = keyof typeof PATTERNS

export const TRANSITIONS = { chicote: 'Empurrar', circulo: 'Painel na cor da marca', zoom: 'Zoom', flash: 'Piscada de cor', corte: 'Corte seco' } as const
export type TransitionId = keyof typeof TRANSITIONS

export const SFX = { whoosh: 'Whoosh', swish: 'Swish leve', pop: 'Pop', impacto: 'Impacto', clique: 'Clique', digitar: 'Digitação', ding: 'Ding', subida: 'Subida', nenhum: 'Sem som' } as const
export type SfxId = keyof typeof SFX

/** Um momento do roteiro: um trecho da fala e a animação dele. */
export interface ExplainerBeat {
  /** Fecho que ocupa o quadro inteiro, sem vídeo ou legenda por cima. */
  fullScreen?: boolean
  id: string
  /** Segundos no vídeo. */
  start: number
  end: number
  pattern: PatternId
  /** O texto grande na tela (curto: até 6 palavras). */
  headline: string
  /** Palavras do headline destacadas na cor de destaque. */
  highlight?: string[]
  /** Linha menor de apoio. */
  sub?: string
  /** Itens (lista, passos, comparar: [errado, certo]). */
  items?: string[]
  /** Número (padrão número): o valor e o que vem junto (R$, %, x). */
  number?: { value: number; prefix?: string; suffix?: string }
  /** Ícone de traço do momento (`icons.ts`, nome em português). */
  icon?: string
  /** Legado: emoji do roteiro antigo; vira ícone pelo assunto (`iconForEmoji`). */
  emoji?: string
  /** O que a narração por IA diz nesta cena (escrito pela IA no roteiro; `narracao.ts`). */
  fala?: string
  /** Rótulos dos dois lados do antes × depois. */
  labels?: string[]
  /** Rótulo pequeno acima do título. */
  kicker?: string
  /** Nome de uma foto do vídeo (`ExplainerData.photos`). */
  photo?: string
  transition: TransitionId
  sfx: SfxId
  /** Estilo comercial: o plano da cena (`SHOTS` em `comercial.ts`). */
  shot?: string
  /** Estilo comercial: o fundo da cena (tinta, papel, branco, tom, destaque). */
  surface?: string
}

export const LAYOUTS = {
  animacao: { label: 'Só animação', hint: 'A tela inteira é animação; a sua voz por cima.' },
  dividido: { label: 'Você + animação', hint: 'Animação em cima, você embaixo (precisa de vídeo).' },
  rosto: { label: 'Você na tela', hint: 'Você em tela cheia, com os textos e objetos animando por cima (precisa de vídeo).' },
} as const
export type LayoutId = keyof typeof LAYOUTS

/**
 * Estilos de edição viral (2026-11-08, o usuário mandou uma referência com "uma tela por frase",
 * "palavra-herói", "legenda forte" e "contraste vermelho": "quero algo nessa linha, com os padrões
 * virais"). `editorial` é o motor de cenas em tela cheia; os outros põem a cena num cartão
 * flutuante (o print da cena, ou a animação dela em miniatura) com rótulo, legenda e a pessoa.
 */
export const LOOKS = {
  editorial: { label: 'Editorial', hint: 'Cenas em tela cheia, tipografia da marca, legenda embaixo.' },
  'tela-frase': { label: 'Uma tela por frase', hint: 'Em cima a tela da frase (print ou animação); embaixo a frase numa caixinha.' },
  'palavra-heroi': { label: 'Palavra-herói', hint: 'Degradê da marca, rótulo com ícone e uma palavra de destaque, cartão com brilho.' },
  'legenda-forte': { label: 'Legenda forte', hint: 'Você em tela cheia, uma palavra gigante na cor de destaque e o cartão por cima.' },
  contraste: { label: 'Contraste', hint: 'Metade de cima na cor forte da marca com rótulo e cartão; você embaixo.' },
  comercial: { label: 'Comercial animado', hint: 'Tipografia cinética de anúncio: objeto 3D, selo, cartões numerados, celular, ranking e orçamento, um plano por cena.' },
} as const
export type LookId = keyof typeof LOOKS

export const CAPTIONS = {
  pop: { label: 'Pop', hint: 'Palavra por palavra, saltando, a da vez na cor de destaque.' },
  karaoke: { label: 'Karaokê', hint: 'A frase inteira; a palavra falada ganha uma caixa colorida.' },
  caixa: { label: 'Caixa', hint: 'Duas ou três palavras por vez numa caixa branca, estilo TikTok.' },
  contorno: { label: 'Contorno', hint: 'Letras grandes com contorno grosso, uma palavra por vez.' },
  nenhuma: { label: 'Sem legenda', hint: '' },
} as const
export type CaptionId = keyof typeof CAPTIONS

/** Todos saem da marca: papel, tinta e destaque do DESIGN.md (`paletteOf`). */
export const THEMES = {
  alternado: { label: 'Alternado (papel e tinta)' },
  claro: { label: 'Papel da marca' },
  escuro: { label: 'Tinta da marca' },
} as const
export type ThemeId = keyof typeof THEMES

export const TREATMENTS = { limpa: 'Cartão com o canto da marca', adesivo: 'Borda branca', polaroid: 'Polaroid', duotone: 'Duotone na cor da marca' } as const
export type TreatmentId = keyof typeof TREATMENTS

/**
 * Os dois modos (2026-11-08, o usuário: "quero que a IA crie roteiro e crie o vídeo como um todo, sem
 * depender do vídeo ou áudio… são opções de brifar o texto… precisa identificar os 2 modos"):
 * - `narracao`: a fala gravada ou enviada é o áudio do vídeo; a animação acompanha a voz (com cortes).
 * - `briefing`: a fala, o vídeo ou um texto são só o briefing; a IA escreve o roteiro inteiro, com
 *   os tempos dela, e o vídeo sai sem a fala (texto animado, trilha e efeitos).
 */
export const MODES = {
  narracao: { label: 'É a narração do vídeo', hint: 'A sua voz vai no vídeo e a animação acompanha o que você fala. Dá para cortar pausas, vícios e trechos.' },
  briefing: { label: 'É um briefing para a IA', hint: 'A IA entende o que você quer, escreve o roteiro e monta o vídeo inteiro do jeito dela, sem a sua voz no vídeo (texto animado, trilha e efeitos).' },
} as const
export type ModeId = keyof typeof MODES

export interface ExplainerData {
  /** Tela final depois da fala mantida, sem estender o áudio original. */
  endCard?: { duration: number; headline: string; sub?: string }
  composition?: Composition
  /** Sem o campo: narração (vídeos criados antes dos dois modos). */
  mode?: ModeId
  /** Estilo de edição viral; sem o campo, editorial. */
  look?: LookId
  /** Trechos tirados da fala, em segundos da fala original (modo narração). */
  cuts?: { s: number; e: number }[]
  /** O briefing escrito (modo briefing), além ou no lugar da fala. */
  briefText?: string
  /** A pesquisa que originou o vídeo: os fatos e as fontes, para conferir antes de publicar. */
  research?: Research
  /** A fala: `asset:<id>` de um áudio ou vídeo do conjunto. */
  media?: { src: string; name: string; kind: 'audio' | 'video'; duration: number }
  words: ExplainerWord[]
  beats: ExplainerBeat[]
  layout: LayoutId
  captions: CaptionId
  /** `marca` é o valor antigo (= alternado). */
  theme: ThemeId | 'marca'
  /**
   * Mídias do vídeo: `asset:<id>` → nome que o roteiro usa. `kind: 'video'` é um clipe curto (vai no
   * cartão andando); `desc` diz à IA o que é; `credit` é o crédito que a licença pede (foto livre);
   * `origin`: marca (catálogo da conta), livre (Openverse), gerado (OpenAI) ou enviado.
   */
  photos: { src: string; name: string; kind?: 'image' | 'video'; desc?: string; credit?: string; origin?: 'marca' | 'livre' | 'gerado' | 'enviado' }[]
  treatment: TreatmentId
  /** 0 a 1. */
  sfxVolume: number
  voiceVolume: number
  /** Espelhar a câmera (selfie). */
  mirror?: boolean
  /** Recorte vertical: 0 mostra o topo do original, 0.5 centraliza, 1 mostra a base. */
  videoPositionY?: number
  /** A marca do vídeo; sem o campo, a do conjunto. "Usar a marca da conta" copia o DESIGN.md do Cérebro aqui. */
  brand?: SetBrand
  /** A narração foi feita por voz de IA (OpenAI): a voz e o jeito, para refazer. */
  voiceAI?: { provider?: 'openai' | 'elevenlabs'; voice: string; voiceName?: string; model?: string; tone: 'reels' | 'conversa' | 'anuncio' | 'elegante'; speed: number; direction?: string; rewrite?: boolean }
  /** Trilha de fundo (`asset:<id>` de um áudio do conjunto), abaixada sozinha quando há fala. */
  music?: { src: string; name: string; volume: number }
  /** Tratar a voz (limpa graves, presença, compressor, volume no padrão de redes). Padrão: ligado. */
  enhanceVoice?: boolean
  /** Abaixar o ruído entre as frases (pelas pausas da transcrição). Padrão: ligado. */
  gateVoice?: boolean
  /** O que a pessoa pediu para a IA (tom, público). */
  brief?: string
  /** A legenda do post, escrita junto com o roteiro. */
  caption?: string
}

export const emptyExplainer = (): ExplainerData => ({ words: [], beats: [], layout: 'animacao', captions: 'pop', theme: 'alternado', photos: [], treatment: 'limpa', sfxVolume: 0.5, voiceVolume: 1, enhanceVoice: true, gateVoice: true })

/** O que vai para o worker (`env.data`). */
/** O design system da marca, pronto para o motor (`brandTokens`). */
export interface BrandTokens {
  name: string
  ink: string
  paper: string
  accent: string
  onAccent: string
  accentOnLight: string
  accentOnDark: string
  muted: string
  mutedOnDark: string
  heading: string
  body: string
  emphasis: string
  emphasisItalic: boolean
  /** Canto do botão em px. */
  radius: number
}

export interface ExplainerEnvData {
  composition?: Composition
  look: LookId
  words: ExplainerWord[]
  beats: ExplainerBeat[]
  layout: LayoutId
  captions: CaptionId
  theme: ThemeId
  brand: BrandTokens
  /** Só os ícones que o roteiro usa (`icons.ts`). */
  icons: Record<string, [string, Record<string, string>][]>
  treatment: TreatmentId
  mirror: boolean
  videoPositionY?: number
  hasVideo: boolean
  videoSize?: { width: number; height: number }
}
