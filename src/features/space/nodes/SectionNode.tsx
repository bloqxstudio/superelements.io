import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react'
import { X, GripVertical, ChevronUp, ChevronDown, Code2, Component } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSpaceStore } from '@/store/spaceStore'
import { widgetName } from '@/engine/elementor'
import { PreviewFrame, type PreviewEditorMessage } from '@/features/elementor-preview/PreviewFrame'
import { parseSectionElements } from '@/features/space/landingPage'
import { useActiveBrand } from '@/features/space/brand/brandStore'
import { useHouseStyleKey } from '@/features/space/brand/usePackBrand'
import { isPackSection } from '@/features/section-pack/categories'
import { useSiteKit } from '@/features/wordpress/siteKitStore'
import { sectionLensDocument } from '@/features/space/levels/lens'
import { sectionMotionLabel } from '@/features/space/levels/motion'
import { pageOf } from '@/features/space/pages/pages'
import { SectionMenu } from '@/features/space/pages/SectionMenu'
import { PART_COLOR, PART_COLOR_STRONG, confirmPartSectionRemoval } from '@/features/space/pages/parts'
import { useSectionDrag } from '@/features/space/pages/useSectionDrag'
import { findElement, updateElementContent } from '@/features/space/navigator/elementorContentEditor'
import { layerKind } from '@/features/space/navigator/navigatorLabels'
import type { BridgeGeometry, BridgeIndicator } from '@/features/elementor-preview/editorBridge'
import { EditorOverlay } from '@/features/space/editor/EditorOverlay'
import { moveElementTo, selectElement } from '@/features/space/editor/actions'
import { registerFrame, resolveHit } from '@/features/space/editor/frames'
import { useInsertDrag } from '@/features/space/editor/insertDrag'
import { useClaudeBridge } from '@/features/space/bridge/bridgeStore'
import { useSectionLoading } from '@/features/space/opening'
import { useSectionHover } from './sectionHover'
import type { SpaceNode, SectionNodeData } from '@/types/space'

interface SectionNodeProps {
  node: SpaceNode
}

/** Preview que não termina de carregar (CDN fora, script preso) aparece assim mesmo depois disso. */
const LOAD_TIMEOUT = 6000

