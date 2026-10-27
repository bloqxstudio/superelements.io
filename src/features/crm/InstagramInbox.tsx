import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, CircleAlert, ExternalLink, EyeOff, Loader2, MessageCircle, RefreshCw, Reply, Send, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NoTablesError, hideComment, loadMedia, replyComment, type IgAccount, type IgMedia } from '@/features/crm/instagram'
import {
  isOpenComment,
  loadComments,
  loadDms,
  loadThreads,
  markInbox,
  privateReply,
  sendDm,
  syncInbox,
  useInboxFeed,
  type InboxComment,
  type InboxDm,
  type InboxThread,
} from '@/features/crm/igInbox'
import { FIELD, Surface, plural, whenLabel } from '@/features/crm/ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * Caixa de entrada do Instagram (CRM › Instagram › Caixa): os comentários dos
 * posts recentes, para responder em público, por DM, ocultar ou dar por
 * resolvido; e as conversas do direct, para ler e responder. Os dados vêm das
 * tabelas que a função `instagram` grava (`inbox_sync`); a tela pede uma
 * leitura nova ao abrir e a cada minuto, e as mudanças chegam ao vivo.
 */

type Box = 'comentarios' | 'mensagens'
const POLL = 60_000
/** A Meta só deixa responder por DM até 24 h depois da última mensagem da pessoa. */
const DM_WINDOW = 24 * 60 * 60_000

const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))

const handleOf = (t: { username?: string; name?: string }) => (t.username ? `@${t.username}` : t.name ?? 'alguém')

// ---------- comentários ----------

