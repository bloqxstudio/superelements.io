import React, { useState } from 'react'
import {
  Columns3,
  Component as ComponentIcon,
  Film,
  Heading1,
  Image,
  LayoutGrid,
  Minus,
  MousePointerClick,
  MoveVertical,
  Package,
  Pencil,
  Rows3,
  SquarePlus,
  Star,
  Text,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { createElement, isContainer, type InsertKind } from '../editor/tree'
import { addBlankSection, insertBlock, insertComponent, insertKind } from '../editor/actions'
import { COMPONENT_COLOR, COMPONENT_COLOR_STRONG, componentElements, componentUses } from '../components/components'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceComponent } from '@/types/space'
import { startInsertDrag, type InsertItem } from '../editor/insertDrag'
import { useBlocks, type SavedBlock } from '../editor/blocks'
import { INSERT_KEYS } from '../editor/useEditorShortcuts'
import { createBlankSection } from '../editor/tree'

interface ElementEntry {
  kind: InsertKind
  label: string
  hint: string
  icon: LucideIcon
}

const LAYOUT: ElementEntry[] = [
  { kind: 'stack', label: 'Stack', hint: 'Itens um embaixo do outro', icon: Rows3 },
  { kind: 'row', label: 'Linha', hint: 'Itens lado a lado', icon: Columns3 },
  { kind: 'grid', label: 'Grid', hint: 'Colunas e linhas', icon: LayoutGrid },
]

const BASICS: ElementEntry[] = [
  { kind: 'heading', label: 'Título', hint: 'Heading', icon: Heading1 },
  { kind: 'text', label: 'Texto', hint: 'Parágrafo', icon: Text },
  { kind: 'button', label: 'Botão', hint: 'Com link', icon: MousePointerClick },
  { kind: 'image', label: 'Imagem', hint: 'Do computador', icon: Image },
  { kind: 'icon', label: 'Ícone', hint: 'Font Awesome', icon: Star },
  { kind: 'spacer', label: 'Espaço', hint: 'Respiro vertical', icon: MoveVertical },
  { kind: 'divider', label: 'Divisor', hint: 'Linha', icon: Minus },
  { kind: 'video', label: 'Vídeo', hint: 'YouTube', icon: Film },
]

const shortcutOf = (kind: InsertKind) => Object.entries(INSERT_KEYS).find(([, k]) => k === kind)?.[0]?.toUpperCase()

const itemFor = (entry: ElementEntry): InsertItem => ({
  label: entry.label,
  kind: entry.kind === 'stack' || entry.kind === 'row' || entry.kind === 'grid' ? 'container' : 'widget',
  make: () => ({ element: createElement(entry.kind) }),
})

const blankItem: InsertItem = {
  label: 'Seção em branco',
  kind: 'container',
  sectionOnly: true,
  make: () => ({ element: createBlankSection()[0] }),
}

const blockItem = (block: SavedBlock): InsertItem => ({
  label: block.name,
  kind: isContainer(block.element) ? 'container' : 'widget',
  make: () => {
    // A cópia com ids novos sai do próprio insertBlock; aqui só o molde
    const copy = structuredClone(block.element)
    return { element: copy, pinned: block.pinned }
  },
})

/** Um componente do projeto: entra como uso ligado (mudar um muda todos). */
const componentItem = (component: SpaceComponent): InsertItem => {
  const first = componentElements(component)[0]
  return {
    label: component.name,
    kind: component.level === 'section' || isContainer(first) ? 'container' : 'widget',
    sectionOnly: component.level === 'section',
    make: () => ({ element: structuredClone(first) }),
    place: (where) =>
      'sectionId' in where
        ? insertComponent(component.id, { sectionId: where.sectionId, target: where.target })
        : insertComponent(component.id, { sectionId: null, pageId: where.pageId, index: where.index }),
  }
}

const ComponentRow: React.FC<{ component: SpaceComponent; uses: number }> = ({ component, uses }) => {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(component.name)
  return (
    <li className="group flex items-center gap-1 rounded-lg border border-gray-200 bg-white pr-1 transition-[border-color,background-color] hover:border-cyan-300 hover:bg-cyan-50/50">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => {
            useSpaceStore.getState().renameComponent(component.id, name)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setName(component.name)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-xs outline-none focus:shadow-[0_0_0_2px_rgb(8_145_178/0.4)]"
          aria-label="Nome do componente"
        />
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-transform active:scale-[0.96] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          onPointerDown={(e) => startInsertDrag(e, componentItem(component), () => insertComponent(component.id))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              insertComponent(component.id)
            }
          }}
          title={component.level === 'section' ? 'Clique para pôr depois da seção selecionada, ou arraste entre as seções' : 'Clique para pôr na camada selecionada, ou arraste até o canvas'}
        >
          <ComponentIcon className="h-3.5 w-3.5 shrink-0" style={{ color: COMPONENT_COLOR }} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: COMPONENT_COLOR_STRONG }}>
            {component.name}
          </span>
          <span className="shrink-0 text-[10px] text-gray-400 group-hover:hidden">
            {component.role === 'header' ? 'cabeçalho' : component.role === 'footer' ? 'rodapé' : component.level === 'section' ? 'seção' : 'camada'} · {uses}
          </span>
        </button>
      )}
      {!editing && (
        <button
          type="button"
          onClick={() => {
            setName(component.name)
            setEditing(true)
          }}
          className="hidden rounded-md p-1 text-gray-400 transition-colors hover:text-gray-700 focus-visible:block group-hover:block"
          aria-label={`Renomear ${component.name}`}
          title="Renomear"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </li>
  )
}

