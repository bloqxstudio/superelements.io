import { lazy, type ComponentType } from 'react'

/**
 * Tela carregada só quando a rota abre (cada uma vira um arquivo JS próprio). Depois de um deploy, uma aba
 * aberta antes pede um arquivo que não existe mais: nesse caso a página recarrega uma vez (marca na sessão)
 * para pegar a versão nova, em vez de cair na tela de erro.
 */
const RELOADED = 'chunk-reload'

const isChunkError = (err: unknown) =>
  err instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i.test(err.message)

async function load<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const mod = await loader()
    try {
      sessionStorage.removeItem(RELOADED)
    } catch {
      // sem armazenamento: nada a limpar
    }
    return mod
  } catch (err) {
    let reloaded = true
    try {
      reloaded = sessionStorage.getItem(RELOADED) === '1'
      if (!reloaded && isChunkError(err)) sessionStorage.setItem(RELOADED, '1')
    } catch {
      // sem armazenamento: não arrisca recarregar em laço
    }
    if (!reloaded && isChunkError(err)) {
      window.location.reload()
      return new Promise<T>(() => {})
    }
    throw err
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>

/** Tela com `export default`. */
export function lazyPage<C extends AnyComponent>(loader: () => Promise<{ default: C }>) {
  return lazy(() => load(loader))
}

/** Tela exportada pelo nome (`export const Tela`). */
export function lazyNamed<M, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(() => load(loader).then((m) => ({ default: m[name] as unknown as AnyComponent })))
}
