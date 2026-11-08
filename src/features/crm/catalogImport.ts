/**
 * Lê um catálogo de produtos colado ou enviado (CSV ou JSON) para o campo "Encontrar produto" dos
 * formulários (2026-11-07, pedido da Vizor). Sem imports: roda no app e nos testes do Node.
 *
 * CSV: a primeira linha diz as colunas, em português ou inglês: marca/brand, modelo/model, ano/year,
 * nome/produto/name, imagem/foto/image, link/url/pagina, id/sku/num, e qualquer coluna que comece com
 * "código"/"code" vira uma variação (ex.: "código brilho" → Brilho). Separador vírgula, ponto e vírgula
 * ou tab. JSON: uma lista de objetos com os mesmos nomes, ou `{ items, brands }`.
 */

export interface ImportedItem { id: string; brand: string; model: string; year?: string; name?: string; image?: string; url?: string; codes?: { label: string; code: string }[] }
export interface ImportedCatalog { items: ImportedItem[]; brands: { name: string; logo?: string }[]; skipped: number }

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const ALIASES: Record<string, string[]> = {
  id: ['id', 'sku', 'num', 'numero', 'codigo interno', 'ref'],
  brand: ['marca', 'brand', 'fabricante'],
  model: ['modelo', 'model', 'moto', 'veiculo'],
  year: ['ano', 'anos', 'year', 'years'],
  name: ['nome', 'produto', 'name', 'titulo', 'title'],
  image: ['imagem', 'foto', 'image', 'image_url', 'img', 'imagem_url', 'foto_url'],
  url: ['link', 'url', 'pagina', 'page', 'product_url'],
  logo: ['logo', 'logo_marca', 'brand_logo'],
}
const keyOf = (header: string): string | undefined => {
  const h = plain(header).replace(/[\s-]+/g, '_')
  for (const [k, list] of Object.entries(ALIASES)) if (list.some((a) => a.replace(/\s+/g, '_') === h)) return k
  if (/^(codigo|code|cod)(_|$)/.test(h)) return 'code'
  return undefined
}
const codeLabel = (header: string) => {
  const rest = header.trim().replace(/^(c[oó]digo|code|cod)\.?[\s_-]*/i, '').replace(/_/g, ' ').trim()
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : 'Código'
}
const https = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v.trim()) ? v.trim() : undefined)
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

function splitCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const sep = [';', '\t', ','].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

function fromObjects(list: Record<string, unknown>[]): ImportedCatalog {
  const items: ImportedItem[] = []
  const logos = new Map<string, string>()
  let skipped = 0
  list.forEach((o, n) => {
    const get: Record<string, string> = {}
    const codes: { label: string; code: string }[] = []
    for (const [k, v] of Object.entries(o)) {
      const key = keyOf(k)
      if (key === 'code') { if (str(v)) codes.push({ label: codeLabel(k), code: str(v) }) }
      else if (key && str(v)) get[key] = str(v)
    }
    // JSON já no formato do campo (`codes: [{label, code}]`)
    if (Array.isArray(o.codes)) for (const c of o.codes as Record<string, unknown>[]) if (str(c?.code)) codes.push({ label: str(c.label) || 'Código', code: str(c.code) })
    if (!get.brand || !get.model) { skipped++; return }
    if (get.logo && https(get.logo)) logos.set(get.brand, get.logo)
    items.push({
      id: get.id || `p${n + 1}`, brand: get.brand, model: get.model, year: get.year || undefined, name: get.name || undefined,
      image: https(get.image), url: https(get.url), codes: codes.length ? codes : undefined,
    })
  })
  const brands = [...new Set(items.map((i) => i.brand))].map((name) => ({ name, logo: logos.get(name) }))
  return { items, brands, skipped }
}

export function parseCatalog(text: string): ImportedCatalog {
  const t = text.trim()
  if (!t) return { items: [], brands: [], skipped: 0 }
  if (t.startsWith('[') || t.startsWith('{')) {
    const data = JSON.parse(t) as unknown
    if (Array.isArray(data)) return fromObjects(data as Record<string, unknown>[])
    const o = data as { items?: unknown; brands?: unknown }
    const got = fromObjects(Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [])
    const given = Array.isArray(o.brands) ? (o.brands as Record<string, unknown>[]).map((b) => ({ name: str(b?.name), logo: https(b?.logo) })).filter((b) => b.name) : []
    const names = new Set(given.map((b) => b.name.toLowerCase()))
    return { ...got, brands: [...given, ...got.brands.filter((b) => !names.has(b.name.toLowerCase()))] }
  }
  const [head, ...rows] = splitCsv(t)
  return fromObjects(rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))))
}

/** O catálogo de volta em CSV (para baixar, corrigir na planilha e importar de novo). */
export function catalogCsv(items: ImportedItem[]): string {
  const labels = [...new Set(items.flatMap((i) => (i.codes ?? []).map((c) => c.label)))]
  const head = ['id', 'marca', 'modelo', 'ano', 'nome', 'imagem', 'link', ...labels.map((l) => `código ${l.toLowerCase()}`)]
  const esc = (v: string | undefined) => {
    const s = v ?? ''
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = items.map((i) => [i.id, i.brand, i.model, i.year, i.name, i.image, i.url, ...labels.map((l) => i.codes?.find((c) => c.label === l)?.code)].map(esc).join(';'))
  return [head.join(';'), ...lines].join('\n')
}
