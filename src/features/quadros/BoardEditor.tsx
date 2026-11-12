import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check, CloudOff, Loader2, Plus, StickyNote } from 'lucide-react'
import {
  CaptureUpdateAction, Excalidraw, MainMenu, WelcomeScreen, convertToExcalidrawElements, exportToBlob, hashElementsVersion, newElementWith, reconcileElements, restoreElements,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, AppState, BinaryFileData, BinaryFiles, Collaborator, SocketId } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { BoardDraft } from './layout'
import { fileDataUrl, loadBoard, renameBoard, saveScene, saveThumb, takePending, uploadImage, type Board, type BoardScene, type StoredFile } from './data'
import { colorOf, joinBoard, type LiveBoard, type Peer } from './live'
import { FONT, STICKY_COLORS, STICKY_SIZE, stickySkeleton } from './templates'
import { clearOpenBoard, setOpenBoard } from './openBoard'
import { useIaraScreen } from '@/features/iara/store'
import { boardOutline } from './outline'
import { BoardOverlay } from './BoardOverlay'
import { withPerson, type Person } from './quick'
import { isAppLink, renderSystemEmbed } from './embed'

const SystemPicker = React.lazy(() => import('./SystemPicker').then((m) => ({ default: m.SystemPicker })))
import './quadros.css'

/**
 * O quadro aberto: canvas livre do Excalidraw (zoom infinito, notas, formas, setas que grudam, caneta,
 * texto, imagens, frames, desfazer), com visual limpo (sem traço à mão, letra Nunito), gravação
 * automática na conta e ao vivo com quem estiver no mesmo quadro.
 */

type Status = 'salvo' | 'salvando' | 'pendente' | 'erro'
type Els = readonly ExcalidrawElement[]
type RemoteEls = Parameters<typeof reconcileElements>[1]

const VIEW_KEY = (id: string) => `quadro-vista:${id}`
const DAY = 86_400_000

/** Apagados ficam um dia (para quem está junto e para desfazer), depois saem da gravação. */
const prune = (els: Els) => els.filter((e) => !e.isDeleted || Date.now() - (e.updated ?? 0) < DAY)

const readView = (id: string): Partial<AppState> => {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY(id)) ?? 'null') as { x: number; y: number; zoom: number } | null
    return v ? { scrollX: v.x, scrollY: v.y, zoom: { value: v.zoom as AppState['zoom']['value'] } } : {}
  } catch { return {} }
}

