/**
 * Regras do Plano e dos Conteúdos (Superelements v2, migração 20261031041728).
 * Sem imports: o Node (scripts/tests) lê este arquivo e as telas também. O servidor é quem decide
 * (funções `crm_context_save`, `crm_content_*`); aqui ficam o espelho das transições, o briefing
 * montado a partir do contexto, a conferência do material ligado e os pendentes do Início.
 */

export type ContentStatus = 'ideia' | 'producao' | 'revisao' | 'aprovado'
export type TeamRoleLike = 'owner' | 'admin' | 'seller' | undefined

export const STATUS_ORDER: ContentStatus[] = ['ideia', 'producao', 'revisao', 'aprovado']

export const STATUS_LABEL: Record<ContentStatus, string> = {
  ideia: 'Ideia',
  producao: 'Em produção',
  revisao: 'Em revisão',
  aprovado: 'Aprovado',
}

/** Os mesmos formatos que o banco aceita (`crm_contents.format`), com o id do Copy. */
export const CONTENT_FORMATS = [
  { id: 'post-instagram', label: 'Post de Instagram' },
  { id: 'carrossel', label: 'Carrossel' },
  { id: 'story', label: 'Stories' },
  { id: 'reels', label: 'Reels (roteiro)' },
  { id: 'linkedin', label: 'Post de LinkedIn' },
  { id: 'lp', label: 'Página de captura' },
  { id: 'anuncio', label: 'Anúncio' },
  { id: 'email', label: 'E-mail' },
  { id: 'whatsapp', label: 'Mensagem de WhatsApp' },
  { id: 'artigo', label: 'Artigo' },
  { id: 'livre', label: 'Livre' },
] as const

export type ContentFormat = (typeof CONTENT_FORMATS)[number]['id']

export const formatLabel = (id: string) => CONTENT_FORMATS.find((f) => f.id === id)?.label ?? id

export interface AccountContext {
  teamId: string
  offer: string
  audience: string
  tone: string
  goal: string
  restrictions: string
  pillars: string[]
  version: number
  updatedBy?: string
  updatedAt: number
}

export const CONTEXT_FIELDS = ['offer', 'audience', 'tone', 'goal', 'restrictions'] as const
export type ContextField = (typeof CONTEXT_FIELDS)[number]

export const CONTEXT_LIMITS: Record<ContextField | 'pillar' | 'pillars', number> = { offer: 2000, audience: 2000, tone: 1000, goal: 1000, restrictions: 2000, pillar: 60, pillars: 8 }

/** O que o Plano precisa ter para o briefing valer: oferta e público (o resto melhora, não bloqueia). */
export function missingContext(ctx: Pick<AccountContext, 'offer' | 'audience'> | null | undefined): string[] {
  const out: string[] = []
  if (!ctx?.offer.trim()) out.push('oferta')
  if (!ctx?.audience.trim()) out.push('público')
  return out
}

export interface Content {
  id: string
  teamId: string
  title: string
  idea: string
  goal: string
  format: ContentFormat
  script: string
  editorialDate?: string
  status: ContentStatus
  version: number
  contentHash: string
  approvedVersion?: number
  approvedHash?: string
  approvedBy?: string
  approvedAt?: number
  createdBy?: string
  createdAt: number
  updatedAt: number
}

export interface ContentLink {
  id: string
  contentId: string
  kind: 'copy' | 'criativos'
  artifactId: string
  projectId?: string
  linkedHash: string
  createdBy?: string
}

// ---------- transições (espelho do servidor) ----------

const TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  ideia: ['producao'],
  producao: ['ideia', 'revisao'],
  revisao: ['producao', 'aprovado'],
  aprovado: ['producao'],
}

export const canManage = (role: TeamRoleLike) => role === 'owner' || role === 'admin'

export interface TransitionCheck {
  ok: boolean
  reason?: string
}

export function checkTransition(content: Pick<Content, 'status' | 'script'>, to: ContentStatus, role: TeamRoleLike): TransitionCheck {
  if (!TRANSITIONS[content.status].includes(to)) return { ok: false, reason: 'Este caminho não existe: o conteúdo segue de ideia a produção, revisão e aprovação.' }
  if (to === 'aprovado' && !canManage(role)) return { ok: false, reason: 'Só dono e gestor da conta aprovam.' }
  if (to === 'revisao' && !content.script.trim()) return { ok: false, reason: 'Escreva o roteiro antes de enviar para revisão.' }
  return { ok: true }
}

