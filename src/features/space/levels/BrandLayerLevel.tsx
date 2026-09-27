import React, { useMemo } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData } from '@/types/space'
import { useActiveBrand } from '../brand/brandStore'
import { sectionBase, sectionWithTransforms } from '../landingPage'
import { canvasSections, sectionPlace } from '../pages/pages'
import { colorSwaps, elementDiffs, type ColorSwap, type DiffLevel, type ElementDiff } from './brandDiff'
import { SelectionHint } from './SelectionHint'

/**
 * Cores, Tipografia e Forma: o que a marca muda em cada seção, lido da
 * diferença entre a seção sem a marca e com ela. Por enquanto só mostra;
 * a camada vale igual em todas as seções.
 */

const EMPTY: Record<DiffLevel, string> = {
  colors: 'A marca não troca cores nesta seção.',
  typography: 'A marca não mexe na tipografia desta seção.',
  shape: 'A marca não mexe em cantos, bordas nem sombras desta seção.',
}

const Swatch: React.FC<{ color: string | null }> = ({ color }) =>
  color ? (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10" style={{ backgroundColor: color }} />
      <span className="truncate font-mono text-[10px] text-gray-600">{color}</span>
    </span>
  ) : (
    <span className="text-[10px] text-gray-400">nova</span>
  )

const Swaps: React.FC<{ swaps: ColorSwap[] }> = ({ swaps }) => (
  <ul className="space-y-1 px-3 py-2">
    {swaps.map((s) => (
      <li key={`${s.from}>${s.to}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5">
        <Swatch color={s.from} />
        <span className="text-[10px] text-gray-400">→</span>
        <Swatch color={s.to} />
        <span className="text-[10px] tabular-nums text-gray-400">{s.count}×</span>
      </li>
    ))}
  </ul>
)

const Diffs: React.FC<{ diffs: ElementDiff[] }> = ({ diffs }) => (
  <ul className="divide-y divide-gray-50 px-3 py-1">
    {diffs.map((d) => (
      <li key={d.id + d.label} className="py-1.5">
        <p className="truncate text-[11px] font-medium text-gray-800">{d.label}</p>
        {d.changes.map((c) => (
          <p key={`${c.prop}${c.before}${c.after}`} className="text-[11px] leading-snug text-gray-500">
            {c.prop}: <span className="text-gray-400">{c.before}</span>
            <span className="px-1 text-gray-400">→</span>
            <span className="text-gray-900">{c.after}</span>
          </p>
        ))}
      </li>
    ))}
  </ul>
)

export const BrandLayerLevel: React.FC<{ level: DiffLevel }> = ({ level }) => {
  const nodes = useSpaceStore((s) => s.nodes)
  const pages = useSpaceStore((s) => s.pages)
  const connections = useSpaceStore((s) => s.connections)
  const selectedIds = useSpaceStore((s) => s.selectedIds)
  const brand = useActiveBrand()

  const all = canvasSections(pages, nodes)
  const selected = all.filter((s) => selectedIds.includes(s.id))
  const scope = selected.length ? selected : all

  const plan = useMemo(() => {
    if (!brand) return []
    return scope.map((section) => {
      const before = sectionBase(section, nodes, connections) ?? []
      const after = sectionWithTransforms(section, nodes, connections, brand) ?? []
      return {
        section,
        place: sectionPlace(pages, section.id),
        swaps: level === 'colors' ? colorSwaps(before, after) : [],
        diffs: level === 'colors' ? [] : elementDiffs(before, after, level),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, pages, connections, brand, level, selectedIds])

  if (!brand) {
    return (
      <div className="px-4 py-4">
        <SelectionHint>Nenhuma marca aplicada. Importe o DESIGN.md em Marca para ver o que esta camada muda em cada seção.</SelectionHint>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!selected.length && all.length > 0 && <SelectionHint>Mostrando todas as seções. Selecione no canvas para ver só algumas.</SelectionHint>}
        {plan.map(({ section, place, swaps, diffs }) => {
          const count = level === 'colors' ? swaps.reduce((n, s) => n + s.count, 0) : diffs.length
          return (
            <div key={section.id} className="rounded-lg border border-gray-100">
              <p className="flex items-baseline justify-between gap-2 border-b border-gray-100 px-3 py-1.5">
                <span className="truncate text-[11px] font-semibold text-gray-700">
                  {place} · {(section.data as SectionNodeData).title}
                </span>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {level === 'colors' ? `${count} troca${count === 1 ? '' : 's'}` : `${count} peça${count === 1 ? '' : 's'}`}
                </span>
              </p>
              {count === 0 ? (
                <p className="px-3 py-2 text-[11px] text-gray-400">{EMPTY[level]}</p>
              ) : level === 'colors' ? (
                <Swaps swaps={swaps} />
              ) : (
                <Diffs diffs={diffs} />
              )}
            </div>
          )
        })}
      </div>
      <footer className="border-t border-gray-100 px-4 py-3 text-[11px] leading-snug text-gray-500">
        Esta camada vem da marca {brand.name} e vale igual em todas as seções. Ajuste por seção é o próximo passo.
      </footer>
    </>
  )
}
