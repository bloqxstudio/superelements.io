import { parseColor } from '@/features/space/brand/color'
import type { SiteLogo } from './site'
import type { SiteKit } from './siteKitStore'

/** Cores de sistema do Elementor, com o nome que o Space entende como papel da cor. */
const SYSTEM_COLORS = ['primary', 'secondary', 'text', 'accent']

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')

/** Hex de 6 dígitos; o Elementor guarda hex com ou sem alfa, ou rgba(). */
function toHex(value: string): string | null {
  const color = parseColor(value.trim())
  return color ? `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`.toUpperCase() : null
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const quote = (text: string) => JSON.stringify(text)

/**
 * DESIGN.md do Space a partir do Kit do site: as quatro cores de sistema com o
 * papel delas, as cores personalizadas pelo nome que têm no Elementor, e as
 * fontes de título (Primary), corpo (Text) e rótulo (Accent).
 */
export function designMdFromSite(siteName: string, kit: SiteKit, logo: SiteLogo | null): string {
  const lines = ['---', `name: ${quote(siteName)}`, `description: ${quote(`Marca do site ${kit.siteUrl}, lida das cores e fontes globais do Elementor.`)}`]
  lines.push(`source: ${quote(`${kit.siteUrl} (Elementor), em ${new Date(kit.importedAt).toLocaleDateString('pt-BR')}`)}`)

  const used = new Set<string>()
  const colorLines: string[] = []
  const ordered = [...SYSTEM_COLORS.filter((id) => kit.colors[id]), ...Object.keys(kit.colors).filter((id) => !SYSTEM_COLORS.includes(id))]
  for (const id of ordered) {
    const hex = toHex(kit.colors[id])
    if (!hex) continue
    let name = SYSTEM_COLORS.includes(id) ? id : slug(kit.titles[id] ?? '') || `cor-${id}`
    while (used.has(name)) name = `${name}-2`
    used.add(name)
    colorLines.push(`  ${name}: "${hex}"`)
  }
  if (colorLines.length) lines.push('colors:', ...colorLines)

  const fontLine = (role: string, id: string) => {
    const font = kit.typography[id]
    if (!font?.family) return null
    return `  ${role}: { family: ${quote(font.family)}${font.weight ? `, weight: ${font.weight}` : ''} }`
  }
  const fonts = [fontLine('heading', 'primary'), fontLine('body', 'text'), fontLine('label', 'accent')].filter(Boolean) as string[]
  if (fonts.length) lines.push('fonts:', ...fonts)

  if (logo) {
    lines.push('logo:', `  on-light: ${quote(logo.url)}`)
    if (logo.alt) lines.push(`  alt: ${quote(logo.alt)}`)
  }

  lines.push(
    '---',
    '',
    '## Origem',
    '',
    `Cores e fontes globais do Elementor de ${kit.siteUrl}. Os nomes das cores personalizadas são os do Elementor; ajuste-os e escreva aqui a voz da marca.`,
    ''
  )
  return lines.join('\n')
}
