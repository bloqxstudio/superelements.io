import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

/**
 * O quadro aberto nesta aba (o editor registra ao abrir). A Iara escreve por aqui quando o quadro
 * está à vista: os elementos entram pelo próprio Excalidraw, aparecem na hora, gravam e vão ao vivo
 * para quem mais estiver no quadro, e dá para desfazer.
 *
 * Cursor do agente (2026-11-07, sugestão: "gostaria de ver o mouse do agente, podendo ser mais de um agente
 * ao mesmo tempo, fazendo a alteração visual"): o editor desenha cada agente como mais um colaborador
 * (nome e cor do agente) e manda a posição para quem mais está no quadro.
 */
export interface AgentPointer { key: string; name: string; color: string }
export interface AgentHooks {
  /** `selected`: o que o agente está montando agora (o editor contorna na cor dele) */
  move: (agent: AgentPointer, x: number, y: number, selected?: string[]) => void
  gone: (key: string) => void
}

let current: { id: string; api: ExcalidrawImperativeAPI; agents?: AgentHooks } | null = null

export const setOpenBoard = (board: typeof current) => {
  current = board
}
export const clearOpenBoard = (id: string) => {
  if (current?.id === id) current = null
}
export const openBoard = (id?: string) => (current && (!id || current.id === id) ? current : null)

const COLORS: Record<string, string> = { claude: '#D97757', codex: '#10A37F' }
const NAMES: Record<string, string> = { claude: 'Claude Code', codex: 'Codex' }
/** O agente que está mexendo agora (o do chat), com a cor dele. `lane` separa vários do mesmo tipo. */
export const agentPointer = (agent: string, lane?: string): AgentPointer => ({
  key: `agente:${agent}${lane ? `:${lane}` : ''}`,
  name: `${NAMES[agent] ?? agent}${lane ? ` · ${lane}` : ''}`,
  color: COLORS[agent] ?? '#7048e8',
})
