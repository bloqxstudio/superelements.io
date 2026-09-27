import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { X, GripVertical, ChevronUp, ChevronDown, Code2 } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import { PreviewFrame } from '@/features/elementor-preview/PreviewFrame'
import { parseSectionElements } from '@/features/space/landingPage'
import { useActiveBrand } from '@/features/space/brand/brandStore'
import { sectionLensDocument } from '@/features/space/levels/lens'
import { sectionMotionLabel } from '@/features/space/levels/motion'
import { pageOf } from '@/features/space/pages/pages'
import { SectionMenu } from '@/features/space/pages/SectionMenu'
import { useSectionDrag } from '@/features/space/pages/useSectionDrag'
import type { SpaceNode, SectionNodeData } from '@/types/space'

interface SectionNodeProps {
  node: SpaceNode
}

export const SectionNode: React.FC<SectionNodeProps> = ({ node }) => {
  const { nodes, connections, pages, updateNodeData, updateNodeSize, removeNode, moveSection, startConnection, completeConnection } = useSpaceStore()
  const editLevel = useSpaceStore((s) => s.editLevel)
  const selected = useSpaceStore((s) => s.selectedIds.includes(node.id))
  const motionDraft = useSpaceStore((s) => s.motionDraft)
  const motionReplay = useSpaceStore((s) => s.motionReplay)
  const data = node.data as SectionNodeData
  const cardRef = useRef<HTMLDivElement>(null)
  const hasElements = useMemo(() => !!parseSectionElements(data.elementorJson), [data.elementorJson])
  const [showJson, setShowJson] = useState(!hasElements)

  // Texto e paleta conectados entram no preview; a chave muda só quando eles mudam
  const transformKey = JSON.stringify(
    connections
      .filter((c) => c.targetId === node.id)
      .map((c) => [c.type, nodes.find((n) => n.id === c.sourceId)?.data])
  )

  const brand = useActiveBrand()

  // No nível Movimento, a seção selecionada já aparece com o rascunho
  const draft = editLevel === 'motion' && selected ? motionDraft ?? undefined : undefined
  const replay = editLevel === 'motion' ? motionReplay : 0

  const rendered = useMemo(() => {
    const { nodes: all, connections: conns } = useSpaceStore.getState()
    const current = all.find((n) => n.id === node.id)
    return current ? sectionLensDocument({ section: current, nodes: all, connections: conns, brand, level: editLevel, draft, replay }) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, data.elementorJson, data.title, data.levels, transformKey, brand, editLevel, draft, replay])

  const motionLabel = sectionMotionLabel(data.levels?.motion)

  const unsupported = rendered ? Object.keys(rendered.unsupported) : []
  // Seção de página fica presa na coluna dela; sem página, fica solta no canvas
  const page = pageOf(pages, node.id)
  const position = page ? page.sectionIds.indexOf(node.id) : -1

  // Track node height for accurate port positioning
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        updateNodeSize(node.id, node.width, entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [node.id, node.width, updateNodeSize])

  const inPage = !!page
  const { onMouseDown: handleDragStart, lift, dragging, settling, onSettled } = useSectionDrag(node, cardRef)

  const handleOutputPortMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const portCenterX = rect.left + rect.width / 2
      const portCenterY = rect.top + rect.height / 2
      startConnection(node.id, portCenterX, portCenterY)
    },
    [node.id, startConnection]
  )

  const handleInputPortMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      completeConnection(node.id)
    },
    [node.id, completeConnection]
  )

  const headerButton = 'text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors'

  // Seção de página levada pelo arrasto: o lugar dela na coluna fica marcado até soltar
  const lifted = inPage && !!lift && (lift.dx !== 0 || lift.dy !== 0)

  return (
    <>
    {lifted && (
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl border-2 border-dashed border-gray-300 bg-white/40"
        style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      />
    )}
    <div
      ref={cardRef}
      onMouseDown={handleDragStart}
      onTransitionEnd={(e) => e.propertyName === 'transform' && onSettled()}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        cursor: dragging ? (lift?.copy ? 'copy' : 'grabbing') : 'grab',
        userSelect: 'none',
        transform: lifted ? `translate(${lift.dx}px, ${lift.dy}px) rotate(0.6deg)` : undefined,
        // Solta fora de uma página, a seção volta deslizando para o lugar dela
        transition: settling ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 150ms' : undefined,
        // A seção arrastada passa por cima das páginas e das outras seções
        zIndex: dragging || settling ? 10 : undefined,
        opacity: dragging ? 0.94 : undefined,
      }}
      className={`rounded-xl border bg-white transition-shadow ${dragging ? 'shadow-2xl' : 'shadow-md'} ${selected ? 'border-violet-500 ring-2 ring-violet-500/70 ring-offset-2 ring-offset-[#f4f4f5]' : 'border-gray-200'}`}
    >
      {dragging && (lift?.copy || lift?.loose) && (
        <span className="pointer-events-none absolute -top-3 left-3 z-20 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          {lift.copy ? (lift.loose ? '+ Cópia solta no canvas' : '+ Cópia') : 'Fica solta no canvas'}
        </span>
      )}
      {/* Input port */}
      <div
        className="absolute w-3 h-3 rounded-full bg-gray-400 border-2 border-white shadow-sm cursor-crosshair hover:bg-blue-400 transition-colors z-10"
        style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseUp={handleInputPortMouseUp}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3 w-3 text-gray-400" aria-hidden />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            {page ? `Seção ${position + 1}` : 'Seção solta'}
          </span>
          {data.sourceId && (
            <span className="rounded bg-gray-200/70 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">{data.sourceId}</span>
          )}
          {motionLabel && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700" title="Movimento escolhido no nível Movimento">
              {motionLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
          {page && (
            <>
              <button className={headerButton} title="Subir na página" disabled={position <= 0} onClick={() => moveSection(node.id, -1)}>
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button className={headerButton} title="Descer na página" disabled={position >= page.sectionIds.length - 1} onClick={() => moveSection(node.id, 1)}>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <SectionMenu sectionId={node.id} className={headerButton} />
          <button
            className={`${headerButton} ${showJson ? 'text-blue-500' : ''}`}
            title={showJson ? 'Esconder JSON' : 'Editar JSON'}
            onClick={() => setShowJson((v) => !v)}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => removeNode(node.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Remover seção">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={data.title}
          onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Título da seção"
          className="w-full text-xs font-medium text-gray-700 bg-transparent border-0 border-b border-gray-100 pb-1 focus:outline-none focus:border-blue-300 placeholder-gray-300"
        />

        {/* Seção desenhada pelo motor em 1440px e reduzida; o iframe não recebe o mouse, para o nó continuar arrastável */}
        {rendered && (
          <div className="pointer-events-none">
            <PreviewFrame html={rendered.document} viewport="desktop" showSize={false} />
          </div>
        )}

        {unsupported.length > 0 && (
          <p className="text-[10px] text-amber-600">
            O preview não desenha: {unsupported.join(', ')}. No Elementor eles aparecem normalmente.
          </p>
        )}

        {showJson && (
          <textarea
            value={data.elementorJson}
            onChange={(e) => updateNodeData(node.id, { elementorJson: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder='Cole o JSON do Elementor aqui...'
            rows={4}
            className="w-full text-[10px] font-mono text-gray-600 bg-gray-50 rounded-lg border border-gray-100 px-2 py-1.5 focus:outline-none focus:border-blue-300 resize-none placeholder-gray-300"
          />
        )}
        {data.elementorJson && !hasElements && (
          <p className="text-[10px] text-red-400 font-medium">⚠ JSON inválido ou sem elementos do Elementor</p>
        )}
      </div>

      {/* Output port */}
      <div
        className="absolute w-3 h-3 rounded-full bg-blue-400 border-2 border-white shadow-sm cursor-crosshair hover:bg-blue-600 transition-colors z-10"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseDown={handleOutputPortMouseDown}
      />
    </div>
    </>
  )
}
