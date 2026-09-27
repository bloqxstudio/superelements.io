import { useEffect } from 'react'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import { MOD_KEY } from './clipboard'
import { plural } from './pages'
import { copySelection } from './actions'

/** Onde as teclas são do próprio campo (texto, JSON) ou de um menu/diálogo aberto. */
const ownsKeys = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')

/**
 * Atalhos das seções no canvas: copiar (Ctrl/⌘+C) as selecionadas, colar
 * (Ctrl/⌘+V) na página ativa, depois da seleção dela, e duplicar (Ctrl/⌘+D).
 */
export function useSectionShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || ownsKeys(e.target)) return
      // Texto selecionado na tela: Ctrl+C copia o texto, como sempre
      if (window.getSelection()?.toString()) return
      const key = e.key.toLowerCase()
      const store = useSpaceStore.getState()

      if (key === 'c' && store.selectedIds.length) {
        e.preventDefault()
        copySelection(store.selectedIds)
      } else if (key === 'v' && store.clipboard) {
        e.preventDefault()
        const result = store.pasteSections()
        const name = result && useSpaceStore.getState().pages.find((p) => p.id === result.pageId)?.name
        if (result) toast.success(`${plural(result.count, 'seção colada', 'seções coladas')} em ${name}`)
      } else if (key === 'd' && store.selectedIds.length) {
        e.preventDefault()
        const count = store.duplicateSections(store.selectedIds)
        if (count) toast.success(plural(count, 'seção duplicada', 'seções duplicadas'), { description: `Copie com ${MOD_KEY}C para colar em outra página.` })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
