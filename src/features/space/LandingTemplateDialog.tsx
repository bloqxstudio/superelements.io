import React, { useMemo } from 'react'
import { ArrowRight, Layers3, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSpaceStore } from '@/store/spaceStore'
import { createLandingTemplates, type LandingTemplate } from './landingTemplates'

interface LandingTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Página que recebeu o modelo. */
  onLoaded: (pageId: string) => void
}

export const LandingTemplateDialog: React.FC<LandingTemplateDialogProps> = ({ open, onOpenChange, onLoaded }) => {
  const templates = useMemo(() => createLandingTemplates(), [])

  /** O modelo entra na página ativa, se ela estiver vazia; senão, vira uma página nova. O resto do canvas fica. */
  const loadTemplate = (template: LandingTemplate) => {
    const store = useSpaceStore.getState()
    const active = store.pages.find((p) => p.id === store.activePageId)
    const pageId = active && !active.sectionIds.length ? active.id : store.addPage(template.name)
    useSpaceStore.getState().addSections(template.sections, { pageId, leftInset: 32 })
    const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
    onOpenChange(false)
    onLoaded(pageId)
    toast.success(`${template.name} carregado em ${page?.name ?? 'uma página'}`, {
      description: `${template.sections.length} dobras prontas para personalizar e exportar.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-[#f7f7f3] px-6 py-5">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#152017] text-[#d9ff43]">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </div>
          <DialogTitle>Modelos de landing page</DialogTitle>
          <DialogDescription>
            Carregue uma narrativa completa numa página do canvas: a ativa, se estiver vazia, ou uma página nova. Todas as dobras continuam editáveis e compatíveis com a exportação para Elementor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, index) => (
            <article
              key={template.id}
              className="group flex min-h-64 flex-col overflow-hidden rounded-2xl bg-[#152017] p-5 text-white shadow-[0_1px_0_rgba(0,0,0,.06),0_18px_40px_rgba(21,32,23,.12)]"
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9ff43]">
                  {template.audience}
                </span>
                <span className="font-mono text-xs text-white/40">0{index + 1}</span>
              </div>
              <div className="mt-auto">
                <div className="mb-3 flex items-center gap-2 text-xs text-white/55">
                  <Layers3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {template.sections.length} dobras
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{template.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{template.description}</p>
                {template.componentIds && (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#d9ff43]">
                    {template.componentIds.join(' · ')}
                  </p>
                )}
                <Button
                  onClick={() => loadTemplate(template)}
                  className="mt-5 h-9 w-full justify-between rounded-xl bg-[#d9ff43] px-4 text-xs font-semibold text-[#152017] transition-transform active:scale-[0.96] hover:bg-white"
                >
                  Usar este modelo
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
