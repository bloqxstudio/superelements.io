import { useEffect } from 'react'
import { create } from 'zustand'
import { subscribeTopic } from '@/lib/realtimeTopic'

/**
 * A IA conectada (MCP) ao vivo nas telas (2026-11-12, o usuário: "quero ver alterando o sistema em tempo real,
 * ter que atualizar página não é bom, podemos usar os cursores?"). A função sinfy-mcp avisa, no canal privado
 * `mcp:<conta>` (migração 20261112160000), quando começa e quando termina cada ferramenta: qual, onde (ids,
 * post, slide, quadro) e quem (o nome da conexão e da pessoa). Sem conteúdo no aviso.
 *
 * Cada tela ouve com `useMcpEvent` e faz a parte dela: o editor de Criativos recarrega o conjunto e leva o
 * cursor da IA ao slide, o quadro desenha a fila na hora com o cursor da IA, o Cérebro recarrega os arquivos.
 * Pauta, Oportunidades e as notas do Cérebro já se atualizam pelo banco (postgres_changes).
 */

export interface McpEvent {
  phase: 'start' | 'done' | 'upload'
  tool: string
  titulo?: string
  /** A ferramenta muda algo (não só lê). */
  muda: boolean
  onde: Record<string, unknown>
  ia: string
  pessoa: string
  /** A pessoa dona da chave (user id). Ausente nos avisos da função antes de 2026-11-13. */
  usuario?: string
  at: number
  ok?: boolean
  erro?: string
  criado?: Record<string, string>
}

interface LiveState {
  /** O que a IA está fazendo agora (o aviso flutuante), por ferramenta. */
  current?: McpEvent
  recent: McpEvent[]
  push: (e: McpEvent) => void
  clear: () => void
}

export const useMcpLive = create<LiveState>((set, get) => ({
  recent: [],
  push: (e) => set({ current: e, recent: [e, ...get().recent].slice(0, 20) }),
  clear: () => set({ current: undefined }),
}))

const EVENT = 'mcp:ia'

/** Liga o canal da conta (uma vez, no Layout). */
export function useMcpChannel(teamId: string | undefined) {
  useEffect(() => {
    if (!teamId) return
    const topic = `mcp:${teamId}`
    // Antes removia o canal velho sem esperar e o `.channel()` devolvia esse mesmo canal saindo; o helper
    // espera a saída terminar antes de entrar (revisão de 2026-11-13)
    return subscribeTopic(
      topic,
      (channel) =>
        channel.on('broadcast', { event: 'ia' }, ({ payload }) => {
          const e = payload as McpEvent
          if (!e?.tool && e?.phase !== 'upload') return
          useMcpLive.getState().push(e)
          window.dispatchEvent(new CustomEvent<McpEvent>(EVENT, { detail: e }))
        }),
      { config: { config: { private: true } } }
    )
  }, [teamId])
}

/** Ouve o que a IA conectada faz (cada tela decide o que recarregar e onde pôr o cursor). */
export function useMcpEvent(handler: (e: McpEvent) => void, deps: unknown[] = []) {
  useEffect(() => {
    const on = (ev: Event) => handler((ev as CustomEvent<McpEvent>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** O nome que aparece no cursor: "ChatGPT · Igor". */
export const actorLabel = (e: Pick<McpEvent, 'ia' | 'pessoa'>) => {
  const ia = /gpt|openai|chatgpt/i.test(e.ia) ? 'ChatGPT' : /claude/i.test(e.ia) ? 'Claude' : /cursor/i.test(e.ia) ? 'Cursor' : e.ia || 'IA'
  return e.pessoa ? `${ia} · ${e.pessoa}` : ia
}

/** A cor do cursor: verde da OpenAI para o ChatGPT, laranja do Claude, violeta para as outras. */
export const actorColor = (e: Pick<McpEvent, 'ia'>) => (/gpt|openai|chatgpt/i.test(e.ia) ? '#10A37F' : /claude/i.test(e.ia) ? '#D97757' : '#7C3AED')
