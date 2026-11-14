import { useCallback, useSyncExternalStore } from 'react'

/** Se a janela casa com a media query, acompanhando as mudanças (girar o celular, redimensionar). */
export function useMedia(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query]
  )
  const read = useCallback(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, read, () => false)
}

/**
 * Tela estreita (celular, < 768 px, o `md` do Tailwind): os editores de tela cheia trocam os
 * painéis laterais fixos por gavetas por cima do canvas. Usado pelo Space, pelos Quadros e
 * pelo editor de sites em código.
 */
export const useNarrow = () => useMedia('(max-width: 767px)')
