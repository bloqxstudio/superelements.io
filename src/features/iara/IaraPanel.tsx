import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUp, Check, CircleAlert, Loader2, Sparkles, Square, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { useAiAvailable } from '@/features/criativos/link'
import { agentPrompt, agentSystem, handbackRequest, proposalDetail, runAction, setIaraNavigate, talk } from './engine'
import { AGENT_COLORS, IARA_ENGINE, agentName, execAction, localAgents } from './actions'
import { onIaraEvent, sendToAgent, stopAgent, useIaraLink } from './link'
import { patchMessage, readMessages, uid, useIara, writeMessages, type IaraMessage, type IaraProposal } from './store'

/**
 * O chat da Iara: botão no canto e uma janela por cima da tela. A conversa é por conta e fica neste
 * navegador. Atalho: ⌘/Ctrl + J. Precisa da IA desta máquina (o conector), por escolha do usuário.
 */

const SUGGESTIONS = [
  'Olha o que mais performou no Instagram e me dá 6 ideias na mesma linha',
  'Produz o criativo da próxima peça aprovada e me mostra',
  'Escreve o roteiro das ideias que estão sem roteiro',
  'Monta a pauta das próximas duas semanas, terças e quintas às 18h',
  'Quero sugerir uma melhoria no produto',
]

const SESSION_KEY = (team: string) => `iara-sessao:${team}`
const readSession = (team?: string) => {
  try {
    return team ? (localStorage.getItem(SESSION_KEY(team)) ?? undefined) : undefined
  } catch {
    return undefined
  }
}
const writeSession = (team: string | undefined, session: string | undefined) => {
  if (!team) return
  try {
    if (session) localStorage.setItem(SESSION_KEY(team), session)
    else localStorage.removeItem(SESSION_KEY(team))
  } catch {
    // sem armazenamento: a conversa recomeça a cada pedido
  }
}

const AgentDot: React.FC<{ id?: string; className?: string }> = ({ id, className }) =>
  id ? (
    <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: AGENT_COLORS[id] ?? '#6b7280' }} aria-hidden />
  ) : (
    <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500', className)} aria-hidden />
  )

/** As ações em que dá para escolher outro agente na hora de confirmar. */
const PICKS_AGENT = new Set(['produzir_criativo', 'editar_criativo', 'consultar_agente'])

