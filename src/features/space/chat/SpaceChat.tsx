import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ArrowUp,
  Check,
  Crosshair,
  Eye,
  FileText,
  Loader2,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  History,
  Plus,
  Search,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { focusSection } from '@/features/space/bridge/focus'
import { parseSectionElements } from '@/features/space/landingPage'
import { findElement } from '@/features/space/navigator/elementorContentEditor'
import { layerKind, plainLayerText } from '@/features/space/navigator/navigatorLabels'
import { pageOf } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData } from '@/types/space'
import { ConnectorPrompt } from './ConnectorPrompt'
import { useConnector } from '@/features/space/connector/connectorStore'
import { useChat } from './chatStore'
import { CHAT_AGENTS, CHAT_AGENT_IDS, totalTokens, type ChatAgentId, type ChatContext, type ChatHistoryItem, type ChatMessage, type ChatPart, type ChatStep, type ChatTokens, type ChatUsageWindow } from './protocol'

/**
 * O chat do projeto, na aba Agente do painel da direita: a pessoa escreve, escolhe o
 * agente (Claude Code ou Codex) e o que está selecionado no canvas vai junto,
 * para o agente mexer só ali. Acima da caixa, a conversa: o texto do agente
 * chegando aos pedaços e cada ação dele numa linha. O cursor dele aparece no
 * canvas (`AgentCursors`). Quem roda o agente é o servidor de dev, ou, no app
 * publicado, o conector na máquina de quem usa (`ConnectorPrompt` liga).
 */


// ---------- o que está selecionado ----------

const ELEMENT_TEXT_KEYS = ['title', 'editor', 'text', 'button_text', 'heading', 'description_text', 'title_text']

function useSelectionContext(): ChatContext {
  const { nodes, pages, selectedIds, navigatorSelection, activePageId } = useSpaceStore(
    useShallow((s) => ({ nodes: s.nodes, pages: s.pages, selectedIds: s.selectedIds, navigatorSelection: s.navigatorSelection, activePageId: s.activePageId }))
  )
  return useMemo(() => {
    const sections = selectedIds.map((id) => nodes.find((n) => n.id === id && n.type === 'section')).filter((n): n is NonNullable<typeof n> => !!n)
    const page = (sections[0] && pageOf(pages, sections[0].id)) ?? pages.find((p) => p.id === activePageId) ?? pages[0]
    const context: ChatContext = {
      pageId: page?.id,
      pageName: page?.name,
      sections: sections.map((n) => ({ id: n.id, title: (n.data as SectionNodeData).title, index: page ? page.sectionIds.indexOf(n.id) : undefined })),
    }
    const owner = navigatorSelection && nodes.find((n) => n.id === navigatorSelection.sectionId)
    if (owner && navigatorSelection) {
      const element = findElement(parseSectionElements((owner.data as SectionNodeData).elementorJson), navigatorSelection.elementId)
      if (element) {
        const settings = (Array.isArray(element.settings) ? {} : element.settings ?? {}) as Record<string, unknown>
        const text = ELEMENT_TEXT_KEYS.map((k) => plainLayerText(settings[k])).find(Boolean)
        context.element = { sectionId: owner.id, elementId: navigatorSelection.elementId, kind: layerKind(element), text: text?.slice(0, 140) }
        if (!context.sections.some((s) => s.id === owner.id)) {
          context.sections.unshift({ id: owner.id, title: (owner.data as SectionNodeData).title, index: page?.sectionIds.indexOf(owner.id) })
        }
      }
    }
    return context
  }, [nodes, pages, selectedIds, navigatorSelection, activePageId])
}

