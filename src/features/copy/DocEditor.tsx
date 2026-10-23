import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Italic, Link2, MessageSquarePlus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { engineInfo, useCopyAgent } from './agentStore'
import { BlockView, TYPE_LABEL, type Mark } from './BlockView'
import { clean } from './html'
import { useCopyLive } from './live'
import { useCopy } from './store'
import { block as makeBlock, type Block, type BlockType, type CopyDoc } from './types'

/**
 * O documento: os blocos em coluna, como num editor de texto. Enter divide o
 * bloco, Backspace no começo junta com o de cima, "/" abre os tipos, "# ", "- ",
 * "1. " e "> " viram título, lista e citação; arrastar pela alça reordena; ao
 * selecionar um trecho aparece a barra de negrito, itálico, link, comentário e
 * os pedidos rápidos ao agente.
 */

/** Os elementos editáveis, por id de bloco: o painel os usa para rolar até um bloco. */
const elements = new Map<string, HTMLDivElement>()

export function scrollToBlock(id: string) {
  const el = elements.get(id)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function focusBlock(id: string, where: 'start' | 'end' | number = 'end') {
  requestAnimationFrame(() => {
    const el = elements.get(id)
    if (!el) return
    el.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    if (typeof where === 'number') {
      // Posição por caractere: percorre os nós de texto
      let left = where
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const len = node.textContent?.length ?? 0
        if (left <= len) {
          range.setStart(node, left)
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
          return
        }
        left -= len
        node = walker.nextNode()
      }
    }
    range.selectNodeContents(el)
    range.collapse(where === 'start')
    sel?.removeAllRanges()
    sel?.addRange(range)
  })
}

