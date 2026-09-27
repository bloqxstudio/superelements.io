import type { Brand, BrandFont } from '../designMd'
import type { ButtonSpec } from '../layers'
import { textKind, typographyGroups, type TextKind } from './classify'
import { clearResponsive, DEVICE_SUFFIXES, fontPx, isSet, readDims, sliderAt, slider, writeDims, type Settings } from './elementor'

/**
 * Tipografia da marca em cada grupo de texto do elemento: família e peso, e o
 * tratamento (caixa, espaçamento de letra, entrelinha) do papel do texto.
 * Tamanhos de fonte não mudam.
 */

interface Treatment {
  font?: BrandFont
  /** O papel tem estilo próprio na marca (não é a fonte de outro papel emprestada). */
  own: boolean
  weight?: number
  transform?: BrandFont['transform']
  letterSpacing?: number
  lineHeight?: number
}

function treatmentFor(kind: TextKind, fonts: Brand['fonts'], button?: ButtonSpec): Treatment {
  const { heading, body, label } = fonts
  if (kind === 'heading') return { font: heading ?? body, own: !!heading, ...pickStyle(heading) }
  if (kind === 'numeric') return { font: heading ?? body, own: !!heading, weight: heading?.weight }
  if (kind === 'body') return { font: body ?? heading, own: !!body, ...pickStyle(body) }
  const base = label ?? body ?? heading
  if (kind === 'label') return { font: base, own: !!label, ...pickStyle(label) }
  // Botão: o que o guia diz do botão vale mais que o estilo de rótulo; entrelinha não muda (altura do botão)
  return {
    font: base,
    own: !!label || !!button,
    weight: button?.weight ?? label?.weight,
    transform: button?.transform ?? label?.transform,
    letterSpacing: label?.letterSpacing,
  }
}

const pickStyle = (f?: BrandFont) => (f ? { weight: f.weight, transform: f.transform, letterSpacing: f.letterSpacing, lineHeight: f.lineHeight } : {})

/** Entrelinha atual como proporção do tamanho da fonte. */
function lineHeightAt(s: Settings, group: string, device: (typeof DEVICE_SUFFIXES)[number]): number | undefined {
  const v = sliderAt(s, `${group}_line_height`, device)
  if (!v) return undefined
  if (v.unit === 'px') {
    const size = fontPx(s, group, device)
    return size ? v.size / size : undefined
  }
  return v.size
}

/**
 * Textos do pack compensam a meia-entrelinha com margem negativa. Quando a
 * entrelinha muda, a margem acompanha, para o espaço visual continuar igual.
 */
function compensateMargins(s: Settings, group: string, lineHeight: number) {
  for (const d of DEVICE_SUFFIXES) {
    const key = `_margin${d}`
    const margin = readDims(s[key])
    if (!margin || (margin.top >= 0 && margin.bottom >= 0) || margin.unit !== 'px') continue
    const size = fontPx(s, group, d)
    const before = lineHeightAt(s, group, d)
    if (!size || before === undefined) continue
    const delta = ((lineHeight - before) * size) / 2
    const fix = (n: number) => (n < 0 ? Math.min(0, n - delta) : n)
    s[key] = writeDims({ ...margin, top: fix(margin.top), bottom: fix(margin.bottom) })
  }
}

export function applyTypography(s: Settings, widgetType: string | undefined, brand: Brand, buttonSpec?: ButtonSpec) {
  for (const group of typographyGroups(s)) {
    const kind = textKind(widgetType, group, s)
    const t = treatmentFor(kind, brand.fonts, kind === 'button' ? buttonSpec : undefined)
    if (!t.font && !t.own) continue

    if (t.font?.family && isSet(s[`${group}_font_family`])) s[`${group}_font_family`] = t.font.family
    // Peso, caixa e espaçamento só vêm do estilo do próprio papel: um rótulo não herda o peso do texto
    if (t.weight && (t.own || kind === 'heading' || kind === 'numeric')) s[`${group}_font_weight`] = String(t.weight)
    if (!t.own) continue

    if (t.transform) s[`${group}_text_transform`] = t.transform

    if (t.letterSpacing !== undefined) {
      const em = t.letterSpacing
      for (const d of DEVICE_SUFFIXES) {
        const size = fontPx(s, group, d)
        const key = `${group}_letter_spacing${d}`
        if (!size) {
          if (d === '') s[key] = slider(em, 'em')
          else delete s[key]
          continue
        }
        // Tracking positivo não vai para texto grande: abriria títulos de display
        if (em > 0 && size >= 40) continue
        s[key] = slider(+(em * size).toFixed(2), 'px')
      }
    }

    if (t.lineHeight !== undefined && kind !== 'numeric') {
      if (widgetType === 'heading' || widgetType === 'text-editor') compensateMargins(s, group, t.lineHeight)
      s[`${group}_line_height`] = slider(t.lineHeight, 'em')
      clearResponsive(s, `${group}_line_height`)
    }
  }
}
