import type { PreviewState } from './protocol'

export const PREVIEW_TEXT: Record<PreviewState, string> = {
  parada: 'parada',
  instalando: 'instalando dependências',
  iniciando: 'iniciando',
  rodando: 'rodando',
  erro: 'com erro',
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Caminho de um arquivo do site, relativo à pasta dele (as marcas do Astro vêm com o caminho inteiro). */
export const relFile = (dir: string, file: string) => (file.startsWith(`${dir}/`) ? file.slice(dir.length + 1) : file)
