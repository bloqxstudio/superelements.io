import { summarize } from '@/features/projects/projectStore'
import { loadProjectDoc, saveProjectDoc } from '@/features/projects/storage'
import { callAi } from '@/features/criativos/link'
import type { PlanResponse } from '@/features/criativos/plan'
import { loadSet, saveSet } from '@/features/criativos/storage'
import { buildPost } from '@/features/criativos/templates'
import type { SetSummary } from '@/features/criativos/types'
import { parseDesignMd } from '@/features/space/brand/designMd'
import type { SpaceNode, SpacePage } from '@/types/space'
import { recordDelivery } from '@/features/operations/jobs'
import { formatById } from './knowledge'
import { htmlToMark } from './html'
import { plainOf, type Block, type CopyDoc } from './types'

/**
 * Enviar o texto para onde ele serve: um post de Criativos (o agente distribui o
 * texto aprovado nos slides, sem reescrever) ou uma página de Projetos (o texto
 * vira seções nativas do Elementor, que a marca do projeto estiliza).
 */

/** O documento como texto, com os rótulos de cada peça (o que o agente e o clipboard leem). */
export function docText(doc: CopyDoc): string {
  return doc.blocks
    .filter((b) => b.type !== 'note')
    .map((b) => {
      const text = htmlToMark(b.html).trim()
      if (b.type === 'divider') return '---'
      const body = b.type === 'h1' ? `# ${text}` : b.type === 'h2' ? `## ${text}` : b.type === 'h3' ? `### ${text}` : b.type === 'bullet' ? `- ${text}` : b.type === 'number' ? `1. ${text}` : b.type === 'quote' ? `> ${text}` : b.type === 'cta' ? `[Botão] ${text}` : text
      return b.label ? `${b.label.toUpperCase()}\n${body}` : body
    })
    .join('\n\n')
}

// ---------- Criativos ----------

export async function sendToCriativos(doc: CopyDoc, target: SetSummary, signal?: AbortSignal, count = 3): Promise<{ postName: string; postNames: string[]; slides: number }> {
  const story = doc.format === 'story'
  // Uma pesquisa não é um post: o agente tira dela vários posts, um ângulo em cada
  const research = doc.format === 'pesquisa'
  const plan = await callAi<PlanResponse>('copy-slides', { name: doc.folderName || doc.title, kind: research ? 'pesquisa' : story ? 'story' : 'post', count, text: docText(doc) }, signal)
  const plans = (plan.posts ?? []).filter((p) => p.slides?.length).slice(0, research ? 6 : 1)
  if (!plans.length) throw new Error('O agente não montou os slides.')
  const set = await loadSet(target.id, target.shared ? target.projectId : undefined)
  if (!set) throw new Error('Não achei o conjunto de criativos.')
  const posts = plans.map((p, i) => buildPost({ name: p.name || (research ? `${doc.folderName || doc.title} ${i + 1}` : doc.title || 'Post'), format: story ? '9x16' : '4x5', caption: p.caption, slides: p.slides }, set.brand))
  await saveSet({ ...set, posts: [...set.posts, ...posts], updatedAt: Date.now() })
  recordDelivery({ area: 'criativos', kind: posts.length > 1 ? `${posts.length} posts enviados` : 'Post enviado', label: `${doc.folderName || doc.title} → ${target.name}`, agent: 'Enviado da Copy', href: `/criativos/${target.id}${target.shared && target.projectId ? `?projeto=${target.projectId}` : ''}` })
  return { postName: posts[0].name, postNames: posts.map((p) => p.name), slides: posts.reduce((n, p) => n + p.slides.length, 0) }
}

