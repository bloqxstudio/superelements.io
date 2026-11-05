import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUp, Check, CircleAlert, Loader2, Sparkles, Square, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { useAiAvailable } from '@/features/criativos/link'
import { proposalDetail, runAction, setIaraNavigate, talk } from './engine'
import { readMessages, uid, useIara, writeMessages, type IaraMessage, type IaraProposal } from './store'

/**
 * O chat da Iara: botão no canto e uma janela por cima da tela. A conversa é por conta e fica neste
 * navegador. Atalho: ⌘/Ctrl + J. Precisa da IA desta máquina (o conector), por escolha do usuário.
 */

const SUGGESTIONS = [
  'Me dá 8 ideias de conteúdo para as próximas duas semanas',
  'Escreve o roteiro das ideias que estão sem roteiro',
  'Distribui as ideias aprovadas às terças e quintas às 18h',
  'O que está travado na pauta deste mês?',
]

const Proposal: React.FC<{ p: IaraProposal; onConfirm: () => void; onRefuse: () => void; busy: boolean }> = ({ p, onConfirm, onRefuse, busy }) => {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let stop = false
    void proposalDetail(p).then((n) => !stop && setNames(n))
    return () => {
      stop = true
    }
  }, [p])
  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <p className="text-xs font-semibold text-violet-900">{p.label}</p>
      {names.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-xs text-gray-700">
          {names.slice(0, 8).map((n, i) => (
            <li key={i} className="truncate">
              {n}
            </li>
          ))}
          {names.length > 8 && <li>e mais {names.length - 8}</li>}
        </ul>
      )}
      {p.state === 'pendente' ? (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={onConfirm} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            <Check className="h-3.5 w-3.5" aria-hidden /> Confirmar
          </button>
          <button type="button" disabled={busy} onClick={onRefuse} className="h-8 rounded-lg px-3 text-xs font-medium text-gray-600 hover:bg-white">
            Agora não
          </button>
        </div>
      ) : (
        <p className={cn('mt-1.5 text-xs', p.state === 'feito' ? 'text-emerald-700' : p.state === 'erro' ? 'text-red-700' : 'text-gray-500')}>{p.state === 'feito' ? p.result ?? 'Feito.' : p.state === 'erro' ? p.result ?? 'Não deu certo.' : 'Deixado para depois.'}</p>
      )}
    </div>
  )
}

