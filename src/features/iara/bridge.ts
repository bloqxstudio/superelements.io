import { agentName, allActions, catalog, execAction, isRisky } from './actions'
import { patchMessage, uid, useIara } from './store'

/**
 * O lado da aba da ponte da Iara: o servidor MCP `iara-mcp.mjs` (ferramentas do Claude Code) chama o método `iara` da
 * ponte do Space (`client.ts`), que cai aqui. Ação segura roda e devolve o resultado (dados e
 * imagens) para o agente seguir; ação arriscada vira um botão na mensagem da Iara que está sendo
 * escrita, e o agente fica sabendo que a pessoa confirma.
 */

const MAX_CHAT_IMAGES = 6

export async function iaraCall(params: { action?: string; args?: Record<string, unknown> }) {
  const name = String(params?.action ?? '')
  const args = params?.args && typeof params.args === 'object' ? params.args : {}
  if (name === 'acoes' || name === '__catalogo') return { acoes: catalog(), tela: useIara.getState().screen?.title ?? null }
  if (name === '__lista') return { lista: allActions().map((a) => ({ name: a.name, doc: a.doc, risky: typeof a.risky === 'function' ? 'às vezes' : !!a.risky })) }
  const action = allActions().find((a) => a.name === name)
  if (!action) throw new Error(`Ação desconhecida: ${name}. Rode "acoes" para ver a lista.`)
  const liveId = useIara.getState().liveId

  if (isRisky(action, args)) {
    const label = action.label?.(args) ?? name
    const handoff = action.handoff?.(args)
    const reason = typeof args.motivo === 'string' ? args.motivo.slice(0, 300) : undefined
    if (liveId) {
      patchMessage(liveId, (m) => {
        const same = m.proposals?.some((p) => p.action === name && JSON.stringify(p.args) === JSON.stringify(args))
        return same ? m : { ...m, proposals: [...(m.proposals ?? []), { id: uid(), action: name, args, label, state: 'pendente', handoff, reason }] }
      })
    }
    if (handoff) {
      return {
        pendente: true,
        bastao: agentName(handoff),
        aviso: `Ficou no chat o pedido para passar o bastão ao ${agentName(handoff)} ("${label}"). A pessoa confirma. Termine sua resposta agora dizendo em uma frase que o ${agentName(handoff)} vai fazer isso e por quê. Quando ele terminar, você recebe o resultado numa nova mensagem e revisa. Não repita esta ação.`,
      }
    }
    return { pendente: true, aviso: `"${label}" ficou como botão no chat: a pessoa confirma. Não repita esta ação.` }
  }

  const result = await execAction(name, args)
  if (liveId) {
    patchMessage(liveId, (m) => ({
      ...m,
      done: result.done.length ? [...(m.done ?? []), ...result.done] : m.done,
      images: result.images?.length ? [...(m.images ?? []), ...result.images.map((i) => i.data)].slice(-MAX_CHAT_IMAGES) : m.images,
    }))
  }
  return { feito: result.done.map((d) => ({ ok: d.ok, texto: d.label, id: d.ref, abrir: d.to })), dados: result.data ?? null, imagens: result.images ?? [] }
}
