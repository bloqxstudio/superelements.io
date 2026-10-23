import React, { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { AtSign, Check, ImageIcon, Loader2, Paperclip, Send, Sparkles, Square, Undo2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import { isChatImage, readChatImage } from '@/features/space/chat/attachments'
import type { ChatSkill } from '@/features/space/chat/skills'
import { skillIcon } from '@/features/skills/skillIcon'
import { useSkills, watchSkills } from '@/features/skills/skillsStore'
import { requestEdit, type EditScope } from './ai'
import { chooseImageProvider, saveImageKey, useCreativeLink, type CreativeImageProvider } from './link'
import { agentInfo, PHASE_LABEL, useAgent, type AgentPhase } from './agentStore'
import type { EditOp } from './edit'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import { useConnector } from '@/features/space/connector/connectorStore'
import { applyOps, type Applied } from './applyOps'
import { generateAll, markNotGenerated } from './generate'
import { AV_CASES } from '@/features/avence/cases'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { projectPages, resolveRefs, type ResolvedRef } from './references'
import { importPageAsPost, importPageSideways } from './pageImport'
import { useRefs, type Ref } from './refStore'
import { CREATIVE_SKILLS } from './skills'
import { uploadAsset } from './storage'
import { currentLayer, currentPost, currentSlide, useEditor } from './store'

/**
 * Conversa com a IA desta máquina (Claude Code) dentro do editor. O que está
 * escolhido no canvas (componente, slide, post ou tudo) vai junto com a
 * mensagem, mais os prints colados e a skill escolhida; a IA devolve operações
 * e o editor as aplica num passo só, que o desfazer do editor reverte. Os
 * prints também entram no conjunto como imagens, para poderem ir num slide.
 */

interface Msg {
  id: string
  role: 'user' | 'ai'
  text: string
  /** Escopo usado, para mostrar na mensagem. */
  scope?: string
  previews?: string[]
  skill?: string
  /** Anexos, referências e skill desta mensagem, em texto: a IA lembra deles nas próximas. */
  note?: string
  /** O que a resposta mudou, resumido: a IA lembra do que já fez. */
  ops?: string
  /** A resposta mexeu no conjunto. */
  changed?: number
  skipped?: string[]
  error?: boolean
}

const CHAT_KEY = (setId: string) => `criativos-conversa:${setId}`
const KEEP = 80

/** A conversa de um conjunto volta ao reabrir (sem as miniaturas, que pesam). */
const readChat = (setId: string): Msg[] => {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY(setId)) ?? '[]')
  } catch {
    return []
  }
}
const writeChat = (setId: string, list: Msg[]) => {
  try {
    localStorage.setItem(CHAT_KEY(setId), JSON.stringify(list.slice(-KEEP).map(({ previews: _p, ...m }) => m)))
  } catch {
    // sem armazenamento: a conversa vale até fechar a aba
  }
}

const useChat = create<{ bySet: Record<string, Msg[]>; ensure: (setId: string) => void; push: (setId: string, m: Msg) => void; clear: (setId: string) => void }>((set, get) => ({
  bySet: {},
  ensure: (setId) => {
    if (!get().bySet[setId]) set((s) => ({ bySet: { ...s.bySet, [setId]: readChat(setId) } }))
  },
  push: (setId, m) => {
    const list = [...(get().bySet[setId] ?? readChat(setId)), m]
    writeChat(setId, list)
    set((s) => ({ bySet: { ...s.bySet, [setId]: list } }))
  },
  clear: (setId) => {
    writeChat(setId, [])
    set((s) => ({ bySet: { ...s.bySet, [setId]: [] } }))
  },
}))

/** O que uma resposta mudou, em poucas palavras, para a IA lembrar do que já fez na conversa. */
function summarizeOps(ops: EditOp[]): string {
  return ops
    .slice(0, 12)
    .map((op) => {
      const target = op.layerId ?? op.slideId ?? op.postId ?? ''
      if (op.op === 'add_post') return `criou o post "${op.post?.name ?? ''}" (${op.post?.slides?.length ?? 0} slides)`
      if (op.op === 'update_post') return op.post?.slides?.length ? `refez o post ${op.postId} com ${op.post.slides.length} slides` : `ajustou o post ${op.postId}`
      if (op.op === 'add_slide') return `criou um slide${op.spec?.template ? ` (${op.spec.template})` : ''} em ${op.postId ?? op.slideId ?? ''}`
      if (op.op === 'update_layer') return `mudou ${target}: ${Object.keys(op.layer ?? {}).join(', ')}`
      return `${op.op} ${target}`.trim()
    })
    .join('; ')
}

const FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Serif', 'Playfair Display', 'DM Sans', 'Manrope', 'Poppins', 'Montserrat', 'Space Grotesk', 'Fraunces', 'Archivo', 'Bebas Neue']
const MAX_IMAGES = 4

const SUGGESTIONS: Record<EditScope, string[]> = {
  layer: ['Deixe esse texto mais curto e direto', 'Aumente e centralize', 'Troque a cor para a de destaque da marca'],
  slide: ['Escreva o título de outro jeito', 'Troque o fundo para o papel e ajuste as cores', 'Duplique este slide com o case ProcessBase'],
  post: ['Reescreva a legenda', 'Inclua um slide de chamada no fim', 'Deixe os títulos mais curtos'],
  set: ['Crie um story novo sobre um case', 'Crie um banner 1200x628 para anúncio de link', 'Revise os textos e corte o que for exagero'],
}

