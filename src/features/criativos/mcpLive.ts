import { toast } from 'sonner'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import { actorLabel, useMcpEvent, type McpEvent } from '@/features/mcp/live'
import { useAgent } from './agentStore'
import { hasPending, materializePending } from './pending'
import { loadSet } from './storage'
import { useEditor } from './store'
import { diffSets } from './syncPatch'

/**
 * A IA conectada (MCP) no editor aberto, ao vivo (2026-11-12): quando ela começa a mexer neste conjunto,
 * o cursor dela vai ao slide (o mesmo cursor do agente do canvas); quando termina, o conjunto é relido do
 * servidor e entra como mudança remota (sem passo no histórico, a seleção fica), e os slides que mudaram piscam.
 * Com edição local ainda não salva, não sobrescreve: avisa e oferece recarregar.
 */

const TOOLS = ['sinfy_criativo_editar', 'sinfy_criativo_foto', 'sinfy_criativo_ver', 'sinfy_criativo', 'sinfy_publicar']

const agentOf = (e: McpEvent): ChatAgentId => (/gpt|openai|chatgpt/i.test(e.ia) ? 'codex' : 'claude')

const LABEL: Record<string, string> = {
  sinfy_criativo_editar: 'editando',
  sinfy_criativo_foto: 'pondo a foto',
  sinfy_criativo_ver: 'olhando',
  sinfy_criativo: 'lendo',
  sinfy_publicar: 'preparando para publicar',
}

async function reloadFromServer(setId: string, projectId?: string) {
  const st = useEditor.getState()
  if (!st.set || st.set.id !== setId) return []
  let fresh = await loadSet(setId, projectId)
  if (!fresh) return []
  // Posts que a IA pediu: `materializePending` monta e já grava (antes um `persist()` aqui gravava tudo de novo; revisão de 2026-11-13)
  const pending = hasPending(fresh)
  if (pending) fresh = await materializePending(fresh)
  const now = useEditor.getState()
  if (!now.set || now.set.id !== setId) return []
  const before = new Map(now.set.posts.flatMap((p) => p.slides.map((s) => [s.id, JSON.stringify(s)] as const)))
  const patch = diffSets(now.set, fresh)
  if (patch) now.applyRemote(patch)
  // A marca resolvida na montagem (o patch não leva a marca): o próximo autosave não volta à de antes
  const brand = fresh.brand
  if (pending) useEditor.setState((s) => (s.set?.id === setId ? { set: { ...s.set, brand } } : {}))
  return fresh.posts.flatMap((p) => p.slides).filter((s) => before.get(s.id) !== JSON.stringify(s)).map((s) => s.id)
}

export function useMcpCreativeLive(setId: string, projectId?: string) {
  useMcpEvent((e) => {
    if (!TOOLS.includes(e.tool)) return
    const id = typeof e.onde.id === 'string' ? e.onde.id : e.criado?.conjunto
    if (id !== setId) return
    const st = useEditor.getState()
    const set = st.set
    if (!set) return
    const agent = agentOf(e)
    const post = set.posts[Math.max(1, Number(e.onde.post) || 1) - 1]
    const slide = post?.slides[Math.max(1, Number(e.onde.slide) || 1) - 1]
    const who = actorLabel(e)

    if (e.phase === 'start') {
      useAgent.getState().begin({ scope: slide ? 'slide' : post ? 'post' : 'set', postId: post?.id, slideId: slide?.id ?? post?.slides[0]?.id }, `${who}: ${LABEL[e.tool] ?? 'trabalhando'}`, agent)
      if (slide ?? post?.slides[0]) useAgent.getState().point({ slideId: (slide ?? post!.slides[0]).id, agent, text: `${who} · ${LABEL[e.tool] ?? 'trabalhando'}` })
      return
    }
    if (e.phase !== 'done') return
    if (!e.muda || e.ok === false) {
      useAgent.getState().end()
      return
    }
    if (st.saving !== 'saved') {
      useAgent.getState().end()
      toast.warning(`${who} mudou este conjunto`, {
        description: 'Você tem edições ainda não salvas aqui. Recarregue para ver a versão da IA (as suas edições não salvas se perdem).',
        action: { label: 'Recarregar', onClick: () => void useEditor.getState().open(setId, projectId) },
        duration: 15000,
      })
      return
    }
    void reloadFromServer(setId, projectId)
      .then((changed) => {
        if (changed.length) {
          useAgent.getState().point({ slideId: changed[0], agent, text: `${who} · pronto` })
          useAgent.getState().highlight(changed)
        }
      })
      .catch((err) => console.error('[criativos] mudança da IA', err))
      .finally(() => useAgent.getState().end())
  }, [setId, projectId])
}
