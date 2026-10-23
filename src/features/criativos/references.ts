import { AV_CASES } from '@/features/avence/cases'
import { loadProjectDoc } from '@/features/projects/storage'
import { parseDesignMd } from '@/features/space/brand/designMd'
import type { SectionNodeData } from '@/types/space'
import { slidePreview } from './ai'
import { allowImages } from './applyOps'
import { downloadImageViaLink } from './link'
import { uploadAsset } from './storage'
import { useEditor } from './store'
import { caseImage } from './library'
import type { ImageMap } from './render'
import type { Ref } from './refStore'
import type { CreativeSet } from './types'

/**
 * Transforma o que foi marcado com @ no que a IA lê: o post ou slide inteiro
 * (com imagem), o projeto da conta (briefing, marca, páginas e os textos que
 * estão nelas) ou o case (fatos e imagens). Só o que foi marcado vai junto.
 */

export interface ResolvedRef {
  kind: Ref['kind']
  label: string
  text: string
  /** Imagens (data URL) que a IA vê junto. */
  images: string[]
}

/** Textos que aparecem no Elementor de uma seção (títulos, parágrafos, botões), sem HTML. */
function elementorTexts(json: string, limit = 10): string[] {
  const out: string[] = []
  const clean = (t: unknown) => String(t ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes) || out.length >= limit) return
    for (const node of nodes as { settings?: Record<string, unknown>; widgetType?: string; elements?: unknown }[]) {
      const s = node.settings ?? {}
      for (const key of ['title', 'editor', 'text', 'title_text', 'description_text', 'description']) {
        const t = clean(s[key])
        if (t.length > 2 && t.length <= 220 && !out.includes(t)) out.push(t)
      }
      walk(node.elements)
      if (out.length >= limit) return
    }
  }
  try {
    walk(JSON.parse(json))
  } catch {
    // seção sem JSON legível
  }
  return out.slice(0, limit)
}

const IMAGE_URL = /\.(png|jpe?g|webp|gif)(\?|#|$)|\/wp-content\/uploads\//i

/** Endereços de imagem usados num Elementor (fundos, fotos, galerias), na ordem em que aparecem. */
function elementorImages(json: string): string[] {
  const out: string[] = []
  const visit = (value: unknown, depth = 0) => {
    if (depth > 8 || out.length > 40) return
    if (Array.isArray(value)) return value.forEach((v) => visit(v, depth + 1))
    if (!value || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'url' && typeof v === 'string' && IMAGE_URL.test(v) && !/placeholder|\.svg/i.test(v) && !out.includes(v)) out.push(v)
      else visit(v, depth + 1)
    }
  }
  try {
    visit(JSON.parse(json))
  } catch {
    // seção sem JSON legível
  }
  return out
}

/** As páginas de um projeto (para escolher uma). Guarda o resultado: abrir o mesmo projeto de novo não lê tudo outra vez. */
const pageCache = new Map<string, { id: string; name: string }[]>()
export async function projectPages(projectId: string): Promise<{ id: string; name: string }[]> {
  const hit = pageCache.get(projectId)
  if (hit) return hit
  const cloud = await loadProjectDoc(projectId)
  const pages = (cloud?.doc?.canvas.pages ?? []).map((p) => ({ id: p.id, name: p.name }))
  pageCache.set(projectId, pages)
  return pages
}

