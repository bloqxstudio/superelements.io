/**
 * Projeto aberto em segundo plano para um agente (ponte do `npm run dev`,
 * `src/features/space/bridge/client.ts`). Antes de uma pessoa abrir o mesmo
 * projeto nesta aba, o segundo plano salva o que tinha e sai, para o canvas
 * abrir já com o que o agente fez e nunca haver dois abertos salvando aqui.
 */

type Release = (projectId: string) => Promise<void>

let releaser: Release | null = null

export const setBackgroundRelease = (release: Release | null) => {
  releaser = release
}

/** Espera o segundo plano do projeto salvar e sair (nada a esperar sem a ponte). */
export const releaseBackground = (projectId: string) => releaser?.(projectId).catch(() => {}) ?? Promise.resolve()