const contextLabel = (context: ChatContext) => {
  if (context.element) {
    const owner = context.sections.find((s) => s.id === context.element!.sectionId)
    return { icon: Crosshair, text: `${context.element.kind}${context.element.text ? ` “${context.element.text}”` : ''}`, sub: owner?.title }
  }
  if (context.sections.length === 1) return { icon: RectangleHorizontal, text: context.sections[0].title, sub: context.pageName }
  if (context.sections.length > 1) return { icon: RectangleHorizontal, text: `${context.sections.length} seções`, sub: context.pageName }
  return { icon: FileText, text: context.pageName ? `Página ${context.pageName}` : 'Projeto todo', sub: undefined }
}

// ---------- mensagens ----------

const inline = (text: string) =>
  text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="rounded bg-gray-100 px-1 py-px font-mono text-[11.5px] text-gray-800">
          {part.slice(1, -1)}
        </code>
      )
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      )
    return <span key={i}>{part}</span>
  })

const LIST_ITEM = /^\s*([-*•]|\d+[.)])\s+/

const RichText: React.FC<{ text: string; caret?: boolean }> = ({ text, caret }) => {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-gray-800">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim())
        const end = caret && i === blocks.length - 1 ? <span aria-hidden className="se-chat-caret" /> : null
        if (lines.length && lines.every((l) => LIST_ITEM.test(l))) {
          const numbered = /^\s*\d/.test(lines[0])
          return (
            <ul key={i} className={`space-y-1 pl-4 ${numbered ? 'list-decimal' : 'list-disc'} marker:text-gray-400`}>
              {lines.map((l, j) => (
                <li key={j}>
                  {inline(l.replace(LIST_ITEM, ''))}
                  {j === lines.length - 1 && end}
                </li>
              ))}
            </ul>
          )
        }
        const heading = /^#{1,4}\s+/.test(lines[0] ?? '')
        return (
          <p key={i} className={heading ? 'font-semibold text-gray-900' : undefined}>
            {/* span e não Fragment: o lovable-tagger põe atributos em todo elemento JSX, e o Fragment não aceita */}
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#{1,4}\s+/, ''))}
              </span>
            ))}
            {end}
          </p>
        )
      })}
    </div>
  )
}

const STEP_ICON: Record<ChatStep['kind'], React.ComponentType<{ className?: string }>> = {
  canvas: MousePointer2,
  read: Eye,
  edit: PenLine,
  run: Terminal,
  search: Search,
  note: Sparkles,
}

const goToSection = (id: string) => {
  if (focusSection(id)) useSpaceStore.getState().setSelection([id])
}

const StepRow: React.FC<{ step: ChatStep }> = ({ step }) => {
  const Icon = STEP_ICON[step.kind] ?? Terminal
  const body = (
    <>
      <Icon className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="min-w-0 flex-1 truncate">{step.text}</span>
      {step.state === 'running' ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-gray-400" />
      ) : step.state === 'error' ? (
        <X className="h-3 w-3 shrink-0 text-red-500" />
      ) : (
        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
      )}
    </>
  )
  return (
    <li title={step.detail}>
      {step.sectionId ? (
        <button
          className="flex w-full items-center gap-1.5 rounded-md px-1 text-left text-[12px] leading-[22px] text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
          onClick={() => goToSection(step.sectionId!)}
        >
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 px-1 text-[12px] leading-[22px] text-gray-600">{body}</div>
      )}
    </li>
  )
}

