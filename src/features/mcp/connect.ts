import { create } from 'zustand'

/**
 * O MCP da Sinfy é o caminho principal para usar IA na plataforma (2026-11-12, o usuário: "vamos
 * simplificar e focar somente no mcp como principal e acesso a tudo que temos ali"; escolheu esconder
 * a Iara do app). A Iara dependia do conector local (Claude Code ou Codex nesta máquina); fica fora das
 * telas e o código continua no lugar. Para religar só neste navegador: abra qualquer tela com `?iara=1`
 * (e `?iara=0` para desligar de novo).
 *
 * Os botões que pediam algo à Iara ("Peça à Iara", "Escreva o roteiro"…) passam a copiar o pedido e
 * abrir o "Conectar sua IA": a pessoa cola o pedido no Claude, ChatGPT ou Cursor ligado à conta.
 */

const KEY = 'iara-ligada'

export function iaraEnabled(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get('iara')
    if (flag === '1') localStorage.setItem(KEY, '1')
    if (flag === '0') localStorage.removeItem(KEY)
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface ConnectState {
  open: boolean
  /** O pedido que a tela queria mandar à Iara, já copiado para a pessoa colar na IA dela. */
  request?: string
  show: (request?: string) => void
  close: () => void
}

export const useMcpConnect = create<ConnectState>((set) => ({
  open: false,
  show: (request) => {
    const text = request?.trim()
    if (text) void navigator.clipboard?.writeText(text).catch(() => undefined)
    set({ open: true, request: text || undefined })
  },
  close: () => set({ open: false, request: undefined }),
}))
