import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { useSpaceStore } from '@/store/spaceStore'
import { useBrandStore } from '@/features/space/brand/brandStore'
import { useSiteKitStore } from '@/features/wordpress/siteKitStore'
import { deleteDraft, loadDraft, saveDraft, type ProjectDraft } from './browserDb'
import { summarize, useProjectStore } from './projectStore'
import { loadDocHead, loadProjectDoc, saveProjectDoc } from './storage'
import type { ProjectDoc, ProjectSummary } from './types'

/** Rascunho neste navegador, rápido: fechar a aba não perde nada. */
const DRAFT_DELAY = 400
/** Parou de editar: sobe para a conta. */
const CLOUD_DELAY = 1500
/** Editando sem parar, sobe pelo menos a cada tanto. */
const CLOUD_MAX_WAIT = 10_000
/** Mexeu só no zoom ou na posição do canvas: sobe sem pressa. */
const VIEW_DELAY = 15_000
const RETRY_DELAYS = [3_000, 10_000, 30_000, 60_000]

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'conflict'

interface SyncState {
  projectId?: string
  status: SyncStatus
  /** Último salvamento na conta feito daqui. */
  savedAt?: number
}

/** Em que pé está o salvamento do projeto aberto, para o header. */
export const useProjectSync = create<SyncState>()(() => ({ status: 'saved' }))

interface Snapshot {
  doc: ProjectDoc
  summary: ProjectSummary
}

const collect = (): Snapshot => {
  const { nodes, connections, pages, canvasTransform } = useSpaceStore.getState()
  const { source, enabled, logoRatios, brand } = useBrandStore.getState()
  const { kit } = useSiteKitStore.getState()
  return {
    doc: { canvas: { nodes, connections, pages, canvasTransform }, brand: { source, enabled, logoRatios }, site: kit },
    summary: summarize(nodes, brand, pages),
  }
}

const apply = (doc?: ProjectDoc) => {
  useSpaceStore.getState().loadCanvas(doc?.canvas)
  useBrandStore.getState().load(doc?.brand)
  useSiteKitStore.getState().load(doc?.site)
}

