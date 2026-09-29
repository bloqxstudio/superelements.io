import type { SectionElement } from '@/features/space/landingPage'

type JsonRecord = Record<string, unknown>

export type EditableWidgetType = 'heading' | 'text-editor' | 'button' | 'image' | 'html'

export interface EditableWidget extends SectionElement {
  widgetType: EditableWidgetType
  settings: JsonRecord | unknown[]
}

export type ContentPatch =
  | { field: 'title' | 'editor' | 'text' | 'html'; value: string }
  | { field: 'linkUrl' | 'imageUrl' | 'imageAlt'; value: string }

const isRecord = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value)

export const isEditableWidget = (element: SectionElement | null | undefined): element is EditableWidget =>
  !!element && ['heading', 'text-editor', 'button', 'image', 'html'].includes(element.widgetType ?? '')

export function findElement(elements: SectionElement[] | null, elementId: string): SectionElement | null {
  for (const element of elements ?? []) {
    if (element.id === elementId) return element
    const child = findElement(element.elements ?? null, elementId)
    if (child) return child
  }
  return null
}

/**
 * Altera somente o conteúdo do widget escolhido e mantém intacto o envelope
 * original do JSON (array, `content` ou `elements`) e todas as outras settings.
 */
export function updateElementContent(json: string, elementId: string, patch: ContentPatch): string | null {
  try {
    const document = JSON.parse(json) as unknown
    const root = Array.isArray(document)
      ? document
      : isRecord(document) && Array.isArray(document.content)
        ? document.content
        : isRecord(document) && Array.isArray(document.elements)
          ? document.elements
          : null
    if (!root) return null

    let changed = false
    const visit = (elements: unknown[]) => {
      for (const candidate of elements) {
        if (!isRecord(candidate)) continue
        if (candidate.id === elementId) {
          const settings = isRecord(candidate.settings) ? candidate.settings : {}
          candidate.settings = settings

          if (patch.field === 'linkUrl') {
            const link = isRecord(settings.link) ? settings.link : {}
            settings.link = { ...link, url: patch.value }
          } else if (patch.field === 'imageUrl' || patch.field === 'imageAlt') {
            const image = isRecord(settings.image) ? settings.image : {}
            settings.image = {
              ...image,
              [patch.field === 'imageUrl' ? 'url' : 'alt']: patch.value,
            }
          } else {
            settings[patch.field] = patch.value
          }
          changed = true
          return
        }
        if (Array.isArray(candidate.elements)) visit(candidate.elements)
        if (changed) return
      }
    }

    visit(root)
    return changed ? JSON.stringify(document) : null
  } catch {
    return null
  }
}

export const stringSetting = (element: SectionElement, key: string) => {
  const settings = isRecord(element.settings) ? element.settings : {}
  return typeof settings[key] === 'string' ? settings[key] : ''
}

export const nestedStringSetting = (element: SectionElement, key: string, nestedKey: string) => {
  const settings = isRecord(element.settings) ? element.settings : {}
  const nested = isRecord(settings[key]) ? settings[key] : {}
  return typeof nested[nestedKey] === 'string' ? nested[nestedKey] : ''
}
