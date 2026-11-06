import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, Lightbulb, Loader2, MousePointer2, PanelRight, PanelRightClose, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { ClaudePanel } from '@/features/space/bridge/ClaudePanel'
import { SpaceChat, type IaraChatHooks } from '@/features/space/chat/SpaceChat'
import { agentSystem, handbackRequest, iaraScreen, proposalDetail, runAction, setIaraNavigate } from './engine'
import { AGENT_COLORS, agentName, chatAgent, execAction, localAgents } from './actions'
import { addCard, cardsAfter, patchCard, sendWhenFree, useIaraFeed } from './feed'
import { useIara, type IaraMessage, type IaraProposal } from './store'
import { registerAttachment, workCommand } from './workControl'
import { isStopped, runWork } from '@/features/ia/work'
import { SuggestionForm, wantsSuggestion } from './SuggestionForm'
import { followOn, setFollow, setFollowNavigate } from './follow'
import { TeamBoard } from './TeamBoard'
import { WorkBar } from './WorkBar'
import { SquadBoard } from './SquadBoard'
import { runOrchestra, type OrchestraArgs } from './orchestra'
import { ROLES, readRole, writeRole, type IaraRole } from './roles'
import { IaraWelcome } from './IaraWelcome'
import { clearPickedText, describeScreen, pickedText, rememberScreen, screenOf } from './screens'

/**
 * A Iara: botão no canto, janela ou barra lateral, em qualquer tela (⌘/Ctrl + J). Desde 2026-11-05
 * o chat dela é o mesmo do canvas (`SpaceChat`: Claude Code ou Codex, skills, imagens, /usage,
 * /login, conversas anteriores), com as ações do produto como ferramentas. Num projeto a conversa
 * é a do projeto e o canvas vai junto; no resto do produto, a da conta.
 */

const SUGGESTIONS = [
  'Olha o que mais performou no Instagram e me dá 6 ideias na mesma linha',
  'Produz o criativo da próxima peça aprovada e me mostra',
  'Escreve o roteiro das ideias que estão sem roteiro',
  'Monta a pauta das próximas duas semanas, terças e quintas às 18h',
  'Quero sugerir uma melhoria no produto',
]

/** Projetos em que a pessoa fechou a Iara (não reabre sozinha até recarregar). */
const closedIn = new Set<string>()

const AgentDot: React.FC<{ id?: string; className?: string }> = ({ id, className }) =>
  id ? (
    <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: AGENT_COLORS[id] ?? '#6b7280' }} aria-hidden />
  ) : (
    <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500', className)} aria-hidden />
  )

/** As ações em que dá para escolher outro agente na hora de confirmar. */
const PICKS_AGENT = new Set(['tratar_imagem', 'produzir_criativo', 'editar_criativo', 'aplicar_design', 'criar_parecidos', 'criar_de_referencia', 'consultar_agente'])

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
    const others = PICKS_AGENT.has(p.action) ? localAgents().filter((a) => a !== p.handoff && (p.action !== 'consultar_agente' || a !== chatAgent())) : []
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

