import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Surface } from '@/features/crm/ui'
import { cn } from '@/lib/utils'
import {
  InboxError,
  chatTitle,
  loadChats,
  loadMessages,
  markRead,
  sendMessage,
  useInboxFeed,
  type WaChat,
  type WaMessage,
} from '@/features/crm/whatsappChats'

/**
 * Conversas do WhatsApp da equipe: a lista à esquerda (a mais recente em
 * cima, com as não lidas), a conversa à direita e o campo de resposta. Ao
 * vivo para todos da equipe; o que se escreve aqui sai pelo número conectado.
 */

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const clock = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const listTime = (at: number) => {
  const d = new Date(at)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return clock(at)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const dayTitle = (at: number) => new Date(at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

export const WhatsAppInbox: React.FC<{ teamId: string }> = ({ teamId }) => {
  const [chats, setChats] = useState<WaChat[]>()
  const [failure, setFailure] = useState<InboxError>()
  const [openJid, setOpenJid] = useState<string>()

  const load = useCallback(async () => {
    try {
      setChats(await loadChats(teamId))
      setFailure(undefined)
    } catch (error) {
      setFailure(error instanceof InboxError ? error : new InboxError(errorText(error)))
    }
  }, [teamId])

  useEffect(() => {
    setChats(undefined)
    void load()
  }, [load])

  useInboxFeed(teamId, () => void load())

  // Sem a Realtime também funciona: relê de tempos em tempos com a aba à vista
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 20_000)
    return () => clearInterval(timer)
  }, [load])

  if (failure)
    return (
      <Surface title={failure.code === 'no_tables' ? 'Falta preparar as mensagens' : 'Não deu para ler as conversas'}>
        <p className="text-sm text-gray-600">{failure.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Tentar de novo
        </Button>
      </Surface>
    )

  if (!chats)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Lendo as conversas…
      </p>
    )

  const chat = chats.find((c) => c.jid === openJid)

  return (
    <div className="grid h-[640px] overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-[320px_1fr]">
      <ul className={cn('overflow-y-auto border-gray-200 md:border-r', chat && 'hidden md:block')}>
        {chats.length === 0 && (
          <li className="p-4 text-sm text-gray-500">
            Nenhuma conversa ainda. As mensagens novas, recebidas ou enviadas pelo celular, aparecem aqui a partir de agora.
          </li>
        )}
        {chats.map((c) => (
          <li key={c.jid}>
            <button
              type="button"
              onClick={() => setOpenJid(c.jid)}
              className={cn('flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50', c.jid === openJid && 'bg-gray-50')}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700" aria-hidden>
                {chatTitle(c).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '#'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate text-sm', c.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800')}>{chatTitle(c)}</span>
                  <span className="shrink-0 text-[11px] text-gray-400">{listTime(c.lastAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-500">
                    {c.lastFromMe && 'Você: '}
                    {c.lastText}
                  </span>
                  {c.unread > 0 && <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {chat ? (
        <Conversation key={chat.jid} teamId={teamId} chat={chat} onBack={() => setOpenJid(undefined)} />
      ) : (
        <div className="hidden items-center justify-center p-6 text-sm text-gray-400 md:flex">Escolha uma conversa</div>
      )}
    </div>
  )
}

const Conversation: React.FC<{ teamId: string; chat: WaChat; onBack: () => void }> = ({ teamId, chat, onBack }) => {
  const [messages, setMessages] = useState<WaMessage[]>()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setMessages(await loadMessages(teamId, chat.jid))
    } catch (error) {
      toast.error(errorText(error))
    }
  }, [teamId, chat.jid])

  useEffect(() => {
    void load()
  }, [load, chat.lastAt])

  // Abrir (e receber com a conversa aberta) zera o contador de não lidas
  useEffect(() => {
    if (chat.unread > 0) void markRead(teamId, chat.jid).catch(() => undefined)
  }, [teamId, chat.jid, chat.unread])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length])

  // A mensagem na fila vira "enviada" quando o serviço envia: relê rápido enquanto houver
  const queued = messages?.some((m) => m.status === 'queued')
  useEffect(() => {
    if (!queued) return
    const timer = setInterval(() => void load(), 1500)
    return () => clearInterval(timer)
  }, [queued, load])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    try {
      await sendMessage(teamId, chat.jid, value)
      setText('')
      await load()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSending(false)
    }
  }

  let lastDay = ''
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack} aria-label="Voltar às conversas">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{chatTitle(chat)}</p>
          {chat.phone && !chat.jid.endsWith('@lid') && <p className="truncate text-xs text-gray-500">+{chat.phone}</p>}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-gray-50 px-4 py-3">
        {!messages && <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" aria-hidden />}
        {messages?.map((m) => {
          const day = new Date(m.at).toDateString()
          const header = day !== lastDay
          lastDay = day
          return (
            <React.Fragment key={m.id}>
              {header && <p className="py-2 text-center text-[11px] capitalize text-gray-400">{dayTitle(m.at)}</p>}
              <div className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[78%] rounded-2xl px-3 py-1.5 text-sm', m.fromMe ? 'bg-emerald-100 text-emerald-950' : 'bg-white text-gray-900 ring-1 ring-gray-200')}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn('mt-0.5 text-right text-[10px]', m.status === 'failed' ? 'text-red-600' : 'text-gray-400')}>
                    {m.status === 'failed' ? `Não enviou${m.error ? `: ${m.error}` : ''}` : m.status === 'queued' ? 'Enviando…' : clock(m.at)}
                  </p>
                </div>
              </div>
            </React.Fragment>
          )
        })}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-gray-200 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit(e)
            }
          }}
          rows={1}
          placeholder="Escreva uma mensagem"
          className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || sending} aria-label="Enviar">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </div>
  )
}