/** O que cada botão de estado faz, para o detalhe do conteúdo. */
export const TRANSITION_ACTIONS: Record<ContentStatus, { to: ContentStatus; label: string; tone: 'primary' | 'plain' }[]> = {
  ideia: [{ to: 'producao', label: 'Começar a produzir', tone: 'primary' }],
  producao: [
    { to: 'revisao', label: 'Enviar para revisão', tone: 'primary' },
    { to: 'ideia', label: 'Voltar para ideia', tone: 'plain' },
  ],
  revisao: [
    { to: 'aprovado', label: 'Aprovar este texto', tone: 'primary' },
    { to: 'producao', label: 'Pedir ajustes', tone: 'plain' },
  ],
  aprovado: [{ to: 'producao', label: 'Reabrir para editar', tone: 'plain' }],
}

/** A aprovação vale agora? O banco já garante isso por restrição; aqui a tela confere o mesmo. */
export const approvalIsCurrent = (c: Pick<Content, 'status' | 'approvedHash' | 'contentHash'>) => c.status === 'aprovado' && !!c.approvedHash && c.approvedHash === c.contentHash

// ---------- briefing a partir do contexto ----------

export interface Brief {
  objective: string
  audience: string
  tone: string
  offer: string
  channel: string
  notes: string
}

/**
 * O briefing do Copy a partir do Plano da conta e do conteúdo. O objetivo do conteúdo vale mais
 * que o da conta; sem Plano, só o que o conteúdo diz (nada é inventado).
 */
export function briefOf(ctx: AccountContext | null | undefined, content: Pick<Content, 'goal' | 'idea' | 'format'>): Brief {
  const notes: string[] = []
  if (content.idea.trim()) notes.push(`Ideia: ${content.idea.trim()}`)
  if (ctx?.pillars.length) notes.push(`Pilares da empresa: ${ctx.pillars.join(', ')}`)
  if (ctx?.restrictions.trim()) notes.push(`Restrições (não fazer): ${ctx.restrictions.trim()}`)
  return {
    objective: content.goal.trim() || ctx?.goal.trim() || '',
    audience: ctx?.audience.trim() ?? '',
    tone: ctx?.tone.trim() ?? '',
    offer: ctx?.offer.trim() ?? '',
    channel: formatLabel(content.format),
    notes: notes.join('\n'),
  }
}

/** O mesmo briefing em texto corrido, para quem não tem os campos do Copy (Criativos). */
export const briefText = (b: Brief) =>
  [b.objective && `Objetivo: ${b.objective}`, b.audience && `Público: ${b.audience}`, b.offer && `Oferta: ${b.offer}`, b.tone && `Tom: ${b.tone}`, b.channel && `Formato: ${b.channel}`, b.notes].filter(Boolean).join('\n')

// ---------- texto do roteiro ↔ blocos do Copy ----------

/** Parágrafos do roteiro: separados por linha em branco; quebras simples ficam dentro do parágrafo. */
export const scriptParagraphs = (script: string): string[] =>
  script
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

export const joinParagraphs = (texts: string[]): string =>
  texts
    .map((t) => t.replace(/\r\n?/g, '\n').trim())
    .filter(Boolean)
    .join('\n\n')

const normalizeScript = (s: string) => joinParagraphs(scriptParagraphs(s)).replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ')

/** O roteiro do conteúdo e o texto do Copy dizem a mesma coisa? (ignora espaços e linhas em branco extras) */
export const sameScript = (a: string, b: string) => normalizeScript(a) === normalizeScript(b)

// ---------- material ligado ----------

export type LinkState = 'igual' | 'diferente' | 'indisponivel'

export interface LinkCheck {
  state: LinkState
  /** Frase para a tela. */
  note: string
  /** Impede aprovar o texto? Só o Copy impede: o roteiro dele precisa ser o aprovado. */
  blocksApproval: boolean
}

/**
 * Copy: compara o texto do documento com o roteiro do conteúdo (comparação real, não só hash).
 * Criativos: o desenho muda de propósito depois do vínculo; a aprovação não o cobre, então ele
 * nunca bloqueia, mas a tela avisa se mudou desde o vínculo (hash informado pelo navegador).
 */
export function checkLink(kind: 'copy' | 'criativos', args: { script: string; docScript?: string; linkedHash?: string; currentHash?: string; available: boolean }): LinkCheck {
  if (!args.available) {
    return { state: 'indisponivel', note: 'Não consegui abrir este material (guardado na pasta de quem criou, ou apagado). A aprovação do texto não depende dele.', blocksApproval: false }
  }
  if (kind === 'copy') {
    const same = sameScript(args.script, args.docScript ?? '')
    return same
      ? { state: 'igual', note: 'O texto do Copy é o mesmo do roteiro.', blocksApproval: false }
      : { state: 'diferente', note: 'O texto do documento do Copy é diferente do roteiro deste conteúdo. Traga o texto do Copy ou envie o roteiro antes de aprovar.', blocksApproval: true }
  }
  const changed = !!args.linkedHash && !!args.currentHash && args.linkedHash !== args.currentHash
  return changed
    ? { state: 'diferente', note: 'O design foi editado depois do vínculo. A aprovação cobre só o texto, não os criativos.', blocksApproval: false }
    : { state: 'igual', note: 'O design não mudou desde o vínculo. A aprovação cobre só o texto, não os criativos.', blocksApproval: false }
}

