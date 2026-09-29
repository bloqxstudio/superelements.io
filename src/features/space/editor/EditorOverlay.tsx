import React, { useRef, useState } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionElement } from '@/features/space/landingPage'
import type { BridgeBox, BridgeGeometry, BridgeIndicator, BridgeRect } from '@/features/elementor-preview/editorBridge'
import { updateElementSettings } from './actions'
import { gapValue, sidesValue, sliderValue, styleKeys, type Sides } from './settingsModel'
import { settingsOf } from './tree'

/**
 * Seleção, destaque e alças por cima do preview de uma seção, desenhados pelo
 * canvas com as caixas que a ponte do iframe mede. As linhas têm a mesma
 * espessura na tela em qualquer zoom; as alças mudam padding, gap, largura e
 * altura arrastando, gravando na tela escolhida (desktop, tablet, celular).
 */

const VIOLET = '#7c3aed'
const PADDING_TINT = 'rgba(236, 72, 153, 0.18)'
const GAP_TINT = 'rgba(124, 58, 237, 0.16)'

type HandleKind = 'pad-top' | 'pad-right' | 'pad-bottom' | 'pad-left' | 'gap' | 'width' | 'height'

interface EditorOverlayProps {
  sectionId: string
  /** px da tela do nó por px do iframe (encaixe da seção na largura do cartão). */
  scale: number
  geometry: BridgeGeometry | null
  /** Linha de onde o elemento arrastado vai entrar. */
  indicator: BridgeIndicator | null
  /** Camada selecionada no JSON de base, para saber que alças ela tem. */
  element: SectionElement | null
  label: string
  hoverLabel: string
}

const snap = (value: number, fine: boolean) => Math.max(0, fine ? Math.round(value / 8) * 8 : Math.round(value))

