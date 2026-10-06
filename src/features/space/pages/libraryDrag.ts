import type React from 'react'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData } from '@/types/space'
import { SECTION_WIDTH, dropTargetAt } from './pages'

/**
 * Arrastar um card da biblioteca para o canvas com eventos de ponteiro, não
 * com o arrastar nativo do navegador: o nativo falha dentro de iframes e apps
 * desktop (o preview do Ship Studio) e mostra o cursor de bloqueado. Solta em
 * qualquer ponto do Space: sobre barras e painéis vale o canvas embaixo; só o
 * próprio painel da biblioteca cancela. Perto da borda o canvas rola.
 */

/** Distância em px abaixo da qual soltar conta como clique no card (adiciona no fim da página). */
const CLICK_SLOP = 6
/** Faixa perto da borda da área livre em que o arrasto rola o canvas; em cima, abaixo da barra do Space. */
const EDGE = 64
const TOP_BAR = 0
const MAX_PAN_SPEED = 14
/** Altura, a partir do topo da seção, do ponto que fica sob o ponteiro. */
const GRAB_Y = 16

const canvasRect = () => document.querySelector('[data-space-canvas]')?.getBoundingClientRect()
const libraryRect = () => document.querySelector('[data-space-library]')?.getBoundingClientRect()
const overLibrary = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('[data-space-library]')
const insideCanvas = (x: number, y: number) => {
  const r = canvasRect()
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

const toWorld = (clientX: number, clientY: number) => {
  const rect = canvasRect()
  const t = useSpaceStore.getState().canvasTransform
  return { x: (clientX - (rect?.left ?? 0) - t.x) / t.zoom, y: (clientY - (rect?.top ?? 0) - t.y) / t.zoom }
}

/** Onde o card entraria: posição numa página, ou uma seção solta com o contorno no canvas. */
const track = (x: number, y: number, title: string) => {
  const { pages, nodes, setDropTarget, setLibraryGhost, setLibraryPointer } = useSpaceStore.getState()
  setLibraryPointer({ x, y, title })
  if (overLibrary(x, y) || !insideCanvas(x, y)) {
    setDropTarget(null)
    setLibraryGhost(null)
    return
  }
  const w = toWorld(x, y)
  const target = dropTargetAt(pages, nodes, w.x, w.y)
  setDropTarget(target)
  setLibraryGhost(target ? null : { x: w.x - SECTION_WIDTH / 2, y: w.y - GRAB_Y, title })
}

const clear = () => {
  const { setDropTarget, setLibraryGhost, setLibraryPointer } = useSpaceStore.getState()
  setDropTarget(null)
  setLibraryGhost(null)
  setLibraryPointer(null)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

/** O arrasto acabou de soltar: o clique que o navegador dispara em seguida não adiciona de novo. */
let justDropped = false
export const consumeLibraryDrop = () => {
  const dropped = justDropped
  justDropped = false
  return dropped
}

/** No pointerdown do card: acompanha até soltar e põe a seção onde foi solta. */
export function startLibraryDrag(e: React.PointerEvent<HTMLElement>, makeData: () => SectionNodeData) {
  if (e.button !== 0 || !e.isPrimary) return
  const card = e.currentTarget
  const start = { x: e.clientX, y: e.clientY }
  const pointer = { x: e.clientX, y: e.clientY }
  let data: SectionNodeData | null = null
  // Esc no meio do arrasto: some tudo, mas o soltar do botão ainda é esperado (e o clique dele, descartado)
  let cancelled = false
  // Só rola depois que o ponteiro entrou na área livre: ao sair da biblioteca ele passa pela borda esquerda
  let armed = false
  let frame = 0

  const loop = () => {
    const canvas = canvasRect()
    if (data && canvas) {
      const area = { left: libraryRect()?.right ?? canvas.left, right: canvas.right, top: canvas.top + TOP_BAR, bottom: canvas.bottom }
      const p = pointer
      if (p.x > area.left + EDGE && p.x < area.right - EDGE && p.y > area.top + EDGE && p.y < area.bottom - EDGE) armed = true
      if (armed && p.x >= area.left) {
        const speed = (distance: number) => (distance < EDGE ? ((EDGE - Math.max(distance, 0)) / EDGE) * MAX_PAN_SPEED : 0)
        const vx = speed(p.x - area.left) - speed(area.right - p.x)
        const vy = speed(p.y - area.top) - speed(area.bottom - p.y)
        if (vx || vy) {
          useSpaceStore.getState().panCanvas(vx, vy)
          track(p.x, p.y, data.title)
        }
      }
    }
    frame = requestAnimationFrame(loop)
  }

  const end = () => {
    cancelAnimationFrame(frame)
    card.removeEventListener('pointermove', onMove)
    card.removeEventListener('pointerup', onUp)
    card.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
    if (card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId)
    clear()
  }

  const onMove = (ev: PointerEvent) => {
    if (cancelled) return
    pointer.x = ev.clientX
    pointer.y = ev.clientY
    if (!data) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < CLICK_SLOP) return
      data = makeData()
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      window.getSelection()?.removeAllRanges()
      frame = requestAnimationFrame(loop)
    }
    track(ev.clientX, ev.clientY, data.title)
  }

  const onUp = (ev: PointerEvent) => {
    if (!data) return end()
    justDropped = true
    if (cancelled) {
      setTimeout(() => (justDropped = false), 0)
      return end()
    }
    // O clique que vem depois do pointerup é descartado; se não vier, a marca some sozinha
    setTimeout(() => (justDropped = false), 0)
    track(ev.clientX, ev.clientY, data.title)
    const store = useSpaceStore.getState()
    const { dropTarget: target, libraryGhost: ghost } = store
    const dropped = data
    end()

    if (target) {
      store.addSections([dropped], { pageId: target.pageId, index: target.index, focus: false })
      toast.success(`${dropped.title} adicionada à página ${store.pages.find((p) => p.id === target.pageId)?.name ?? ''}`.trim())
    } else if (ghost) {
      const id = store.addLooseSection(dropped, ghost.x, ghost.y)
      store.setSelection([id])
      toast.success(`${dropped.title} solta no canvas`, { description: 'Arraste até uma página para pôr nela.' })
    }
    // Sem alvo nem contorno: soltou sobre a biblioteca (ou fora do Space), nada muda
  }

  const onCancel = () => end()
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !data || cancelled) return
    ev.preventDefault()
    ev.stopPropagation()
    cancelled = true
    cancelAnimationFrame(frame)
    clear()
  }

  // Captura: o ponteiro continua chegando ao card sobre o canvas, iframes e até fora do preview
  card.setPointerCapture(e.pointerId)
  card.addEventListener('pointermove', onMove)
  card.addEventListener('pointerup', onUp)
  card.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
}
