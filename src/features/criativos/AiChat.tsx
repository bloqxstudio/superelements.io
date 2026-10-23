import React, { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { Check, Loader2, Paperclip, Send, Sparkles, Square, Undo2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import { isChatImage, readChatImage } from '@/features/space/chat/attachments'
import type { ChatSkill } from '@/features/space/chat/skills'
import { skillIcon } from '@/features/skills/skillIcon'
import { useSkills, watchSkills } from '@/features/skills/skillsStore'
import { requestEdit, type EditScope } from './ai'
import { AGENT, PHASE_LABEL, useAgent } from './agentStore'
import { applyOps } from './applyOps'
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
  /** A resposta mexeu no conjunto. */
  changed?: number
  skipped?: string[]
  error?: boolean
}

const useChat = create<{ bySet: Record<string, Msg[]>; push: (setId: string, m: Msg) => void; clear: (setId: string) => void }>((set) => ({
  bySet: {},
  push: (setId, m) => set((s) => ({ bySet: { ...s.bySet, [setId]: [...(s.bySet[setId] ?? []), m] } })),
  clear: (setId) => set((s) => ({ bySet: { ...s.bySet, [setId]: [] } })),
}))

const FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Serif', 'Playfair Display', 'DM Sans', 'Manrope', 'Poppins', 'Montserrat', 'Space Grotesk', 'Fraunces', 'Archivo', 'Bebas Neue']
const MAX_IMAGES = 4

const SUGGESTIONS: Record<EditScope, string[]> = {
  layer: ['Deixe esse texto mais curto e direto', 'Aumente e centralize', 'Troque a cor para a de destaque da marca'],
  slide: ['Escreva o título de outro jeito', 'Troque o fundo para o papel e ajuste as cores', 'Duplique este slide com o case ProcessBase'],
  post: ['Reescreva a legenda', 'Inclua um slide de chamada no fim', 'Deixe os títulos mais curtos'],
  set: ['Crie um story novo sobre um case', 'Crie um banner 1200x628 para anúncio de link', 'Revise os textos e corte o que for exagero'],
}

const SCOPE_LABEL: Record<EditScope, string> = { layer: 'Componente', slide: 'Slide', post: 'Post', set: 'Tudo' }

interface Attached {
  id: string
  name: string
  data: string
  preview: string
}

const dataToBlob = async (data: string) => (await fetch(data)).blob()

/** O passo em que o agente está, com o tempo que já levou. */
const Working: React.FC = () => {
  const working = useAgent((s) => s.working)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!working) return null
  const order = ['sending', 'start', 'thinking', 'writing', 'applying'] as const
  const at = order.indexOf(working.phase)
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

export const AiChat: React.FC<{ available: boolean | null }> = ({ available }) => {
  const set = useEditor((s) => s.set)!
  const post = useEditor(currentPost)
  const slide = useEditor(currentSlide)
  const layer = useEditor(currentLayer)
  const msgs = useChat((s) => s.bySet[set.id]) ?? []
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

  useEffect(() => watchSkills(), [])

  // Escopo: o que está escolhido, ou o que a pessoa trocou (sempre dentro do que existe)
  const natural: EditScope = layer ? 'layer' : slide ? 'slide' : 'post'
  const options: EditScope[] = [...(layer ? (['layer'] as const) : []), ...(slide ? (['slide'] as const) : []), 'post', 'set']
  const scope: EditScope = forced && options.includes(forced) ? forced : natural
  useEffect(() => setForced(null), [layer?.id, slide?.id])

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
    if (scope === 'layer') return `${layer?.name ?? 'Componente'} · slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'slide') return `Slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'post') return post?.name ?? 'Post'
    return 'Todos os posts'
  }

  const send = async (override?: string) => {
    const message = (override ?? text).trim() || (files.length ? 'Faça posts com base nesta referência.' : '')
    if (!message || busy || !post) return
    const push = useChat.getState().push
    const sent = files
    push(set.id, { id: crypto.randomUUID(), role: 'user', text: message, scope: scopeName(), previews: sent.map((f) => f.preview), skill: skill?.name })
    setText('')
    setFiles([])
    setBusy(true)
    control.current = new AbortController()
    useAgent.getState().begin({ scope, postId: post.id, slideId: slide?.id, layerId: scope === 'layer' ? layer?.id : undefined }, scopeName())
    try {
      // Os prints entram no conjunto: assim a IA (e você) podem pôr um deles num slide
      const attachments: { name: string; src: string; data: string }[] = []
      for (const f of sent) {
        const blob = await dataToBlob(f.data)
        const asset = await uploadAsset(set.id, blob, f.name.includes('.') ? f.name : `${f.name}.${blob.type.includes('png') ? 'png' : 'jpg'}`)
        useEditor.getState().draft((s) => ({ ...s, assets: [...s.assets, asset] }))
        attachments.push({ name: f.name, src: `asset:${asset.id}`, data: f.data })
      }
      if (sent.length) useEditor.getState().persist()
      await useEditor.getState().ensureAssets()
      const state = useEditor.getState()
      const current = state.set!
      const history = (useChat.getState().bySet[set.id] ?? []).filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
      const fonts = [...new Set([current.brand.headingFont, current.brand.bodyFont, ...FONTS])]
      const answer = await requestEdit(
        {
          message,
          scope,
          set: current,
          postId: state.postId,
          slideId: state.slideId,
          layerId: scope === 'layer' ? state.layerId : undefined,
          images: state.images,
          history: history.slice(0, -1),
          attachments,
          skill: skill ? { name: skill.name, instructions: skill.instructions } : undefined,
        },
        fonts,
        control.current.signal,
        (step) => useAgent.getState().phase(step)
      )
      useAgent.getState().phase('applying')
      const result = applyOps(useEditor.getState().set!, answer.ops)
      if (result.applied) {
        useEditor.getState().edit(() => result.set)
        if (result.focus) {
          if (result.focus.postId !== useEditor.getState().postId) useEditor.getState().selectPost(result.focus.postId)
          useEditor.getState().selectSlide(result.focus.slideId)
          useEditor.getState().selectLayer(result.focus.layerId)
        }
        void useEditor.getState().ensureAssets()
        useAgent.getState().highlight(result.touched)
      }
      push(set.id, { id: crypto.randomUUID(), role: 'ai', text: answer.reply || (result.applied ? 'Pronto.' : 'Não precisei mudar nada.'), changed: result.applied, skipped: result.skipped })
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
        <p>O servidor de desenvolvimento não achou o Claude Code nesta máquina. Instale-o e recarregue.</p>
      </div>
    ) : (
      <div className="min-h-0 flex-1 overflow-y-auto" data-scroll>
        <p className="px-3.5 pt-3 text-xs text-gray-600">A conversa usa o Claude Code do seu computador, pela mesma ponte do chat do canvas. É a conexão que você já fez nos projetos: se ainda não fez, siga os passos.</p>
        <ConnectorPrompt />
      </div>
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
            <button type="button" className="ml-auto text-[11px] text-gray-400 hover:text-gray-700" onClick={() => useChat.getState().clear(set.id)}>Limpar</button>
          )}
        </div>
        <p className="truncate text-[11px] text-gray-500" title={scopeName()}>{scopeName()}</p>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f.id} className="group relative">
                <img src={f.preview} alt={f.name} title={f.name} className="h-14 w-14 rounded-md object-cover ring-1 ring-black/10" />
                <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
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
              placeholder={files.length ? 'O que fazer com a referência?' : 'O que você quer mudar? Cole um print aqui.'}
              className="min-h-[56px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {busy ? (
              <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 bg-white" title="Parar" onClick={stop}><Square className="h-4 w-4" /></Button>
            ) : (
              <Button type="button" size="icon" className="h-9 w-9 shrink-0" title="Enviar (Enter)" disabled={(!text.trim() && !files.length) || available === null} onClick={() => void send()}><Send className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

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
        </div>
      </div>
    </div>
  )
}