const SHORTCUTS: [RegExp, BlockType][] = [
  [/^#\s$/, 'h1'],
  [/^##\s$/, 'h2'],
  [/^###\s$/, 'h3'],
  [/^[-*]\s$/, 'bullet'],
  [/^1\.\s$/, 'number'],
  [/^>\s$/, 'quote'],
]

const MENU: BlockType[] = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'quote', 'hook', 'cta', 'note', 'divider']

const caretAtStart = (el: HTMLElement) => {
  const sel = window.getSelection()
  if (!sel?.rangeCount || !sel.isCollapsed) return false
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
  return r.toString().length === 0
}

const caretAtEnd = (el: HTMLElement) => {
  const sel = window.getSelection()
  if (!sel?.rangeCount || !sel.isCollapsed) return false
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
  return r.toString().length === 0
}

export const QUICK: { label: string; ask: string }[] = [
  { label: 'Mais curto', ask: 'Deixe este trecho mais curto, sem perder a ideia' },
  { label: 'Mais direto', ask: 'Deixe este trecho mais direto e concreto' },
  { label: 'Mais forte', ask: 'Deixe este trecho mais forte e específico, sem exagero nem promessa' },
  { label: 'Outras versões', ask: 'Dê 3 versões diferentes deste trecho (insira as versões logo depois, como notas)' },
  { label: 'Conferir as regras', ask: 'Confira este trecho contra as regras da profissão do nicho e corrija o que violar' },
]

interface Props {
  /** A pessoa quer comentar este bloco (e o trecho selecionado, se houver). */
  onComment: (blockId: string, quote?: string) => void
  /** Pedido rápido ao agente sobre estes blocos. */
  onAsk: (message: string, blockIds: string[]) => void
}

export const DocEditor: React.FC<Props> = ({ onComment, onAsk }) => {
  const doc = useCopy((s) => s.doc)!
  const selection = useCopy((s) => s.selection)
  const people = useCopyLive((s) => s.people)
  const focus = useCopyLive((s) => s.focus)
  const peerAgents = useCopyLive((s) => s.agents)
  const agentCursor = useCopyAgent((s) => s.cursor)
  const working = useCopyAgent((s) => s.working)
  const flash = useCopyAgent((s) => s.flash)

  const typing = useRef<{ before: CopyDoc; timer?: ReturnType<typeof setTimeout> } | null>(null)
  const [drag, setDrag] = useState<{ id: string; over?: { id: string; before: boolean } } | null>(null)
  const [menu, setMenu] = useState<{ blockId: string; at: number } | null>(null)
  const [sel, setSel] = useState<{ blockId: string; text: string; rect: DOMRect } | null>(null)
  const [link, setLink] = useState<{ url: string; range: Range } | null>(null)
  const [quick, setQuick] = useState(false)

  const register = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) elements.set(id, el)
    else elements.delete(id)
  }, [])

  const setBlocks = (fn: (blocks: Block[]) => Block[]) => useCopy.getState().edit((d) => ({ ...d, blocks: fn(d.blocks) }))

  // Digitar: rascunho a cada tecla e um passo do desfazer quando a pessoa para por um instante
  const onInput = useCallback((id: string, raw: string) => {
    const st = useCopy.getState()
    if (!st.doc) return
    const el = elements.get(id)
    const text = el?.textContent ?? ''
    const current = st.doc.blocks.find((b) => b.id === id)
    if (current?.type === 'p') {
      const hit = SHORTCUTS.find(([re]) => re.test(text.replace(/ /g, ' ')))
      if (hit) {
        if (el) el.innerHTML = ''
        st.edit((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, type: hit[1], html: '' } : b)) }))
        focusBlock(id, 'start')
        return
      }
    }
    if (!typing.current) typing.current = { before: st.doc }
    clearTimeout(typing.current.timer)
    typing.current.timer = setTimeout(() => {
      const t = typing.current
      typing.current = null
      if (t) useCopy.getState().checkpoint(t.before)
    }, 700)
    const html = clean(raw)
    st.draft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, html } : b)) }))
    st.persist()
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, b: Block) => {
      const el = e.currentTarget
      const blocks = useCopy.getState().doc?.blocks ?? []
      const at = blocks.findIndex((x) => x.id === b.id)

      if (e.key === '/' && !(el.textContent ?? '').length) {
        e.preventDefault()
        setMenu({ blockId: b.id, at: 0 })
        return
      }
      if (menu) return

      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        const isList = b.type === 'bullet' || b.type === 'number'
        if (isList && !(el.textContent ?? '').length) {
          // Enter numa linha vazia da lista sai da lista
          setBlocks((all) => all.map((x) => (x.id === b.id ? { ...x, type: 'p' } : x)))
          return
        }
        const sel = window.getSelection()
        if (!sel?.rangeCount) return
        const tail = document.createRange()
        tail.selectNodeContents(el)
        tail.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
        const holder = document.createElement('div')
        holder.appendChild(tail.extractContents())
        const next = makeBlock(isList ? b.type : 'p', clean(holder.innerHTML))
        const head = clean(el.innerHTML)
        setBlocks((all) => {
          const i = all.findIndex((x) => x.id === b.id)
          return [...all.slice(0, i), { ...all[i], html: head }, next, ...all.slice(i + 1)]
        })
        focusBlock(next.id, 'start')
        return
      }

      if (e.key === 'Backspace' && caretAtStart(el)) {
        if (b.type !== 'p' && b.type !== 'divider') {
          e.preventDefault()
          setBlocks((all) => all.map((x) => (x.id === b.id ? { ...x, type: 'p' } : x)))
          return
        }
        if (at > 0) {
          e.preventDefault()
          const prev = blocks[at - 1]
          if (prev.type === 'divider') return setBlocks((all) => all.filter((x) => x.id !== prev.id))
          const joinAt = (elements.get(prev.id)?.textContent ?? '').length
          setBlocks((all) => all.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, html: clean(`${x.html}${clean(el.innerHTML)}`) } : x)))
          focusBlock(prev.id, joinAt)
        }
        return
      }

      if (e.key === 'ArrowUp' && !e.shiftKey && caretAtStart(el) && at > 0) {
        e.preventDefault()
        focusBlock(blocks[at - 1].id, 'end')
      }
      if (e.key === 'ArrowDown' && !e.shiftKey && caretAtEnd(el) && at < blocks.length - 1) {
        e.preventDefault()
        focusBlock(blocks[at + 1].id, 'start')
      }
    },
    [menu]
  )

  // Colar: texto com parágrafos vira vários blocos; o resto entra como texto limpo
  const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>, b: Block) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    const parts = text.replace(/\r/g, '').split(/\n{2,}|\n(?=[-•*]\s|\d+\.\s)/).map((t) => t.trim()).filter(Boolean)
    if (parts.length < 2) {
      document.execCommand('insertText', false, text.replace(/\n/g, ' '))
      return
    }
    const created = parts.map((t) => {
      const bullet = /^[-•*]\s+/.test(t)
      const number = /^\d+\.\s+/.test(t)
      return makeBlock(bullet ? 'bullet' : number ? 'number' : 'p', clean(t.replace(/^([-•*]|\d+\.)\s+/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')))
    })
    setBlocks((all) => {
      const i = all.findIndex((x) => x.id === b.id)
      const empty = !(all[i].html ?? '').replace(/<br>/g, '').trim()
      return [...all.slice(0, empty ? i : i + 1), ...created, ...all.slice(i + 1)]
    })
    focusBlock(created[created.length - 1].id, 'end')
  }, [])

  const onSelectHandle = useCallback((id: string, additive: boolean) => {
    const cur = useCopy.getState().selection
    useCopy.getState().select(additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : cur.length === 1 && cur[0] === id ? [] : [id])
  }, [])

  // A seleção de texto: a barra flutuante
  useEffect(() => {
    const onChange = () => {
      const s = window.getSelection()
      if (!s || s.isCollapsed || !s.rangeCount) return setSel((cur) => (cur && link ? cur : null))
      const node = s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode?.parentElement
      const holder = node?.closest('[data-block]') as HTMLElement | null
      if (!holder || !holder.contains(s.focusNode)) return setSel(null)
      const text = s.toString().trim()
      if (!text) return setSel(null)
      setSel({ blockId: holder.dataset.block!, text, rect: s.getRangeAt(0).getBoundingClientRect() })
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [link])

  // Marcas por bloco: pessoas que estão nele e agentes trabalhando nele
  const marks = useMemo(() => {
    const out = new Map<string, Mark[]>()
    const add = (id: string | undefined, m: Mark) => id && out.set(id, [...(out.get(id) ?? []), m])
    for (const p of people) add(focus[p.userId]?.blockId, { name: p.name, color: p.color, kind: 'person' })
    for (const a of Object.values(peerAgents)) add(a.blockId, { name: `${a.agent} · ${a.owner}`, color: a.agent.includes('Codex') ? '#10A37F' : '#D97757', kind: 'agent', note: a.text })
    if (agentCursor?.blockId) add(agentCursor.blockId, { name: agentCursor.agent, color: engineInfo(agentCursor.engine).color, kind: 'agent', note: working?.label ?? agentCursor.text })
    return out
  }, [people, focus, peerAgents, agentCursor, working])

  const commentCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of doc.comments) if (!c.resolved) m.set(c.blockId, (m.get(c.blockId) ?? 0) + 1)
    return m
  }, [doc.comments])

  // Numeração das listas numeradas: conta os itens seguidos
  const numbers = useMemo(() => {
    const out = new Map<string, number>()
    let n = 0
    for (const b of doc.blocks) {
      n = b.type === 'number' ? n + 1 : 0
      if (b.type === 'number') out.set(b.id, n)
    }
    return out
  }, [doc.blocks])

  const drop = () => {
    const d = drag
    setDrag(null)
    if (!d?.over || d.over.id === d.id) return
    setBlocks((all) => {
      const moving = all.find((x) => x.id === d.id)
      if (!moving) return all
      const rest = all.filter((x) => x.id !== d.id)
      const at = rest.findIndex((x) => x.id === d.over!.id)
      return [...rest.slice(0, at + (d.over!.before ? 0 : 1)), moving, ...rest.slice(at + (d.over!.before ? 0 : 1))]
    })
  }

  const applyMenu = (type: BlockType) => {
    if (!menu) return
    const id = menu.blockId
    if (type === 'divider') {
      const next = makeBlock('p')
      setBlocks((all) => {
        const i = all.findIndex((x) => x.id === id)
        return [...all.slice(0, i), { ...all[i], type: 'divider', html: '' }, next, ...all.slice(i + 1)]
      })
      focusBlock(next.id, 'start')
    } else {
      setBlocks((all) => all.map((x) => (x.id === id ? { ...x, type } : x)))
      focusBlock(id, 'start')
    }
    setMenu(null)
  }

  const format = (cmd: 'bold' | 'italic') => document.execCommand(cmd)

  const ask = (message: string) => {
    if (!sel) return
    setQuick(false)
    onAsk(`${message}:\n"${sel.text}"`, [sel.blockId])
  }

  return (
    <div className="relative mx-auto w-full max-w-[760px] px-10 pb-40 pt-6" onClick={(e) => e.target === e.currentTarget && useCopy.getState().select([])}>
      {doc.blocks.map((b) => (
        <BlockView
          key={b.id}
          block={b}
          number={numbers.get(b.id)}
          selected={selection.includes(b.id)}
          comments={commentCount.get(b.id) ?? 0}
          marks={marks.get(b.id) ?? []}
          flash={flash.includes(b.id)}
          onFocus={(id) => useCopy.getState().setFocus(id)}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onSelectHandle={onSelectHandle}
          onOpenComments={(id) => onComment(id)}
          onDragStart={(id) => setDrag({ id })}
          onDragOver={(id, before) => setDrag((d) => (d ? { ...d, over: { id, before } } : d))}
          onDrop={drop}
          dropLine={drag?.over?.id === b.id && drag.id !== b.id ? (drag.over.before ? 'before' : 'after') : undefined}
          register={register}
        />
      ))}
      <button
        type="button"
        onClick={() => {
          const nb = makeBlock('p')
          setBlocks((all) => [...all, nb])
          focusBlock(nb.id, 'start')
        }}
        className="mt-2 text-sm text-gray-400 hover:text-gray-700"
      >
        + Novo bloco
      </button>

      {/* Tipos de bloco ("/") */}
      {menu && (
        <div className="fixed inset-0 z-40" onMouseDown={() => setMenu(null)}>
          <div className="absolute left-1/2 top-1/3 w-60 -translate-x-1/2 rounded-xl border bg-white p-1 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tipo do bloco</p>
            {MENU.map((t, i) => (
              <button key={t} type="button" autoFocus={i === 0} onClick={() => applyMenu(t)} onKeyDown={(e) => e.key === 'Escape' && setMenu(null)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-violet-50 focus:bg-violet-50 focus:outline-none">
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra da seleção */}
      {sel && (
        <div className="fixed z-50 flex items-center gap-0.5 rounded-xl border bg-white p-1 shadow-xl" style={{ left: Math.max(8, Math.min(sel.rect.left + sel.rect.width / 2 - 150, window.innerWidth - 320)), top: Math.max(8, sel.rect.top - 48) }} onMouseDown={(e) => e.preventDefault()}>
          {link ? (
            <form
              className="flex items-center gap-1 px-1"
              onSubmit={(e) => {
                e.preventDefault()
                const s = window.getSelection()
                s?.removeAllRanges()
                s?.addRange(link.range)
                if (/^https?:\/\//i.test(link.url)) document.execCommand('createLink', false, link.url)
                setLink(null)
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input autoFocus value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://…" className="h-7 w-56 rounded-md border border-gray-200 px-2 text-sm" onMouseDown={(e) => e.stopPropagation()} />
              <Button type="submit" size="sm" className="h-7">OK</Button>
            </form>
          ) : (
            <>
              <button type="button" aria-label="Negrito" title="Negrito (Ctrl+B)" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100" onClick={() => format('bold')}><Bold className="h-4 w-4" /></button>
              <button type="button" aria-label="Itálico" title="Itálico (Ctrl+I)" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100" onClick={() => format('italic')}><Italic className="h-4 w-4" /></button>
              <button type="button" aria-label="Link" title="Link" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100" onClick={() => { const s = window.getSelection(); if (s?.rangeCount) setLink({ url: 'https://', range: s.getRangeAt(0).cloneRange() }) }}><Link2 className="h-4 w-4" /></button>
              <span className="mx-1 h-5 w-px bg-gray-200" />
              <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100" onClick={() => onComment(sel.blockId, sel.text)}><MessageSquarePlus className="h-4 w-4" /> Comentar</button>
              <div className="relative">
                <button type="button" className="flex h-7 items-center gap-1 rounded-md bg-violet-600 px-2 text-xs font-semibold text-white hover:bg-violet-700" onClick={() => setQuick((q) => !q)}><Sparkles className="h-3.5 w-3.5" /> Agente</button>
                {quick && (
                  <div className="absolute left-0 top-9 w-52 rounded-xl border bg-white p-1 shadow-xl">
                    {QUICK.map((q) => (
                      <button key={q.label} type="button" onClick={() => ask(q.ask)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-violet-50">{q.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <span className="sr-only">{doc.blocks.length} blocos</span>
    </div>
  )
}
