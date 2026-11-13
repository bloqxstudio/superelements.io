import { useEffect } from 'react'
import { toast } from 'sonner'
import { useCrm } from '@/features/crm/crmStore'

/**
 * "Copiar para a IA" de qualquer tela (2026-11-12, o usuário: "permita pegar o id de qualquer coisa para poder
 * enviar para a ia"). Monta, a partir do endereço aberto e do que está escolhido, um texto curto com os ids e a
 * ferramenta da Sinfy (MCP) que abre cada coisa. A pessoa cola no chat do ChatGPT, do Claude ou do Cursor.
 * Telas com escolha própria (Referências) registram a escolha com `useAiSelection`.
 */

const extra = new Map<string, string>()

/** Uma tela diz o que está escolhido nela (ou nada), para entrar no texto copiado. */
export function useAiSelection(key: string, text: string | undefined) {
  useEffect(() => {
    if (text) extra.set(key, text)
    else extra.delete(key)
    return () => { extra.delete(key) }
  }, [key, text])
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export async function aiContext(): Promise<string> {
  const { pathname, search } = window.location
  const q = new URLSearchParams(search)
  const team = useCrm.getState().team
  const lines: string[] = []
  let m: RegExpExecArray | null

  if ((m = /^\/(?:criativos|motion)\/([^/]+)/.exec(pathname))) {
    const setId = decodeURIComponent(m[1])
    const { useEditor } = await import('@/features/criativos/store')
    const st = useEditor.getState()
    const projeto = q.get('projeto')
    const posts = st.set?.id === setId ? st.set.posts : []
    const pi = posts.findIndex((p) => p.id === st.postId)
    const si = pi >= 0 ? posts[pi].slides.findIndex((s) => s.id === st.slideId) : -1
    const where = [pi >= 0 && `"post": ${pi + 1}`, si >= 0 && !st.row && `"slide": ${si + 1}`].filter(Boolean).join(', ')
    lines.push(`Criativo "${st.set?.name ?? setId}": "id": "${setId}"${projeto ? `, "projeto_id": "${projeto}"` : ''}${where ? `, ${where}` : ''}${pi >= 0 ? ` (o que está escolhido: post ${pi + 1}${si >= 0 && !st.row ? `, slide ${si + 1}` : ' inteiro'})` : ''}.`)
    lines.push('Ferramentas: sinfy_criativo (textos), sinfy_criativo_ver (imagens), sinfy_criativo_editar (mudar), sinfy_criativo_foto, sinfy_publicar.')
  } else if ((m = new RegExp(`^/quadros/(${UUID})`).exec(pathname))) {
    const id = m[1]
    const { openBoard } = await import('@/features/quadros/openBoard')
    const api = openBoard(id)?.api
    const sel = api ? Object.keys(api.getAppState().selectedElementIds ?? {}).filter((k) => api.getAppState().selectedElementIds[k]) : []
    lines.push(`Quadro: "quadro": "${id}"${sel.length ? `; itens escolhidos: ${sel.slice(0, 30).map((s) => `#${s}`).join(', ')}` : ''}.`)
    lines.push('Ferramentas: sinfy_quadro_ler, sinfy_quadro_adicionar, sinfy_quadro_editar (itens pelo id).')
  } else if ((m = new RegExp(`^/conteudos/(${UUID})`).exec(pathname)) || (pathname.startsWith('/crm/pauta') && q.get('peca'))) {
    const id = m?.[1] ?? q.get('peca')!
    lines.push(`Conteúdo da Pauta: "id": "${id}". Ferramentas: sinfy_conteudos, sinfy_conteudo_atualizar; sinfy_criativo_criar com "conteudo_id": "${id}".`)
  } else if ((m = new RegExp(`^/crm/clientes/(${UUID})`).exec(pathname))) {
    lines.push(`Cliente do CRM: "${m[1]}". Ferramentas: sinfy_dados_ler (tabela crm_clients, filtro id), sinfy_oportunidade_salvar com "cliente_id": "${m[1]}".`)
  } else if ((m = new RegExp(`^/crm/formularios/(${UUID})`).exec(pathname))) {
    lines.push(`Formulário: "id": "${m[1]}". Ferramentas: sinfy_dados_ler (crm_forms, crm_form_submissions), sinfy_formulario_salvar com o id.`)
  } else if ((m = new RegExp(`^/crm/funis/(${UUID})`).exec(pathname))) {
    lines.push(`Funil visual: "${m[1]}". Ferramentas: sinfy_dados_ler (crm_funnels, crm_funnel_steps com funnel_id).`)
  } else if ((m = /^\/projetos\/([^/]+)/.exec(pathname))) {
    lines.push(`Projeto (site): "projeto_id": "${m[1]}" (criativos deste projeto: sinfy_criativo_criar com "projeto_id").`)
  } else if (pathname.startsWith('/cerebro')) {
    const nota = q.get('nota')
    const pasta = q.get('pasta')
    const midia = q.get('midia')
    if (nota) lines.push(`Nota do Cérebro: "nota": "${nota}". Ferramentas: sinfy_cerebro_ler, sinfy_cerebro_escrever.`)
    else if (midia) lines.push(`Arquivo do Cérebro: "${midia}". Ferramentas: sinfy_cerebro_arquivos ("ver"), sinfy_criativo_foto ("arquivo").`)
    else if (pasta) lines.push(`Pasta do Cérebro: "${pasta}". Ferramentas: sinfy_cerebro_ler / sinfy_cerebro_arquivos com "pasta".`)
  }
  const opp = q.get('oportunidade')
  if (opp && new RegExp(`^${UUID}$`).test(opp)) lines.push(`Oportunidade: "id": "${opp}". Ferramentas: sinfy_oportunidades, sinfy_oportunidade_salvar.`)
  for (const t of extra.values()) lines.push(t)

  const head = `Na Sinfy${team ? ` (conta ${team.name})` : ''}, tela ${pathname}${search}.`
  return [head, ...(lines.length ? lines : ['(Nada específico escolhido: use sinfy_ajuda para ver o que dá para fazer.)'])].join('\n')
}

export async function copyAiContext() {
  const text = await aiContext()
  return navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado para a IA', { description: text.split('\n').slice(1, 2).join(' ').slice(0, 140) || 'Cole no chat da sua IA conectada.' }),
    () => toast.error('Não consegui copiar'),
  )
}
