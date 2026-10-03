/**
 * Projeto aberto em segundo plano para um agente: um iframe escondido dentro
 * de uma aba do app, na rota `/agente/:projectId`, sem o canvas. O nome do
 * iframe diz o projeto e continua o mesmo se ele navegar (cair no login, por
 * exemplo), para a ponte nunca o confundir com a tela de uma pessoa.
 */

export const WORKER_NAME_PREFIX = 'space-worker:'

export const workerPath = (projectId: string) => `/agente/${projectId}`

/** O que a página do segundo plano expõe para a ponte e para a aba que a hospeda. */
export interface WorkerHandle {
  /** O projeto não abre: sai da conta, sem acesso, falha ao ler. */
  failed?: string
  /** Salva o que falta e fecha o projeto. */
  release: () => Promise<void>
}

declare global {
  interface Window {
    __spaceWorker?: WorkerHandle
  }
}

/** A página do segundo plano mudou de estado: a ponte avisa o servidor na hora. */
export const WORKER_REFRESH_EVENT = 'space-bridge:refresh'