const SCOPE_LABEL: Record<EditScope, string> = { layer: 'Componente', slide: 'Slide', post: 'Post', set: 'Tudo' }

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const OP_TEXT: Record<EditOp['op'], string> = {
  update_layer: 'Editando',
  add_layer: 'Adicionando um componente',
  delete_layer: 'Removendo um componente',
  move_layer: 'Reordenando',
  update_slide: 'Ajustando o fundo',
  add_slide: 'Criando um slide',
  duplicate_slide: 'Duplicando o slide',
  delete_slide: 'Removendo o slide',
  update_post: 'Ajustando o post',
  add_post: 'Criando um post',
  delete_post: 'Removendo o post',
  spread_layer: 'Passando por todos os cards',
}

/** Onde o cursor do agente vai para esta operação (antes de ela acontecer). */
function opTarget(op: EditOp, defaults: { slideId?: string; layerId?: string }) {
  const set = useEditor.getState().set
  if (!set) return undefined
  const slides = set.posts.flatMap((p) => p.slides)
  const slide =
    slides.find((s) => s.id === op.slideId) ??
    slides.find((s) => s.layers.some((l) => l.id === op.layerId)) ??
    (op.postId ? set.posts.find((p) => p.id === op.postId)?.slides[0] : undefined) ??
    slides.find((s) => s.id === defaults.slideId)
  if (!slide) return undefined
  const layerId = op.layerId ?? (op.op === 'update_layer' ? defaults.layerId : undefined)
  return { slideId: slide.id, layerId: layerId && slide.layers.some((l) => l.id === layerId) ? layerId : undefined }
}

/**
 * Aplica as operações uma a uma, com o cursor do agente indo até cada
 * componente, como num editor com alguém trabalhando junto. Tudo vira um passo
 * só do desfazer.
 */
async function playOps(ops: EditOp[], defaults: { postId?: string; slideId?: string; layerId?: string }, agent: ChatAgentId, signal: AbortSignal): Promise<Applied> {
  const before = useEditor.getState().set!
  const agentState = useAgent.getState()
  let applied = 0
  const skipped: string[] = []
  const touched = new Set<string>()
  const toGenerate: Applied['toGenerate'] = []
  const aliases = new Map<string, string>()
  let focus: Applied['focus']
  for (const [i, op] of ops.entries()) {
    if (signal.aborted) break
    const target = opTarget(op, defaults)
    if (target) agentState.point({ ...target, agent, text: OP_TEXT[op.op] })
    await sleep(i === 0 ? 700 : 450)
    const result = applyOps(useEditor.getState().set!, [op], defaults, aliases)
    skipped.push(...result.skipped)
    if (!result.applied) continue
    applied++
    useEditor.getState().draft(() => ({ ...result.set, updatedAt: Date.now() }))
    for (const id of result.touched) touched.add(id)
    toGenerate.push(...result.toGenerate)
    if (result.focus) {
      focus = result.focus
      // Slide ou post que acabou de nascer: o cursor vai até ele
      agentState.point({ slideId: result.focus.slideId, layerId: result.focus.layerId, agent, text: OP_TEXT[op.op] })
    }
    void useEditor.getState().ensureAssets()
  }
  if (applied) useEditor.getState().checkpoint(before)
  await sleep(500)
  return { set: useEditor.getState().set!, applied, skipped, focus, touched: [...touched], toGenerate }
}

const AGENT_KEY = 'criativos-agente'
const savedAgent = (): ChatAgentId | undefined => {
  try {
    const v = localStorage.getItem(AGENT_KEY)
    return v === 'codex' || v === 'claude' ? v : undefined
  } catch {
    return undefined
  }
}

/** Projetos e cases já lidos nesta conversa: nas próximas mensagens não são lidos (nem baixados) de novo. */
const resolvedCache = new Map<string, { ref: ResolvedRef; extra: { src: string; label: string }[] }>()

/** Sem acento e em minúsculas, para filtrar o que a pessoa digita depois do @. */
const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

interface MentionItem {
  ref: Ref
  group: string
  hint?: string
}

interface Attached {
  id: string
  name: string
  data: string
  preview: string
  /** Onde ficou no conjunto depois do primeiro envio: nas próximas mensagens não sobe de novo. */
  src?: string
}

const dataToBlob = async (data: string) => (await fetch(data)).blob()

const PROVIDER_NAME: Record<CreativeImageProvider, string> = { codex: 'Codex', openai: 'OpenAI', gemini: 'Google' }

