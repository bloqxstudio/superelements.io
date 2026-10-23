import React, { memo, useLayoutEffect, useRef } from 'react'
import { GripVertical, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clean } from './html'
import type { Block } from './types'

/** Um bloco do documento: o texto editável e o que o cerca (alça, rótulo, comentários e quem está nele). */

export interface Mark {
  /** O nome e a cor de quem está no bloco (uma pessoa ou um agente). */
  name: string
  color: string
  kind: 'person' | 'agent'
  note?: string
}

const BASE: Record<Block['type'], string> = {
  h1: 'text-[30px] font-semibold leading-tight tracking-tight text-gray-900',
  h2: 'text-2xl font-semibold leading-snug tracking-tight text-gray-900',
  h3: 'text-xl font-semibold leading-snug text-gray-900',
  p: 'text-[16px] leading-7 text-gray-800',
  bullet: 'text-[16px] leading-7 text-gray-800',
  number: 'text-[16px] leading-7 text-gray-800',
  quote: 'border-l-4 border-gray-300 pl-4 text-[17px] italic leading-7 text-gray-700',
  hook: 'rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-lg font-semibold leading-snug text-violet-950',
  cta: 'inline-block rounded-md bg-gray-900 px-5 py-2.5 text-[15px] font-semibold text-white',
  note: 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950',
  divider: '',
}

export const TYPE_LABEL: Record<Block['type'], string> = { h1: 'Título 1', h2: 'Título 2', h3: 'Título 3', p: 'Texto', bullet: 'Lista', number: 'Lista numerada', quote: 'Citação', hook: 'Gancho', cta: 'Chamada (botão)', note: 'Nota interna', divider: 'Divisor' }

interface Props {
  block: Block
  /** Número do item numa lista numerada. */
  number?: number
  selected: boolean
  comments: number
  marks: Mark[]
  /** O agente acabou de mexer: realce. */
  flash: boolean
  onFocus: (id: string) => void
  onInput: (id: string, html: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, block: Block) => void
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>, block: Block) => void
  onSelectHandle: (id: string, additive: boolean) => void
  onOpenComments: (id: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string, before: boolean) => void
  onDrop: () => void
  dropLine?: 'before' | 'after'
  register: (id: string, el: HTMLDivElement | null) => void
}

export const BlockView = memo(function BlockView(p: Props) {
  const { block } = p
  const ref = useRef<HTMLDivElement>(null)

  // O DOM só é reescrito quando o texto veio de fora (outra pessoa, o agente, o desfazer) e a pessoa não está digitando nele
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || block.type === 'divider') return
    if (clean(el.innerHTML) !== block.html && document.activeElement !== el) el.innerHTML = block.html
  }, [block.html, block.type])

  const first = p.marks[0]
  return (
    <div
      className={cn('group relative -mx-10 flex items-start gap-1 px-10 py-1', p.selected && 'rounded-lg bg-violet-50/60 ring-1 ring-violet-200', p.flash && 'rounded-lg bg-orange-50 ring-2 ring-orange-300 transition-colors')}
      onDragOver={(e) => {
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        p.onDragOver(block.id, e.clientY < r.top + r.height / 2)
      }}
      onDrop={(e) => {
        e.preventDefault()
        p.onDrop()
      }}
    >
      {p.dropLine && <span className={cn('pointer-events-none absolute left-10 right-10 h-0.5 rounded bg-violet-500', p.dropLine === 'before' ? '-top-px' : '-bottom-px')} />}

      {/* Quem está aqui: uma barra na cor da pessoa (ou do agente) e o nome */}
      {first && (
        <>
          <span className="pointer-events-none absolute inset-y-1 left-8 w-0.5 rounded" style={{ background: first.color }} />
          <span className="pointer-events-none absolute -top-2 left-10 z-10 flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[10px] font-semibold text-white" style={{ background: first.color }}>
            {first.name}
            {first.note ? ` · ${first.note}` : ''}
            {p.marks.length > 1 ? ` +${p.marks.length - 1}` : ''}
          </span>
        </>
      )}

      {/* Alça: arrasta o bloco; clique escolhe (Shift soma) */}
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', block.id)
          p.onDragStart(block.id)
        }}
        onClick={(e) => p.onSelectHandle(block.id, e.shiftKey || e.metaKey || e.ctrlKey)}
        aria-label="Mover ou escolher o bloco"
        title="Arraste para mover · clique para escolher (Shift soma) e pedir algo a um agente só sobre ele"
        className="absolute left-1 top-1.5 flex h-6 w-5 cursor-grab items-center justify-center rounded text-gray-300 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        {block.label && block.type !== 'divider' && <p className="mb-0.5 select-none text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">{block.label}</p>}
        {block.type === 'divider' ? (
          <hr className="my-3 border-gray-200" />
        ) : (
          <div className={cn('flex items-baseline gap-2', block.type === 'bullet' || block.type === 'number' ? 'pl-1' : '')}>
            {block.type === 'bullet' && <span className="select-none text-gray-400">•</span>}
            {block.type === 'number' && <span className="select-none text-gray-400 tabular-nums">{p.number ?? 1}.</span>}
            {block.type === 'note' && <span className="select-none text-[10px] font-bold uppercase tracking-wide text-amber-700">Nota</span>}
            <div
              ref={(el) => {
                ref.current = el
                p.register(block.id, el)
              }}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              role="textbox"
              aria-multiline
              aria-label={block.label ?? TYPE_LABEL[block.type]}
              data-block={block.id}
              data-placeholder={block.type === 'p' ? "Escreva, ou digite '/' para escolher o tipo" : TYPE_LABEL[block.type]}
              onFocus={() => p.onFocus(block.id)}
              onInput={(e) => p.onInput(block.id, e.currentTarget.innerHTML)}
              onKeyDown={(e) => p.onKeyDown(e, block)}
              onPaste={(e) => p.onPaste(e, block)}
              onBlur={(e) => {
                // Ao sair, o DOM ganha o texto limpo
                const html = clean(e.currentTarget.innerHTML)
                if (e.currentTarget.innerHTML !== html) e.currentTarget.innerHTML = html
              }}
              className={cn('min-w-0 flex-1 whitespace-pre-wrap break-words outline-none empty:before:pointer-events-none empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] [&_a]:text-violet-700 [&_a]:underline', BASE[block.type], block.type === 'cta' && 'flex-none')}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => p.onOpenComments(block.id)}
        aria-label={p.comments ? `${p.comments} comentários` : 'Comentar'}
        title={p.comments ? `${p.comments} comentário${p.comments > 1 ? 's' : ''}` : 'Comentar este bloco'}
        className={cn('mt-1.5 flex h-6 shrink-0 items-center gap-1 rounded px-1 text-[11px] font-medium', p.comments ? 'bg-amber-100 text-amber-800' : 'text-gray-300 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100')}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {p.comments > 0 && p.comments}
      </button>
    </div>
  )
})
