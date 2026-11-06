/**
 * Sites em código (Astro) entre a aba e esta máquina (servidor de dev ou conector).
 * Só tipos e constantes, sem imports: o Node lê este arquivo.
 *
 * A aba manda `sites:chamar` com um id e recebe `sites:resposta` com o mesmo id.
 * O servidor avisa sozinho a mudança da lista e de cada prévia (`sites:estado`)
 * e manda as linhas do terminal da prévia (`sites:log`).
 */

export const SITE_EVENTS = {
  hello: 'sites:oi',
  state: 'sites:estado',
  call: 'sites:chamar',
  result: 'sites:resposta',
  log: 'sites:log',
} as const

export type SiteCallKind =
  | 'list'
  | 'repos'
  | 'connect'
  | 'remove'
  | 'update'
  | 'start'
  | 'stop'
  | 'pages'
  | 'inspect'
  | 'text'
  | 'attr'
  | 'find'
  | 'replace'
  | 'image'
  | 'status'
  | 'diff'
  | 'publish'
  | 'pull'
  | 'discard'

export interface SiteCall {
  id: string
  kind: SiteCallKind
  request?: unknown
}

export type SiteResult = { id: string; ok: true; data: unknown } | { id: string; ok: false; error: string }

/** Um site em código ligado a esta máquina. */
export interface CodeSite {
  id: string
  name: string
  /** A conta do produto dona do site (filtra a lista pela conta aberta). */
  accountId?: string
  /** Pasta do repositório nesta máquina. */
  dir: string
  /** `dono/nome` no GitHub, quando veio de lá. */
  repo?: string
  /** O endereço no ar, para o link "Ver no ar". */
  url?: string
  framework: 'astro'
  addedAt: string
}

export type PreviewState = 'parada' | 'instalando' | 'iniciando' | 'rodando' | 'erro'

export interface SitePreview {
  siteId: string
  state: PreviewState
  url?: string
  error?: string
}

export interface SitesState {
  sites: CodeSite[]
  previews: SitePreview[]
  /** O `gh` desta máquina está logado (para listar e clonar do GitHub). */
  github: { ok: boolean; user?: string }
}

export interface GithubRepo {
  nameWithOwner: string
  description: string
  isPrivate: boolean
  updatedAt: string
  url: string
}

/** Uma página do site (arquivo em `src/pages`) e o endereço dela. */
export interface SitePage {
  file: string
  route: string
}

/** O elemento escolhido na prévia, como a prévia o vê. */
export interface PickedElement {
  file: string
  loc: string
  tag: string
  /** Os textos visíveis do elemento, na ordem (sem os de outros componentes). */
  segments: string[]
  attrs: Record<string, string>
  /** Os componentes em volta, do mais perto ao mais longe (arquivos). */
  chain: string[]
}

/** O que o código diz do elemento escolhido. */
export interface ElementInfo {
  /** Caminho relativo à pasta do site. */
  file: string
  tag: string
  /** `texto`: dá para editar os textos ali mesmo; `dinamico`: vem de dados ({...}); `sem-texto`. */
  kind: 'texto' | 'dinamico' | 'sem-texto'
  /** Os textos do código, na mesma ordem dos da prévia (só quando `kind` é texto). */
  segments: string[]
  /** As expressões que geram texto ({titulo}, {item.nome}). */
  expressions: string[]
  /** Atributos escritos à mão (editáveis) e os que vêm de expressão. */
  attrs: Array<{ name: string; value: string; editable: boolean }>
  /** A linha de abertura do elemento no código. */
  snippet: string
  line: number
  /** O mesmo trecho do código aparece repetido na página (dentro de um `.map`). */
  repeated: boolean
}

export interface TextHit {
  file: string
  line: number
  snippet: string
}

export interface ChangedFile {
  file: string
  status: string
}

export interface SiteStatus {
  branch: string
  defaultBranch: string
  changes: ChangedFile[]
  ahead: number
  behind: number
  remote: boolean
  lastCommit?: { hash: string; message: string; at: string }
}

export type PublishMode = 'direto' | 'revisao'

export interface PublishResult {
  mode: PublishMode
  branch: string
  commit: string
  /** O endereço do PR, no modo revisão. */
  pr?: string
  /** Subiu, mas algo ficou por fazer à mão (o PR não abriu). */
  warning?: string
}
