import { useEffect } from 'react'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import { plural } from '@/features/space/pages/pages'
import { MOD_KEY } from '@/features/space/pages/clipboard'
import { confirmPartSectionRemoval } from '@/features/space/pages/parts'
import {
  copySelectedElement,
  deleteSelectedElement,
  duplicateSelectedElement,
  enterSelectedElement,
  insertKind,
  moveSelectedElement,
  pasteElement,
  selectParentElement,
  selectSibling,
  unwrapSelectedElement,
  wrapSelectedElement,
} from './actions'
import type { InsertKind } from './tree'

/** Letra sem modificador que insere um elemento, como no Framer. */
export const INSERT_KEYS: Record<string, InsertKind> = {
  t: 'heading',
  p: 'text',
  b: 'button',
  i: 'image',
  s: 'stack',
  h: 'row',
  g: 'grid',
}

/** Onde as teclas são do próprio campo (texto, JSON) ou de um menu/diálogo aberto. */
const ownsKeys = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]')

/**
 * Atalhos do editor visual. Rodam antes dos atalhos das seções (captura na
 * janela): com uma camada selecionada, copiar, colar e duplicar agem nela.
 * Ctrl+Z e Ctrl+Shift+Z desfazem e refazem qualquer mudança do canvas.
 */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (ownsKeys(e.target) || e.defaultPrevented) return
      const store = useSpaceStore.getState()
      if (store.playingPageId) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      if (mod && !e.altKey && (key === 'z' || key === 'y')) {
        handled()
        const redo = key === 'y' || e.shiftKey
        if (!(redo ? store.redo() : store.undo())) toast.message(redo ? 'Nada para refazer' : 'Nada para desfazer')
        return
      }

      if (store.editLevel !== 'structure') return
      const element = store.navigatorSelection
      const textSelected = !!window.getSelection()?.toString()

      if (mod && !e.altKey) {
        if (key === 'v' && store.elementClipboard) {
          handled()
          pasteElement()
          return
        }
        if (!element) return
        if ((key === 'c' || key === 'x') && !textSelected) {
          handled()
          copySelectedElement(key === 'x')
        } else if (key === 'd') {
          handled()
          duplicateSelectedElement()
        } else if (key === 'g') {
          handled()
          if (e.shiftKey) unwrapSelectedElement()
          else wrapSelectedElement()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          handled()
          moveSelectedElement(e.key === 'ArrowUp' ? -1 : 1)
        }
        return
      }
      if (e.altKey) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (element) {
          handled()
          deleteSelectedElement()
        } else if (store.selectedIds.length) {
          handled()
          // Seções inteiras: o Ctrl+Z traz de volta, e o aviso lembra disso
          const ids = [...store.selectedIds]
          // Do cabeçalho ou do rodapé do site, somem de todas as páginas: pergunta antes
          if (!confirmPartSectionRemoval(ids)) return
          ids.forEach((id) => useSpaceStore.getState().removeNode(id))
          toast.success(plural(ids.length, 'seção removida', 'seções removidas'), { description: `${MOD_KEY}Z desfaz.` })
        }
        return
      }

      if (element) {
        if (e.key === 'Escape') {
          e.preventDefault()
          selectParentElement()
          return
        }
        if (e.key === 'Enter') {
          handled()
          enterSelectedElement()
          return
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          handled()
          selectSibling(e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1)
          return
        }
      }

      const kind = !e.shiftKey && !e.repeat ? INSERT_KEYS[key] : undefined
      if (kind) {
        handled()
        insertKind(kind)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
