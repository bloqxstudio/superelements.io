import { useEffect, useRef } from 'react'
import { create } from 'zustand'

/**
 * Iara: a assistente que conversa e mexe nas telas (2026-11-05). O usuário: "um chat, aonde
 * consiga falar ali, uma assistente, e ela preenche as coisas, traz novas ideias, muda algum
 * status, muda coisas na tela, cria posts…". Roda na IA desta máquina (o conector), por escolha
 * dele. Rascunhos e mudanças de tela acontecem direto; aprovar, descartar, enviar ao cliente e
 * publicar viram uma proposta que a pessoa confirma.
 *
 * Aqui: a conversa (por conta, guardada neste navegador) e o registro da tela aberta, que diz à
 * Iara o que a pessoa está vendo e que ações de tela existem.
 */

export interface IaraDone {
  label: string
  ok: boolean
  /** Endereço para abrir o que foi feito. */
  to?: string
}

export interface IaraProposal {
  id: string
  action: string
  args: unknown
  label: string
  state: 'pendente' | 'feito' | 'recusado' | 'erro'
  result?: string
}

export interface IaraMessage {
  id: string
  role: 'user' | 'iara'
  text: string
  at: number
  done?: IaraDone[]
  proposals?: IaraProposal[]
}

/** Uma ação que a tela aberta oferece à Iara. */
export interface IaraAction {
  name: string
  /** Para a IA: o que faz e os campos do JSON. */
  doc: string
  /** Precisa de confirmação da pessoa? */
  risky?: boolean | ((args: Record<string, unknown>) => boolean)
  /** Frase da proposta (quando precisa confirmar). */
  label?: (args: Record<string, unknown>) => string
  run: (args: Record<string, unknown>) => Promise<IaraDone | IaraDone[]>
}

export interface IaraScreen {
  id: string
  title: string
  /** O que está na tela agora (texto curto para a IA). */
  describe: () => string
  actions: IaraAction[]
}

interface IaraState {
  open: boolean
  busy: boolean
  step?: string
  teamId?: string
  messages: IaraMessage[]
  screen?: IaraScreen
  /** Pedido feito de fora (um botão "Pedir à Iara"): o painel envia e limpa. */
  queued?: string
  setOpen: (open: boolean) => void
  ask: (text: string) => void
}

export const uid = () => Math.random().toString(36).slice(2, 10)

const KEY = (team: string) => `iara:${team}`

export const readMessages = (team: string): IaraMessage[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(team)) ?? '[]') as IaraMessage[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export const writeMessages = (team: string, list: IaraMessage[]) => {
  try {
    localStorage.setItem(KEY(team), JSON.stringify(list.slice(-50)))
  } catch {
    // sem armazenamento: a conversa vale até fechar a aba
  }
}

export const useIara = create<IaraState>()((set) => ({
  open: false,
  busy: false,
  messages: [],
  setOpen: (open) => set({ open }),
  ask: (text) => set({ open: true, queued: text }),
}))

/** A tela registra o que está mostrando e as ações dela enquanto está aberta. */
export function useIaraScreen(screen: IaraScreen | null) {
  const ref = useRef(screen)
  ref.current = screen
  const id = screen?.id
  useEffect(() => {
    if (!id) return
    // A Iara sempre lê a versão mais nova da tela (o objeto muda a cada render)
    const live: IaraScreen = {
      id,
      get title() {
        return ref.current?.title ?? ''
      },
      describe: () => ref.current?.describe() ?? '',
      get actions() {
        return ref.current?.actions ?? []
      },
    }
    useIara.setState({ screen: live })
    return () => {
      if (useIara.getState().screen === live) useIara.setState({ screen: undefined })
    }
  }, [id])
}