const BoardCanvas: React.FC<{ board: Board }> = ({ board }) => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [status, setStatus] = useState<Status>('salvo')
  const [title, setTitle] = useState(board.title)
  const [peers, setPeers] = useState<Peer[]>([])
  const [palette, setPalette] = useState(false)
  const [picker, setPicker] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const me = useMemo<Person | null>(() => (user ? { id: user.id, name: profile?.name ?? user.email ?? 'Alguém', avatar: profile?.avatarUrl ?? undefined, color: colorOf(user.id) } : null), [user, profile?.name, profile?.avatarUrl])
  // O texto de cada elemento como estava: muda aqui (não por mexer a nota nem por outra pessoa) = a pessoa escreveu
  const texts = useRef(new Map<string, string>())

  const rev = useRef(board.rev)
  const files = useRef<Record<string, StoredFile>>({ ...(board.scene.files ?? {}) })
  const background = useRef(board.scene.background ?? '#f7f7f5')
  const uploading = useRef(new Set<string>())
  const loadingFiles = useRef(new Set<string>())
  const sent = useRef(new Map<string, number>())
  const dirty = useRef(false)
  const saving = useRef(false)
  const queued = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const tickTimer = useRef<ReturnType<typeof setTimeout>>()
  const thumbHash = useRef<number | null>(null)
  const thumbPath = useRef(board.thumbPath)
  const live = useRef<LiveBoard | null>(null)
  const collaborators = useRef(new Map<SocketId, Collaborator>())
  // Cursores dos agentes (Iara desta aba ou de outra pessoa): posição atual e a animação até o alvo
  const agentPos = useRef(new Map<string, { x: number; y: number; raf?: number }>())

  const initialData = useMemo(() => {
    const elements = restoreElements(board.scene.elements as Els, null)
    for (const e of elements) { sent.current.set(e.id, e.version); if (e.type === 'text') texts.current.set(e.id, e.text) }
    thumbHash.current = board.thumbPath ? hashElementsVersion(elements) : null
    return {
      elements,
      appState: {
        viewBackgroundColor: background.current,
        currentItemRoughness: 0,
        currentItemFontFamily: FONT,
        currentItemRoundness: 'round' as const,
        currentItemStrokeColor: '#1e1e1e',
        ...readView(board.id),
      },
      scrollToContent: !localStorage.getItem(VIEW_KEY(board.id)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id])

  // ——— imagens: baixa as que a cena usa e ainda não estão na tela (com novas tentativas se alguém acabou de subir)
  const loadFiles = useCallback(async (a: ExcalidrawImperativeAPI, attempt = 0) => {
    const have = a.getFiles()
    const wanted = new Set(a.getSceneElements().flatMap((e) => (e.type === 'image' && e.fileId ? [e.fileId] : [])))
    const missing = [...wanted].filter((id) => !have[id] && !loadingFiles.current.has(id))
    const later: string[] = []
    const got: BinaryFileData[] = []
    await Promise.all(missing.map(async (id) => {
      const meta = files.current[id]
      if (!meta) { later.push(id); return }
      loadingFiles.current.add(id)
      try {
        got.push({ id: id as BinaryFileData['id'], dataURL: (await fileDataUrl(meta.path)) as BinaryFileData['dataURL'], mimeType: meta.mimeType as BinaryFileData['mimeType'], created: meta.created })
      } catch { later.push(id) } finally { loadingFiles.current.delete(id) }
    }))
    if (got.length) a.addFiles(got)
    if (later.length && attempt < 4) setTimeout(() => void loadFiles(a, attempt + 1), [1500, 4000, 10000, 30000][attempt])
  }, [])

  // ——— gravação
  const sceneNow = useCallback((a: ExcalidrawImperativeAPI): BoardScene => {
    const elements = prune(a.getSceneElementsIncludingDeleted())
    const used = new Set<string>(elements.flatMap((e) => (e.type === 'image' && e.fileId ? [e.fileId] : [])))
    return { elements: elements as unknown[], files: Object.fromEntries(Object.entries(files.current).filter(([id]) => used.has(id))), background: background.current }
  }, [])

  const merge = useCallback((a: ExcalidrawImperativeAPI, remote: unknown[]) => {
    const merged = reconcileElements(a.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[], restoreElements(remote as Els, null) as unknown as RemoteEls, a.getAppState())
    for (const e of merged) {
      if ((sent.current.get(e.id) ?? -1) < e.version) sent.current.set(e.id, e.version)
      if (e.type === 'text') texts.current.set(e.id, e.text)
    }
    a.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER })
  }, [])

  const save = useCallback(async () => {
    const a = api
    if (!a || !dirty.current) return
    if (saving.current) { queued.current = true; return }
    saving.current = true
    setStatus('salvando')
    try {
      // Imagem ainda subindo: espera (a cena gravada sempre aponta para um arquivo que existe)
      for (let i = 0; uploading.current.size && i < 60; i++) await new Promise((r) => setTimeout(r, 500))
      for (let attempt = 0; attempt < 4; attempt++) {
        dirty.current = false
        const next = await saveScene(board.id, rev.current, sceneNow(a))
        if (next !== null) { rev.current = next; break }
        // Outra pessoa gravou antes: junta a versão dela com a minha e grava de novo
        const remote = await loadBoard(board.id)
        if (!remote) throw new Error('O quadro foi apagado.')
        Object.assign(files.current, remote.scene.files ?? {})
        merge(a, remote.scene.elements)
        rev.current = remote.rev
        dirty.current = true
        void loadFiles(a)
      }
      setStatus(dirty.current ? 'pendente' : 'salvo')
    } catch (e) {
      dirty.current = true
      setStatus('erro')
      console.error('[quadros] falha ao gravar', e)
    } finally {
      saving.current = false
      if (queued.current || dirty.current) {
        queued.current = false
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => void save(), dirty.current ? 3000 : 600)
      }
    }
  }, [api, board.id, loadFiles, merge, sceneNow])

  const scheduleSave = useCallback(() => {
    dirty.current = true
    setStatus((s) => (s === 'salvando' ? s : 'pendente'))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void save(), 900)
  }, [save])

  const makeThumb = useCallback(async (a: ExcalidrawImperativeAPI) => {
    const elements = a.getSceneElements()
    const hash = hashElementsVersion(elements)
    if (hash === thumbHash.current || !elements.length) return
    thumbHash.current = hash
    try {
      const blob = await exportToBlob({
        elements, files: a.getFiles(), mimeType: 'image/webp', quality: 0.8, exportPadding: 24, maxWidthOrHeight: 720,
        appState: { ...a.getAppState(), exportBackground: true, viewBackgroundColor: background.current },
      })
      thumbPath.current = await saveThumb(board.teamId, board.id, blob, thumbPath.current)
    } catch (e) { console.warn('[quadros] miniatura', e) }
  }, [board.id, board.teamId])

  // ——— a cada mudança: imagens novas sobem, o que mudou vai para quem está junto, a gravação é agendada
  const tick = useCallback(() => {
    tickTimer.current = undefined
    const a = api
    if (!a) return
    const all = a.getSceneElementsIncludingDeleted()
    const changed = all.filter((e) => (sent.current.get(e.id) ?? -1) < e.version)
    // Escreveu numa nota: a foto da pessoa vai para cima dela
    if (me) {
      const wrote = new Set<string>()
      for (const e of changed) {
        if (e.type !== 'text' || e.isDeleted) continue
        const before = texts.current.get(e.id)
        texts.current.set(e.id, e.text)
        if (e.containerId && e.text.trim() && before !== e.text) wrote.add(e.containerId)
      }
      const notes = all.filter((e) => wrote.has(e.id) && (e.customData as { sticky?: boolean } | undefined)?.sticky && !e.isDeleted)
      const updates = new Map<string, ExcalidrawElement>()
      for (const n of notes) {
        const cd = (n.customData ?? {}) as { people?: Person[] }
        const people = withPerson(cd.people, me)
        if (people !== cd.people) updates.set(n.id, newElementWith(n, { customData: { ...cd, people } }))
      }
      if (updates.size) a.updateScene({ elements: all.map((e) => updates.get(e.id) ?? e), captureUpdate: CaptureUpdateAction.NEVER })
    }
    if (changed.length) {
      for (const e of changed) sent.current.set(e.id, e.version)
      live.current?.sendElements(changed as unknown[])
      scheduleSave()
    }
    const bg = a.getAppState().viewBackgroundColor
    if (bg !== background.current) { background.current = bg; scheduleSave() }
    const current = a.getFiles()
    for (const [id, f] of Object.entries(current)) {
      if (files.current[id] || uploading.current.has(id) || !String(f.dataURL).startsWith('data:')) continue
      uploading.current.add(id)
      void uploadImage(board.teamId, board.id, id, f.dataURL)
        .then((stored) => {
          files.current[id] = stored
          live.current?.sendElements([], { [id]: stored })
          scheduleSave()
        })
        .catch((e) => { toast.error(`A imagem não subiu: ${(e as Error).message}`) })
        .finally(() => uploading.current.delete(id))
    }
  }, [api, board.id, board.teamId, scheduleSave, me])

  const onChange = useCallback((_els: Els, appState: AppState, _files: BinaryFiles) => {
    if (!tickTimer.current) tickTimer.current = setTimeout(tick, 60)
    try { localStorage.setItem(VIEW_KEY(board.id), JSON.stringify({ x: appState.scrollX, y: appState.scrollY, zoom: appState.zoom.value })) } catch { /* sem armazenamento */ }
  }, [board.id, tick])

  // ——— cursor do agente: anda devagar até o alvo (0,6 s), com o nome e a cor do agente, e contorna o que está montando
  const showAgent = useCallback((key: string, name: string, color: string, x: number, y: number, selected?: string[]) => {
    if (!api) return
    const id = `agente:${key}` as SocketId
    const pos = agentPos.current.get(key)
    const from = pos ?? { x, y }
    if (pos?.raf) cancelAnimationFrame(pos.raf)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    const step = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / 600)
      const e = 1 - Math.pow(1 - k, 3)
      const cur = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e }
      collaborators.current.set(id, { id, username: name, color: { background: color, stroke: color }, pointer: { x: cur.x, y: cur.y, tool: 'pointer' }, button: 'up', selectedElementIds: Object.fromEntries((selected ?? []).map((s) => [s, true])) } as Collaborator)
      api.updateScene({ collaborators: new Map(collaborators.current) })
      agentPos.current.set(key, { ...cur, raf: k < 1 ? requestAnimationFrame(step) : undefined })
    }
    agentPos.current.set(key, { ...from, raf: requestAnimationFrame(step) })
  }, [api])
  const hideAgent = useCallback((key: string) => {
    const pos = agentPos.current.get(key)
    if (pos?.raf) cancelAnimationFrame(pos.raf)
    agentPos.current.delete(key)
    collaborators.current.delete(`agente:${key}` as SocketId)
    api?.updateScene({ collaborators: new Map(collaborators.current) })
  }, [api])

  // ——— abriu: imagens, ao vivo, e ao sair grava e atualiza a miniatura.
  // O canal fica aberto enquanto o quadro estiver aberto: só reabre se mudar o quadro ou quem entrou. Antes ele
  // reabria quando o login renovava ou o perfil carregava, e a aba ficava sem o canal (e sem os cursores dos outros).
  const fns = useRef({ loadFiles, merge, save, makeThumb, tick, showAgent, hideAgent })
  fns.current = { loadFiles, merge, save, makeThumb, tick, showAgent, hideAgent }
  const meRef = useRef(me)
  meRef.current = me
  const userId = user?.id
  useEffect(() => {
    if (!api || !userId || !meRef.current) return
    const f = () => fns.current
    void f().loadFiles(api)
    const m = meRef.current
    const refreshCollaborators = () => api.updateScene({ collaborators: new Map(collaborators.current) })
    live.current = joinBoard(board.id, { userId: m.id, name: m.name, color: m.color, avatarUrl: m.avatar }, {
      onPeers: (list) => {
        // Na barra, uma foto por pessoa; no canvas, um cursor por aba
        setPeers([...new Map(list.filter((p) => p.userId !== userId).map((p) => [p.userId, p])).values()])
        const keys = new Set(list.map((p) => p.clientId ?? p.userId))
        for (const key of [...collaborators.current.keys()]) if (!String(key).startsWith('agente:') && !keys.has(key)) collaborators.current.delete(key)
        for (const p of list) {
          const key = (p.clientId ?? p.userId) as SocketId
          const prev = collaborators.current.get(key)
          collaborators.current.set(key, { ...prev, id: p.userId, socketId: key, username: p.name, avatarUrl: p.avatarUrl, color: { background: p.color, stroke: p.color } } as Collaborator)
        }
        refreshCollaborators()
      },
      onElements: (els, fileMap) => {
        if (fileMap) Object.assign(files.current, fileMap)
        if (els.length) f().merge(api, els)
        void f().loadFiles(api)
      },
      onPointer: (msg) => {
        const key = (msg.clientId ?? msg.userId) as SocketId
        const prev = collaborators.current.get(key)
        // O cursor pode chegar antes da presença: entra com o que se sabe e a presença completa o nome e a foto
        collaborators.current.set(key, { ...(prev ?? { id: msg.userId, socketId: key, username: '', color: { background: colorOf(msg.userId), stroke: colorOf(msg.userId) } }), pointer: { x: msg.x, y: msg.y, tool: msg.tool }, button: msg.button, selectedElementIds: msg.selected ?? {} } as Collaborator)
        refreshCollaborators()
      },
      onAgent: (msg) => (msg.gone ? f().hideAgent(msg.key) : typeof msg.x === 'number' && typeof msg.y === 'number' && f().showAgent(msg.key, msg.name, msg.color, msg.x, msg.y, msg.selected)),
      snapshot: () => ({ elements: prune(api.getSceneElementsIncludingDeleted()) as unknown[], files: { ...files.current } }),
    })

    const hide = () => { if (document.visibilityState === 'hidden') { void f().save(); void f().makeThumb(api) } }
    const unload = (e: BeforeUnloadEvent) => { if (dirty.current || uploading.current.size) { void f().save(); e.preventDefault(); e.returnValue = '' } }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('beforeunload', unload)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('beforeunload', unload)
      live.current?.leave()
      live.current = null
      for (const key of [...collaborators.current.keys()]) if (!String(key).startsWith('agente:')) collaborators.current.delete(key)
      clearTimeout(saveTimer.current)
      if (tickTimer.current) { clearTimeout(tickTimer.current); f().tick() }
      void f().save().then(() => f().makeThumb(api))
    }
  }, [api, userId, board.id])
  // Nome ou foto mudaram: atualiza a presença sem sair do canal
  useEffect(() => { if (me) live.current?.updateMe({ userId: me.id, name: me.name, color: me.color, avatarUrl: me.avatar }) }, [me])

  // ——— a Iara: escreve neste quadro pelo próprio editor e sabe o que está nele e o que está escolhido
  useEffect(() => {
    if (!api) return
    setOpenBoard({
      id: board.id,
      api,
      agents: {
        move: (a, x, y, selected) => { showAgent(a.key, a.name, a.color, x, y, selected); live.current?.sendAgent({ ...a, x, y, selected: selected?.slice(0, 60) }) },
        gone: (key) => { hideAgent(key); live.current?.sendAgent({ key, name: '', color: '', gone: true }) },
      },
    })
    return () => clearOpenBoard(board.id)
  }, [api, board.id, showAgent, hideAgent])

  // ——— o que a IA conectada (MCP) pediu para pôr no quadro: desenha aqui, embaixo do que existe
  useEffect(() => {
    if (!api) return
    let running = false
    const drain = async () => {
      if (running || document.visibilityState !== 'visible') return
      running = true
      try {
        const queue = await takePending(board.id)
        if (!queue.length) return
        const { addDraftToBoard, editBoardItems, linkBoardItems, organizeBoard } = await import('./compose')
        for (const item of queue) {
          try {
            if ('op' in item && item.op === 'editar') await editBoardItems(board.id, board.teamId, item.itens)
            else if ('op' in item && item.op === 'ligar') await linkBoardItems(board.id, board.teamId, item.ligacoes)
            else if ('op' in item && item.op === 'organizar') await organizeBoard(board.id, board.teamId)
            else await addDraftToBoard(board.id, board.teamId, item as BoardDraft)
          } catch (e) {
            toast.error(`Um pedido da sua IA não entrou no quadro: ${(e as Error).message}`)
          }
        }
        toast.success(queue.length > 1 ? `${queue.length} pedidos da sua IA entraram no quadro` : 'O pedido da sua IA entrou no quadro')
      } catch (e) {
        console.error('[quadros] fila da IA', e)
      } finally {
        running = false
      }
    }
    // Espera o registro do quadro aberto (setOpenBoard) para desenhar pelo editor
    const first = setTimeout(() => void drain(), 400)
    window.addEventListener('focus', drain)
    document.addEventListener('visibilitychange', drain)
    return () => { clearTimeout(first); window.removeEventListener('focus', drain); document.removeEventListener('visibilitychange', drain) }
  }, [api, board.id, board.teamId])
  useIaraScreen({
    id: `quadro-${board.id}`,
    title: `Quadro ${title}`,
    describe: () => {
      if (!api) return `Quadro "${title}" (id ${board.id}) carregando.`
      const out = boardOutline(api.getSceneElements() as unknown[])
      return `Quadro "${title}" (id ${board.id}), aberto no canvas, com ${out.count} elemento(s).${out.lines.length ? `\nO que está escrito nele:\n${out.lines.slice(0, 80).join('\n')}` : ' Está vazio.'}\nCom "quadro":"${board.id}": quadro_adicionar põe cartões com ícone, notas, colunas, fluxos e mapas com setas; quadro_organizar arruma o que está embolado; quadro_editar muda texto, cor, lugar ou apaga pelos ids (#…); quadro_ligar liga itens com setas.`
    },
    selection: () => {
      if (!api) return ''
      const sel = api.getAppState().selectedElementIds
      const picked = api.getSceneElements().filter((e) => sel[e.id])
      if (!picked.length) return ''
      const out = boardOutline(api.getSceneElements() as unknown[], new Set(picked.map((e) => e.id)))
      return out.lines.length ? `${picked.length} item(ns) no quadro: ${out.lines.slice(0, 6).join(' · ').slice(0, 300)}` : `${picked.length} item(ns) no quadro`
    },
    actions: [],
  })

  // ——— nota adesiva no centro da tela (ou ao lado da nota escolhida)
  const addSticky = useCallback((color: string) => {
    if (!api) return
    const s = api.getAppState()
    const z = s.zoom.value
    let x = -s.scrollX + s.width / 2 / z - STICKY_SIZE / 2
    let y = -s.scrollY + s.height / 2 / z - STICKY_SIZE / 2
    const picked = api.getSceneElements().filter((e) => s.selectedElementIds[e.id])
    if (picked.length === 1) { x = picked[0].x + picked[0].width + 24; y = picked[0].y }
    const skel = { ...stickySkeleton(x, y, color), ...(me ? { customData: { sticky: true, people: [me] } } : {}) }
    const [note] = convertToExcalidrawElements([skel as unknown as Parameters<typeof convertToExcalidrawElements>[0][number]])
    api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), note], appState: { selectedElementIds: { [note.id]: true } }, captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    api.setActiveTool({ type: 'selection' })
    setPalette(false)
  }, [api, me])

  // A camada dos "+" e das fotos fica dentro do `.excalidraw`, abaixo da barra de ferramentas
  useEffect(() => { if (api) setHost(canvasRef.current?.querySelector<HTMLElement>('.excalidraw') ?? null) }, [api])

  const commitTitle = async () => {
    const t = title.trim() || 'Quadro sem título'
    setTitle(t)
    if (t === board.title) return
    try { await renameBoard(board.id, t); board.title = t } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="qd-shell">
      <header className="qd-bar">
        <Link to="/quadros" className="qd-back" aria-label="Voltar aos quadros" title="Voltar aos quadros"><ArrowLeft className="h-4 w-4" /></Link>
        <input
          className="qd-title" value={title} aria-label="Nome do quadro" maxLength={120}
          onChange={(e) => setTitle(e.target.value)} onBlur={() => void commitTitle()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitle(board.title); (e.target as HTMLInputElement).blur() } }}
        />
        <span className={cn('qd-status', status === 'erro' && 'text-red-600')} aria-live="polite">
          {status === 'salvando' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando</>}
          {status === 'pendente' && <>Alterações não salvas</>}
          {status === 'salvo' && <><Check className="h-3.5 w-3.5" /> Salvo</>}
          {status === 'erro' && <><CloudOff className="h-3.5 w-3.5" /> Não salvou, tentando de novo</>}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {peers.length > 0 && (
            <div className="qd-people" aria-label={`${peers.length} ${peers.length === 1 ? 'pessoa' : 'pessoas'} neste quadro`}>
              {peers.slice(0, 5).map((p) => (
                <span key={p.userId} className="qd-avatar" style={{ borderColor: p.color, background: p.color }} title={p.name}>
                  {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {peers.length > 5 && <span className="qd-avatar qd-more">+{peers.length - 5}</span>}
            </div>
          )}
        </div>
      </header>

      <div className="qd-canvas" ref={canvasRef}>
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          onChange={onChange}
          onPointerUpdate={({ pointer, button }) => live.current?.sendPointer({ x: pointer.x, y: pointer.y, tool: pointer.tool, button, selected: api?.getAppState().selectedElementIds as Record<string, true> | undefined })}
          isCollaborating={peers.length > 0}
          langCode="pt-BR"
          validateEmbeddable={(link) => isAppLink(link) || /^https:\/\//.test(link)}
          renderEmbeddable={(el) => renderSystemEmbed(el)}
          name={title}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, export: false } }}
          renderTopRightUI={() => (
            <div className="qd-sticky">
              <button type="button" className="qd-system-btn" onClick={() => { setPalette(false); setPicker(true) }} title="Pôr no quadro um criativo, arquivo, página, site, formulário, funil ou dashboard">
                <Plus className="h-4 w-4" /> <span>Do sistema</span>
              </button>
              <button type="button" className="qd-sticky-btn" onClick={() => setPalette((v) => !v)} aria-expanded={palette} title="Nota adesiva">
                <StickyNote className="h-4 w-4" /> <span>Nota</span>
              </button>
              {palette && (
                <div className="qd-sticky-menu" role="menu" aria-label="Cor da nota">
                  {STICKY_COLORS.map((c) => (
                    <button key={c.color} type="button" role="menuitem" title={c.name} aria-label={`Nota ${c.name.toLowerCase()}`} onClick={() => addSticky(c.color)} style={{ background: c.color }} />
                  ))}
                  <p>Dois cliques na nota para escrever</p>
                </div>
              )}
            </div>
          )}
        >
          <MainMenu>
            <MainMenu.Item onSelect={() => navigate('/quadros')} icon={<ArrowLeft className="h-4 w-4" />}>Voltar aos quadros</MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.ToolbarHint>Formas, setas, caneta, texto e imagens</WelcomeScreen.Hints.ToolbarHint>
            <WelcomeScreen.Hints.MenuHint>Exportar imagem, fundo e ajuda</WelcomeScreen.Hints.MenuHint>
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Heading>Quadro livre para planejar e soltar ideias</WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                <WelcomeScreen.Center.MenuItem onSelect={() => addSticky(STICKY_COLORS[0].color)} icon={<StickyNote className="h-4 w-4" />}>Colar uma nota</WelcomeScreen.Center.MenuItem>
                <WelcomeScreen.Center.MenuItemHelp />
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
        {api && host && me && <BoardOverlay api={api} host={host} me={me} teamId={board.teamId} colorOf={colorOf} />}
        {api && picker && (
          <React.Suspense fallback={null}>
            <SystemPicker api={api} open={picker} onOpenChange={setPicker} />
          </React.Suspense>
        )}
      </div>
    </div>
  )
}

/** /quadros/:boardId */
const BoardEditor: React.FC<{ boardId: string }> = ({ boardId }) => {
  const [board, setBoard] = useState<Board | null | undefined>(undefined)
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    setBoard(undefined)
    loadBoard(boardId).then((b) => live && setBoard(b)).catch((e) => live && setError((e as Error).message))
    return () => { live = false }
  }, [boardId])
  if (error || board === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-gray-600">
        <p>{error ?? 'Este quadro não existe ou é de outra conta.'}</p>
        <Link to="/quadros" className="font-medium text-gray-900 underline">Voltar aos quadros</Link>
      </div>
    )
  }
  if (!board) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
  return <BoardCanvas key={board.id} board={board} />
}

export default BoardEditor
