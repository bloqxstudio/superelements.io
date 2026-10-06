import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Crosshair,
  Eye,
  FileText,
  Loader2,
  MessagesSquare,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Terminal,
  X,
} from 'lucide-react'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { focusSection } from '@/features/space/bridge/focus'
import { parseSectionElements } from '@/features/space/landingPage'
import { findElement } from '@/features/space/navigator/elementorContentEditor'
import { layerKind, plainLayerText } from '@/features/space/navigator/navigatorLabels'
import { pageOf } from '@/features/space/pages/pages'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData } from '@/types/space'
import { AgentMark } from './AgentMark'
import { ConnectorPrompt } from './ConnectorPrompt'
import type { CanvasInsets } from './AgentCursors'
import { useChat } from './chatStore'
import { CHAT_AGENTS, CHAT_AGENT_IDS, type ChatAgentId, type ChatContext, type ChatMessage, type ChatPart, type ChatStep } from './protocol'

/**
 * O chat do projeto, embaixo no meio do canvas: a pessoa escreve, escolhe o
 * agente (Claude Code ou Codex) e o que está selecionado no canvas vai junto,
 * para o agente mexer só ali. Acima da caixa, a conversa: o texto do agente
 * chegando aos pedaços e cada ação dele numa linha. O cursor dele aparece no
 * canvas (`AgentCursors`). Quem roda o agente é o servidor de dev, ou, no app
 * publicado, o conector na máquina de quem usa (`ConnectorPrompt` liga).
 */

const MAX_WIDTH = 620
const MIN_WIDTH = 380

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

// ---------- onde a caixa fica ----------

/** No meio do espaço livre de baixo, sem cobrir a barra do canvas nem o painel do agente. */
function useComposerPlace(insets: CanvasInsets) {
  const width = useSpaceStore((s) => s.viewport.width)
  const [obstacles, setObstacles] = useState({ barRight: 0, panelLeft: Infinity })
  useEffect(() => {
    const measure = () => {
      const root = document.querySelector('[data-space-root]')?.getBoundingClientRect()
      if (!root) return
      const bar = document.querySelector('[data-canvas-bar]')?.getBoundingClientRect()
      const panel = document.querySelector('[data-claude-panel]')?.getBoundingClientRect()
      const next = { barRight: bar ? bar.right - root.left : 0, panelLeft: panel ? panel.left - root.left : Infinity }
      setObstacles((prev) => (prev.barRight === next.barRight && prev.panelLeft === next.panelLeft ? prev : next))
    }
    measure()
    const timer = setInterval(measure, 400)
    return () => clearInterval(timer)
  }, [])
  const free = { left: insets.left + 12, right: width - insets.right - 12 }
  let left = Math.max(free.left, obstacles.barRight + 12)
  let right = Math.min(free.right, obstacles.panelLeft - 12)
  let bottom = 12
  // Não cabe ao lado da barra: sobe uma linha e usa a largura toda
  if (right - left < MIN_WIDTH) {
    left = free.left
    right = free.right
    bottom = 60
  }
  const w = Math.max(280, Math.min(MAX_WIDTH, right - left))
  return { left: left + (right - left - w) / 2, width: w, bottom }
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

const AgentAvatar: React.FC<{ agent: ChatAgentId; size?: number }> = ({ agent, size = 24 }) => (
  <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: CHAT_AGENTS[agent].color }}>
    <AgentMark agent={agent} size={size - 7} />
  </span>
)

const AgentMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const info = CHAT_AGENTS[message.agent]
  const groups = groupParts(message.parts ?? [])
  const last = groups[groups.length - 1]
  const typing = !!message.streaming && !message.thinking && last?.type === 'text'
  return (
    <div className="flex gap-2.5">
      <AgentAvatar agent={message.agent} />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <p className="flex items-baseline gap-2 text-[12px]">
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
        {message.stopped && !message.error && <p className="text-[12px] text-gray-500">Parado por você.</p>}
        {!message.streaming && !!message.durationMs && (
          <p className="text-[10px] tabular-nums text-gray-400">
            {seconds(message.durationMs)}
            {message.costUsd ? ` · ${money(message.costUsd)}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

const UserMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const label = message.context ? contextLabel(message.context) : null
  const Icon = label?.icon
  return (
    <div className="flex flex-col items-end gap-1 pl-10">
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

export const SpaceChat: React.FC<{ insets: CanvasInsets }> = ({ insets }) => {
  const projectId = useProjectSync((s) => s.openId)
  const projectName = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.name)
  const { connected, agents, agent, open, setAgent, setOpen } = useChat(
    useShallow((s) => ({ connected: s.connected, agents: s.agents, agent: s.agent, open: s.open, setAgent: s.setAgent, setOpen: s.setOpen }))
  )
  const conversation = useChat((s) => (projectId ? s.conversations[projectId] : undefined))
  const context = useSelectionContext()
  const place = useComposerPlace(insets)
  const [draft, setDraft] = useState('')
  const [withSelection, setWithSelection] = useState(true)
  const [confirmReset, setConfirmReset] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLDivElement>(null)

  // Seleção nova volta a ir junto
  const selectionKey = `${context.sections.map((s) => s.id).join(',')}|${context.element?.elementId ?? ''}`
  useEffect(() => setWithSelection(true), [selectionKey])

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
  }, [tail, open])

  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmReset])

  // Autoaltura da caixa de texto
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  if (!projectId) return null
  // No dev quem roda os agentes é o servidor do Vite; publicado, o conector na máquina de quem usa
  if (!connected) return import.meta.hot ? null : <ConnectorPrompt place={place} />

  const shown = withSelection ? context : { pageId: context.pageId, pageName: context.pageName, sections: [] }
  const label = contextLabel(shown)
  const LabelIcon = label.icon
  const hasSelection = context.sections.length > 0 || !!context.element

  const send = (text = draft) => {
    const clean = text.trim()
    const { send } = useChat.getState()
    if (!clean || busy || !send || status?.available === false) return
    send({ projectId, projectName, agent, text: clean, context: shown })
    setDraft('')
    setOpen(true)
    pinned.current = true
  }

  const stop = () => useChat.getState().stop?.(projectId, agent)
  const reset = () => {
    if (!confirmReset) return setConfirmReset(true)
    useChat.getState().reset?.(projectId)
    setConfirmReset(false)
  }

  const stopEvents = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      data-space-chat
      className="pointer-events-auto absolute z-40 flex flex-col gap-2"
      style={{ left: place.left, width: place.width, bottom: place.bottom }}
      onWheel={stopEvents}
      onMouseDown={stopEvents}
      onPointerDown={stopEvents}
    >
      {open && (
        <section aria-label="Conversa com os agentes" className={`flex max-h-[min(56vh,560px)] flex-col overflow-hidden rounded-2xl ${ISLAND_SURFACE}`}>
          <header className="flex items-center gap-2 border-b border-gray-100 py-2 pl-3.5 pr-2">
            <MessagesSquare className="h-3.5 w-3.5 text-gray-400" />
            <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-900">
              Chat do projeto
              {running.length > 0 && (
                <span className="ml-2 font-normal text-gray-500">
                  {running.map((id) => CHAT_AGENTS[id].name).join(' e ')} trabalhando
                  <span aria-hidden className="se-agent-dots" />
                </span>
              )}
            </p>
            {messages.length > 0 && (
              <button
                className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors ${confirmReset ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                onClick={reset}
                title="Começa outra conversa: os agentes esquecem esta"
              >
                <RotateCcw className="h-3 w-3" />
                {confirmReset ? 'Apagar a conversa?' : 'Nova conversa'}
              </button>
            )}
            <button className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Recolher a conversa" onClick={() => setOpen(false)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </header>
          <div
            ref={list}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3"
            onScroll={(e) => {
              const el = e.currentTarget
              pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
            }}
          >
            {messages.length === 0 ? (
              <div className="space-y-3 py-2">
                <p className="text-[13px] leading-relaxed text-gray-600">
                  Peça ao <strong className="font-semibold text-gray-900">Claude Code</strong> ou ao <strong className="font-semibold text-gray-900">Codex</strong>. Selecione uma seção ou
                  uma camada no canvas: o agente trabalha só ali, e você vê o cursor dele.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestionsFor(shown).map((text) => (
                    <button
                      key={text}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-[12px] text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
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
        </section>
      )}

      <form
        className={`rounded-2xl ${ISLAND_SURFACE} transition-shadow focus-within:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_8px_24px_-6px_rgb(0_0_0/0.16)]`}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="flex items-center gap-1.5 px-2.5 pt-2.5">
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
          {!hasSelection && <span className="truncate text-[11px] text-gray-400">Selecione uma seção para o agente mexer só nela</span>}
        </div>
        <textarea
          ref={input}
          rows={1}
          value={draft}
          aria-label={`Mensagem para o ${info.name}`}
          placeholder={busy ? `${info.name} está trabalhando…` : `Peça ao ${info.name}…`}
          className="block max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-2 text-[14px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none"
          onChange={(e) => setDraft(e.target.value)}
          // Abre a conversa (ou, vazia, as sugestões) ao começar a escrever
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <div role="radiogroup" aria-label="Agente" className="flex items-center gap-0.5 rounded-xl bg-gray-50 p-0.5">
            {CHAT_AGENT_IDS.map((id) => {
              const available = agents.find((a) => a.id === id)
              const chosen = id === agent
              const working = running.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={available?.available === false}
                  title={available?.available === false ? available.reason : available?.version}
                  className={`relative inline-flex h-7 items-center gap-1.5 rounded-[10px] pl-1 pr-2.5 text-[12px] font-medium transition-[background-color,color,box-shadow] active:scale-[0.97] disabled:opacity-40 ${
                    chosen ? 'bg-white text-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.08)]' : 'text-gray-500 hover:text-gray-900'
                  }`}
                  onClick={() => setAgent(id)}
                >
                  <AgentAvatar agent={id} size={20} />
                  {CHAT_AGENTS[id].name}
                  {working && (
                    <span aria-label="trabalhando" className="relative ml-0.5 flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: CHAT_AGENTS[id].color }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: CHAT_AGENTS[id].color }} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          {messages.length > 0 && (
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors ${open ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              aria-pressed={open}
              title={open ? 'Recolher a conversa' : 'Mostrar a conversa'}
              onClick={() => setOpen(!open)}
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              {messages.filter((m) => m.role === 'user').length}
            </button>
          )}
          {busy ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white transition-transform hover:bg-gray-700 active:scale-[0.94]"
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-[transform,background-color] active:scale-[0.94] disabled:bg-gray-200 disabled:text-gray-400"
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
