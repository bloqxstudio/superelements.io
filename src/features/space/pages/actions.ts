import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import { MOD_KEY } from './clipboard'
import { plural } from './pages'

/** Copia as seções para colar em outra página (ou projeto) e avisa como colar. */
export const copySelection = (ids: string[]) => {
  const count = useSpaceStore.getState().copySections(ids)
  if (count) toast.success(plural(count, 'seção copiada', 'seções copiadas'), { description: `Clique numa página e cole com ${MOD_KEY}V.` })
  return count
}
