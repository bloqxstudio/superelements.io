import React, { Suspense, lazy } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

/** O editor carrega o Excalidraw (pesado) só quando um quadro é aberto. */
const BoardEditor = lazy(() => import('./BoardEditor'))

export const BoardRoute: React.FC = () => {
  const { boardId } = useParams()
  if (!boardId) return null
  return (
    <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}>
      <BoardEditor boardId={boardId} />
    </Suspense>
  )
}
