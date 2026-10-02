import React, { useEffect, useState } from 'react'
import { SpaceCanvas } from '@/features/space/SpaceCanvas'
import { SpaceToolbar } from '@/features/space/SpaceToolbar'
import { MIN_FREE_WIDTH, SpaceCanvasBar } from '@/features/space/SpaceCanvasBar'
import { LIBRARY_PANEL_WIDTH, SpaceLibraryPanel } from '@/features/space/SpaceLibraryPanel'
import { LEVEL_PANEL_WIDTH, LevelPanel } from '@/features/space/levels/LevelPanel'
import { ElementorNavigatorPanel, NAVIGATOR_PANEL_WIDTH } from '@/features/space/navigator/ElementorNavigatorPanel'
import { LandingTemplateDialog } from '@/features/space/LandingTemplateDialog'
import { PagePlayer } from '@/features/space/pages/PagePlayer'
import { useSectionShortcuts } from '@/features/space/pages/useSectionShortcuts'
import { LibraryDragChip } from '@/features/space/pages/LibraryDragChip'
import { copyLandingToElementor } from '@/features/space/exportLanding'
import { WordPressImportDialog } from '@/features/wordpress/WordPressImportDialog'
import { WordPressPageDialogs } from '@/features/wordpress/WordPressPageDialogs'
import { InsertPanel } from '@/features/space/editor/InsertPanel'
import { useEditorShortcuts } from '@/features/space/editor/useEditorShortcuts'
import { useFrameGestureGuard } from '@/features/space/editor/frames'
import { ClaudePanel } from '@/features/space/bridge/ClaudePanel'
import { useSpaceStore } from '@/store/spaceStore'

// Visualizar e Copiar da barra agem sobre a página ativa
const copyPage = () => copyLandingToElementor()
const playActivePage = () => {
  const { activePageId, openPlayer } = useSpaceStore.getState()
  if (activePageId) openPlayer(activePageId)
}

/** Margem de cada painel lateral somada à largura dele. */
const PANEL_GUTTER = 24

/** Painel da esquerda: seções prontas da biblioteca ou elementos para criar. Um de cada vez. */
type LeftPanel = 'library' | 'insert' | null

const Space: React.FC = () => {
  const [leftPanel, setLeftPanel] = useState<LeftPanel>('library')
  const libraryOpen = leftPanel !== null
  const togglePanel = (panel: Exclude<LeftPanel, null>) => setLeftPanel((open) => (open === panel ? null : panel))
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const editLevel = useSpaceStore((s) => s.editLevel)
  const navigatorSelection = useSpaceStore((s) => s.navigatorSelection)
  useSectionShortcuts()
  useEditorShortcuts()
  useFrameGestureGuard()

  // Numa tela estreita a biblioteca e o painel do nível não cabem juntos com o canvas:
  // abrir um nível fecha a biblioteca, que o botão da barra abre de novo
  useEffect(() => {
    if (editLevel === 'structure') return
    const { width } = useSpaceStore.getState().viewport
    if (width - LIBRARY_PANEL_WIDTH - LEVEL_PANEL_WIDTH - PANEL_GUTTER * 2 < MIN_FREE_WIDTH) setLeftPanel(null)
  }, [editLevel])

  // Navigator pertence a Estrutura. Outros níveis usam o mesmo lado direito para seus controles.
  useEffect(() => {
    if (editLevel !== 'structure') setNavigatorOpen(false)
  }, [editLevel])

  // Clicar num widget dentro do preview abre o inspetor correspondente.
  useEffect(() => {
    if (editLevel === 'structure' && navigatorSelection) setNavigatorOpen(true)
  }, [editLevel, navigatorSelection])

  const toggleNavigator = () => {
    const opening = !navigatorOpen
    if (opening) {
      useSpaceStore.getState().setEditLevel('structure')
      const { width } = useSpaceStore.getState().viewport
      if (width - LIBRARY_PANEL_WIDTH - NAVIGATOR_PANEL_WIDTH - PANEL_GUTTER * 2 < MIN_FREE_WIDTH) setLeftPanel(null)
    }
    setNavigatorOpen(opening)
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
      <SpaceToolbar
        libraryOpen={leftPanel === 'library'}
        insertOpen={leftPanel === 'insert'}
        navigatorOpen={navigatorOpen}
        onToggleLibrary={() => togglePanel('library')}
        onToggleInsert={() => togglePanel('insert')}
        onToggleNavigator={toggleNavigator}
        onPreview={playActivePage}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onCopy={copyPage}
      />
      {leftPanel === 'library' && <SpaceLibraryPanel onClose={() => setLeftPanel(null)} />}
      {leftPanel === 'insert' && <InsertPanel onClose={() => setLeftPanel(null)} />}
      <SpaceCanvas />
      <LevelPanel />
      {navigatorOpen && editLevel === 'structure' && <ElementorNavigatorPanel onClose={() => setNavigatorOpen(false)} />}
      <SpaceCanvasBar libraryOpen={libraryOpen} navigatorOpen={navigatorOpen} />
      {import.meta.env.DEV && (
        <ClaudePanel rightInset={editLevel !== 'structure' || navigatorOpen ? Math.max(LEVEL_PANEL_WIDTH, NAVIGATOR_PANEL_WIDTH) + 12 : 0} />
      )}
      <PagePlayer />
      <LibraryDragChip />
      <LandingTemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onLoaded={(pageId) => useSpaceStore.getState().openPlayer(pageId)}
      />
      <WordPressImportDialog />
      <WordPressPageDialogs />
    </div>
  )
}

export default Space
