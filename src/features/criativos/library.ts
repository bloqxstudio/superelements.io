import { AV_CASES, type AvCase } from '@/features/avence/cases'

/**
 * Imagens prontas para os posts: as telas reais dos cases do estúdio (capa,
 * página inteira do computador, página do celular) e as ilustrações da
 * identidade. Tudo já está em `public/`.
 */

export interface LibraryItem {
  id: string
  group: string
  label: string
  src: string
  width: number
  height: number
}

export type CaseView = 'capa' | 'pagina' | 'celular'

export const CASE_VIEW_LABEL: Record<CaseView, string> = { capa: 'capa', pagina: 'página do computador', celular: 'página do celular' }

export const caseImage = (c: AvCase, view: CaseView) => {
  const shot = view === 'capa' ? c.cover : view === 'pagina' ? c.page : c.phone
  return { src: shot.path, width: shot.w, height: shot.h }
}

export const ILLUSTRATIONS: LibraryItem[] = [
  { id: 'site-parado', label: 'Site parado no tempo', src: '/brands/avence-studio/ilustracoes/site-parado.svg', width: 650, height: 520 },
  { id: 'clique-conversa', label: 'Do anúncio à conversa', src: '/brands/avence-studio/ilustracoes/clique-conversa.svg', width: 920, height: 500 },
  { id: 'previa-site', label: 'Prévia de uma página nova', src: '/brands/avence-studio/ilustracoes/previa-site.svg', width: 760, height: 640 },
  { id: 'antes-depois', label: 'Antes e depois', src: '/brands/avence-studio/ilustracoes/antes-depois.svg', width: 740, height: 680 },
  { id: 'camadas-wordpress', label: 'Camadas de páginas', src: '/brands/avence-studio/ilustracoes/camadas-wordpress.svg', width: 620, height: 680 },
].map((i) => ({ ...i, group: 'Ilustrações' }))

export const LIBRARY: LibraryItem[] = [
  ...AV_CASES.flatMap((c) =>
    (['capa', 'pagina', 'celular'] as CaseView[]).map((view) => ({ id: `${c.slug}-${view}`, group: `Case · ${c.name}`, label: `${c.name} · ${CASE_VIEW_LABEL[view]}`, ...caseImage(c, view) }))
  ),
  ...ILLUSTRATIONS,
]

export const caseBySlug = (slug: string) => AV_CASES.find((c) => c.slug === slug)
