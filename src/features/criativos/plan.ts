/**
 * O que a IA devolve para montar posts: para cada slide, um modelo (layout já
 * desenhado na identidade) e os textos que entram nele. A IA não desenha nem
 * posiciona nada: escolhe o modelo, escreve e aponta o case. Sem imports de
 * `@/`: o servidor de desenvolvimento (Node) lê este arquivo também.
 */

export const TEMPLATE_IDS = ['manifesto', 'case-janela', 'case-duo', 'case-capa', 'ilustracao', 'lista', 'cta', 'viral-capa', 'viral-foto', 'viral-dado', 'viral-frase', 'viral-fecho'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]
export type CaseView = 'capa' | 'pagina' | 'celular'
export const ILLUSTRATION_IDS = ['site-parado', 'clique-conversa', 'previa-site', 'antes-depois', 'camadas-wordpress'] as const
export type FormatKey = '4x5' | '1x1' | '9x16'

/** Um slide: modelo e conteúdo. Todo campo é opcional; o modelo tem texto padrão. */
export interface SlideSpec {
  template: TemplateId
  /** Rótulo curto em maiúsculas (até 4 palavras). */
  label?: string
  /** Título; `*palavra*` vira o destaque em serifa azul (uma palavra por título). */
  title?: string
  body?: string
  /** Itens do modelo "lista" (3 a 4, uma linha cada). */
  items?: string[]
  /** Texto do botão do modelo "cta". */
  cta?: string
  /** `slug` do case (modelos case-*). */
  case?: string
  /** Que tela do case aparece em case-janela. */
  view?: CaseView
  /** Id da ilustração do modelo "ilustracao". */
  illustration?: string
  /** 0 a 1: que trecho da página inteira aparece na janela (0 = topo). */
  focus?: number
  /** Fundo escuro (padrão) ou papel. */
  dark?: boolean
  /** Modelos viral-*: a cena da imagem a gerar (em inglês), sem texto dentro. */
  prompt?: string
  /** viral-dado e viral-foto: o número grande ("73%", "2\u00ba", "02"). */
  number?: string
}

export interface PostPlan {
  name: string
  format: FormatKey
  caption: string
  slides: SlideSpec[]
}

export interface PlanRequest {
  brief: string
  format: FormatKey
  slides: number
  posts: number
  /** Qual IA desta máquina faz o trabalho. */
  engine?: 'claude' | 'codex'
  /** Perfil do agente (quem é, como trabalha, regras). */
  persona?: string
  cases: { slug: string; name: string; segment: string; place?: string; summary: string; stack: string }[]
  /** Sequência de stories (9:16): cada slide é uma tela, sem link nem legenda (a pauta da semana). */
  story?: boolean
  /** Libera os modelos com foto gerada (viral-capa, viral-foto), com a cena em `prompt`. */
  photos?: boolean
}

export interface PlanResponse {
  posts: PostPlan[]
}

/** Formato do plano para o Codex, que não tem esquema JSON: o mesmo que `PLAN_SCHEMA` pede ao Claude. */
export const PLAN_FORMAT_NOTE = [
  'Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois e sem ```, neste formato:',
  '{"posts": [ {"name": string, "format": "4x5"|"1x1"|"9x16", "caption": string, "slides": [ {"template": string, "label"?: string, "title"?: string, "body"?: string, "items"?: string[], "cta"?: string, "case"?: string, "view"?: "capa"|"pagina"|"celular", "illustration"?: string, "focus"?: number, "dark"?: boolean, "prompt"?: string, "number"?: string} ] } ]}',
].join('\n')

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts'],
  properties: {
    posts: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'caption', 'slides'],
        properties: {
          name: { type: 'string' },
          caption: { type: 'string' },
          slides: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
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
            },
          },
        },
      },
    },
  },
} as const