export const SectionNode: React.FC<SectionNodeProps> = ({ node }) => {
  // Só o que a seção desenha: assinar a store inteira redesenharia todas a cada passo do zoom
  const { nodes, connections, pages } = useSpaceStore(useShallow((s) => ({ nodes: s.nodes, connections: s.connections, pages: s.pages })))
  const { updateNodeData, updateNodeSize, removeNode, moveSection, startConnection, completeConnection } = useSpaceStore.getState()
  const editLevel = useSpaceStore((s) => s.editLevel)
  const selected = useSpaceStore((s) => s.selectedIds.includes(node.id))
  const motionDraft = useSpaceStore((s) => s.motionDraft)
  const motionReplay = useSpaceStore((s) => s.motionReplay)
  const selectedElementId = useSpaceStore((s) => (s.navigatorSelection?.sectionId === node.id ? s.navigatorSelection.elementId : undefined))
  const hoveredElementId = useSpaceStore((s) => (s.hoveredElement?.sectionId === node.id ? s.hoveredElement.elementId : undefined))
  const previewDevice = useSpaceStore((s) => s.previewDevice)
  const hovered = useSectionHover((s) => s.id === node.id)
  // Última mudança do agente (Claude ou Codex) pela ponte do dev: a seção fica marcada até a próxima
  const touchedBy = useClaudeBridge((s) => s.touched[node.id])
  const agent = useClaudeBridge((s) => s.touchedBy)
  // O agente mexendo aqui agora, a seção ainda em esqueleto, e a revelação quando ele grava
  const working = useClaudeBridge((s) => s.working[node.id])
  const pending = useClaudeBridge((s) => !!s.pending[node.id])
  const reveals = useClaudeBridge((s) => s.reveals[node.id] ?? 0)
  const [revealing, setRevealing] = useState(false)
  useEffect(() => {
    if (!reveals) return
    setRevealing(true)
    const timer = setTimeout(() => setRevealing(false), 1000)
    return () => clearTimeout(timer)
  }, [reveals])
  const data = node.data as SectionNodeData
  const cardRef = useRef<HTMLDivElement>(null)
  const elements = useMemo(() => parseSectionElements(data.elementorJson), [data.elementorJson])
  const hasElements = !!elements
  const [showJson, setShowJson] = useState(!hasElements)
  // Na Estrutura o preview é o editor: seleção, arrasto, texto direto e alças
  const editing = editLevel === 'structure'
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [geometry, setGeometry] = useState<BridgeGeometry | null>(null)
  const [dragIndicator, setDragIndicator] = useState<BridgeIndicator | null>(null)
  const insertIndicator = useInsertDrag((s) => (s.drop?.sectionId === node.id ? s.drop.target.indicator : null))

  // Texto e paleta conectados entram no preview; a chave muda só quando eles mudam
  const transformKey = JSON.stringify(
    connections
      .filter((c) => c.targetId === node.id)
      .map((c) => [c.type, nodes.find((n) => n.id === c.sourceId)?.data])
  )

  const brand = useActiveBrand()
  // Seção do pack acompanha o estilo das páginas do projeto (ver houseStyle.ts)
  const houseKey = useHouseStyleKey(brand, isPackSection(data.sourceId))
  const siteKit = useSiteKit()

  // No nível Movimento, a seção selecionada já aparece com o rascunho
  const draft = editLevel === 'motion' && selected ? motionDraft ?? undefined : undefined
  const replay = editLevel === 'motion' ? motionReplay : 0

  const rendered = useMemo(() => {
    const { nodes: all, connections: conns } = useSpaceStore.getState()
    const current = all.find((n) => n.id === node.id)
    if (!current) return null
    return sectionLensDocument({ section: current, nodes: all, connections: conns, brand, site: siteKit, level: editLevel, draft, replay })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, data.elementorJson, data.title, data.levels, data.pinned, transformKey, brand, houseKey, siteKit, editLevel, draft, replay])

  // O preview é a única fonte das caixas; fora da Estrutura (ou no JSON) não há o que desenhar
  useEffect(() => {
    if (editing && !showJson) return
    setGeometry(null)
    setDragIndicator(null)
  }, [editing, showJson])

  const mounted = !!rendered && !showJson

  // Até o preview carregar, a seção guarda a altura salva (o preview a reserva até medir o
  // conteúdo) com um esqueleto no lugar: abrir o projeto não faz a coluna pular a cada seção
  const previewRef = useRef<HTMLDivElement>(null)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [reserve, setReserve] = useState<number | null>(null)
  const waiting = mounted && !previewLoaded
  const handleLoaded = useCallback(() => setPreviewLoaded(true), [])
  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(handleLoaded, LOAD_TIMEOUT)
    return () => clearTimeout(timer)
  }, [waiting, handleLoaded])
  useEffect(() => {
    if (waiting) return
    const { markLoaded, forget } = useSectionLoading.getState()
    markLoaded(node.id)
    return () => forget(node.id)
  }, [waiting, node.id])
  useLayoutEffect(() => {
    const card = cardRef.current
    const preview = previewRef.current
    if (!waiting || !card || !preview) return
    // O resto do card (cabeçalho, título, avisos) fica como está; o preview ocupa o que sobra da altura salva
    const space = node.height - preview.offsetTop - (card.clientHeight - (preview.offsetTop + preview.offsetHeight))
    setReserve(space > 0 ? space : null)
    // Uma vez, ao começar a carregar: a altura salva é a do último carregamento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  useEffect(() => {
    const frame = frameRef.current
    if (!editing || !mounted || !frame) return
    return registerFrame(node.id, frame)
  }, [editing, mounted, node.id])

  // Mensagens da ponte do preview; o iframe também roda os widgets HTML da seção, então tudo é conferido
  const handlePreviewEditor = useCallback((message: PreviewEditorMessage) => {
    const text = (value: unknown) => (typeof value === 'string' ? value : '')
    switch (message.type) {
      case 'se-select':
        selectElement(node.id, text(message.elementId) || null)
        return
      case 'se-geometry':
        setGeometry(message.geometry ?? null)
        return
      case 'se-drag':
        setDragIndicator(message.indicator ?? null)
        return
      case 'se-drop':
        if (text(message.elementId) && Number.isInteger(message.index)) {
          moveElementTo(node.id, message.elementId, { parentId: text(message.parentId) || null, index: message.index })
        }
        return
      case 'se-hit-result':
        resolveHit(message.token, message.target ?? null)
        return
      case 'se-inline-edit': {
        const current = useSpaceStore.getState().nodes.find((candidate) => candidate.id === node.id)
        if (!current || current.type !== 'section' || typeof message.value !== 'string') return
        const json = (current.data as SectionNodeData).elementorJson
        const element = findElement(parseSectionElements(json), message.elementId)
        const expectedField = element?.widgetType === 'heading' ? 'title' : element?.widgetType === 'text-editor' ? 'editor' : element?.widgetType === 'button' ? 'text' : null
        if (message.field !== expectedField) return
        const next = updateElementContent(json, message.elementId, { field: message.field, value: message.value })
        if (next && next !== json) updateNodeData(node.id, { elementorJson: next }, { merge: false })
      }
    }
  }, [node.id, updateNodeData])

  const selectedElement = useMemo(() => (selectedElementId ? findElement(elements, selectedElementId) : null), [elements, selectedElementId])
  const labelOf = (id: string | undefined) => {
    const element = id ? findElement(elements, id) : null
    return element && id ? data.navigatorLabels?.[id] || layerKind(element) : ''
  }
  const selectedLabel = labelOf(geometry?.selected?.id)
  const hoverLabel = labelOf(geometry?.hover?.id)
  const indicator = dragIndicator ?? insertIndicator

  const overlay = useCallback(
    (scale: number) => (
      <EditorOverlay
        sectionId={node.id}
        scale={scale}
        geometry={geometry}
        indicator={indicator}
        element={selectedElement}
        label={selectedLabel}
        hoverLabel={hoverLabel}
      />
    ),
    [node.id, geometry, indicator, selectedElement, selectedLabel, hoverLabel]
  )

  const motionLabel = sectionMotionLabel(data.levels?.motion)

  const unsupported = rendered ? Object.keys(rendered.unsupported) : []
  // Seção de página fica presa na coluna dela; sem página, fica solta no canvas
  const page = pageOf(pages, node.id)
  const position = page ? page.sectionIds.indexOf(node.id) : -1

  // Track node height for accurate port positioning; enquanto o preview carrega, vale a altura salva
  useEffect(() => {
    const el = cardRef.current
    if (!el || waiting) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        updateNodeSize(node.id, node.width, entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [node.id, node.width, updateNodeSize, waiting])

  const inPage = !!page
  // Seção do cabeçalho ou do rodapé do site: aparece em todas as páginas, e tem a cor dos componentes
  const component = page?.part
  const remove = () => confirmPartSectionRemoval([node.id]) && removeNode(node.id)
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
  // Dentro de uma página a seção é um pedaço da folha, como no site; solta, é um card
  const sheet = inPage && !showJson

  const preview = rendered && !showJson && (
    <div
      ref={previewRef}
      data-section-preview={node.id}
      className={editing ? 'relative' : 'relative pointer-events-none'}
      onMouseDown={(event) => editing && event.stopPropagation()}
    >
      {waiting && <div aria-hidden className={sheet ? 'absolute inset-0 bg-gray-100 motion-safe:animate-pulse' : 'absolute inset-0 rounded-md bg-gray-100 motion-safe:animate-pulse'} />}
      <div className={pending ? 'se-agent-pending' : working ? 'se-agent-working' : revealing ? 'se-agent-reveal' : undefined}>
        <div className={`transition-opacity duration-300 ease-out motion-reduce:transition-none ${waiting ? 'opacity-0' : 'opacity-100'}`}>
          <PreviewFrame
            html={rendered.document}
            viewport={previewDevice}
            showSize={false}
            interactive={editing}
            selectedElementId={selectedElementId}
            hoveredElementId={hoveredElementId}
            onEditorMessage={handlePreviewEditor}
            frameRef={frameRef}
            overlay={editing ? overlay : undefined}
            onLoaded={handleLoaded}
            placeholderHeight={reserve ?? undefined}
            sheet={sheet}
          />
        </div>
      </div>
      {(pending || working) && (
        <>
          <div aria-hidden className="se-agent-scan" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-gray-800 shadow-sm">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D97757] motion-safe:animate-pulse" />
            {working ? `${working.agent}: ${working.text}` : 'Na fila para construir'}
            <span aria-hidden className="se-agent-dots" />
          </span>
        </>
      )}
    </div>
  )

  const ports = (
    <>
      <div
        className={`absolute z-10 h-3 w-3 cursor-crosshair rounded-full border-2 border-white bg-gray-400 shadow-sm transition-[background-color,opacity] hover:bg-blue-400 ${sheet && !hovered && !selected ? 'opacity-0' : ''}`}
        style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseUp={handleInputPortMouseUp}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div
        className={`absolute z-10 h-3 w-3 cursor-crosshair rounded-full border-2 border-white bg-blue-400 shadow-sm transition-[background-color,opacity] hover:bg-blue-600 ${sheet && !hovered && !selected ? 'opacity-0' : ''}`}
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseDown={handleOutputPortMouseDown}
      />
    </>
  )

  if (sheet) {
    // Contorno e alças no tamanho da tela, qualquer que seja o zoom (--z vem do mundo do canvas)
    const shown = selected || hovered || dragging || !!touchedBy || !!working
    const outline = component
      ? selected
        ? PART_COLOR_STRONG
        : touchedBy || working
          ? '#D97757'
          : PART_COLOR
      : selected
        ? '#7c3aed'
        : touchedBy || working
          ? '#D97757'
          : '#8b5cf6'
    return (
      <>
        {lifted && (
          <div
            aria-hidden
            className="pointer-events-none absolute bg-violet-50/70"
            style={{ left: node.x, top: node.y, width: node.width, height: node.height, boxShadow: 'inset 0 0 0 calc(1.5px / var(--z, 1)) #c4b5fd' }}
          />
        )}
        <div
          ref={cardRef}
          data-section-id={node.id}
          onTransitionEnd={(e) => e.propertyName === 'transform' && onSettled()}
          // O movimento de dentro do iframe chega aqui repassado pela ponte do preview
          onPointerMove={() => useSectionHover.getState().set(node.id)}
          onPointerLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && useSectionHover.getState().id === node.id && useSectionHover.getState().set(null)}
          className={`absolute bg-white ${dragging ? 'shadow-2xl' : ''}`}
          style={{
            left: node.x,
            top: node.y,
            width: node.width,
            userSelect: 'none',
            transform: lifted ? `translate(${lift.dx}px, ${lift.dy}px) rotate(0.6deg)` : undefined,
            transition: settling ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 150ms' : undefined,
            zIndex: dragging || settling ? 10 : selected ? 2 : undefined,
            opacity: dragging ? 0.94 : undefined,
          }}
        >
          {preview}
          {unsupported.length > 0 && (
            <p className="bg-amber-50 px-2 py-1 text-[10px] text-amber-700">O Space não desenha: {unsupported.map(widgetName).join(', ')}. No site eles aparecem normalmente.</p>
          )}
          {data.elementorJson && !hasElements && <p className="bg-red-50 px-2 py-1 text-[10px] font-medium text-red-500">JSON inválido ou sem elementos do Elementor</p>}

          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 z-[5] transition-opacity duration-150 ${shown ? 'opacity-100' : 'opacity-0'}`}
            style={{ boxShadow: `inset 0 0 0 calc(${selected ? 2 : 1.5}px / var(--z, 1)) ${outline}` }}
          />

          {/* Alça com o nome: arrastar leva a seção, clicar seleciona */}
          <div
            className={`absolute left-0 top-0 z-10 flex origin-top-left items-center gap-1 rounded-br-md py-0.5 pl-1 pr-2 text-[11px] font-medium text-white transition-opacity duration-150 ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            // Cabe ao lado da barrinha da direita: a largura da seção na tela menos a barrinha
            style={{ transform: 'scale(calc(1 / var(--z, 1)))', background: outline, maxWidth: 'max(64px, calc(100% * var(--z, 1) - 172px))' }}
            onMouseDown={handleDragStart}
            title="Arraste para mudar de lugar; clique para selecionar"
          >
            <GripVertical className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            {component ? <Component className="h-3 w-3 shrink-0" aria-label="Componente" /> : <span className="shrink-0 tabular-nums opacity-70">{position + 1}</span>}
            <span className="truncate">{data.title || 'Seção sem nome'}</span>
            {touchedBy && <span className="shrink-0 opacity-80">· {agent} {touchedBy === 'created' ? 'criou' : 'mudou'}</span>}
            {motionLabel && <span className="shrink-0 opacity-80">· {motionLabel}</span>}
          </div>

          <div
            className={`absolute right-0 top-0 z-10 flex origin-top-right items-center gap-0.5 rounded-bl-md bg-white/95 p-0.5 shadow-sm ring-1 ring-black/5 transition-opacity duration-150 ${selected || hovered ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            style={{ transform: 'scale(calc(1 / var(--z, 1)))' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SheetButton label="Subir na página" disabled={position <= 0} onClick={() => moveSection(node.id, -1)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </SheetButton>
            <SheetButton label="Descer na página" disabled={!page || position >= page.sectionIds.length - 1} onClick={() => moveSection(node.id, 1)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </SheetButton>
            <SectionMenu sectionId={node.id} className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" />
            <SheetButton label="Ver código da seção" onClick={() => setShowJson(true)}>
              <Code2 className="h-3.5 w-3.5" />
            </SheetButton>
            <SheetButton label="Remover seção" danger onClick={remove}>
              <X className="h-3.5 w-3.5" />
            </SheetButton>
          </div>
          {ports}
        </div>
      </>
    )
  }

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
      data-section-id={node.id}
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
      className={`rounded-xl border bg-white transition-shadow ${dragging ? 'shadow-2xl' : 'shadow-md'} ${selected ? 'border-violet-500 ring-2 ring-violet-500/70 ring-offset-2 ring-offset-[#f4f4f5]' : touchedBy ? 'border-[#D97757] ring-2 ring-[#D97757]/40 ring-offset-2 ring-offset-[#f4f4f5]' : 'border-gray-200'}`}
    >
      {dragging && (lift?.copy || lift?.loose) && (
        <span className="pointer-events-none absolute -top-3 left-3 z-20 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          {lift.copy ? (lift.loose ? '+ Cópia solta no canvas' : '+ Cópia') : 'Fica solta no canvas'}
        </span>
      )}

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
          {touchedBy && (
            <span className="rounded bg-[#D97757]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#A94E2F]" title={`Última mudança do ${agent}; Ctrl+Z desfaz`}>
              {agent} {touchedBy === 'created' ? 'criou' : 'mudou'}
            </span>
          )}
          {motionLabel && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700" title="Movimento aplicado nesta seção">
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
            title={showJson ? 'Voltar ao visual' : 'Ver código da seção'}
            onClick={() => setShowJson((v) => !v)}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={remove} className="text-gray-300 hover:text-red-400 transition-colors" title="Remover seção">
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

        {/* Seção desenhada pelo motor na largura da tela escolhida e reduzida; o iframe recebe o mouse para editar */}
        {preview}

        {unsupported.length > 0 && (
          <p className="text-[10px] text-amber-600">
            O Space não desenha: {unsupported.map(widgetName).join(', ')}. No site eles aparecem normalmente.
          </p>
        )}

        {showJson && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-[#111318]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">JSON da seção</span>
              <span className="text-[10px] text-gray-500">Fonte nativa do Elementor</span>
            </div>
            <textarea
              value={data.elementorJson}
              onChange={(e) => updateNodeData(node.id, { elementorJson: e.target.value })}
              placeholder='Cole o JSON do Elementor aqui...'
              rows={16}
              spellCheck={false}
              className="block w-full resize-y bg-transparent px-3 py-3 font-mono text-[11px] leading-relaxed text-gray-300 outline-none placeholder:text-gray-600"
            />
          </div>
        )}
        {data.elementorJson && !hasElements && (
          <p className="text-[10px] text-red-400 font-medium">⚠ JSON inválido ou sem elementos do Elementor</p>
        )}
      </div>

      {ports}
    </div>
    </>
  )
}

/** Botão da barrinha da seção na folha da página. */
const SheetButton: React.FC<{ label: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, disabled, danger, onClick, children }) => (
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
