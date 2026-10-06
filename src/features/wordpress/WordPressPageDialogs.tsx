import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import { PartPublishPanel } from './PartPublishPanel'
import { DetailsPanel } from './PageDetailsDialog'
import { useWordPressUi } from './uiStore'
import { PublishPanel } from './WordPressPublishDialog'

/**
 * Publicar, detalhes da página e editor da imagem destacada num diálogo só,
 * que troca de conteúdo. Fechar volta um passo: do editor para os detalhes,
 * dos detalhes para o publicar (quando vieram dele) e então fecha.
 */
export const WordPressPageDialogs: React.FC = () => {
  const publishPageId = useWordPressUi((s) => s.publishPageId)
  const detailsPageId = useWordPressUi((s) => s.detailsPageId)
  const editing = useWordPressUi((s) => s.editingFeatured)
  const back = useWordPressUi((s) => s.back)
  // A folha do cabeçalho (ou do rodapé) do site publica como modelo do Theme Builder
  const part = useSpaceStore((s) => !!s.pages.find((p) => p.id === publishPageId)?.part)
  const view = detailsPageId ? (editing ? 'editor' : 'details') : publishPageId ? (part ? 'part' : 'publish') : null

  return (
    <Dialog open={!!view} onOpenChange={(open) => !open && back()}>
      <DialogContent
        className={cn('max-h-[92vh] overflow-y-auto', view === 'editor' ? 'max-w-5xl' : view === 'details' ? 'max-w-4xl' : 'max-w-lg')}
      >
        {view === 'publish' && <PublishPanel />}
        {view === 'part' && <PartPublishPanel />}
        {(view === 'details' || view === 'editor') && <DetailsPanel />}
      </DialogContent>
    </Dialog>
  )
}