const tile =
  'group flex cursor-grab select-none flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-left transition-[border-color,background-color,transform] hover:border-gray-300 hover:bg-gray-50 active:scale-[0.96] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'

const Tile: React.FC<{ entry: ElementEntry }> = ({ entry }) => {
  const Icon = entry.icon
  const key = shortcutOf(entry.kind)
  return (
    <button
      type="button"
      className={tile}
      onPointerDown={(e) => startInsertDrag(e, itemFor(entry), () => insertKind(entry.kind))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertKind(entry.kind)
        }
      }}
      title={`Clique para pôr na camada selecionada, ou arraste até o canvas${key ? `. Atalho: ${key}` : ''}`}
    >
      <span className="flex w-full items-center justify-between">
        <Icon className="h-4 w-4 text-gray-500 group-hover:text-violet-600" strokeWidth={1.75} />
        {key && <kbd className="rounded border border-gray-200 px-1 font-sans text-[10px] text-gray-400">{key}</kbd>}
      </span>
      <span className="w-full min-w-0">
        <span className="block text-[12px] font-medium leading-tight text-gray-800">{entry.label}</span>
        <span className="block truncate text-[10px] text-gray-400">{entry.hint}</span>
      </span>
    </button>
  )
}

const BlockRow: React.FC<{ block: SavedBlock }> = ({ block }) => {
  const { rename, remove } = useBlocks.getState()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(block.name)
  return (
    <li className="group flex items-center gap-2 rounded-lg border border-gray-200 bg-white pr-1">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            rename(block.id, name)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setName(block.name)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-xs outline-none focus:shadow-[0_0_0_2px_rgb(124_58_237/0.4)]"
          aria-label="Nome do bloco"
        />
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 px-2.5 py-2 text-left active:cursor-grabbing"
          onPointerDown={(e) => startInsertDrag(e, blockItem(block), () => insertBlock(block))}
          title="Clique para pôr na camada selecionada, ou arraste até o canvas"
        >
          <Package className="h-3.5 w-3.5 shrink-0 text-violet-500" strokeWidth={1.75} />
          <span className="truncate text-xs font-medium text-gray-800">{block.name}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-md p-1 text-gray-300 opacity-0 transition-[color,opacity] hover:text-gray-600 focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={`Renomear ${block.name}`}
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => remove(block.id)}
        className="rounded-md p-1 text-gray-300 opacity-0 transition-[color,opacity] hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={`Apagar ${block.name}`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  )
}

/**
 * Elementos da Biblioteca: os nativos do Elementor para criar dentro das
 * seções, uma seção em branco e os blocos salvos. Clicar
 * põe na camada selecionada (ou numa seção nova); arrastar mostra no canvas
 * onde o elemento entra.
 */
export const ElementsLibrary: React.FC = () => {
  const blocks = useBlocks((s) => s.blocks)
  const components = useSpaceStore((s) => s.components)
  const nodes = useSpaceStore((s) => s.nodes)
  const uses = React.useMemo(() => {
    const count = new Map<string, number>()
    for (const use of componentUses(nodes)) count.set(use.componentId, (count.get(use.componentId) ?? 0) + 1)
    return count
  }, [nodes])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <section aria-labelledby="insert-section">
          <h3 id="insert-section" className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Seção
          </h3>
          <button
            type="button"
            className={`${tile} w-full flex-row items-center`}
            onPointerDown={(e) => startInsertDrag(e, blankItem, () => addBlankSection())}
            title="Clique para pôr no fim da página, ou arraste até o lugar entre duas seções"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-violet-300 bg-violet-50 text-violet-600">
              <SquarePlus className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-gray-800">Seção em branco</span>
              <span className="block text-[10px] text-gray-400">Um container contido, para montar do zero</span>
            </span>
          </button>
        </section>

        <section aria-labelledby="insert-layout">
          <h3 id="insert-layout" className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Layout
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUT.map((entry) => (
              <Tile key={entry.kind} entry={entry} />
            ))}
          </div>
        </section>

        <section aria-labelledby="insert-basics">
          <h3 id="insert-basics" className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Básicos
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {BASICS.map((entry) => (
              <Tile key={entry.kind} entry={entry} />
            ))}
          </div>
        </section>

        {components.length > 0 && (
          <section aria-labelledby="insert-components">
            <h3 id="insert-components" className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Componentes do projeto
            </h3>
            <ul className="space-y-1.5">
              {components.map((component) => (
                <ComponentRow key={component.id} component={component} uses={uses.get(component.id) ?? 0} />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="insert-blocks">
          <h3 id="insert-blocks" className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Meus blocos
          </h3>
          {blocks.length ? (
            <ul className="space-y-1.5">
              {blocks.map((block) => (
                <BlockRow key={block.id} block={block} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-[11px] leading-relaxed text-gray-400">
              Selecione uma camada e use <strong className="font-medium text-gray-500">Salvar como bloco</strong> nas propriedades para reusar aqui.
            </p>
          )}
        </section>

      </div>

      <p className="border-t border-gray-100 px-3 py-2 text-[10px] leading-relaxed text-gray-400">
        Clique para pôr na camada selecionada. Arraste para escolher o lugar no canvas.
      </p>
    </div>
  )
}
