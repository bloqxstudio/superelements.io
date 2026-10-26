import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, Loader2, Plus, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { addActivity } from '@/features/crm/clients'
import type { CallTarget } from '@/features/crm/call'
import { Surface } from '@/features/crm/ui'
import { cn } from '@/lib/utils'
import {
  InboxError,
  chatTitle,
  loadChats,
  loadMessages,
  markRead,
  sendMessage,
  startChat,
  useInboxFeed,
  useMediaUrl,
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

export const WhatsAppInbox: React.FC<{ teamId: string; call?: CallTarget; onCallDone?: () => void }> = ({ teamId, call, onCallDone }) => {
  const [chats, setChats] = useState<WaChat[]>()
  const [failure, setFailure] = useState<InboxError>()
  const [openJid, setOpenJid] = useState<string>()
  // Vindo de "Chamar": já abre a nova conversa com o número e o texto
  const [composing, setComposing] = useState(!!call)
  useEffect(() => {
    if (call) {
      setComposing(true)
      setOpenJid(undefined)
    }
  }, [call])

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
      <div className={cn('flex min-h-0 flex-col border-gray-200 md:border-r', (chat || composing) && 'hidden md:flex')}>
      <div className="border-b border-gray-200 p-3">
        <Button size="sm" variant="outline" className="w-full" onClick={() => { setComposing(true); setOpenJid(undefined) }}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova conversa
        </Button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
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
              <ChatAvatar chat={c} />
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
      </div>
      {composing ? (
        <NewChat
          key={call?.phone ?? 'novo'}
          teamId={teamId}
          call={call}
          onCancel={() => {
            setComposing(false)
            onCallDone?.()
          }}
          onSent={(jid) => {
            onCallDone?.()
            setComposing(false)
            setOpenJid(jid)
            void load()
          }}
        />
      ) : chat ? (
        <Conversation key={chat.jid} teamId={teamId} chat={chat} onBack={() => setOpenJid(undefined)} />
      ) : (
        <div className="hidden items-center justify-center p-6 text-sm text-gray-400 md:flex">Escolha uma conversa</div>
      )}
    </div>
  )
}

/** A foto de perfil da conversa; sem foto, as iniciais */
const ChatAvatar: React.FC<{ chat: WaChat; size?: number }> = ({ chat, size = 36 }) => {
  const url = useMediaUrl(chat.photoPath)
  const initials = chatTitle(chat).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '#'
  return url ? (
    <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full bg-gray-100 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700" style={{ width: size, height: size }} aria-hidden>
      {initials}
    </span>
  )
}

const LABEL = /^\[(Foto|Vídeo|Áudio|Documento|Figurinha)\]\s?/

/** O arquivo de uma mensagem: foto, figurinha, vídeo e áudio tocam ali mesmo; documento abre em outra aba. */
const MessageMedia: React.FC<{ message: WaMessage }> = ({ message }) => {
  const url = useMediaUrl(message.mediaPath)
  const mime = message.mediaMime ?? ''
  if (!message.mediaPath) return null
  if (!url) return <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-black/5"><Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden /></div>
  if (message.kind === 'sticker' || mime.startsWith('image/'))
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={message.mediaName ?? 'Imagem da conversa'} loading="lazy" className={cn('rounded-lg object-cover', message.kind === 'sticker' ? 'h-28 w-28 object-contain' : 'max-h-72 max-w-full')} />
      </a>
    )
  if (mime.startsWith('video/')) return <video src={url} controls preload="metadata" className="max-h-72 max-w-full rounded-lg" />
  if (mime.startsWith('audio/')) return <audio src={url} controls preload="none" className="h-10 w-60 max-w-full" />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm underline-offset-2 hover:underline">
      <FileText className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{message.mediaName ?? 'Documento'}</span>
    </a>
  )
}

const NewChat: React.FC<{ teamId: string; call?: CallTarget; onCancel: () => void; onSent: (jid: string) => void }> = ({ teamId, call, onCancel, onSent }) => {
  const [phone, setPhone] = useState(call?.phone ?? '')
  const [text, setText] = useState(call?.text ?? '')
  const [sending, setSending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!phone.trim() || !text.trim() || sending) return
    setSending(true)
    try {
      const jid = await startChat(teamId, phone, text.trim())
      // Chamou alguém do CRM: fica na linha do tempo do cliente
      if (call?.clientId) await addActivity(call.clientId, 'whatsapp', text.trim(), call.opportunityId).catch((error) => console.error('[whatsapp] nota não gravada', error))
      onSent(jid)
    } catch (error) {
      toast.error(errorText(error))
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="md:hidden" onClick={onCancel} aria-label="Voltar às conversas">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <p className="text-sm font-semibold text-gray-900">{call?.name ? `Chamar ${call.name}` : 'Nova conversa'}</p>
      </div>
      <label className="text-sm text-gray-700">
        Número com DDD
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoFocus
          placeholder="51 99999-9999"
          className="mt-1 block h-9 w-full max-w-xs rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <span className="mt-1 block text-xs text-gray-500">Sem o código do país, é um número do Brasil (+55). Para outro país, digite com o código.</span>
      </label>
      <label className="text-sm text-gray-700">
        Mensagem
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Escreva a primeira mensagem"
          className="mt-1 block w-full max-w-xl resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <p className="max-w-xl text-xs text-gray-500">O WhatsApp pode restringir números que mandam mensagem para quem não espera. Escreva para quem já tem relação com a empresa.</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!phone.trim() || !text.trim() || sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          Enviar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
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
        <ChatAvatar chat={chat} size={40} />
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
                  {m.mediaPath && <MessageMedia message={m} />}
                  {(!m.mediaPath || m.body.replace(LABEL, '').trim()) && (
                    <p className={cn('whitespace-pre-wrap break-words', m.mediaPath && 'mt-1')}>{m.mediaPath ? m.body.replace(LABEL, '') : m.body}</p>
                  )}
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