const CommentCard: React.FC<{
  comment: InboxComment
  replies: InboxComment[]
  post?: IgMedia
  account: IgAccount
  onChanged: () => void
}> = ({ comment, replies, post, account, onChanged }) => {
  const [mode, setMode] = useState<'reply' | 'dm' | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(ok)
      onChanged()
      return true
    } catch (error) {
      fail(error)
      return false
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    if (!text.trim() || !mode) return
    const done =
      mode === 'reply'
        ? await run('send', () => replyComment(account.id, comment.id, text.trim()), 'Resposta publicada')
        : await run('send', () => privateReply(account.id, comment.id, text.trim()), 'Mensagem enviada no direct')
    if (done) {
      setText('')
      setMode(null)
      if (mode === 'dm') void markInbox(account.teamId, 'comment', account.id, comment.id).then(onChanged, () => undefined)
    }
  }

  const open = isOpenComment(comment)

  return (
    <li className={cn('rounded-xl bg-white p-4 ring-1 ring-inset ring-gray-200', !open && 'opacity-70')}>
      <div className="flex items-start gap-3">
        {post?.thumbnail && <img src={post.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-gray-800">
            <span className="mr-1.5 font-semibold text-gray-900">@{comment.username ?? 'alguém'}</span>
            <span className={cn(comment.hidden && 'text-gray-400')}>{comment.text}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
            <span>{whenLabel(comment.at)}</span>
            {comment.likes > 0 && <span>· {plural(comment.likes, 'curtida', 'curtidas')}</span>}
            {post?.caption && <span className="max-w-[18rem] truncate">· em “{post.caption.split('\n')[0]}”</span>}
            {comment.hidden && <span>· oculto</span>}
            {comment.replied && <span className="font-medium text-emerald-700">· respondido</span>}
            {comment.handled && <span className="font-medium text-gray-600">· resolvido</span>}
            {post?.permalink && (
              <a href={post.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-gray-900" aria-label="Abrir o post">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setMode(mode === 'reply' ? null : 'reply')} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100" title="Responder no post">
            <Reply className="h-3.5 w-3.5" /> Responder
          </button>
          {comment.fromId !== undefined && (
            <button type="button" onClick={() => setMode(mode === 'dm' ? null : 'dm')} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100" title="Mandar uma mensagem no direct">
              <MessageCircle className="h-3.5 w-3.5" /> Direct
            </button>
          )}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void run('hide', () => hideComment(account.id, comment.id, !comment.hidden), comment.hidden ? 'Comentário visível de novo' : 'Comentário ocultado')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
            aria-label={comment.hidden ? 'Mostrar para todos' : 'Ocultar'}
            title={comment.hidden ? 'Mostrar para todos' : 'Ocultar (só quem escreveu continua vendo)'}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void run('mark', () => markInbox(account.teamId, 'comment', account.id, comment.id, !comment.handled), comment.handled ? 'Voltou para a fila' : 'Resolvido')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
            aria-label={comment.handled ? 'Voltar para a fila' : 'Dar por resolvido'}
            title={comment.handled ? 'Voltar para a fila' : 'Dar por resolvido'}
          >
            {comment.handled ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <ul className="mt-3 grid gap-2 border-l-2 border-gray-100 pl-3">
          {replies.map((r) => (
            <li key={r.id} className="text-sm text-gray-700">
              <span className={cn('mr-1.5 font-semibold', r.own ? 'text-sky-700' : 'text-gray-900')}>@{r.username ?? 'alguém'}</span>
              {r.text}
              <span className="ml-2 text-xs text-gray-400">{whenLabel(r.at)}</span>
            </li>
          ))}
        </ul>
      )}

      {mode && (
        <div className="mt-3 grid gap-2">
          <textarea
            className={cn(FIELD, 'py-2 leading-relaxed')}
            rows={2}
            maxLength={mode === 'reply' ? 2200 : 1000}
            value={text}
            autoFocus
            placeholder={mode === 'reply' ? `Responder a @${comment.username ?? 'alguém'} no post` : `Mensagem direta para @${comment.username ?? 'alguém'} (só uma, até 7 dias depois do comentário)`}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void send()} disabled={!!busy || !text.trim()} className="gap-1.5">
              {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {mode === 'reply' ? 'Responder' : 'Enviar no direct'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

const CommentsBox: React.FC<{ account: IgAccount; comments: InboxComment[]; media: Map<string, IgMedia>; onChanged: () => void }> = ({ account, comments, media, onChanged }) => {
  const [only, setOnly] = useState<'abertos' | 'todos'>('abertos')
  const roots = useMemo(() => comments.filter((c) => !c.parentId), [comments])
  const repliesOf = useMemo(() => {
    const map = new Map<string, InboxComment[]>()
    for (const c of comments) if (c.parentId) map.set(c.parentId, [...(map.get(c.parentId) ?? []), c])
    for (const list of map.values()) list.sort((a, b) => a.at - b.at)
    return map
  }, [comments])
  const open = roots.filter(isOpenComment)
  const shown = (only === 'abertos' ? open : roots.filter((c) => !c.own)).slice(0, 150)

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Chip active={only === 'abertos'} onClick={() => setOnly('abertos')}>
          Em aberto <span className="tabular-nums opacity-60">{open.length}</span>
        </Chip>
        <Chip active={only === 'todos'} onClick={() => setOnly('todos')}>
          Todos
        </Chip>
      </div>
      {shown.length === 0 ? (
        <Surface>
          <p className="text-sm text-gray-600">{only === 'abertos' ? 'Nenhum comentário esperando resposta.' : 'Nenhum comentário lido ainda. Toque em Atualizar para buscar os dos últimos posts.'}</p>
        </Surface>
      ) : (
        <ul className="grid gap-2">
          {shown.map((c) => (
            <CommentCard key={c.id} comment={c} replies={repliesOf.get(c.id) ?? []} post={media.get(c.mediaId)} account={account} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- mensagens ----------

const Conversation: React.FC<{ account: IgAccount; thread: InboxThread; onSent: () => void }> = ({ account, thread, onSent }) => {
  const [messages, setMessages] = useState<InboxDm[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    loadDms(account.id, thread.participantId).then(setMessages, fail)
  }, [account.id, thread.participantId])

  useEffect(() => {
    setMessages(null)
    load()
  }, [load, thread.lastAt])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length])

  const lastFromThem = useMemo(() => [...(messages ?? [])].reverse().find((m) => !m.fromMe)?.at, [messages])
  const closed = lastFromThem !== undefined && Date.now() - lastFromThem > DM_WINDOW

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await sendDm(account.id, thread.participantId, text.trim())
      setText('')
      load()
      onSent()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <p className="min-w-0 truncate text-sm font-semibold text-gray-900">
          {handleOf(thread)}
          {thread.name && thread.username ? <span className="ml-1.5 font-normal text-gray-500">{thread.name}</span> : null}
        </p>
        {thread.username && (
          <a href={`https://instagram.com/${thread.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            Perfil <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3">
        {messages === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a conversa…
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.mid} className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed', m.fromMe ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900')}>
                {m.text ? <p className="whitespace-pre-wrap break-words">{m.text}</p> : null}
                {m.attachment && !m.text && <p className="italic opacity-70">Anexo ({m.attachment.split('/')[0]})</p>}
                <p className={cn('mt-0.5 text-[10px]', m.fromMe ? 'text-white/60' : 'text-gray-500')}>{whenLabel(m.at)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={end} />
      </div>
      {closed && (
        <p className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Faz mais de 24 horas que a pessoa escreveu: o Instagram pode recusar a resposta.
        </p>
      )}
      <form onSubmit={(e) => void submit(e)} className="flex items-end gap-2">
        <textarea
          className={cn(FIELD, 'min-h-[2.5rem] flex-1 resize-none py-2')}
          rows={2}
          maxLength={1000}
          value={text}
          placeholder="Escreva a resposta"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit(e as unknown as React.FormEvent)
            }
          }}
        />
        <Button type="submit" size="sm" disabled={busy || !text.trim()} className="gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar
        </Button>
      </form>
    </div>
  )
}

const MessagesBox: React.FC<{ account: IgAccount; threads: InboxThread[]; onChanged: () => void }> = ({ account, threads, onChanged }) => {
  const [selected, setSelected] = useState<string>()
  const thread = threads.find((t) => t.participantId === selected)

  const open = (t: InboxThread) => {
    setSelected(t.participantId)
    if (t.unread > 0) void markInbox(account.teamId, 'thread', account.id, t.participantId).then(onChanged, () => undefined)
  }

  if (!threads.length) {
    return (
      <Surface>
        <p className="text-sm text-gray-600">Nenhuma conversa lida ainda. Toque em Atualizar; se continuar vazio, conecte a conta de novo para liberar a permissão de mensagens.</p>
      </Surface>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-[20rem_1fr]">
      <ul className="max-h-[36rem] overflow-y-auto rounded-xl bg-white ring-1 ring-inset ring-gray-200">
        {threads.map((t) => (
          <li key={t.participantId}>
            <button
              type="button"
              onClick={() => open(t)}
              className={cn('flex w-full items-start gap-2 border-b border-gray-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50', selected === t.participantId && 'bg-gray-50')}
            >
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm', t.unread ? 'font-semibold text-gray-900' : 'text-gray-800')}>{handleOf(t)}</span>
                <span className="block truncate text-xs text-gray-500">
                  {t.lastFromMe ? 'Você: ' : ''}
                  {t.lastText || '…'}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-gray-400">{whenLabel(t.lastAt)}</span>
                {t.unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white tabular-nums">{t.unread}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-gray-200">
        {thread ? <Conversation account={account} thread={thread} onSent={onChanged} /> : <p className="text-sm text-gray-500">Escolha uma conversa.</p>}
      </div>
    </div>
  )
}

// ---------- a área ----------

export const InboxArea: React.FC<{ account: IgAccount }> = ({ account }) => {
  const [box, setBox] = useState<Box>('comentarios')
  const [comments, setComments] = useState<InboxComment[] | null>(null)
  const [threads, setThreads] = useState<InboxThread[] | null>(null)
  const [media, setMedia] = useState<Map<string, IgMedia>>(new Map())
  const [syncing, setSyncing] = useState(false)
  const [warning, setWarning] = useState<string[]>([])
  const [error, setError] = useState<string>()
  const broken = account.syncError === 'token'

  const reload = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([loadComments(account.id), loadThreads(account.id)])
      setComments(c)
      setThreads(t)
      setError(undefined)
    } catch (e) {
      setError(e instanceof NoTablesError ? 'Aplique a migração 20261027100000_crm_instagram_inbox.sql no Supabase.' : e instanceof Error ? e.message : String(e))
      setComments([])
      setThreads([])
    }
  }, [account.id])

  const sync = useCallback(
    async (quiet = false) => {
      if (broken) return
      setSyncing(true)
      try {
        const result = await syncInbox(account.id)
        setWarning(result.missing)
        await reload()
      } catch (e) {
        if (!quiet) fail(e)
      } finally {
        setSyncing(false)
      }
    },
    [account.id, broken, reload]
  )

  useEffect(() => {
    setComments(null)
    setThreads(null)
    void reload().then(() => sync(true))
    loadMedia(account.id, 60).then((list) => setMedia(new Map(list.map((m) => [m.id, m]))), () => undefined)
  }, [account.id, reload, sync])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void sync(true)
    }, POLL)
    return () => window.clearInterval(id)
  }, [sync])

  useInboxFeed(account.id, () => void reload())

  const openComments = (comments ?? []).filter(isOpenComment).length
  const unread = (threads ?? []).reduce((n, t) => n + (t.unread > 0 ? 1 : 0), 0)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={box === 'comentarios'} onClick={() => setBox('comentarios')}>
          Comentários {openComments > 0 && <span className="tabular-nums opacity-60">{openComments}</span>}
        </Chip>
        <Chip active={box === 'mensagens'} onClick={() => setBox('mensagens')}>
          Mensagens {unread > 0 && <span className="tabular-nums opacity-60">{unread}</span>}
        </Chip>
        <Button variant="outline" size="sm" onClick={() => void sync()} disabled={syncing || broken} className="ml-auto gap-1.5">
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} /> {syncing ? 'Buscando…' : 'Atualizar'}
        </Button>
      </div>

      {broken && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">A conexão com o Instagram caiu. Conecte de novo na aba Perfil para ler a caixa.</p>}
      {warning.length > 0 && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">A Meta não devolveu: {warning.join(', ')}.</p>}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-600/20">{error}</p>}

      {comments === null || threads === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a caixa…
        </p>
      ) : box === 'comentarios' ? (
        <CommentsBox account={account} comments={comments} media={media} onChanged={() => void reload()} />
      ) : (
        <MessagesBox account={account} threads={threads} onChanged={() => void reload()} />
      )}
    </div>
  )
}
