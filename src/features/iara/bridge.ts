import { agentName, allActions, catalog, chatAgent, creativeAgent, execAction, isRisky } from './actions'
import { addCard, cardOfAnswer, patchCard, useIaraFeed } from './feed'
import { uid, useIara } from './store'

/**
 * O lado da aba da ponte da Iara: o servidor MCP `iara-mcp.mjs` (ferramentas do Claude Code) chama o método `iara` da
 * ponte do Space (`client.ts`), que cai aqui. Ação segura roda e devolve o resultado (dados e
 * imagens) para o agente seguir; ação arriscada vira um cartão de confirmar no chat, logo depois da resposta que está sendo
 * escrita (`feed.ts`), e o agente fica sabendo que a pessoa confirma.
 */

const MAX_CHAT_IMAGES = 6

export async function iaraCall(params: { action?: string; args?: Record<string, unknown> }) {
  const name = String(params?.action ?? '')
  const args = params?.args && typeof params.args === 'object' ? params.args : {}
  if (name === 'acoes' || name === '__catalogo') return { acoes: catalog(), tela: useIara.getState().screen?.title ?? null }
  if (name === '__lista') return { lista: allActions().map((a) => ({ name: a.name, doc: a.doc, risky: typeof a.risky === 'function' ? 'às vezes' : !!a.risky })) }
  const action = allActions().find((a) => a.name === name)
  if (!action) throw new Error(`Ação desconhecida: ${name}. Rode "acoes" para ver a lista.`)

  // Equipe rápida: as faixas começam já, em paralelo, cada uma com o seu cartão de minichat
  if (name === 'equipe_rapida') {
    const { startSquad } = await import('./squad')
    await startSquad(args as never)
    return { iniciado: true, aviso: 'A equipe começou: as faixas trabalham ao mesmo tempo, cada uma no seu minichat do cartão e com cursor próprio na tela. Termine sua resposta em uma frase. O resultado volta numa nova mensagem ("[Equipe rápida terminou]"). Não repita esta ação.' }
  }
  // Trabalho de criativo no agente escolhido no chat: começa na aba, sem cartão de confirmar (passa dos 30 s da ponte)
  if (action.handoff && !action.handoff(args) && !action.risky && name !== 'consultar_agente') {
    const work = useIaraFeed.getState().work
    if (work) {
      const who = creativeAgent(args)
      work({ action: name, args, label: action.label?.(args) ?? name }, who)
      return {
        iniciado: true,
        aviso: `Começou: ${agentName(who)} está fazendo isso na tela. Termine sua resposta agora em uma frase. Quando acabar, você recebe o resultado numa nova mensagem ("[Trabalho pronto]") e confere. Não repita esta ação.`,
      }
    }
  }
  // Ação longa (gerar imagem, ler a Meta agora): roda como trabalho na aba, com passos e o botão de parar
  if (!isRisky(action, args) && (typeof action.long === 'function' ? action.long(args) : action.long)) {
    const work = useIaraFeed.getState().work
    if (work) {
      work({ action: name, args, label: action.label?.(args) ?? name }, chatAgent())
      return { iniciado: true, aviso: 'Começou na tela (leva alguns minutos). Termine sua resposta agora em uma frase. O resultado volta numa nova mensagem ("[Trabalho pronto]") e você confere. Não repita esta ação.' }
    }
  }
  if (name === 'consultar_agente' && !action.handoff?.(args)) throw new Error('Esse agente é você mesmo: faça a tarefa direto.')

  if (isRisky(action, args)) {
    const label = action.label?.(args) ?? name
    const handoff = action.handoff?.(args)
    const reason = typeof args.motivo === 'string' ? args.motivo.slice(0, 300) : undefined
    // O cartão de confirmar fica no chat, logo depois da resposta que o agente está escrevendo
    const card = cardOfAnswer()
    const proposal = { id: uid(), action: name, args, label, state: 'pendente' as const, handoff, reason }
    if (!card) addCard({ role: 'iara', text: '', proposals: [proposal] })
    else
      patchCard(card.id, (m) => {
        const same = m.proposals?.some((p) => p.action === name && JSON.stringify(p.args) === JSON.stringify(args))
        return same ? m : { ...m, proposals: [...(m.proposals ?? []), proposal] }
      })
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
  // O que foi feito e as imagens que a Iara olhou aparecem no chat, junto da resposta
  if (result.done.length || result.images?.length) {
    const card = cardOfAnswer() ?? { id: addCard({ role: 'iara', text: '' }) }
    patchCard(card.id, (m) => ({
      ...m,
      done: result.done.length ? [...(m.done ?? []), ...result.done] : m.done,
      images: result.images?.length ? [...(m.images ?? []), ...result.images.map((i) => i.data)].slice(-MAX_CHAT_IMAGES) : m.images,
    }))
  }
  return { feito: result.done.map((d) => ({ ok: d.ok, texto: d.label, id: d.ref, abrir: d.to })), dados: result.data ?? null, imagens: result.images ?? [] }
}
