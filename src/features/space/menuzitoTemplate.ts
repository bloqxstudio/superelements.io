import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import { menuzitoSections } from '@/features/menuzito/markup'

const sides = (value: number) => ({ unit: 'px', top: String(value), right: String(value), bottom: String(value), left: String(value), isLinked: true })

const asSection = (section: (typeof menuzitoSections)[number], index: number): SectionNodeData => {
  const rootId = `mz${String(index).padStart(6, '0')}`.slice(0, 8)
  const widgetId = `mw${String(index).padStart(6, '0')}`.slice(0, 8)
  return {
    title: section.title,
    sourceId: `menuzito-${section.id}`,
    elementorJson: JSON.stringify([{
      id: rootId,
      elType: 'container',
      isInner: false,
      settings: {
        content_width: 'full',
        width: { unit: '%', size: 100, sizes: [] },
        padding: sides(0),
        gap: { unit: 'px', size: 0, column: '0', row: '0', isLinked: true },
        css_classes: `menuzito-model menuzito-model-${section.id}`,
      },
      elements: [{
        id: widgetId,
        elType: 'widget',
        widgetType: 'html',
        settings: { html: `${index === 0 ? '<link rel="stylesheet" href="/menuzito/model.css">' : ''}${section.html}` },
        elements: [],
      }],
    }]),
  }
}

export const createMenuzitoTemplate = (): LandingTemplate => ({
  id: 'menuzito-modelo',
  name: 'Menuzito · página completa',
  description: 'Homepage completa para restaurante SaaS, com hero, prova social, ecossistema, comparação, FAQ, pricing, blog e CTA.',
  audience: 'Food service SaaS',
  componentIds: menuzitoSections.map(section => section.id),
  sections: menuzitoSections.map(asSection),
})