/** Serviço de imagens: o Codex gera sem chave (login do ChatGPT); OpenAI e Google pedem uma chave, que fica só neste computador. */
const ImageKeys: React.FC = () => {
  const images = useCreativeLink((l) => l.images)
  const providers = useCreativeLink((l) => l.providers)
  const keys = useCreativeLink((l) => l.keys)
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai')
  const [key, setKey] = useState('')
  const label = images ? `Imagens · ${PROVIDER_NAME[images]}` : 'Imagens'
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn('inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium', images ? 'text-emerald-700 hover:bg-emerald-50' : 'text-amber-700 hover:bg-amber-50')} title={images ? 'Geração de imagens ligada' : 'Conecte o Codex ou uma chave para a IA gerar imagens'}>
        <ImageIcon className="h-3.5 w-3.5" /> {label}
        {images ? <Check className="h-3 w-3" /> : null}
      </button>
      {open && (
        <div className="absolute bottom-9 left-0 z-40 w-72 space-y-2 rounded-xl border bg-white p-3 text-xs text-gray-600 shadow-xl">
          <p className="font-semibold text-gray-900">Geração de imagens</p>
          {providers.length > 0 && (
            <div className="space-y-1" role="radiogroup" aria-label="Quem gera as imagens">
              {providers.map((p) => (
                <label key={p} className={cn('flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5', images === p ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}>
                  <input type="radio" name="img-provider" className="mt-0.5" checked={images === p} onChange={() => chooseImageProvider(p)} />
                  <span>
                    <span className="block font-medium text-gray-900">{PROVIDER_NAME[p]}</span>
                    <span className="block text-[11px] text-gray-500">{p === 'codex' ? 'Sem chave: usa o login do ChatGPT no Codex deste computador (rode `codex login` se pedir).' : 'Com a sua chave, guardada neste computador.'}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {!providers.includes('codex') && <p className="text-[11px] text-gray-500">O Codex não foi encontrado neste computador. Com ele instalado e logado, as imagens saem sem chave.</p>}
          <p className="pt-1 font-medium text-gray-800">Ou use uma chave</p>
          <select value={provider} onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini')} className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
            <option value="openai">OpenAI (platform.openai.com/api-keys){keys.openai ? ' · tem chave' : ''}</option>
            <option value="gemini">Google (aistudio.google.com/apikey){keys.gemini ? ' · tem chave' : ''}</option>
          </select>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={keys[provider] ? '•••••••• (guardada)' : 'Cole a chave'} autoComplete="off" spellCheck={false} className="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900" />
          <div className="flex justify-between gap-1.5">
            <Button type="button" variant="outline" size="sm" className="bg-white text-red-600" disabled={!keys[provider]} onClick={() => { saveImageKey(provider, ''); setKey('') }}>Apagar</Button>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => setOpen(false)}>Fechar</Button>
              <Button type="button" size="sm" disabled={key.trim().length < 20} onClick={() => { saveImageKey(provider, key); setKey(''); toast.success('Chave guardada neste computador.') }}>Guardar</Button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">A chave vai só até o conector deste computador, não para a nuvem. Imagens por chave têm custo no serviço; pelo Codex, entram no seu plano do ChatGPT.</p>
        </div>
      )}
    </div>
  )
}

/** O passo em que o agente está, com o tempo que já levou. */
const Working: React.FC = () => {
  const working = useAgent((s) => s.working)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!working) return null
  const order = ['sending', 'start', 'thinking', ...(working.phase === 'reading' ? ['reading'] : []), 'writing', 'applying', ...(working.phase === 'generating' ? ['generating'] : [])] as AgentPhase[]
  const at = order.indexOf(working.phase)
  const AGENT = agentInfo(working.agent)
  return (
    <div className="space-y-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-gray-700">
      <p className="flex items-center gap-1.5 font-semibold text-gray-900">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: AGENT.color }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: AGENT.color }} /></span>
        {AGENT.name} trabalhando · {Math.max(0, Math.round((now - working.since) / 1000))} s
      </p>
      <ul className="space-y-0.5">
        {order.map((p, i) => (
          <li key={p} className={cn('flex items-center gap-1.5', i > at && 'text-gray-400')}>
            {i < at ? <Check className="h-3 w-3 text-emerald-600" /> : i === at ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: AGENT.color }} /> : <span className="h-3 w-3" />}
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ul>
      <p className="truncate text-[11px] text-gray-500">Em: {working.label}</p>
    </div>
  )
}

/** Sem ponte: o que está acontecendo e o que fazer, com a procura do conector rodando sozinha. */
const Offline: React.FC<{ stale: boolean }> = ({ stale }) => {
  const status = useConnector((c) => c.status)
  const pairing = useConnector((c) => c.pairing)
  const error = useConnector((c) => c.error)
  const connected = useCreativeLink((l) => l.connected)
  const searching = !stale && !!pairing && status !== 'connected' && !error
  const line = stale
    ? 'O conector aberto é uma versão antiga e não conhece a IA dos criativos.'
    : connected
      ? 'Conectado, mas nenhuma IA foi encontrada neste computador. Instale o Claude Code ou o Codex e abra o conector de novo.'
      : searching
        ? 'Procurando o conector neste computador…'
        : error ?? 'A IA roda no seu computador (Claude Code ou Codex), por um conector.'
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-scroll>
      <div className="m-3 flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700">
        {searching ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-violet-600" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
        <div className="space-y-1">
          <p className="font-medium text-gray-900">{line}</p>
          {searching && <p className="text-gray-500">Abra o conector.mjs no terminal: a aba liga sozinha em alguns segundos, sem colar nada.</p>}
          {stale && <p className="text-gray-500">Baixe o conector.mjs de novo (passo 1), feche o que está aberto e rode o novo. O código é o mesmo.</p>}
        </div>
      </div>
      <ConnectorPrompt />
    </div>
  )
}

