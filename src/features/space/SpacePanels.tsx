import React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StyleTab } from './inspector/StyleTab'
import { LibraryPanel } from './library/LibraryPanel'
import { LayersTree } from './navigator/LayersTree'
import { PagesList } from './pages/PagesList'
import { useSpaceUi, type LeftTab } from './spaceUi'


const SIDEBAR_WIDTH = 264
const INSPECTOR_WIDTH = 320

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

/** Painel da esquerda: as páginas do projeto, as camadas da página ativa e a Biblioteca. */
/** No celular o painel é uma gaveta por cima do canvas, do lado dele, sem passar da tela. */
// Campos com 16 px na gaveta: abaixo disso o iOS dá zoom na tela ao focar (os campos do painel têm 11 px)
const DRAWER_FIELDS = '[&_input]:text-base [&_select]:text-base [&_textarea]:text-base'
const DRAWER_LEFT = `absolute inset-y-0 left-0 z-50 shadow-[0_12px_40px_-8px_rgb(0_0_0/0.25)] ${DRAWER_FIELDS}`
const DRAWER_RIGHT = `absolute inset-y-0 right-0 z-50 shadow-[0_12px_40px_-8px_rgb(0_0_0/0.25)] ${DRAWER_FIELDS}`

/** Fecha a gaveta do celular (o X no canto do painel). */
const DrawerClose: React.FC<{ label: string }> = ({ label }) => (
  <button
    type="button"
    aria-label={label}
    onClick={() => useSpaceUi.getState().setDrawer(null)}
    className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <X className="h-4 w-4" />
  </button>
)

export const SpaceSidebar: React.FC<{ drawer?: boolean }> = ({ drawer }) => {
  const tab = useSpaceUi((s) => s.left)
  const library = useSpaceUi((s) => s.library)
  const { setLeft, setLibrary } = useSpaceUi.getState()
  return (
  <aside
    // Soltar um card da biblioteca aqui desiste do arrasto (ver libraryDrag)
    data-space-library
    aria-label="Páginas, camadas e biblioteca"
    className={cn('flex h-full shrink-0 flex-col border-r border-gray-200 bg-white', drawer ? DRAWER_LEFT : 'relative z-40')}
    style={{ width: drawer ? `min(${SIDEBAR_WIDTH + 40}px, 88vw)` : SIDEBAR_WIDTH }}
    onWheel={(e) => e.stopPropagation()}
  >
    <div className="flex shrink-0 items-center pr-1">
      <Tabs tabs={LEFT_TABS} value={tab} onChange={setLeft} label="Painel da esquerda" />
      {drawer && <DrawerClose label="Fechar o painel" />}
    </div>
    {tab === 'pages' ? <PagesList /> : tab === 'layers' ? <LayersTree /> : <LibraryPanel kind={library} onKind={setLibrary} />}
  </aside>
  )
}

/**
 * O agente do projeto mora na Iara (2026-11-05, o usuário: "a IA de projetos pode ficar imersa na
 * Iara"): o chat do canvas é o chat da Iara, e o painel da direita fica só com o estilo.
 */
/** Painel da direita: o estilo do que está selecionado. */
export const SpaceInspector: React.FC<{ drawer?: boolean }> = ({ drawer }) => {
  return (
  <aside
    aria-label="Estilo"
    className={cn('flex h-full shrink-0 flex-col border-l border-gray-200 bg-white', drawer ? DRAWER_RIGHT : 'relative z-40')}
    style={{ width: drawer ? `min(${INSPECTOR_WIDTH}px, 92vw)` : INSPECTOR_WIDTH }}
    onWheel={(e) => e.stopPropagation()}
  >
    <div className="flex h-11 shrink-0 items-center pl-4 pr-1">
      <p className="text-[13px] font-medium text-gray-900">Estilo</p>
      {drawer && <DrawerClose label="Fechar o estilo" />}
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-gray-100">
      <StyleTab />
    </div>
  </aside>
  )
}
