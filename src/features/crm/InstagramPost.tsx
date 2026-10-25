import React, { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, ExternalLink, Loader2, MessageCircleReply, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FIELD, whenLabel } from './ui'
import { FORMAT_LABEL, compact, deleteComment, engagementOf, formatOf, hideComment, interactionsOf, listComments, percent, replyComment, type IgComment, type IgMedia } from './instagram'
import { MediaThumb } from './InstagramThumb'

/** Um post aberto: os números dele, a prévia e os comentários, para responder sem abrir o app. */

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-zinc-50 px-3 py-2">
    <p className="text-[11px] text-gray-500">{label}</p>
    <p className="text-base font-semibold text-gray-900">{value}</p>
  </div>
)

const watchTime = (ms: number | undefined) => (ms === undefined ? undefined : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)

const CommentRow: React.FC<{
  comment: IgComment
  accountId: string
  username: string
  reply?: boolean
  onChanged: () => void
}> = ({ comment, accountId, username, reply, onChanged }) => {
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const mine = comment.username === username

  const run = async (label: string, job: () => Promise<unknown>, done: string) => {
    setBusy(label)
    try {
      await job()
      toast.success(done)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void run('reply', () => replyComment(accountId, comment.id, text.trim()), 'Resposta publicada').then(() => {
      setText('')
      setWriting(false)
    })
  }

  return (
    <li className={cn('py-3', reply && 'ml-6 border-l border-gray-100 py-2 pl-3')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm leading-relaxed text-gray-800', comment.hidden && 'text-gray-400')}>
            <span className="mr-1.5 font-semibold text-gray-900">{comment.username ?? 'alguém'}</span>
            {comment.text}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {whenLabel(Date.parse(comment.timestamp))}
            {comment.like_count ? ` · ${comment.like_count} curtida${comment.like_count > 1 ? 's' : ''}` : ''}
            {comment.hidden ? ' · oculto para os outros' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!reply && (
            <button type="button" onClick={() => setWriting((w) => !w)} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Responder" title="Responder">
              <MessageCircleReply className="h-3.5 w-3.5" />
            </button>
          )}
          {!mine && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void run('hide', () => hideComment(accountId, comment.id, !comment.hidden), comment.hidden ? 'Comentário visível de novo' : 'Comentário ocultado')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              aria-label={comment.hidden ? 'Mostrar para todos' : 'Ocultar'}
              title={comment.hidden ? 'Mostrar para todos' : 'Ocultar (só quem escreveu continua vendo)'}
            >
              {busy === 'hide' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : comment.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          )}
          {confirmDelete ? (
            <span className="flex items-center gap-1 pl-1">
              <button type="button" disabled={!!busy} onClick={() => void run('delete', () => deleteComment(accountId, comment.id), 'Comentário excluído')} className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {busy === 'delete' ? 'Excluindo…' : 'Excluir'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100">
                Não
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-rose-50 hover:text-rose-700" aria-label="Excluir" title="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {writing && (
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input
            autoFocus
            className={cn(FIELD, 'h-9 flex-1')}
            value={text}
            maxLength={2200}
            placeholder={`Responder a @${comment.username ?? 'alguém'}`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setWriting(false)}
          />
          <Button type="submit" size="sm" disabled={!text.trim() || busy === 'reply'}>
            {busy === 'reply' ? 'Enviando…' : 'Responder'}
          </Button>
        </form>
      )}
      {comment.replies?.data?.length ? (
        <ul>
          {[...comment.replies.data]
            .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
            .map((r) => (
              <CommentRow key={r.id} comment={r} accountId={accountId} username={username} reply onChanged={onChanged} />
            ))}
        </ul>
      ) : null}
    </li>
  )
}

export const PostPanel: React.FC<{ media: IgMedia | null; accountId: string; username: string; publisher?: string; onClose: () => void }> = ({ media, accountId, username, publisher, onClose }) => {
  const [comments, setComments] = useState<IgComment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    if (!media || media.product === 'STORY') return
    setLoading(true)
    setError(null)
    listComments(accountId, media.id)
      .then((list) => setComments(list.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [media, accountId])

  useEffect(() => {
    setComments(null)
    load()
  }, [load])

  if (!media) return null
  const i = media.insights
  const format = formatOf(media)
  const metrics: [string, string][] = [
    ['Alcance', compact(i.reach)],
    ['Visualizações', compact(i.views)],
    ['Curtidas', compact(i.likes ?? media.likes)],
    ['Comentários', compact(i.comments ?? media.comments)],
    ['Compartilhamentos', compact(i.shares)],
    ['Salvos', compact(i.saved)],
    ['Interações', compact(interactionsOf(media))],
    ['Taxa de engajamento', percent(engagementOf(media))],
  ]
  if (format === 'reels' && i.ig_reels_avg_watch_time !== undefined) metrics.push(['Tempo médio assistido', watchTime(i.ig_reels_avg_watch_time)!])
  if (i.follows !== undefined) metrics.push(['Seguiram a partir dele', compact(i.follows)])
  if (i.profile_visits !== undefined) metrics.push(['Visitas ao perfil', compact(i.profile_visits)])
  if (i.replies !== undefined) metrics.push(['Respostas', compact(i.replies)])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <div className="grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="bg-zinc-100 md:min-h-full">
            {format === 'reels' || (format === 'story' && media.type === 'VIDEO') ? (
              media.mediaUrl ? (
                <video src={media.mediaUrl} poster={media.thumbnail} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
              ) : (
                <MediaThumb media={media} className="aspect-[9/16] w-full" />
              )
            ) : (
              <MediaThumb media={media} className="aspect-[4/5] w-full" />
            )}
          </div>
          <div className="min-w-0 p-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base">
                {FORMAT_LABEL[format]} de {new Date(media.postedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {publisher ? `Publicado pela plataforma por ${publisher}` : 'Publicado no Instagram'}
                {media.permalink && (
                  <>
                    {' · '}
                    <a href={media.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-gray-700 hover:underline">
                      Abrir no Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {media.caption && <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-gray-700">{media.caption}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {metrics.map(([label, value]) => (
                <Metric key={label} label={label} value={value} />
              ))}
            </div>
            {!Object.keys(i).length && <p className="mt-2 text-xs text-gray-500">Os números deste post chegam na próxima atualização (a Meta leva até 48 horas para fechar).</p>}

            {media.product === 'STORY' ? (
              <p className="mt-5 text-xs text-gray-500">Stories não têm comentários. Os números ficam guardados como estavam na última leitura com o story no ar.</p>
            ) : (
              <section className="mt-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Comentários{comments ? ` (${comments.length})` : ''}</h3>
                  <button type="button" onClick={load} disabled={loading} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Recarregar
                  </button>
                </div>
                {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
                {comments === null && loading && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo os comentários…
                  </p>
                )}
                {comments && !comments.length && <p className="mt-3 text-xs text-gray-500">Nenhum comentário ainda.</p>}
                {comments && comments.length > 0 && (
                  <ul className="mt-1 divide-y divide-gray-100">
                    {comments.map((c) => (
                      <CommentRow key={c.id} comment={c} accountId={accountId} username={username} onChanged={load} />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