/** Traz as fotos de uma página para o conjunto: as do app entram como estão; as da web são baixadas pelo conector e guardadas. */
async function bringImages(urls: string[], label: string): Promise<{ src: string; label: string }[]> {
  const out: { src: string; label: string }[] = []
  const set = useEditor.getState().set
  if (!set) return out
  await Promise.all(
    urls.slice(0, 6).map(async (url, i) => {
      try {
        if (url.startsWith('/')) return void out.push({ src: url, label: `${label} · foto ${i + 1}` })
        const { data } = await downloadImageViaLink(url)
        const blob = await (await fetch(data)).blob()
        const name = decodeURIComponent(url.split('?')[0].split('/').pop() || `foto-${i + 1}.jpg`)
        const asset = await uploadAsset(useEditor.getState().set!, blob, name)
        useEditor.getState().draft((s) => ({ ...s, assets: [...s.assets, asset] }))
        out.push({ src: `asset:${asset.id}`, label: `${label} · foto ${i + 1}` })
      } catch {
        // Foto que não baixou: o resto segue
      }
    })
  )
  if (out.length) useEditor.getState().persist()
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

/** O projeto da conta como fonte de conteúdo: briefing, marca e o que as páginas dizem. */
async function describeProject(ref: Ref): Promise<ResolvedRef & { logos: { src: string; label: string }[] }> {
  const cloud = await loadProjectDoc(ref.projectId!)
  if (!cloud?.doc) return { kind: 'project', label: ref.label, text: `Projeto "${ref.label}": não consegui abrir o conteúdo.`, images: [], logos: [] }
  const doc = cloud.doc
  const parsed = doc.brand?.source?.trim() ? parseDesignMd(doc.brand.source).brand : null
  const nodes = new Map(doc.canvas.nodes.map((n) => [n.id, n]))
  const allPages = doc.canvas.pages ?? []
  const chosen = ref.pageId ? allPages.filter((p) => p.id === ref.pageId) : allPages.slice(0, 8)
  const urls: string[] = []
  const pages = chosen.map((page) => {
    const sections = page.sectionIds.slice(0, ref.pageId ? 40 : 12).map((id) => {
      const data = nodes.get(id)?.data as SectionNodeData | undefined
      if (!data) return undefined
      if (ref.pageId) for (const u of elementorImages(data.elementorJson)) if (!urls.includes(u)) urls.push(u)
      return { title: data.title, texts: elementorTexts(data.elementorJson, ref.pageId ? 14 : 6) }
    })
    return `- Página "${page.name}":\n${sections.flatMap((s) => (s ? [`  · ${s.title}${s.texts.length ? `: ${s.texts.map((t) => `"${t}"`).join(' · ')}` : ''}`] : [])).join('\n')}`
  })
  const logos = [parsed?.logo?.onLight && { src: parsed.logo.onLight, label: `Logo de ${ref.label} (fundo claro)` }, parsed?.logo?.onDark && { src: parsed.logo.onDark, label: `Logo de ${ref.label} (fundo escuro)` }, parsed?.logo?.symbol && { src: parsed.logo.symbol, label: `Símbolo de ${ref.label}` }].filter(Boolean) as { src: string; label: string }[]
  const photos = ref.pageId ? await bringImages(urls, ref.label) : []
  const text = [
    ref.pageId ? `Página escolhida do projeto (um cliente da conta): ${ref.label}.` : `Projeto "${ref.label}" (um cliente da conta), todas as páginas.`,
    parsed ? `Marca: cores ${parsed.colors.map((c) => `${c.name} ${c.hex}`).join(', ')}; fonte de títulos ${parsed.fonts.heading?.family ?? '?'}, de texto ${parsed.fonts.body?.family ?? '?'}.` : 'Sem marca definida.',
    logos.length ? `Logos disponíveis para camadas de imagem (src): ${logos.map((l) => `${l.src} (${l.label})`).join('; ')}` : '',
    photos.length ? `Fotos desta página, já no conjunto, para camadas de imagem (src): ${photos.map((p) => `${p.src} (${p.label})`).join('; ')}` : ref.pageId && urls.length ? 'A página tem fotos, mas nenhuma foi baixada (o conector não conseguiu).' : '',
    !ref.pageId && allPages.length > 1 ? `Páginas do projeto (marque uma com @ para trazer só ela, com as fotos): ${allPages.map((p) => `"${p.name}"`).join(', ')}.` : '',
    pages.length ? `O que ${ref.pageId ? 'a página diz' : 'as páginas dizem'} (use só estes fatos):\n${pages.join('\n')}` : 'Sem páginas.',
  ]
    .filter(Boolean)
    .join('\n')
  return { kind: 'project', label: ref.label, text, images: [], logos: [...logos, ...photos] }
}

export async function resolveRefs(refs: Ref[], set: CreativeSet, images: ImageMap, projectName: (id: string) => string | undefined): Promise<{ refs: ResolvedRef[]; extra: { src: string; label: string }[] }> {
  const out: ResolvedRef[] = []
  const extra: { src: string; label: string }[] = []
  for (const ref of refs.slice(0, 8)) {
    if (ref.kind === 'post') {
      const post = set.posts.find((p) => p.id === ref.postId)
      if (!post) continue
      out.push({ kind: 'post', label: ref.label, text: `Post "${post.name}" (id ${post.id}, formato ${post.format}) deste conjunto, com todos os slides:\n${JSON.stringify(post.slides)}\nLegenda: ${post.caption ?? '(sem legenda)'}`, images: post.slides.slice(0, 8).map((s) => slidePreview(s, post.format, images, 400)) })
    } else if (ref.kind === 'slide') {
      const post = set.posts.find((p) => p.id === ref.postId)
      const slide = post?.slides.find((s) => s.id === ref.slideId)
      if (!post || !slide) continue
      out.push({ kind: 'slide', label: ref.label, text: `Slide ${post.slides.indexOf(slide) + 1} do post "${post.name}" (slide id ${slide.id}, formato ${post.format}):\n${JSON.stringify(slide)}`, images: [slidePreview(slide, post.format, images, 540)] })
    } else if (ref.kind === 'case') {
      const list = ref.slug === '*' || !ref.slug ? AV_CASES : AV_CASES.filter((c) => c.slug === ref.slug)
      out.push({
        kind: 'case',
        label: ref.label,
        text: list.map((c) => `Case ${c.name} (slug ${c.slug}): ${c.segment}${c.place ? `, ${c.place}` : ''}. ${c.summary} (${c.stack}). Imagens (src): capa ${caseImage(c, 'capa').src}, página do computador ${caseImage(c, 'pagina').src}, celular ${caseImage(c, 'celular').src}`).join('\n'),
        images: [],
      })
    } else if (ref.kind === 'project' && ref.projectId) {
      try {
        const described = await describeProject({ ...ref, label: projectName(ref.projectId) ?? ref.label })
        extra.push(...described.logos)
        out.push(described)
      } catch {
        out.push({ kind: 'project', label: ref.label, text: `Projeto "${ref.label}": não consegui ler o conteúdo.`, images: [] })
      }
    }
  }
  allowImages(extra.map((e) => e.src))
  return { refs: out, extra }
}
