import React from 'react'
import { CaptureUpdateAction, convertToExcalidrawElements, restoreElements } from '@excalidraw/excalidraw'
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement, ExcalidrawEmbeddableElement, NonDeleted } from '@excalidraw/excalidraw/element/types'
import { ExternalLink } from 'lucide-react'
import { FONT } from './layout'

/**
 * Itens do sistema no quadro (2026-11-11, o usuário: "quero conseguir lincar arquivos do sistema… criativos e seus
 * assets… lincar uma página de vendas, um site, um formulário customizado, um dashboard, um funil; tudo isso como é
 * hoje vai estar ali pra visualizar e colaborar").
 *   - Páginas do app (projeto do Space, site em código, formulário, funil, dashboards): um `embeddable` do Excalidraw
 *     com `customData.system`; o quadro mostra a tela de verdade num iframe da mesma origem (`?embed=1`, sem menu),
 *     com a sessão de quem está olhando. Formulário publicado abre como o cliente vê (`/f/:id`).
 *   - Criativos e arquivos: imagens no quadro (os slides de cada post numa linha, dentro de um frame com o nome),
 *     com o link de volta para o editor. As imagens sobem como qualquer imagem colada (`tick` do editor).
 */

export type SystemKind = 'pagina' | 'site' | 'formulario' | 'funil' | 'dashboard' | 'link'
export interface SystemRef { kind: SystemKind; name: string; path: string; publicPath?: string }

export const KIND_LABEL: Record<SystemKind, string> = {
  pagina: 'Página', site: 'Site', formulario: 'Formulário', funil: 'Funil', dashboard: 'Dashboard', link: 'Link',
}
const SIZE: Record<SystemKind, [number, number]> = {
  pagina: [1200, 760], site: [1200, 760], formulario: [520, 760], funil: [1100, 720], dashboard: [1200, 760], link: [1100, 700],
}

type El = ExcalidrawElement & { customData?: Record<string, unknown> }
type Skel = Parameters<typeof convertToExcalidrawElements>[0]
const uid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4)

const APP_HOSTS = ['app.avencestudio.com']
/** Endereço do próprio app (aqui, no domínio publicado ou em localhost): pode aparecer no quadro. */
export function isAppLink(link: string): boolean {
  try {
    const u = new URL(link, window.location.origin)
    return u.host === window.location.host || APP_HOSTS.includes(u.host) || u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch { return false }
}

/** O endereço que o iframe abre: sempre na origem de quem olha, com `embed=1` (sem menu e sem a Iara) nas telas do app. */
export function frameSrc(ref: SystemRef): string {
  const path = ref.publicPath ?? ref.path
  if (/^https?:\/\//.test(path) && !isAppLink(path)) return path
  const u = new URL(path, window.location.origin)
  const local = `${window.location.origin}${u.pathname}${u.search}${u.hash}`
  if (ref.publicPath || u.pathname.startsWith('/f/')) return local
  return `${local}${u.search ? '&' : '?'}embed=1`
}

/** Centro da tela no quadro. */
const viewCenter = (api: ExcalidrawImperativeAPI) => {
  const s = api.getAppState()
  const z = s.zoom.value
  return { x: -s.scrollX + s.width / 2 / z, y: -s.scrollY + s.height / 2 / z }
}

/**
 * Onde cabe um bloco de `w`×`h` perto do centro da tela sem cobrir nada: o centro, ou à direita, embaixo,
 * à esquerda e em cima, cada vez mais longe (o canto de cima à esquerda do lugar).
 */
function freeSpot(api: ExcalidrawImperativeAPI, w: number, h: number): { x: number; y: number } {
  const c = viewCenter(api)
  const taken = (api.getSceneElements() as readonly El[]).filter((e) => !(e.type === 'text' && (e as { containerId?: string | null }).containerId) && !e.frameId)
  const free = (x: number, y: number) => !taken.some((e) => x < e.x + e.width + 40 && e.x < x + w + 40 && y < e.y + e.height + 40 && e.y < y + h + 40)
  const x0 = c.x - w / 2, y0 = c.y - h / 2
  if (free(x0, y0)) return { x: x0, y: y0 }
  for (let k = 1; k <= 12; k++) {
    const dx = k * (w / 2 + 80), dy = k * (h / 2 + 80)
    for (const [x, y] of [[x0 + dx, y0], [x0, y0 + dy], [x0 - dx, y0], [x0, y0 - dy], [x0 + dx, y0 + dy]]) if (free(x, y)) return { x, y }
  }
  return { x: x0, y: y0 }
}

const settle = (api: ExcalidrawImperativeAPI, added: El[], select: string[]) => {
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...added] as ExcalidrawElement[],
    appState: { selectedElementIds: Object.fromEntries(select.map((id) => [id, true])) },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  api.setActiveTool({ type: 'selection' })
  api.scrollToContent(added as ExcalidrawElement[], { fitToViewport: true, viewportZoomFactor: 0.8, animate: true })
}

/** Uma tela do sistema no quadro, ao vivo. */
export function insertSystemEmbed(api: ExcalidrawImperativeAPI, ref: SystemRef) {
  const [w, h] = SIZE[ref.kind]
  const c = freeSpot(api, w, h)
  const link = new URL(ref.publicPath ?? ref.path, window.location.origin).toString()
  // O convertToExcalidrawElements passa embeddable sem os campos padrão (selecionar quebrava o canvas): o restore completa
  const [el] = restoreElements([{
    type: 'embeddable', id: uid(), x: c.x, y: c.y, width: w, height: h, link,
    strokeColor: '#d4d4d0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100,
    roundness: { type: 3 }, angle: 0, groupIds: [], frameId: null, boundElements: null, locked: false, isDeleted: false,
    customData: { system: ref },
  }] as unknown as ExcalidrawElement[], null) as unknown as El[]
  settle(api, [el], [el.id])
}

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

/** Tamanho da imagem (também SVG, que o createImageBitmap não lê em todo navegador). */
const sizeOfBlob = (blob: Blob) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => { resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 800 }); URL.revokeObjectURL(url) }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem ilegível')) }
  img.src = url
})