const Proposal: React.FC<{ p: IaraProposal; onConfirm: (agent?: string) => void; onRefuse: () => void; busy: boolean }> = ({ p, onConfirm, onRefuse, busy }) => {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let stop = false
    void proposalDetail(p).then((n) => !stop && setNames(n))
    return () => {
      stop = true
    }
  }, [p])

  if (p.handoff) {
    const color = AGENT_COLORS[p.handoff] ?? '#6b7280'
    const others = PICKS_AGENT.has(p.action) ? localAgents().filter((a) => a !== p.handoff && (p.action !== 'consultar_agente' || a !== IARA_ENGINE)) : []
    return (
      <div className="mt-2 overflow-hidden rounded-xl border bg-white" style={{ borderColor: `${color}55` }}>
        <p className="flex items-center gap-1.5 px-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <AgentDot /> Iara <ArrowRight className="h-3 w-3" aria-hidden /> <AgentDot id={p.handoff} /> <span style={{ color }}>{agentName(p.handoff)}</span>
          <span className="font-normal normal-case tracking-normal text-gray-400">· troca de bastão</span>
        </p>
        <p className="px-3 pt-1 text-sm font-medium text-gray-900">{p.label}</p>
        {p.reason && <p className="px-3 pt-0.5 text-xs text-gray-600">{p.reason}</p>}
        {p.state === 'pendente' ? (
          <div className="flex flex-wrap gap-2 px-3 pb-3 pt-2.5">
            <button type="button" disabled={busy} onClick={() => onConfirm(p.handoff)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60" style={{ background: color }}>
              <Check className="h-3.5 w-3.5" aria-hidden /> Passar ao {agentName(p.handoff)}
            </button>
            {others.map((o) => (
              <button key={o} type="button" disabled={busy} onClick={() => onConfirm(o)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:border-gray-300 disabled:opacity-60">
                <AgentDot id={o} /> Fazer com o {agentName(o)}
              </button>
            ))}
            <button type="button" disabled={busy} onClick={onRefuse} className="h-8 rounded-lg px-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
              Agora não
            </button>
          </div>
        ) : (
          <p className={cn('px-3 pb-3 pt-1.5 text-xs', p.state === 'feito' ? 'text-emerald-700' : p.state === 'erro' ? 'text-red-700' : 'text-gray-500')}>{p.state === 'feito' ? p.result ?? 'Bastão passado.' : p.state === 'erro' ? p.result ?? 'Não deu certo.' : 'Deixado para depois.'}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <p className="text-xs font-semibold text-violet-900">{p.label}</p>
      {names.length > 0 && (
        <ul className={cn('mt-1 text-xs text-gray-700', p.action === 'sugerir_melhoria' ? 'grid gap-1' : 'list-disc pl-4')}>
          {names.slice(0, 8).map((n, i) => (
            <li key={i} className={p.action === 'sugerir_melhoria' ? 'whitespace-pre-line' : 'truncate'}>
              {n}
            </li>
          ))}
          {names.length > 8 && <li>e mais {names.length - 8}</li>}
        </ul>
      )}
      {p.state === 'pendente' ? (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => onConfirm()} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            <Check className="h-3.5 w-3.5" aria-hidden /> {p.action === 'sugerir_melhoria' ? 'Enviar ao time' : 'Confirmar'}
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

const Bubble: React.FC<{ m: IaraMessage; busy: boolean; onProposal: (msg: string, p: IaraProposal, ok: boolean, agent?: string) => void }> = ({ m, busy, onProposal }) =>
  m.role === 'note' ? (
    <li className="flex items-center justify-center gap-1.5 py-0.5 text-[11px] text-gray-500">
      <span className="h-px w-6 bg-gray-200" aria-hidden />
      {m.agent && <AgentDot id={m.agent} />}
      {m.text}
      <span className="h-px w-6 bg-gray-200" aria-hidden />
    </li>
  ) : (
  <li className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
    <div
      className={cn('max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-gray-900 text-white' : m.error ? 'rounded-bl-md bg-red-50 text-red-900' : m.agent ? 'rounded-bl-md border bg-white text-gray-900' : 'rounded-bl-md bg-gray-100 text-gray-900')}
      style={m.agent && !m.error ? { borderColor: `${AGENT_COLORS[m.agent] ?? '#9ca3af'}66` } : undefined}
    >
      {m.agent && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: AGENT_COLORS[m.agent] ?? '#4b5563' }}>
          <AgentDot id={m.agent} /> {agentName(m.agent)}
          {m.handoff && <span className="truncate font-normal text-gray-500">· com o bastão: {m.handoff.task}</span>}
        </p>
      )}
      {m.steps && m.steps.length > 0 && (
        <ol className={cn('grid gap-0.5 text-[11px] text-gray-500', m.text && 'mb-2')} aria-label="Passos">
          {m.steps.map((st, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {m.live && i === m.steps!.length - 1 ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : <Check className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />}
              <span className="truncate">{st}</span>
            </li>
          ))}
        </ol>
      )}
      {m.text ? <p className="whitespace-pre-line">{m.text}</p> : m.live && !m.steps?.length ? <p className="flex items-center gap-1.5 text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Pensando</p> : null}
      {m.images && m.images.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {m.images.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-white ring-1 ring-black/5">
              <img src={src} alt={`Slide ${i + 1}`} className="w-full" loading="lazy" />
            </a>
          ))}
        </div>
      )}
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
      {m.proposals?.map((p) => <Proposal key={p.id} p={p} busy={busy} onConfirm={(agent) => onProposal(m.id, p, true, agent)} onRefuse={() => onProposal(m.id, p, false)} />)}
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
  const agentMode = useIaraLink((s) => s.agent)
  const ready = agentMode || !!ai
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

  const saveAll = (list: IaraMessage[]) => {
    const id = useIara.getState().teamId
    useIara.setState({ messages: list })
    if (id) writeMessages(id, list)
  }

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

  // Modo agente: os eventos do Claude Code chegam aqui e escrevem a mensagem da Iara
  const retried = useRef(new Set<string>())
  const lastRequest = useRef<{ id: string; text: string }>()
  useEffect(
    () =>
      onIaraEvent((e) => {
        const live = useIara.getState().liveId
        if (e.id !== live) return
        const team = useIara.getState().teamId
        if (e.type === 'step') patchMessage(e.id, (m) => ({ ...m, steps: (m.steps?.at(-1) === e.text ? m.steps : [...(m.steps ?? []), e.text]).slice(-14) }))
        if (e.type === 'text') patchMessage(e.id, (m) => ({ ...m, text: e.text }))
        if (e.type === 'session') writeSession(team, e.session)
        if (e.type === 'done') {
          if (e.session) writeSession(team, e.session)
          patchMessage(e.id, (m) => ({ ...m, text: e.text || m.text || 'Pronto.', live: false }))
          useIara.setState({ busy: false, step: undefined, liveId: undefined })
        }
        if (e.type === 'error') {
          // A sessão guardada sumiu (outra máquina, conector novo): recomeça uma vez sem ela
          const req = lastRequest.current
          if (/no conversation found|session/i.test(e.text) && req && !retried.current.has(e.id) && readSession(team)) {
            retried.current.add(e.id)
            writeSession(team, undefined)
            void agentPrompt(req.text, true).then((prompt) => sendToAgent({ id: e.id, text: prompt, system: agentSystem() }))
            return
          }
          patchMessage(e.id, (m) => ({ ...m, text: m.text ? `${m.text}\n\n${e.text}` : e.text, live: false, error: !m.text }))
          useIara.setState({ busy: false, step: undefined, liveId: undefined })
        }
      }),
    []
  )

  const sendAgent = useCallback(async (request: string) => {
    const id = uid()
    const team = useIara.getState().teamId
    saveAll([...useIara.getState().messages, { id, role: 'iara', text: '', at: Date.now(), live: true, steps: [] }])
    useIara.setState({ busy: true, liveId: id })
    lastRequest.current = { id, text: request }
    const resume = readSession(team)
    try {
      const prompt = await agentPrompt(request, !resume)
      sendToAgent({ id, text: prompt, system: agentSystem(), resume })
    } catch (e) {
      patchMessage(id, (m) => ({ ...m, text: e instanceof Error ? e.message : 'Não consegui montar o pedido.', live: false, error: true }))
      useIara.setState({ busy: false, liveId: undefined })
    }
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const request = raw.trim()
      if (!request || useIara.getState().busy) return
      const history = useIara.getState().messages
      const mine: IaraMessage = { id: uid(), role: 'user', text: request, at: Date.now() }
      save([...history, mine])
      setText('')
      if (useIaraLink.getState().agent) return void sendAgent(request)
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
    [save, sendAgent]
  )

  // "Pedir à Iara" de outras telas
  useEffect(() => {
    if (!queued || !ready) return
    useIara.setState({ queued: undefined })
    void send(queued)
  }, [queued, ready, send])

  /**
   * Troca de bastão: o agente escolhido faz a ação aqui na aba (a IA forçada para ele), escreve a
   * própria mensagem com os passos e as imagens, e no fim o bastão volta para a Iara, que confere.
   */
  const runHandoff = async (p: IaraProposal, agent: string) => {
    const args = { ...(p.args as Record<string, unknown>), agente: agent }
    const id = uid()
    saveAll([
      ...useIara.getState().messages,
      { id: uid(), role: 'note', agent, text: `A Iara passou o bastão ao ${agentName(agent)}`, at: Date.now() },
      { id, role: 'iara', agent, handoff: { to: agent, task: p.label }, text: '', at: Date.now(), live: true, steps: [] },
    ])
    useIara.setState({ busy: true, liveId: id, step: `${agentName(agent)} trabalhando` })
    let summary = ''
    let ok = false
    try {
      const r = await execAction(p.action, args)
      ok = r.done.some((d) => d.ok)
      const reply = (r.data as { resposta?: string; designer?: string } | undefined)?.resposta ?? (r.data as { designer?: string } | undefined)?.designer ?? ''
      const text = reply || r.done.map((d) => d.label).join('\n') || 'Pronto.'
      summary = `${r.done.map((d) => d.label).join('; ')}${reply ? `\n${reply}` : ''}${r.data && !reply ? `\nDados: ${JSON.stringify(r.data).slice(0, 1500)}` : ''}`
      patchMessage(id, (m) => ({ ...m, text, done: r.done, images: r.images?.map((i) => i.data).slice(0, 6), live: false, error: !ok }))
    } catch (e) {
      summary = `Falhou: ${e instanceof Error ? e.message : String(e)}`
      patchMessage(id, (m) => ({ ...m, text: summary, live: false, error: true }))
    }
    useIara.setState({ busy: false, step: undefined, liveId: undefined })
    // O bastão volta: a Iara confere e conta à pessoa (só no modo agente)
    saveAll([...useIara.getState().messages, { id: uid(), role: 'note', text: `O bastão voltou para a Iara${ok ? '' : ' (o trabalho não terminou)'}`, at: Date.now() }])
    if (useIaraLink.getState().agent) void sendAgent(handbackRequest(agent, p.label, summary))
  }

  const decide = async (msgId: string, p: IaraProposal, ok: boolean, agent?: string) => {
    const patch = (next: Partial<IaraProposal>) => save(useIara.getState().messages.map((m) => (m.id === msgId ? { ...m, proposals: m.proposals?.map((x) => (x.id === p.id ? { ...x, ...next } : x)) } : m)))
    if (!ok) return patch({ state: 'recusado' })
    if (useIara.getState().busy) return
    const who = agent ?? p.handoff
    if (p.handoff && who) {
      if (who === IARA_ENGINE && p.action === 'consultar_agente') return patch({ state: 'recusado' })
      patch({ state: 'feito', result: `Bastão com o ${agentName(who)}` })
      return runHandoff(p, who)
    }
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
              <p className="truncate text-[11px] text-gray-500">{screen ? `Vendo: ${screen.title}` : team.name}{ready && !agentMode ? ' · modo simples (atualize o conector)' : ''}</p>
            </div>
            {messages.length > 0 && (
              <button type="button" disabled={busy} onClick={() => {
                  save([])
                  writeSession(useIara.getState().teamId, undefined)
                }} aria-label="Limpar a conversa" title="Limpar a conversa" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40">
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
                <p className="text-sm text-gray-800">Oi! Sou a Iara. Crio ideias a partir dos seus números, escrevo roteiros e legendas, produzo e ajusto os criativos, organizo a pauta e deixo aprovações e envios prontos para você confirmar.</p>
                <div className="mt-4 grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" disabled={!ready || busy} onClick={() => void send(s)} className="rounded-xl border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol ref={listRef} className="grid gap-3" aria-live="polite">
                {messages.map((m) => (
                  <Bubble key={m.id} m={m} busy={busy} onProposal={(id, p, ok, agent) => void decide(id, p, ok, agent)} />
                ))}
                {busy && !useIara.getState().liveId && (
                  <li className="flex items-center gap-2 text-xs text-gray-500" role="status">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {step ?? 'Pensando'}
                  </li>
                )}
              </ol>
            )}
          </div>

          {!ready && (
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
                disabled={!ready}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
                placeholder={ready ? 'Peça ideias, criativos, roteiros, análises…' : 'Conecte o conector para conversar'}
                className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              {busy ? (
                <button type="button" onClick={() => {
                    const live = useIara.getState().liveId
                    if (live) stopAgent(live)
                    else abort.current?.abort()
                  }} aria-label="Parar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                  <Square className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <button type="submit" disabled={!text.trim() || !ready} aria-label="Enviar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-30">
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
