/**
 * Formulários e quizzes (CRM › Formulários): o contrato que o construtor (app), a função pública
 * `form-submit` e o script `public/forms.js` entendem. Sem imports e só sintaxe apagável: roda no
 * app (Vite), na função (Deno) e nos testes (Node). O `forms.js` repete a lógica de visibilidade
 * e pontuação em JavaScript puro, porque é servido sem build; a função refaz tudo no servidor,
 * então o que o navegador calcula nunca é confiado.
 */

export type FieldType = 'short' | 'long' | 'email' | 'phone' | 'number' | 'choice' | 'multi' | 'select' | 'yesno' | 'rating'

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
}

export interface FormStep {
  id: string
  title?: string
  description?: string
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

export interface FormTheme {
  primary: string
  background: string
  text: string
  /** Fundo e borda dos campos */
  field: string
  radius: number
  /** `inherit` usa a fonte do site onde o formulário está */
  font: 'inherit' | 'Inter' | 'system'
  /** `card` desenha o cartão com borda; `plain` fica solto na página */
  frame: 'card' | 'plain'
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
}

export interface FormDefinition {
  kind: 'form' | 'quiz'
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
]

export const hasOptions = (type: FieldType) => type === 'choice' || type === 'multi' || type === 'select'

/** Ids curtos e estáveis: letras minúsculas e números, sempre começando por letra. */
export const newId = (prefix = 'f') => `${prefix}${Math.random().toString(36).slice(2, 8)}`

/** Campo de sim/não e nota levam as opções fixas, para a pontuação e a condição usarem o mesmo caminho. */
export function optionsOf(field: FormField): FieldOption[] {
  if (field.type === 'yesno') return field.options?.length === 2 ? field.options : [{ id: 'sim', label: 'Sim' }, { id: 'nao', label: 'Não' }]
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
    steps: steps.slice(0, 40).map((s, i) => ({
      id: String(s?.id ?? `s${i}`),
      title: typeof s?.title === 'string' ? s.title.slice(0, 200) : undefined,
      description: typeof s?.description === 'string' ? s.description.slice(0, 600) : undefined,
      fields: (Array.isArray(s?.fields) ? s.fields : []).slice(0, 40).map((f, j) => ({
        id: String(f?.id ?? `f${i}_${j}`),
        type: FIELD_TYPES.some((t) => t.type === f?.type) ? (f.type as FieldType) : 'short',
        label: String(f?.label ?? '').slice(0, 300),
        help: typeof f?.help === 'string' ? f.help.slice(0, 300) : undefined,
        placeholder: typeof f?.placeholder === 'string' ? f.placeholder.slice(0, 120) : undefined,
        required: f?.required === true,
        options: Array.isArray(f?.options) ? f.options.slice(0, 30).map((o, k) => ({ id: String(o?.id ?? `o${k}`), label: String(o?.label ?? '').slice(0, 200), score: typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.round(o.score) : undefined })) : undefined,
        map: f?.map === 'name' || f?.map === 'email' || f?.map === 'phone' || f?.map === 'message' ? f.map : undefined,
        showIf: f?.showIf && typeof f.showIf.field === 'string' ? { field: f.showIf.field, op: f.showIf.op === 'neq' ? 'neq' : 'eq', value: String(f.showIf.value ?? '') } : undefined,
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

export function cleanTheme(raw: unknown): FormTheme {
  const t = raw && typeof raw === 'object' ? (raw as Partial<FormTheme>) : {}
  const color = (value: unknown, fallback: string) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback)
  return {
    primary: color(t.primary, THEME_DEFAULT.primary),
    background: color(t.background, THEME_DEFAULT.background),
    text: color(t.text, THEME_DEFAULT.text),
    field: color(t.field, THEME_DEFAULT.field),
    radius: typeof t.radius === 'number' ? Math.max(0, Math.min(28, Math.round(t.radius))) : THEME_DEFAULT.radius,
    font: t.font === 'Inter' || t.font === 'system' ? t.font : 'inherit',
    frame: t.frame === 'plain' ? 'plain' : 'card',
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
  }
}
