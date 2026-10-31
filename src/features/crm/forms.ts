import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { SETTINGS_DEFAULT, THEME_DEFAULT, cleanDefinition, cleanSettings, cleanTheme, newId, type Answers, type FormDefinition, type FormField, type FormSettings, type FormStep, type FormTheme } from '../../../supabase/functions/_shared/forms.ts'
import { isLocalAppUrl, publicAppUrl } from '@/features/approval/shares'

/**
 * Formulários e quizzes (CRM › Formulários): lista, edição, respostas e o código de embed.
 * O contrato (campos, lógica, pontuação) vive em `supabase/functions/_shared/forms.ts`, que a
 * função pública `form-submit` e o script `public/forms.js` também usam.
 */

export * from '../../../supabase/functions/_shared/forms.ts'

const db = supabase as unknown as SupabaseClient

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || 'https://nfmfcpcwyavutntnrxqq.supabase.co'
export const FORMS_ENDPOINT = `${SUPABASE_URL}/functions/v1/form-submit`

/**
 * Muda a cada alteração do `public/forms.js`: o servidor guarda o arquivo por 30 dias no navegador,
 * e o `?v=` faz as correções chegarem a quem já visitou o site.
 */
export const FORMS_SCRIPT_VERSION = '5'

/** O script sai sempre do app publicado (no app local, o endereço daqui não abre no site). */
export const formsScriptUrl = () => `${isLocalAppUrl() ? 'https://app.avencestudio.com' : publicAppUrl()}/forms.js?v=${FORMS_SCRIPT_VERSION}`

const CONFIG_BUCKET = 'crm-forms'

/** A definição publicada, servida pelo CDN do Storage (migração 20261031100000): abre bem mais rápido que a função. */
export const configUrl = (teamId: string, formId: string) => `${SUPABASE_URL}/storage/v1/object/public/${CONFIG_BUCKET}/${teamId}/${formId}.json`

export interface CrmForm {
  id: string
  teamId: string
  name: string
  kind: 'form' | 'quiz'
  status: 'draft' | 'published'
  definition: FormDefinition
  theme: FormTheme
  settings: FormSettings
  views: number
  createdAt: number
  updatedAt: number
}

export interface FormSubmission {
  id: string
  formId: string
  answers: Answers
  summary: { label: string; value: string }[]
  name?: string
  email?: string
  phone?: string
  score?: number
  result?: string
  qualified?: boolean
  opportunityId?: string
  origin?: { channel?: string; paid?: boolean; page?: string; utm?: Record<string, string>; campaign?: { name?: string } }
  createdAt: number
}

export class FormsTablesError extends Error {
  constructor() {
    super('Falta aplicar a migração 20261030100000_crm_forms.sql no Supabase.')
  }
}

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === '42P01' || error.code === 'PGRST205') throw new FormsTablesError()
  throw new Error(error.message)
}

type FormRow = {
  id: string
  team_id: string
  name: string
  kind: 'form' | 'quiz'
  status: 'draft' | 'published'
  definition: unknown
  theme: unknown
  settings: unknown
  views: number | string
  created_at: string
  updated_at: string
}

const toForm = (row: FormRow): CrmForm => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  kind: row.kind,
  status: row.status,
  definition: cleanDefinition(row.definition),
  theme: cleanTheme(row.theme),
  settings: cleanSettings(row.settings),
  views: Number(row.views) || 0,
  createdAt: Date.parse(row.created_at),
  updatedAt: Date.parse(row.updated_at),
})

export async function listForms(teamId: string): Promise<CrmForm[]> {
  const { data, error } = await db.from('crm_forms').select('*').eq('team_id', teamId).order('created_at', { ascending: false })
  if (error) fail(error)
  return ((data ?? []) as FormRow[]).map(toForm)
}

export async function loadForm(id: string): Promise<CrmForm | null> {
  const { data, error } = await db.from('crm_forms').select('*').eq('id', id).maybeSingle()
  if (error) fail(error)
  return data ? toForm(data as FormRow) : null
}

export async function createForm(teamId: string, name: string, definition: FormDefinition, theme = THEME_DEFAULT, settings = SETTINGS_DEFAULT): Promise<CrmForm> {
  const { data, error } = await db
    .from('crm_forms')
    .insert({ team_id: teamId, name: name.trim() || 'Novo formulário', kind: definition.kind, definition, theme, settings })
    .select('*')
    .single()
  if (error) fail(error)
  return toForm(data as FormRow)
}

