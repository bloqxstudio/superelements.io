import type { CreativeSet } from './types'

/**
 * Só no `npm run dev`: o editor abre o conjunto de exemplo (os modelos prontos) sem login e sem gravar, para
 * conferir a tela num tamanho de celular (/dev/criativo/dev-local). Não existe no build de produção.
 */
export const DEV_SET_ID = 'dev-local'

export async function devSet(): Promise<CreativeSet> {
  const { importedSet } = await import('./imported')
  return { ...importedSet(), id: DEV_SET_ID, name: 'Exemplo (dev)' }
}
