import React, { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Component, GripVertical, PenLine, Unlink2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData, SpaceNode } from '@/types/space'
import { useSectionHover } from '../nodes/sectionHover'
import { MOD_KEY } from './clipboard'
import { componentPage, pageOf, pageSections, plural } from './pages'
import { PART_COLOR, PART_COLOR_STRONG } from './parts'
import { InstanceSection } from './PartInstance'
import { SectionMenu } from './SectionMenu'
import { useSectionDrag } from './useSectionDrag'

/** Altura de uma instância cujo componente foi excluído. */
const MISSING_HEIGHT = 96

/**
 * Instância de um componente livre dentro de uma página: um bloco da coluna,
 * como uma seção (sobe, desce, arrasta, copia, sai), que mostra as seções da
 * folha do componente. O conteúdo só muda na folha: clicar duas vezes (ou
 * Editar componente) leva até ela. Fica marcada em ciano o tempo todo.
 */
export const ComponentInstance: React.FC<{ node: SpaceNode }> = ({ node }) => {
  const data = node.data as SectionNodeData
  const { pages, nodes } = useSpaceStore(useShallow((s) => ({ pages: s.pages, nodes: s.nodes })))
  const selected = useSpaceStore((s) => s.selectedIds.includes(node.id))
  const hovered = useSectionHover((s) => s.id === node.id)
  const { updateNodeSize, removeNode, moveSection, detachInstance } = useSpaceStore.getState()
  const cardRef = useRef<HTMLDivElement>(null)
  const { onMouseDown, lift, dragging, settling, onSettled } = useSectionDrag(node, cardRef)

  const component = componentPage(pages, data.instanceOf)
  // Um componente não se mostra dentro dele mesmo
  const home = pageOf(pages, node.id)
  const loop = !!component && home?.id === component.id
  const sections = component && !loop ? pageSections(component, nodes) : []
  const position = home ? home.sectionIds.indexOf(node.id) : -1
  const name = component?.name ?? data.title

  // A altura é a das seções do componente; muda quando a folha dele muda
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => entry && updateNodeSize(node.id, node.width, entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [node.id, node.width, updateNodeSize])

  const openComponent = () => {
    if (!component) return
    const store = useSpaceStore.getState()
    store.focusPage(component.id)
    store.setSelection(component.sectionIds)
  }
  const detach = () => {
    const count = detachInstance(node.id)
    if (count) toast.success(`${plural(count, 'seção comum', 'seções comuns')} no lugar da instância`, { description: `Mudam só nesta página. ${MOD_KEY}Z desfaz.` })
  }

  const shown = selected || hovered || dragging
  const lifted = !!lift && (lift.dx !== 0 || lift.dy !== 0)

  return (
    <>
      {lifted && (
        <div
          aria-hidden
          className="pointer-events-none absolute bg-cyan-50/70"
          style={{ left: node.x, top: node.y, width: node.width, height: node.height, boxShadow: 'inset 0 0 0 calc(1.5px / var(--z, 1)) #67e8f9' }}
        />
      )}
      <div
        ref={cardRef}
        data-section-id={node.id}
        data-component-instance={data.instanceOf}
        onTransitionEnd={(e) => e.propertyName === 'transform' && onSettled()}
        onPointerMove={() => useSectionHover.getState().set(node.id)}
        onPointerLeave={() => useSectionHover.getState().id === node.id && useSectionHover.getState().set(null)}
        className={`absolute bg-white ${dragging ? 'shadow-2xl' : ''}`}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          userSelect: 'none',
          transform: lifted ? `translate(${lift!.dx}px, ${lift!.dy}px) rotate(0.6deg)` : undefined,
          transition: settling ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 150ms' : undefined,
          zIndex: dragging || settling ? 10 : selected ? 2 : undefined,
          opacity: dragging ? 0.94 : undefined,
        }}
      >
        {/* O preview não recebe o mouse: aqui o componente só se mostra */}
        <div className="pointer-events-none">
          {sections.map((section) => (
            <InstanceSection key={section.id} node={section} />
          ))}
          {!sections.length && (
            <div className="flex flex-col items-center justify-center gap-1 bg-cyan-50/60 px-6 text-center" style={{ height: MISSING_HEIGHT }}>
              <p className="text-xs font-medium text-cyan-900">{loop ? 'Um componente não entra nele mesmo' : component ? `${name} está vazio` : 'O componente foi excluído'}</p>
              <p className="text-[11px] text-cyan-800/80">{component && !loop ? 'Ponha seções na folha dele.' : 'Tire esta instância da página.'}</p>
            </div>
          )}
        </div>

        {/* Sempre à vista, fora da folha: a barra e o losango do componente */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 rounded-full" style={{ left: 'calc(-9px / var(--z, 1))', width: 'calc(3px / var(--z, 1))', background: PART_COLOR }} />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 flex h-5 w-5 origin-top-right items-center justify-center rounded-md text-white shadow-sm"
          style={{ right: 'calc(100% + 14px / var(--z, 1))', transform: 'scale(calc(1 / var(--z, 1)))', background: PART_COLOR }}
        >
          <Component className="h-3 w-3" />
        </div>

        {/* Por cima do preview: arrastar leva a instância, clicar escolhe, clicar duas vezes abre o componente */}
        <div
          role="button"
          tabIndex={-1}
          aria-label={`${name} (componente). Clique duas vezes para editar`}
          className={`absolute inset-0 z-[5] ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
          style={{
            background: shown ? 'rgb(8 145 178 / 0.05)' : 'transparent',
            boxShadow: shown ? `inset 0 0 0 calc(${selected ? 2 : 1.5}px / var(--z, 1)) ${selected ? PART_COLOR_STRONG : PART_COLOR}` : undefined,
          }}
          onMouseDown={onMouseDown}
          onDoubleClick={openComponent}
        />

        <div
          className={`pointer-events-none absolute left-0 top-0 z-10 flex origin-top-left items-center gap-1 rounded-br-md py-0.5 pl-1 pr-2 text-[11px] font-medium text-white transition-opacity duration-150 ${shown ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scale(calc(1 / var(--z, 1)))', background: selected ? PART_COLOR_STRONG : PART_COLOR, maxWidth: 'max(64px, calc(100% * var(--z, 1) - 220px))' }}
        >
          <GripVertical className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <Component className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{name}</span>
          <span className="shrink-0 opacity-75">· componente</span>
        </div>

        <div
          className={`absolute right-0 top-0 z-10 flex origin-top-right items-center gap-0.5 rounded-bl-md bg-white/95 p-0.5 shadow-sm ring-1 ring-black/5 transition-opacity duration-150 ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          style={{ transform: 'scale(calc(1 / var(--z, 1)))' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {component && !loop && (
            <button
              type="button"
              onClick={openComponent}
              className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium transition-colors hover:bg-cyan-50"
              style={{ color: PART_COLOR_STRONG }}
              title="Leva até a folha do componente: o que mudar lá muda em todas as páginas que o usam"
            >
              <PenLine className="h-3.5 w-3.5" /> Editar componente
            </button>
          )}
          <ToolButton label="Subir na página" disabled={position <= 0} onClick={() => moveSection(node.id, -1)}>
            <ChevronUp className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label="Descer na página" disabled={!home || position >= home.sectionIds.length - 1} onClick={() => moveSection(node.id, 1)}>
            <ChevronDown className="h-3.5 w-3.5" />
          </ToolButton>
          {component && !loop && (
            <ToolButton label="Separar do componente (vira seção comum, só nesta página)" onClick={detach}>
              <Unlink2 className="h-3.5 w-3.5" />
            </ToolButton>
          )}
          <SectionMenu sectionId={node.id} className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" />
          <ToolButton label="Tirar desta página (o componente continua)" danger onClick={() => removeNode(node.id)}>
            <X className="h-3.5 w-3.5" />
          </ToolButton>
        </div>
      </div>
    </>
  )
}

const ToolButton: React.FC<{ label: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, disabled, danger, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className={`flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors disabled:pointer-events-none disabled:opacity-30 ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-gray-100 hover:text-gray-900'}`}
  >
    {children}
  </button>
)
