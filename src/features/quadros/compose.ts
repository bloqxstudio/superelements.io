import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { createBoard, fileDataUrl, loadBoard, saveScene, uploadImage, type BoardScene, type StoredFile } from './data'
import { openBoard, type AgentPointer } from './openBoard'
import { FONT, arrowSkeleton, planDraft, stickyColor, strongOf, type BoardDraft, type IconUse, type Measure } from './layout'
import { organize, type OrgEl } from './organize'
import { pencil, type SketchItem } from './sketch'

/**
 * O que leva um `BoardDraft` para dentro de um quadro (só no navegador): mede cada texto com o próprio
 * Excalidraw, resolve os ícones (nome do Lucide ou palavra em português) e desenha em PNG, e põe tudo no
 * quadro aberto (aparece na hora, desfaz, vai ao vivo) ou na cena gravada (com as imagens subidas).
 */

type Ex = typeof import('@excalidraw/excalidraw')
let ex: Ex | undefined
const lib = async () => (ex ??= await import('@excalidraw/excalidraw'))
type Skel = Parameters<Ex['convertToExcalidrawElements']>[0]
type El = { id: string; x: number; y: number; width: number; height: number; isDeleted?: boolean; version?: number }

/** Mede com o Excalidraw: a altura que o retângulo ganha quando o texto entra nele. */
function measurer(x: Ex): Measure {
  const cache = new Map<string, number>()
  return (text, width, fontSize) => {
    const key = `${width}|${fontSize}|${text}`
    const hit = cache.get(key)
    if (hit) return hit
    const [rect] = x.convertToExcalidrawElements([{ type: 'rectangle', x: 0, y: 0, width, height: 10, label: { text, fontSize, fontFamily: FONT as never, textAlign: 'left', verticalAlign: 'top' } }] as Skel)
    const h = Math.ceil(rect.height)
    cache.set(key, h)
    return h
  }
}

/** Troca o ícone pedido pelo nome do Lucide (aceita português: "câmera", "dinheiro"); sem achar, tira. */
async function resolveIcons(d: BoardDraft): Promise<BoardDraft> {
  const { iconExists, searchIcons } = await import('@/features/criativos/icons')
  const memo = new Map<string, string | undefined>()
  const fix = async (name?: string) => {
    if (!name) return undefined
    if (memo.has(name)) return memo.get(name)
    const n = name.trim().toLowerCase()
    const got = (await iconExists(n)) ? n : (await searchIcons(n, 1))[0]
    memo.set(name, got)
    return got
  }
  const items = async <T extends { icone?: string }>(list?: T[]) => list && Promise.all(list.map(async (it) => ({ ...it, icone: await fix(it.icone) })))
  return {
    ...d,
    notas: await items(d.notas),
    cartoes: await items(d.cartoes),
    colunas: d.colunas && await Promise.all(d.colunas.map(async (c) => ({ ...c, itens: (await items(c.itens)) ?? [] }))),
  }
}

async function iconData(icons: IconUse[]): Promise<Record<string, string>> {
  const { iconPng } = await import('@/features/criativos/icons')
  const out: Record<string, string> = {}
  await Promise.all(icons.map(async (i) => {
    const blob = await iconPng(i.name, i.color, 48, 2)
    if (!blob) return
    out[i.fileId] = await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(blob) })
  }))
  return out
}

/**
 * Carrega a Nunito (só os caracteres usados) antes de medir: medida com a letra de reserva quebra as
 * linhas no lugar errado e o texto sai cortado na nota. O `exportToCanvas` é o caminho público que
 * carrega as fontes de uma lista de elementos.
 */