/** Posts direto de um pedido (sem documento): o agente de criativos cria até 6 carrosséis no conjunto escolhido. */
export async function postsFromRequest(request: string, target: SetSummary, count: number, signal?: AbortSignal): Promise<{ postNames: string[] }> {
  const plan = await callAi<PlanResponse>('copy-slides', { name: request.slice(0, 80), kind: 'pesquisa', count, text: request }, signal)
  const plans = (plan.posts ?? []).filter((p) => p.slides?.length).slice(0, 6)
  if (!plans.length) throw new Error('O agente não montou os posts.')
  const set = await loadSet(target.id, target.shared ? target.projectId : undefined)
  if (!set) throw new Error('Não achei o conjunto de criativos.')
  const posts = plans.map((p, i) => buildPost({ name: p.name || `Post ${i + 1}`, format: '4x5', caption: p.caption, slides: p.slides }, set.brand))
  await saveSet({ ...set, posts: [...set.posts, ...posts], updatedAt: Date.now() })
  recordDelivery({ area: 'criativos', kind: posts.length > 1 ? `${posts.length} posts criados` : 'Post criado', label: `${request.slice(0, 60)} → ${target.name}`, agent: 'Pedido ao agente', href: `/criativos/${target.id}${target.shared && target.projectId ? `?projeto=${target.projectId}` : ''}` })
  return { postNames: posts.map((p) => p.name) }
}

// ---------- Projetos (landing page, site) ----------

const rid = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0')
const spacing = (v: number, lr = v) => ({ unit: 'px', top: String(v), right: String(lr), bottom: String(v), left: String(lr), isLinked: false })
const gap = (n: number) => ({ unit: 'px', size: n, column: String(n), row: String(n), isLinked: true })

const container = (elements: unknown[], settings: Record<string, unknown> = {}, inner = false) => ({
  id: rid(),
  elType: 'container',
  isInner: inner,
  settings: { content_width: 'boxed', flex_direction: 'column', flex_gap: gap(20), padding: spacing(inner ? 24 : 88, inner ? 24 : 24), ...settings },
  elements,
})
const heading = (title: string, size: 'h1' | 'h2' | 'h3' | 'h4') => ({ id: rid(), elType: 'widget', widgetType: 'heading', settings: { title, header_size: size }, elements: [] })
const textWidget = (html: string) => ({ id: rid(), elType: 'widget', widgetType: 'text-editor', settings: { editor: `<p>${html}</p>` }, elements: [] })
const button = (label: string) => ({ id: rid(), elType: 'widget', widgetType: 'button', settings: { text: plainOf(label), link: { url: '#contato', is_external: '', nofollow: '', custom_attributes: '' } }, elements: [] })
const iconList = (items: string[]) => ({
  id: rid(),
  elType: 'widget',
  widgetType: 'icon-list',
  settings: { icon_list: items.map((t) => ({ text: plainOf(t), _id: rid(), selected_icon: { value: 'fas fa-check', library: 'fa-solid' } })) },
  elements: [],
})

interface Group {
  label: string
  title: string
  blocks: Block[]
}

/** As seções: cada h1 ou h2 abre uma. */
function groups(blocks: Block[]): Group[] {
  const out: Group[] = []
  for (const b of blocks) {
    if (b.type === 'note' || b.type === 'divider') continue
    if (b.type === 'h1' || b.type === 'h2' || !out.length) {
      out.push({ label: b.label ?? plainOf(b.html), title: b.type === 'h1' || b.type === 'h2' ? b.html : '', blocks: b.type === 'h1' || b.type === 'h2' ? [] : [b] })
      continue
    }
    out[out.length - 1].blocks.push(b)
  }
  return out.filter((g) => g.title || g.blocks.length)
}

/** O que há dentro de uma seção: cartões (h3 + texto), passos, lista, texto, chamada. */
function content(g: Group): unknown[] {
  const out: unknown[] = []
  const cards: { title: string; body: string[] }[] = []
  const flushCards = () => {
    if (!cards.length) return
    const faq = /pergunta|faq|dúvida/i.test(g.label)
    const items = cards.splice(0)
    out.push(
      faq
        ? container(items.flatMap((c) => [heading(c.title, 'h4'), ...c.body.map((t) => textWidget(t))]), { content_width: 'full', padding: spacing(0), flex_gap: gap(12) }, true)
        : container(
            items.map((c) => container([heading(c.title, 'h3'), ...c.body.map((t) => textWidget(t))], { content_width: 'full', width: { unit: '%', size: items.length >= 3 ? 31 : 48, sizes: [] }, width_mobile: { unit: '%', size: 100, sizes: [] } }, true)),
            { content_width: 'full', flex_direction: 'row', flex_wrap: 'wrap', flex_direction_mobile: 'column', padding: spacing(0), flex_gap: gap(24) },
            true
          )
    )
  }
  let list: string[] = []
  const flushList = () => {
    if (list.length) out.push(iconList(list))
    list = []
  }
  let number = 0
  for (const b of g.blocks) {
    if (b.type === 'h3') {
      flushList()
      cards.push({ title: b.html, body: [] })
    } else if (b.type === 'p' && cards.length && !/^\s*$/.test(b.html)) cards[cards.length - 1].body.push(b.html)
    else if (b.type === 'number') {
      flushList()
      number += 1
      cards.push({ title: `${number}`, body: [b.html] })
    } else if (b.type === 'bullet') {
      flushCards()
      list.push(b.html)
    } else {
      flushCards()
      flushList()
      if (b.type === 'cta') out.push(button(b.html))
      else if (b.type === 'hook') out.push(heading(b.html, 'h3'))
      else if (b.type === 'quote') out.push(textWidget(`<em>${b.html}</em>`))
      else out.push(textWidget(b.html))
    }
  }
  flushCards()
  flushList()
  return out
}