const Bubble: React.FC<{ m: IaraMessage; busy: boolean; onProposal: (msg: string, p: IaraProposal, ok: boolean) => void }> = ({ m, busy, onProposal }) => (
  <li className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
    <div className={cn('max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-gray-900 text-white' : 'rounded-bl-md bg-gray-100 text-gray-900')}>
      <p className="whitespace-pre-line">{m.text}</p>
      {m.done && (
        <ul className="mt-2 grid gap-1">
          {m.done.map((d, i) => (
            <li key={i} className={cn('flex items-start gap-1.5 text-xs', d.ok ? 'text-gray-700' : 'text-red-700')}>
              {d.ok ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden /> : <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
              {d.to ? (
                <Link to={d.to} className="underline-offset-2 hover:underline">
                  {d.label}
                </Link>
              ) : (
                <span>{d.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {m.proposals?.map((p) => <Proposal key={p.id} p={p} busy={busy} onConfirm={() => onProposal(m.id, p, true)} onRefuse={() => onProposal(m.id, p, false)} />)}
    </div>
  </li>
)

export const IaraPanel: React.FC = () => {
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const open = useIara((s) => s.open)
  const busy = useIara((s) => s.busy)
  const step = useIara((s) => s.step)
  const messages = useIara((s) => s.messages)
  const screen = useIara((s) => s.screen)
  const queued = useIara((s) => s.queued)
  const ai = useAiAvailable()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abort = useRef<AbortController>()

  useEffect(() => setIaraNavigate((to) => navigate(to)), [navigate])

  // A conversa é da conta aberta
  useEffect(() => {
    if (!team) return
    useIara.setState({ teamId: team.id, messages: readMessages(team.id) })
  }, [team])

  const save = useCallback((list: IaraMessage[]) => {
    const id = useIara.getState().teamId
    useIara.setState({ messages: list })
    if (id) writeMessages(id, list)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        useIara.setState((s) => ({ open: !s.open }))
      }
      if (e.key === 'Escape' && useIara.getState().open && !useIara.getState().busy) useIara.setState({ open: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' })
  }, [messages, busy, open])

  const send = useCallback(
    async (raw: string) => {
      const request = raw.trim()
      if (!request || useIara.getState().busy) return
      const history = useIara.getState().messages
      const mine: IaraMessage = { id: uid(), role: 'user', text: request, at: Date.now() }
      save([...history, mine])
      setText('')
      const controller = new AbortController()
      abort.current = controller
      useIara.setState({ busy: true, step: 'Pensando' })
      try {
        const reply = await talk(history, request, controller.signal, (s) => useIara.setState({ step: s }))
        save([...useIara.getState().messages, reply])
      } catch (e) {
        const stopped = controller.signal.aborted
        save([...useIara.getState().messages, { id: uid(), role: 'iara', text: stopped ? 'Parei.' : e instanceof Error ? e.message : 'Não consegui responder agora.', at: Date.now() }])
      } finally {
        useIara.setState({ busy: false, step: undefined })
        abort.current = undefined
      }
    },
    [save]
  )

  // "Pedir à Iara" de outras telas
  useEffect(() => {
    if (!queued || !ai) return
    useIara.setState({ queued: undefined })
    void send(queued)
  }, [queued, ai, send])

  const decide = async (msgId: string, p: IaraProposal, ok: boolean) => {
    const patch = (next: Partial<IaraProposal>) => save(useIara.getState().messages.map((m) => (m.id === msgId ? { ...m, proposals: m.proposals?.map((x) => (x.id === p.id ? { ...x, ...next } : x)) } : m)))
    if (!ok) return patch({ state: 'recusado' })
    useIara.setState({ busy: true, step: 'Fazendo' })
    try {
      const done = await runAction(p.action, p.args as Record<string, unknown>)
      const failed = done.filter((d) => !d.ok)
      patch({ state: failed.length === done.length ? 'erro' : 'feito', result: done.map((d) => d.label).join(' · ') })
    } finally {
      useIara.setState({ busy: false, step: undefined })
    }
  }

  if (!team) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => useIara.setState({ open: true })}
          aria-label="Abrir a Iara (⌘J)"
          className="fixed bottom-5 right-5 z-50 inline-flex h-11 items-center gap-2 rounded-full bg-gray-900 pl-3.5 pr-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)] transition-transform hover:bg-black active:scale-[0.97]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </span>
          Iara
        </button>
      )}
      {open && (
        <section
          aria-label="Iara, assistente"
          className="fixed bottom-4 right-4 z-50 flex h-[min(640px,calc(100vh-32px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_64px_-16px_rgb(0_0_0/0.35)]"
        >
          <header className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-gray-900">Iara</h2>
              <p className="truncate text-[11px] text-gray-500">{screen ? `Vendo: ${screen.title}` : team.name}</p>
            </div>
            {messages.length > 0 && (
              <button type="button" disabled={busy} onClick={() => save([])} aria-label="Limpar a conversa" title="Limpar a conversa" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => useIara.setState({ open: false })} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div>
                <p className="text-sm text-gray-800">Oi! Sou a Iara. Crio ideias, escrevo roteiros, organizo a pauta e deixo aprovações e envios prontos para você confirmar.</p>
                <div className="mt-4 grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" disabled={!ai || busy} onClick={() => void send(s)} className="rounded-xl border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol ref={listRef} className="grid gap-3" aria-live="polite">
                {messages.map((m) => (
                  <Bubble key={m.id} m={m} busy={busy} onProposal={(id, p, ok) => void decide(id, p, ok)} />
                ))}
                {busy && (
                  <li className="flex items-center gap-2 text-xs text-gray-500" role="status">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {step ?? 'Pensando'}
                  </li>
                )}
              </ol>
            )}
          </div>

          {!ai && (
            <p className="mx-4 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              A Iara usa a IA deste computador. <Link to="/agentes" className="font-semibold underline underline-offset-2">Conecte o conector</Link> para conversar.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(text)
            }}
            className="border-t border-gray-100 p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-1.5 pl-3 focus-within:border-gray-400">
              <label htmlFor="iara-input" className="sr-only">
                Mensagem para a Iara
              </label>
              <textarea
                id="iara-input"
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={4000}
                disabled={!ai}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
                placeholder={ai ? 'Peça ideias, roteiros, mudanças na pauta…' : 'Conecte o conector para conversar'}
                className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              {busy ? (
                <button type="button" onClick={() => abort.current?.abort()} aria-label="Parar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                  <Square className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <button type="submit" disabled={!text.trim() || !ai} aria-label="Enviar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-gray-400">Aprovar, descartar e enviar sempre pedem sua confirmação · ⌘J</p>
          </form>
        </section>
      )}
    </>
  )
}
