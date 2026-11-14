import { openViewer } from '@/components/MediaViewer'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Check,
  Crosshair,
  Eye,
  FileText,
  ImagePlus,
  Images,
  Loader2,
  MessagesSquare,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  History,
  Plus,
  Search,
  Sparkles,
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
import { ChatComposer, ManageSkillsLink, hasFiles, type ChatComposerHandle, type ComposerMessage } from './ChatComposer'
import { useChat } from './chatStore'
import { AgentModelButton } from '@/features/ia/AgentModelDialog'
import {
  CHAT_AGENTS,
  CHAT_AGENT_IDS,
  CHAT_IMAGE_LIMIT,
  modelLabel,
  totalTokens,
  type ChatAgentId,
  type ChatContext,
  type ChatHistoryItem,
  type ChatMessage,
  type ChatSkillRef,
  type ChatPart,
  type ChatStep,
  type ChatTokens,
  type ChatUsageWindow,
} from './protocol'
import { skillById, type ChatSkill } from './skills'
import { skillIcon } from '@/features/skills/skillIcon'
import { useSkillList, useSkills, watchSkills } from '@/features/skills/skillsStore'

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
          {message.model && (
            <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500" title={message.model}>
              {modelLabel(message.model)}
            </span>
          )}
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
  // Mensagem antiga guarda só o id da padrão
  const skill = typeof message.skill === 'string' ? skillById(message.skill) : message.skill
  const SkillIcon = skill ? skillIcon({ id: skill.id, source: skillById(skill.id) ? 'builtin' : 'personal' }) : null
  const images = message.images ?? []
  // Todas numa linha: uma grande, ou até quatro lado a lado
  const tile = ['', '', 'h-28 w-28', 'h-[84px] w-[84px]', 'h-[62px] w-[62px]'][Math.min(images.length, 4)]
  return (
    <div className="flex flex-col items-end gap-1 pl-6">
      {label && Icon && (
        <span className="inline-flex max-w-full items-center gap-1 text-[11px] text-gray-500">
          {skill && SkillIcon && (
            <span className="mr-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-900 px-1.5 py-px text-[10.5px] font-medium text-white">
              <SkillIcon className="h-2.5 w-2.5" />
              {skill.name}
            </span>
          )}
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {label.text}
            {label.sub && <span className="text-gray-400"> · {label.sub}</span>}
          </span>
          <span className="shrink-0 text-gray-400">→ {CHAT_AGENTS[message.agent].name}</span>
        </span>
      )}
      {images.length > 0 && (
        <div className="flex max-w-full justify-end gap-1.5">
          {images.map((image, i) =>
            image.preview ? (
              <img
                key={i}
                src={image.preview}
                alt={image.name}
                onClick={() => openViewer(images.filter((x) => x.preview).map((x) => ({ src: x.preview!, name: x.name, kind: 'image' as const })), images.filter((x) => x.preview).indexOf(image))}
                role="button"
                style={{ cursor: 'zoom-in' }}
                title={`${image.name}${image.width ? ` · ${image.width}×${image.height}` : ''}`}
                className={`rounded-xl border border-gray-200 bg-gray-100 object-cover ${images.length === 1 ? 'max-h-44 max-w-full' : tile}`}
              />
            ) : (
              <span key={i} title={image.name} className={`flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400 ${tile || 'h-28 w-28'}`}>
                <Images className="h-5 w-5" />
              </span>
            )
          )}
        </div>
      )}
      {message.text && (
        <div className="max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gray-100 px-3 py-2 text-[13px] leading-relaxed text-gray-900">{message.text}</div>
      )}
    </div>
  )
}

/** Quantas cabem no grid da conversa vazia; o resto fica no menu. */
const GRID_SKILLS = 8

/** A skill que vai no pedido: a padrão pelo id; a cadastrada com as instruções e a versão. */
const skillRef = (skill: ChatSkill): ChatSkillRef =>
  skill.source === 'builtin'
    ? { id: skill.id, name: skill.name }
    : { id: skill.id, name: skill.name, instructions: skill.instructions, version: String(skill.updatedAt ?? '') }

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
/**
 * Quando o chat é a Iara (2026-11-05, o usuário: "aquele campo do projeto deve ser o campo da
 * Iara… a Iara precisa conseguir acessar tudo e na escolha que o usuário fizer"): o mesmo chat, com
 * Claude Code ou Codex, skills, imagens, /usage e /login, mais as ações do produto (ferramentas MCP
 * da Iara, montadas pelo servidor do chat) e os cartões que elas deixam. Fora de um projeto a
 * conversa é a da conta (`conta-<id>`), sem o canvas.
 */
