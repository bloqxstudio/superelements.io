import React from 'react'
import { cn } from '@/lib/utils'
import { ClaudePanel } from './bridge/ClaudePanel'
import { SpaceChat } from './chat/SpaceChat'
import { StyleTab } from './inspector/StyleTab'
import { LibraryPanel } from './library/LibraryPanel'
import { LayersTree } from './navigator/LayersTree'
import { PagesList } from './pages/PagesList'
import { useSpaceUi, type LeftTab, type RightTab } from './spaceUi'

export const SIDEBAR_WIDTH = 264
export const INSPECTOR_WIDTH = 320

/** Abas no topo dos painéis, como as do Framer: a escolhida fica num fundo cinza. */
function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 items-center gap-0.5 px-2 pb-1 pt-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'h-8 rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === tab.id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

const LEFT_TABS: { id: LeftTab; label: string }[] = [
  { id: 'pages', label: 'Páginas' },
  { id: 'layers', label: 'Camadas' },
  { id: 'library', label: 'Biblioteca' },
]

const RIGHT_TABS: { id: RightTab; label: string }[] = [
  { id: 'agent', label: 'Agente' },
  { id: 'style', label: 'Estilo' },
]

/** Painel da esquerda: as páginas do projeto, as camadas da página ativa e a Biblioteca. */
export const SpaceSidebar: React.FC = () => {
  const tab = useSpaceUi((s) => s.left)
  const library = useSpaceUi((s) => s.library)
  const { setLeft, setLibrary } = useSpaceUi.getState()
  return (
  <aside
    // Soltar um card da biblioteca aqui desiste do arrasto (ver libraryDrag)
    data-space-library
    aria-label="Páginas, camadas e biblioteca"
    className="relative z-40 flex h-full shrink-0 flex-col border-r border-gray-200 bg-white"
    style={{ width: SIDEBAR_WIDTH }}
    onWheel={(e) => e.stopPropagation()}
  >
    <Tabs tabs={LEFT_TABS} value={tab} onChange={setLeft} label="Painel da esquerda" />
    {tab === 'pages' ? <PagesList /> : tab === 'layers' ? <LayersTree /> : <LibraryPanel kind={library} onKind={setLibrary} />}
  </aside>
  )
}

/** Painel da direita: o agente (chat) e o estilo do que está selecionado. */
export const SpaceInspector: React.FC = () => {
  const tab = useSpaceUi((s) => s.right)
  const onTab = useSpaceUi((s) => s.setRight)
  return (
  <aside
    aria-label="Agente e estilo"
    className="relative z-40 flex h-full shrink-0 flex-col border-l border-gray-200 bg-white"
    style={{ width: INSPECTOR_WIDTH }}
    onWheel={(e) => e.stopPropagation()}
  >
    <Tabs tabs={RIGHT_TABS} value={tab} onChange={onTab} label="Painel da direita" />
    {tab === 'agent' ? (
      <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100">
        <ClaudePanel inline />
        <SpaceChat />
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-gray-100">
        <StyleTab />
      </div>
    )}
  </aside>
  )
}