async function ensureFonts(X: Ex, text: string, family = FONT) {
  try {
    const els = X.convertToExcalidrawElements([{ type: 'text', x: 0, y: 0, text: text || 'a', fontSize: 18, fontFamily: family as never }] as Skel)
    await X.exportToCanvas({ elements: els, files: null, appState: { exportBackground: false }, maxWidthOrHeight: 32 })
    await document.fonts?.ready
  } catch { /* sem a fonte, mede com a reserva */ }
}
const draftText = (d: BoardDraft) => JSON.stringify(d).replace(/[{}[\]":,]/g, ' ')

/** O bloco desenhado a partir de (x, y), já convertido em elementos do Excalidraw, e os ícones em PNG. */
export async function buildDraft(draft: BoardDraft, x: number, y: number) {
  const X = await lib()
  await ensureFonts(X, draftText(draft))
  const d = await resolveIcons(draft)
  const plan = planDraft(d, x, y, measurer(X))
  const files = await iconData(plan.icons)
  // um ícone que não desenhou some com o fundo dele (sem quadrado vazio no quadro)
  const skeleton = plan.skeleton.filter((s) => s.type !== 'image' || files[s.fileId as string])
  const elements = X.convertToExcalidrawElements(skeleton as Skel, { regenerateIds: false }) as unknown as El[]
  return { elements, files }
}

/** O retângulo que os elementos ocupam (para pôr o que é novo embaixo, sem cobrir nada). */
export const bounds = (els: El[]) => {
  const live = els.filter((e) => !e.isDeleted)
  if (!live.length) return null
  return { minX: Math.min(...live.map((e) => e.x)), maxY: Math.max(...live.map((e) => e.y + e.height)) }
}

const addFilesToApi = (api: ExcalidrawImperativeAPI, files: Record<string, string>) => {
  const now = Date.now()
  const have = api.getFiles()
  const add = Object.entries(files).filter(([id]) => !have[id]).map(([id, dataURL]) => ({ id, dataURL, mimeType: 'image/png', created: now }) as unknown as BinaryFileData)
  if (add.length) api.addFiles(add)
}

const uploadFiles = async (teamId: string, boardId: string, files: Record<string, string>, have: Record<string, StoredFile> = {}) => {
  const out: Record<string, StoredFile> = {}
  await Promise.all(Object.entries(files).filter(([id]) => !have[id]).map(async ([id, dataURL]) => { out[id] = await uploadImage(teamId, boardId, id, dataURL) }))
  return out
}

// ---------- o agente trabalhando à vista ----------

type Open = NonNullable<ReturnType<typeof openBoard>>
type Step = { at: { x: number; y: number }; els: El[] }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const centerOf = (els: El[]) => {
  // o que está sendo apagado também conta: o cursor vai até onde ele estava
  const live = els.filter((e) => e.width !== undefined)
  if (!live.length) return { x: 0, y: 0 }
  const x0 = Math.min(...live.map((e) => e.x)), y0 = Math.min(...live.map((e) => e.y))
  const x1 = Math.max(...live.map((e) => e.x + Math.max(0, e.width))), y1 = Math.max(...live.map((e) => e.y + Math.max(0, e.height)))
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}

type Unit = Step[]
type Piece = El & { type?: string; groupIds?: string[]; containerId?: string | null; customData?: { card?: boolean; cardPart?: string; sticky?: boolean } }

/**
 * As peças para montar à vista (2026-11-07, o usuário: "deixe o mouse mais lento… mostre mais sentido de
 * construir"): cada frame, cada cartão, cada nota, cada seta. Com `fine`, o cartão se monta em partes, na ordem
 * de quem constrói: o fundo e a barra, o ícone, o título, o texto e a etiqueta. As setas ficam por último.
 */
function unitsOf(els: El[], fine = false): Unit[] {
  const byId = new Map(els.map((e) => [e.id, e as Piece]))
  const keyOf = (e: Piece): string => {
    if (e.type === 'frame') return `f:${e.id}`
    if (e.containerId && byId.has(e.containerId)) return keyOf(byId.get(e.containerId)!)
    if (e.type === 'arrow') return `a:${e.id}`
    return e.groupIds?.[0] ? `g:${e.groupIds[0]}` : `e:${e.id}`
  }
  const groups = new Map<string, Piece[]>()
  for (const e of els as Piece[]) { const k = keyOf(e); groups.set(k, [...(groups.get(k) ?? []), e]) }
  const rank = (k: string) => (k.startsWith('f:') ? 0 : k.startsWith('a:') ? 2 : 1)
  const list = [...groups.entries()].map(([k, g]) => ({ k, g, c: centerOf(g) })).sort((a, b) => rank(a.k) - rank(b.k) || a.c.y - b.c.y || a.c.x - b.c.x)
  // Muitas peças: junta as vizinhas (o quadro não vira uma espera de minutos)
  const per = Math.max(1, Math.ceil(list.length / 40))
  const units: Unit[] = []
  for (let i = 0; i < list.length; i += per) {
    const chunk = list.slice(i, i + per)
    if (!fine || per > 1 || chunk[0].g.length < 3) { units.push([{ at: chunk[0].c, els: chunk.flatMap((x) => x.g) }]); continue }
    // Montar o cartão em partes: cada contêiner vai com o texto de dentro
    const g = chunk[0].g
    const textOf = (id: string) => g.filter((t) => t.containerId === id)
    const order = (e: Piece) => (e.customData?.card ? 0 : e.customData?.cardPart === 'barra' ? 1 : e.type === 'ellipse' ? 2 : e.type === 'image' ? 3 : e.customData?.cardPart === 'titulo' ? 4 : e.customData?.cardPart === 'texto' ? 5 : e.customData?.cardPart === 'tag' ? 6 : 7)
    const holders = g.filter((e) => !e.containerId).sort((a, b) => order(a) - order(b))
    const parts: Step[] = []
    for (const h of holders) {
      const els2 = [h, ...textOf(h.id)]
      // o fundo do cartão e a barra entram juntos (a barra sozinha não diz nada)
      if (order(h) === 1 && parts.length) { parts[parts.length - 1].els.push(...els2); continue }
      parts.push({ at: centerOf(els2), els: els2 })
    }
    units.push(parts)
  }
  return units
}

/** Quanto esperar: o cursor chega (0,6 s), olha a peça e ela entra; entre partes da mesma peça, menos. */
const PACE = { arrive: 620, after: 240, part: 380 }

/**
 * A equipe de agentes montando à vista. As peças se dividem entre os agentes em blocos vizinhos (um começa por
 * cima, o outro pelo meio), e todos trabalham ao mesmo tempo, cada um com o cursor e o contorno do que está
 * montando; as setas só entram depois que todas as peças estão no lugar. Um passo só no desfazer: tudo entra
 * sem registrar e o fim registra de uma vez, do antes ao depois.
 */
async function crew(open: Open, X: Ex, agents: AgentPointer[] | undefined, units: Unit[], apply: (step: Step) => void, pace: Partial<typeof PACE> = {}) {
  const P = { ...PACE, ...pace }
  // Para o desfazer: como cada elemento que vamos tocar estava antes (null = não existia)
  const before = new Map<string, El | null>()
  const now0 = new Map((open.api.getSceneElementsIncludingDeleted() as unknown as El[]).map((e) => [e.id, e]))
  for (const u of units) for (const st of u) for (const e of st.els) if (!before.has(e.id)) before.set(e.id, now0.get(e.id) ?? null)
  const team = agents?.length ? agents : []
  const show = team.length > 0 && !reduceMotion()
  const isArrow = (u: Unit) => u.some((st) => st.els.some((e) => (e as Piece).type === 'arrow'))
  // O fundo grande (um painel atrás de tudo) entra antes, por um agente só: o resto é desenhado em cima dele
  const boxOfUnit = (u: Unit) => { const els = u.flatMap((st) => st.els); const x0 = Math.min(...els.map((e) => e.x)), y0 = Math.min(...els.map((e) => e.y)); return { x0, y0, x1: Math.max(...els.map((e) => e.x + e.width)), y1: Math.max(...els.map((e) => e.y + e.height)) } }
  const all = units.map(boxOfUnit)
  const area = (Math.max(...all.map((b) => b.x1)) - Math.min(...all.map((b) => b.x0))) * (Math.max(...all.map((b) => b.y1)) - Math.min(...all.map((b) => b.y0))) || 1
  const backdrop = units.filter((u, i) => !isArrow(u) && ((all[i].x1 - all[i].x0) * (all[i].y1 - all[i].y0)) / area > 0.4)
  const phases = [backdrop, units.filter((u) => !isArrow(u) && !backdrop.includes(u)), units.filter(isArrow)]
  try {
    for (const [pi, phase] of phases.entries()) {
      if (!phase.length) continue
      const n = pi === 0 ? 1 : Math.max(1, Math.min(team.length || 1, phase.length))
      // Cada agente fica com uma região: as peças vão em faixas pelo eixo mais comprido (colunas lado a lado,
      // ou linhas de cima para baixo), e dentro da faixa seguem a ordem de leitura
      const centers = phase.map((u) => { const b = boxOfUnit(u); return { u, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 } })
      const spreadX = Math.max(...centers.map((c) => c.cx)) - Math.min(...centers.map((c) => c.cx))
      const spreadY = Math.max(...centers.map((c) => c.cy)) - Math.min(...centers.map((c) => c.cy))
      const byAxis = [...centers].sort((a, b) => (spreadX >= spreadY ? a.cx - b.cx : a.cy - b.cy))
      const size = Math.ceil(byAxis.length / n)
      const lanes = Array.from({ length: n }, (_, l) => { const mine = new Set(byAxis.slice(l * size, (l + 1) * size).map((c) => c.u)); return phase.filter((u) => mine.has(u)) })
      await Promise.all(lanes.map(async (laneUnits, lane) => {
        const agent = team[lane]
        // começa um pouco depois do outro, para não andarem colados
        if (show && lane) await sleep(lane * 300)
        for (const unit of laneUnits) {
          // o contorno marca só a peça (o fundo do cartão, a nota, a seta), não cada pedacinho dela
          const piece = unit[0].els.find((e) => !(e as Piece).containerId)?.id
          const mark = piece ? [piece] : []
          for (let k = 0; k < unit.length; k++) {
            const st = unit[k]
            if (agent) open.agents?.move(agent, st.at.x, st.at.y, k ? mark : [])
            if (show) await sleep(k ? P.part : P.arrive)
            apply(st)
            if (agent) open.agents?.move(agent, st.at.x, st.at.y, mark)
            if (show) await sleep(P.after)
          }
          if (agent) open.agents?.move(agent, unit[unit.length - 1].at.x, unit[unit.length - 1].at.y, [])
        }
      }))
    }
  } finally {
    // Um passo só no desfazer: volta (sem registrar) ao que era antes e aplica o final registrando, no mesmo
    // instante (a tela não pisca). O que outras pessoas mudaram durante a montagem fica como está.
    const after = open.api.getSceneElementsIncludingDeleted() as unknown as El[]
    const prior = after.flatMap((e) => { if (!before.has(e.id)) return [e]; const b = before.get(e.id); return b ? [b] : [] })
    open.api.updateScene({ elements: prior as never, captureUpdate: X.CaptureUpdateAction.NEVER })
    open.api.updateScene({ elements: after as never, captureUpdate: X.CaptureUpdateAction.IMMEDIATELY })
    for (const a of team) setTimeout(() => open.agents?.gone(a.key), 1200)
  }
}

/** Põe o bloco no quadro, embaixo do que já está lá. Aberto na tela: pelo editor; fechado: na cena gravada. */
export async function addDraftToBoard(boardId: string, teamId: string, draft: BoardDraft, agents?: AgentPointer[]): Promise<{ count: number; live: boolean }> {
  const X = await lib()
  const open = openBoard(boardId)
  if (open) {
    const els = open.api.getSceneElementsIncludingDeleted() as unknown as El[]
    const b = bounds(els)
    const { elements, files } = await buildDraft(draft, b?.minX ?? 0, b ? b.maxY + 160 : 0)
    addFilesToApi(open.api, files)
    // A tela vai até onde o bloco entra, e o agente desenha uma parte de cada vez
    open.api.scrollToContent(elements as never, { fitToContent: true, animate: true })
    await crew(open, X, agents, unitsOf(elements, true), (step) => {
      open.api.updateScene({ elements: [...open.api.getSceneElementsIncludingDeleted(), ...(step.els as never[])], captureUpdate: X.CaptureUpdateAction.NEVER })
    })
    return { count: elements.length, live: true }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const board = await loadBoard(boardId)
    if (!board || board.teamId !== teamId) throw new Error('Quadro não encontrado nesta conta.')
    const els = board.scene.elements as El[]
    const b = bounds(els)
    const { elements, files } = await buildDraft(draft, b?.minX ?? 0, b ? b.maxY + 160 : 0)
    const stored = await uploadFiles(teamId, boardId, files, board.scene.files)
    const rev = await saveScene(boardId, board.rev, { ...board.scene, elements: [...els, ...elements], files: { ...board.scene.files, ...stored } })
    if (rev !== null) return { count: elements.length, live: false }
  }
  throw new Error('O quadro está sendo editado agora; tente de novo.')
}

/** Um quadro novo já desenhado (modelo ou o que a Iara montou). */
export async function createBoardFrom(teamId: string, title: string, draft?: BoardDraft): Promise<string> {
  const id = await createBoard(teamId, title)
  if (!draft) return id
  const board = await loadBoard(id)
  if (!board) return id
  const { elements, files } = await buildDraft(draft, 0, 0)
  const stored = await uploadFiles(teamId, id, files)
  const scene: BoardScene = { ...board.scene, elements, files: stored }
  await saveScene(id, board.rev, scene)
  return id
}

// ---------- mexer no que já existe ----------

type Raw = Record<string, unknown> & El

/** Aplica mudanças de campos (com versão nova, para gravar e ir ao vivo) e elementos novos. */
async function applyChanges(boardId: string, teamId: string, change: (els: Raw[], X: Ex) => { patch: Map<string, Record<string, unknown>>; added?: Raw[]; files?: Record<string, string> } | string, agents?: AgentPointer[]) {
  const X = await lib()
  const open = openBoard(boardId)
  if (open) {
    const els = open.api.getSceneElementsIncludingDeleted() as unknown as Raw[]
    const r = change(els, X)
    if (typeof r === 'string') throw new Error(r)
    if (r.files) addFilesToApi(open.api, r.files)
    // Cada parte muda à vista: o cursor vai até onde ela fica e a mudança entra (desfazer volta tudo de uma vez)
    const byId = new Map(els.map((e) => [e.id, e]))
    const target = [...r.patch.entries()].flatMap(([id, p]) => { const e = byId.get(id); return e ? [{ ...e, ...p } as Raw] : [] })
    const units = unitsOf([...target, ...(r.added ?? [])])
    if (!units.length) return { changed: 0, live: true }
    await crew(open, X, agents, units, (step) => {
      const ids = new Set(step.els.map((e) => e.id))
      const now = open.api.getSceneElementsIncludingDeleted() as unknown as Raw[]
      const have = new Set(now.map((e) => e.id))
      const next = now.map((e) => (ids.has(e.id) && r.patch.has(e.id) ? X.newElementWith(e as never, r.patch.get(e.id) as never) : e))
      const fresh = (r.added ?? []).filter((a) => ids.has(a.id) && !have.has(a.id))
      open.api.updateScene({ elements: [...next, ...fresh] as never, captureUpdate: X.CaptureUpdateAction.NEVER })
    })
    return { changed: r.patch.size + (r.added?.length ?? 0), live: true }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const board = await loadBoard(boardId)
    if (!board || board.teamId !== teamId) throw new Error('Quadro não encontrado nesta conta.')
    const els = board.scene.elements as Raw[]
    const r = change(els, X)
    if (typeof r === 'string') throw new Error(r)
    const stored = r.files ? await uploadFiles(teamId, boardId, r.files, board.scene.files) : {}
    const next = els.map((e) => (r.patch.has(e.id) ? X.newElementWith(e as never, r.patch.get(e.id) as never) : e))
    const rev = await saveScene(boardId, board.rev, { ...board.scene, elements: [...next, ...(r.added ?? [])] as unknown[], files: { ...board.scene.files, ...stored } })
    if (rev !== null) return { changed: r.patch.size + (r.added?.length ?? 0), live: false }
  }
  throw new Error('O quadro está sendo editado agora; tente de novo.')
}

/** Arruma o quadro: nota do tamanho do texto, colunas sem sobreposição, nada em cima de nada, setas refeitas. */
export function organizeBoard(boardId: string, teamId: string, opts: { espaco?: number; linhas?: boolean } = {}, agents?: AgentPointer[]) {
  return applyChanges(boardId, teamId, (els) => ({ patch: organize(els as unknown as OrgEl[], opts) }), agents)
}

/** Uma imagem do quadro (PNG até 1.600 px) para a Iara conferir o resultado. `area` limita aos itens dados. */
export async function boardImage(boardId: string, teamId: string, only?: string[]): Promise<string> {
  const X = await lib()
  const open = openBoard(boardId)
  let elements: El[]
  let files: Record<string, BinaryFileData> = {}
  if (open) {
    elements = open.api.getSceneElements() as unknown as El[]
    files = open.api.getFiles() as unknown as Record<string, BinaryFileData>
  } else {
    const board = await loadBoard(boardId)
    if (!board || board.teamId !== teamId) throw new Error('Quadro não encontrado nesta conta.')
    elements = (board.scene.elements as El[]).filter((e) => !e.isDeleted)
    const used = new Set(elements.flatMap((e) => ((e as { type?: string; fileId?: string }).type === 'image' && (e as { fileId?: string }).fileId ? [(e as { fileId?: string }).fileId!] : [])))
    await Promise.all([...used].map(async (id) => {
      const meta = board.scene.files?.[id]
      if (!meta) return
      try { files[id] = { id, dataURL: await fileDataUrl(meta.path), mimeType: meta.mimeType, created: meta.created } as unknown as BinaryFileData } catch { /* sem a imagem */ }
    }))
  }
  if (only?.length) {
    const want = new Set(only)
    const byGroup = new Set(elements.filter((e) => want.has(e.id)).flatMap((e) => (e as { groupIds?: string[] }).groupIds ?? []))
    elements = elements.filter((e) => want.has(e.id) || (e as { groupIds?: string[] }).groupIds?.some((g) => byGroup.has(g)) || want.has((e as { containerId?: string }).containerId ?? ''))
  }
  if (!elements.length) throw new Error('O quadro está vazio.')
  const blob = await X.exportToBlob({ elements: elements as never, files: files as never, appState: { exportBackground: true, viewBackgroundColor: '#f7f7f5' }, mimeType: 'image/png', maxWidthOrHeight: 1600, exportPadding: 32 })
  return await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(blob) })
}

