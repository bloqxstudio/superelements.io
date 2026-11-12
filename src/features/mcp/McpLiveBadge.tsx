import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { actorColor, actorLabel, useMcpLive, type McpEvent } from './live'

/**
 * O aviso flutuante da IA conectada, em qualquer tela: quem é, o que está fazendo agora e, no fim, um atalho
 * para o que mudou. As telas com cursor próprio (Criativos, Quadros) mostram também o cursor no lugar.
 */

const DOING: Record<string, [string, string]> = {
  sinfy_criativo_criar: ['criando um criativo', 'criou um criativo'],
  sinfy_criativo_editar: ['editando um criativo', 'editou o criativo'],
  sinfy_criativo_foto: ['pondo uma foto no criativo', 'pôs a foto no criativo'],
  sinfy_publicar: ['preparando a publicação', 'preparou a publicação'],
  sinfy_publicacoes: ['olhando a fila de publicação', 'conferiu a fila de publicação'],
  sinfy_conteudo_criar: ['criando um conteúdo na Pauta', 'criou um conteúdo na Pauta'],
  sinfy_conteudo_atualizar: ['editando um conteúdo da Pauta', 'editou um conteúdo da Pauta'],
  sinfy_oportunidade_salvar: ['mexendo numa oportunidade', 'atualizou uma oportunidade'],
  sinfy_quadro_criar: ['criando um quadro', 'criou um quadro'],
  sinfy_quadro_adicionar: ['pondo um bloco no quadro', 'pôs um bloco no quadro'],
  sinfy_quadro_editar: ['editando o quadro', 'editou o quadro'],
  sinfy_cerebro_escrever: ['escrevendo no Cérebro', 'escreveu no Cérebro'],
  sinfy_cerebro_log: ['registrando no Cérebro', 'registrou no Cérebro'],
  sinfy_cerebro_imagem_salvar: ['guardando uma imagem no Cérebro', 'guardou uma imagem no Cérebro'],
  sinfy_link_envio: ['gerando um link de envio', 'gerou um link de envio de fotos'],
  sinfy_referencia_salvar: ['salvando uma referência', 'salvou uma referência'],
  sinfy_formulario_salvar: ['montando um formulário', 'salvou um formulário'],
  sinfy_whatsapp_enviar: ['mandando uma mensagem no WhatsApp', 'mandou a mensagem no WhatsApp'],
  sinfy_dados_gravar: ['gravando dados', 'gravou os dados'],
  sinfy_plano_salvar: ['mudando o Plano', 'mudou o Plano'],
}

const doing = (e: McpEvent) => {
  if (e.phase === 'upload') return 'chegou uma foto no Cérebro'
  const known = DOING[e.tool]
  if (known) return e.phase === 'start' ? `${known[0]}…` : known[1]
  const what = e.titulo ? e.titulo.toLowerCase() : 'a plataforma'
  return e.phase === 'start' ? `usando ${what}…` : `terminou: ${what}`
}

const linkOf = (e: McpEvent): string | undefined => {
  const c = e.criado ?? {}
  const projeto = typeof e.onde.projeto_id === 'string' ? `?projeto=${e.onde.projeto_id}` : ''
  if (c.conjunto || (e.tool.startsWith('sinfy_criativo') && typeof e.onde.id === 'string')) return `/criativos/${c.conjunto ?? e.onde.id}${projeto}`
  if (c.quadro || typeof e.onde.quadro === 'string') return `/quadros/${c.quadro ?? e.onde.quadro}`
  if (c.conteudo) return `/conteudos/${c.conteudo}`
  if (e.tool.startsWith('sinfy_cerebro') || e.phase === 'upload') return '/cerebro'
  if (e.tool === 'sinfy_publicar' || e.tool === 'sinfy_publicacoes') return '/crm/instagram'
  if (e.tool.startsWith('sinfy_oportunidade')) return '/crm'
  if (e.tool.startsWith('sinfy_conteudo')) return '/crm/pauta'
  return undefined
}

export const McpLiveBadge: React.FC = () => {
  const current = useMcpLive((s) => s.current)
  const clear = useMcpLive((s) => s.clear)
  const [shown, setShown] = useState<McpEvent>()

  useEffect(() => {
    if (!current) return
    // Leituras rápidas não piscam na tela: só o que muda, ou o que demora
    if (current.phase === 'start' && !current.muda) {
      const t = setTimeout(() => setShown(current), 1200)
      return () => clearTimeout(t)
    }
    setShown(current)
    if (current.phase === 'start') return
    const t = setTimeout(() => { setShown(undefined); clear() }, current.ok === false ? 8000 : 5000)
    return () => clearTimeout(t)
  }, [current, clear])

  if (!shown || (shown.phase === 'done' && !shown.muda && shown.ok !== false)) return null
  const color = actorColor(shown)
  const href = shown.phase !== 'start' && shown.ok !== false ? linkOf(shown) : undefined
  return (
    <div className="se-dock-inset pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0" role="status" aria-live="polite">
      <div className="pointer-events-auto flex max-w-[92vw] items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 text-sm shadow-lg ring-1 ring-black/5">
        <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-white" style={{ background: color }}>
          {shown.phase === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shown.ok === false ? <TriangleAlert className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {actorLabel(shown)}
        </span>
        <span className="min-w-0 truncate text-gray-700">
          {shown.ok === false ? `não conseguiu: ${shown.erro ?? 'tente de novo'}` : doing(shown)}
        </span>
        {href && <Link to={href} className="shrink-0 text-xs font-medium text-gray-900 underline underline-offset-2">Ver</Link>}
      </div>
    </div>
  )
}