export const AiChat: React.FC<{ available: boolean | null }> = ({ available }) => {
  const set = useEditor((s) => s.set)!
  const post = useEditor(currentPost)
  const slide = useEditor(currentSlide)
  const layer = useEditor(currentLayer)
  const row = useEditor((s) => s.row)
  const layerIds = useEditor((s) => s.layerIds)
  const stale = useCreativeLink((s) => s.stale)
  const agents = useCreativeLink((s) => s.agents)
  const legacy = useCreativeLink((s) => s.legacy)
  const [chosen, setChosen] = useState<ChatAgentId | undefined>(savedAgent)
  const agent: ChatAgentId = (chosen && agents.find((a) => a.id === chosen)?.available ? chosen : agents.find((a) => a.available)?.id) ?? 'claude'
  const pickAgent = (id: ChatAgentId) => {
    setChosen(id)
    try {
      localStorage.setItem(AGENT_KEY, id)
    } catch {
      // sem armazenamento: vale até recarregar
    }
  }
  const msgs = useChat((s) => s.bySet[set.id]) ?? []
  useEffect(() => useChat.getState().ensure(set.id), [set.id])
  const lastChanged = [...msgs].reverse().find((x) => x.changed)?.id
  const custom = useSkills((s) => s.custom)
  const skills = useMemo<ChatSkill[]>(() => [...custom.filter((k) => k.source === 'personal'), ...custom.filter((k) => k.source === 'global'), ...CREATIVE_SKILLS], [custom])
  const [skillId, setSkillId] = useState<string | null>(null)
  const skill = skills.find((k) => k.id === skillId)
  const [menu, setMenu] = useState(false)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<Attached[]>([])
  const [busy, setBusy] = useState(false)
  const [drop, setDrop] = useState(false)
  const [forced, setForced] = useState<EditScope | null>(null)
  const control = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const refs = useRefs((r) => r.refs)
  // Ids das marcas que já foram para a IA: elas ficam na conversa (e na lista) até você tirar
  const usedRefs = useRef(new Set<string>())
  const [, bump] = useState(0)
  const focusTick = useRefs((r) => r.focus)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [mentionAt, setMentionAt] = useState(0)
  useProjectList()
  const projects = useProjectStore((p) => p.projects)

  // O canvas pediu para referenciar algo: a caixa do chat ganha o foco
  useEffect(() => {
    if (focusTick) input.current?.focus()
  }, [focusTick])

  // Marcas de outro conjunto não valem neste
  useEffect(() => {
    useRefs.getState().clear()
  }, [set.id])

  // O que o @ oferece, na ordem: projetos da conta, cases, posts e slides. Sem filtro, os slides mostram só alguns (a lista não esconde o resto)
  const [stage, setStage] = useState<{ projectId: string; name: string; pages: { id: string; name: string }[] | 'loading' | 'error' } | null>(null)
  const mentionItems = useMemo<MentionItem[]>(() => {
    const q = plain(mention?.query ?? '')
    if (stage) {
      const pages = Array.isArray(stage.pages) ? stage.pages : []
      const all: MentionItem[] = [
        { group: stage.name, hint: 'marca, briefing e textos (sem a imagem das páginas)', ref: { id: `project:${stage.projectId}`, kind: 'project', label: stage.name, projectId: stage.projectId } },
        ...pages.map((pg): MentionItem => ({ group: 'Páginas: clique para a IA ver a página; "De lado" ou "Janela" cria um post com ela', ref: { id: `project:${stage.projectId}:${pg.id}`, kind: 'project', label: `${stage.name} › ${pg.name}`, projectId: stage.projectId, pageId: pg.id } })),
      ]
      return q ? all.filter((i) => plain(i.ref.label).includes(q)) : all
    }
    const projectItems = projects.map((p): MentionItem => ({ group: 'Projetos da conta', hint: 'escolha o projeto e depois a página', ref: { id: `project:${p.id}`, kind: 'project', label: p.name, projectId: p.id } }))
    const caseItems: MentionItem[] = [{ group: 'Cases da Avence', hint: `${AV_CASES.length} sites no ar`, ref: { id: 'case:*', kind: 'case', label: 'Todos os cases', slug: '*' } }, ...AV_CASES.map((c): MentionItem => ({ group: 'Cases da Avence', hint: c.segment, ref: { id: `case:${c.slug}`, kind: 'case', label: c.name, slug: c.slug } }))]
    const postItems = set.posts.map((p): MentionItem => ({ group: 'Posts deste conjunto', hint: `${p.slides.length} slides`, ref: { id: `post:${p.id}`, kind: 'post', label: p.name, postId: p.id } }))
    const slideItems = set.posts.flatMap((p) => p.slides.map((sl, i): MentionItem => ({ group: 'Slides', hint: p.name, ref: { id: `slide:${sl.id}`, kind: 'slide', label: `${p.name} · slide ${i + 1}`, postId: p.id, slideId: sl.id } })))
    const match = (list: MentionItem[]) => (q ? list.filter((i) => plain(`${i.ref.label} ${i.hint ?? ''}`).includes(q)) : list)
    return [...match(projectItems), ...match(caseItems), ...match(postItems), ...(q ? match(slideItems) : slideItems.slice(0, 8))]
  }, [mention?.query, set.posts, projects, stage])

  /** Importa a página escolhida como um post novo: o conector fotografa a página e os cards rolam do topo ao fim. */
  const importPage = async (ref: Ref, mode: 'sideways' | 'window' = 'sideways') => {
    if (!ref.projectId || !ref.pageId) return
    closeMention()
    setText((t) => t.replace(/(^|\s)@\S*$/, '$1'))
    const projectName = projects.find((p) => p.id === ref.projectId)?.name ?? ref.label.split(' › ')[0]
    const toastId = toast.loading(`Fotografando a página de ${projectName} e montando o carrossel… leva de 10 a 40 s`)
    try {
      const post = await (mode === 'sideways' ? importPageSideways : importPageAsPost)(ref.projectId, ref.pageId, projectName)
      toast.success(`Página importada: ${post.slides.length} ${post.slides.length === 1 ? 'card' : 'cards'} em "${post.name}".`, { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui importar a página.', { id: toastId })
    }
  }

  const closeMention = () => {
    setMention(null)
    setStage(null)
  }

  const pickMention = (item: MentionItem) => {
    // Projeto: antes de marcar, a pessoa escolhe o projeto inteiro ou uma página dele
    if (item.ref.kind === 'project' && !stage && item.ref.projectId) {
      const { projectId, label } = item.ref
      setStage({ projectId, name: label, pages: 'loading' })
      setMentionAt(0)
      setText((t) => (mention ? `${t.slice(0, mention.start + 1)}${t.slice(input.current?.selectionStart ?? t.length)}` : t))
      setMention((m) => (m ? { ...m, query: '' } : m))
      projectPages(projectId)
        .then((pages) => setStage((st) => (st?.projectId === projectId ? { ...st, pages } : st)))
        .catch(() => setStage((st) => (st?.projectId === projectId ? { ...st, pages: 'error' } : st)))
      requestAnimationFrame(() => input.current?.focus())
      return
    }
    if (mention) {
      const el = input.current
      const end = el?.selectionStart ?? mention.start + mention.query.length + 1
      setText((t) => `${t.slice(0, mention.start)}${t.slice(end)}`.replace(/\s{2,}/g, ' '))
    }
    useRefs.getState().add(item.ref)
    closeMention()
    requestAnimationFrame(() => input.current?.focus())
  }

  const onType = (value: string, caret: number) => {
    setText(value)
    // Um @ no começo de uma palavra abre a lista; espaço ou apagar o @ fecha
    const before = value.slice(0, caret)
    const m = /(^|\s)@([^\s@]*)$/.exec(before)
    if (m) {
      setMention({ start: before.length - m[2].length - 1, query: m[2] })
      setMentionAt(0)
    } else closeMention()
  }

  useEffect(() => watchSkills(), [])

  // Escopo: o que está escolhido, ou o que a pessoa trocou (sempre dentro do que existe)
  const natural: EditScope = row ? 'post' : layer ? 'layer' : slide ? 'slide' : 'post'
  const options: EditScope[] = [...(layer && !row ? (['layer'] as const) : []), ...(slide && !row ? (['slide'] as const) : []), 'post', 'set']
  const scope: EditScope = forced && options.includes(forced) ? forced : natural
  useEffect(() => setForced(null), [layer?.id, slide?.id, row])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, busy])

  const attach = async (list: File[]) => {
    const images = list.filter(isChatImage)
    if (!images.length) return
    const room = MAX_IMAGES - files.length
    if (room <= 0) return toast.error(`No máximo ${MAX_IMAGES} imagens por pedido.`)
    for (const file of images.slice(0, room)) {
      try {
        const read = await readChatImage(file)
        setFiles((f) => (f.length >= MAX_IMAGES ? f : [...f, { id: crypto.randomUUID(), name: read.name, data: read.data, preview: read.preview }]))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não consegui ler a imagem.')
      }
    }
  }

  const stop = () => control.current?.abort()

  function scopeName() {
    if (scope === 'layer' && layerIds.length > 1) return `${layerIds.length} componentes · slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'layer') return `${layer?.name ?? 'Componente'} · slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'slide') return `Slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'post') return `${post?.name ?? 'Post'} · ${post?.slides.length ?? 0} cards`
    return 'Todos os posts'
  }

  const send = async (override?: string) => {
    const refsNow = useRefs.getState().refs
    const message = (override ?? text).trim() || (files.length ? 'Faça posts com base nesta referência.' : refsNow.length ? 'Use o que marquei como referência.' : '')
    if (!message || busy || !post || available !== true) return
    const push = useChat.getState().push
    const sent = files
    // O que é novo nesta mensagem; o que já foi antes continua valendo, sem enviar de novo
    const freshRefs = refsNow.filter((r) => !usedRefs.current.has(r.id))
    const freshFiles = sent.filter((f) => !f.src)
    const labels = freshRefs.map((r) => `@${r.label}`)
    const note = [freshFiles.length ? `anexou: ${freshFiles.map((f) => f.name).join(', ')}` : '', freshRefs.length ? `marcou: ${freshRefs.map((r) => r.label).join(', ')}` : '', skill ? `skill: ${skill.name}` : '', `editando: ${scopeName()}`].filter(Boolean).join(' · ')
    push(set.id, { id: crypto.randomUUID(), role: 'user', text: labels.length ? `${labels.join(' ')} ${message}` : message, note, scope: scopeName(), previews: freshFiles.map((f) => f.preview), skill: skill?.name })
    setText('')
    setBusy(true)
    control.current = new AbortController()
    useAgent.getState().begin({ scope, postId: post.id, slideId: slide?.id, layerId: scope === 'layer' ? layer?.id : undefined }, scopeName(), agent)
    try {
      // Os prints entram no conjunto: assim a IA (e você) podem pôr um deles num slide. Só sobem na primeira vez
      const attachments: { name: string; src: string; data: string }[] = []
      const uploaded = new Map<string, string>()
      for (const f of sent) {
        if (f.src) {
          attachments.push({ name: f.name, src: f.src, data: f.data })
          continue
        }
        const blob = await dataToBlob(f.data)
        const asset = await uploadAsset(set, blob, f.name.includes('.') ? f.name : `${f.name}.${blob.type.includes('png') ? 'png' : 'jpg'}`)
        useEditor.getState().draft((s) => ({ ...s, assets: [...s.assets, asset] }))
        uploaded.set(f.id, `asset:${asset.id}`)
        attachments.push({ name: f.name, src: `asset:${asset.id}`, data: f.data })
      }
      if (uploaded.size) {
        useEditor.getState().persist()
        setFiles((list) => list.map((f) => (uploaded.has(f.id) ? { ...f, src: uploaded.get(f.id) } : f)))
      }
      await useEditor.getState().ensureAssets()
      const state = useEditor.getState()
      const current = state.set!
      // A conversa toda (até 30 mensagens), com o que a IA já mudou: "isso", "o anterior" e o que você já disse continuam valendo
      const history = (useChat.getState().bySet[set.id] ?? [])
        .filter((m) => !m.error)
        .slice(-31, -1)
        .map((m) => ({ role: m.role, text: m.role === 'user' ? (m.note ? `${m.text}\n[${m.note}]` : m.text) : m.ops ? `${m.text}\n[Mudanças feitas: ${m.ops}]` : m.text }))
      const fonts = [...new Set([current.brand.headingFont, current.brand.bodyFont, ...FONTS])]
      // Projeto e case lidos uma vez ficam em memória; post e slide são lidos de novo (mudam a cada edição)
      const nameOf = (id: string) => projects.find((p) => p.id === id)?.name
      const resolved = { refs: [] as ResolvedRef[], extra: [] as { src: string; label: string }[] }
      for (const r of refsNow) {
        const key = `${set.id}|${r.id}`
        const cached = r.kind === 'project' || r.kind === 'case' ? resolvedCache.get(key) : undefined
        const got = cached ?? (await resolveRefs([r], current, state.images, nameOf).then((x) => ({ ref: x.refs[0], extra: x.extra })))
        if (!got.ref) continue
        if (!cached && (r.kind === 'project' || r.kind === 'case')) resolvedCache.set(key, got)
        resolved.refs.push(got.ref)
        resolved.extra.push(...got.extra)
      }
      refsNow.forEach((r) => usedRefs.current.add(r.id))
      bump((n) => n + 1)
      const answer = await requestEdit(
        {
          message,
          scope,
          set: current,
          postId: state.postId,
          slideId: state.slideId,
          layerId: scope === 'layer' ? state.layerId : undefined,
          layerIds: scope === 'layer' && state.layerIds.length > 1 ? state.layerIds : undefined,
          images: state.images,
          history: history.slice(0, -1),
          attachments,
          skill: skill ? { name: skill.name, instructions: skill.instructions } : undefined,
          agent,
          canGenerateImages: !!useCreativeLink.getState().images,
          references: resolved.refs,
          projects: projects.map((p) => p.name),
        },
        fonts,
        control.current.signal,
        (step) => useAgent.getState().phase(step)
      )
      useAgent.getState().phase('applying')
      const defaults = { postId: state.postId, slideId: state.slideId, layerId: scope === 'layer' ? state.layerId : undefined }
      const result = await playOps(answer.ops, defaults, agent, control.current.signal)
      let made = 0
      if (result.toGenerate.length && useCreativeLink.getState().images) {
        useAgent.getState().phase('generating')
        made = await generateAll(result.toGenerate, agent, control.current.signal)
      }
      if (result.applied) {
        if (result.focus) {
          if (result.focus.postId !== useEditor.getState().postId) useEditor.getState().selectPost(result.focus.postId)
          useEditor.getState().selectSlide(result.focus.slideId)
          useEditor.getState().selectLayer(result.focus.layerId)
        }
        void useEditor.getState().ensureAssets()
        useAgent.getState().highlight(result.touched)
      }
      const noKey = result.toGenerate.length > 0 && !useCreativeLink.getState().images
      if (noKey) markNotGenerated(result.toGenerate)
      const note = noKey ? '\n\nAs imagens ainda não foram geradas: falta um serviço de imagens (botão "Imagens" aqui embaixo: o Codex gera sem chave, ou use uma chave do OpenAI ou do Google).' : made < result.toGenerate.length && result.toGenerate.length ? `\n\n${made} de ${result.toGenerate.length} imagens geradas.` : ''
      push(set.id, { id: crypto.randomUUID(), role: 'ai', text: (answer.reply || (result.applied ? 'Pronto.' : 'Não precisei mudar nada.')) + note, changed: result.applied, skipped: result.skipped, ops: result.applied ? summarizeOps(answer.ops) : undefined })
    } catch (err) {
      if ((err as Error).name === 'AbortError') push(set.id, { id: crypto.randomUUID(), role: 'ai', text: 'Parei.', error: true })
      else push(set.id, { id: crypto.randomUUID(), role: 'ai', text: err instanceof Error ? err.message : 'A IA não respondeu.', error: true })
    } finally {
      setBusy(false)
      useAgent.getState().end()
    }
  }

  if (available === false)
    return import.meta.env.DEV ? (
      <div className="space-y-2 p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">IA indisponível</p>
        <p>O servidor de desenvolvimento não achou o Claude Code nem o Codex nesta máquina. Instale um deles e recarregue.</p>
      </div>
    ) : (
      <Offline stale={stale} />
    )

  const SkillIcon = skill ? skillIcon(skill) : Wand2

  return (
    <div
      className={cn('relative flex h-full min-h-0 flex-col', drop && 'bg-violet-50')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDrop(true)
        }
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrop(false)
        void attach([...e.dataTransfer.files])
      }}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-scroll>
        {msgs.length === 0 && (
          <div className="space-y-3 text-sm text-gray-600">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Sparkles className="h-4 w-4 text-violet-600" /> Fale com os criativos</p>
            <p>Escolha um componente, um slide ou um post no canvas e diga o que mudar. <b>Cole um print</b> (Ctrl/⌘+V) para a IA fazer posts com base nele, em qualquer formato.</p>
            <div className="space-y-1.5">
              {(skill?.starters.length ? skill.starters : SUGGESTIONS[scope]).map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} disabled={busy} className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={cn('text-sm', m.role === 'user' && 'ml-6')}>
            {m.role === 'user' ? (
              <div className="rounded-xl rounded-br-sm bg-violet-600 px-3 py-2 text-white">
                {!!m.previews?.length && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {m.previews.map((p, i) => (
                      <img key={i} src={p} alt="" className="h-14 w-14 rounded-md object-cover ring-1 ring-white/30" />
                    ))}
                  </div>
                )}
                {m.text}
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-violet-200">{[m.scope, m.skill].filter(Boolean).join(' · ')}</span>
              </div>
            ) : (
              <div className={cn('rounded-xl rounded-bl-sm border px-3 py-2', m.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-800')}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {!!m.changed && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{m.changed} {m.changed === 1 ? 'mudança aplicada' : 'mudanças aplicadas'}</span>
                    {m.id === lastChanged && (
                      <button type="button" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline" onClick={() => useEditor.getState().undo()}>
                        <Undo2 className="h-3 w-3" /> Desfazer
                      </button>
                    )}
                  </div>
                )}
                {!!m.skipped?.length && <p className="mt-1 text-[11px] text-amber-700">{m.skipped.length} {m.skipped.length === 1 ? 'mudança foi ignorada' : 'mudanças foram ignoradas'}: {m.skipped.slice(0, 2).join('; ')}</p>}
              </div>
            )}
          </div>
        ))}
        {busy && <Working />}
        <div ref={end} />
      </div>

      <div className="space-y-2 border-t p-2.5">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-500">Editar:</span>
          {options.map((o) => (
            <button key={o} type="button" onClick={() => setForced(o)} className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', o === scope ? 'bg-violet-100 text-violet-800' : 'text-gray-500 hover:bg-gray-100')}>
              {SCOPE_LABEL[o]}
            </button>
          ))}
          {msgs.length > 0 && (
            <button type="button" className="ml-auto text-[11px] text-gray-400 hover:text-gray-700" onClick={() => { useChat.getState().clear(set.id); setFiles([]); useRefs.getState().clear(); usedRefs.current.clear(); for (const k of [...resolvedCache.keys()]) if (k.startsWith(`${set.id}|`)) resolvedCache.delete(k) }} title="Começa uma conversa nova: esquece o que foi dito, os anexos e as marcas">Nova conversa</button>
          )}
        </div>
        <p className="truncate text-[11px] text-gray-500" title={scopeName()}>{scopeName()}</p>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f.id} className="group relative">
                <img src={f.preview} alt={f.name} title={f.src ? `${f.name}: já está na conversa; a IA continua com ela até você tirar` : f.name} className={cn('h-14 w-14 rounded-md object-cover ring-1', f.src ? 'ring-violet-300' : 'ring-black/10')} />
                <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/https?:\/\/\S+/i.test(text) && (
          <p className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] leading-snug text-sky-900">A IA vai abrir o link. Instagram, TikTok e LinkedIn pedem login e quase nunca abrem: se não abrir, cole os prints de cada slide aqui. Ela recria o layout com fidelidade, mas não copia o texto, as fotos nem a marca de outra pessoa.</p>
        )}
        {(refs.length > 0 || files.some((f) => f.src)) && <p className="text-[10px] leading-tight text-gray-400">Anexos e marcas ficam na conversa: não precisa enviar de novo.</p>}
        {refs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {refs.map((r) => (
              <span key={r.id} className={cn('inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[11px] font-medium', usedRefs.current.has(r.id) ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' : 'bg-violet-100 text-violet-800')} title={usedRefs.current.has(r.id) ? 'Já está na conversa: a IA continua com isso. Tire no X quando não precisar mais.' : `${r.kind === 'post' ? 'Post' : r.kind === 'slide' ? 'Slide' : r.kind === 'project' ? 'Projeto' : 'Case'} marcado`}>
                <AtSign className="h-3 w-3" />
                {r.label}
                <button type="button" aria-label={`Tirar ${r.label}`} onClick={() => { usedRefs.current.delete(r.id); resolvedCache.delete(`${set.id}|${r.id}`); useRefs.getState().remove(r.id) }} className="rounded-full p-0.5 hover:bg-violet-200"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          {mention && (
            <div className="absolute bottom-full left-0 z-40 mb-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-xl" data-scroll role="listbox" aria-label="Marcar com @">
              {stage && (
                <div className="flex items-center gap-1 border-b border-gray-100 px-1 pb-1">
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); setStage(null); setMentionAt(0) }} className="rounded-md px-1.5 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-50">‹ Projetos</button>
                  <span className="truncate text-xs font-semibold text-gray-800">{stage.name}</span>
                  {stage.pages === 'loading' && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-gray-400" />}
                </div>
              )}
              {stage?.pages === 'error' && <p className="px-2 py-1.5 text-xs text-amber-700">Não consegui ler as páginas deste projeto. Dá para marcar o projeto inteiro.</p>}
              {mentionItems.length === 0 && !stage && <p className="px-2 py-2 text-xs text-gray-500">Nada encontrado para "{mention.query}".</p>}
              {mentionItems.map((item, i) => (
                <React.Fragment key={item.ref.id}>
                  {(i === 0 || mentionItems[i - 1].group !== item.group) && <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{item.group}</p>}
                  <div className={cn('flex items-center rounded-lg', i === mentionAt ? 'bg-violet-50' : 'hover:bg-gray-50')} onMouseEnter={() => setMentionAt(i)}>
                    <button type="button" role="option" aria-selected={i === mentionAt} onMouseDown={(e) => { e.preventDefault(); pickMention(item) }} className="flex min-w-0 flex-1 items-baseline gap-2 px-2 py-1.5 text-left">
                      <span className="min-w-0 truncate text-xs font-medium text-gray-900">{item.ref.pageId ? item.ref.label.split(' › ')[1] : item.ref.label}</span>
                      {item.hint && <span className="min-w-0 truncate text-[11px] text-gray-500">{item.hint}</span>}
                    </button>
                    {item.ref.pageId && (
                      <>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); void importPage(item.ref, 'sideways') }} title="Carrossel pronto: capa só com o case e o site deitado passando de card em card" className="mr-1 shrink-0 rounded-md bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-700">De lado</button>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); void importPage(item.ref, 'window') }} title="Cards com a página numa janela de navegador, rolando do topo ao fim" className="mr-1 shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-300 hover:bg-violet-50">Janela</button>
                      </>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          {menu && (
            <div className="absolute bottom-full left-0 z-30 mb-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-xl" data-scroll>
              {skills.map((k) => {
                const Icon = skillIcon(k)
                return (
                  <button key={k.id} type="button" onClick={() => { setSkillId(k.id === skillId ? null : k.id); setMenu(false) }} className={cn('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50', k.id === skillId && 'bg-violet-50')}>
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-gray-900">{k.name}{k.source !== 'builtin' && <span className="ml-1 font-normal text-gray-400">{k.source === 'personal' ? 'sua' : 'da equipe'}</span>}</span>
                      {k.hint && <span className="block truncate text-[11px] text-gray-500">{k.hint}</span>}
                    </span>
                  </button>
                )
              })}
              <a href="/skills" target="_blank" rel="noreferrer" className="block px-2 py-1.5 text-[11px] text-gray-500 hover:text-gray-800">Gerenciar skills</a>
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              ref={input}
              value={text}
              onChange={(e) => onType(e.target.value, e.target.selectionStart)}
              onKeyDown={(e) => {
                if (mention && mentionItems.length) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMentionAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + mentionItems.length) % mentionItems.length)
                    e.stopPropagation()
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    pickMention(mentionItems[mentionAt] ?? mentionItems[0])
                    e.stopPropagation()
                    return
                  }
                }
                if (mention && e.key === 'Escape') {
                  if (stage) setStage(null)
                  else closeMention()
                  e.stopPropagation()
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
                e.stopPropagation()
              }}
              onPaste={(e) => {
                const pasted = [...e.clipboardData.files].filter(isChatImage)
                if (pasted.length) {
                  e.preventDefault()
                  void attach(pasted)
                }
              }}
              rows={2}
              placeholder={files.length || refs.length ? 'O que fazer com a referência?' : 'O que você quer mudar? @ marca um post, projeto ou case. Cole um print aqui.'}
              className="min-h-[56px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {busy ? (
              <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 bg-white" title="Parar" onClick={stop}><Square className="h-4 w-4" /></Button>
            ) : (
              <Button type="button" size="icon" className="h-9 w-9 shrink-0" title="Enviar (Enter)" disabled={(!text.trim() && !files.length && !refs.length) || available === null} onClick={() => void send()}><Send className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Qual IA usar">
          {(['claude', 'codex'] as const).map((id) => {
            const info = agentInfo(id)
            const found = agents.find((a) => a.id === id)
            const ok = !!found?.available
            return (
              <button
                key={id}
                type="button"
                disabled={!ok || busy}
                onClick={() => pickAgent(id)}
                title={ok ? `${info.name}${found?.version ? ` ${found.version}` : ''}` : legacy ? 'Seu conector é antigo e não sabe do Codex: baixe o conector.mjs de novo' : `${info.name} não foi encontrado neste computador`}
                className={cn('flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11px] font-semibold disabled:opacity-40', agent === id && ok ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: info.color }} />
                {info.name}
              </button>
            )
          })}
        </div>

        {legacy && <p className="text-[11px] leading-snug text-amber-700">Conector antigo: só o Claude Code aparece. Baixe o conector.mjs de novo para escolher o Codex.</p>}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => picker.current?.click()} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100" title="Anexar print ou imagem (Ctrl/⌘+V cola)">
            <Paperclip className="h-3.5 w-3.5" /> Anexar
          </button>
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => { void attach([...(e.target.files ?? [])]); e.target.value = '' }} />
          <button type="button" onClick={() => setMenu((m) => !m)} className={cn('inline-flex h-7 max-w-[60%] items-center gap-1 rounded-md px-1.5 text-[11px] font-medium', skill ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')} title="Escolher uma skill para este pedido">
            <SkillIcon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{skill ? skill.name : 'Skills'}</span>
          </button>
          {skill && (
            <button type="button" aria-label={`Tirar a skill ${skill.name}`} onClick={() => setSkillId(null)} className="text-gray-400 hover:text-gray-700"><X className="h-3.5 w-3.5" /></button>
          )}
          <ImageKeys />
        </div>
      </div>
    </div>
  )
}