export function canApprove(content: Pick<Content, 'status' | 'script'>, role: TeamRoleLike, checks: LinkCheck[], dirty: boolean): TransitionCheck {
  const t = checkTransition(content, 'aprovado', role)
  if (!t.ok) return t
  if (dirty) return { ok: false, reason: 'Salve as mudanças antes de aprovar: a aprovação vale para a versão salva.' }
  const blocked = checks.find((c) => c.blocksApproval)
  return blocked ? { ok: false, reason: blocked.note } : { ok: true }
}

/** Hash estável (SHA-256 em hexadecimal) de qualquer valor JSON, com as chaves em ordem. */
export async function hashOf(value: unknown): Promise<string> {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, stable(x)]))
    return v
  }
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------- resposta das funções ----------

/**
 * As funções do servidor devolvem uma linha de tabela. O PostgREST responde com um objeto ou, em
 * algumas versões e funções, com uma lista de uma linha. Aceita os dois, exige que a linha tenha os
 * campos esperados e recusa o resto (lista vazia ou com várias linhas, texto, vazio) em vez de
 * montar um registro com campos `undefined`.
 */
export function unwrapRow<T extends Record<string, unknown>>(data: unknown, required: string[]): T {
  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : undefined) : data
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Resposta inesperada do servidor. Recarregue a tela e confira se a mudança foi salva.')
  const missing = required.filter((k) => (row as Record<string, unknown>)[k] === undefined || (row as Record<string, unknown>)[k] === null)
  if (missing.length) throw new Error(`Resposta incompleta do servidor (${missing.join(', ')}). Recarregue a tela.`)
  return row as T
}

// ---------- erros do servidor ----------

export type ServerError = 'conflito' | 'sem-acesso' | 'modulo' | 'so-gestor' | 'transicao' | 'roteiro-vazio' | 'aprovado' | 'ja-vinculado' | 'projeto' | 'invalido' | 'desconhecido'

export function classifyError(message: string | undefined): ServerError {
  const m = message ?? ''
  if (m.includes('conflito_de_versao')) return 'conflito'
  if (m.includes('modulo_desligado')) return 'modulo'
  if (m.includes('so_gestor')) return 'so-gestor'
  if (m.includes('sem_acesso') || m.includes('nao_autenticado')) return 'sem-acesso'
  if (m.includes('transicao_invalida')) return 'transicao'
  if (m.includes('roteiro_vazio')) return 'roteiro-vazio'
  if (m.includes('conteudo_aprovado')) return 'aprovado'
  if (m.includes('ja_vinculado')) return 'ja-vinculado'
  if (m.includes('projeto_de_outra_conta')) return 'projeto'
  if (m.includes('campo_invalido') || m.includes('campo_longo')) return 'invalido'
  return 'desconhecido'
}

export const ERROR_TEXT: Record<ServerError, string> = {
  conflito: 'Outra pessoa alterou isto enquanto você editava. Recarregue para ver a versão atual.',
  'sem-acesso': 'Você não tem acesso a esta conta.',
  modulo: 'O módulo Copy está desligado nesta conta.',
  'so-gestor': 'Só dono e gestor da conta podem fazer isto.',
  transicao: 'Esse caminho não é permitido para o estado atual do conteúdo.',
  'roteiro-vazio': 'Escreva o roteiro antes de enviar para revisão.',
  aprovado: 'Um conteúdo aprovado não se apaga: reabra-o primeiro.',
  'ja-vinculado': 'Este conteúdo já tem outro material ligado desse tipo. Desligue o atual antes de trocar.',
  projeto: 'Esse projeto não é desta conta.',
  invalido: 'Algum campo está vazio ou longo demais.',
  desconhecido: 'Não consegui concluir. Tente de novo.',
}

// ---------- pendências do Início ----------

export interface PendingAction {
  id: string
  title: string
  reason: string
  to: string
  action: string
  /** Menor aparece primeiro. */
  weight: number
}

/**
 * O dia (AAAA-MM-DD) de um instante no fuso da operação, America/Sao_Paulo. A data editorial é
 * um dia do calendário de quem planeja: às 22h em São Paulo já é "amanhã" em UTC, e comparar em
 * UTC marcaria o dia de hoje como vencido. Toda comparação de data editorial passa por aqui.
 */
export const EDITORIAL_TZ = 'America/Sao_Paulo'
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: EDITORIAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
export const editorialDay = (at: number): string => DAY_FORMAT.format(new Date(at))

