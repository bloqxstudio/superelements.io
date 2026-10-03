import { useMemo } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { projectCopy, type ProjectCopy } from './projectCopy'

/** Textos das páginas do projeto; só muda quando os textos mudam, não a cada arrasto. */
export function useProjectCopy(): ProjectCopy | null {
  const key = useSpaceStore((s) => projectCopy(s.nodes)?.key ?? '')
  return useMemo(() => (key ? projectCopy(useSpaceStore.getState().nodes) : null), [key])
}
