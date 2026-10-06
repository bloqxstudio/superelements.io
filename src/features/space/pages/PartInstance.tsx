import React, { useMemo, useState } from 'react'
import { Component, EyeOff, PenLine } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSpaceStore } from '@/store/spaceStore'
import { PreviewFrame } from '@/features/elementor-preview/PreviewFrame'
import { useActiveBrand } from '@/features/space/brand/brandStore'
import { useHouseStyleKey } from '@/features/space/brand/usePackBrand'
import { isPackSection } from '@/features/section-pack/categories'
import { useSiteKit } from '@/features/wordpress/siteKitStore'
import { sectionLensDocument } from '@/features/space/levels/lens'
import type { SectionNodeData, SpaceNode, SpacePage } from '@/types/space'
import { PART_COLOR, PART_COLOR_STRONG, PART_LABEL } from './parts'

/** Uma seção do componente, desenhada como na folha dele; aqui ela não se edita. */
export const InstanceSection: React.FC<{ node: SpaceNode }> = ({ node }) => {
  const data = node.data as SectionNodeData
  const { nodes, connections } = useSpaceStore(useShallow((s) => ({ nodes: s.nodes, connections: s.connections })))
  const device = useSpaceStore((s) => s.previewDevice)
  const brand = useActiveBrand()
  const houseKey = useHouseStyleKey(brand, isPackSection(data.sourceId))
  const siteKit = useSiteKit()
  // Texto e paleta ligados à seção entram no desenho, como na folha do componente
  const transformKey = JSON.stringify(connections.filter((c) => c.targetId === node.id).map((c) => [c.type, nodes.find((n) => n.id === c.sourceId)?.data]))

  const rendered = useMemo(() => {
    const { nodes: all, connections: conns } = useSpaceStore.getState()
    const current = all.find((n) => n.id === node.id)
    return current ? sectionLensDocument({ section: current, nodes: all, connections: conns, brand, site: siteKit, level: 'structure' }) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, data.elementorJson, data.title, data.levels, data.pinned, transformKey, brand, houseKey, siteKit])

  return (
    // A altura é a da seção na folha do componente: a coluna da página foi montada com ela
    <div className="overflow-hidden bg-white" style={{ height: node.height }}>
      {rendered && <PreviewFrame html={rendered.document} viewport={device} showSize={false} interactive={false} placeholderHeight={node.height} sheet />}
    </div>
  )
}

interface PartInstanceProps {
  /** A página que mostra o componente. */
  page: SpacePage
  /** A folha do componente (cabeçalho ou rodapé do site). */
  part: SpacePage
  sections: SpaceNode[]
  /** Distância do topo do quadro da página, em px do mundo. */
  top: number
  height: number
}

/**
 * O cabeçalho (ou o rodapé) do site dentro de uma página: o mesmo conteúdo da
 * folha do componente, não uma cópia. Fica marcado em ciano o tempo todo
 * (barra e losango ao lado da folha) para não ser confundido com uma seção
 * da página; clicar escolhe o componente e clicar duas vezes leva até ele.
 */
export const PartInstance: React.FC<PartInstanceProps> = ({ page, part, sections, top, height }) => {
  const kind = part.part!.kind
  const label = PART_LABEL[kind]
  const selected = useSpaceStore((s) => part.sectionIds.some((id) => s.selectedIds.includes(id)))
  const [hovered, setHovered] = useState(false)
  const shown = hovered || selected

  const select = () => {
    const store = useSpaceStore.getState()
    store.setActivePage(page.id)
    store.setSelection(part.sectionIds)
  }
  const openPart = () => {
    const store = useSpaceStore.getState()
    store.focusPage(part.id)
    store.setSelection(part.sectionIds)
  }

  return (
    <div
      data-part-instance={part.id}
      className="pointer-events-auto absolute inset-x-0"
      style={{ top, height }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* O preview não recebe o mouse: aqui o componente só se mostra */}
      <div className="pointer-events-none">
        {sections.map((node) => (
          <InstanceSection key={node.id} node={node} />
        ))}
      </div>

      {/* Sempre à vista, fora da folha: a barra e o losango do componente */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 rounded-full"
        style={{ left: 'calc(-9px / var(--z, 1))', width: 'calc(3px / var(--z, 1))', background: PART_COLOR }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 flex h-5 w-5 origin-top-right items-center justify-center rounded-md text-white shadow-sm"
        style={{ right: 'calc(100% + 14px / var(--z, 1))', transform: 'scale(calc(1 / var(--z, 1)))', background: PART_COLOR }}
        title={label}
      >
        <Component className="h-3 w-3" />
      </div>

      {/* Por cima do preview: o clique escolhe o componente; o contorno e o rótulo aparecem com o mouse */}
      <button
        type="button"
        aria-label={`${label} (componente). Clique para escolher, clique duas vezes para editar`}
        className="absolute inset-0 z-[5] block w-full cursor-pointer transition-colors duration-150 focus-visible:outline-none"
        style={{
          background: shown ? 'rgb(8 145 178 / 0.05)' : 'transparent',
          boxShadow: shown ? `inset 0 0 0 calc(${selected ? 2 : 1.5}px / var(--z, 1)) ${selected ? PART_COLOR_STRONG : PART_COLOR}` : undefined,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={select}
        onDoubleClick={openPart}
      />

      <div
        className={`pointer-events-none absolute left-0 top-0 z-10 flex origin-top-left items-center gap-1 rounded-br-md py-0.5 pl-1.5 pr-2 text-[11px] font-medium text-white transition-opacity duration-150 ${shown ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: 'scale(calc(1 / var(--z, 1)))', background: selected ? PART_COLOR_STRONG : PART_COLOR }}
      >
        <Component className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        <span className="shrink-0 opacity-75">· componente</span>
      </div>

      <div
        className={`absolute right-0 top-0 z-10 flex origin-top-right items-center gap-0.5 rounded-bl-md bg-white/95 p-0.5 shadow-sm ring-1 ring-black/5 transition-opacity duration-150 ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ transform: 'scale(calc(1 / var(--z, 1)))' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={openPart}
          className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium transition-colors hover:bg-cyan-50"
          style={{ color: PART_COLOR_STRONG }}
          title={`Leva até a folha do ${label.toLowerCase()}: o que mudar lá muda em todas as páginas`}
        >
          <PenLine className="h-3.5 w-3.5" /> Editar componente
        </button>
        <button
          type="button"
          aria-label={`Tirar o ${label.toLowerCase()} desta página`}
          title={`Tirar desta página (o ${label.toLowerCase()} continua nas outras)`}
          onClick={() => useSpaceStore.getState().setPartShown(part.id, page.id, false)}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

