import type { Brand } from '@/features/space/brand/designMd'
import { parseColor, contrast } from '@/features/space/brand/color'
import type { SetBrand } from './types'

/** A marca de um projeto do Space no tamanho que o conjunto precisa. */
export function setBrandFrom(brand: Brand | null, fallbackName: string): SetBrand {
  return {
    name: brand?.name || fallbackName,
    colors: brand?.colors.map((c) => ({ name: c.name, hex: c.hex })) ?? [],
    headingFont: brand?.fonts.heading?.family ?? 'Inter',
    bodyFont: brand?.fonts.body?.family ?? brand?.fonts.heading?.family ?? 'Inter',
    logoOnLight: brand?.logo?.onLight ?? brand?.logo?.symbol,
    logoOnDark: brand?.logo?.onDark ?? brand?.logo?.symbolOnDark,
  }
}

const lum = (hex: string) => {
  const c = parseColor(hex)
  return c ? 0.299 * c.r + 0.587 * c.g + 0.114 * c.b : 128
}
const sat = (hex: string) => {
  const c = parseColor(hex)
  if (!c) return 0
  const max = Math.max(c.r, c.g, c.b)
  const min = Math.min(c.r, c.g, c.b)
  return max === 0 ? 0 : (max - min) / max
}

export interface Palette {
  /** O mais escuro: fundo escuro e texto sobre o claro. */
  ink: string
  /** O mais claro: fundo claro e texto sobre o escuro. */
  paper: string
  /** O mais saturado: botão, destaque. */
  accent: string
  /** Texto sobre o destaque. */
  onAccent: string
  muted: string
}

/** Escolhe tinta, papel e destaque entre as cores da marca; sem marca, um padrão neutro. */
export function paletteOf(brand: SetBrand): Palette {
  const hexes = brand.colors.map((c) => parseColor(c.hex) && c.hex).filter((h): h is string => !!h)
  const byLum = [...hexes].sort((a, b) => lum(a) - lum(b))
  const ink = byLum[0] && lum(byLum[0]) < 110 ? byLum[0] : '#111111'
  const paper = byLum.at(-1) && lum(byLum.at(-1)!) > 190 ? byLum.at(-1)! : '#f3f1ec'
  const accent = [...hexes].filter((h) => h !== ink && h !== paper).sort((a, b) => sat(b) - sat(a))[0] ?? '#2b3cf0'
  const a = parseColor(accent)!
  const onAccent = contrast(a, parseColor('#ffffff')!) >= contrast(a, parseColor(ink)!) ? '#ffffff' : ink
  return { ink, paper, accent, onAccent, muted: lum(paper) > 128 ? '#66625a' : '#9d998f' }
}
