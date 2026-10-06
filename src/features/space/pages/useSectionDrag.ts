import React, { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceNode } from '@/types/space'
import { dropTargetAt, pageOf } from './pages'

/** Distância em px abaixo da qual soltar o mouse conta como clique (seleciona), não como arrasto. */
const CLICK_SLOP = 4
/** Faixa perto da borda do canvas em que o arrasto rola o canvas; em cima, abaixo da barra do Space. */
const EDGE = 56
const TOP_BAR = 0
const MAX_PAN_SPEED = 16

export interface SectionLift {
  /** Deslocamento da seção de página que está sendo levada, no mundo do canvas. */
  dx: number
  dy: number
  /** Alt pressionado: soltar cria uma cópia e a original fica. */
  copy: boolean
  /** Fora das páginas: soltar agora deixa a seção (ou a cópia) solta no canvas. */
  loose: boolean
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** Soltar sobre o painel da biblioteca desiste do arrasto. */
const overLibrary = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('[data-space-library]')

/**
 * Arrastar uma seção. Solta sobre uma página, encaixa na posição marcada; fora
 * delas, fica solta no canvas onde foi solta (uma seção de página sai dela).
 * Com Alt, vai uma cópia e a original fica. Esc, ou soltar sobre a biblioteca,
 * desiste: a seção volta para o lugar. Perto da borda o canvas rola.
 */
export function useSectionDrag(node: SpaceNode, cardRef: React.RefObject<HTMLElement>) {
  const [lift, setLift] = useState<SectionLift | null>(null)
  const [dragging, setDragging] = useState(false)
  const [settling, setSettling] = useState(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const canvas = cardRef.current?.closest('[data-space-canvas]')?.getBoundingClientRect()
      if (!canvas) return

      const inPage = !!pageOf(useSpaceStore.getState().pages, node.id)
      const origin = { x: node.x, y: node.y }
      const toWorld = (cx: number, cy: number) => {
        const t = useSpaceStore.getState().canvasTransform
        return { x: (cx - canvas.left - t.x) / t.zoom, y: (cy - canvas.top - t.y) / t.zoom }
      }
      const start = toWorld(e.clientX, e.clientY)
      const grab = { x: start.x - origin.x, y: start.y - origin.y }
      const pointer = { x: e.clientX, y: e.clientY, alt: e.altKey }
      let moved = false
      let cancelled = false
      let frame = 0

      const update = () => {
        const { pages, nodes, updateNodePosition, setDropTarget } = useSpaceStore.getState()
        const w = toWorld(pointer.x, pointer.y)
        const target = dropTargetAt(pages, nodes, w.x, w.y, node.id)
        // Solta (ou cópia solta) só conta quando muda algo: sair de uma página, ou copiar
        const loose = !target && !overLibrary(pointer.x, pointer.y) && (inPage || pointer.alt)
        if (inPage) setLift({ dx: w.x - grab.x - origin.x, dy: w.y - grab.y - origin.y, copy: pointer.alt, loose })
        else {
          updateNodePosition(node.id, w.x - grab.x, w.y - grab.y)
          setLift({ dx: 0, dy: 0, copy: pointer.alt, loose })
        }
        setDropTarget(target)
        document.body.style.cursor = pointer.alt ? 'copy' : 'grabbing'
      }

      // Rola o canvas com o ponteiro perto da borda e segue com a seção
      const tick = () => {
        const speed = (distance: number) => (distance < EDGE ? ((EDGE - Math.max(distance, 0)) / EDGE) * MAX_PAN_SPEED : 0)
        const vx = speed(pointer.x - canvas.left) - speed(canvas.right - pointer.x)
        const vy = speed(pointer.y - canvas.top - TOP_BAR) - speed(canvas.bottom - pointer.y)
        if (vx || vy) {
          useSpaceStore.getState().panCanvas(vx, vy)
          update()
        }
        frame = requestAnimationFrame(tick)
      }

      const handleMouseMove = (ev: MouseEvent) => {
        pointer.x = ev.clientX
        pointer.y = ev.clientY
        pointer.alt = ev.altKey
        if (cancelled || (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < CLICK_SLOP)) return
        if (!moved) {
          moved = true
          setDragging(true)
          setSettling(false)
          frame = requestAnimationFrame(tick)
        }
        update()
      }
      /** Desiste do arrasto: a seção volta para onde estava. */
      const cancel = () => {
        cancelled = true
        cancelAnimationFrame(frame)
        document.body.style.cursor = ''
        setDragging(false)
        useSpaceStore.getState().setDropTarget(null)
        if (inPage) setSettling(!reducedMotion())
        else useSpaceStore.getState().updateNodePosition(node.id, origin.x, origin.y)
        setLift(null)
      }

      const handleKey = (ev: KeyboardEvent) => {
        if (!moved || cancelled) return
        if (ev.key === 'Escape' && ev.type === 'keydown') {
          ev.preventDefault()
          ev.stopPropagation()
          return cancel()
        }
        if (ev.key !== 'Alt') return
        ev.preventDefault()
        pointer.alt = ev.type === 'keydown'
        update()
      }

      const handleMouseUp = (ev: MouseEvent) => {
        cancelAnimationFrame(frame)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('keydown', handleKey)
        document.removeEventListener('keyup', handleKey)
        document.body.style.cursor = ''
        setDragging(false)

        const store = useSpaceStore.getState()
        if (!moved) {
          setLift(null)
          // Clique sem arrastar seleciona a seção; Shift (ou Ctrl/Cmd) junta à seleção
          store.selectSection(node.id, ev.shiftKey || ev.ctrlKey || ev.metaKey)
          return
        }

        // Esc no meio do arrasto: já voltou para o lugar
        if (cancelled) return

        const target = store.dropTarget
        store.setDropTarget(null)
        if (!target) {
          if (overLibrary(ev.clientX, ev.clientY)) return cancel()
          const w = toWorld(ev.clientX, ev.clientY)
          const spot = { x: w.x - grab.x, y: w.y - grab.y }
          if (pointer.alt) {
            // Cópia solta onde foi solta; a original volta para o lugar dela
            store.copySectionToCanvas(node.id, spot.x, spot.y)
            if (inPage) setSettling(!reducedMotion())
            else store.updateNodePosition(node.id, origin.x, origin.y)
            toast.success('Cópia solta no canvas')
          } else if (inPage) {
            store.moveSectionToPage(node.id, null, undefined, spot)
            toast.success('Seção solta no canvas', { description: 'Arraste de volta para uma página quando quiser.' })
          }
          // Solta sem Alt: já está onde foi deixada
          setLift(null)
          return
        }

        const toName = store.pages.find((p) => p.id === target.pageId)?.name
        if (pointer.alt) {
          // O índice do alvo não conta a própria seção; a cópia entra ao lado da original
          const from = pageOf(store.pages, node.id)
          const own = from?.id === target.pageId ? from.sectionIds.indexOf(node.id) : -1
          store.copySectionsTo([node.id], target.pageId, own >= 0 && target.index >= own ? target.index + 1 : target.index)
          if (!inPage) store.updateNodePosition(node.id, origin.x, origin.y)
          toast.success(`Seção copiada para ${toName}`)
        } else {
          const from = pageOf(store.pages, node.id)
          store.moveSectionToPage(node.id, target.pageId, target.index)
          if (from && from.id !== target.pageId) toast.success(`Seção movida para ${toName}`)
        }
        setLift(null)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('keydown', handleKey)
      document.addEventListener('keyup', handleKey)
    },
    [node.id, node.x, node.y, cardRef]
  )

  return { onMouseDown, lift, dragging, settling, onSettled: () => setSettling(false) }
}
