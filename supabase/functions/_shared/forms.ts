/**
 * Formulários e quizzes (CRM › Formulários): o contrato que o construtor (app), a função pública
 * `form-submit` e o script `public/forms.js` entendem. Sem imports e só sintaxe apagável: roda no
 * app (Vite), na função (Deno) e nos testes (Node). O `forms.js` repete a lógica de visibilidade
 * e pontuação em JavaScript puro, porque é servido sem build; a função refaz tudo no servidor,
 * então o que o navegador calcula nunca é confiado.
 */

export type FieldType = 'short' | 'long' | 'email' | 'phone' | 'number' | 'choice' | 'multi' | 'select' | 'yesno' | 'rating' | 'product'

/**
 * Localizador de produto (2026-11-07, sugestões da Vizor: "focado em qual a moto, perguntando marca, modelo… abrir
 * um card estilo ecommerce mostrando o produto e levar para o WhatsApp" e "um seletor por imagem… olhando os
 * logos, e depois um drop com modelo e ano"). O catálogo vai dentro do campo (cópia do catálogo da conta): a
 * marca é escolhida por cartões com logo, o modelo e o ano por listas que dependem da escolha anterior, e só
 * aparece o que existe no catálogo. A resposta é o id do item. O fim mostra o produto e o botão do WhatsApp.
 */
export interface CatalogItem {
  id: string
  brand: string
  model: string
  year?: string
  /** Nome do produto (sem ele, o card mostra o modelo) */
  name?: string
  image?: string
  url?: string
  /** Variações com código (ex.: Brilho VZB0001, Fosco VZF0001) */
  codes?: { label: string; code: string }[]
}
export interface CatalogBrand { name: string; logo?: string }
export interface ProductCatalog {
  items: CatalogItem[]
  brands: CatalogBrand[]
  /** Número do WhatsApp comercial (só dígitos, com DDI) */
  whatsapp?: string
  /** Mensagem com {produto}, {marca}, {modelo}, {ano}, {codigos}, {link}, {ref} */
  message?: string
  buttonLabel?: string
  modelLabel?: string
  yearLabel?: string
  resultTitle?: string
  noMatchLabel?: string
  noMatchTitle?: string
  noMatchText?: string
  noMatchMessage?: string
  /** Segundos até abrir o WhatsApp sozinho na tela do produto (0 desliga; sem valor, 12) */
  redirectSeconds?: number
  /** Como o tempo aparece: o botão escurecendo (`fill`, o padrão) ou uma barra fina abaixo dele (`bar`) */
  redirectStyle?: 'fill' | 'bar'
}

/** O dado do CRM que o campo preenche (nome, e-mail, telefone ou a mensagem do lead). */
export type FieldMap = 'name' | 'email' | 'phone' | 'message'

export interface FieldOption {
  id: string
  label: string
  /** Pontos que a opção soma no quiz (positivos ou negativos) */
  score?: number
}

export interface FieldCondition {
  /** O campo cuja resposta decide se este aparece */
  field: string
  op: 'eq' | 'neq'
  /** O id da opção (campos de escolha) ou o texto */
  value: string
}

export interface FormField {
  id: string
  type: FieldType
  label: string
  help?: string
  placeholder?: string
  required?: boolean
  options?: FieldOption[]
  map?: FieldMap
  showIf?: FieldCondition
  /** `half` põe o campo ao lado de outro `half` (duas colunas; uma só em telas estreitas) */
  width?: 'half'
  /** Só no `product` */
  catalog?: ProductCatalog
}

export interface FormStep {
  id: string
  title?: string
  description?: string
  /** Observação em fonte leve e cinza, entre a pergunta e as opções (ligada no editor; vazia não aparece) */
  note?: string
  fields: FormField[]
}

export interface QuizResult {
  id: string
  /** Pontuação mínima (inclusive) para cair neste resultado */
  min: number
  title: string
  text?: string
  ctaLabel?: string
  ctaUrl?: string
  /** Lead dessa faixa conta como qualificado (conversão `lead_qualificado`) */
  qualified?: boolean
}

export type FormFont = 'inherit' | 'Inter' | 'Inter Tight' | 'Lato' | 'Barlow' | 'system'

export const FONTS: { id: FormFont; label: string }[] = [
  { id: 'inherit', label: 'A do site' },
  { id: 'Inter Tight', label: 'Inter Tight (Avence)' },
  { id: 'Lato', label: 'Lato' },
  { id: 'Inter', label: 'Inter' },
  { id: 'Barlow', label: 'Barlow (Vizor)' },
  { id: 'system', label: 'Do sistema' },
]

/**
 * Ícones de traço (Lucide) da tela de início e da agenda. O desenho de cada um vive no `forms.js`
 * (servido sem build); o editor mostra os mesmos pelo `lucide-react`.
 */
export const ICONS = [
  'rocket', 'target', 'trending-up', 'chart-line', 'chart-column', 'circle-check', 'badge-check', 'trophy', 'award', 'star',
  'sparkles', 'zap', 'gem', 'lightbulb', 'palette', 'megaphone', 'dollar-sign', 'users', 'handshake', 'briefcase',
  'store', 'shield-check', 'heart', 'message-circle', 'phone', 'instagram', 'map-pin', 'calendar', 'calendar-days', 'clock',
] as const
export type IconName = (typeof ICONS)[number]
const isIcon = (v: unknown): v is IconName => typeof v === 'string' && (ICONS as readonly string[]).includes(v)

/** Tela de início (capa): headline, bullets e o botão que começa o formulário. */
export interface FormWelcome {
  enabled: boolean
  /** Logo (PNG/WebP) acima da headline */
  logoUrl?: string
  /** Ícone no começo da headline */
  icon?: IconName
  /** `**assim**` deixa um trecho em negrito */
  title: string
  bullets: { id: string; icon?: IconName; text: string }[]
  /** Rodapé da capa: sempre em itálico, começando com a seta → (a seta é desenhada, não digitada) */
  footnote?: string
  buttonLabel: string
  /**
   * Onde o conteúdo fica na altura da tela: topo, centro, base, ou distribuído (logo no topo, texto no
   * meio, botão embaixo). Vale quando a capa ocupa a tela (link direto `/f/` e a prévia de celular).
   */
  valign?: WelcomeVAlign
  /** Posição só do logo; o texto segue à esquerda */
  logoAlign?: 'left' | 'center' | 'right'
  /** Altura do logo em px (12 a 64); sem o campo, 32 */
  logoSize?: number
}

