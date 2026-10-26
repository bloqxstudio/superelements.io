/**
 * A pauta de stories que a Estrategista escreve (`story-plan`): para cada
 * horário da semana, uma sequência com gancho, ângulo, telas e chamada. Sem
 * imports de `@/`: o servidor de desenvolvimento e o conector (Node) leem este
 * arquivo também.
 */

/** Um horário livre da semana: `ref` volta na resposta para casar a ideia com o horário. */
export interface StorySlot {
  ref: string
  /** "segunda, 27/10, 10:00" */
  when: string
}

export interface StoryPillar {
  id: string
  label: string
  hint: string
}

export interface StoryFrameIdea {
  /** O que a tela diz (curto: lê-se em 3 segundos). */
  text: string
  /** O que a tela mostra: dado grande, lista, case, ilustração, foto (cena), frase. */
  visual: string
}

export interface StoryIdea {
  ref: string
  pillar: string
  /** Nome curto, para a lista interna. */
  title: string
  hook: string
  angle: string
  objective: string
  frames: StoryFrameIdea[]
  /** O convite da última tela (responder o story, chamar no Direct). */
  cta: string
  /** `slug` do case, quando a sequência mostra um. */
  case?: string
  /** Por que esta ideia, nesta semana (os números, a pesquisa, o recado). */
  why: string
}

export interface StoryPlanRequest {
  engine?: 'claude' | 'codex'
  persona?: string
  web?: boolean
  slots: StorySlot[]
  framesMax: number
  pillars: StoryPillar[]
  /** O recado do mês. */
  brief: string
  /** Fotos geradas liberadas (cenas de foto nas telas). */
  photos: boolean
  cases: { slug: string; name: string; segment: string; place?: string; summary: string }[]
  /** Stories publicados nas últimas semanas, com os números. */
  history: { when: string; pillar: string; title: string; hook: string; frames: number; numbers?: string }[]
  /** O que já está na pauta desta semana e da próxima (não repetir). */
  planned: { when: string; pillar: string; title: string }[]
  /** Trecho da pesquisa de tendências mais recente da Copy. */
  research?: string
}

export interface StoryPlanResponse {
  stories: StoryIdea[]
}

/** O Codex não tem esquema JSON: o mesmo formato, por escrito. */
export const STORY_PLAN_FORMAT_NOTE = [
  'Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois e sem ```, neste formato:',
  '{"stories": [ {"ref": string, "pillar": string, "title": string, "hook": string, "angle": string, "objective": string, "frames": [ {"text": string, "visual": string} ], "cta": string, "case"?: string, "why": string} ]}',
].join('\n')

export const STORY_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      minItems: 1,
      maxItems: 21,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'pillar', 'title', 'hook', 'angle', 'objective', 'frames', 'cta', 'why'],
        properties: {
          ref: { type: 'string' },
          pillar: { type: 'string' },
          title: { type: 'string' },
          hook: { type: 'string' },
          angle: { type: 'string' },
          objective: { type: 'string' },
          frames: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'visual'],
              properties: { text: { type: 'string' }, visual: { type: 'string' } },
            },
          },
          cta: { type: 'string' },
          case: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
  },
} as const
