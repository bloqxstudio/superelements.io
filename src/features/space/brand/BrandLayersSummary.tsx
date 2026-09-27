import React from 'react'
import type { Brand, BrandFont } from './designMd'
import { filterCss, type ButtonSpec } from './layers'
import { shadowCss, strokeCss, type Shadow, type Stroke } from './values'

/**
 * O que a marca muda nas seções, camada por camada. O que o guia não define
 * aparece como "a seção mantém", para ficar claro que nada foi inventado.
 */

const KEEP = 'a seção mantém'

const TRANSFORM: Record<string, string> = { uppercase: 'caixa alta', lowercase: 'caixa baixa', capitalize: 'iniciais maiúsculas', none: 'frase comum' }
const ENTRANCE: Record<string, string> = { none: 'nenhuma', fade: 'fade', 'fade-up': 'fade subindo', 'fade-down': 'fade descendo', 'slide-up': 'deslizar para cima', zoom: 'zoom' }
const HOVER: Record<string, string> = { none: 'nenhum', lift: 'sobe', grow: 'cresce' }

const fontText = (f?: BrandFont) =>
  f
    ? [
        `${f.family}${f.weight ? ` ${f.weight}` : ''}`,
        f.transform && TRANSFORM[f.transform],
        f.letterSpacing !== undefined && `tracking ${+f.letterSpacing.toFixed(3)}em`,
        f.lineHeight !== undefined && `entrelinha ${f.lineHeight}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

const stroke = (s?: Stroke | 'none') => (s === undefined ? undefined : s === 'none' ? 'sem borda' : strokeCss(s))
const shadow = (s?: Shadow | 'none') => (s === undefined ? undefined : s === 'none' ? 'nenhuma' : shadowCss(s))

const Swatch: React.FC<{ color?: string }> = ({ color }) =>
  color && color !== 'transparent' ? <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/15 align-middle" style={{ backgroundColor: color }} /> : null

const buttonText = (b?: ButtonSpec) =>
  b ? (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Swatch color={b.background} />
      {b.background === 'transparent' ? 'transparente' : b.background}
      {b.text && (
        <>
          <span className="text-muted-foreground">/</span>
          <Swatch color={b.text} /> {b.text}
        </>
      )}
      {b.border && <span className="text-muted-foreground">· {stroke(b.border)}</span>}
      {b.radius && <span className="text-muted-foreground">· canto {b.radius}</span>}
    </span>
  ) : undefined

interface Row {
  label: string
  value?: React.ReactNode
}

const Section: React.FC<{ title: string; rows: Row[] }> = ({ title, rows }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {rows.map((r) => (
        <React.Fragment key={r.label}>
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className={r.value === undefined ? 'text-muted-foreground/70 italic' : ''}>{r.value ?? KEEP}</dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
)

export const BrandLayersSummary: React.FC<{ brand: Brand }> = ({ brand }) => {
  const { fonts, radius, layers } = brand
  const m = layers.motion
  return (
    <div className="space-y-4">
      {brand.colors.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cores</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {brand.colors.map((c) => (
              <li key={c.name} className="flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1" title={c.hex}>
                <span className="h-4 w-4 rounded-sm border border-black/10" style={{ backgroundColor: c.hex }} />
                <span>{c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Section
        title="Tipografia"
        rows={[
          { label: 'Títulos', value: fontText(fonts.heading ?? fonts.body) },
          { label: 'Texto', value: fontText(fonts.body ?? fonts.heading) },
          { label: 'Rótulos', value: fontText(fonts.label) },
        ]}
      />
      <Section
        title="Forma"
        rows={[
          { label: 'Cards', value: radius.card },
          { label: 'Botões', value: radius.button },
          { label: 'Campos', value: radius.input },
          { label: 'Imagens', value: radius.image },
        ]}
      />
      <Section
        title="Botões"
        rows={[
          { label: 'Principal', value: buttonText(layers.buttons?.primary) },
          { label: 'Secundário', value: buttonText(layers.buttons?.secondary) },
        ]}
      />
      <Section
        title="Superfícies"
        rows={[
          { label: 'Sombra', value: shadow(layers.cards?.shadow ?? layers.shadow) },
          { label: 'Fundo de card', value: layers.cards?.background && <span className="inline-flex items-center gap-1"><Swatch color={layers.cards.background} />{layers.cards.background}</span> },
          { label: 'Borda de card', value: stroke(layers.cards?.border) },
          { label: 'Vidro', value: layers.cards?.blur ? `desfoque de ${layers.cards.blur}px sobre fotos` : undefined },
          { label: 'Divisores', value: stroke(layers.divider) },
          { label: 'Campos', value: layers.inputs && [layers.inputs.underline ? 'só linha de baixo' : stroke(layers.inputs.border), layers.inputs.background === 'transparent' ? 'transparente' : layers.inputs.background].filter(Boolean).join(' · ') },
          { label: 'Imagens', value: layers.images?.filter && filterCss(layers.images.filter) },
        ]}
      />
      <Section
        title="Movimento"
        rows={[
          { label: 'Entrada', value: m?.entrance && [ENTRANCE[m.entrance], m.duration && `${m.duration}ms`, m.stagger && `escalonada em ${m.stagger}ms`].filter(Boolean).join(' · ') },
          { label: 'Curva', value: m?.easing },
          { label: 'Hover', value: (m?.hover || m?.cardHover) && [m.hover && `botões: ${HOVER[m.hover]}`, (m.cardHover ?? m.hover) && `cards: ${HOVER[(m.cardHover ?? m.hover)!]}`].filter(Boolean).join(' · ') },
        ]}
      />
    </div>
  )
}