/**
 * Capa pequena no topo das perguntas, como num checkout de evento: uma faixa com logo, uma linha
 * pequena, o título (`**assim**` em destaque) e uma foto à direita. Não é uma tela a mais (essa é a
 * `welcome`); acompanha as perguntas e some na tela final.
 */
export interface FormCover {
  enabled: boolean
  logoUrl?: string
  /** Foto à direita (PNG/WebP sem fundo fica melhor) */
  image?: string
  /** Linha pequena acima do título */
  eyebrow?: string
  title: string
  /** Uma linha curta abaixo do título */
  text?: string
  /** Palavra grande e apagada ao fundo */
  watermark?: string
  /** Cor do fundo da faixa e a do trecho em destaque */
  background?: string
  accent?: string
  /** Título condensado, em maiúsculas e itálico (Barlow Condensed), estilo de post */
  display?: boolean
}

export const COVER_DEFAULT: FormCover = { enabled: true, title: 'Seu título com **destaque**', background: '#0b0f14', accent: '#5b9bff' }

export type WelcomeVAlign = 'top' | 'center' | 'bottom' | 'justify'

/** Limites de escrita da capa (o editor avisa; o servidor só corta no máximo técnico). */
export const WELCOME_LIMITS = { titleWords: 10, bulletChars: 35, bullets: 5 }

/** Um intervalo de atendimento num dia da semana, em HH:MM (horário de Brasília). */
export interface BookingRange {
  start: string
  end: string
}

/** Quem vê a agenda depois de responder. */
export type BookingGate =
  | { mode: 'all' }
  | { mode: 'qualified' }
  /** Só quem marcou uma destas opções no campo (ex.: faturamento acima de R$ 30 mil) */
  | { mode: 'answer'; field: string; values: string[] }

/**
 * Um turno da agenda por prioridade: os horários possíveis e a ordem em que são oferecidos. O lead
 * vê só os `show` primeiros livres; os outros só aparecem quando a agenda vai lotando.
 */
export interface BookingShift {
  id: string
  label: string
  /** HH:MM de Brasília */
  times: string[]
  /** `late`: oferece primeiro os mais tarde (manhã); `early`: os mais cedo (tarde) */
  order: 'late' | 'early'
  show: number
}

export interface FormBooking {
  enabled: boolean
  /**
   * `priority` (padrão desde 2026-11-04): turnos com ordem de prioridade e N horários por turno.
   * `range`: todos os horários dos intervalos de cada dia da semana (`week`).
   */
  mode?: 'priority' | 'range'
  shifts?: BookingShift[]
  /** Dias da semana com atendimento no modo por prioridade (domingo = 0) */
  workdays?: number[]
  /** Nome da reunião no cartão da agenda */
  meetingName: string
  title: string
  durationMin: number
  /** Quantos dias com horário aparecem (os próximos, pulando dias sem atendimento) */
  days: number
  /** Antecedência mínima, em horas */
  noticeHours: number
  /** Domingo = "0" … sábado = "6" */
  week: Record<string, BookingRange[]>
  gate: BookingGate
  confirmLabel: string
  successTitle: string
  successText: string
}

/** Evento do envio: o personalizado (`<prefixo>Submit`) ou um padrão da Meta. */
export type PixelSubmitEvent = 'custom' | 'Lead' | 'CompleteRegistration' | 'SubmitApplication' | 'Contact'

export const PIXEL_SUBMIT_EVENTS: { id: PixelSubmitEvent; label: string }[] = [
  { id: 'custom', label: 'Personalizado (<prefixo>Submit)' },
  { id: 'Lead', label: 'Lead (padrão)' },
  { id: 'CompleteRegistration', label: 'CompleteRegistration (padrão)' },
  { id: 'SubmitApplication', label: 'SubmitApplication (padrão)' },
  { id: 'Contact', label: 'Contact (padrão)' },
]

/**
 * Pixel da Meta do formulário. Eventos personalizados com o prefixo (`AvenceView`,
 * `AvenceFirstInteraction`, `AvenceViewScheduled`, `AvenceSubmit`, `AvenceScheduled`) e, se ligados,
 * os padrões `Lead` (só quem passou no filtro) e `Schedule` (reunião marcada). O token da API de
 * Conversões NÃO fica aqui (esta configuração é pública): vive em `crm_form_pixel_tokens`.
 */
export interface FormPixel {
  enabled: boolean
  id: string
  prefix: string
  submitEvent: PixelSubmitEvent
  standardLead: boolean
  standardSchedule: boolean
}

export const PIXEL_DEFAULT: FormPixel = { enabled: true, id: '', prefix: 'Avence', submitEvent: 'custom', standardLead: true, standardSchedule: true }

/** Os nomes dos eventos que o formulário dispara, para mostrar no editor e usar no navegador e no servidor. */
export const pixelEvents = (p: Pick<FormPixel, 'prefix'>) => ({
  view: `${p.prefix}View`,
  first: `${p.prefix}FirstInteraction`,
  viewScheduled: `${p.prefix}ViewScheduled`,
  submit: `${p.prefix}Submit`,
  scheduled: `${p.prefix}Scheduled`,
})

export interface FormTheme {
  primary: string
  background: string
  text: string
  /** Fundo e borda dos campos */
  field: string
  radius: number
  /** `inherit` usa a fonte do site onde o formulário está; Inter, Inter Tight e Lato vêm do Google Fonts */
  font: FormFont
  /** `card` desenha o cartão com borda; `plain` fica solto na página */
  frame: 'card' | 'plain'
  /** `outline`: campos brancos com contorno visível; `fill` (padrão): campos preenchidos */
  fieldStyle?: 'fill' | 'outline'
}

