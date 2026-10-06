import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ComponentPublishPanel } from './ComponentPublishPanel'
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
  // Um componente publica como modelo do Elementor (Theme Builder, modelo salvo ou Global Widget)
  const publishComponentId = useWordPressUi((s) => s.publishComponentId)
  const view = detailsPageId ? (editing ? 'editor' : 'details') : publishComponentId ? 'component' : publishPageId ? 'publish' : null

  return (
    <Dialog open={!!view} onOpenChange={(open) => !open && back()}>
      <DialogContent
        className={cn('max-h-[92vh] overflow-y-auto', view === 'editor' ? 'max-w-5xl' : view === 'details' ? 'max-w-4xl' : 'max-w-lg')}
      >
        {view === 'publish' && <PublishPanel />}
        {view === 'component' && <ComponentPublishPanel />}
        {(view === 'details' || view === 'editor') && <DetailsPanel />}
      </DialogContent>
    </Dialog>
  )
}
