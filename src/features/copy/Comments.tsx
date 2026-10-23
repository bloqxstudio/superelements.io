import React, { useEffect, useState } from 'react'
import { Check, CornerDownRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { displayName, personColor } from '@/features/space/presence/presence'
import { scrollToBlock } from './DocEditor'
import { useCopy } from './store'
import { plainOf, uid, type CopyComment, type Person } from './types'

/** Os comentários do documento: um por bloco (ou trecho), com respostas, e o fechamento "resolvido", como no Google Docs. */

/** Quem está comentando: a conta aberta. */
export function useMe(): Person | undefined {
  const [me, setMe] = useState<Person>()
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) setMe({ id: u.id, name: displayName(u.email ?? 'Você'), color: personColor(u.id) })
    })
  }, [])
  return me
}

const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`
}

const Avatar: React.FC<{ person: Person }> = ({ person }) => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: person.color }} title={person.name}>
    {person.name.charAt(0).toUpperCase()}
  </span>
)

export interface Composer {
  blockId: string
  quote?: string
}

export const CommentsPanel: React.FC<{ composer: Composer | null; onClose: () => void }> = ({ composer, onClose }) => {
  const doc = useCopy((s) => s.doc)!
  const me = useMe()
  const [text, setText] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [replying, setReplying] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const edit = (fn: (c: CopyComment[]) => CopyComment[]) => useCopy.getState().edit((d) => ({ ...d, comments: fn(d.comments) }))

  const send = () => {
    if (!composer || !text.trim() || !me) return
    edit((c) => [...c, { id: uid(), blockId: composer.blockId, quote: composer.quote?.slice(0, 300), author: me, text: text.trim(), at: Date.now(), replies: [] }])
    setText('')
    onClose()
  }

  const order = new Map(doc.blocks.map((b, i) => [b.id, i]))
  const list = doc.comments.filter((c) => !!c.resolved === showResolved && order.has(c.blockId)).sort((a, b) => (order.get(a.blockId)! - order.get(b.blockId)!) || a.at - b.at)
  const open = doc.comments.filter((c) => !c.resolved).length
  const blockOf = (id: string) => doc.blocks.find((b) => b.id === id)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {composer && (
        <div className="space-y-2 border-b bg-amber-50/60 p-3">
          <p className="text-xs font-semibold text-gray-900">Novo comentário{blockOf(composer.blockId)?.label ? ` · ${blockOf(composer.blockId)!.label}` : ''}</p>
          {composer.quote && <p className="border-l-2 border-amber-400 pl-2 text-xs italic text-gray-600">“{composer.quote.slice(0, 160)}”</p>}
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
              if (e.key === 'Escape') onClose()
              e.stopPropagation()
            }}
            rows={3}
            placeholder="Escreva o comentário (Ctrl+Enter envia)"
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="outline" size="sm" className="bg-white" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" disabled={!text.trim() || !me} onClick={send}>Comentar</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
        <span className="font-semibold text-gray-900">{open} em aberto</span>
        <button type="button" className="text-gray-500 hover:text-gray-800" onClick={() => setShowResolved((v) => !v)}>{showResolved ? 'Ver em aberto' : 'Ver resolvidos'}</button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5" data-scroll>
        {list.length === 0 && <p className="p-2 text-sm text-gray-500">{showResolved ? 'Nenhum comentário resolvido.' : 'Nenhum comentário. Selecione um trecho e clique em Comentar, ou use o balão ao lado de um bloco.'}</p>}
        {list.map((c) => (
          <div key={c.id} className={cn('rounded-xl border bg-white p-2.5 shadow-sm', c.resolved && 'opacity-70')}>
            <button type="button" className="mb-1 block w-full text-left" onClick={() => scrollToBlock(c.blockId)}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{blockOf(c.blockId)?.label ?? 'Bloco'}</span>
              {c.quote ? <span className="mt-0.5 block border-l-2 border-amber-400 pl-2 text-xs italic text-gray-600">“{c.quote}”</span> : <span className="mt-0.5 block truncate text-xs text-gray-500">{plainOf(blockOf(c.blockId)?.html ?? '').slice(0, 80)}</span>}
            </button>
            <div className="flex items-start gap-2">
              <Avatar person={c.author} />
              <div className="min-w-0 flex-1">
                <p className="text-xs"><span className="font-semibold text-gray-900">{c.author.name}</span> <span className="text-gray-400">· {ago(c.at)}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{c.text}</p>
              </div>
            </div>
            {c.replies.map((r) => (
              <div key={r.id} className="ml-5 mt-2 flex items-start gap-2 border-l border-gray-100 pl-2">
                <Avatar person={r.author} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs"><span className="font-semibold text-gray-900">{r.author.name}</span> <span className="text-gray-400">· {ago(r.at)}</span></p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{r.text}</p>
                </div>
              </div>
            ))}
            {replying === c.id ? (
              <div className="ml-5 mt-2 space-y-1.5">
                <textarea
                  autoFocus
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reply.trim() && me) {
                      edit((all) => all.map((x) => (x.id === c.id ? { ...x, replies: [...x.replies, { id: uid(), author: me, text: reply.trim(), at: Date.now() }] } : x)))
                      setReply('')
                      setReplying(null)
                    }
                    e.stopPropagation()
                  }}
                  rows={2}
                  placeholder="Responder (Ctrl+Enter envia)"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
                />
                <div className="flex justify-end gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-7 bg-white" onClick={() => { setReplying(null); setReply('') }}>Cancelar</Button>
                  <Button type="button" size="sm" className="h-7" disabled={!reply.trim() || !me} onClick={() => { edit((all) => all.map((x) => (x.id === c.id ? { ...x, replies: [...x.replies, { id: uid(), author: me!, text: reply.trim(), at: Date.now() }] } : x))); setReply(''); setReplying(null) }}>Responder</Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100" onClick={() => setReplying(c.id)}><CornerDownRight className="h-3 w-3" /> Responder</button>
                <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100" onClick={() => edit((all) => all.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)))}><Check className="h-3 w-3" /> {c.resolved ? 'Reabrir' : 'Resolver'}</button>
                {(c.author.id === me?.id || c.author.id.startsWith('agent:')) && (
                  <button type="button" className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => edit((all) => all.filter((x) => x.id !== c.id))}><Trash2 className="h-3 w-3" /></button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