export interface FormSettings {
  submitLabel: string
  nextLabel: string
  successTitle: string
  successText: string
  /** Depois de enviar, vai para este endereço em vez de mostrar a mensagem */
  redirectUrl?: string
  /** Botão "Falar no WhatsApp" na tela final, com o resumo das respostas */
  whatsapp?: { number: string; text: string }
  /** Uma pergunta por tela, avançando ao escolher (o jeito do quiz) */
  autoAdvance: boolean
  showProgress: boolean
  /** Mostra "N pontos" na tela final do quiz. Desligado por padrão: num quiz de qualificação, entrega a lógica do filtro. */
  showScore?: boolean
  /** Frase miúda abaixo do botão de enviar (ex.: o que fazemos com os dados) */
  footnote?: string
  /** Pixel da Meta que roda só dentro do formulário (no app e no site) */
  pixel?: FormPixel
  /** Agenda depois do envio: o destino de quem passou no filtro */
  booking?: FormBooking
}

export interface FormDefinition {
  kind: 'form' | 'quiz'
  /** Tela de início antes da primeira pergunta */
  welcome?: FormWelcome
  /** Faixa de capa acima das perguntas */
  cover?: FormCover
  steps: FormStep[]
  /** Só no quiz, da maior pontuação mínima para a menor na hora de decidir */
  results: QuizResult[]
}

export type Answers = Record<string, string | string[]>

export const THEME_DEFAULT: FormTheme = { primary: '#2b3cf0', background: '#ffffff', text: '#111111', field: '#f4f4f5', radius: 10, font: 'inherit', frame: 'card' }

export const SETTINGS_DEFAULT: FormSettings = {
  submitLabel: 'Enviar',
  nextLabel: 'Continuar',
  successTitle: 'Recebemos suas respostas',
  successText: 'Entraremos em contato em breve.',
  autoAdvance: false,
  showProgress: true,
}

export const WELCOME_DEFAULT: FormWelcome = {
  enabled: true,
  icon: 'rocket',
  title: 'Ajudamos sua empresa a **vender mais**',
  bullets: [
    { id: 'b1', icon: 'target', text: 'Mais retorno no investimento' },
    { id: 'b2', icon: 'palette', text: 'Criativos por nossa conta' },
    { id: 'b3', icon: 'circle-check', text: 'Resultados previsíveis' },
    { id: 'b4', icon: 'trophy', text: 'Método validado' },
  ],
  footnote: 'Exclusivo para empresas que querem crescer com previsibilidade.',
  buttonLabel: 'Quero começar',
}

/** Seg a sex, 9h–12h e 14h–18h. */
const WORKDAY: BookingRange[] = [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }]

/**
 * A regra do usuário (2026-11-04): manhã 8:30, 9:30, 10:30 oferecendo primeiro os mais tarde (10:30 e
 * 9:30); tarde 13:30 a 17:30 oferecendo primeiro os mais cedo (13:30 e 14:30), porque perto das 18h não
 * dá. Os da ponta só aparecem quando os outros já foram reservados.
 */
export const SHIFTS_DEFAULT: BookingShift[] = [
  { id: 'manha', label: 'Manhã', times: ['08:30', '09:30', '10:30'], order: 'late', show: 2 },
  { id: 'tarde', label: 'Tarde', times: ['13:30', '14:30', '15:30', '16:30', '17:30'], order: 'early', show: 2 },
]

