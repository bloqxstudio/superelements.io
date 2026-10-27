import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, Loader2, Paperclip, Plus, RefreshCw, Send, Tag, X } from 'lucide-react'
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
  PRESET_TAGS,
  markRead,
  sendFile,
  sendMessage,
  setTags,
  startChat,
  tagChip,
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

export const WhatsAppInbox: React.FC<{ teamId: string; call?: CallTarget; onCallDone?: () => void; offline?: boolean }> = ({ teamId, call, onCallDone, offline }) => {
  const [chats, setChats] = useState<WaChat[]>()
  const [failure, setFailure] = useState<InboxError>()
  const [openJid, setOpenJid] = useState<string>()
  const [tagFilter, setTagFilter] = useState<string>()
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
    }, 8_000)
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
  const allTags = Array.from(new Set(chats.flatMap((c) => c.tags)))
  const shown = tagFilter ? chats.filter((c) => c.tags.includes(tagFilter)) : chats

  return (
    <div className="grid h-[640px] overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-[320px_1fr]">
      <div className={cn('flex min-h-0 flex-col border-gray-200 md:border-r', (chat || composing) && 'hidden md:flex')}>
      <div className="border-b border-gray-200 p-3">
        <Button size="sm" variant="outline" className="w-full" disabled={offline} onClick={() => { setComposing(true); setOpenJid(undefined) }}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova conversa
        </Button>
      </div>
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-3 py-2">
          <button type="button" onClick={() => setTagFilter(undefined)} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', !tagFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600')}>
            Todas
          </button>
          {allTags.map((t) => (
            <button key={t} type="button" onClick={() => setTagFilter(tagFilter === t ? undefined : t)} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tagChip(t), tagFilter === t && 'ring-2 ring-gray-900')}>
              {t}
            </button>
          ))}
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {chats.length === 0 && (
          <li className="p-4 text-sm text-gray-500">
            Nenhuma conversa ainda. As mensagens novas, recebidas ou enviadas pelo celular, aparecem aqui a partir de agora.
          </li>
        )}
        {shown.map((c) => (
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
                  {c.tags.length > 0 && (
                    <span className="flex shrink-0 gap-1">
                      {c.tags.slice(0, 2).map((t) => (
                        <span key={t} className={cn('rounded-full px-1.5 text-[10px] font-medium', tagChip(t))}>{t}</span>
                      ))}
                    </span>
                  )}
                  {c.unread > 0 && <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      </div>
      {composing && !offline ? (
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
        <Conversation key={chat.jid} teamId={teamId} chat={chat} offline={offline} onBack={() => setOpenJid(undefined)} onChanged={() => void load()} />
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

/** As etiquetas da conversa: as marcadas, e um menu para marcar (Quente, Morno, Frio…) ou criar uma. */
const TagPicker: React.FC<{ teamId: string; chat: WaChat; onChanged: () => void }> = ({ teamId, chat, onChanged }) => {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = async (tags: string[]) => {
    setBusy(true)
    try {
      await setTags(teamId, chat.jid, tags)
      onChanged()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }
  const toggle = (name: string) => {
    const has = chat.tags.some((t) => t.toLowerCase() === name.toLowerCase())
    void apply(has ? chat.tags.filter((t) => t.toLowerCase() !== name.toLowerCase()) : [...chat.tags, name])
  }

  return (
    <div className="relative ml-auto flex min-w-0 items-center gap-1.5">
      {chat.tags.map((t) => (
        <span key={t} className={cn('hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline', tagChip(t))}>{t}</span>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Etiquetas da conversa">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Tag className="h-4 w-4" aria-hidden />}
      </Button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Fechar" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
            {[...PRESET_TAGS.map((t) => t.name), ...chat.tags.filter((t) => !PRESET_TAGS.some((p) => p.name.toLowerCase() === t.toLowerCase()))].map((name) => {
              const on = chat.tags.some((t) => t.toLowerCase() === name.toLowerCase())
              return (
                <button key={name} type="button" onClick={() => toggle(name)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50">
                  <span className={cn('flex h-4 w-4 items-center justify-center rounded border text-[10px]', on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300')}>{on && '✓'}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tagChip(name))}>{name}</span>
                </button>
              )
            })}
            <form
              className="mt-1 flex gap-1 border-t border-gray-100 pt-2"
              onSubmit={(e) => {
                e.preventDefault()
                const value = custom.trim()
                if (!value) return
                setCustom('')
                if (!chat.tags.some((t) => t.toLowerCase() === value.toLowerCase())) void apply([...chat.tags, value])
              }}
            >
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={24} placeholder="Nova etiqueta" className="h-8 min-w-0 flex-1 rounded-md border border-gray-300 px-2 text-xs focus:border-emerald-500 focus:outline-none" />
              <Button type="submit" size="sm" disabled={!custom.trim()}>Criar</Button>
            </form>
          </div>
        </>
      )}
    </div>
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

const Conversation: React.FC<{ teamId: string; chat: WaChat; offline?: boolean; onBack: () => void; onChanged: () => void }> = ({ teamId, chat, offline, onBack, onChanged }) => {
  const [messages, setMessages] = useState<WaMessage[]>()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  // Arquivo colado ou arrastado: espera aqui, com prévia, até a pessoa enviar
  const [pending, setPending] = useState<File>()
  const [pendingUrl, setPendingUrl] = useState<string>()
  useEffect(() => {
    if (!pending || !/^(image|video)\//.test(pending.type)) return setPendingUrl(undefined)
    const url = URL.createObjectURL(pending)
    setPendingUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pending])

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
    if (pending) {
      const file = pending
      setPending(undefined)
      return void attach(file)
    }
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

  // Vídeo, foto, áudio ou documento: o texto do campo vai de legenda
  const attach = async (file: File | undefined) => {
    if (!file || sending) return
    setSending(true)
    try {
      await sendFile(teamId, chat.jid, file, text.trim())
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
        <TagPicker teamId={teamId} chat={chat} onChanged={onChanged} />
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
      {pending && (
        <div className="flex items-center gap-3 border-t border-gray-200 bg-white px-3 py-2">
          {pendingUrl && pending.type.startsWith('image/') ? (
            <img src={pendingUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : pendingUrl ? (
            <video src={pendingUrl} muted className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <FileText className="h-8 w-8 text-gray-400" aria-hidden />
          )}
          <p className="min-w-0 flex-1 truncate text-sm text-gray-700">{pending.name}<span className="block text-xs text-gray-500">Escreva uma legenda, se quiser, e envie.</span></p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPending(undefined)} aria-label="Tirar o anexo">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
      {offline ? (
        <p className="border-t border-gray-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">WhatsApp desconectado: dá para ler o histórico, mas não enviar até reconectar.</p>
      ) : (
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-gray-200 p-3">
        <input
          ref={picker}
          type="file"
          hidden
          accept="video/*,image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            void attach(file)
          }}
        />
        <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => picker.current?.click()} aria-label="Enviar vídeo, foto ou arquivo" title="Enviar vídeo, foto ou arquivo (até 25 MB)">
          <Paperclip className="h-4 w-4" aria-hidden />
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // Print ou imagem copiada: entra como anexo, sem precisar salvar o arquivo
            const file = Array.from(e.clipboardData.files).find((f) => /^(image|video)\//.test(f.type)) ?? e.clipboardData.files[0]
            if (!file) return
            e.preventDefault()
            setPending(file.name && file.name !== 'image.png' ? file : new File([file], `imagem-${Date.now()}.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: file.type }))
          }}
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
        <Button type="submit" size="sm" disabled={(!text.trim() && !pending) || sending} aria-label="Enviar">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
      )}
    </div>
  )
}
