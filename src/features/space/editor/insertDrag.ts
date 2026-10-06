import type React from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionElement } from '@/features/space/landingPage'
import type { BridgeDropTarget } from '@/features/elementor-preview/editorBridge'
import { dropTargetAt } from '@/features/space/pages/pages'
import { addBlankSection, insertInto } from './actions'
import { hitTest, sectionAt } from './frames'
import type { PinnedSettings } from './pinned'
import type { InsertTarget } from './tree'

/**
 * Arrastar um elemento do painel Inserir até o canvas: sobre uma seção, a ponte
 * do preview diz em que stack e posição ele entra; entre as seções de uma
 * página, ele vira uma seção nova ali. Soltar sem arrastar é um clique.
 */

interface InsertDragState {
  /** Onde o elemento entraria numa seção, para o contorno dela desenhar a linha. */
  drop: { sectionId: string; target: BridgeDropTarget } | null
  setDrop: (drop: InsertDragState['drop']) => void
}

export const useInsertDrag = create<InsertDragState>((set, get) => ({
  drop: null,
  setDrop: (drop) => {
    const current = get().drop
    if (current === drop) return
    if (
      current &&
      drop &&
      current.sectionId === drop.sectionId &&
      current.target.parentId === drop.target.parentId &&
      current.target.index === drop.target.index
    )
      return
    set({ drop })
  },
}))

export interface InsertItem {
  label: string
  /** Widget ou container: muda onde ele pode entrar. */
  kind: 'widget' | 'container'
  make: () => { element: SectionElement; pinned?: PinnedSettings }
  /** Seção em branco: só entra entre seções. */
  sectionOnly?: boolean
  /** Quem põe no lugar (um componente cria um uso ligado), em vez da cópia de `make`. */
  place?: (where: { sectionId: string; target: InsertTarget } | { pageId: string; index: number }) => void
}

const CLICK_SLOP = 6

const overPanel = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('[data-space-library], [data-space-navigator]')

const toWorld = (clientX: number, clientY: number) => {
  const rect = document.querySelector('[data-space-canvas]')?.getBoundingClientRect()
  const t = useSpaceStore.getState().canvasTransform
  return { x: (clientX - (rect?.left ?? 0) - t.x) / t.zoom, y: (clientY - (rect?.top ?? 0) - t.y) / t.zoom }
}

export function startInsertDrag(e: React.PointerEvent<HTMLElement>, item: InsertItem, onClick: () => void) {
  if (e.button !== 0 || !e.isPrimary) return
  const source = e.currentTarget
  const start = { x: e.clientX, y: e.clientY }
  let dragging = false
  let cancelled = false
  let asked = 0

  const clear = () => {
    const store = useSpaceStore.getState()
    store.setLibraryPointer(null)
    store.setDropTarget(null)
    useInsertDrag.getState().setDrop(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const track = (x: number, y: number) => {
    const store = useSpaceStore.getState()
    store.setLibraryPointer({ x, y, title: item.label })
    if (overPanel(x, y)) {
      store.setDropTarget(null)
      useInsertDrag.getState().setDrop(null)
      return
    }
    const sectionId = item.sectionOnly ? null : sectionAt(x, y)
    if (sectionId) {
      store.setDropTarget(null)
      const ticket = ++asked
      void hitTest(sectionId, x, y, item.kind).then((target) => {
        if (ticket !== asked || cancelled || !dragging) return
        useInsertDrag.getState().setDrop(target ? { sectionId, target } : null)
      })
      return
    }
    useInsertDrag.getState().setDrop(null)
    const w = toWorld(x, y)
    store.setDropTarget(dropTargetAt(store.pages, store.nodes, w.x, w.y))
  }

  const end = () => {
    source.removeEventListener('pointermove', onMove)
    source.removeEventListener('pointerup', onUp)
    source.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
    if (source.hasPointerCapture(e.pointerId)) source.releasePointerCapture(e.pointerId)
    clear()
  }

  const onMove = (ev: PointerEvent) => {
    if (cancelled) return
    if (!dragging) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < CLICK_SLOP) return
      dragging = true
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
    track(ev.clientX, ev.clientY)
  }

  const onUp = (ev: PointerEvent) => {
    if (!dragging) {
      end()
      if (!cancelled) onClick()
      return
    }
    const drop = useInsertDrag.getState().drop
    const pageTarget = useSpaceStore.getState().dropTarget
    end()
    if (cancelled) return
    if (item.place && (drop || pageTarget)) {
      item.place(drop ? { sectionId: drop.sectionId, target: { parentId: drop.target.parentId, index: drop.target.index } } : { pageId: pageTarget!.pageId, index: pageTarget!.index })
      return
    }
    const { element, pinned } = item.make()
    if (drop) insertInto(drop.sectionId, element, { parentId: drop.target.parentId, index: drop.target.index }, pinned)
    else if (pageTarget) {
      if (item.sectionOnly) addBlankSection({ pageId: pageTarget.pageId, index: pageTarget.index })
      else addBlankSection({ pageId: pageTarget.pageId, index: pageTarget.index, with: [element] })
    } else if (!overPanel(ev.clientX, ev.clientY)) {
      // Solto de volta no painel é desistir; no vazio do canvas, explica onde cabe
      toast.message('Solte sobre uma seção ou entre as seções de uma página.')
    }
  }

  const onCancel = () => end()
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !dragging || cancelled) return
    ev.preventDefault()
    ev.stopPropagation()
    cancelled = true
    clear()
  }

  // Captura: o ponteiro continua chegando ao item sobre o canvas e sobre os iframes
  source.setPointerCapture(e.pointerId)
  source.addEventListener('pointermove', onMove)
  source.addEventListener('pointerup', onUp)
  source.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
}