const Bubble: React.FC<{ m: IaraMessage; busy: boolean; onProposal: (msg: string, p: IaraProposal, ok: boolean, agent?: string) => void; onAskAi: (text: string) => void; onAdjust: (text: string) => void }> = ({ m, busy, onProposal, onAskAi, onAdjust }) =>
  m.squad ? (
    <li className="w-full">
      <SquadBoard m={m} />
    </li>
  ) : m.role === 'note' ? (
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
          {m.handoff && <span className="truncate font-normal text-gray-500">· {m.handoff.self ? '' : 'com o bastão: '}{m.handoff.task}</span>}
        </p>
      )}
      {m.live && m.handoff && <WorkBar />}
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
      {m.attachments && m.attachments.length > 0 && (
        <div className={cn('grid grid-cols-3 gap-1.5', m.text && 'mb-2')}>
          {m.attachments.map((a) => (
            <figure key={a.ref} className="overflow-hidden rounded-md bg-white/10">
              <img src={a.preview} alt={a.name} className="w-full" />
              <figcaption className="truncate px-1 py-0.5 text-[10px] opacity-70">{a.ref}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {m.team ? <TeamBoard m={m} onAdjust={onAdjust} /> : m.form ? <SuggestionForm m={m} onAskAi={onAskAi} /> : m.text ? <p className="whitespace-pre-line">{m.text}</p> : m.live && !m.steps?.length ? <p className="flex items-center gap-1.5 text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Pensando</p> : null}
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

/**
 * O chip da caixa: o que vai junto com o pedido. Como a seleção do canvas: o item escolhido na
 * tela (componente, slide, post…), ou o texto selecionado na página, ou só a tela aberta.
 */
const ScreenChip: React.FC<{ title?: string; selection?: () => string }> = ({ title, selection }) => {
  const [now, setNow] = useState({ item: '', text: '' })
  useEffect(() => {
    const read = () => setNow((prev) => {
      const next = { item: selection?.() ?? '', text: pickedText() }
      return prev.item === next.item && prev.text === next.text ? prev : next
    })
    read()
    const timer = setInterval(read, 600)
    return () => clearInterval(timer)
  }, [selection])
  const on = !!(now.item || now.text)
  const label = now.text ? `“${now.text}”` : now.item || title
  if (!label) return null
  return (
    <span
      title={now.text ? 'Texto que você selecionou na página: vai junto com o pedido' : on ? 'O que está selecionado nesta tela: vai junto com o pedido' : 'A Iara sabe o que está nesta tela'}
      className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]', on ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-gray-200 bg-gray-50 text-gray-600')}
    >
      {on ? <MousePointer2 className="h-3 w-3 shrink-0" aria-hidden /> : <Eye className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="truncate font-medium">{label}</span>
      {now.text && (
        <button
          type="button"
          aria-label="Não mandar o texto selecionado"
          className="-mr-0.5 rounded p-px opacity-60 hover:bg-violet-100 hover:opacity-100"
          onClick={() => {
            clearPickedText()
            setNow((n) => ({ ...n, text: '' }))
          }}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/** "Era outra coisa" no formulário de sugestão: o mesmo texto vai à IA, sem cair de novo no formulário. */
let skipIntercept = false
/** Os anexos da mensagem que está saindo (o intercept nomeia, o payload conta ao agente). */
let pendingAttachments: { ref: string; name: string }[] = []

export const IaraPanel: React.FC = () => {
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const open = useIara((s) => s.open)
  const busy = useIara((s) => s.busy)
  const screen = useIara((s) => s.screen)
  const queued = useIara((s) => s.queued)
  const cards = useIaraFeed((s) => s.items)
  const chatSend = useIaraFeed((s) => s.send)

  // Num projeto, a conversa é a do projeto (com o canvas); no resto do produto, a da conta
  const projectMatch = useMatch('/projetos/:projectId')
  const openProject = useProjectSync((s) => s.openId)
  const inProject = !!projectMatch && !!openProject && projectMatch.params.projectId === openProject
  const chatId = inProject ? openProject : team ? `conta-${team.id}` : undefined
  const projectName = useProjectStore((s) => s.projects.find((p) => p.id === openProject)?.name)
  useEffect(() => {
    useIaraFeed.setState({ chat: chatId })
  }, [chatId])
  // O caminho até aqui (as últimas telas) vai junto com o pedido
  const { pathname } = useLocation()
  useEffect(() => rememberScreen(pathname), [pathname])
  const here = screenOf(pathname)

  useEffect(() => {
    setIaraNavigate((to) => navigate(to))
    setFollowNavigate((to) => navigate(to))
  }, [navigate])
  const [following, setFollowing] = useState(followOn)
  const [role, setRole] = useState<IaraRole>(readRole)
  const roleRef = useRef(role)
  roleRef.current = role
  const [dock, setDock] = useState<boolean>(() => {
    try {
      return localStorage.getItem('iara-lateral') === '1'
    } catch {
      return false
    }
  })
  // Um painel lateral aberto (a peça da Pauta, o cartão da oportunidade): a Iara vira coluna e ele fica à esquerda dela
  const [sidePanel, setSidePanel] = useState(false)
  useEffect(() => {
    if (!open) return
    const check = () => setSidePanel(!!document.querySelector('.se-side-panel'))
    check()
    const timer = setInterval(check, 400)
    return () => clearInterval(timer)
  }, [open])
  // Num projeto a Iara é a coluna da direita (o chat do canvas mora nela) e abre ao entrar
  const docked = dock || inProject || sidePanel
  useEffect(() => {
    if (inProject && openProject && !closedIn.has(openProject)) useIara.setState({ open: true })
  }, [inProject, openProject])
  // Barra lateral: as telas abrem espaço para ela (a variável --iara-dock empurra o conteúdo)
  useEffect(() => {
    document.documentElement.style.setProperty('--iara-dock', open && docked ? '400px' : '0px')
    return () => {
      document.documentElement.style.setProperty('--iara-dock', '0px')
    }
  }, [open, docked])
  const toggleDock = () => {
    setDock((d) => {
      try {
        localStorage.setItem('iara-lateral', d ? '0' : '1')
      } catch {
        // vale até recarregar
      }
      return !d
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        useIara.setState((s) => ({ open: !s.open }))
      }
      // Esc só fecha a janela flutuante com o foco nela (no canvas o Esc é da seleção)
      if (e.key === 'Escape' && useIara.getState().open && !useIara.getState().busy && !docked && (e.target as HTMLElement | null)?.closest?.('[data-iara-panel]')) useIara.setState({ open: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [docked])

  // "Pedir à Iara" de outras telas: vai como mensagem quando o chat estiver pronto
  useEffect(() => {
    if (!queued || !chatSend) return
    useIara.setState({ queued: undefined })
    chatSend(queued)
  }, [queued, chatSend])

  /**
   * Troca de bastão confirmada: o agente escolhido faz a ação aqui na aba (a IA forçada para ele),
   * num cartão com os passos e as imagens; no fim o resultado volta à conversa para a Iara conferir.
   */
  const runHandoff = async (p: Pick<IaraProposal, 'action' | 'args' | 'label'>, agent: string, self = false) => {
    const args = { ...(p.args as Record<string, unknown>), agente: agent }
    const id = addCard({ role: 'iara', agent, handoff: { to: agent, task: p.label, self }, text: '', live: true, steps: [] })
    useIara.setState({ busy: true, liveId: id, step: `${agentName(agent)} trabalhando` })
    let summary = ''
    let stopped = false
    try {
      const r = await runWork(p.label, () => execAction(p.action, args))
      const ok = r.done.some((d) => d.ok)
      const reply = (r.data as { resposta?: string; designer?: string } | undefined)?.resposta ?? (r.data as { designer?: string } | undefined)?.designer ?? ''
      summary = `${r.done.map((d) => d.label).join('; ')}${reply ? `\n${reply}` : ''}${r.data && !reply ? `\nDados: ${JSON.stringify(r.data).slice(0, 1500)}` : ''}`
      patchCard(id, (m) => ({ ...m, text: reply || r.done.map((d) => d.label).join('\n') || 'Pronto.', done: r.done, images: r.images?.map((i) => i.data).slice(0, 6), live: false, error: !ok }))
    } catch (e) {
      stopped = isStopped(e)
      summary = stopped ? 'Você parou este trabalho. O que já tinha ficado pronto continua salvo.' : `Falhou: ${e instanceof Error ? e.message : String(e)}`
      patchCard(id, (m) => ({ ...m, text: summary, live: false, error: !stopped }))
    }
    useIara.setState({ busy: false, liveId: undefined, step: undefined })
    // Parado pela pessoa: a conversa não recebe nada (ela mesma decide o próximo passo)
    if (!stopped) void sendWhenFree(handbackRequest(agent, p.label, summary, self))
  }
  const runHandoffRef = useRef(runHandoff)
  runHandoffRef.current = runHandoff
  // As ações de criativo no agente do chat começam aqui direto, sem cartão de confirmar
  useEffect(() => {
    useIaraFeed.setState({ work: (p, agent) => void runHandoffRef.current(p, agent, true) })
    return () => useIaraFeed.setState({ work: undefined })
  }, [])

  const decide = async (cardId: string, p: IaraProposal, ok: boolean, agent?: string) => {
    const patch = (next: Partial<IaraProposal>) => patchCard(cardId, (m) => ({ ...m, proposals: m.proposals?.map((x) => (x.id === p.id ? { ...x, ...next } : x)) }))
    if (!ok) return patch({ state: 'recusado' })
    if (useIara.getState().busy) return
    if (p.action === 'orquestrar_criativo') {
      patch({ state: 'feito', result: 'Equipe montada' })
      const r = await runOrchestra(p.args as OrchestraArgs)
      void sendWhenFree(`[A equipe de agentes terminou] ${r.summary}`)
      return
    }
    const who = agent ?? p.handoff
    if (p.handoff && who) {
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

  const hooks = useMemo<IaraChatHooks>(
    () => ({
      payload: async () => {
        const named = pendingAttachments
        pendingAttachments = []
        const attached = named.length ? `## Imagens anexadas a esta mensagem\n${named.map((a) => `- ${a.ref} (${a.name})`).join('\n')}\nVocê as vê junto do pedido. Para usar nas ações de criativo, passe o nome em "anexos" (editar_criativo) ou "anexo" (criar_de_referencia).\n\n` : ''
        try {
          return { system: agentSystem(), screen: attached + (await iaraScreen(roleRef.current)) }
        } catch (e) {
          // Sem o material da conta (rede, permissão): a tela e a seleção vão mesmo assim
          console.warn('[Iara] não li o material da conta', e)
          const sel = useIara.getState().screen?.selection?.()
          return { system: agentSystem(), screen: `${attached}## Tela aberta agora\n${describeScreen()}${sel ? `\nSelecionado agora: ${sel}` : ''}${useIara.getState().screen ? `\n${useIara.getState().screen!.describe()}` : ''}` }
        }
      },
      cards: (after) => {
        const list = chatId ? cardsAfter(useIaraFeed.getState().items, chatId, after) : []
        return list.length ? (
          <ul className="grid gap-3">
            {list.map((m) => (
              <Bubble
                key={m.id}
                m={m}
                busy={useIara.getState().busy}
                onProposal={(id, p, ok, agent) => void decide(id, p, ok, agent)}
                onAskAi={(t) => {
                  skipIntercept = true
                  useIaraFeed.getState().send?.(t)
                }}
                onAdjust={(t) => useIaraFeed.getState().send?.(t)}
              />
            ))}
          </ul>
        ) : null
      },
      intercept: ({ text, images, skill, command }) => {
        // Fluxo sem IA: a sugestão ao time de produto abre o formulário na hora
        if (skipIntercept) {
          skipIntercept = false
          return false
        }
        // "pausa", "continua", "para": controla o trabalho em andamento, sem passar pelo agente
        if (!command && !images.length && workCommand(text)) return true
        // As imagens anexadas viram anexo-1, anexo-2…: as ações de criativo da Iara usam por esse nome
        if (images.length) pendingAttachments = images.map((img) => registerAttachment(img.name, img.data))
        if (command || images.length || skill || !wantsSuggestion(text)) return false
        addCard({ role: 'iara', text: '', form: { kind: 'sugestao', state: 'aberto', text } })
        return true
      },
      onReady: (send) => useIaraFeed.setState({ send }),
      intro: <IaraWelcome />,
      // Primeiro o que costumam querer nesta tela; depois o da função escolhida
      suggestions: [...new Set([...(here?.suggestions ?? []), ...ROLES[role].suggestions, ...SUGGESTIONS.slice(-1)])].slice(0, 5),
      chips: <ScreenChip title={screen?.title} selection={screen?.selection} />,
    }),
    // Os cartões mudam: o chat redesenha com a lista nova
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, role, screen, cards, busy, here]
  )

  if (!team || !chatId) return null

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
          data-iara-panel
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-white',
            docked
              ? 'inset-y-0 right-0 w-[min(400px,100vw)] border-l border-gray-200'
              : 'bottom-4 right-4 h-[min(680px,calc(100vh-32px))] w-[min(400px,calc(100vw-32px))] rounded-2xl shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_64px_-16px_rgb(0_0_0/0.35)]'
          )}
        >
          <header className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-gray-900">Iara</h2>
              <p className="truncate text-[11px] text-gray-500">{inProject ? `No projeto${projectName ? `: ${projectName}` : ''}` : screen ? `Vendo: ${screen.title}` : team.name}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={following}
              onClick={() => {
                setFollow(!following)
                setFollowing(!following)
              }}
              title={following ? 'Acompanhando: a Iara abre a tela em que está trabalhando e você vê tudo ao vivo' : 'Sem acompanhar: a Iara trabalha sem trocar a sua tela'}
              className={cn('flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium', following ? 'bg-violet-50 text-violet-700 hover:bg-violet-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')}
            >
              {following ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
              Acompanhar
            </button>
            <button
              type="button"
              onClick={() => addCard({ role: 'iara', text: '', form: { kind: 'sugestao', state: 'aberto' } })}
              aria-label="Sugerir uma melhoria ao time de produto"
              title="Sugerir uma melhoria ao time de produto"
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <Lightbulb className="h-4 w-4" aria-hidden />
            </button>
            {!inProject && !sidePanel && (
              <button type="button" onClick={toggleDock} aria-label={dock ? 'Voltar para a janela flutuante' : 'Abrir como barra lateral'} title={dock ? 'Voltar para a janela flutuante' : 'Abrir como barra lateral'} className="hidden h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 md:flex">
                {dock ? <PanelRightClose className="h-4 w-4" aria-hidden /> : <PanelRight className="h-4 w-4" aria-hidden />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (inProject && openProject) closedIn.add(openProject)
                useIara.setState({ open: false })
              }}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>
          <div role="radiogroup" aria-label="A Iara está copilotando" className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-1.5">
            {(Object.keys(ROLES) as IaraRole[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                title={ROLES[r].hint}
                onClick={() => {
                  setRole(r)
                  writeRole(r)
                }}
                className={cn('h-6 shrink-0 rounded-full px-2.5 text-[11px] font-medium', role === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}
              >
                {ROLES[r].label}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {inProject && <ClaudePanel inline />}
            <SpaceChat chatId={chatId} chatName={inProject ? projectName : `Iara · ${team.name}`} iara={hooks} />
          </div>
        </section>
      )}
    </>
  )
}