const formatTime = (time: number) =>
  new Date(time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** O salvamento de quem acabou de sair do projeto; abrir de novo espera por ele. */
const closing = new Map<string, Promise<void>>()

export type SessionState = 'loading' | 'ready' | 'error' | 'missing'

/**
 * Abre um projeto no Space: lê o conteúdo da conta, põe nos stores e salva de
 * volta a cada mudança. Cada mudança vira primeiro um rascunho neste navegador
 * e logo depois sobe para a conta; se outra aba ou aparelho salvou antes, a
 * pessoa escolhe qual versão fica. Os componentes do Space não sabem de projetos.
 */
export const useProjectSession = (projectId: string | undefined) => {
  const [session, setSession] = useState<{ id?: string; state: SessionState }>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!projectId) return
    setSession({ id: projectId, state: 'loading' })

    let active = true
    let loaded = false
    // Revisão da conta sobre a qual o canvas aberto está, e o arquivo dela
    let base = 0
    let path: string | null = null
    // Cada mudança sobe a versão; a da conta diz até onde já subiu
    let version = 0
    let contentVersion = 0
    let cloudVersion = 0
    let conflict = false
    let applying = false
    let saving: Promise<void> | null = null
    let again = false
    let retries = 0
    let firstChangeAt = 0
    let draftTimer: ReturnType<typeof setTimeout> | undefined
    let cloudTimer: ReturnType<typeof setTimeout> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    // Depois de sair, os stores podem ter outro projeto: vale o retrato tirado na saída
    let final: Snapshot | null = null
    const unsubscribers: Array<() => void> = []
    const conflictToast = `projeto-conflito-${projectId}`
    const draftToast = `projeto-rascunho-${projectId}`

    const dirty = () => version !== cloudVersion
    const edited = () => contentVersion > cloudVersion
    const snapshot = () => final ?? collect()

    const setStatus = (status: SyncStatus) => {
      if (useProjectSync.getState().projectId !== projectId) return
      useProjectSync.setState(status === 'saved' ? { status, savedAt: Date.now() } : { status })
    }

    const writeDraft = (snap = snapshot()) => {
      clearTimeout(draftTimer)
      draftTimer = undefined
      useProjectStore.getState().saved(projectId, snap.summary, edited())
      const draft: ProjectDraft = { ...snap, base, edited: edited(), savedAt: Date.now() }
      return saveDraft(projectId, draft).catch((error) => console.warn('[projetos] rascunho não salvo', error))
    }

    const gone = () => {
      toast.error('Este projeto foi excluído da conta')
      useProjectStore.setState((s) => ({ projects: s.projects.filter((p) => p.id !== projectId) }))
      if (active) setSession({ id: projectId, state: 'missing' })
    }

    const onConflict = () => {
      conflict = true
      clearTimeout(cloudTimer)
      clearTimeout(retryTimer)
      setStatus('conflict')
      // Fora do projeto o rascunho fica, e a escolha aparece ao abrir de novo
      if (!active) return
      toast.warning('Este projeto foi salvo em outro lugar', {
        id: conflictToast,
        description:
          'Outra aba ou aparelho salvou uma versão mais nova enquanto você editava aqui. As suas mudanças estão guardadas neste navegador.',
        duration: Infinity,
        action: { label: 'Manter a desta aba', onClick: () => void keepMine() },
        cancel: { label: 'Abrir a mais nova', onClick: () => void openLatest() },
      })
    }

    const push = (): Promise<void> => {
      clearTimeout(cloudTimer)
      clearTimeout(retryTimer)
      cloudTimer = retryTimer = undefined
      if (conflict || !dirty()) return Promise.resolve()
      if (saving) {
        again = true
        return saving
      }
      firstChangeAt = 0
      const snap = snapshot()
      const pushed = version
      const pushedEdited = edited()
      if (pushedEdited) setStatus('saving')

      saving = (async () => {
        try {
          const result = await saveProjectDoc(projectId, snap.doc, { base, previousPath: path, summary: snap.summary, edited: pushedEdited })
          if ('conflict' in result) {
            onConflict()
            return
          }
          ;({ revision: base, path } = result.saved)
          retries = 0
          cloudVersion = pushed
          if (dirty()) {
            // Mudou enquanto subia: o rascunho passa a valer sobre a revisão nova
            void writeDraft()
            again = true
          } else {
            setStatus('saved')
            await deleteDraft(projectId).catch(() => {})
          }
        } catch (error) {
          console.error('[projetos] falha ao salvar na conta', error)
          setStatus('offline')
          if (active) retryTimer = setTimeout(push, RETRY_DELAYS[Math.min(retries++, RETRY_DELAYS.length - 1)])
        } finally {
          saving = null
          if (again) {
            again = false
            void push()
          }
        }
      })()
      return saving
    }

    const onChange = (content: boolean) => {
      if (applying) return
      version++
      if (content) contentVersion = version
      clearTimeout(draftTimer)
      draftTimer = setTimeout(writeDraft, DRAFT_DELAY)
      if (conflict) return
      if (content) setStatus('saving')
      const now = Date.now()
      firstChangeAt ||= now
      clearTimeout(cloudTimer)
      cloudTimer = setTimeout(push, edited() ? Math.min(CLOUD_DELAY, Math.max(0, firstChangeAt + CLOUD_MAX_WAIT - now)) : VIEW_DELAY)
    }

    /** Troca o canvas aberto por outro conteúdo sem contar como edição. */
    const replaceWith = (doc: ProjectDoc | undefined) => {
      applying = true
      try {
        apply(doc)
      } finally {
        applying = false
      }
    }

    const keepMine = async () => {
      try {
        const head = await loadDocHead(projectId)
        if (!head) return gone()
        // A versão mais nova sai da conta quando esta tomar o lugar dela
        base = head.revision
        path = head.path
        conflict = false
        await push()
      } catch (error) {
        console.error('[projetos] falha ao resolver o conflito', error)
        toast.error('Não foi possível falar com a conta', { description: 'Confira a internet e escolha de novo.' })
        onConflict()
      }
    }

    const openLatest = async () => {
      try {
        const remote = await loadProjectDoc(projectId)
        if (!remote) return gone()
        if (!active) return
        clearTimeout(draftTimer)
        clearTimeout(cloudTimer)
        clearTimeout(retryTimer)
        replaceWith(remote.doc)
        base = remote.revision
        path = remote.path
        cloudVersion = version
        conflict = false
        await deleteDraft(projectId).catch(() => {})
        useProjectStore.getState().saved(projectId, collect().summary, false)
        setStatus('saved')
      } catch (error) {
        console.error('[projetos] falha ao abrir a versão mais nova', error)
        toast.error('Não foi possível abrir a versão mais nova', { description: 'Confira a internet e escolha de novo.' })
        onConflict()
      }
    }

    const offerDraft = (draft: ProjectDraft) => {
      toast('Há mudanças deste navegador que não chegaram à conta', {
        id: draftToast,
        description: `Feitas em ${formatTime(draft.savedAt)}. Depois disso outra versão foi salva na conta, e é ela que está aberta.`,
        duration: Infinity,
        action: {
          label: 'Usar as deste navegador',
          onClick: () => {
            if (!active) return
            replaceWith(draft.doc)
            onChange(true)
          },
        },
        cancel: {
          label: 'Descartar',
          // O rascunho pode já ser de mudanças novas, que ainda não subiram
          onClick: () => void (dirty() ? undefined : deleteDraft(projectId).catch(() => {})),
        },
      })
    }

    const leave = () => {
      if (!loaded || !dirty()) return
      void writeDraft()
      void push()
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') leave()
    }
    const onOnline = () => {
      if (useProjectSync.getState().status === 'offline') void push()
    }

    const open = async () => {
      await closing.get(projectId)?.catch(() => {})
      if (!active) return
      useProjectSync.setState({ projectId, status: 'saved', savedAt: undefined })

      let remote: Awaited<ReturnType<typeof loadProjectDoc>>
      let draft: ProjectDraft | undefined
      try {
        ;[remote, draft] = await Promise.all([
          loadProjectDoc(projectId),
          loadDraft(projectId).catch((error) => {
            console.warn('[projetos] rascunho não lido', error)
            return undefined
          }),
        ])
      } catch (error) {
        console.error('[projetos] falha ao abrir', error)
        if (active) setSession({ id: projectId, state: 'error' })
        return
      }
      if (!active) return
      if (!remote) {
        setSession({ id: projectId, state: 'missing' })
        return
      }

      base = remote.revision
      path = remote.path
      // Rascunho sobre a mesma revisão: são mudanças daqui que não chegaram a subir
      const resume = draft?.base === remote.revision ? draft : undefined
      const offer = !resume && draft?.edited ? draft : undefined
      if (draft && !resume && !offer) void deleteDraft(projectId).catch(() => {})
      apply(resume?.doc ?? remote.doc)
      loaded = true

      unsubscribers.push(
        useSpaceStore.subscribe((s, prev) => {
          if (s.nodes !== prev.nodes || s.connections !== prev.connections || s.pages !== prev.pages) onChange(true)
          else if (s.canvasTransform !== prev.canvasTransform) onChange(false)
        }),
        useBrandStore.subscribe((s, prev) => {
          if (s.source !== prev.source || s.enabled !== prev.enabled) onChange(true)
          else if (s.logoRatios !== prev.logoRatios) onChange(false)
        }),
        useSiteKitStore.subscribe((s, prev) => {
          if (s.kit !== prev.kit) onChange(true)
        })
      )
      window.addEventListener('pagehide', leave)
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onHidden)
      setSession({ id: projectId, state: 'ready' })

      if (resume) {
        version++
        if (resume.edited) contentVersion = version
        void push()
      }
      if (offer) offerDraft(offer)
    }

    void open()

    return () => {
      active = false
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onHidden)
      clearTimeout(draftTimer)
      clearTimeout(cloudTimer)
      clearTimeout(retryTimer)
      toast.dismiss(conflictToast)
      toast.dismiss(draftToast)
      if (!loaded || !dirty()) return

      // Sair do projeto (ou trocar de projeto) grava o que estava pendente, aqui e na conta
      final = collect()
      const done: Promise<void> = (async () => {
        await writeDraft(final!)
        await push()
        while (saving) await saving
      })().finally(() => {
        if (closing.get(projectId) === done) closing.delete(projectId)
      })
      closing.set(projectId, done)
    }
  }, [projectId, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const state: SessionState = session.id === projectId ? session.state : 'loading'
  return { state, retry }
}
