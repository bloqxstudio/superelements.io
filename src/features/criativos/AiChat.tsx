import React, { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { Loader2, Send, Sparkles, Square, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requestEdit, type EditScope } from './ai'
import { applyOps } from './applyOps'
import { currentLayer, currentPost, currentSlide, useEditor } from './store'

/**
 * Conversa com a IA desta máquina (Claude Code) dentro do editor. O que está
 * escolhido no canvas (camada, slide, post ou tudo) vai junto com a mensagem; a
 * IA devolve operações e o editor as aplica num passo só, que o desfazer do
 * editor (ou o botão da resposta) reverte.
 */

interface Msg {
  id: string
  role: 'user' | 'ai'
  text: string
  /** Escopo usado, para mostrar na mensagem. */
  scope?: string
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

const SUGGESTIONS: Record<EditScope, string[]> = {
  layer: ['Deixe esse texto mais curto e direto', 'Aumente e centralize', 'Troque a cor para a de destaque da marca'],
  slide: ['Escreva o título de outro jeito', 'Troque o fundo para o papel e ajuste as cores', 'Duplique este slide com o case ProcessBase'],
  post: ['Reescreva a legenda', 'Inclua um slide de chamada no fim', 'Deixe os títulos mais curtos'],
  set: ['Crie um post novo sobre um case', 'Deixe todos os fundos escuros alternados com claros', 'Revise os textos e corte o que for exagero'],
}

const SCOPE_LABEL: Record<EditScope, string> = { layer: 'Componente', slide: 'Slide', post: 'Post', set: 'Tudo' }

export const AiChat: React.FC<{ available: boolean | null }> = ({ available }) => {
  const set = useEditor((s) => s.set)!
  const post = useEditor(currentPost)
  const slide = useEditor(currentSlide)
  const layer = useEditor(currentLayer)
  const msgs = useChat((s) => s.bySet[set.id]) ?? []
  const lastChanged = [...msgs].reverse().find((x) => x.changed)?.id
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [forced, setForced] = useState<EditScope | null>(null)
  const control = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)

  // Escopo: o que está escolhido, ou o que a pessoa trocou (sempre dentro do que existe)
  const natural: EditScope = layer ? 'layer' : slide ? 'slide' : 'post'
  const options: EditScope[] = [...(layer ? (['layer'] as const) : []), ...(slide ? (['slide'] as const) : []), 'post', 'set']
  const scope: EditScope = forced && options.includes(forced) ? forced : natural
  useEffect(() => setForced(null), [layer?.id, slide?.id])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, busy])

  const stop = () => control.current?.abort()

  const send = async (override?: string) => {
    const message = (override ?? text).trim()
    if (!message || busy || !post) return
    const push = useChat.getState().push
    push(set.id, { id: crypto.randomUUID(), role: 'user', text: message, scope: scopeName() })
    setText('')
    setBusy(true)
    control.current = new AbortController()
    try {
      await useEditor.getState().ensureAssets()
      const state = useEditor.getState()
      const current = state.set!
      const history = (useChat.getState().bySet[set.id] ?? []).filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
      const fonts = [...new Set([current.brand.headingFont, current.brand.bodyFont, ...FONTS])]
      const answer = await requestEdit({ message, scope, set: current, postId: state.postId, slideId: state.slideId, layerId: scope === 'layer' ? state.layerId : undefined, images: state.images, history: history.slice(0, -1) }, fonts, control.current.signal)
      const result = applyOps(useEditor.getState().set!, answer.ops)
      if (result.applied) {
        useEditor.getState().edit(() => result.set)
        if (result.focus) {
          if (result.focus.postId !== useEditor.getState().postId) useEditor.getState().selectPost(result.focus.postId)
          useEditor.getState().selectSlide(result.focus.slideId)
          useEditor.getState().selectLayer(result.focus.layerId)
        }
        void useEditor.getState().ensureAssets()
      }
      push(set.id, { id: crypto.randomUUID(), role: 'ai', text: answer.reply || (result.applied ? 'Pronto.' : 'Não precisei mudar nada.'), changed: result.applied, skipped: result.skipped })
    } catch (err) {
      if ((err as Error).name === 'AbortError') push(set.id, { id: crypto.randomUUID(), role: 'ai', text: 'Parei.', error: true })
      else push(set.id, { id: crypto.randomUUID(), role: 'ai', text: err instanceof Error ? err.message : 'A IA não respondeu.', error: true })
    } finally {
      setBusy(false)
    }
  }

  function scopeName() {
    if (scope === 'layer') return `${layer?.name ?? 'Componente'} · slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'slide') return `Slide ${(post?.slides.findIndex((s) => s.id === slide?.id) ?? 0) + 1}`
    if (scope === 'post') return post?.name ?? 'Post'
    return 'Todos os posts'
  }

  if (available === false)
    return (
      <div className="space-y-2 p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">IA indisponível</p>
        <p>A conversa usa o Claude Code desta máquina, pelo servidor de desenvolvimento do app. Abra o app local (<code>npm run dev</code>) com o Claude Code instalado.</p>
      </div>
    )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-scroll>
        {msgs.length === 0 && (
          <div className="space-y-3 text-sm text-gray-600">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Sparkles className="h-4 w-4 text-violet-600" /> Fale com os criativos</p>
            <p>Clique num componente, num slide ou num post no canvas e diga o que mudar. A IA enxerga o que você escolheu.</p>
            <div className="space-y-1.5">
              {SUGGESTIONS[scope].map((s) => (
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
                {m.text}
                {m.scope && <span className="mt-1 block text-[10px] uppercase tracking-wide text-violet-200">{m.scope}</span>}
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
        {busy && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando e editando… leva de 20 s a 1 min.
          </div>
        )}
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
            rows={2}
            placeholder="O que você quer mudar?"
            className="min-h-[56px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 bg-white" title="Parar" onClick={stop}><Square className="h-4 w-4" /></Button>
          ) : (
            <Button type="button" size="icon" className="h-9 w-9 shrink-0" title="Enviar (Enter)" disabled={!text.trim() || available === null} onClick={() => void send()}><Send className="h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </div>
  )
}