/**
 * Mantém o arquivo público da configuração em dia: publicado grava, rascunho apaga. É um ganho de
 * velocidade, nunca um requisito: sem o bucket (migração por aplicar) o `forms.js` busca na função.
 */
async function syncPublic(form: Pick<CrmForm, 'id' | 'teamId' | 'name' | 'status' | 'definition' | 'theme' | 'settings'>) {
  const path = `${form.teamId}/${form.id}.json`
  try {
    if (form.status === 'published') {
      const body = JSON.stringify({ id: form.id, name: form.name, definition: cleanDefinition(form.definition), theme: cleanTheme(form.theme), settings: cleanSettings(form.settings) })
      const { error } = await supabase.storage.from(CONFIG_BUCKET).upload(path, new Blob([body], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '30' })
      if (error) console.warn('forms: configuração pública não gravada:', error.message)
    } else {
      await supabase.storage.from(CONFIG_BUCKET).remove([path])
    }
  } catch (e) {
    console.warn('forms: configuração pública não gravada:', e)
  }
}

export async function saveForm(form: Pick<CrmForm, 'id' | 'teamId' | 'name' | 'status' | 'definition' | 'theme' | 'settings'>) {
  const { error } = await db
    .from('crm_forms')
    .update({ name: form.name.trim() || 'Sem nome', kind: form.definition.kind, status: form.status, definition: form.definition, theme: form.theme, settings: form.settings, updated_at: new Date().toISOString() })
    .eq('id', form.id)
  if (error) fail(error)
  await syncPublic(form)
}

export async function deleteForm(form: Pick<CrmForm, 'id' | 'teamId'>) {
  const { error } = await db.from('crm_forms').delete().eq('id', form.id)
  if (error) fail(error)
  await syncPublic({ ...form, name: '', status: 'draft', definition: cleanDefinition(null), theme: THEME_DEFAULT, settings: SETTINGS_DEFAULT })
}

/** Quantas respostas cada formulário já recebeu (para a taxa de conversão da lista). */
export async function submissionCounts(teamId: string): Promise<Record<string, { total: number; qualified: number }>> {
  const { data, error } = await db.from('crm_form_submissions').select('form_id, qualified').eq('team_id', teamId).limit(5000)
  if (error) fail(error)
  const out: Record<string, { total: number; qualified: number }> = {}
  for (const row of (data ?? []) as { form_id: string; qualified: boolean | null }[]) {
    const entry = (out[row.form_id] ??= { total: 0, qualified: 0 })
    entry.total += 1
    if (row.qualified) entry.qualified += 1
  }
  return out
}

type SubmissionRow = {
  id: string
  form_id: string
  answers: Answers
  summary: { label: string; value: string }[]
  name: string | null
  email: string | null
  phone: string | null
  score: number | null
  result: string | null
  qualified: boolean | null
  opportunity_id: string | null
  origin: FormSubmission['origin'] | null
  created_at: string
}

export async function listSubmissions(formId: string, limit = 200): Promise<FormSubmission[]> {
  const { data, error } = await db.from('crm_form_submissions').select('*').eq('form_id', formId).order('created_at', { ascending: false }).limit(limit)
  if (error) fail(error)
  return ((data ?? []) as SubmissionRow[]).map((r) => ({
    id: r.id,
    formId: r.form_id,
    answers: r.answers,
    summary: Array.isArray(r.summary) ? r.summary : [],
    name: r.name ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    score: r.score ?? undefined,
    result: r.result ?? undefined,
    qualified: r.qualified ?? undefined,
    opportunityId: r.opportunity_id ?? undefined,
    origin: r.origin ?? undefined,
    createdAt: Date.parse(r.created_at),
  }))
}

export async function deleteSubmission(id: string) {
  const { error } = await db.from('crm_form_submissions').delete().eq('id', id)
  if (error) fail(error)
}

/** O trecho que vai no widget HTML do Elementor, no lugar do formulário do WordPress. */
export const embedOf = (form: Pick<CrmForm, 'id' | 'teamId'>) =>
  `<link rel="preconnect" href="${SUPABASE_URL}" crossorigin>\n<div data-avence-form="${form.id}" data-config="${configUrl(form.teamId, form.id)}" data-endpoint="${FORMS_ENDPOINT}"></div>\n<script defer src="${formsScriptUrl()}"></script>`

