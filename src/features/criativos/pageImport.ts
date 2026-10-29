import { renderElementorDocument } from '@/engine/elementor'
import type { ProjectDoc } from '@/features/projects/types'
import { loadProjectDoc } from '@/features/projects/storage'
import { parseDesignMd } from '@/features/space/brand/designMd'
import { buildLandingPage } from '@/features/space/landingPage'
import { pageSections } from '@/features/space/pages/pages'
import { isFromSite, renderKit } from '@/features/space/renderKit'
import { capturePageViaLink } from './link'
import { pageSlideCount, pageWindowSlide, sidewaysSlides } from './templates'
import { uploadAsset } from './storage'
import { useEditor } from './store'
import { uid, type CreativeSet, type Post, type SetAsset } from './types'

/**
 * Importar uma página de outro projeto da conta: o app monta a página com a
 * marca do projeto dela (o mesmo caminho que gera o HTML do Space), o conector
 * deste computador fotografa a página inteira com o navegador, e a foto entra
 * no conjunto como imagem, para virar cards ou ser usada pela IA.
 */

export interface PageShot {
  asset: SetAsset
  name: string
  projectName?: string
  /** Três recortes (topo, meio e fim), para a IA enxergar a página. */
  crops: string[]
}

/** A página de um projeto (já aberto) como documento HTML completo, sem animação de entrada, na marca do projeto. */
export function htmlFromDoc(doc: ProjectDoc, pageId: string): { html: string; name: string } {
  const page = (doc.canvas.pages ?? []).find((p) => p.id === pageId)
  if (!page) throw new Error('A página não está mais no projeto.')
  const brand = doc.brand?.source?.trim() ? parseDesignMd(doc.brand.source).brand : null
  const sections = pageSections(page, doc.canvas.nodes)
  const landing = buildLandingPage(sections, doc.canvas.nodes, doc.canvas.connections ?? [], brand)
  if (!landing.elements.length) throw new Error(`A página "${page.name}" não tem seções para mostrar.`)
  const kit = renderKit(brand, doc.site ?? null, sections.some(isFromSite))
  const document = renderElementorDocument(landing.elements, { title: page.name, kit, motion: 'static' }).document
  // A captura abre um arquivo temporário: assets do produto precisam da origem HTTP.
  const html = document.replace('<head>', `<head><base href="${location.origin}/">`).replace(/loading=["']lazy["']/g, 'loading="eager"')
  return { html, name: page.name }
}

/** A página do projeto da conta como documento HTML completo. */
export async function buildPageHtml(projectId: string, pageId: string): Promise<{ html: string; name: string }> {
  const cloud = await loadProjectDoc(projectId)
  if (!cloud?.doc) throw new Error('Não consegui abrir o projeto.')
  return htmlFromDoc(cloud.doc, pageId)
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não consegui abrir a foto da página.'))
    img.src = src
  })

const toJpeg = (canvas: HTMLCanvasElement, quality: number) => canvas.toDataURL('image/jpeg', quality)

/** Fotografa a página, guarda a foto no conjunto e devolve também três recortes para a IA ver. */
export async function capturePageShot(projectId: string, pageId: string, projectName?: string, signal?: AbortSignal): Promise<PageShot> {
  const { html, name } = await buildPageHtml(projectId, pageId)
  const shot = await capturePageViaLink(html, 1280, signal)
  const img = await loadImg(shot.data)
  // PNG de página inteira pesa: guarda como JPEG
  const full = document.createElement('canvas')
  full.width = img.naturalWidth
  full.height = img.naturalHeight
  const ctx = full.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, full.width, full.height)
  ctx.drawImage(img, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => full.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui guardar a foto da página.'))), 'image/jpeg', 0.88))
  const set = useEditor.getState().set!
  const asset = await uploadAsset(set, blob, `pagina-${name}.jpg`)
  useEditor.getState().draft((s) => ({ ...s, assets: [...s.assets, asset] }))
  useEditor.getState().persist()

  // Topo, meio e fim, a 720 px de largura, para a IA enxergar a página (a página inteira numa imagem só perderia o detalhe)
  const cropH = Math.min(img.naturalHeight, Math.round(img.naturalWidth * 1.25))
  const crops = [0, (img.naturalHeight - cropH) / 2, img.naturalHeight - cropH].map((y) => {
    const c = document.createElement('canvas')
    c.width = 720
    c.height = Math.round((cropH * 720) / img.naturalWidth)
    c.getContext('2d')!.drawImage(full, 0, y, img.naturalWidth, cropH, 0, 0, c.width, c.height)
    return toJpeg(c, 0.8)
  })
  return { asset, name, projectName, crops: img.naturalHeight > cropH * 1.2 ? crops : crops.slice(0, 1) }
}

/** A página vira um post novo: cards com a janela de navegador rolando do topo ao fim. */
export async function importPageAsPost(projectId: string, pageId: string, projectName: string, signal?: AbortSignal): Promise<Post> {
  const shot = await capturePageShot(projectId, pageId, projectName, signal)
  const set = useEditor.getState().set as CreativeSet
  const format = '4x5'
  const { asset } = shot
  const total = pageSlideCount(format, asset.width, asset.height)
  const slides = Array.from({ length: total }, (_, index) => pageWindowSlide(set.brand, format, { src: `asset:${asset.id}`, imgW: asset.width, imgH: asset.height, index, total, title: shot.name, label: projectName, dark: index % 2 === 0 }))
  const post: Post = { id: uid(), name: `Página · ${projectName} › ${shot.name}`, format, slides }
  useEditor.getState().edit((s) => ({ ...s, posts: [...s.posts, post] }))
  useEditor.getState().selectPost(post.id)
  void useEditor.getState().ensureAssets()
  return post
}

/** O carrossel "case + site de lado": capa só com o case e a página inteira deitada correndo pelos outros cards. */
export async function importPageSideways(projectId: string, pageId: string, projectName: string, signal?: AbortSignal): Promise<Post> {
  const shot = await capturePageShot(projectId, pageId, projectName, signal)
  const set = useEditor.getState().set as CreativeSet
  const { asset } = shot
  const slides = sidewaysSlides(set.brand, '4x5', { src: `asset:${asset.id}`, imgW: asset.width, imgH: asset.height, title: projectName, sub: shot.name, label: set.brand.name })
  const post: Post = { id: uid(), name: `Carrossel · ${projectName} › ${shot.name}`, format: '4x5', slides }
  useEditor.getState().edit((s) => ({ ...s, posts: [...s.posts, post] }))
  useEditor.getState().selectPost(post.id)
  void useEditor.getState().ensureAssets()
  return post
}
