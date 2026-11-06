import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, Loader2, Pause, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChat } from '@/features/space/chat/chatStore'
import { agentName } from './actions'
import { askLane } from './squad'
import { WorkBar } from './WorkBar'
import type { IaraMessage, SquadLane, Squad } from './store'

/**
 * O cartão da equipe rápida: uma coluna (um minichat) por faixa, lado a lado, todas ao vivo. Cada uma mostra o pedido,
 * os passos e a resposta, e tem o próprio campo para pedir mais só a ela.
 */

const STATUS: Record<SquadLane['status'], { label: string; icon: React.ReactNode; tone: string }> = {
  fila: { label: 'Na fila', icon: <Loader2 className="h-3 w-3" aria-hidden />, tone: 'text-gray-500' },
  trabalhando: { label: 'Trabalhando', icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden />, tone: 'text-sky-700' },
  pronto: { label: 'Entregue', icon: <Check className="h-3 w-3" aria-hidden />, tone: 'text-emerald-700' },
  erro: { label: 'Não deu', icon: <CircleAlert className="h-3 w-3" aria-hidden />, tone: 'text-red-700' },
  parado: { label: 'Parado', icon: <Pause className="h-3 w-3" aria-hidden />, tone: 'text-amber-700' },
}

/** A conversa de uma faixa de site, lida do chat do Space (ao vivo). */
function useSiteTurns(lane: SquadLane) {
  const conv = useChat((s) => (lane.chat ? s.conversations[lane.chat] : undefined))
  if (!conv) return { turns: lane.turns, steps: lane.steps, running: lane.status === 'trabalhando' }
  const turns = conv.messages.map((m) => ({
    role: m.role === 'user' ? ('pessoa' as const) : ('agente' as const),
    text: m.role === 'user' ? (m.text ?? '').replace(/^Sua parte \([^)]*\):\s*/, '') : m.error || (m.parts ?? []).filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('').trim(),
  }))
  const last = conv.messages.at(-1)
  const steps = (last?.parts ?? []).filter((p) => p.type === 'step').map((p) => (p as { step: { text: string } }).step.text).slice(-4)
  return { turns: turns.filter((t) => t.text), steps, running: conv.running.length > 0 }
}

const Lane: React.FC<{ msgId: string; squad: Squad; lane: SquadLane }> = ({ msgId, squad, lane }) => {
  const site = useSiteTurns(lane)
  const { turns, steps } = squad.surface === 'site' ? site : lane
  const status = squad.surface === 'site' && site.running ? 'trabalhando' : lane.status
  const st = STATUS[status]
  const [draft, setDraft] = useState('')
  const busy = status === 'trabalhando'
  const send = () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    void askLane(msgId, lane, squad, text)
  }
  return (
    <section aria-label={`${lane.label}: ${st.label}`} className="flex w-[232px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white" style={{ borderColor: `${lane.color}55` }}>
      <header className="flex items-center gap-1.5 border-b px-2.5 py-1.5" style={{ background: `${lane.color}12`, borderColor: `${lane.color}33` }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lane.color }} aria-hidden />
        <span className="truncate text-[12px] font-semibold" style={{ color: lane.color }}>{lane.label}</span>
        <span className="truncate text-[10px] text-gray-500">· {lane.agent === 'imagens' ? 'imagens' : agentName(lane.agent)}</span>
        <span className={cn('ml-auto flex shrink-0 items-center gap-1 text-[10px] font-medium', st.tone)}>{st.icon} {st.label}</span>
      </header>
      <ol className="flex max-h-56 min-h-[96px] flex-col gap-1.5 overflow-y-auto px-2.5 py-2" aria-label="Conversa da faixa">
        {turns.map((t, i) => (
          <li key={i} className={cn('max-w-[92%] whitespace-pre-wrap break-words rounded-lg px-2 py-1 text-[12px] leading-snug', t.role === 'pessoa' ? 'self-end bg-gray-900 text-white' : 'self-start bg-gray-100 text-gray-900')}>
            {t.text.length > 600 ? `${t.text.slice(0, 600)}…` : t.text}
          </li>
        ))}
        {busy && steps.length > 0 && (
          <li className="self-start text-[11px] text-gray-500">
            {steps.slice(-2).map((s, i) => (
              <span key={i} className="block truncate">· {s}</span>
            ))}
          </li>
        )}
      </ol>
      <div className="flex items-center gap-1 border-t p-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={busy}
          placeholder={busy ? 'Trabalhando…' : `Pedir mais a ${lane.label.toLowerCase()}`}
          aria-label={`Pedir mais à faixa ${lane.label}`}
          className="h-7 min-w-0 flex-1 rounded-md border px-2 text-[12px] outline-none focus:border-gray-400 disabled:bg-gray-50"
        />
        <button type="button" onClick={send} disabled={busy || !draft.trim()} aria-label="Enviar à faixa" className="flex h-7 w-7 items-center justify-center rounded-md text-white disabled:opacity-40" style={{ background: lane.color }}>
          <Send className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </section>
  )
}

export const SquadBoard: React.FC<{ m: IaraMessage }> = ({ m }) => {
  const squad = m.squad!
  const done = squad.lanes.filter((l) => l.status === 'pronto').length
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Equipe rápida · {squad.lanes.length} agentes ao mesmo tempo</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{squad.title}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        {squad.final === 'trabalhando' ? `${done} de ${squad.lanes.length} entregues · acompanhe no ${squad.surface === 'site' ? 'canvas' : 'editor'}, cada um com a sua cor` : squad.final === 'parado' ? 'Parada por você.' : 'Todas as faixas terminaram.'}
        {squad.open && (
          <>
            {' · '}
            <Link to={squad.open} className="font-medium text-violet-700 hover:underline">Abrir</Link>
          </>
        )}
      </p>
      {squad.final === 'trabalhando' && <WorkBar />}
      <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {squad.lanes.map((lane) => (
          <Lane key={lane.id} msgId={m.id} squad={squad} lane={lane} />
        ))}
      </div>
      {m.images && m.images.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {m.images.map((src, i) => (
            <img key={i} src={src} alt={`Slide ${i + 1} depois da equipe`} className="h-24 w-auto rounded-md border" />
          ))}
        </div>
      )}
    </div>
  )
}