export const BOOKING_DEFAULT: FormBooking = {
  enabled: true,
  mode: 'priority',
  shifts: SHIFTS_DEFAULT,
  workdays: [1, 2, 3, 4, 5],
  meetingName: 'Reunião de diagnóstico',
  title: 'Escolha a melhor data e horário',
  durationMin: 60,
  days: 3,
  noticeHours: 2,
  week: { '0': [], '1': WORKDAY, '2': WORKDAY, '3': WORKDAY, '4': WORKDAY, '5': WORKDAY, '6': [] },
  gate: { mode: 'all' },
  confirmLabel: 'Confirmar agendamento',
  successTitle: 'Reunião agendada',
  successText: 'Nossa equipe confirma pelo WhatsApp. Até lá!',
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const FIELD_TYPES: { type: FieldType; label: string; hint: string }[] = [
  { type: 'short', label: 'Texto curto', hint: 'Uma linha' },
  { type: 'long', label: 'Texto longo', hint: 'Várias linhas' },
  { type: 'email', label: 'E-mail', hint: 'Valida o endereço' },
  { type: 'phone', label: 'Telefone / WhatsApp', hint: 'Máscara brasileira' },
  { type: 'number', label: 'Número', hint: 'Só dígitos' },
  { type: 'choice', label: 'Escolha única', hint: 'Cartões de opção' },
  { type: 'multi', label: 'Várias escolhas', hint: 'Marcar mais de uma' },
  { type: 'select', label: 'Lista', hint: 'Menu suspenso' },
  { type: 'yesno', label: 'Sim ou não', hint: 'Duas opções' },
  { type: 'rating', label: 'Nota de 1 a 5', hint: 'Estrelas' },
  { type: 'product', label: 'Encontrar produto', hint: 'Marca com logo, modelo e ano do catálogo' },
]

export const PRODUCT_DEFAULTS = {
  message: 'Olá! Encontrei no site: *{produto}* ({ano})\n{codigos}\n{link}\n\nRef. {ref}',
  buttonLabel: 'Comprar pelo WhatsApp',
  modelLabel: 'Modelo',
  yearLabel: 'Ano',
  resultTitle: 'Encontramos o produto para você',
  noMatchLabel: 'Não encontrei a minha',
  noMatchTitle: 'Vamos achar com você',
  noMatchText: 'Fale com a gente no WhatsApp e diga o que você procura.',
  redirectSeconds: 12,
  noMatchMessage: 'Olá! Não encontrei no site o produto para {marca} {modelo} {ano}. Podem me ajudar?',
}
const norm = (v: string) => v.trim().toLowerCase()
/** Marcas que têm itens, na ordem do cadastro de marcas (as sem cadastro vão no fim, em ordem alfabética). */
export function catalogBrands(c: ProductCatalog): CatalogBrand[] {
  const used = new Set(c.items.map((i) => norm(i.brand)))
  const known = c.brands.filter((b) => used.has(norm(b.name)))
  const names = new Set(known.map((b) => norm(b.name)))
  const rest = [...new Set(c.items.map((i) => i.brand))].filter((b) => !names.has(norm(b))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((name) => ({ name }))
  return [...known, ...rest]
}
export const catalogModels = (c: ProductCatalog, brand: string) =>
  [...new Set(c.items.filter((i) => norm(i.brand) === norm(brand)).map((i) => i.model))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
export const catalogYears = (c: ProductCatalog, brand: string, model: string) =>
  [...new Set(c.items.filter((i) => norm(i.brand) === norm(brand) && i.model === model).map((i) => i.year ?? '').filter(Boolean))].sort().reverse()
export const catalogMatches = (c: ProductCatalog, brand: string, model: string, year?: string) =>
  c.items.filter((i) => norm(i.brand) === norm(brand) && i.model === model && (!year || (i.year ?? '') === year))

/** O texto do WhatsApp com os dados do produto (ou da moto, quando não achou). */
export function productMessage(c: ProductCatalog, item: CatalogItem | undefined, pick: { brand?: string; model?: string; year?: string }, ref = ''): string {
  const tpl = item ? c.message || PRODUCT_DEFAULTS.message : c.noMatchMessage || PRODUCT_DEFAULTS.noMatchMessage
  const vars: Record<string, string> = {
    produto: item ? item.name || `${item.brand} ${item.model}` : '',
    marca: item?.brand ?? pick.brand ?? '',
    modelo: item?.model ?? pick.model ?? '',
    ano: item?.year ?? pick.year ?? '',
    codigos: (item?.codes ?? []).map((x) => `${x.label}: ${x.code}`).join('\n'),
    link: item?.url ?? '',
    ref,
  }
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '').replace(/\(\s*\)/g, '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim()
}
export const whatsappLink = (number: string | undefined, text: string) => (number ? `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : undefined)
export const productField = (d: FormDefinition) => allFields(d).find((f) => f.type === 'product' && f.catalog?.items.length)

export const hasOptions = (type: FieldType) => type === 'choice' || type === 'multi' || type === 'select'

/** Ids curtos e estáveis: letras minúsculas e números, sempre começando por letra. */
export const newId = (prefix = 'f') => `${prefix}${Math.random().toString(36).slice(2, 8)}`

/** Campo de sim/não e nota levam as opções fixas, para a pontuação e a condição usarem o mesmo caminho. */
export function optionsOf(field: FormField): FieldOption[] {
  // Sim ou não: sempre duas respostas; o texto de cada uma pode ser outro, e vazio volta a "Sim" / "Não"
  if (field.type === 'yesno') {
    const base = [{ id: 'sim', label: 'Sim' }, { id: 'nao', label: 'Não' }]
    if (field.options?.length !== 2) return base
    return field.options.map((o, i) => ({ ...o, label: o.label.trim() || base[i].label }))
  }
  if (field.type === 'rating') return [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n), score: field.options?.find((o) => o.id === String(n))?.score }))
  return field.options ?? []
}

const asList = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? [value] : [])

/** O campo aparece com as respostas de agora? (a condição olha só campos anteriores) */
export function isVisible(field: FormField, answers: Answers): boolean {
  const c = field.showIf
  if (!c) return true
  const given = asList(answers[c.field])
  const hit = given.includes(c.value)
  return c.op === 'eq' ? hit : !hit
}

export const visibleFields = (step: FormStep, answers: Answers) => step.fields.filter((f) => isVisible(f, answers))

export const allFields = (definition: FormDefinition) => definition.steps.flatMap((s) => s.fields)

/** Soma os pontos das opções escolhidas nos campos que apareceram. */
export function scoreOf(definition: FormDefinition, answers: Answers): number {
  let total = 0
  for (const step of definition.steps) {
    for (const field of visibleFields(step, answers)) {
      if (!hasOptions(field.type) && field.type !== 'yesno' && field.type !== 'rating') continue
      const options = optionsOf(field)
      for (const id of asList(answers[field.id])) total += options.find((o) => o.id === id)?.score ?? 0
    }
  }
  return total
}

/** A faixa mais alta cujo mínimo a pontuação alcança (ou a de menor mínimo, se nenhuma). */
export function resultFor(definition: FormDefinition, score: number): QuizResult | undefined {
  if (definition.kind !== 'quiz' || !definition.results.length) return undefined
  const sorted = [...definition.results].sort((a, b) => b.min - a.min)
  return sorted.find((r) => score >= r.min) ?? sorted[sorted.length - 1]
}

/** A pessoa que respondeu vai para a agenda? (o servidor decide; o `forms.js` só repete na prévia) */
/** Um problema que impede publicar (`error`) ou que vale conferir antes (`warning`). */
export interface FormIssue {
  level: 'error' | 'warning'
  text: string
  /** A etapa (1, 2…) onde está, quando é numa pergunta */
  step?: number
}

const DEFAULT_OPTION = /^Opção \d+$/

/**
 * Confere o formulário antes de ir para o ar: o que quebraria o envio para quem responde (etapa vazia,
 * pergunta sem texto, opções ainda com o texto padrão, agenda com filtro numa pergunta que sumiu…).
 * Com algum `error`, o editor não publica.
 */
export function formIssues(definition: FormDefinition, settings: FormSettings): FormIssue[] {
  const out: FormIssue[] = []
  const err = (text: string, step?: number) => out.push({ level: 'error', text, step })
  const warn = (text: string, step?: number) => out.push({ level: 'warning', text, step })
  if (!definition.steps.length) err('O formulário não tem nenhuma pergunta.')
  definition.steps.forEach((st, i) => {
    const n = i + 1
    const name = st.title?.trim() ? `“${st.title.trim()}”` : `Etapa ${n}`
    if (!st.fields.length) return err(`${name} está sem pergunta.`, n)
    const lone = st.fields.length === 1 && !!st.title?.trim()
    st.fields.forEach((f) => {
      const label = f.label.trim()
      if (!label && !lone) err(`${name} tem uma pergunta sem texto.`, n)
      if (hasOptions(f.type)) {
        const opts = f.options ?? []
        if (opts.length < 2) err(`${label ? `“${label}”` : name}: a pergunta de escolha precisa de pelo menos 2 opções.`, n)
        if (opts.some((o) => !o.label.trim())) err(`${label ? `“${label}”` : name} tem uma opção sem texto.`, n)
        else if (opts.length && opts.every((o) => DEFAULT_OPTION.test(o.label.trim()))) err(`${label ? `“${label}”` : name} ainda está com as opções padrão (Opção 1, Opção 2…).`, n)
      }
      if (f.type === 'product') {
        if (!f.catalog?.items.length) err(`${label ? `“${label}”` : name}: importe o catálogo de produtos.`, n)
        if (!f.catalog?.whatsapp) err(`${label ? `“${label}”` : name}: falta o número do WhatsApp para o botão de compra.`, n)
      }
      if (f.showIf && !allFields(definition).some((x) => x.id === f.showIf!.field)) err(`${label ? `“${label}”` : name} depende de uma pergunta que não existe mais.`, n)
    })
  })
  if (settings.autoAdvance) {
    definition.steps.forEach((st, i) => {
      if (st.fields.length > 1 && st.fields.some((f) => f.type === 'choice')) warn(`“${st.title?.trim() || `Etapa ${i + 1}`}” tem mais de uma pergunta: ela mostra o botão em vez de avançar sozinha.`, i + 1)
    })
  }
  const b = settings.booking
  const gate = b?.gate
  if (b?.enabled && gate?.mode === 'answer') {
    const field = allFields(definition).find((f) => f.id === gate.field)
    if (!field) err('A agenda filtra por uma pergunta que não existe mais: ajuste o filtro na aba Agenda.')
    else if (!gate.values.some((v) => (field.options ?? []).some((o) => o.id === v))) err('Nenhuma resposta marcada no filtro da agenda existe na pergunta: ninguém veria a agenda.')
  }
  if (definition.kind === 'quiz' && !definition.results.length) err('O quiz está sem resultados.')
  if (settings.whatsapp && !settings.whatsapp.number.replace(/\D/g, '')) err('O botão do WhatsApp está ligado sem o número.')
  return out
}

export function bookingEligible(definition: FormDefinition, booking: FormBooking | undefined, answers: Answers, qualified: boolean | null): boolean {
  if (!booking?.enabled) return false
  const gate = booking.gate
  if (gate.mode === 'all') return true
  if (gate.mode === 'qualified') return definition.kind === 'quiz' ? qualified === true : true
  const field = allFields(definition).find((f) => f.id === gate.field)
  if (!field || !isVisible(field, answers)) return false
  return asList(answers[gate.field]).some((v) => gate.values.includes(v))
}

/**
 * Horário de Brasília: sem horário de verão desde 2019, então um deslocamento fixo de −3 h. Datas
 * locais como `2026-11-04` e horários `14:00`; o instante vai para o banco em UTC.
 */
export const BOOKING_TZ = 'America/Sao_Paulo'
const OFFSET_MIN = -180

const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** O instante (UTC) de um dia e um horário de Brasília. */
export const slotInstant = (date: string, hhmm: string) => new Date(Date.parse(`${date}T${hhmm}:00Z`) - OFFSET_MIN * 60_000)

/** Dia (AAAA-MM-DD) e dia da semana de um instante, em Brasília. */
export function localDay(at: Date): { date: string; weekday: number } {
  const local = new Date(at.getTime() + OFFSET_MIN * 60_000)
  return { date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`, weekday: local.getUTCDay() }
}

/** HH:MM de um instante, em Brasília. */
export function localTime(at: Date): string {
  const local = new Date(at.getTime() + OFFSET_MIN * 60_000)
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
}

export interface BookingDay {
  date: string
  weekday: number
  /** Inícios livres, HH:MM de Brasília */
  times: string[]
}

/** Os horários de um dia da semana, cortados na duração da reunião. */
export function timesOfDay(booking: FormBooking, weekday: number): string[] {
  const out: string[] = []
  const step = booking.durationMin
  for (const r of booking.week[String(weekday)] ?? []) {
    const a = toMin(r.start)
    const b = toMin(r.end)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    for (let t = a; t + step <= b; t += step) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`)
  }
  return [...new Set(out)].sort()
}

/** A ordem em que um turno oferece os horários. */
export const shiftOrder = (shift: BookingShift) => {
  const sorted = [...shift.times].sort()
  return shift.order === 'late' ? sorted.reverse() : sorted
}

/**
 * Os horários livres de um dia. Por prioridade: em cada turno, os `show` primeiros livres na ordem do
 * turno (o resto só entra quando esses são reservados). Por intervalos: todos os livres.
 */
export function freeTimes(booking: FormBooking, weekday: number, isFree: (hhmm: string) => boolean): string[] {
  if ((booking.mode ?? 'priority') === 'range') return timesOfDay(booking, weekday).filter(isFree)
  if (!(booking.workdays ?? []).includes(weekday)) return []
  const out = new Set<string>()
  for (const shift of booking.shifts ?? []) for (const t of shiftOrder(shift).filter(isFree).slice(0, shift.show)) out.add(t)
  return [...out].sort()
}

/**
 * Os próximos `booking.days` dias com horário livre (olhando até 21 dias à frente), sem os já
 * reservados (`taken`: instantes ISO) e respeitando a antecedência mínima. Um dia lotado (ou sem
 * atendimento) é pulado, e o próximo dia de atendimento entra no lugar dele.
 */
export function bookingDays(booking: FormBooking, now: Date, taken: Iterable<string> = []): BookingDay[] {
  const busy = new Set([...taken].map((iso) => new Date(iso).getTime()))
  const earliest = now.getTime() + booking.noticeHours * 3_600_000
  const days: BookingDay[] = []
  const today = localDay(now).date
  // Nunca no mesmo dia: a equipe prepara o material da reunião, então a agenda começa amanhã
  for (let i = 1; i <= 21 && days.length < booking.days; i++) {
    const date = new Date(Date.parse(`${today}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    const times = freeTimes(booking, weekday, (t) => {
      const at = slotInstant(date, t).getTime()
      return at >= earliest && !busy.has(at)
    })
    if (times.length) days.push({ date, weekday, times })
  }
  return days
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface Checked {
  /** Respostas limpas, só dos campos que aparecem (id → texto ou lista de ids) */
  answers: Answers
  errors: Record<string, string>
}

/** Confere as respostas contra a definição: obrigatórios, formatos e opções que existem. */
export function checkAnswers(definition: FormDefinition, raw: unknown): Checked {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const answers: Answers = {}
  const errors: Record<string, string> = {}
  for (const step of definition.steps) {
    for (const field of step.fields) {
      if (!isVisible(field, answers)) continue
      const value = input[field.id]
      const list = (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]).map((v) => String(v).trim()).filter(Boolean)
      if (!list.length) {
        if (field.required) errors[field.id] = 'Preencha este campo.'
        continue
      }
      if (field.type === 'product') {
        const item = field.catalog?.items.find((i) => i.id === list[0])
        if (!item) errors[field.id] = 'Escolha a marca, o modelo e o ano.'
        else answers[field.id] = item.id
        continue
      }
      if (hasOptions(field.type) || field.type === 'yesno' || field.type === 'rating') {
        const valid = new Set(optionsOf(field).map((o) => o.id))
        const picked = list.filter((id) => valid.has(id))
        if (!picked.length) errors[field.id] = 'Escolha uma das opções.'
        else answers[field.id] = field.type === 'multi' ? picked : picked[0]
        continue
      }
      const text = list[0].slice(0, field.type === 'long' ? 3000 : 300)
      if (field.type === 'email' && !EMAIL.test(text)) errors[field.id] = 'Confira o e-mail.'
      else if (field.type === 'phone' && text.replace(/\D/g, '').length < 10) errors[field.id] = 'Digite o telefone com DDD.'
      else if (field.type === 'number' && !Number.isFinite(Number(text.replace(',', '.')))) errors[field.id] = 'Digite só números.'
      else answers[field.id] = text
    }
  }
  return { answers, errors }
}

/** O texto de uma resposta como a equipe lê (opções viram o rótulo). */
export function answerText(field: FormField, value: string | string[] | undefined): string {
  const list = asList(value)
  if (!list.length) return ''
  if (field.type === 'product') {
    const i = field.catalog?.items.find((x) => x.id === list[0])
    return i ? [i.name || `${i.brand} ${i.model}`, i.year, (i.codes ?? []).map((c) => `${c.label} ${c.code}`).join(', ')].filter(Boolean).join(' · ') : list[0]
  }
  if (hasOptions(field.type) || field.type === 'yesno' || field.type === 'rating') {
    const options = optionsOf(field)
    return list.map((id) => options.find((o) => o.id === id)?.label ?? id).join(', ')
  }
  return list[0]
}

/** Pergunta e resposta, uma por linha, na ordem do formulário. */
export function summaryOf(definition: FormDefinition, answers: Answers): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  for (const field of allFields(definition)) {
    const value = answerText(field, answers[field.id])
    if (value) rows.push({ label: field.label, value })
  }
  return rows
}

/** Garante uma definição utilizável vinda do banco ou de fora (nunca confia no formato). */
export function cleanDefinition(raw: unknown): FormDefinition {
  const source = raw && typeof raw === 'object' ? (raw as Partial<FormDefinition>) : {}
  const steps = Array.isArray(source.steps) ? source.steps : []
  return {
    kind: source.kind === 'quiz' ? 'quiz' : 'form',
    welcome: cleanWelcome(source.welcome),
    cover: cleanCover(source.cover),
    steps: steps.slice(0, 40).map((s, i) => ({
      id: String(s?.id ?? `s${i}`),
      title: typeof s?.title === 'string' ? s.title.slice(0, 200) : undefined,
      description: typeof s?.description === 'string' ? s.description.slice(0, 600) : undefined,
      note: typeof s?.note === 'string' ? s.note.slice(0, 300) : undefined,
      fields: (Array.isArray(s?.fields) ? s.fields : []).slice(0, 40).map((f, j) => ({
        id: String(f?.id ?? `f${i}_${j}`),
        type: FIELD_TYPES.some((t) => t.type === f?.type) ? (f.type as FieldType) : 'short',
        label: String(f?.label ?? '').slice(0, 300),
        help: typeof f?.help === 'string' ? f.help.slice(0, 300) : undefined,
        placeholder: typeof f?.placeholder === 'string' ? f.placeholder.slice(0, 120) : undefined,
        required: f?.required === true,
        options: Array.isArray(f?.options) ? f.options.slice(0, 30).map((o, k) => ({ id: String(o?.id ?? `o${k}`), label: String(o?.label ?? '').slice(0, 200), score: typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.round(o.score) : undefined })) : undefined,
        map: f?.map === 'name' || f?.map === 'email' || f?.map === 'phone' || f?.map === 'message' ? f.map : undefined,
        width: f?.width === 'half' ? 'half' : undefined,
        showIf: f?.showIf && typeof f.showIf.field === 'string' ? { field: f.showIf.field, op: f.showIf.op === 'neq' ? 'neq' : 'eq', value: String(f.showIf.value ?? '') } : undefined,
        catalog: f?.type === 'product' ? cleanCatalog(f.catalog) : undefined,
      })),
    })),
    results: (Array.isArray(source.results) ? source.results : []).slice(0, 10).map((r, i) => ({
      id: String(r?.id ?? `r${i}`),
      min: typeof r?.min === 'number' && Number.isFinite(r.min) ? Math.round(r.min) : 0,
      title: String(r?.title ?? '').slice(0, 200),
      text: typeof r?.text === 'string' ? r.text.slice(0, 800) : undefined,
      ctaLabel: typeof r?.ctaLabel === 'string' ? r.ctaLabel.slice(0, 60) : undefined,
      ctaUrl: typeof r?.ctaUrl === 'string' && /^https?:\/\//i.test(r.ctaUrl) ? r.ctaUrl.slice(0, 500) : undefined,
      qualified: r?.qualified === true,
    })),
  }
}

/** O catálogo de um campo `product`: até 3.000 itens, textos curtos, imagens e links só https. */
export function cleanCatalog(raw: unknown): ProductCatalog {
  const c = raw && typeof raw === 'object' ? (raw as Partial<ProductCatalog>) : {}
  const txt = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  const seen = new Set<string>()
  const items = (Array.isArray(c.items) ? c.items : []).slice(0, 3000).flatMap((i, n): CatalogItem[] => {
    const brand = txt(i?.brand, 60), model = txt(i?.model, 120)
    if (!brand || !model) return []
    let id = (txt(i?.id, 60) ?? `p${n}`).replace(/[^\w.-]/g, '')
    while (seen.has(id)) id += '_'
    seen.add(id)
    const codes = (Array.isArray(i?.codes) ? i.codes : []).slice(0, 6).map((x) => ({ label: txt(x?.label, 30) ?? '', code: txt(x?.code, 40) ?? '' })).filter((x) => x.code)
    return [{ id, brand, model, year: txt(i?.year, 30), name: txt(i?.name, 160), image: httpsUrl(i?.image), url: httpsUrl(i?.url), codes: codes.length ? codes : undefined }]
  })
  const brands = (Array.isArray(c.brands) ? c.brands : []).slice(0, 200).flatMap((b): CatalogBrand[] => { const name = txt(b?.name, 60); return name ? [{ name, logo: httpsUrl(b?.logo) }] : [] })
  const digits = typeof c.whatsapp === 'string' ? c.whatsapp.replace(/\D/g, '').slice(0, 15) : ''
  return {
    items, brands, whatsapp: digits.length >= 10 ? digits : undefined,
    message: txt(c.message, 800), buttonLabel: txt(c.buttonLabel, 40), modelLabel: txt(c.modelLabel, 40), yearLabel: txt(c.yearLabel, 40),
    resultTitle: txt(c.resultTitle, 120), noMatchLabel: txt(c.noMatchLabel, 60), noMatchTitle: txt(c.noMatchTitle, 120), noMatchText: txt(c.noMatchText, 400), noMatchMessage: txt(c.noMatchMessage, 600),
    redirectSeconds: typeof c.redirectSeconds === 'number' && Number.isFinite(c.redirectSeconds) ? Math.max(0, Math.min(30, Math.round(c.redirectSeconds))) : undefined,
    redirectStyle: c.redirectStyle === 'bar' ? 'bar' : undefined,
  }
}

const httpsUrl = (v: unknown, max = 500) => (typeof v === 'string' && /^https:\/\//i.test(v.trim()) ? v.trim().slice(0, max) : undefined)

const HEX = /^#[0-9a-f]{6}$/i

function cleanCover(raw: unknown): FormCover | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Partial<FormCover>
  const txt = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  return {
    enabled: c.enabled === true,
    logoUrl: httpsUrl(c.logoUrl),
    image: httpsUrl(c.image),
    eyebrow: txt(c.eyebrow, 60),
    title: txt(c.title, 90) ?? '',
    text: txt(c.text, 90),
    watermark: txt(c.watermark, 20),
    background: typeof c.background === 'string' && HEX.test(c.background) ? c.background : undefined,
    accent: typeof c.accent === 'string' && HEX.test(c.accent) ? c.accent : undefined,
    display: c.display === true,
  }
}

function cleanWelcome(raw: unknown): FormWelcome | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const w = raw as Partial<FormWelcome>
  return {
    enabled: w.enabled === true,
    logoUrl: httpsUrl(w.logoUrl),
    icon: isIcon(w.icon) ? w.icon : undefined,
    title: typeof w.title === 'string' ? w.title.slice(0, 200) : '',
    bullets: (Array.isArray(w.bullets) ? w.bullets : []).slice(0, 8).map((b, i) => ({ id: String(b?.id ?? `b${i}`).slice(0, 20), icon: isIcon(b?.icon) ? b.icon : undefined, text: String(b?.text ?? '').slice(0, 80) })),
    footnote: typeof w.footnote === 'string' && w.footnote.trim() ? w.footnote.trim().replace(/^(→|->)\s*/, '').slice(0, 240) : undefined,
    buttonLabel: typeof w.buttonLabel === 'string' && w.buttonLabel.trim() ? w.buttonLabel.trim().slice(0, 40) : WELCOME_DEFAULT.buttonLabel,
    valign: w.valign === 'center' || w.valign === 'bottom' || w.valign === 'justify' ? w.valign : 'top',
    logoAlign: w.logoAlign === 'center' || w.logoAlign === 'right' ? w.logoAlign : 'left',
    logoSize: typeof w.logoSize === 'number' && Number.isFinite(w.logoSize) ? Math.max(12, Math.min(64, Math.round(w.logoSize))) : undefined,
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function cleanBooking(raw: unknown): FormBooking | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const b = raw as Partial<FormBooking>
  const int = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback)
  const text = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback)
  const week: Record<string, BookingRange[]> = {}
  const rawWeek = b.week && typeof b.week === 'object' ? (b.week as Record<string, unknown>) : {}
  for (let d = 0; d < 7; d++) {
    const list = Array.isArray(rawWeek[String(d)]) ? (rawWeek[String(d)] as Partial<BookingRange>[]) : []
    week[String(d)] = list
      .filter((r) => r && typeof r.start === 'string' && typeof r.end === 'string' && HHMM.test(r.start) && HHMM.test(r.end) && r.start < r.end)
      .slice(0, 6)
      .map((r) => ({ start: r.start as string, end: r.end as string }))
  }
  const g = b.gate as Partial<{ mode: string; field: string; values: unknown[] }> | undefined
  const gate: BookingGate =
    g?.mode === 'qualified'
      ? { mode: 'qualified' }
      : g?.mode === 'answer' && typeof g.field === 'string' && g.field
        ? { mode: 'answer', field: g.field.slice(0, 40), values: (Array.isArray(g.values) ? g.values : []).map(String).slice(0, 30) }
        : { mode: 'all' }
  const rawShifts = Array.isArray(b.shifts) ? (b.shifts as Partial<BookingShift>[]) : null
  const shifts = (rawShifts ?? SHIFTS_DEFAULT).slice(0, 4).map((s, i) => ({
    id: String(s?.id ?? `t${i}`).slice(0, 20),
    label: text(s?.label, `Turno ${i + 1}`, 30),
    times: [...new Set((Array.isArray(s?.times) ? s.times : []).filter((t): t is string => typeof t === 'string' && HHMM.test(t)))].sort().slice(0, 16),
    order: s?.order === 'early' ? ('early' as const) : ('late' as const),
    show: int(s?.show, 1, 8, 2),
  }))
  const workdays = Array.isArray(b.workdays) ? [...new Set(b.workdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [1, 2, 3, 4, 5]
  return {
    enabled: b.enabled === true,
    // Sem o campo (formulários de antes de 2026-11-04) vale a regra por prioridade, a que o usuário quer sempre
    mode: b.mode === 'range' ? 'range' : 'priority',
    shifts,
    workdays,
    meetingName: text(b.meetingName, BOOKING_DEFAULT.meetingName, 80),
    title: text(b.title, BOOKING_DEFAULT.title, 120),
    durationMin: int(b.durationMin, 15, 240, BOOKING_DEFAULT.durationMin),
    days: int(b.days, 1, 14, BOOKING_DEFAULT.days),
    noticeHours: int(b.noticeHours, 0, 72, BOOKING_DEFAULT.noticeHours),
    week,
    gate,
    confirmLabel: text(b.confirmLabel, BOOKING_DEFAULT.confirmLabel, 40),
    successTitle: text(b.successTitle, BOOKING_DEFAULT.successTitle, 120),
    successText: typeof b.successText === 'string' ? b.successText.slice(0, 600) : BOOKING_DEFAULT.successText,
  }
}

export const PIXEL_ID = /^\d{14,17}$/

function cleanPixel(raw: unknown): FormPixel | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const p = raw as Partial<FormPixel>
  const id = typeof p.id === 'string' ? p.id.replace(/\D/g, '').slice(0, 20) : ''
  const prefix = typeof p.prefix === 'string' ? p.prefix.replace(/[^A-Za-z0-9_]/g, '').slice(0, 24) : ''
  return {
    enabled: p.enabled === true,
    id,
    prefix: prefix || PIXEL_DEFAULT.prefix,
    submitEvent: PIXEL_SUBMIT_EVENTS.some((e) => e.id === p.submitEvent) ? (p.submitEvent as PixelSubmitEvent) : 'custom',
    standardLead: p.standardLead !== false,
    standardSchedule: p.standardSchedule !== false,
  }
}

