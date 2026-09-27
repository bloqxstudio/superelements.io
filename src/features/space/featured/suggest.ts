/**
 * Sugestões de título e descrição de SEO tiradas do próprio conteúdo da
 * página: o título principal e o primeiro parágrafo com corpo.
 */

/** Limites que o Google costuma mostrar sem cortar. */
export const SEO_TITLE_LIMIT = 60
export const DESCRIPTION_LIMIT = 155

type Element = { widgetType?: string; settings?: Record<string, unknown> | unknown[]; elements?: Element[] }

const plain = (html: string) =>
  new DOMParser()
    .parseFromString(html, 'text/html')
    .documentElement.textContent?.replace(/\s+/g, ' ')
    .trim() ?? ''

function walk(elements: Element[], visit: (el: Element, settings: Record<string, unknown>) => void) {
  for (const el of elements) {
    if (el.settings && !Array.isArray(el.settings)) visit(el, el.settings)
    if (el.elements?.length) walk(el.elements, visit)
  }
}

/** Título principal (o primeiro H1, ou o primeiro título) e o primeiro parágrafo de verdade. */
export function pageTexts(elements: unknown[]) {
  let h1: string | undefined
  let heading: string | undefined
  let paragraph: string | undefined
  walk(elements as Element[], (el, s) => {
    if (el.widgetType === 'heading' && typeof s.title === 'string') {
      const text = plain(s.title)
      if (!text) return
      heading ??= text
      if (s.header_size === 'h1') h1 ??= text
    }
    if (el.widgetType === 'text-editor' && typeof s.editor === 'string' && !paragraph) {
      const text = plain(s.editor)
      if (text.length >= 40) paragraph = text
    }
  })
  return { heading: h1 ?? heading, paragraph }
}

/** Corta no limite sem quebrar palavra, com reticências quando corta. */
export function clip(text: string, limit: number) {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '')}…`
}

export function suggestSeo(elements: unknown[], pageTitle: string, siteName?: string) {
  const { heading, paragraph } = pageTexts(elements)
  const base = heading && heading.length <= SEO_TITLE_LIMIT - 12 ? heading : pageTitle
  const withSite = siteName && `${base} | ${siteName}`.length <= SEO_TITLE_LIMIT ? `${base} | ${siteName}` : base
  return {
    seoTitle: clip(withSite, SEO_TITLE_LIMIT),
    description: paragraph ? clip(paragraph, DESCRIPTION_LIMIT) : '',
  }
}

/** Endereço a partir do título: minúsculas, sem acento, palavras com hífen. */
export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
