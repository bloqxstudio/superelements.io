import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, ExternalLink, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FIELD } from '@/features/crm/ui'
import { isLocalAppUrl } from '@/features/approval/shares'
import { formatLabel, type Content, type ContentLink } from '@/features/conteudos/rules'
import { approvalUrl, sendToClient, type SendStep } from './api'
import { approvalMessage, byTime, canSendToClient, dayHeading, rangeLabel, stageOf } from './rules'
import { StageChip } from './ui'

/**
 * Enviar ao cliente: escolhe as peças que o gestor já aprovou (de início, as do período na tela
 * que ainda não foram aprovadas pelo cliente), dá um título e gera o link. As imagens saem do
 * mesmo desenho do editor, então o cliente aprova o que está no Criativos agora.
 */
export const SendDialog: React.FC<{
  open: boolean
  teamId: string
  contents: Content[]
  creatives: Record<string, ContentLink>
  range: { from: string; to: string }
  /** Peças já escolhidas (a Iara ou o botão do painel). */
  preselect?: string[]
  presetTitle?: string
  onClose: () => void
  onSent: () => void
}> = ({ open, teamId, contents, creatives, range, preselect, presetTitle, onClose, onSent }) => {
  const ready = useMemo(() => contents.filter(canSendToClient).sort((a, b) => (a.editorialDate ?? '9999').localeCompare(b.editorialDate ?? '9999') || byTime(a, b)), [contents])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<SendStep>()
  const [busy, setBusy] = useState(false)
  const [linkId, setLinkId] = useState<string>()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const inRange = ready.filter((c) => c.editorialDate && c.editorialDate >= range.from && c.editorialDate <= range.to && c.clientStatus !== 'aprovado' && c.clientStatus !== 'enviado')
    setPicked(new Set(preselect?.length ? ready.filter((c) => preselect.includes(c.id)).map((c) => c.id) : inRange.map((c) => c.id)))
    setTitle(presetTitle || `Pauta ${rangeLabel(range.from, range.to)}`)
    setMessage('')
    setStep(undefined)
    setBusy(false)
    setLinkId(undefined)
    setCopied(false)
  }, [open, ready, range.from, range.to, preselect, presetTitle])

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const send = async () => {
    const chosen = ready.filter((c) => picked.has(c.id))
    if (!chosen.length || !title.trim()) return
    setBusy(true)
    try {
      const id = await sendToClient(teamId, title, message, chosen, creatives, setStep)
      setLinkId(id)
      onSent()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui enviar.')
    } finally {
      setBusy(false)
      setStep(undefined)
    }
  }

  const url = linkId ? approvalUrl(linkId) : ''
  const text = linkId ? approvalMessage(title, url, picked.size) : ''

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Não consegui copiar.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{linkId ? 'Link pronto' : 'Enviar ao cliente'}</DialogTitle>
          <DialogDescription>
            {linkId ? 'O cliente abre sem login, vê cada peça, aprova ou pede ajuste e comenta. As respostas aparecem na Pauta.' : 'Só vão as peças que o gestor já aprovou. O cliente aprova e comenta; editar continua só com a equipe.'}
          </DialogDescription>
        </DialogHeader>

        {linkId ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700">{url}</span>
              <Button size="sm" variant="outline" onClick={() => void copy(url)}>
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden /> : <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                Copiar
              </Button>
            </div>
            {isLocalAppUrl() && <p className="text-xs text-amber-800">Este endereço é deste computador: o cliente só abre com o app publicado.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copy(text)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Copiar com mensagem
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                  <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Mandar no WhatsApp
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Ver como o cliente
                </a>
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>Pronto</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">Título do envio</span>
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={cn(FIELD, 'h-9')} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">
                Recado para o cliente <span className="font-normal text-gray-500">(opcional)</span>
              </span>
              <textarea rows={2} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: as peças da semana que vem; precisamos da resposta até quinta." className={cn(FIELD, 'py-2')} />
            </label>

            <fieldset>
              <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium text-gray-800">
                Peças <span className="text-xs font-normal text-gray-500">{picked.size} de {ready.length} aprovadas pelo gestor</span>
              </legend>
              {ready.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">Nenhuma peça aprovada pelo gestor ainda. Aprove em Conteúdos (estado "Em revisão" → "Aprovar").</p>
              ) : (
                <ul className="max-h-[320px] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                  {ready.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                        <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded border-gray-300" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900">{c.title}</span>
                          <span className="block text-xs text-gray-500">
                            {c.editorialDate ? dayHeading(c.editorialDate) : 'Sem data'}
                            {c.scheduledTime && ` · ${c.scheduledTime}`} · {formatLabel(c.format)}
                            {!creatives[c.id] && ' · sem criativo (vai o roteiro)'}
                          </span>
                        </span>
                        <StageChip stage={stageOf(c)} />
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {step && (
              <p className="flex items-center gap-2 text-sm text-gray-600" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {step.done < step.total ? `Preparando ${step.done + 1} de ${step.total}: ${step.label}` : step.label}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={() => void send()} disabled={busy || !picked.size || !title.trim()}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-1.5 h-4 w-4" aria-hidden />}
                Gerar link de aprovação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
