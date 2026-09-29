import { useEffect } from 'react'
import type { BridgeDropTarget } from '@/features/elementor-preview/editorBridge'

/**
 * Iframes de preview das seções no canvas, por id da seção: para o painel
 * Inserir perguntar onde um elemento arrastado entraria, e para o Enter abrir
 * o texto da camada selecionada.
 */
const frames = new Map<string, HTMLIFrameElement>()

export function registerFrame(sectionId: string, frame: HTMLIFrameElement) {
  frames.set(sectionId, frame)
  return () => {
    if (frames.get(sectionId) === frame) frames.delete(sectionId)
  }
}

export const frameOf = (sectionId: string) => frames.get(sectionId) ?? null

/** Seção cujo preview está sob o ponto da janela. */
export function sectionAt(clientX: number, clientY: number): string | null {
  const hit = document.elementFromPoint(clientX, clientY)
  return hit?.closest<HTMLElement>('[data-section-preview]')?.dataset.sectionPreview ?? null
}

/** Ponto da janela em px do documento do preview. */
export function toFrame(frame: HTMLIFrameElement, clientX: number, clientY: number) {
  const box = frame.getBoundingClientRect()
  const ratio = frame.offsetWidth ? box.width / frame.offsetWidth : 1
  return { x: (clientX - box.left) / ratio, y: (clientY - box.top) / ratio }
}

let token = 0
const waiting = new Map<number, (target: BridgeDropTarget | null) => void>()

/** Pergunta à ponte do preview onde um elemento solto no ponto entraria. */
export function hitTest(sectionId: string, clientX: number, clientY: number, kind: 'widget' | 'container'): Promise<BridgeDropTarget | null> {
  const frame = frameOf(sectionId)
  if (!frame?.contentWindow) return Promise.resolve(null)
  const id = ++token
  const { x, y } = toFrame(frame, clientX, clientY)
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    frame.contentWindow!.postMessage({ type: 'se-hit', token: id, x, y, kind }, '*')
    // Sem resposta (preview recarregando), segue sem alvo
    setTimeout(() => {
      if (waiting.delete(id)) resolve(null)
    }, 500)
  })
}

export function resolveHit(id: number, target: BridgeDropTarget | null) {
  const resolve = waiting.get(id)
  if (!resolve) return
  waiting.delete(id)
  resolve(target)
}

export function editTextIn(sectionId: string, elementId: string) {
  frameOf(sectionId)?.contentWindow?.postMessage({ type: 'se-edit-text', elementId }, '*')
}

/**
 * Botão do mouse apertado na página, fora dos previews: até soltar, os iframes
 * não recebem o mouse (ver .se-frames-frozen no index.css). Um aperto dentro de
 * um preview não chega aqui, e o arrasto dentro dele continua com ele.
 */
export function useFrameGestureGuard() {
  useEffect(() => {
    const root = document.documentElement
    const freeze = (event: PointerEvent) => {
      if (event.isPrimary) root.classList.add('se-frames-frozen')
    }
    const thaw = () => root.classList.remove('se-frames-frozen')
    window.addEventListener('pointerdown', freeze, true)
    window.addEventListener('pointerup', thaw, true)
    window.addEventListener('pointercancel', thaw, true)
    window.addEventListener('blur', thaw)
    return () => {
      window.removeEventListener('pointerdown', freeze, true)
      window.removeEventListener('pointerup', thaw, true)
      window.removeEventListener('pointercancel', thaw, true)
      window.removeEventListener('blur', thaw)
      thaw()
    }
  }, [])
}