export interface ImageRow { title?: string; blobs: Blob[] }

/**
 * Imagens no quadro: cada linha (um post) com os slides lado a lado, na mesma altura; o conjunto inteiro num frame
 * com o nome e o link para abrir no sistema. Uma imagem solta (logo, foto do Cérebro) entra sem frame.
 */
export async function insertImages(api: ExcalidrawImperativeAPI, rows: ImageRow[], opts: { frame?: string; link?: string; rowHeight?: number } = {}) {
  const H = opts.rowHeight ?? 420
  const GAP = 24
  const TITLE = 40
  const files: BinaryFileData[] = []
  const skel: Record<string, unknown>[] = []
  const ids: string[] = []
  let y = 0
  let maxW = 0
  for (const row of rows) {
    if (!row.blobs.length) continue
    if (row.title && rows.length > 1) {
      skel.push({ type: 'text', id: uid(), x: 0, y, text: row.title, fontSize: 20, fontFamily: FONT, strokeColor: '#55534e' })
      ids.push(skel[skel.length - 1].id as string)
      y += TITLE
    }
    let x = 0
    for (const blob of row.blobs) {
      const { width, height } = await sizeOfBlob(blob)
      const h = Math.min(H, height), w = (width / height) * h
      const fileId = `sistema-${uid()}`
      files.push({ id: fileId as BinaryFileData['id'], dataURL: (await toDataUrl(blob)) as BinaryFileData['dataURL'], mimeType: (blob.type || 'image/png') as BinaryFileData['mimeType'], created: Date.now() })
      const id = uid()
      skel.push({ type: 'image', id, x, y, width: w, height: h, fileId, status: 'saved', ...(opts.link ? { link: new URL(opts.link, window.location.origin).toString() } : {}) })
      ids.push(id)
      x += w + GAP
    }
    maxW = Math.max(maxW, x - GAP)
    y += H + GAP * 2
  }
  if (!ids.length) return
  const totalH = y - GAP * 2
  // Perto do centro da tela, onde não cobre nada (com a margem do frame)
  const pad = opts.frame ? 32 : 0
  const spot = freeSpot(api, maxW + pad * 2, totalH + pad * 2)
  const ox = spot.x + pad, oy = spot.y + pad
  for (const s of skel) { s.x = (s.x as number) + ox; s.y = (s.y as number) + oy }
  if (opts.frame) {
    skel.push({ type: 'frame', id: uid(), name: opts.frame, children: ids, x: ox - 32, y: oy - 32, width: maxW + 64, height: totalH + 64 })
  }
  api.addFiles(files)
  const made = convertToExcalidrawElements(skel as unknown as Skel, { regenerateIds: false }) as unknown as El[]
  const frame = made.find((e) => e.type === 'frame')
  settle(api, made, frame ? [frame.id] : made.map((e) => e.id))
}

export const systemOf = (el: { customData?: Record<string, unknown> | null }): SystemRef | undefined => {
  const s = el.customData?.system as SystemRef | undefined
  return s && typeof s.path === 'string' ? s : undefined
}

/** Como uma tela do sistema aparece no quadro: barra com o tipo e o nome, e a tela de verdade embaixo. */
export function renderSystemEmbed(element: NonDeleted<ExcalidrawEmbeddableElement>): JSX.Element | null {
  const ref = systemOf(element as unknown as El)
  if (!ref) return null
  const src = frameSrc(ref)
  const open = /^https?:\/\//.test(ref.path) && !isAppLink(ref.path) ? ref.path : new URL(ref.path, window.location.origin).pathname + new URL(ref.path, window.location.origin).search
  return (
    <div className="qd-embed">
      <div className="qd-embed-bar">
        <span className="qd-embed-kind">{KIND_LABEL[ref.kind]}</span>
        <span className="qd-embed-name" title={ref.name}>{ref.name}</span>
        <a className="qd-embed-open" href={open} target="_blank" rel="noreferrer" title="Abrir em outra aba">
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </a>
      </div>
      <iframe
        className="qd-embed-frame" src={src} title={`${KIND_LABEL[ref.kind]}: ${ref.name}`} loading="lazy" allow="clipboard-write; fullscreen"
        {...(isAppLink(src) ? {} : { sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups' })}
      />
    </div>
  )
}

/** Telas do app que funcionam como painel (as mesmas do menu). */
export const DASHBOARDS: { path: string; name: string; hint: string }[] = [
  { path: '/inicio', name: 'Início', hint: 'O resumo da conta' },
  { path: '/crm', name: 'Leads', hint: 'Oportunidades e pipeline' },
  { path: '/crm/site', name: 'Visitas do site', hint: 'Visitas, mapa e origem' },
  { path: '/crm/instagram', name: 'Instagram', hint: 'Seguidores, alcance e posts' },
  { path: '/crm/anuncios', name: 'Anúncios', hint: 'Campanhas e resultados' },
  { path: '/crm/social', name: 'Relacionamento nas redes', hint: 'Social da equipe' },
  { path: '/crm/diagnostico', name: 'Diagnóstico', hint: 'Diagnóstico de site' },
  { path: '/crm/operacao', name: 'Operação ao vivo', hint: 'O que está acontecendo agora' },
  { path: '/crm/formularios', name: 'Formulários', hint: 'Todos os formulários e respostas' },
  { path: '/crm/funis', name: 'Funis de venda', hint: 'Todos os funis' },
]
