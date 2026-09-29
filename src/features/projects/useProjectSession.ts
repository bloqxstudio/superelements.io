import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { useSpaceStore } from '@/store/spaceStore'
import { useBrandStore } from '@/features/space/brand/brandStore'
import { useSiteKitStore } from '@/features/wordpress/siteKitStore'
import { supabase } from '@/integrations/supabase/client'
import { personName } from './access'
import { deleteDraft, loadDraft, saveDraft, type ProjectDraft } from './browserDb'
import { joinLiveProject, type LivePerson, type LiveProject } from './liveProject'
import { mergeDocs } from './mergeDoc'
import { summarize, useProjectStore } from './projectStore'
import { loadDocHead, loadProjectDoc, saveProjectDoc } from './storage'
import { withCurrentOrigin } from './localAssets'
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
/** Junções seguidas sem conseguir salvar (os dois salvando sem parar): depois disso, a pessoa escolhe. */
const MAX_MERGES = 5
/** Sem o canal ao vivo, a aba aberta confere a conta de tempos em tempos. */
const POLL_DELAY = 20_000

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'conflict'

interface SyncState {
  projectId?: string
  status: SyncStatus
  /** Último salvamento na conta feito daqui. */
  savedAt?: number
  /** O canvas acabou de receber mudanças de outra pessoa ou aba ("Com as mudanças de Rafael"). */
  note?: string
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

const apply = (saved?: ProjectDoc) => {
  // Imagens do app gravadas com outra porta local (ou antes de publicar) voltam a abrir
  const doc = withCurrentOrigin(saved)
  useSpaceStore.getState().loadCanvas(doc?.canvas)
  useBrandStore.getState().load(doc?.brand)
  useSiteKitStore.getState().load(doc?.site)
}

/** A versão que outra pessoa ou aba salvou, sem tirar ninguém do lugar (zoom, página, player, seleção). */
const applyRemote = (saved: ProjectDoc) => {
  const doc = withCurrentOrigin(saved)
  useSpaceStore.getState().syncCanvas(doc.canvas)
  const brand = useBrandStore.getState()
  if (brand.source !== doc.brand.source || brand.enabled !== doc.brand.enabled) brand.load(doc.brand)
  const site = useSiteKitStore.getState()
  if (JSON.stringify(site.kit ?? null) !== JSON.stringify(doc.site ?? null)) site.load(doc.site)
}

/** Quem está na conta aberta, para o canal ao vivo. */
async function currentPerson(): Promise<LivePerson | null> {
  const user = (await supabase.auth.getSession()).data.session?.user
  return user ? { userId: user.id, email: user.email ?? '' } : null
}

const formatTime = (time: number) =>
  new Date(time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** O salvamento de quem acabou de sair do projeto; abrir de novo espera por ele. */
const closing = new Map<string, Promise<void>>()

export type SessionState = 'loading' | 'ready' | 'error' | 'missing'

/**
 * Abre um projeto no Space: lê o conteúdo da conta, põe nos stores e salva de
 * volta a cada mudança. Cada mudança vira primeiro um rascunho neste navegador
 * e logo depois sobe para a conta. O projeto pode estar aberto por mais gente
 * (quem o dono convidou) ou em outra aba: quando alguém salva, quem está sem
 * mudanças pendentes recebe a versão nova; quem tem, junta as duas ao salvar.
 * Só se os dois mexeram na mesma peça a pessoa escolhe qual versão fica.
 * Os componentes do Space não sabem de projetos.
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
    // O conteúdo da revisão `base`, de onde as mudanças daqui partiram: é com ele que a junção compara
    let baseDoc: ProjectDoc | undefined
    // Canal ao vivo, quem está aqui e quem salvou por último em outro lugar
    let live: LiveProject | null = null
    let me: LivePerson | null = null
    let lastBy: LivePerson | null = null
    // Mudanças de outro lugar juntas às daqui desde o último salvamento
    let mergedNote: string | undefined
    let merges = 0
    let refreshing = false
    let refreshAgain = false
    // Projeto excluído, ou acesso tirado: nada mais sobe
    let lost = false
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
    let pollTimer: ReturnType<typeof setInterval> | undefined
    // Depois de sair, os stores podem ter outro projeto: vale o retrato tirado na saída
    let final: Snapshot | null = null
    const unsubscribers: Array<() => void> = []
    const conflictToast = `projeto-conflito-${projectId}`
    const draftToast = `projeto-rascunho-${projectId}`

    const dirty = () => version !== cloudVersion
    const edited = () => contentVersion > cloudVersion
    const snapshot = () => final ?? collect()

    const setStatus = (status: SyncStatus, note?: string) => {
      if (useProjectSync.getState().projectId !== projectId) return
      useProjectSync.setState(status === 'saved' ? { status, savedAt: Date.now(), note } : { status, note: undefined })
    }

    /** "Rafael", ou "outra aba" quando foi a mesma conta. */
    const who = (person: LivePerson | null) =>
      !person ? undefined : person.userId === me?.userId ? 'outra aba' : personName(person.email)
    const changesNote = (from: string | undefined) => (from ? `Com as mudanças de ${from}` : 'Com a versão mais nova da conta')

    const writeDraft = (snap = snapshot()) => {
      clearTimeout(draftTimer)
      draftTimer = undefined
      useProjectStore.getState().saved(projectId, snap.summary, edited())
      const draft: ProjectDraft = { ...snap, base, edited: edited(), savedAt: Date.now() }
      return saveDraft(projectId, draft).catch((error) => console.warn('[projetos] rascunho não salvo', error))
    }

    const gone = () => {
      if (lost) return
      lost = true
      clearTimeout(cloudTimer)
      clearTimeout(retryTimer)
      toast.error('Este projeto não está mais na sua conta', { description: 'Ele foi excluído, ou o seu acesso a ele foi removido.' })
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
      const other = who(lastBy)
      toast.warning('Este projeto foi salvo em outro lugar', {
        id: conflictToast,
        description: `${
          other && other !== 'outra aba' ? `${other} salvou` : 'Outra pessoa, aba ou aparelho salvou'
        } uma versão mais nova mexendo na mesma parte que você. As suas mudanças estão guardadas neste navegador.`,
        duration: Infinity,
        action: { label: 'Manter a desta aba', onClick: () => void keepMine() },
        cancel: { label: 'Abrir a mais nova', onClick: () => void openLatest() },
      })
    }

    /** Põe no canvas o que veio de outro lugar sem contar como edição daqui. */
    const replaceRemote = (doc: ProjectDoc) => {
      applying = true
      try {
        applyRemote(doc)
      } finally {
        applying = false
      }
    }

    /** O canvas passa a partir de uma revisão mais nova da conta. */
    const rebase = (remote: { revision: number; path: string | null; doc?: ProjectDoc }) => {
      base = remote.revision
      path = remote.path
      baseDoc = remote.doc
    }

    /**
     * Alguém salvou antes desta aba. Sem mudanças daqui no conteúdo, fica a
     * versão dele; com mudanças, junta as duas e sobe de novo. `false` quando
     * não dá para juntar (os dois mexeram na mesma peça): a pessoa escolhe.
     */
    const catchUp = async (): Promise<boolean> => {
      let remote: Awaited<ReturnType<typeof loadProjectDoc>>
      try {
        remote = await loadProjectDoc(projectId)
      } catch (error) {
        console.warn('[projetos] versão mais nova não lida', error)
        return false
      }
      if (!remote) {
        gone()
        return true
      }
      if (!remote.doc) return false

      if (!edited()) {
        // Faltava subir só o zoom e a posição do canvas, que continuam aqui
        if (active && !final) replaceRemote(remote.doc)
        rebase(remote)
        cloudVersion = version
        mergedNote = changesNote(who(lastBy))
        return true
      }
      if (!baseDoc || merges >= MAX_MERGES) return false
      const merged = mergeDocs(withCurrentOrigin(baseDoc), snapshot().doc, withCurrentOrigin(remote.doc))
      if (!merged) return false
      merges++
      rebase(remote)
      if (final) final = { ...final, doc: merged }
      else replaceRemote(merged)
      // A junção ainda não está na conta: sobe logo
      version++
      contentVersion = version
      mergedNote = changesNote(who(lastBy))
      return true
    }

    const push = (): Promise<void> => {
      clearTimeout(cloudTimer)
      clearTimeout(retryTimer)
      cloudTimer = retryTimer = undefined
      if (conflict || lost || !dirty()) return Promise.resolve()
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
            if (await catchUp()) {
              if (lost) return
              if (dirty()) {
                // A junção vale sobre a revisão nova: o rascunho também
                void writeDraft()
                again = true
              } else {
                setStatus('saved', mergedNote)
                mergedNote = undefined
                await deleteDraft(projectId).catch(() => {})
              }
              return
            }
            onConflict()
            return
          }
          ;({ revision: base, path } = result.saved)
          baseDoc = snap.doc
          merges = 0
          retries = 0
          cloudVersion = pushed
          live?.saved(base)
          if (dirty()) {
            // Mudou enquanto subia: o rascunho passa a valer sobre a revisão nova
            void writeDraft()
            again = true
          } else {
            setStatus('saved', mergedNote)
            mergedNote = undefined
            await deleteDraft(projectId).catch(() => {})
          }
        } catch (error) {
          console.error('[projetos] falha ao salvar na conta', error)
          setStatus('offline')
          // Sem permissão também cai aqui: se o projeto sumiu da conta, para de tentar
          void loadDocHead(projectId)
            .then((head) => head === undefined && gone())
            .catch(() => {})
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
        // Sem o conteúdo dela aqui: se alguém salvar de novo antes, a pessoa escolhe outra vez
        baseDoc = undefined
        merges = 0
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
        rebase(remote)
        merges = 0
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

    /**
     * Outra pessoa ou aba salvou: sem nada daqui no conteúdo para subir, o
     * canvas recebe a versão nova na hora. Com mudanças daqui, quem junta é o
     * próximo salvamento.
     */
    const refresh = async (): Promise<void> => {
      if (refreshing) {
        // Chegou outra revisão enquanto esta baixava: busca de novo no fim
        refreshAgain = true
        return
      }
      if (conflict || lost || saving || edited()) return
      refreshing = true
      try {
        const remote = await loadProjectDoc(projectId)
        if (!remote) return gone()
        if (!active || conflict || saving || edited() || remote.revision <= base || !remote.doc) return
        replaceRemote(remote.doc)
        rebase(remote)
        merges = 0
        // O que faltava subir era só zoom e posição do canvas, que continuam aqui
        clearTimeout(cloudTimer)
        cloudVersion = version
        await deleteDraft(projectId).catch(() => {})
        useProjectStore.getState().saved(projectId, collect().summary, false)
        setStatus('saved', changesNote(who(lastBy)))
      } catch (error) {
        console.warn('[projetos] versão mais nova não lida', error)
      } finally {
        refreshing = false
        if (refreshAgain && active) {
          refreshAgain = false
          void refresh()
        }
      }
    }

    /** Voltou para a aba (ou o canal ao vivo está fora): confere se a conta tem revisão nova. */
    const checkForNewer = async () => {
      if (conflict || lost || edited()) return
      try {
        const head = await loadDocHead(projectId)
        if (!head) return gone()
        if (head.revision > base) await refresh()
      } catch {
        // Sem internet agora: confere na próxima vez
      }
    }

    const onRemoteSaved = (revision: number, by: LivePerson) => {
      lastBy = by
      if (revision > base) void refresh()
    }

    const onRemoved = (userId: string) => {
      if (userId === me?.userId) gone()
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
      else void checkForNewer()
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

      rebase(remote)
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

      // Quem mais está no projeto, e o aviso de quando alguém salva
      me = await currentPerson()
      if (!active || !me) return
      live = joinLiveProject(projectId, me, { onSaved: onRemoteSaved, onRemoved })
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && !live?.isLive()) void checkForNewer()
      }, POLL_DELAY)
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
      clearInterval(pollTimer)
      toast.dismiss(conflictToast)
      toast.dismiss(draftToast)
      if (!loaded || !dirty()) {
        live?.leave()
        return
      }

      // Sair do projeto (ou trocar de projeto) grava o que estava pendente, aqui e na conta
      final = collect()
      const done: Promise<void> = (async () => {
        await writeDraft(final!)
        await push()
        while (saving) await saving
      })().finally(() => {
        // O canal fica até o último salvamento, para os outros receberem o aviso dele
        live?.leave()
        if (closing.get(projectId) === done) closing.delete(projectId)
      })
      closing.set(projectId, done)
    }
  }, [projectId, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const state: SessionState = session.id === projectId ? session.state : 'loading'
  return { state, retry }
}