export interface ItemEdit { id: string; texto?: string; titulo?: string; cor?: string; apagar?: boolean; x?: number; y?: number }

/** Muda texto, cor, posição ou apaga itens (o id é o do item no `quadro_ler`). */
export async function editBoardItems(boardId: string, teamId: string, edits: ItemEdit[], agents?: AgentPointer[]) {
  await ensureFonts(await lib(), edits.map((e) => `${e.titulo ?? ''} ${e.texto ?? ''}`).join(' '))
  return applyChanges(boardId, teamId, (els, X) => {
    const byId = new Map(els.filter((e) => !e.isDeleted).map((e) => [e.id, e]))
    const patch = new Map<string, Record<string, unknown>>()
    const added: Raw[] = []
    const set = (id: string, p: Record<string, unknown>) => patch.set(id, { ...patch.get(id), ...p })
    const missing: string[] = []
    for (const ed of edits) {
      const main = byId.get(ed.id)
      if (!main) { missing.push(ed.id); continue }
      // Seta: apagar leva o rótulo junto e solta das duas pontas; a cor é a do traço
      if (main.type === 'arrow') {
        const label = els.filter((t) => t.containerId === main.id && !t.isDeleted)
        if (ed.apagar) {
          set(main.id, { isDeleted: true })
          for (const t of label) set(t.id, { isDeleted: true })
          for (const end of [(main.startBinding as { elementId?: string } | null)?.elementId, (main.endBinding as { elementId?: string } | null)?.elementId]) {
            const t = end ? byId.get(end) : undefined
            if (t) set(t.id, { boundElements: ((patch.get(t.id)?.boundElements as { id: string }[] | undefined) ?? ((t.boundElements as { id: string }[] | null) ?? [])).filter((b) => b.id !== main.id) })
          }
        } else if (ed.cor) set(main.id, { strokeColor: strongOf(stickyColor(ed.cor)) })
        continue
      }
      const groups = (main.groupIds as string[] | undefined) ?? []
      const mates = els.filter((e) => !e.isDeleted && (e.id === main.id || (groups.length && (e.groupIds as string[] | undefined)?.includes(groups[0])) || e.containerId === main.id))
      const withText = [...mates, ...mates.flatMap((m) => els.filter((t) => t.containerId === m.id && !t.isDeleted))]
      const all = [...new Map(withText.map((e) => [e.id, e])).values()]
      if (ed.apagar) {
        for (const e of all) set(e.id, { isDeleted: true })
        for (const a of els) {
          if (a.isDeleted || a.type !== 'arrow' || ((a.startBinding as { elementId?: string } | null)?.elementId !== main.id && (a.endBinding as { elementId?: string } | null)?.elementId !== main.id)) continue
          set(a.id, { isDeleted: true })
          // o rótulo da seta não fica solto no quadro
          for (const t of els) if (t.containerId === a.id && !t.isDeleted) set(t.id, { isDeleted: true })
        }
        continue
      }
      if (ed.cor) {
        if ((main.customData as { sticky?: boolean } | undefined)?.sticky) set(main.id, { backgroundColor: stickyColor(ed.cor) })
        else {
          const bar = all.find((e) => (e.customData as { cardPart?: string } | undefined)?.cardPart === 'barra')
          if (bar) set(bar.id, { backgroundColor: strongOf(stickyColor(ed.cor)) })
          const tag = all.find((e) => (e.customData as { cardPart?: string } | undefined)?.cardPart === 'tag')
          if (tag) set(tag.id, { backgroundColor: stickyColor(ed.cor) })
          if (!bar && !tag) set(main.id, { backgroundColor: stickyColor(ed.cor) })
        }
      }
      // texto: troca o texto de dentro do retângulo certo e remede (a caixa cresce com o texto)
      const retext = (holder: Raw | undefined, text: string | undefined) => {
        if (!holder || text === undefined) return 0
        const old = els.find((t) => t.containerId === holder.id && !t.isDeleted) as Raw | undefined
        const fontSize = (old?.fontSize as number) ?? 18
        // (com o quadro aberto a fonte já está carregada; fechado, `editBoardItems` carrega antes)
        const [rect, txt] = X.convertToExcalidrawElements([{
          type: 'rectangle', x: holder.x, y: holder.y, width: holder.width, height: 10,
          label: { text, fontSize, fontFamily: FONT as never, strokeColor: (old?.strokeColor as string) ?? '#1e1e1e', textAlign: (old?.textAlign as never) ?? 'left', verticalAlign: (old?.verticalAlign as never) ?? 'top' },
        }] as Skel) as unknown as Raw[]
        if (!txt) return 0
        if (old) set(old.id, { isDeleted: true })
        const grow = Math.max(0, rect.height - holder.height)
        Object.assign(txt, { containerId: holder.id, frameId: holder.frameId ?? null, groupIds: holder.groupIds ?? [] })
        added.push(txt)
        const bound = ((holder.boundElements as { id: string; type: string }[] | null) ?? []).filter((b) => b.id !== old?.id)
        set(holder.id, { boundElements: [...bound, { id: txt.id, type: 'text' }], ...(grow ? { height: holder.height + grow } : {}) })
        return grow
      }
      if ((main.customData as { card?: boolean } | undefined)?.card) {
        const part = (n: string) => all.find((e) => (e.customData as { cardPart?: string } | undefined)?.cardPart === n)
        const grow = retext(part('titulo'), ed.titulo) + retext(part('texto'), ed.texto)
        if (grow) set(main.id, { height: main.height + grow })
      } else retext(main, ed.texto ?? ed.titulo)
      if (typeof ed.x === 'number' || typeof ed.y === 'number') {
        const dx = (ed.x ?? main.x) - main.x, dy = (ed.y ?? main.y) - main.y
        for (const e of [...all, ...added.filter((a) => all.some((m) => m.id === a.containerId))]) set(e.id, { x: e.x + dx, y: e.y + dy })
      }
    }
    if (missing.length && missing.length === edits.length) return `Não achei no quadro: ${missing.join(', ')}. Leia o quadro (quadro_ler) para ver os ids.`
    return { patch, added }
  }, agents)
}

