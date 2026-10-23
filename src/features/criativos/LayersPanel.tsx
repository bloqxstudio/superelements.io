import React, { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronRight, Circle, Eye, EyeOff, Folder, Grid3x3, Group, ImageIcon, Lock, Square, Trash2, Type, Ungroup, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { groupLayers, patchLayerFields, removeLayers, reorderLayers, stackLayers, ungroupLayers, withGroups } from './layerOps'
import { currentSlide, useEditor } from './store'
import type { Layer } from './types'

/**
 * As camadas do slide escolhido, de cima (na frente) para baixo (atrás), como
 * no Canva: escolher (Shift ou ⌘ junta), renomear com dois cliques, esconder,
 * travar, arrastar para mudar a ordem, agrupar e desagrupar.
 */

const ICON: Record<Layer['type'], React.ComponentType<{ className?: string }>> = { text: Type, image: ImageIcon, rect: Square, ring: Circle, dots: Grid3x3 }

type Row = { kind: 'layer'; layer: Layer; indent: boolean } | { kind: 'group'; id: string; members: Layer[] }

export const LayersPanel: React.FC = () => {
  const slide = useEditor(currentSlide)
  const layerIds = useEditor((s) => s.layerIds)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ ids: string[]; over?: { id: string; after: boolean } } | null>(null)

  // De cima para baixo: o fim da lista é o que está na frente
  const rows = useMemo<Row[]>(() => {
    const layers = [...(slide?.layers ?? [])].reverse()
    const out: Row[] = []
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i]
      if (!l.group) {
        out.push({ kind: 'layer', layer: l, indent: false })
        continue
      }
      const members = layers.filter((x) => x.group === l.group)
      if (out.some((r) => r.kind === 'group' && r.id === l.group)) continue
      out.push({ kind: 'group', id: l.group, members })
      if (!collapsed.has(l.group)) for (const m of members) out.push({ kind: 'layer', layer: m, indent: true })
    }
    return out
  }, [slide?.layers, collapsed])

  if (!slide) return <p className="p-3 text-sm text-gray-500">Escolha um slide para ver as camadas.</p>

  const all = slide.layers
  const pick = (e: React.MouseEvent, ids: string[]) => {
    const st = useEditor.getState()
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const has = ids.every((id) => st.layerIds.includes(id))
      st.selectLayers(has ? st.layerIds.filter((id) => !ids.includes(id)) : [...new Set([...st.layerIds, ...ids])])
    } else st.selectLayers(ids)
  }

  const hasGroup = all.some((l) => layerIds.includes(l.id) && l.group)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Agrupar (Ctrl+G)" disabled={layerIds.length < 2} onClick={() => groupLayers(layerIds)}><Group className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Desagrupar (Ctrl+Shift+G)" disabled={!hasGroup} onClick={() => ungroupLayers(layerIds)}><Ungroup className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Trazer para a frente" disabled={!layerIds.length} onClick={() => stackLayers(layerIds, 'front')}><ArrowUpToLine className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Enviar para trás" disabled={!layerIds.length} onClick={() => stackLayers(layerIds, 'back')}><ArrowDownToLine className="h-4 w-4" /></Button>
        <span className="ml-auto text-[11px] text-gray-500">{layerIds.length ? `${layerIds.length} escolhido${layerIds.length > 1 ? 's' : ''}` : `${all.length} camadas`}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Excluir (Delete)" disabled={!layerIds.length} onClick={() => removeLayers(layerIds)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" data-scroll onDragLeave={() => setDrag((d) => (d ? { ...d, over: undefined } : d))}>
        {rows.length === 0 && <p className="p-2 text-sm text-gray-500">Este slide ainda não tem camadas.</p>}
        {rows.map((row) => {
          if (row.kind === 'group') {
            const ids = row.members.map((m) => m.id)
            const selected = ids.every((id) => layerIds.includes(id))
            const open = !collapsed.has(row.id)
            const allHidden = row.members.every((m) => m.hidden)
            const allLocked = row.members.every((m) => m.locked)
            return (
              <div key={`g-${row.id}`} className={cn('group flex h-8 items-center gap-1 rounded-md px-1 text-sm', selected ? 'bg-violet-100 text-violet-900' : 'text-gray-800 hover:bg-gray-100')} onClick={(e) => pick(e, ids)}>
                <button type="button" aria-label={open ? 'Recolher o grupo' : 'Abrir o grupo'} className="flex h-5 w-5 items-center justify-center text-gray-500" onClick={(e) => { e.stopPropagation(); setCollapsed((c) => { const n = new Set(c); if (n.has(row.id)) n.delete(row.id); else n.add(row.id); return n }) }}>
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <Folder className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                <span className="min-w-0 flex-1 truncate font-medium">Grupo · {row.members.length}</span>
                <button type="button" title={allHidden ? 'Mostrar o grupo' : 'Esconder o grupo'} className={cn('h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-white', allHidden ? 'flex' : 'hidden group-hover:flex')} onClick={(e) => { e.stopPropagation(); patchLayerFields(ids, { hidden: !allHidden } as Partial<Layer>) }}>{allHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                <button type="button" title={allLocked ? 'Destravar o grupo' : 'Travar o grupo'} className={cn('h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-white', allLocked ? 'flex' : 'hidden group-hover:flex')} onClick={(e) => { e.stopPropagation(); patchLayerFields(ids, { locked: !allLocked } as Partial<Layer>) }}>{allLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button>
              </div>
            )
          }
          const { layer, indent } = row
          const Icon = ICON[layer.type]
          const selected = layerIds.includes(layer.id)
          const over = drag?.over?.id === layer.id ? drag.over : undefined
          return (
            <div
              key={layer.id}
              draggable={renaming !== layer.id}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', layer.id)
                setDrag({ ids: selected ? layerIds : [layer.id] })
              }}
              onDragOver={(e) => {
                if (!drag) return
                e.preventDefault()
                const r = e.currentTarget.getBoundingClientRect()
                // Metade de cima: acima da camada (na frente dela)
                setDrag({ ...drag, over: { id: layer.id, after: e.clientY < r.top + r.height / 2 } })
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (drag?.over) reorderLayers(drag.ids, drag.over.id, drag.over.after)
                setDrag(null)
              }}
              onDragEnd={() => setDrag(null)}
              onClick={(e) => pick(e, e.altKey ? [layer.id] : withGroups(all, [layer.id]))}
              className={cn('group relative flex h-8 items-center gap-1.5 rounded-md pr-1 text-sm', indent ? 'pl-7' : 'pl-2', selected ? 'bg-violet-100 text-violet-900' : 'text-gray-800 hover:bg-gray-100', layer.hidden && 'opacity-50')}
            >
              {over && <span className={cn('pointer-events-none absolute left-1 right-1 h-0.5 rounded bg-violet-500', over.after ? '-top-px' : '-bottom-px')} />}
              <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              {renaming === layer.id ? (
                <input
                  autoFocus
                  defaultValue={layer.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    patchLayerFields([layer.id], { name: e.target.value.trim() || layer.name } as Partial<Layer>)
                    setRenaming(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                    e.stopPropagation()
                  }}
                  className="h-6 min-w-0 flex-1 rounded border border-violet-300 bg-white px-1 text-sm"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); setRenaming(layer.id) }} title={layer.type === 'text' ? layer.text : layer.name}>
                  {layer.type === 'text' ? layer.text.replace(/\*/g, '').slice(0, 40) || layer.name : layer.name}
                </span>
              )}
              <button type="button" title={layer.hidden ? 'Mostrar' : 'Esconder'} className={cn('h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-white', layer.hidden ? 'flex' : 'hidden group-hover:flex')} onClick={(e) => { e.stopPropagation(); patchLayerFields([layer.id], { hidden: !layer.hidden } as Partial<Layer>) }}>{layer.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
              <button type="button" title={layer.locked ? 'Destravar' : 'Travar: não se escolhe nem se arrasta no canvas'} className={cn('h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-white', layer.locked ? 'flex' : 'hidden group-hover:flex')} onClick={(e) => { e.stopPropagation(); patchLayerFields([layer.id], { locked: !layer.locked } as Partial<Layer>) }}>{layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
