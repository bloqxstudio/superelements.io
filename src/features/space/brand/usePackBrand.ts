import { useMemo } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { useActiveBrand } from './brandStore'
import type { Brand } from './designMd'
import { projectHouseStyle, withHouseStyle, type HouseStyle } from './houseStyle'

/**
 * Estilo da casa como texto, para servir de dependência: só muda quando o
 * estilo muda, não a cada arrasto no canvas.
 */
export function useHouseStyleKey(brand: Brand | null, enabled = true): string {
  return useSpaceStore((s) => (brand && enabled ? JSON.stringify(projectHouseStyle(s.nodes, brand)) : ''))
}

/** A marca ativa como as seções do pack recebem: com o estilo das páginas do projeto. */
export function usePackBrand(): Brand | null {
  const brand = useActiveBrand()
  const key = useHouseStyleKey(brand)
  return useMemo(() => (brand && key ? withHouseStyle(brand, JSON.parse(key) as HouseStyle | null) : brand), [brand, key])
}