/** Liga itens que já estão no quadro com setas (de → para). */
export function linkBoardItems(boardId: string, teamId: string, links: { de: string; para: string; texto?: string; cor?: string }[], agents?: AgentPointer[]) {
  return applyChanges(boardId, teamId, (els, X) => {
    const byId = new Map(els.filter((e) => !e.isDeleted).map((e) => [e.id, e]))
    const added: Raw[] = []
    const patch = new Map<string, Record<string, unknown>>()
    for (const l of links) {
      const a = byId.get(l.de), b = byId.get(l.para)
      if (!a || !b || a === b) continue
      const skel = arrowSkeleton(a, b, { text: l.texto, color: l.cor ? strongOf(stickyColor(l.cor)) : undefined })
      delete skel.start
      delete skel.end
      const made = X.convertToExcalidrawElements([skel] as Skel, { regenerateIds: false }) as unknown as Raw[]
      const arrow = made[0]
      Object.assign(arrow, { startBinding: { elementId: a.id, focus: 0, gap: 8 }, endBinding: { elementId: b.id, focus: 0, gap: 8 } })
      added.push(...made)
      for (const t of [a, b]) {
        const prev = (patch.get(t.id)?.boundElements as { id: string; type: string }[] | undefined) ?? ((t.boundElements as { id: string; type: string }[] | null) ?? [])
        patch.set(t.id, { boundElements: [...prev, { id: arrow.id, type: 'arrow' }] })
      }
    }
    if (!added.length) return 'Não achei os dois itens de nenhuma ligação. Leia o quadro (quadro_ler) para ver os ids.'
    return { patch, added }
  }, agents)
}