/** O pixel liga de verdade? (interruptor ligado e ID com cara de ID) */
export const pixelActive = (p: FormPixel | undefined): p is FormPixel => !!p?.enabled && PIXEL_ID.test(p.id)

export function cleanTheme(raw: unknown): FormTheme {
  const t = raw && typeof raw === 'object' ? (raw as Partial<FormTheme>) : {}
  const color = (value: unknown, fallback: string) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback)
  return {
    primary: color(t.primary, THEME_DEFAULT.primary),
    background: color(t.background, THEME_DEFAULT.background),
    text: color(t.text, THEME_DEFAULT.text),
    field: color(t.field, THEME_DEFAULT.field),
    radius: typeof t.radius === 'number' ? Math.max(0, Math.min(28, Math.round(t.radius))) : THEME_DEFAULT.radius,
    font: FONTS.some((f) => f.id === t.font) ? (t.font as FormFont) : 'inherit',
    frame: t.frame === 'plain' ? 'plain' : 'card',
    fieldStyle: t.fieldStyle === 'outline' ? 'outline' : 'fill',
  }
}

export function cleanSettings(raw: unknown): FormSettings {
  const s = raw && typeof raw === 'object' ? (raw as Partial<FormSettings>) : {}
  const text = (value: unknown, fallback: string, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback)
  const wa = s.whatsapp && typeof s.whatsapp.number === 'string' && s.whatsapp.number.replace(/\D/g, '').length >= 10 ? { number: s.whatsapp.number.replace(/\D/g, '').slice(0, 15), text: String(s.whatsapp.text ?? '').slice(0, 500) } : undefined
  return {
    submitLabel: text(s.submitLabel, SETTINGS_DEFAULT.submitLabel, 40),
    nextLabel: text(s.nextLabel, SETTINGS_DEFAULT.nextLabel, 40),
    successTitle: text(s.successTitle, SETTINGS_DEFAULT.successTitle, 200),
    successText: typeof s.successText === 'string' ? s.successText.slice(0, 600) : SETTINGS_DEFAULT.successText,
    redirectUrl: typeof s.redirectUrl === 'string' && /^https?:\/\//i.test(s.redirectUrl) ? s.redirectUrl.slice(0, 500) : undefined,
    whatsapp: wa,
    autoAdvance: s.autoAdvance === true,
    showProgress: s.showProgress !== false,
    showScore: s.showScore === true,
    footnote: typeof s.footnote === 'string' && s.footnote.trim() ? s.footnote.trim().slice(0, 160) : undefined,
    pixel: cleanPixel(s.pixel),
    booking: cleanBooking(s.booking),
  }
}
