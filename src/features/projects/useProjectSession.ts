import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import { useBrandStore } from '@/features/space/brand/brandStore'
import { summarize, useProjectStore } from './projectStore'
import { loadProjectDoc, saveProjectDoc } from './storage'

const SAVE_DELAY = 400

/**
 * Abre um projeto no Space: põe o canvas e a marca dele nos stores e salva
 * de volta a cada mudança. Os componentes do Space não sabem de projetos.
 */
export const useProjectSession = (projectId: string | undefined) => {
  const [loadedId, setLoadedId] = useState<string>()

  useEffect(() => {
    if (!projectId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let edited = false
    let warned = false
    const unsubscribers: Array<() => void> = []

    const save = () => {
      clearTimeout(timer)
      timer = undefined
      const { nodes, connections, pages, canvasTransform } = useSpaceStore.getState()
      const { source, enabled, logoRatios, brand } = useBrandStore.getState()
      useProjectStore.getState().saved(projectId, summarize(nodes, brand, pages), edited)
      edited = false
      saveProjectDoc(projectId, {
        canvas: { nodes, connections, pages, canvasTransform },
        brand: { source, enabled, logoRatios },
      }).catch((error) => {
        console.error('[projetos] falha ao salvar', error)
        if (warned) return
        warned = true
        toast.error('Não foi possível salvar o projeto', { description: 'As mudanças ficam só nesta aba até recarregar.' })
      })
    }

    const schedule = (content: boolean) => {
      edited ||= content
      clearTimeout(timer)
      timer = setTimeout(save, SAVE_DELAY)
    }

    const flush = () => {
      if (timer) save()
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    loadProjectDoc(projectId)
      .catch((error) => {
        console.error('[projetos] falha ao abrir', error)
        toast.error('Não foi possível abrir o projeto salvo')
        return undefined
      })
      .then((doc) => {
        if (cancelled) return
        useSpaceStore.getState().loadCanvas(doc?.canvas)
        useBrandStore.getState().load(doc?.brand)

        unsubscribers.push(
          useSpaceStore.subscribe((s, prev) => {
            if (s.nodes !== prev.nodes || s.connections !== prev.connections || s.pages !== prev.pages) schedule(true)
            else if (s.canvasTransform !== prev.canvasTransform) schedule(false)
          }),
          useBrandStore.subscribe((s, prev) => {
            if (s.source !== prev.source || s.enabled !== prev.enabled) schedule(true)
            else if (s.logoRatios !== prev.logoRatios) schedule(false)
          })
        )
        window.addEventListener('pagehide', flush)
        document.addEventListener('visibilitychange', onHidden)
        setLoadedId(projectId)
      })

    return () => {
      cancelled = true
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      // Sair do projeto (ou trocar de projeto) grava o que estava pendente
      flush()
    }
  }, [projectId])

  return loadedId === projectId
}
