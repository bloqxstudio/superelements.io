/**
 * O texto dos blocos: HTML com só negrito, itálico, sublinhado, link e quebra de
 * linha. Tudo o que entra (digitado, colado, vindo de um agente ou de outra
 * pessoa) passa por `clean`, que apaga qualquer outra tag e atributo.
 */

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'BR'])

export const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const safeUrl = (url: string) => (/^(https?:\/\/|mailto:|tel:)/i.test(url.trim()) ? url.trim() : '')

/** Apaga o que não é do conjunto permitido; o texto dos elementos apagados fica. */
export function clean(html: string): string {
  if (typeof DOMParser === 'undefined') return escapeHtml(html.replace(/<[^>]*>/g, ''))
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const inner = [...el.childNodes].map(walk).join('')
    if (!ALLOWED.has(el.tagName)) return el.tagName === 'DIV' || el.tagName === 'P' ? `${inner}<br>` : inner
    if (el.tagName === 'BR') return '<br>'
    if (el.tagName === 'A') {
      const href = safeUrl(el.getAttribute('href') ?? '')
      return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner
    }
    const tag = el.tagName === 'STRONG' ? 'b' : el.tagName === 'EM' ? 'i' : el.tagName.toLowerCase()
    return `<${tag}>${inner}</${tag}>`
  }
  return [...doc.body.childNodes].map(walk).join('').replace(/(<br>)+$/g, '')
}

/** O texto que um agente escreve (**negrito**, *itálico*, [texto](endereço)) vira HTML seguro. */
export function markToHtml(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) => (safeUrl(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : label))
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<i>$2</i>')
  return out.replace(/\n/g, '<br>')
}

/** O inverso: o HTML do bloco como o agente lê (e escreve). */
export function htmlToMark(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_m, url: string, label: string) => `[${label.replace(/<[^>]*>/g, '')}](${url.replace(/&amp;/g, '&')})`)
    .replace(/<(b|strong)>(.*?)<\/\1>/gi, '**$2**')
    .replace(/<(i|em)>(.*?)<\/\1>/gi, '*$2*')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}