/** A data editorial já passou? (só o dia de hoje em São Paulo ainda não passou) */
export const editorialLate = (c: { editorialDate?: string; status: ContentStatus }, now: number): boolean => !!c.editorialDate && c.editorialDate < editorialDay(now) && c.status !== 'aprovado'

export function pendingActions(args: {
  role: TeamRoleLike
  context: AccountContext | null | undefined
  contents: Pick<Content, 'id' | 'title' | 'status' | 'editorialDate'>[]
  now: number
}): PendingAction[] {
  const { role, context, contents, now } = args
  const manager = canManage(role)
  const out: PendingAction[] = []

  const missing = missingContext(context)
  if (!context) {
    out.push(
      manager
        ? { id: 'plano-vazio', title: 'Defina o plano da empresa', reason: 'Sem oferta, público e tom, cada conteúdo e cada agente começa do zero.', to: '/plano', action: 'Preencher o plano', weight: 0 }
        : { id: 'plano-vazio', title: 'O plano da empresa ainda não foi definido', reason: 'Peça a um gestor da conta para preencher oferta e público.', to: '/plano', action: 'Ver o plano', weight: 3 }
    )
  } else if (missing.length) {
    out.push({ id: 'plano-incompleto', title: `O plano está sem ${missing.join(' e ')}`, reason: 'O briefing dos conteúdos sai desses campos.', to: '/plano', action: manager ? 'Completar o plano' : 'Ver o plano', weight: manager ? 1 : 3 })
  }

  const review = contents.filter((c) => c.status === 'revisao')
  if (review.length) {
    const one = review.length === 1 ? review[0] : undefined
    out.push({
      id: 'aprovar',
      title: manager ? (one ? `Aprovar: ${one.title}` : `${review.length} conteúdos aguardam sua aprovação`) : one ? `Em revisão: ${one.title}` : `${review.length} conteúdos em revisão`,
      reason: manager ? 'A aprovação vale para o texto na versão enviada; qualquer edição depois a derruba.' : 'Esperando um gestor da conta aprovar.',
      to: one ? `/conteudos/${one.id}` : '/conteudos?estado=revisao',
      action: manager ? 'Revisar e aprovar' : 'Ver em revisão',
      weight: manager ? 1 : 3,
    })
  }

  const late = contents.filter((c) => editorialLate(c, now))
  if (late.length) {
    const one = late.length === 1 ? late[0] : undefined
    out.push({
      id: 'data-vencida',
      title: one ? `Data editorial vencida: ${one.title}` : `${late.length} conteúdos passaram da data editorial sem aprovação`,
      reason: 'A data prevista passou e o texto ainda não foi aprovado.',
      to: one ? `/conteudos/${one.id}` : '/conteudos?estado=atrasado',
      action: 'Abrir conteúdo',
      weight: 2,
    })
  }

  const ideas = contents.filter((c) => c.status === 'ideia')
  if (!contents.length && context && !missing.length) {
    out.push({ id: 'sem-conteudo', title: 'Nenhum conteúdo planejado', reason: 'O plano está pronto: comece pela primeira ideia.', to: '/conteudos?novo=1', action: 'Criar conteúdo', weight: 4 })
  } else if (ideas.length) {
    out.push({ id: 'ideias', title: `${ideas.length} ${ideas.length === 1 ? 'ideia espera' : 'ideias esperam'} produção`, reason: 'Encaminhe para o Copy ou os Criativos quando for a vez.', to: '/conteudos?estado=ideia', action: 'Ver ideias', weight: 5 })
  }

  return out.sort((a, b) => a.weight - b.weight)
}

/** Validação do formulário antes de falar com o servidor (o servidor valida de novo). */
export function validateContentDraft(d: { title: string; idea: string; goal: string; script: string }): string | undefined {
  if (!d.title.trim()) return 'Dê um título ao conteúdo.'
  if (d.title.length > 160) return 'O título passa de 160 caracteres.'
  if (d.idea.length > 4000) return 'A ideia passa de 4000 caracteres.'
  if (d.goal.length > 600) return 'O objetivo passa de 600 caracteres.'
  if (d.script.length > 20000) return 'O roteiro passa de 20000 caracteres.'
  return undefined
}

export function validateContextDraft(d: Record<ContextField, string> & { pillars: string[] }): string | undefined {
  for (const f of CONTEXT_FIELDS) if (d[f].length > CONTEXT_LIMITS[f]) return `O campo ${f} passa de ${CONTEXT_LIMITS[f]} caracteres.`
  if (d.pillars.filter((p) => p.trim()).length > CONTEXT_LIMITS.pillars) return `Use até ${CONTEXT_LIMITS.pillars} pilares.`
  if (d.pillars.some((p) => p.trim().length > CONTEXT_LIMITS.pillar)) return `Cada pilar tem até ${CONTEXT_LIMITS.pillar} caracteres.`
  return undefined
}
