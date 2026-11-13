import { useEffect } from 'react'

/**
 * Liga a identidade da Sinfy (cores e tokens de `html.se-sinfy` em src/index.css) enquanto a tela estiver aberta.
 * Fica na raiz do documento para valer também nos diálogos e menus que o Radix monta fora da árvore. As páginas
 * públicas dos clientes (formulário, aprovação, prévias) não chamam, e ficam com o design delas.
 */
export function useSinfyTheme() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('se-sinfy')
    return () => root.classList.remove('se-sinfy')
  }, [])
}