const StepList: React.FC<{ steps: ChatStep[]; color: string }> = ({ steps, color }) => {
  const [all, setAll] = useState(false)
  const hidden = !all && steps.length > 5 ? steps.length - 4 : 0
  return (
    <ol className="border-l-2 pl-1.5" style={{ borderColor: `${color}40` }}>
      {hidden > 0 && (
        <li>
          <button className="px-1 text-[11px] leading-[22px] text-gray-500 hover:text-gray-900" onClick={() => setAll(true)}>
            +{hidden} {hidden === 1 ? 'passo' : 'passos'} antes
          </button>
        </li>
      )}
      {(hidden ? steps.slice(-4) : steps).map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </ol>
  )
}

/** Texto e passos na ordem; passos seguidos viram uma lista só. */
const groupParts = (parts: ChatPart[]) => {
  const groups: Array<{ type: 'text'; text: string } | { type: 'steps'; steps: ChatStep[] }> = []
  for (const part of parts) {
    const last = groups[groups.length - 1]
    if (part.type === 'step') {
      if (last?.type === 'steps') last.steps.push(part.step)
      else groups.push({ type: 'steps', steps: [part.step] })
    } else if (part.text.trim()) groups.push({ type: 'text', text: part.text })
  }
  return groups
}

const money = (usd: number) => `US$ ${usd.toFixed(2).replace('.', ',')}`
const seconds = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`)
const clock = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const AgentMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const info = CHAT_AGENTS[message.agent]
  const groups = groupParts(message.parts ?? [])
  const last = groups[groups.length - 1]
  const typing = !!message.streaming && !message.thinking && last?.type === 'text'
  return (
    <div className="flex">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex items-center gap-1.5 text-[12px]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: info.color }} />
          <span className="font-semibold text-gray-900">{info.name}</span>
          <time className="text-[10px] tabular-nums text-gray-400">{clock(message.at)}</time>
        </p>
        {groups.map((group, i) =>
          group.type === 'text' ? (
            <RichText key={i} text={group.text} caret={typing && i === groups.length - 1} />
          ) : (
            <StepList key={i} steps={group.steps} color={info.color} />
          )
        )}
        {message.streaming && (message.thinking || !groups.length) && (
          <p className="se-chat-shimmer text-[12px] font-medium">{groups.length ? 'Trabalhando' : 'Pensando'}</p>
        )}
        {message.error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] leading-snug text-red-700">{message.error}</p>}
        {message.error && <AuthHint agent={message.agent} error={message.error} />}
        {message.stopped && !message.error && <p className="text-[12px] text-gray-500">Parado por você.</p>}
        {!message.streaming && !!message.durationMs && <UsageLine message={message} />}
      </div>
    </div>
  )
}

const UserMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const label = message.context ? contextLabel(message.context) : null
  const Icon = label?.icon
  return (
    <div className="flex flex-col items-end gap-1 pl-6">
      {label && Icon && (
        <span className="inline-flex max-w-full items-center gap-1 text-[11px] text-gray-500">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {label.text}
            {label.sub && <span className="text-gray-400"> · {label.sub}</span>}
          </span>
          <span className="shrink-0 text-gray-400">→ {CHAT_AGENTS[message.agent].name}</span>
        </span>
      )}
      <div className="max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gray-100 px-3 py-2 text-[13px] leading-relaxed text-gray-900">{message.text}</div>
    </div>
  )
}

const suggestionsFor = (context: ChatContext) => {
  if (context.element) return ['Deixe este texto mais curto e direto', 'Sugira três versões para este texto, sem mudar ainda']
  if (context.sections.length) return ['Deixe esta seção mais compacta no celular', 'Reescreva os textos desta seção com o tom da marca', 'Crie uma seção de perguntas frequentes logo abaixo']
  return ['Revise os títulos desta página e diga o que melhorar', 'Crie uma seção de perguntas frequentes no fim da página']
}

// ---------- o chat ----------

/**
 * A aba Agente do painel da direita, como no Framer: a conversa ocupa o
 * painel e a caixa fica embaixo. Só aparecem os agentes que existem neste
 * computador (Claude Code, Codex), pelo nome; sem nenhum, a aba explica.
 */
export const SpaceChat: React.FC = () => {
  const projectId = useProjectSync((s) => s.openId)
  const projectName = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.name)
  const { connected, agents, agent, setAgent } = useChat(
    useShallow((s) => ({ connected: s.connected, agents: s.agents, agent: s.agent, setAgent: s.setAgent }))
  )
  const conversation = useChat((s) => (projectId ? s.conversations[projectId] : undefined))
  const context = useSelectionContext()
  const [draft, setDraft] = useState('')
  const [withSelection, setWithSelection] = useState(true)
  // A lista das conversas anteriores no lugar da conversa
  const [showHistory, setShowHistory] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLDivElement>(null)

  // Seleção nova volta a ir junto
  const selectionKey = `${context.sections.map((s) => s.id).join(',')}|${context.element?.elementId ?? ''}`
  useEffect(() => setWithSelection(true), [selectionKey])

  // Só os agentes instalados aqui; a lista chega do servidor (ou do conector) ao ligar
  const available = useMemo(() => CHAT_AGENT_IDS.filter((id) => agents.find((a) => a.id === id)?.available), [agents])
  // O escolhido sumiu (não está instalado): vale o primeiro que existe
  useEffect(() => {
    if (available.length && !available.includes(agent)) setAgent(available[0])
  }, [available, agent, setAgent])

  const messages = conversation?.messages ?? []
  const running = conversation?.running ?? []
  const busy = running.includes(agent)
  const status = agents.find((a) => a.id === agent)
  const info = CHAT_AGENTS[agent]
  const lastMessage = messages[messages.length - 1]
  const tail = `${messages.length}:${lastMessage?.parts?.length ?? 0}:${lastMessage?.parts?.reduce((n, p) => n + (p.type === 'text' ? p.text.length : 1), 0) ?? 0}`

  // A conversa acompanha o fim, a não ser que a pessoa tenha subido para ler
  const pinned = useRef(true)
  useEffect(() => {
    const el = list.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [tail])

  // Autoaltura da caixa de texto
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  if (!projectId) return null
  // No dev quem roda os agentes é o servidor do Vite; publicado, o conector na máquina de quem usa
  if (!connected) {
    return import.meta.hot ? (
      <EmptyAgents title="Ligando os agentes…" text="O servidor de desenvolvimento ainda não respondeu. Se demorar, recarregue a página." />
    ) : (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConnectorPrompt />
      </div>
    )
  }
  // Ligado, mas sem a lista de quem existe ainda
  if (!agents.length) return <EmptyAgents title="Procurando os agentes…" text="Conferindo o Claude Code e o Codex neste computador." />
  if (!available.length) {
    return (
      <EmptyAgents
        title="Nenhum agente neste computador"
        text={`Instale o Claude Code ou o Codex e abra o conector de novo: eles aparecem aqui para mexer no canvas. ${agents
          .map((a) => `${CHAT_AGENTS[a.id].name}: ${a.reason ?? 'não encontrado'}`)
          .join(' · ')}`}
        action={<ConnectorBar />}
      />
    )
  }

  const shown = withSelection ? context : { pageId: context.pageId, pageName: context.pageName, sections: [] }
  const label = contextLabel(shown)
  const LabelIcon = label.icon
  const hasSelection = context.sections.length > 0 || !!context.element
  const names = available.map((id) => CHAT_AGENTS[id].name)

  const send = (text = draft) => {
    const clean = text.trim()
    const { send } = useChat.getState()
    if (!clean || busy || !send || status?.available === false) return
    send({ projectId, projectName, agent, text: clean, context: shown })
    // O /usage da barrinha não apaga o que a pessoa estava escrevendo
    if (text === draft) setDraft('')
    pinned.current = true
  }

  const stop = () => useChat.getState().stop?.(projectId, agent)
  // A atual vai para o histórico: nada se perde, então não pergunta
  const startNew = () => {
    useChat.getState().reset?.(projectId)
    setShowHistory(false)
    pinned.current = true
  }
  const openOld = (epoch: number) => {
    useChat.getState().openConversation?.(projectId, epoch)
    setShowHistory(false)
    pinned.current = true
  }

  return (
    <div data-space-chat className="flex min-h-0 flex-1 flex-col">
      <ConnectorBar />
      <ConversationBar
        messages={messages}
        running={running}
        historyCount={conversation?.history?.length ?? 0}
        showHistory={showHistory}
        onHistory={() => setShowHistory((open) => !open)}
        onNew={startNew}
      />
      <PlanUsageBar agent={agent} onShow={() => send('/usage')} disabled={busy} />

      {showHistory ? (
        <HistoryList
          items={conversation?.history ?? []}
          current={messages.length ? summaryOf(messages) : null}
          locked={running.length > 0}
          onOpen={openOld}
          onForget={(epoch) => useChat.getState().forgetConversation?.(projectId, epoch)}
          onCurrent={() => setShowHistory(false)}
        />
      ) : (
      <div
        ref={list}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3"
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
      >
        {messages.length === 0 ? (
          <div className="space-y-3 py-1">
            <p className="text-[13px] leading-relaxed text-gray-600">
              Peça ao <strong className="font-semibold text-gray-900">{names[0]}</strong>
              {names.length > 1 && (
                <>
                  {' '}
                  ou ao <strong className="font-semibold text-gray-900">{names[1]}</strong>
                </>
              )}
              . Selecione uma seção ou uma camada no canvas: o agente trabalha só ali, e você vê o cursor dele.
            </p>
            <p className="text-[11px] leading-relaxed text-gray-400">
              Digite <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">/usage</code> para ver quanto do plano já usou, ou{' '}
              <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">/login</code> se o agente sair da conta.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestionsFor(shown).map((text) => (
                <button
                  key={text}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-left text-[12px] text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  onClick={() => {
                    setDraft(text)
                    input.current?.focus()
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (message.role === 'user' ? <UserMessage key={message.id} message={message} /> : <AgentMessage key={message.id} message={message} />))
        )}
      </div>
      )}

      <form
        className="m-2 shrink-0 rounded-xl border border-gray-200 bg-white transition-[border-color,box-shadow] focus-within:border-gray-300 focus-within:shadow-[0_4px_16px_-6px_rgb(0_0_0/0.16)]"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="flex items-center gap-1.5 px-2 pt-2">
          <button
            type="button"
            className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
              withSelection && hasSelection ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-gray-200 bg-gray-50 text-gray-600'
            }`}
            title={hasSelection && !withSelection ? 'Mandar a seleção junto de novo' : 'Vai junto com a mensagem'}
            onClick={() => hasSelection && setWithSelection(true)}
          >
            <LabelIcon className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium">{label.text}</span>
            {label.sub && <span className="shrink-0 truncate opacity-60">· {label.sub}</span>}
            {withSelection && hasSelection && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Não mandar a seleção"
                className="-mr-0.5 rounded p-px opacity-60 hover:bg-violet-100 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setWithSelection(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    setWithSelection(false)
                  }
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        </div>
        <textarea
          ref={input}
          rows={2}
          value={draft}
          aria-label={`Mensagem para o ${info.name}`}
          placeholder={busy ? `${info.name} está trabalhando…` : hasSelection ? 'O que mudar aqui?' : `Peça ao ${info.name}…`}
          className="block max-h-40 w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[13px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          {available.length > 1 ? (
            <div role="radiogroup" aria-label="Agente" className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
              {available.map((id) => {
                const chosen = id === agent
                const working = running.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    title={agents.find((a) => a.id === id)?.version}
                    className={`relative inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-[background-color,color,box-shadow] active:scale-[0.97] ${
                      chosen ? 'bg-white text-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.08)]' : 'text-gray-500 hover:text-gray-900'
                    }`}
                    onClick={() => setAgent(id)}
                  >
                    <AgentDot agent={id} working={working} />
                    {CHAT_AGENTS[id].name}
                  </button>
                )
              })}
            </div>
          ) : (
            <span className="inline-flex h-6 items-center gap-1.5 px-1 text-[11px] font-medium text-gray-600" title={status?.version}>
              <AgentDot agent={agent} working={busy} />
              {info.name}
            </span>
          )}
          <div className="flex-1" />
          {busy ? (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white transition-transform hover:bg-gray-700 active:scale-[0.94]"
              aria-label={`Parar o ${info.name}`}
              title={`Parar o ${info.name}`}
              onClick={stop}
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() || status?.available === false}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-[transform,background-color] active:scale-[0.94] disabled:bg-gray-200 disabled:text-gray-400"
              style={draft.trim() ? { background: info.color } : undefined}
              aria-label={`Enviar para o ${info.name}`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// ---------- tokens e histórico ----------

/** "850 tokens", "18,4 mil tokens", "1,2 mi de tokens". */
const tokensLabel = (n: number) =>
  n < 1000
    ? `${n} tokens`
    : n < 1_000_000
      ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n < 10_000 ? 1 : 0 })} mil tokens`
      : `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi de tokens`

const tokensDetail = (t: ChatTokens) =>
  [
    `Entrada: ${t.input.toLocaleString('pt-BR')}`,
    `Saída: ${t.output.toLocaleString('pt-BR')}`,
    ...(t.cacheRead ? [`Lidos do cache: ${t.cacheRead.toLocaleString('pt-BR')}`] : []),
    ...(t.cacheWrite ? [`Gravados no cache: ${t.cacheWrite.toLocaleString('pt-BR')}`] : []),
  ].join(' · ')

/** Tempo, tokens e custo de uma resposta, embaixo dela. */
const UsageLine: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const tokens = totalTokens(message.tokens)
  return (
    <p className="text-[10px] tabular-nums text-gray-400" title={message.tokens ? tokensDetail(message.tokens) : undefined}>
      {seconds(message.durationMs ?? 0)}
      {tokens > 0 && ` · ${tokensLabel(tokens)}`}
      {message.costUsd ? ` · ${money(message.costUsd)}` : ''}
    </p>
  )
}

/** Soma da conversa: pedidos, tokens (com o detalhe) e custo. */
function summaryOf(messages: ChatMessage[]) {
  const sum = (pick: (t: ChatTokens) => number) => messages.reduce((n, m) => n + (m.tokens ? pick(m.tokens) : 0), 0)
  const tokens: ChatTokens = { input: sum((t) => t.input), output: sum((t) => t.output), cacheRead: sum((t) => t.cacheRead ?? 0), cacheWrite: sum((t) => t.cacheWrite ?? 0) }
  const first = messages.find((m) => m.role === 'user')?.text?.replace(/\s+/g, ' ').trim()
  return {
    title: first || 'Conversa nova',
    requests: messages.filter((m) => m.role === 'user').length,
    tokens,
    total: totalTokens(tokens),
    costUsd: messages.reduce((n, m) => n + (m.costUsd ?? 0), 0),
    startedAt: messages[0]?.at,
  }
}

const day = (at: number) => {
  const date = new Date(at)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? `hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Quando a janela do plano renova: "15:30" hoje, ou "13/10, 09:00". */