export const EditorOverlay: React.FC<EditorOverlayProps> = ({ sectionId, scale, geometry, indicator, element, label, hoverLabel }) => {
  const zoom = useSpaceStore((s) => s.canvasTransform.zoom)
  const [active, setActive] = useState<{ kind: HandleKind; text: string } | null>(null)
  const [focusKind, setFocusKind] = useState<HandleKind | null>(null)
  const frame = useRef(0)
  // Chave do arrasto em curso: o arrasto inteiro vira um passo só do desfazer
  const dragMerge = useRef('')

  const px = (screen: number) => screen / zoom
  const at = (r: BridgeRect): React.CSSProperties => ({ position: 'absolute', left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale })

  const selected = geometry?.selected ?? null
  const hover = geometry?.hover ?? null
  const family = element?.elType ?? ''
  const settings = settingsOf(element)
  const keys = element ? styleKeys(element) : null
  const isBlock = family === 'container' || family === 'column'
  const canWidth = !!selected && (family === 'widget' || (family === 'container' && settings.content_width === 'full'))
  const canHeight = !!selected && (family === 'container' || element?.widgetType === 'image' || element?.widgetType === 'spacer')
  const flowing = !!selected && selected.children.length > 1 && (selected.display.includes('flex') || selected.display.includes('grid'))
  const row = !!selected && (selected.display.includes('grid') || selected.direction.startsWith('row'))

  /** Arrasto de uma alça: um passo só no desfazer, aplicado no máximo uma vez por quadro. */
  const startDrag = (kind: HandleKind, event: React.PointerEvent, apply: (dx: number, dy: number, fine: boolean, all: boolean, mirror: boolean) => string) => {
    if (!selected || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    const start = { x: event.clientX, y: event.clientY }
    const k = scale * zoom
    dragMerge.current = `handle:${selected.id}:${kind}:${Date.now()}`
    let last: PointerEvent | null = null
    const run = () => {
      frame.current = 0
      if (!last) return
      const text = apply((last.clientX - start.x) / k, (last.clientY - start.y) / k, last.shiftKey, last.altKey, last.shiftKey)
      setActive({ kind, text })
    }
    const move = (ev: PointerEvent) => {
      last = ev
      if (!frame.current) frame.current = requestAnimationFrame(run)
    }
    let finished = false
    const up = () => {
      if (finished) return
      finished = true
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      target.removeEventListener('lostpointercapture', up)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      if (last) run()
      setActive(null)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
    // Se o navegador tirar a captura (janela perdeu o foco), o arrasto termina aqui
    target.addEventListener('lostpointercapture', up)
  }

  const write = (patch: Record<string, unknown>) => {
    if (!selected) return
    updateElementSettings(sectionId, selected.id, patch, { merge: dragMerge.current })
  }

  const padHandle = (kind: HandleKind, side: 0 | 1 | 2 | 3) => (event: React.PointerEvent) => {
    if (!selected || !keys) return
    const startSides = [...selected.padding] as Sides
    startDrag(kind, event, (dx, dy, fine, all, mirror) => {
      const delta = side === 0 ? dy : side === 1 ? -dx : side === 2 ? -dy : dx
      const value = snap(startSides[side] + delta, fine && !mirror)
      const next = [...startSides] as Sides
      if (all) next.fill(value)
      else {
        next[side] = value
        if (mirror) next[(side + 2) % 4] = value
      }
      write({ [keys.padding]: sidesValue(next.map((n) => Math.round(n)) as Sides) })
      return all ? `Padding ${value}` : `${['Cima', 'Direita', 'Baixo', 'Esquerda'][side]} ${value}`
    })
  }

  const gapHandle = (event: React.PointerEvent) => {
    if (!selected) return
    const startGap = row ? selected.gap[1] : selected.gap[0]
    const grid = selected.display.includes('grid')
    startDrag('gap', event, (dx, dy, fine) => {
      const value = snap(startGap + (row ? dx : dy), fine)
      write({ [grid ? 'grid_gaps' : 'flex_gap']: gapValue(value) })
      return `Gap ${value}`
    })
  }

  const widthHandle = (event: React.PointerEvent) => {
    if (!selected) return
    const startWidth = selected.rect.w
    startDrag('width', event, (dx, _dy, fine) => {
      const value = Math.max(8, snap(startWidth + dx, fine))
      write(family === 'widget' ? { _element_width: 'initial', _element_custom_width: sliderValue(value) } : { width: sliderValue(value) })
      return `L ${value}`
    })
  }

  const heightHandle = (event: React.PointerEvent) => {
    if (!selected) return
    const startHeight = selected.rect.h
    const type = element?.widgetType
    startDrag('height', event, (_dx, dy, fine) => {
      const value = Math.max(8, snap(startHeight + dy, fine))
      if (type === 'image') write({ height: sliderValue(value), ...(settings['object-fit'] ? {} : { 'object-fit': 'cover' }) })
      else if (type === 'spacer') write({ space: sliderValue(value) })
      else write({ min_height: sliderValue(value) })
      return `A ${value}`
    })
  }

  const line = px(1.5)
  const handleSize = px(9)
  const showPadding = focusKind?.startsWith('pad') || active?.kind.startsWith('pad')
  const showGap = focusKind === 'gap' || active?.kind === 'gap'

  const paddingBands = (box: BridgeBox): BridgeRect[] => {
    const r = box.rect
    const [t, rt, b, l] = box.padding
    return [
      { x: r.x, y: r.y, w: r.w, h: t },
      { x: r.x + r.w - rt, y: r.y, w: rt, h: r.h },
      { x: r.x, y: r.y + r.h - b, w: r.w, h: b },
      { x: r.x, y: r.y, w: l, h: r.h },
    ]
  }

  const gapZones = (box: BridgeBox): BridgeRect[] => {
    const zones: BridgeRect[] = []
    for (let i = 0; i < box.children.length - 1; i++) {
      const a = box.children[i]
      const b = box.children[i + 1]
      if (row && Math.abs(a.y - b.y) < 2) zones.push({ x: a.x + a.w, y: Math.min(a.y, b.y), w: Math.max(0, b.x - a.x - a.w), h: Math.max(a.h, b.h) })
      else if (!row) zones.push({ x: Math.min(a.x, b.x), y: a.y + a.h, w: Math.max(a.w, b.w), h: Math.max(0, b.y - a.y - a.h) })
    }
    return zones
  }

  const handleStyle = (cx: number, cy: number, w: number, h: number, cursor: string): React.CSSProperties => ({
    position: 'absolute',
    left: cx * scale - w / 2,
    top: cy * scale - h / 2,
    width: w,
    height: h,
    cursor,
    pointerEvents: 'auto',
    background: '#fff',
    border: `${line}px solid ${VIOLET}`,
    borderRadius: px(3),
    touchAction: 'none',
  })

  const tagFont = px(11)
  const tagHeight = px(18)

  return (
    <div className="absolute inset-0" aria-hidden>
      {hover && (
        <div style={{ ...at(hover.rect), outline: `${px(1)}px solid rgba(124, 58, 237, 0.7)`, outlineOffset: 0 }}>
          {hoverLabel && !selected && (
            <span
              style={{ position: 'absolute', left: 0, top: -tagHeight - px(2), height: tagHeight, fontSize: tagFont, lineHeight: `${tagHeight}px`, padding: `0 ${px(5)}px`, borderRadius: px(4) }}
              className="whitespace-nowrap bg-violet-500/90 font-medium text-white"
            >
              {hoverLabel}
            </span>
          )}
        </div>
      )}

      {selected && showPadding && paddingBands(selected).map((band, i) => <div key={i} style={{ ...at(band), background: PADDING_TINT }} />)}
      {selected && showGap && gapZones(selected).map((zone, i) => <div key={i} style={{ ...at(zone), background: GAP_TINT }} />)}

      {selected && (
        <div style={{ ...at(selected.rect), outline: `${line}px solid ${VIOLET}` }}>
          <span
            style={{
              position: 'absolute',
              left: -line,
              top: selected.rect.y * scale * zoom < 22 ? `calc(100% + ${px(3)}px)` : -tagHeight - px(3),
              height: tagHeight,
              fontSize: tagFont,
              lineHeight: `${tagHeight}px`,
              padding: `0 ${px(6)}px`,
              borderRadius: px(4),
            }}
            className="whitespace-nowrap bg-violet-600 font-semibold text-white shadow-sm"
          >
            {label}
            <span className="font-normal text-violet-200"> · {Math.round(selected.rect.w)} × {Math.round(selected.rect.h)}</span>
          </span>
        </div>
      )}

      {selected && isBlock && keys && (
        <>
          {([0, 1, 2, 3] as const).map((side) => {
            const r = selected.rect
            const p = selected.padding
            const kind = (['pad-top', 'pad-right', 'pad-bottom', 'pad-left'] as const)[side]
            const vertical = side === 0 || side === 2
            // No meio da faixa de padding; faixa fina demais põe a alça na borda de dentro
            const cx = side === 1 ? r.x + r.w - p[1] / 2 : side === 3 ? r.x + p[3] / 2 : r.x + r.w / 2
            const cy = side === 0 ? r.y + p[0] / 2 : side === 2 ? r.y + r.h - p[2] / 2 : r.y + r.h / 2
            return (
              <div
                key={kind}
                title={`Arraste para mudar o padding. Shift: dos dois lados. Alt: de todos.`}
                onPointerDown={padHandle(kind, side)}
                onPointerEnter={() => setFocusKind(kind)}
                onPointerLeave={() => setFocusKind(null)}
                style={{ ...handleStyle(cx, cy, vertical ? px(16) : px(5), vertical ? px(5) : px(16), vertical ? 'ns-resize' : 'ew-resize'), background: 'rgb(236 72 153)', border: `${px(1)}px solid #fff` }}
              />
            )
          })}
        </>
      )}

      {selected && flowing &&
        (() => {
          const zone = gapZones(selected)[0]
          if (!zone) return null
          return (
            <div
              title="Arraste para mudar o espaço entre os itens. Shift: de 8 em 8."
              onPointerDown={gapHandle}
              onPointerEnter={() => setFocusKind('gap')}
              onPointerLeave={() => setFocusKind(null)}
              style={{ ...handleStyle(zone.x + zone.w / 2, zone.y + zone.h / 2, row ? px(5) : px(16), row ? px(16) : px(5), row ? 'ew-resize' : 'ns-resize'), background: VIOLET, border: `${px(1)}px solid #fff` }}
            />
          )
        })()}

      {selected && canWidth && (
        <div
          title="Arraste para mudar a largura. Shift: de 8 em 8."
          onPointerDown={widthHandle}
          style={handleStyle(selected.rect.x + selected.rect.w, selected.rect.y + selected.rect.h / 2, handleSize, handleSize, 'ew-resize')}
        />
      )}
      {selected && canHeight && (
        <div
          title="Arraste para mudar a altura. Shift: de 8 em 8."
          onPointerDown={heightHandle}
          style={handleStyle(selected.rect.x + selected.rect.w / 2, selected.rect.y + selected.rect.h, handleSize, handleSize, 'ns-resize')}
        />
      )}

      {active && selected && (
        <span
          style={{ position: 'absolute', left: (selected.rect.x + selected.rect.w) * scale + px(8), top: selected.rect.y * scale, fontSize: tagFont, height: tagHeight, lineHeight: `${tagHeight}px`, padding: `0 ${px(6)}px`, borderRadius: px(4) }}
          className="whitespace-nowrap bg-gray-900 font-semibold tabular-nums text-white"
        >
          {active.text}
        </span>
      )}

      {indicator && (
        <>
          {indicator.container && (
            <div style={{ ...at(indicator.container), outline: `${px(1)}px dashed ${VIOLET}` }} />
          )}
          {indicator.inside ? (
            <div style={{ ...at(indicator.rect), background: 'rgba(124, 58, 237, 0.12)', outline: `${px(2)}px solid ${VIOLET}`, borderRadius: px(3) }} />
          ) : (
            <div
              style={{
                position: 'absolute',
                left: indicator.rect.x * scale - (indicator.rect.w ? 0 : px(1.5)),
                top: indicator.rect.y * scale - (indicator.rect.h ? 0 : px(1.5)),
                width: indicator.rect.w ? indicator.rect.w * scale : px(3),
                height: indicator.rect.h ? indicator.rect.h * scale : px(3),
                background: VIOLET,
                borderRadius: px(2),
                boxShadow: `0 0 0 ${px(1)}px #fff`,
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
