import React, { useEffect, useState } from 'react'
import { SpaceCanvas } from '@/features/space/SpaceCanvas'
import { SpaceToolbar } from '@/features/space/SpaceToolbar'
import { MIN_FREE_WIDTH, SpaceCanvasBar } from '@/features/space/SpaceCanvasBar'
import { LIBRARY_PANEL_WIDTH, SpaceLibraryPanel } from '@/features/space/SpaceLibraryPanel'
import { LEVEL_PANEL_WIDTH, LevelPanel } from '@/features/space/levels/LevelPanel'
import { LandingTemplateDialog } from '@/features/space/LandingTemplateDialog'
import { PagePlayer } from '@/features/space/pages/PagePlayer'
import { useSectionShortcuts } from '@/features/space/pages/useSectionShortcuts'
import { LibraryDragChip } from '@/features/space/pages/LibraryDragChip'
import { copyLandingToElementor } from '@/features/space/exportLanding'
import { hasSectionPack } from '@/features/section-pack/pack'
import { WordPressImportDialog } from '@/features/wordpress/WordPressImportDialog'
import { WordPressPageDialogs } from '@/features/wordpress/WordPressPageDialogs'
import { useSpaceStore } from '@/store/spaceStore'

// Visualizar e Copiar da barra agem sobre a página ativa
const copyPage = () => copyLandingToElementor()
const playActivePage = () => {
  const { activePageId, openPlayer } = useSpaceStore.getState()
  if (activePageId) openPlayer(activePageId)
}

/** Margem de cada painel lateral somada à largura dele. */
const PANEL_GUTTER = 24

const Space: React.FC = () => {
  const [libraryOpen, setLibraryOpen] = useState(hasSectionPack)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const editLevel = useSpaceStore((s) => s.editLevel)
  useSectionShortcuts()

  // Numa tela estreita a biblioteca e o painel do nível não cabem juntos com o canvas:
  // abrir um nível fecha a biblioteca, que o botão da barra abre de novo
  useEffect(() => {
    if (editLevel === 'structure') return
    const { width } = useSpaceStore.getState().viewport
    if (width - LIBRARY_PANEL_WIDTH - LEVEL_PANEL_WIDTH - PANEL_GUTTER * 2 < MIN_FREE_WIDTH) setLibraryOpen(false)
  }, [editLevel])

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
      <SpaceToolbar
        libraryOpen={libraryOpen}
        onToggleLibrary={() => setLibraryOpen((open) => !open)}
        onPreview={playActivePage}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onCopy={copyPage}
      />
      {libraryOpen && <SpaceLibraryPanel onClose={() => setLibraryOpen(false)} />}
      <SpaceCanvas />
      <LevelPanel />
      <SpaceCanvasBar libraryOpen={libraryOpen} />
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
