import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { SpaceCanvas } from '@/features/space/SpaceCanvas'
import { SpaceTopBar } from '@/features/space/SpaceTopBar'
import { CanvasDock } from '@/features/space/CanvasDock'
import { SpaceInspector, SpaceSidebar } from '@/features/space/SpacePanels'
import { useSpaceUi } from '@/features/space/spaceUi'
import { PagePlayer } from '@/features/space/pages/PagePlayer'
import { useSectionShortcuts } from '@/features/space/pages/useSectionShortcuts'
import { LibraryDragChip } from '@/features/space/pages/LibraryDragChip'
import { WordPressImportDialog } from '@/features/wordpress/WordPressImportDialog'
import { WordPressPageDialogs } from '@/features/wordpress/WordPressPageDialogs'
import { useEditorShortcuts } from '@/features/space/editor/useEditorShortcuts'
import { useFrameGestureGuard } from '@/features/space/editor/frames'
import { AgentCursors } from '@/features/space/chat/AgentCursors'
import { useShareAgentCursors } from '@/features/space/presence/shareAgentCursors'
import { useActivityLog } from '@/features/space/history/activity'
import { useNarrow } from '@/features/space/useNarrow'

const NO_INSETS = { left: 0, right: 0 }

/**
 * O projeto aberto, no desenho do Framer: a barra em cima, à esquerda as
 * páginas, as camadas e a Biblioteca, no meio o canvas com todas as páginas
 * lado a lado, e à direita o estilo do que está selecionado. O agente do projeto fica na Iara.
 */
const Space: React.FC = () => {
  const { projectId = '' } = useParams()
  const panels = useSpaceUi((s) => s.panels)
  const drawer = useSpaceUi((s) => s.drawer)
  // No celular os painéis fixos (264 + 320 px) comeriam o canvas inteiro: viram gavetas
  const narrow = useNarrow()
  useSectionShortcuts()
  useEditorShortcuts()
  useFrameGestureGuard()
  // O cursor do meu agente aparece para quem mais está no projeto, e o deles para mim
  useShareAgentCursors()
  // Exclusões vão para o histórico, com a cópia para a lixeira
  useActivityLog()

  // Ctrl+\ esconde os dois painéis e deixa só o canvas, como no Framer e no Figma
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '\\' || !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      useSpaceUi.getState().togglePanels()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f5f5f7]">
      <SpaceTopBar projectId={projectId} />
      <div className="relative flex min-h-0 flex-1">
        {panels && !narrow && <SpaceSidebar />}
        <div data-space-root className="relative min-w-0 flex-1 overflow-hidden">
          <SpaceCanvas />
          {/* O cursor dos agentes por cima do canvas; quem roda o Claude Code ou o Codex é o servidor de dev ou o conector */}
          <AgentCursors insets={NO_INSETS} />
          <CanvasDock />
        </div>
        {panels && !narrow && <SpaceInspector />}
        {narrow && drawer && (
          <>
            <button type="button" aria-label="Fechar o painel" className="absolute inset-0 z-50 bg-black/20" onClick={() => useSpaceUi.getState().setDrawer(null)} />
            {drawer === 'left' ? <SpaceSidebar drawer /> : <SpaceInspector drawer />}
          </>
        )}
      </div>
      <PagePlayer />
      <LibraryDragChip />
      <WordPressImportDialog />
      <WordPressPageDialogs />
    </div>
  )
}

export default Space