export interface IaraChatHooks {
  /** As regras e as ações (primeira mensagem) e a tela aberta (toda mensagem). */
  payload: () => Promise<{ system: string; screen: string }>
  /** Os cartões da Iara depois de uma mensagem ('' = antes de todas). */
  cards: (afterId: string) => React.ReactNode
  /** Fluxo sem IA (a sugestão ao time de produto): devolve true quando tratou a mensagem. */
  intercept?: (message: ComposerMessage) => boolean
  /** Recebe a função que manda um texto pronto à conversa (o bastão de volta, "Pedir à Iara"). */
  onReady?: (send: ((text: string) => void) | undefined) => void
  intro?: React.ReactNode
  suggestions?: string[]
  chips?: React.ReactNode
}

export const SpaceChat: React.FC<{ chatId?: string; chatName?: string; iara?: IaraChatHooks }> = ({ chatId, chatName, iara }) => {
  const openId = useProjectSync((s) => s.openId)
  const projectId = chatId ?? openId
  // O canvas vai junto só na conversa do projeto aberto
  const canvas = !!projectId && projectId === openId
  const openName = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.name)
  const projectName = chatName ?? openName
  const { connected, agents, agent, setAgent, models } = useChat(
    useShallow((s) => ({ connected: s.connected, agents: s.agents, agent: s.agent, setAgent: s.setAgent, models: s.models }))
  )
  const model = models[agent] ?? ''
  const conversation = useChat((s) => (projectId ? s.conversations[projectId] : undefined))
  const context = useSelectionContext()
  const composer = useRef<ChatComposerHandle>(null)
  // Outra tela pode abrir a Iara com um pedido pronto (ex.: "Pedir à Iara" no estúdio de vídeo)
  const isIara = !!iara
  useEffect(() => {
    if (!isIara) return
    const on = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (typeof text !== 'string') return
      composer.current?.setDraft(text)
      composer.current?.focus()
    }
    window.addEventListener('iara:draft', on)
    return () => window.removeEventListener('iara:draft', on)
  }, [isIara])
  const [withSelection, setWithSelection] = useState(true)
  // A lista das conversas anteriores no lugar da conversa
  const [showHistory, setShowHistory] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const skillId = useChat((s) => s.skill)
  const setSkill = useChat((s) => s.setSkill)
  // As padrão, as globais da equipe e as suas (tela Skills)
  const skills = useSkillList()
  const skillsStatus = useSkills((s) => s.status)
  const skill = skills.find((s) => s.id === skillId)
  useEffect(() => watchSkills(), [])
  // A skill escolhida foi apagada (aqui ou em outra aba): sai da caixa
  useEffect(() => {
    if (skillId && !skill && (skillsStatus === 'ready' || skillsStatus === 'missing')) setSkill(null)
  }, [skillId, skill, skillsStatus, setSkill])

  // Arrastar imagens para o chat: a caixa recebe
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  // A conversa da conta (ou de outro projeto) não vem com o projeto aberto: pede ao servidor
  const connectedNow = useChat((s) => s.connected)
  useEffect(() => {
    if (connectedNow && projectId && projectId !== openId) useChat.getState().watch?.(projectId)
  }, [connectedNow, projectId, openId])
  const onReady = iara?.onReady
  useEffect(() => {
    if (!onReady) return
    onReady((text) => composer.current?.send(text))
    return () => onReady(undefined)
  }, [onReady])

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

  const shown: ChatContext = !canvas ? { sections: [] } : withSelection ? context : { pageId: context.pageId, pageName: context.pageName, sections: [] }
  const label = contextLabel(shown)
  const LabelIcon = label.icon
  const hasSelection = canvas && (context.sections.length > 0 || !!context.element)
  const names = available.map((id) => CHAT_AGENTS[id].name)

  const SkillIcon = skill ? skillIcon(skill) : null

  const send = (message: ComposerMessage) => {
    const { text: clean, images, skill: chosen, command } = message
    const { send } = useChat.getState()
    if (!send || status?.available === false) return false
    if (iara?.intercept?.(message)) return true
    const payload = { projectId, projectName, agent, ...(model ? { model } : {}), text: clean, context: shown, ...(images.length ? { images } : {}), ...(chosen && !command ? { skill: skillRef(chosen) } : {}) }
    pinned.current = true
    if (!iara || command) {
      send(payload)
      return true
    }
    // A Iara manda junto as regras, as ações e a tela aberta (lidas na hora)
    void iara.payload().then(
      (extra) => send({ ...payload, iara: extra }),
      () => send(payload)
    )
    return true
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
    <div
      data-space-chat
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        composer.current?.addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/95 text-center text-violet-900">
          <ImagePlus className="h-6 w-6" />
          <p className="text-[13px] font-medium">Solte para mandar ao agente</p>
          <p className="text-[11px] text-violet-700">PNG, JPG, WebP ou GIF · até {CHAT_IMAGE_LIMIT} por mensagem</p>
        </div>
      )}
      <ConnectorBar />
      <ConversationBar
        messages={messages}
        running={running}
        historyCount={conversation?.history?.length ?? 0}
        showHistory={showHistory}
        onHistory={() => setShowHistory((open) => !open)}
        onNew={startNew}
      />
      <PlanUsageBar agent={agent} onShow={() => composer.current?.send('/usage')} disabled={busy} />

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
            {iara?.intro ? iara.intro : <p className="text-[13px] leading-relaxed text-gray-600">
              Peça à Iara neste projeto: quem faz é o <strong className="font-semibold text-gray-900">{names[0]}</strong>
              {names.length > 1 && (
                <>
                  {' '}
                  ou o <strong className="font-semibold text-gray-900">{names[1]}</strong>
                </>
              )}
              . Selecione uma seção ou uma camada no canvas: o agente trabalha só ali, e você vê o cursor dele. Mande também uma imagem de
              referência: pelo botão, com Ctrl+V ou arrastando para cá.
            </p>}
            {skill && SkillIcon ? (
              <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-gray-900">
                  <SkillIcon className="h-3.5 w-3.5 text-gray-500" />
                  {skill.name}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                  {skill.hint && `${skill.hint.replace(/[.!…]+$/, '')}. `}
                  {skill.needsImage ? 'Anexe ou cole a imagem junto com o pedido.' : ''}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Skills
                  <ManageSkillsLink className="text-[11px] normal-case tracking-normal" />
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {skills.slice(0, GRID_SKILLS).map((s) => {
                    const Icon = skillIcon(s)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.hint}
                        className="flex min-w-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]"
                        onClick={() => {
                          setSkill(s.id)
                          composer.current?.focus()
                        }}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-gray-400">
              Digite <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">/</code> para escolher uma skill.{' '}
              <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">/usage</code> mostra quanto do plano já usou, e{' '}
              <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">/login</code> entra de novo na conta do agente.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(skill?.starters.length ? skill.starters : iara?.suggestions && !hasSelection ? iara.suggestions : suggestionsFor(shown)).map((text) => (
                <button
                  key={text}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-left text-[12px] text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  onClick={() => {
                    composer.current?.setDraft(text)
                    composer.current?.focus()
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
            {iara?.cards('')}
          </div>
        ) : (
          <>
            {iara?.cards('')}
            {messages.map((message) => (
              <React.Fragment key={message.id}>
                {message.role === 'user' ? <UserMessage message={message} /> : <AgentMessage message={message} />}
                {iara?.cards(message.id)}
              </React.Fragment>
            ))}
          </>
        )}
      </div>
      )}

      <ChatComposer
        ref={composer}
        skills={skills}
        skillId={skillId}
        onSkill={setSkill}
        commands
        chips={
          !canvas ? iara?.chips : <button
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
        }
        footer={
          // Agente e modelo num botão só: a barra da Iara tem 400 px (2026-11-10, "não está abrindo a seleção")
          <AgentModelButton busy={busy} working={running} />
        }
        busy={busy}
        onStop={stop}
        blocked={status?.available === false}
        sendColor={info.color}
        sendLabel={`Enviar para o ${info.name}`}
        stopLabel={`Parar o ${info.name}`}
        ariaLabel={`Mensagem para o ${info.name}`}
        placeholder={({ attachments, skill: chosen }) =>
          busy
            ? `${info.name} está trabalhando…`
            : attachments
              ? `O que fazer com ${attachments > 1 ? 'as imagens' : 'a imagem'}?`
              : chosen?.needsImage
                ? 'Anexe ou cole a imagem e diga o que levar dela…'
                : hasSelection
                  ? 'O que mudar aqui?'
                  : 'Peça à Iara neste projeto…'
        }
        onSend={send}
      />
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
  // /usage e /login são comandos, não pedidos: não viram título nem contam
  const asks = messages.filter((m) => m.role === 'user' && !/^\/(usage|login)\b/i.test(m.text ?? ''))
  const first = asks[0]?.text?.replace(/\s+/g, ' ').trim()
  return {
    title: first || (asks[0]?.images?.length ? 'Imagem anexada' : 'Conversa nova'),
    requests: asks.length,
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
                  confirm === item.epoch ? 'bg-red-50 text-red-600 opacity-100' : 'text-gray-400 hover:bg-gray-100 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <MessagesSquare className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-[13px] font-medium text-gray-800">Nenhuma conversa anterior</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Quando você começar uma conversa nova, a de agora fica guardada aqui para você voltar e continuar de onde parou.</p>
          <button type="button" onClick={onCurrent} className="mt-3 inline-flex h-8 items-center rounded-lg border border-gray-200 px-3 text-[12px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50">
            {current ? 'Voltar para a conversa' : 'Começar uma conversa'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Ponto na cor do agente, pulsando enquanto ele trabalha. Sem logo: o nome diz quem é. */
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