const resetLabel = (at: number | undefined) => {
  if (!at) return ''
  const date = new Date(at)
  return new Date().toDateString() === date.toDateString()
    ? `renova às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : `renova em ${date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Quanto do plano a conta do agente nesta máquina já usou, como o /usage do
 * Claude Code: a sessão de 5 horas e a semana. Vem com cada resposta; clicar
 * pede o /usage com o detalhe.
 */
const PlanUsageBar: React.FC<{ agent: ChatAgentId; onShow: () => void; disabled?: boolean }> = ({ agent, onShow, disabled }) => {
  const usage = useChat((s) => s.planUsage[agent])
  if (!usage || (!usage.session && !usage.week)) return null
  const meter = (label: string, window: ChatUsageWindow | undefined) => {
    if (!window) return null
    const pct = Math.round(window.used * 100)
    const tone = window.used >= 0.9 ? 'bg-red-500' : window.used >= 0.7 ? 'bg-amber-500' : 'bg-gray-800'
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1.5" title={`${label}: ${pct}% usado${window.resetsAt ? ` · ${resetLabel(window.resetsAt)}` : ''}`}>
        <span className="shrink-0 text-gray-500">{label}</span>
        <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
          <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </span>
        <span className="shrink-0 tabular-nums text-gray-700">{pct}%</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onShow}
      disabled={disabled}
      title={`Uso do plano do ${CHAT_AGENTS[agent].name} nesta máquina · clique para ver o detalhe (/usage)`}
      className="flex h-8 w-full shrink-0 items-center gap-3 border-b border-gray-100 px-3 text-left text-[10px] transition-colors hover:bg-gray-50 disabled:pointer-events-none"
    >
      {meter('Sessão', usage.session)}
      {meter('Semana', usage.week)}
    </button>
  )
}

interface ConversationBarProps {
  messages: ChatMessage[]
  running: ChatAgentId[]
  historyCount: number
  showHistory: boolean
  onHistory: () => void
  onNew: () => void
}

/** Em cima da conversa: o histórico, o que esta conversa é, o gasto dela e começar outra. */
const ConversationBar: React.FC<ConversationBarProps> = ({ messages, running, historyCount, showHistory, onHistory, onNew }) => {
  const summary = summaryOf(messages)
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-gray-100 pl-1.5 pr-1.5">
      <button
        type="button"
        onClick={onHistory}
        aria-pressed={showHistory}
        title={showHistory ? 'Voltar para a conversa' : 'Conversas anteriores deste projeto'}
        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium transition-colors ${showHistory ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        <History className="h-3.5 w-3.5" />
        {historyCount > 0 && <span className="tabular-nums">{historyCount}</span>}
      </button>
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-[12px] font-medium text-gray-900">{showHistory ? 'Conversas' : summary.title}</p>
        <p className="truncate text-[10px] tabular-nums text-gray-400" title={summary.total ? tokensDetail(summary.tokens) : undefined}>
          {running.length > 0 ? (
            <>
              {running.map((id) => CHAT_AGENTS[id].name).join(' e ')} trabalhando
              <span aria-hidden className="se-agent-dots" />
            </>
          ) : summary.requests ? (
            [
              `${summary.requests} ${summary.requests === 1 ? 'pedido' : 'pedidos'}`,
              summary.total ? tokensLabel(summary.total) : '',
              summary.costUsd ? money(summary.costUsd) : '',
            ]
              .filter(Boolean)
              .join(' · ')
          ) : (
            'Sem pedidos ainda'
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        disabled={!messages.length}
        title="Começa outra conversa; esta fica no histórico"
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Nova
      </button>
    </div>
  )
}

interface HistoryListProps {
  items: ChatHistoryItem[]
  current: ReturnType<typeof summaryOf> | null
  /** Agente trabalhando: não troca de conversa no meio da resposta. */
  locked: boolean
  onOpen: (epoch: number) => void
  onForget: (epoch: number) => void
  onCurrent: () => void
}

/** As conversas do projeto, a atual primeiro; abrir uma continua de onde ela parou. */
const HistoryList: React.FC<HistoryListProps> = ({ items, current, locked, onOpen, onForget, onCurrent }) => {
  const [confirm, setConfirm] = useState<number | null>(null)
  useEffect(() => {
    if (confirm === null) return
    const timer = setTimeout(() => setConfirm(null), 3000)
    return () => clearTimeout(timer)
  }, [confirm])

  const meta = (requests: number, total: number, cost?: number) =>
    [`${requests} ${requests === 1 ? 'pedido' : 'pedidos'}`, total ? tokensLabel(total) : '', cost ? money(cost) : ''].filter(Boolean).join(' · ')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {current && (
        <button type="button" onClick={onCurrent} className="mb-1 w-full rounded-lg bg-gray-100 px-2.5 py-2 text-left transition-colors hover:bg-gray-200/70">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Atual
          </span>
          <span className="mt-0.5 block truncate text-[12px] font-medium text-gray-900">{current.title}</span>
          <span className="block truncate text-[10px] tabular-nums text-gray-500">{meta(current.requests, current.total, current.costUsd)}</span>
        </button>
      )}
      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.epoch} className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-gray-50">
              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen(item.epoch)}
                title={locked ? 'Espere o agente terminar para trocar de conversa' : 'Abrir e continuar esta conversa'}
                className="min-w-0 flex-1 px-2.5 py-2 text-left disabled:cursor-not-allowed"
              >
                <span className="block truncate text-[12px] text-gray-800">{item.title}</span>
                <span className="block truncate text-[10px] tabular-nums text-gray-400">
                  {day(item.updatedAt)} · {meta(item.requests, item.tokens, item.costUsd)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => (confirm === item.epoch ? (onForget(item.epoch), setConfirm(null)) : setConfirm(item.epoch))}
                aria-label={confirm === item.epoch ? 'Confirmar: apagar esta conversa' : 'Apagar esta conversa'}
                title={confirm === item.epoch ? 'Clique de novo para apagar' : 'Apagar'}
                className={`shrink-0 rounded-md p-1.5 transition-[color,background-color,opacity] ${
                  confirm === item.epoch ? 'bg-red-50 text-red-600 opacity-100' : 'text-gray-400 opacity-0 hover:bg-gray-100 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-8 text-center text-[11px] leading-relaxed text-gray-400">
          Ainda não há conversas anteriores. Ao começar uma nova, esta fica guardada aqui para você voltar e continuar.
        </p>
      )}
    </div>
  )
}

/** Ponto na cor do agente, pulsando enquanto ele trabalha. Sem logo: o nome diz quem é. */
const AgentDot: React.FC<{ agent: ChatAgentId; working?: boolean }> = ({ agent, working }) => (
  <span aria-label={working ? 'trabalhando' : undefined} className="relative flex h-1.5 w-1.5 shrink-0">
    {working && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: CHAT_AGENTS[agent].color }} />}
    <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: CHAT_AGENTS[agent].color }} />
  </span>
)

const EmptyAgents: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="flex flex-1 flex-col">
    {action}
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] font-medium text-gray-800">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{text}</p>
    </div>
  </div>
)

/**
 * Ligado pelo conector (app publicado): de que computador vêm os agentes e
 * como desligar. Desconectar volta para os passos de ligar, para trocar de
 * código, de máquina, ou tentar de novo depois de mexer numa permissão.
 */
const ConnectorBar: React.FC = () => {
  const status = useConnector((s) => s.status)
  const pairing = useConnector((s) => s.pairing)
  if (status !== 'connected' || !pairing) return null
  const code = `${pairing.code.slice(0, 3)}-${pairing.code.slice(3)}`
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-gray-100 pl-3 pr-1.5 text-[11px] text-gray-500">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span className="min-w-0 flex-1 truncate" title={`Conector deste computador · código ${code}${pairing.port !== 47823 ? ` · porta ${pairing.port}` : ''}`}>
        Agentes deste computador · <span className="font-mono">{code}</span>
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md px-1.5 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        onClick={() => useConnector.getState().disconnect()}
        title="Desliga o conector e volta para os passos de ligar"
      >
        Desconectar
      </button>
    </div>
  )
}

/**
 * Login vencido ou ausente: `/login` digitado aqui no chat roda o login do
 * agente na máquina do conector, que abre o navegador para entrar na conta.
 */
const AuthHint: React.FC<{ agent: ChatAgentId; error: string }> = ({ agent, error }) => {
  if (!/authenticat|oauth|log ?in|login|unauthori[sz]ed|\b401\b|api key|credential/i.test(error)) return null
  return (
    <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] leading-snug text-amber-900">
      O {CHAT_AGENTS[agent].name} deste computador saiu da conta. Digite <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">/login</code> aqui no
      chat: o navegador abre para você entrar de novo. Depois mande o pedido outra vez.
    </p>
  )
}
