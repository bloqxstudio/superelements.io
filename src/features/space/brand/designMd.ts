import { assetUrl, LOGO_VARIANTS, type BrandLogo, type BrandPhoto } from './assets'
import { oklch, parseColor } from './color'
import { readDesign, toDesignMd, type DesignFormat } from './designFormats'
import { googleFont } from './googleFonts'
import type { BrandLayers } from './layers'
import type { TextTransform } from './values'

/**
 * DESIGN.md do Space: front matter YAML com os valores da marca (cores, fontes
 * e cantos), que o código aplica em toda seção, e um corpo em Markdown com as
 * regras que não cabem em valor (voz, princípios de página), que vão para a
 * geração de texto.
 *
 *   ---
 *   name: Linha Norte
 *   colors:
 *     background: "#F3F0E9"
 *     primary: "#152017"
 *   fonts:
 *     heading: { family: Manrope, weight: 800 }
 *     body: { family: Manrope, weight: 400 }
 *   radius:
 *     card: 24px
 *     button: 9999px
 *   ---
 *   ## Voz
 *   - Clara, segura e sem superlativos vazios.
 *
 * Arquivos em outros formatos (Google Stitch, design tokens, CSS, guia em
 * texto livre) são lidos por `readDesign` e convertidos para este modelo.
 */

export interface BrandFont {
  family: string
  weight?: number
  /** Caixa do texto; ausente = a seção decide. */
  transform?: TextTransform
  /** em */
  letterSpacing?: number
  /** Proporção do tamanho da fonte (0.9, 1.5). */
  lineHeight?: number
}

export interface BrandColor {
  name: string
  /** #rrggbb */
  hex: string
}

export interface Brand {
  /** Muda quando o arquivo muda; serve de chave para refazer previews. */
  key: string
  name: string
  colors: BrandColor[]
  /** `label`: rótulos, texto de botão, navegação. */
  fonts: { heading?: BrandFont; body?: BrandFont; label?: BrandFont }
  /** Cantos em CSS (ex.: 24px). */
  radius: { card?: string; button?: string; input?: string; image?: string }
  /** Botões, cards, campos, divisores, sombra, imagens e movimento. */
  layers: BrandLayers
  /** Entra no lugar do logo do site nas seções. Endereços já completos. */
  logo?: BrandLogo
  /** Banco de fotos da marca. Endereços já completos. */
  photos: BrandPhoto[]
  /** Corpo do DESIGN.md: voz e regras de texto. */
  guidelines: string
}

export interface ParsedDesignMd {
  brand: Brand | null
  errors: string[]
  warnings: string[]
  /** O que a conversão fez ou deixou de fora. */
  notes: string[]
  format?: DesignFormat
  /** O arquivo reescrito no modelo do Space, quando ele veio em outro formato. */
  canonical: string | null
}

// djb2: basta para saber se o arquivo mudou
export const hash = (text: string) => {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function parseDesignMd(source: string): ParsedDesignMd {
  const fail = (message: string, format?: DesignFormat): ParsedDesignMd => ({
    brand: null,
    errors: [message],
    warnings: [],
    notes: [],
    format,
    canonical: null,
  })

  if (!source.trim()) return fail('O arquivo está vazio.')
  const read = readDesign(source)
  if (read.error) return fail(read.error, read.format)

  const { draft } = read
  const { heading, body, label } = draft.fonts
  if (!draft.colors.length && !heading && !body) {
    return fail('Não encontrei cores nem fontes no arquivo. Ele precisa citar ao menos uma cor (ex.: #152017) ou uma fonte.', read.format)
  }

  const warnings: string[] = []
  if (!draft.colors.length) warnings.push('Sem cores: as cores das seções ficam como estão.')
  else {
    const neutrals = draft.colors.map((c) => oklch(parseColor(c.hex)!)).filter((c) => c.c < 0.07)
    if (!neutrals.some((c) => c.l > 0.85)) warnings.push('Nenhuma cor clara e neutra (fundo): fundos claros vão usar a cor mais próxima da marca.')
    if (!neutrals.some((c) => c.l < 0.4)) warnings.push('Nenhuma cor escura e neutra (texto): textos escuros vão usar a cor mais próxima da marca.')
    if (draft.colors.length > 24) warnings.push(`O arquivo tem ${draft.colors.length} cores; todas entram na troca. Deixe só as da marca para um resultado mais fiel.`)
  }
  if (!heading && !body) warnings.push('Sem fontes: as fontes das seções ficam como estão.')
  for (const family of new Set([heading?.family, body?.family].filter(Boolean) as string[])) {
    if (!googleFont(family)) {
      warnings.push(`Não reconheci "${family}" no Google Fonts. Se ela não for de lá, o preview mostra uma fonte genérica e o site precisa ter a fonte instalada no Elementor.`)
    }
  }

  const { logo, photos } = draft
  if (logo) {
    if (!logo.onLight && !logo.onDark) warnings.push('O logo só tem o símbolo: ele entra no lugar do logo do site inteiro.')
    else if (!logo.onDark) warnings.push('Logo sem versão para fundo escuro (on-dark): em faixas escuras entra a mesma versão do fundo claro.')
    else if (!logo.onLight) warnings.push('Logo sem versão para fundo claro (on-light): em faixas claras entra a mesma versão do fundo escuro.')
  }

  const font = (f?: typeof heading): BrandFont | undefined => {
    if (!f) return undefined
    const { original: _original, ...rest } = f
    return rest
  }
  const brand: Brand = {
    key: hash(source),
    name: draft.name?.trim() || 'Marca',
    colors: draft.colors.map(({ name, hex }) => ({ name, hex })),
    fonts: { heading: font(heading), body: font(body), label: font(label) },
    radius: draft.radius,
    layers: draft.layers,
    logo: logo && { ...logo, ...Object.fromEntries(LOGO_VARIANTS.filter((v) => logo[v]).map((v) => [v, assetUrl(logo[v]!)])) },
    photos: photos.map((p) => ({ ...p, url: assetUrl(p.url) })),
    guidelines: [draft.description !== draft.body ? draft.description : undefined, draft.body].filter(Boolean).join('\n\n'),
  }

  return {
    brand,
    errors: [],
    warnings,
    notes: read.notes,
    format: read.format,
    canonical: read.format === 'space' ? null : toDesignMd(draft),
  }
}