/** As seções de uma página, em Elementor nativo, sem estilo próprio: a marca do projeto estiliza ao abrir. */
export function sections(blocks: Block[], first: boolean): { title: string; elementorJson: string }[] {
  return groups(blocks).map((g, i) => {
    const hero = first && i === 0
    const head = g.title ? [heading(g.title, hero ? 'h1' : 'h2')] : []
    return { title: plainOf(g.title) || g.label || `Seção ${i + 1}`, elementorJson: JSON.stringify([container([...head, ...content(g)], { padding: spacing(hero ? 120 : 88, 24) })]) }
  })
}

/** O documento em páginas: um site com vários h1 vira uma página por h1; o resto, uma página só. */
export function pagesOf(doc: CopyDoc): { name: string; blocks: Block[] }[] {
  const h1s = doc.blocks.filter((b) => b.type === 'h1')
  if (doc.format === 'site' && h1s.length >= 2) {
    const out: { name: string; blocks: Block[] }[] = []
    for (const b of doc.blocks) {
      if (b.type === 'h1') out.push({ name: b.label ?? (plainOf(b.html) || `Página ${out.length + 1}`), blocks: [] })
      else if (out.length) out[out.length - 1].blocks.push(b)
    }
    return out.filter((p) => p.blocks.length)
  }
  return [{ name: doc.title || formatById(doc.format).label, blocks: doc.blocks }]
}

export async function sendToProject(doc: CopyDoc, projectId: string): Promise<{ pages: string[]; sections: number }> {
  const cloud = await loadProjectDoc(projectId)
  if (!cloud?.doc) throw new Error('Não consegui abrir o projeto.')
  const project = cloud.doc
  const existing = project.canvas.pages ?? []
  const nodes: SpaceNode[] = []
  const created: SpacePage[] = []
  let x = existing.length ? Math.max(...existing.map((p) => p.x)) + 1600 : 0
  for (const page of pagesOf(doc)) {
    const secs = sections(page.blocks, true)
    if (!secs.length) continue
    const ids = secs.map(() => crypto.randomUUID())
    secs.forEach((data, i) => nodes.push({ id: ids[i], type: 'section', x, y: i * 760, width: 1200, height: 700, data } as SpaceNode))
    created.push({ id: crypto.randomUUID(), name: `Copy · ${page.name}`.slice(0, 80), x, y: 0, sectionIds: ids } as SpacePage)
    x += 1600
  }
  if (!created.length) throw new Error('O documento não tem texto para virar página.')
  const allNodes = [...project.canvas.nodes, ...nodes]
  const pages = [...existing, ...created]
  const brand = project.brand?.source?.trim() ? parseDesignMd(project.brand.source).brand : null
  const result = await saveProjectDoc(projectId, { ...project, canvas: { ...project.canvas, nodes: allNodes, pages } }, { base: cloud.revision, previousPath: cloud.path, summary: summarize(allNodes, brand, pages), edited: true })
  if ('conflict' in result) throw new Error('O projeto foi alterado por outra pessoa enquanto eu enviava. Tente de novo.')
  recordDelivery({ area: doc.format === 'site' ? 'sites' : 'landing', kind: created.length > 1 ? `${created.length} páginas enviadas` : 'Página enviada', label: `${created.map((p) => p.name).join(', ')}`.slice(0, 120), agent: 'Enviado da Copy', href: `/projetos/${projectId}` })
  return { pages: created.map((p) => p.name), sections: nodes.length }
}