// ---------- desenho livre (lápis) ----------

/** A letra de mão do Excalidraw (Excalifont), para os textos de uma ilustração. */
const HAND = 5

/**
 * Desenha os itens no quadro (2026-11-07, "use o lápis e faça uma ilustração do nosso funil"): traços de lápis
 * que crescem da ponta com o cursor do agente acompanhando, formas e linhas em esboço e textos de mão. Sem
 * `absoluto`, a ilustração entra embaixo do que já existe. Um passo só no desfazer.
 */
export async function drawSketch(boardId: string, teamId: string, items: SketchItem[], opts: { absoluto?: boolean } = {}, agents?: AgentPointer[]) {
  const X = await lib()
  await ensureFonts(X, items.map((i) => ('texto' in i ? i.texto ?? '' : '')).join(' '), HAND)
  const open = openBoard(boardId)
  const place = (els: El[]) => {
    const b = opts.absoluto ? null : bounds(els)
    return { ox: b?.minX ?? 0, oy: b ? b.maxY + 160 : 0 }
  }
  const build = (ox: number, oy: number) => {
    const out: { els: El[]; stroke?: boolean; grupo?: string }[] = []
    const grouped = (els: El[], g?: string) => { if (g) for (const e of els) (e as { groupIds?: string[] }).groupIds = [g]; return els }
    items.forEach((it, n) => {
      if (it.tipo === 'traco') {
        const abs = pencil(it.pontos.map(([x, y]) => [x + ox, y + oy] as [number, number]), it.fechado, n + 1, it.tremor ?? 1.5)
        const minX = Math.min(...abs.map((p) => p[0])), minY = Math.min(...abs.map((p) => p[1]))
        const [el] = X.restoreElements([{
          type: 'freedraw', id: `ia${Math.random().toString(36).slice(2, 12)}${n}`, x: minX, y: minY,
          width: Math.max(...abs.map((p) => p[0])) - minX, height: Math.max(...abs.map((p) => p[1])) - minY,
          points: abs.map(([x, y]) => [x - minX, y - minY]), pressures: [], simulatePressure: true,
          strokeColor: it.cor ?? '#1e1e1e', backgroundColor: 'transparent', strokeWidth: Math.max(1, Math.min(4, it.espessura ?? 2)), roughness: 0,
        } as never], null) as unknown as El[]
        out.push({ els: grouped([el], it.grupo), stroke: true, grupo: it.grupo })
        return
      }
      if (it.tipo === 'linha') {
        const [x0, y0] = it.pontos[0]
        const skel = {
          type: it.seta ? 'arrow' : 'line', x: x0 + ox, y: y0 + oy, points: it.pontos.map(([x, y]) => [x - x0, y - y0]),
          strokeColor: it.cor ?? '#1e1e1e', backgroundColor: it.preenchimento ?? 'transparent', fillStyle: 'hachure', strokeWidth: 2, roughness: 1,
          ...(it.seta ? { endArrowhead: 'arrow' } : {}),
        }
        out.push({ els: grouped(X.convertToExcalidrawElements([skel] as Skel, { regenerateIds: true }) as unknown as El[], it.grupo), grupo: it.grupo })
        return
      }
      if (it.tipo === 'forma') {
        const skel = {
          type: it.forma === 'elipse' ? 'ellipse' : it.forma === 'losango' ? 'diamond' : 'rectangle', x: it.x + ox, y: it.y + oy, width: it.largura, height: it.altura,
          strokeColor: it.cor ?? '#1e1e1e', backgroundColor: it.preenchimento ?? 'transparent', fillStyle: it.solido ? 'solid' : 'hachure', strokeWidth: it.solido ? 1 : 2, roughness: it.solido ? 0 : 1,
          ...(it.solido ? { roundness: { type: 3, value: 18 } } : {}),
          ...(it.texto ? { label: { text: it.texto, fontSize: 20, fontFamily: HAND, strokeColor: '#1e1e1e' } } : {}),
        }
        out.push({ els: grouped(X.convertToExcalidrawElements([skel] as Skel, { regenerateIds: true }) as unknown as El[], it.grupo), grupo: it.grupo })
        return
      }
      const [t] = X.convertToExcalidrawElements([{ type: 'text', x: it.x + ox, y: it.y + oy, text: it.texto, fontSize: Math.max(10, Math.min(72, it.tamanho ?? 20)), fontFamily: HAND, strokeColor: it.cor ?? '#1e1e1e' }] as Skel, { regenerateIds: true }) as unknown as El[]
      if (it.centro) t.x -= t.width / 2
      out.push({ els: grouped([t], it.grupo), grupo: it.grupo })
    })
    return out
  }

  if (open) {
    const { ox, oy } = place(open.api.getSceneElementsIncludingDeleted() as unknown as El[])
    const parts = build(ox, oy)
    const all = parts.flatMap((p) => p.els)
    open.api.scrollToContent(all as never, { fitToContent: true, animate: true })
    // Cada traço cresce da ponta (o cursor do agente vai junto); o resto entra de uma vez, com o cursor no meio
    // Cada desenho (um boneco, a mesa, o notebook) é uma peça só, feita traço por traço pelo mesmo agente; cada
    // traço cresce da ponta (em menos partes quando é um traço curto de um desenho)
    const units: Unit[] = []
    let open1: { g: string; unit: Unit } | null = null
    for (const part of parts) {
      const steps: Step[] = []
      if (part.stroke) {
        const el = part.els[0] as El & { points: [number, number][] }
        const chunks = part.grupo ? Math.min(4, Math.max(2, Math.round(el.points.length / 10))) : Math.min(16, Math.max(4, Math.round(el.points.length / 8)))
        for (let k = 1; k <= chunks; k++) {
          const upto = Math.max(2, Math.round((el.points.length * k) / chunks))
          const tip = el.points[upto - 1]
          steps.push({ at: { x: el.x + tip[0], y: el.y + tip[1] }, els: [{ ...el, points: el.points.slice(0, upto) } as El] })
        }
      } else steps.push({ at: centerOf(part.els), els: part.els })
      if (part.grupo && open1?.g === part.grupo) open1.unit.push(...steps)
      else { const unit = steps; units.push(unit); open1 = part.grupo ? { g: part.grupo, unit } : null }
    }
    const done = new Set<string>()
    await crew(open, X, agents, units, (step) => {
      const now = open.api.getSceneElementsIncludingDeleted() as unknown as El[]
      const ids = new Set(step.els.map((e) => e.id))
      const kept = now.filter((e) => !ids.has(e.id))
      const fresh = step.els.map((e) => (done.has(e.id) ? X.newElementWith(now.find((x) => x.id === e.id) as never, { points: (e as { points?: unknown }).points } as never) : e))
      for (const e of step.els) done.add(e.id)
      open.api.updateScene({ elements: [...kept, ...fresh] as never, captureUpdate: X.CaptureUpdateAction.NEVER })
    }, { arrive: 520, part: 140, after: 60 })
    return { count: all.length, live: true }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const board = await loadBoard(boardId)
    if (!board || board.teamId !== teamId) throw new Error('Quadro não encontrado nesta conta.')
    const els = board.scene.elements as El[]
    const { ox, oy } = place(els)
    const all = build(ox, oy).flatMap((p) => p.els)
    const rev = await saveScene(boardId, board.rev, { ...board.scene, elements: [...els, ...all] })
    if (rev !== null) return { count: all.length, live: false }
  }
  throw new Error('O quadro está sendo editado agora; tente de novo.')
}