/** CSV das respostas (uma coluna por pergunta, na ordem do formulário) para abrir no Excel. */
export function submissionsCsv(form: CrmForm, rows: FormSubmission[]): string {
  const labels: string[] = []
  for (const step of form.definition.steps) for (const field of step.fields) if (!labels.includes(field.label)) labels.push(field.label)
  const quiz = form.kind === 'quiz'
  const header = ['Data', 'Nome', 'E-mail', 'Telefone', ...labels, ...(quiz ? ['Pontos', 'Resultado', 'Qualificado'] : []), 'Origem']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((r) => {
    const byLabel = new Map(r.summary.map((s) => [s.label, s.value]))
    return [
      new Date(r.createdAt).toLocaleString('pt-BR'),
      r.name,
      r.email,
      r.phone,
      ...labels.map((l) => byLabel.get(l)),
      ...(quiz ? [r.score, r.result, r.qualified === undefined ? '' : r.qualified ? 'Sim' : 'Não'] : []),
      r.origin?.channel,
    ]
      .map(esc)
      .join(';')
  })
  return '﻿' + [header.map(esc).join(';'), ...lines].join('\r\n')
}

export interface FormTemplate {
  id: string
  name: string
  text: string
  definition: () => FormDefinition
  settings?: Partial<FormSettings>
}

const opt = (label: string, score?: number) => ({ id: newId('o'), label, score })

const NO = -10

/**
 * Lead de criação de site: as mesmas perguntas e regras da página de proposta da Avence
 * (`LP_RULES`, `src/features/avence/proposta.ts`). Loja virtual e verba até R$ 500 desqualificam
 * sozinhas (pontuação muito negativa); os demais sinais somam (máximo 14). A partir de 10 pontos o
 * lead é qualificado e vê o WhatsApp: um sinal fraco passa, dois reprovam (como na proposta). Abaixo
 * disso recebe uma resposta educada, sem o botão.
 */
function siteLeadDefinition(): FormDefinition {
  const pick = (title: string, label: string, options: [string, number][], extra: Partial<FormField> = {}): FormStep => ({
    id: newId('s'),
    title,
    fields: [{ id: newId('f'), type: 'choice', label, required: true, options: options.map(([text, score]) => opt(text, score)), ...extra }],
  })
  const siteId = newId('f')
  const hasSite = opt('Já tenho site', 1)
  return {
    kind: 'quiz',
    steps: [
      pick('O que o seu negócio faz?', 'Tipo de negócio', [
        ['Atende com hora marcada (saúde, advocacia, estética, contabilidade…)', 3],
        ['Presta outro serviço para clientes da região', 3],
        ['Vende pela internet (loja virtual)', NO],
        ['Ainda vou abrir o negócio', 0],
      ]),
      {
        id: newId('s'),
        title: 'Como está o seu site hoje?',
        fields: [
          { id: siteId, type: 'choice', label: 'Situação do site', required: true, options: [hasSite, opt('Só tenho Instagram', 1), opt('Ainda não tenho', 1)] },
          { id: newId('f'), type: 'short', label: 'Qual o endereço do site?', placeholder: 'seunegocio.com.br', showIf: { field: siteId, op: 'eq', value: hasSite.id } },
        ],
      },
      pick('Quanto você investe por mês em anúncios no Google ou no Instagram?', 'Investimento em anúncios', [
        ['Ainda não anuncio', 0],
        ['Até R$ 500', 1],
        ['De R$ 500 a R$ 2.000', 2],
        ['Mais de R$ 2.000', 3],
      ]),
      pick('Quanto pensa em investir no site? (valor único)', 'Investimento no site', [
        ['Até R$ 500', NO],
        ['De R$ 500 a R$ 1.500', 1],
        ['De R$ 1.500 a R$ 3.000', 3],
        ['Mais de R$ 3.000', 4],
      ]),
      pick('Quem decide sobre o site?', 'Quem decide', [
        ['Eu decido (dono ou sócio)', 2],
        ['Decido junto com outra pessoa', 1],
        ['Outra pessoa decide', 0],
      ]),
      pick('Quando você quer começar?', 'Prazo', [
        ['Este mês', 3],
        ['Nos próximos 3 meses', 2],
        ['Só estou pesquisando', 0],
      ]),
      {
        id: newId('s'),
        title: 'Para onde enviamos a proposta?',
        description: 'Usamos só para responder você.',
        fields: [
          { id: newId('f'), type: 'short', label: 'Seu nome', required: true, map: 'name', placeholder: 'Como podemos te chamar?' },
          { id: newId('f'), type: 'phone', label: 'WhatsApp com DDD', required: true, map: 'phone', placeholder: '(51) 99999-9999' },
          { id: newId('f'), type: 'short', label: 'Nome da empresa', placeholder: 'Opcional' },
          { id: newId('f'), type: 'long', label: 'Quer contar mais alguma coisa?', map: 'message', placeholder: 'Opcional' },
        ],
      },
    ],
    results: [
      { id: newId('r'), min: -100, title: 'Recebemos suas respostas', text: 'Vamos olhar com calma e, se fizer sentido para os dois lados, respondemos por aqui.', qualified: false },
      { id: newId('r'), min: 10, title: 'Vamos montar a sua proposta', text: 'Já temos o que precisamos. Continue no WhatsApp para combinar os próximos passos.', qualified: true },
    ],
  }
}

