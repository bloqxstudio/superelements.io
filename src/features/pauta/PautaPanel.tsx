import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, CircleAlert, ExternalLink, Images, Loader2, Lock, MessageSquare, Trash2, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FIELD } from '@/features/crm/ui'
import { formatLabel, type Content, type ContentLink } from '@/features/conteudos/rules'
import { setHash, setPath } from '@/features/conteudos/forward'
import { loadSet } from '@/features/criativos/storage'
import { addComment, deleteComment, listComments, mediaUrl, resolveComment, scheduleContent, type Comment, type CoverInfo, type SentItem } from './api'
import { CHANNELS, channelOfFormat, stageOf } from './rules'
import { SlideViewer, StageChip, ratioOf, timeLabel } from './ui'

const DECISION_TEXT: Record<SentItem['decision'], string> = { pendente: 'Esperando o cliente', aprovado: 'Aprovado pelo cliente', ajuste: 'O cliente pediu ajuste' }

/**
 * Uma peça da Pauta: agenda (dia, horário, canal), a prévia do que foi ao cliente (ou as capas do
 * criativo ainda não enviado), a decisão do cliente e a conversa. Comentário "Com o cliente"
 * aparece no link; "Interno" fica só na equipe.
 */
export const PautaPanel: React.FC<{
  content: Content
  creative?: ContentLink
  cover?: CoverInfo
  sent?: SentItem
  me?: string
  manager: boolean
  onClose: () => void
  onChanged: (c: Content) => void
}> = ({ content, creative, cover, sent, me, manager, onClose, onChanged }) => {
  const [date, setDate] = useState(content.editorialDate ?? '')
  const [time, setTime] = useState(content.scheduledTime ?? '')
  const [channel, setChannel] = useState(content.channel ?? channelOfFormat(content.format) ?? '')
  const [saving, setSaving] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [tab, setTab] = useState<'cliente' | 'interno'>('cliente')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [post, setPost] = useState(0)
  const [slide, setSlide] = useState(0)
  const [creativeChanged, setCreativeChanged] = useState(false)

  useEffect(() => {
    setDate(content.editorialDate ?? '')
    setTime(content.scheduledTime ?? '')
    setChannel(content.channel ?? channelOfFormat(content.format) ?? '')
  }, [content.id, content.editorialDate, content.scheduledTime, content.channel, content.format])

  useEffect(() => setPost(0), [content.id])

  const readComments = useCallback(async () => {
    try {
      setComments(await listComments(content.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui ler os comentários.')
      setComments([])
    }
  }, [content.id])

  useEffect(() => {
    setComments(null)
    void readComments()
  }, [readComments, sent?.id])

  // O criativo mudou depois do envio? Só confere quando há envio e criativo ligado.
  useEffect(() => {
    setCreativeChanged(false)
    if (!sent?.setHash || !creative) return
    let stop = false
    void loadSet(creative.artifactId, creative.projectId)
      .then(async (set) => {
        if (!stop && set) setCreativeChanged((await setHash(set)) !== sent.setHash)
      })
      .catch(() => undefined)
    return () => {
      stop = true
    }
  }, [sent?.id, sent?.setHash, creative])

  const stage = stageOf(content)
  const dirty = date !== (content.editorialDate ?? '') || (date ? time : '') !== (content.scheduledTime ?? '') || channel !== (content.channel ?? channelOfFormat(content.format) ?? '')
  const textChanged = !!sent && sent.contentHash !== content.contentHash

  const save = async () => {
    setSaving(true)
    try {
      onChanged(await scheduleContent(content, date || null, time || null, channel || null))
      toast.success('Agenda salva.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setSaving(false)
    }
  }

  // O que mostrar: o que foi ao cliente; sem envio, as capas do criativo
  const sentPosts = sent?.media.filter((m) => m.slides.length) ?? []
  const current = sentPosts[Math.min(post, Math.max(0, sentPosts.length - 1))]
  const currentUrls = useMemo(() => (current ? current.slides.map(mediaUrl) : []), [current])
  const coverPosts = cover?.posts.filter((p) => p.cover && cover.urls[p.cover]) ?? []

  const shown = (comments ?? []).filter((c) => (tab === 'interno' ? c.internal : !c.internal))
  const openCount = (comments ?? []).filter((c) => c.client && !c.resolved).length

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setPosting(true)
    try {
      const ref = tab === 'cliente' && current ? { post: post + 1, slide: slide + 1 } : {}
      const made = await addComment(content.id, text.trim(), tab === 'interno', ref.post, ref.slide)
      setComments((list) => [...(list ?? []), made])
      setText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui comentar.')
    } finally {
      setPosting(false)
    }
  }

  const toggle = async (c: Comment) => {
    try {
      await resolveComment(c.id, !c.resolved)
      setComments((list) => (list ?? []).map((x) => (x.id === c.id ? { ...x, resolved: !c.resolved } : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui marcar.')
    }
  }

  const remove = async (c: Comment) => {
    try {
      await deleteComment(c.id)
      setComments((list) => (list ?? []).filter((x) => x.id !== c.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui apagar.')
    }
  }

  return (
    <aside aria-label={`Peça: ${content.title}`} className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-gray-200 bg-white shadow-[-12px_0_32px_-16px_rgb(0_0_0/0.18)]">
      <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StageChip stage={stage} />
            <span className="text-xs text-gray-500">{formatLabel(content.format)}</span>
          </div>
          <h2 className="mt-1.5 text-base font-semibold leading-snug text-gray-900">{content.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-1 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/conteudos/${content.id}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Abrir conteúdo
            </Link>
          </Button>
          {creative && (
            <Button asChild size="sm" variant="outline">
              <Link to={setPath(content, creative.projectId)}>
                <Images className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Abrir criativo
              </Link>
            </Button>
          )}
        </div>

        <section aria-label="Agenda" className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Agenda</h3>
          <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
            <label className="text-xs text-gray-600">
              Dia
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(FIELD, 'mt-1 h-9')} />
            </label>
            <label className="text-xs text-gray-600">
              Horário
              <input type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} className={cn(FIELD, 'mt-1 h-9')} />
            </label>
          </div>
          <label className="mt-2 block text-xs text-gray-600">
            Canal
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={cn(FIELD, 'mt-1 h-9')}>
              <option value="">Sem canal</option>
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {dirty && (
            <Button size="sm" className="mt-2" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
              Salvar agenda
            </Button>
          )}
        </section>

        <section aria-label="Prévia" className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{sent ? 'O que o cliente vê' : 'Criativo'}</h3>
          {sent && current ? (
            <>
              {sentPosts.length > 1 && (
                <div role="tablist" aria-label="Posts" className="mt-2 flex flex-wrap gap-1">
                  {sentPosts.map((p, i) => (
                    <button key={i} type="button" role="tab" aria-selected={i === post} onClick={() => setPost(i)} className={cn('h-7 rounded-full border px-2.5 text-xs', i === post ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300')}>
                      {p.name || `Post ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}
              <SlideViewer urls={currentUrls} ratio={ratioOf(current.format)} onSlide={setSlide} className="mx-auto mt-2 max-h-[420px]" label={current.name || content.title} />
              {current.caption && <p className="mt-3 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">{current.caption}</p>}
            </>
          ) : coverPosts.length ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {coverPosts.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-md bg-gray-100">
                  <img src={cover!.urls[p.cover!]} alt={p.name} className="w-full object-cover" style={{ aspectRatio: String(ratioOf(p.format)) }} loading="lazy" />
                  <figcaption className="truncate px-1.5 py-1 text-[11px] text-gray-600">{p.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">{creative ? 'O criativo ainda não tem capas. Abra-o uma vez para gerar.' : 'Sem criativo ligado. O cliente verá o roteiro.'}</p>
          )}
        </section>

        {sent && (
          <section aria-label="Resposta do cliente" className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</h3>
            <p className={cn('mt-2 flex items-center gap-2 text-sm', sent.decision === 'aprovado' ? 'text-emerald-800' : sent.decision === 'ajuste' ? 'text-red-800' : 'text-amber-900')}>
              {sent.decision === 'aprovado' ? <Check className="h-4 w-4" aria-hidden /> : sent.decision === 'ajuste' ? <Undo2 className="h-4 w-4" aria-hidden /> : <Loader2 className="h-4 w-4" aria-hidden />}
              {DECISION_TEXT[sent.decision]}
              {sent.decidedName && <span className="text-gray-500">· {sent.decidedName}{sent.decidedAt ? `, ${timeLabel(sent.decidedAt)}` : ''}</span>}
            </p>
            <p className="mt-1 text-xs text-gray-500">Enviado em {timeLabel(sent.createdAt)}.</p>
            {(textChanged || creativeChanged) && (
              <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {textChanged ? 'O texto mudou depois do envio.' : 'O criativo mudou depois do envio.'} {manager ? 'Envie de novo para o cliente aprovar a versão nova.' : 'Peça ao gestor para enviar de novo.'}
              </p>
            )}
          </section>
        )}

        <section aria-label="Comentários" className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Conversa
              {openCount > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{openCount}</span>}
            </h3>
            <div role="tablist" aria-label="Quem vê" className="inline-flex rounded-md bg-gray-100 p-0.5">
              {(['cliente', 'interno'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium', tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>
                  {t === 'interno' && <Lock className="h-3 w-3" aria-hidden />}
                  {t === 'cliente' ? 'Com o cliente' : 'Interno'}
                </button>
              ))}
            </div>
          </div>

          {comments === null ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Lendo
            </p>
          ) : shown.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">{tab === 'interno' ? 'Notas só da equipe. O cliente não vê.' : sent ? 'Nenhum comentário ainda.' : 'Os comentários do cliente aparecem aqui depois do envio.'}</p>
          ) : (
            <ol className="mt-3 grid gap-2">
              {shown.map((c) => (
                <li key={c.id} className={cn('rounded-lg p-3 text-sm', c.client ? 'bg-amber-50' : 'bg-gray-50', c.resolved && 'opacity-60')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-900">
                      {c.name}
                      {c.client && <span className="ml-1.5 font-normal text-amber-800">cliente</span>}
                      {c.post && c.slide && <span className="ml-1.5 font-normal text-gray-500">· post {c.post}, slide {c.slide}</span>}
                    </p>
                    <span className="shrink-0 text-[11px] text-gray-500">{timeLabel(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-gray-800">{c.body}</p>
                  <div className="mt-1.5 flex gap-3 text-xs">
                    {c.client && (
                      <button type="button" onClick={() => void toggle(c)} className="font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
                        {c.resolved ? 'Reabrir' : 'Marcar como resolvido'}
                      </button>
                    )}
                    {!c.client && (c.authorId === me || manager) && (
                      <button type="button" onClick={() => void remove(c)} className="inline-flex items-center gap-1 text-gray-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" aria-hidden /> Apagar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <form onSubmit={send} className="mt-3">
            <label className="sr-only" htmlFor="pauta-comentario">
              Comentário
            </label>
            <textarea
              id="pauta-comentario"
              rows={2}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(e)
              }}
              placeholder={tab === 'interno' ? 'Nota para a equipe' : sent ? `Responder ao cliente${current ? ` (sobre o slide ${slide + 1})` : ''}` : 'Comentário (o cliente vê depois do envio)'}
              className={cn(FIELD, 'py-2')}
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={posting || !text.trim()}>
                {posting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                {tab === 'interno' ? 'Anotar' : 'Comentar'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </aside>
  )
}
