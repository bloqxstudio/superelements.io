import type { AgentChannel } from './channel'
import { useConnector } from './connectorStore'

/**
 * Liga a aba aos agentes, na abertura do app (`main.tsx`). No `npm run dev`,
 * pelo servidor do Vite, que roda os agentes do repo; no app publicado, pelo
 * conector na máquina de quem usa, se ele já foi pareado neste navegador.
 */
export function startAgentLink() {
  const hot = import.meta.hot
  if (hot) {
    // O websocket do Vite já é um canal: os eventos dele têm tipo genérico, por isso a conversão
    const channel = hot as unknown as AgentChannel
    void Promise.all([import('@/features/space/bridge/client'), import('@/features/space/chat/connection'), import('@/features/criativos/link')]).then(([bridge, chat, creatives]) => {
      const stops = [bridge.startSpaceBridge(channel), chat.startSpaceChat(channel), creatives.startCreativeLink(channel)]
      hot.dispose(() => stops.forEach((stop) => stop()))
    })
    return
  }
  useConnector.getState().resume()
}