const SITE_LEAD_SETTINGS: Partial<FormSettings> = { submitLabel: 'Pedir proposta', autoAdvance: true, successTitle: 'Recebemos suas respostas', successText: 'Retornamos em breve.' }

/** Pontos de partida: a equipe edita tudo depois. */
export const TEMPLATES: FormTemplate[] = [
  {
    id: 'contato',
    name: 'Contato simples',
    text: 'Nome, WhatsApp, e-mail e mensagem. Para trocar o formulário padrão do WordPress.',
    definition: () => ({
      kind: 'form',
      results: [],
      steps: [
        {
          id: newId('s'),
          fields: [
            { id: newId('f'), type: 'short', label: 'Seu nome', required: true, map: 'name', placeholder: 'Como podemos te chamar?' },
            { id: newId('f'), type: 'phone', label: 'WhatsApp', required: true, map: 'phone', placeholder: '(51) 99999-9999' },
            { id: newId('f'), type: 'email', label: 'E-mail', map: 'email', placeholder: 'voce@empresa.com.br' },
            { id: newId('f'), type: 'long', label: 'Como podemos ajudar?', map: 'message' },
          ],
        },
      ],
    }),
    settings: { submitLabel: 'Enviar mensagem', successTitle: 'Mensagem enviada', successText: 'Retornamos pelo WhatsApp em breve.' },
  },
  {
    id: 'site',
    name: 'Lead de criação de site',
    text: 'Quiz que qualifica quem quer um site novo (negócio, anúncios, verba, decisão, prazo) e chama no WhatsApp. Só o lead qualificado dispara a conversão.',
    definition: () => siteLeadDefinition(),
    settings: SITE_LEAD_SETTINGS,
  },
  {
    id: 'qualificacao',
    name: 'Quiz de qualificação',
    text: 'Perguntas que pontuam o lead e separam quem está pronto de quem ainda não. Contato no final.',
    definition: () => ({
      kind: 'quiz',
      steps: [
        {
          id: newId('s'),
          title: 'Quanto você investe em anúncios por mês?',
          fields: [{ id: newId('f'), type: 'choice', label: 'Investimento mensal', required: true, options: [opt('Ainda não invisto', 0), opt('Até R$ 1.000', 1), opt('R$ 1.000 a R$ 5.000', 3), opt('Mais de R$ 5.000', 5)] }],
        },
        {
          id: newId('s'),
          title: 'Você já tem um site hoje?',
          fields: [{ id: newId('f'), type: 'yesno', label: 'Já tem site?', required: true, options: [{ id: 'sim', label: 'Sim', score: 2 }, { id: 'nao', label: 'Não', score: 1 }] }],
        },
        {
          id: newId('s'),
          title: 'Quando quer começar?',
          fields: [{ id: newId('f'), type: 'choice', label: 'Prazo', required: true, options: [opt('Só estou pesquisando', 0), opt('Nos próximos meses', 2), opt('Agora', 4)] }],
        },
        {
          id: newId('s'),
          title: 'Para onde enviamos o resultado?',
          description: 'Só usamos para responder você.',
          fields: [
            { id: newId('f'), type: 'short', label: 'Seu nome', required: true, map: 'name' },
            { id: newId('f'), type: 'phone', label: 'WhatsApp', required: true, map: 'phone' },
          ],
        },
      ],
      results: [
        { id: newId('r'), min: 0, title: 'Vamos entender seu momento', text: 'Ainda dá para melhorar a base. Enviamos um material para você começar.', qualified: false },
        { id: newId('r'), min: 6, title: 'Você está no ponto certo', text: 'Seu negócio já tem o que precisa para um site que gera conversas. Vamos falar.', ctaLabel: 'Falar agora', qualified: true },
      ],
    }),
    settings: { submitLabel: 'Ver meu resultado', autoAdvance: true },
  },
]

export const blankDefinition = (kind: 'form' | 'quiz'): FormDefinition => ({ kind, results: kind === 'quiz' ? [{ id: newId('r'), min: 0, title: 'Obrigado!', text: 'Em breve falamos com você.', qualified: true }] : [], steps: [{ id: newId('s'), fields: [] }] })
