import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { updateElementSettings } from '@/features/space/editor/actions'
import { walk } from '@/features/space/components/components'
import { hookUrl } from '@/features/crm/leadOrigin'
import type { SectionNodeData, SpaceNode, SpacePage } from '@/types/space'

/**
 * Liga o formulário do Elementor ao CRM direto do projeto: põe a ação "Webhook" do Elementor Pro com o endereço
 * da conta (`lead-webhook`), com "dados avançados" para mandar os títulos dos campos, e campos ocultos de origem
 * (UTM, gclid, fbclid) que o plugin Connector preenche com de onde a visita veio. Vale na página quando ela é publicada.
 */

/** Campos ocultos que dizem de onde o lead veio (o Connector 0.4 preenche pelo nome). */
export const ORIGIN_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'referrer']

const HOOK_PATH = '/functions/v1/lead-webhook'

export interface LeadForm {
  sectionId: string
  elementId: string
  pageName: string
  /** O nome do formulário no Elementor */
  name: string
  /** Já manda para o CRM (qualquer chave) */
  linked: boolean
  /** Manda para o CRM com a chave desta conta */
  current: boolean
  /** Faltam campos de origem */
  missingOrigin: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

const settingsOf = (element: SectionElement) => (isRecord(element.settings) ? element.settings : {})

const fieldIds = (settings: Record<string, unknown>) => (Array.isArray(settings.form_fields) ? settings.form_fields.filter(isRecord).map((f) => String(f.custom_id ?? f.field_id ?? '')) : [])

/** Os formulários do Elementor nas seções das páginas do projeto */
export function findLeadForms(nodes: SpaceNode[], pages: SpacePage[], token: string | undefined): LeadForm[] {
  const pageOf = new Map<string, string>()
  for (const page of pages) for (const id of page.sectionIds) pageOf.set(id, page.name)
  const out: LeadForm[] = []
  for (const node of nodes) {
    if (node.type !== 'section') continue
    const elements = parseSectionElements((node.data as SectionNodeData).elementorJson) ?? []
    walk(elements, (element) => {
      if (element.elType !== 'widget' || element.widgetType !== 'form' || !element.id) return
      const settings = settingsOf(element)
      const url = typeof settings.webhooks === 'string' ? settings.webhooks : ''
      const actions = Array.isArray(settings.submit_actions) ? settings.submit_actions : []
      const linked = actions.includes('webhook') && url.includes(HOOK_PATH)
      const ids = fieldIds(settings)
      out.push({
        sectionId: node.id,
        elementId: element.id,
        pageName: pageOf.get(node.id) ?? 'Sem página',
        name: typeof settings.form_name === 'string' && settings.form_name ? settings.form_name : 'Formulário',
        linked,
        current: linked && !!token && url.includes(token),
        missingOrigin: ORIGIN_FIELDS.filter((id) => !ids.includes(id)),
      })
    })
  }
  return out
}

const newId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0')

/** Põe o webhook e os campos de origem no formulário (um passo no desfazer). */
export function linkLeadForm(form: LeadForm, nodes: SpaceNode[], token: string): boolean {
  const node = nodes.find((n) => n.id === form.sectionId)
  const elements = node ? parseSectionElements((node.data as SectionNodeData).elementorJson) ?? [] : []
  let target: SectionElement | undefined
  walk(elements, (element) => {
    if (element.id === form.elementId) target = element
  })
  if (!target) return false
  const settings = settingsOf(target)
  const actions = Array.isArray(settings.submit_actions) ? (settings.submit_actions as string[]) : ['email']
  const fields = Array.isArray(settings.form_fields) ? [...settings.form_fields] : []
  const have = new Set(fieldIds(settings))
  for (const id of ORIGIN_FIELDS) {
    if (have.has(id)) continue
    fields.push({ custom_id: id, field_type: 'hidden', field_label: id, field_value: '', width: '100', _id: newId() })
  }
  return updateElementSettings(
    form.sectionId,
    form.elementId,
    {
      submit_actions: actions.includes('webhook') ? actions : [...actions, 'webhook'],
      webhooks: hookUrl(token),
      webhooks_advanced_data: 'yes',
      form_fields: fields,
    },
    { device: 'desktop', pin: false }
  )
}
