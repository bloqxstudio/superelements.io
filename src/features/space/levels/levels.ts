import { CaseSensitive, Droplets, Images, Rows3, Shapes, Wind, type LucideIcon } from 'lucide-react'
import type { EditLevel } from '@/types/space'

/** Os níveis de edição do Space, na ordem da barra. */
export interface LevelInfo {
  id: EditLevel
  label: string
  icon: LucideIcon
  /** Uma linha: o que o nível mostra e faz. */
  hint: string
  /** Ainda não construído: aparece na barra, desabilitado. */
  soon?: boolean
}

export const LEVELS: LevelInfo[] = [
  { id: 'structure', label: 'Estrutura', icon: Rows3, hint: 'Montar a página: ordem, conteúdo e conexões das seções' },
  { id: 'motion', label: 'Movimento', icon: Wind, hint: 'Escolher entradas e hovers para as seções selecionadas e ver antes de aplicar' },
  { id: 'colors', label: 'Cores', icon: Droplets, hint: 'Ver que cores a marca troca em cada seção' },
  { id: 'typography', label: 'Tipografia', icon: CaseSensitive, hint: 'Ver fontes, pesos e tratamento de texto que a marca aplica' },
  { id: 'shape', label: 'Forma', icon: Shapes, hint: 'Ver cantos, bordas, sombras e filtros que a marca aplica' },
  { id: 'photos', label: 'Fotos', icon: Images, hint: 'Em breve: aplicar as fotos do banco da marca nos espaços de imagem', soon: true },
]

export const levelInfo = (id: EditLevel) => LEVELS.find((l) => l.id === id)!
