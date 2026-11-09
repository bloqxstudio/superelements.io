import React, { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Send, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCrm } from '@/features/crm/crmStore'
import { cn } from '@/lib/utils'
import { accountInstagram, latestCreativeApproval, sendCreativeApproval, VIEW_LABEL, viewOf, viewsFor, type ApprovalView, type CreativeApprovalStatus } from './approval'
import { hasMotion } from './motion'
import type { CreativeSet, Post } from './types'
import { videoSupported } from './video'

/**
 * "Enviar para aprovação" do editor de criativos (2026-11-09): gera o post (imagens, ou vídeo quando
 * tem motion), cria o link e mostra para copiar ou abrir no WhatsApp. O cliente vê como fica no
 * Instagram e aprova ou pede ajuste. Mostra também a última resposta do cliente a este post.
 */

const field = 'h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm outline-none focus:border-gray-400'

export const ApprovalDialog: React.FC<{ set: CreativeSet; post: Post; open: boolean; onClose: () => void }> = ({ set, post, open, onClose }) => {
  const team = useCrm((s) => s.team)
  const [scope, setScope] = useState<'post' | 'todos'>('post')
  const [view, setView] = useState<ApprovalView>(viewOf(post))
  const [title, setTitle] = useState(`${set.name}${post.name ? ` · ${post.name}` : ''}`)
  const [message, setMessage] = useState('')
  const [ig, setIg] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [result, setResult] = useState<string>()
  const [last, setLast] = useState<CreativeApprovalStatus>()

  useEffect(() => {
    if (!open || !team) return
    void accountInstagram(team.id).then((u) => u && setIg((cur) => cur || u))
    void latestCreativeApproval(set.id, post.id).then(setLast)
  }, [open, team, set.id, post.id])

  const posts = scope === 'post' ? [post] : set.posts.filter((p) => p.slides.length)
  const moving = posts.some(hasMotion)
  const noVideo = moving && !videoSupported()

  const send = async () => {
    if (!team || busy) return
    setBusy(true)
    setStep('Preparando')
    try {
      const out = await sendCreativeApproval({
        teamId: team.id,
        set,
        posts: posts.map((p) => ({ post: p, view: scope === 'post' ? view : viewOf(p) })),
        title: title.trim() || set.name,
        message,
        ig,
        onStep: setStep,
      })
      setResult(out.url)
      toast.success('Link de aprovação pronto')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não consegui criar o link.')
    } finally {
      setBusy(false)
      setStep('')
    }
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.message(url)
    }
  }

  const whatsapp = (url: string) => `https://wa.me/?text=${encodeURIComponent(`${message.trim() ? `${message.trim()}\n\n` : ''}Para aprovar o criativo: ${url}`)}`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar para aprovação</DialogTitle>
          <DialogDescription>O cliente abre o link, vê como fica no Instagram dele e aprova ou pede ajuste. Não precisa de login.</DialogDescription>
        </DialogHeader>

        {last && !result && (
          <div className={cn('rounded-lg p-3 text-xs', last.decision === 'aprovado' ? 'bg-emerald-50 text-emerald-900' : last.decision === 'ajuste' ? 'bg-red-50 text-red-900' : 'bg-gray-50 text-gray-700')}>
            <p className="flex items-center gap-1.5 font-medium">
              {last.decision === 'aprovado' ? <Check className="h-3.5 w-3.5" /> : last.decision === 'ajuste' ? <Undo2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {last.decision === 'aprovado' ? `Aprovado${last.decidedName ? ` por ${last.decidedName}` : ''}` : last.decision === 'ajuste' ? `Ajuste pedido${last.decidedName ? ` por ${last.decidedName}` : ''}` : 'Enviado, esperando o cliente'}
              <span className="font-normal opacity-70">· enviado em {new Date(last.sentAt).toLocaleDateString('pt-BR')}</span>
            </p>
            {last.comments.filter((c) => c.client).slice(-3).map((c) => (
              <p key={c.id} className="mt-1.5 whitespace-pre-line"><b>{c.name}:</b> {c.body}</p>
            ))}
            <a href={last.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 underline underline-offset-2">Abrir o último link <ExternalLink className="h-3 w-3" /></a>
          </div>
        )}

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Mande este link para o cliente:</p>
            <div className="flex gap-2">
              <input readOnly value={result} className={cn(field, 'text-xs')} onFocus={(e) => e.currentTarget.select()} />
              <Button size="sm" variant="outline" onClick={() => void copy(result)}><Copy className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <a href={whatsapp(result)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Mandar pelo WhatsApp</a>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={result} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver como o cliente</a>
              </Button>
            </div>
            <p className="text-xs text-gray-500">O WhatsApp abre com a mensagem pronta; você escolhe o contato e envia. A resposta do cliente aparece aqui e na Pauta.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {set.posts.length > 1 && (
              <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs" role="radiogroup" aria-label="O que enviar">
                {(['post', 'todos'] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)} className={cn('h-8 flex-1 rounded-md font-medium', scope === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
                    {s === 'post' ? 'Este post' : `Todos os ${set.posts.length} posts`}
                  </button>
                ))}
              </div>
            )}
            {scope === 'post' && viewsFor(post).length > 1 && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700">Como vai aparecer</span>
                <select value={view} onChange={(e) => setView(e.target.value as ApprovalView)} className={field}>
                  {viewsFor(post).map((v) => <option key={v} value={v}>{VIEW_LABEL[v]}</option>)}
                </select>
              </label>
            )}
            {scope === 'post' && viewsFor(post).length === 1 && <p className="text-xs text-gray-500">Vai aparecer como <b>{VIEW_LABEL[view]}</b>{moving ? ', em vídeo (o motion do post)' : ''}.</p>}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">Título do envio</span>
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">Mensagem para o cliente <span className="font-normal text-gray-400">(opcional)</span></span>
              <textarea value={message} maxLength={1000} rows={2} onChange={(e) => setMessage(e.target.value)} className={cn(field, 'h-auto py-2')} placeholder="Ex.: segue o post da semana para aprovar." />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">@ do Instagram na simulação</span>
              <input value={ig} maxLength={31} onChange={(e) => setIg(e.target.value.replace(/\s/g, ''))} className={field} placeholder="suaempresa" />
            </label>
            {noVideo && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Este navegador não gera vídeo (use o Chrome ou o Edge): o motion vai como imagem parada.</p>}
            <div className="flex items-center gap-2 pt-1">
              <Button onClick={() => void send()} disabled={busy || !team || !posts.length} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Criar o link
              </Button>
              {busy && <span className="text-xs text-gray-500" role="status">{step}…</span>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
