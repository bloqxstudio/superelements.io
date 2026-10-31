/**
 * Copy: documentos de texto da empresa (como um Google Docs próprio) para
 * criar e revisar o que a equipe publica: posts, landing pages, sites,
 * campanhas, stories, e-mails e pesquisas. Cada documento é uma lista de
 * blocos; os agentes (Claude Code, Codex) escrevem e revisam neles, as pessoas
 * editam e comentam ao vivo, e o texto segue para um post de Criativos ou uma
 * página de Projetos. Sem imports: o servidor (conector) lê este arquivo.
 */

export type FormatId =
  | 'post-instagram'
  | 'carrossel'
  | 'story'
  | 'reels'
  | 'linkedin'
  | 'lp'
  | 'site'
  | 'anuncio'
  | 'campanha'
  | 'email'
  | 'whatsapp'
  | 'artigo'
  | 'pesquisa'
  | 'tendencias'
  | 'oportunidades'
  | 'livre'

export type BlockType = 'h1' | 'h2' | 'h3' | 'p' | 'bullet' | 'number' | 'quote' | 'hook' | 'cta' | 'note' | 'divider'

export interface Block {
  id: string
  type: BlockType
  /** Texto com formatação mínima (negrito, itálico, link), já limpo. */
  html: string
  /** Rótulo da peça: "Slide 3", "Hero", "Cena 2", "Dor 1". Aparece ao lado do bloco. */
  label?: string
}

export interface Brief {
  objective: string
  audience: string
  tone: string
  offer: string
  channel: string
  notes: string
}

export interface Person {
  id: string
  name: string
  color: string
}

export interface CopyComment {
  id: string
  blockId: string
  /** O trecho comentado. */
  quote?: string
  author: Person
  text: string
  at: number
  resolved?: boolean
  replies: { id: string; author: Person; text: string; at: number }[]
}

export interface Source {
  title: string
  url: string
}

export interface CopyDoc {
  id: string
  title: string
  format: FormatId
  /** Id do nicho (`niches` do conhecimento) ou texto livre. */
  niche?: string
  projectId?: string
  projectName?: string
  /** Guardado na pasta do projeto: a equipe dele abre e edita junto, ao vivo. */
  shared?: boolean
  /** Pasta (o assunto): a pesquisa, a copy da LP e os conteúdos do mesmo assunto ficam juntos e se leem. */
  folderId?: string
  folderName?: string
  brief: Brief
  /** O conteúdo do Plano de onde este documento nasceu (Conteúdos): o botão "Voltar ao conteúdo" usa. */
  source?: { contentId: string; contextVersion?: number }
  blocks: Block[]
  comments: CopyComment[]
  /** Fontes que uma pesquisa leu. */
  sources?: Source[]
  createdAt: number
  updatedAt: number
}

export interface CopySummary {
  id: string
  title: string
  format: FormatId
  niche?: string
  projectId?: string
  projectName?: string
  shared?: boolean
  folderId?: string
  folderName?: string
  words: number
  updatedAt: number
}

export const EMPTY_BRIEF: Brief = { objective: '', audience: '', tone: '', offer: '', channel: '', notes: '' }

export const uid = () => Math.random().toString(36).slice(2, 10)

export const block = (type: BlockType, html = '', label?: string): Block => ({ id: uid(), type, html, ...(label ? { label } : {}) })

/** O texto de um bloco sem as marcas de formatação. */
export const plainOf = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

export const wordsOf = (doc: Pick<CopyDoc, 'blocks'>) => doc.blocks.reduce((n, b) => n + (plainOf(b.html).trim().split(/\s+/).filter(Boolean).length || 0), 0)
