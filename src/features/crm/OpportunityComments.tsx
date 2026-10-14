import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { addComment, deleteComment, editComment, type OpportunityComment } from './comments'
import { nameOf } from './people'
import { canManage, NOTE_KINDS, type TeamPerson, type TeamRole } from './types'
import { Avatar, FIELD, whenLabel } from './ui'

const KIND_LABEL = Object.fromEntries(NOTE_KINDS.map((k) => [k.id, k.label])) as Record<string, string>

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Ctrl (⌘ no Mac) + Enter envia; Enter sozinho quebra a linha. */
const sends = (e: React.KeyboardEvent) => e.key === 'Enter' && (e.ctrlKey || e.metaKey)

const Item: React.FC<{
  comment: OpportunityComment
  author?: string
  mine: boolean
  canDelete: boolean
  onSaved: (comment: OpportunityComment) => void
  onDeleted: (id: string) => void
}> = ({ comment, author, mine, canDelete, onSaved, onDeleted }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)

  const cancel = () => {
    setEditing(false)
    setDraft(comment.body)
  }

  const save = async () => {
    if (!draft.trim() || draft.trim() === comment.body) return setEditing(false)
    setBusy(true)
    try {
      onSaved(await editComment(comment.id, draft))
      setEditing(false)
    } catch (error) {
      toast.error('Não foi possível editar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteComment(comment.id)
      onDeleted(comment.id)
    } catch (error) {
      setBusy(false)
      toast.error('Não foi possível apagar', { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <li className="group flex gap-2.5">
      <Avatar id={comment.createdBy} name={author ?? 'Alguém'} size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-gray-500">
          <span className="text-xs font-semibold text-gray-900">{author ?? 'Alguém da equipe'}</span>
          <span>{whenLabel(comment.createdAt)}</span>
          {comment.kind !== 'note' && <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-600">{KIND_LABEL[comment.kind]}</span>}
          {comment.editedAt && <span title={`Editado ${whenLabel(comment.editedAt)}`}>· editado</span>}
        </p>
        {editing ? (
          <div className="mt-1 grid gap-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (sends(e)) void save()
                if (e.key === 'Escape') cancel()
              }}
              rows={3}
              maxLength={8000}
              autoFocus
              aria-label="Editar o comentário"
              className={cn(FIELD, 'py-2 leading-relaxed')}
            />
            <div className="flex justify-end gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-7" onClick={cancel}>
                Cancelar
              </Button>
              <Button type="button" size="sm" className="h-7" disabled={busy || !draft.trim()} onClick={() => void save()}>
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">{comment.body}</p>
        )}
        {!editing && (mine || canDelete) && (
          <div className="mt-0.5 flex gap-2 text-[11px] text-gray-500 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {mine && (
              <button type="button" onClick={() => setEditing(true)} className="hover:text-gray-900 hover:underline">
                Editar
              </button>
            )}
            <button type="button" onClick={() => void remove()} disabled={busy} className="hover:text-rose-700 hover:underline">
              Apagar
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * Os comentários de um cartão do funil, como uma conversa da equipe: o mais
 * antigo em cima, a caixa de escrever embaixo. Ocupa a altura que sobra no
 * painel (a lista rola, a caixa fica fixa).
 */
export const OpportunityComments: React.FC<{
  opportunity: { id: string; clientId: string }
  comments: OpportunityComment[] | null
  people?: TeamPerson[]
  role?: TeamRole
  onSaved: (comment: OpportunityComment) => void
  onDeleted: (id: string) => void
}> = ({ opportunity, comments, people, role, onSaved, onDeleted }) => {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const count = comments?.length ?? 0

  // Abre no comentário mais novo e acompanha os que chegam
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [count])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    try {
      onSaved(await addComment(opportunity, body))
      setBody('')
    } catch (error) {
      toast.error('Não foi possível comentar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="flex-1 overflow-y-auto px-5 py-4">
        {comments === null ? (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Abrindo os comentários
          </p>
        ) : !comments.length ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-gray-900">Nenhum comentário ainda</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-gray-500">Conte para a equipe o que combinou com o cliente, o que falta ou onde parou.</p>
          </div>
        ) : (
          <ol className="grid gap-4" aria-label="Comentários">
            {comments.map((c) => (
              <Item
                key={c.id}
                comment={c}
                author={nameOf(people, c.createdBy)}
                mine={Boolean(user && c.createdBy === user.id)}
                canDelete={canManage(role)}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            ))}
          </ol>
        )}
      </div>
      <form onSubmit={(e) => void send(e)} className="border-t border-gray-100 px-5 py-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => sends(e) && void send()}
          rows={2}
          maxLength={8000}
          placeholder="Escreva um comentário para a equipe"
          aria-label="Novo comentário"
          className={cn(FIELD, 'resize-none py-2 leading-relaxed')}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">{isMac ? '⌘' : 'Ctrl'} + Enter envia</span>
          <Button type="submit" size="sm" className="h-8" disabled={sending || !body.trim()}>
            {sending ? 'Enviando…' : 'Comentar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
