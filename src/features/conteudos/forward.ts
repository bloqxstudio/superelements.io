import { escapeHtml } from '@/features/copy/html'
import { createDocOnce, loadDoc, saveDoc } from '@/features/copy/storage'
import { block, plainOf, type CopyDoc } from '@/features/copy/types'
import { loadProjectDoc } from '@/features/projects/storage'
import { parseDesignMd } from '@/features/space/brand/designMd'
import { setBrandFrom } from '@/features/criativos/brand'
import { fillSetImages } from '@/features/criativos/generate'
import { useCreativeLink } from '@/features/criativos/link'
import { createSetOnce, loadSet, saveSet } from '@/features/criativos/storage'
import type { CreativeSet, SetBrand } from '@/features/criativos/types'
import { toast } from 'sonner'
import { linkContent } from './api'
import { accountBrand, aiCarousel, carouselPost } from './carousel'
import { briefOf, briefText, hashOf, joinParagraphs, scriptParagraphs, type AccountContext, type Content, type ContentLink } from './rules'

/**
 * Do conteúdo para o Copy e os Criativos. O documento e o conjunto são os mesmos de sempre
 * (Storage), com o id derivado do conteúdo: abrir de novo reaproveita. A primeira criação é
 * exclusiva (`createDocOnce`/`createSetOnce`, `upsert: false`): quem perde a corrida reaproveita o
 * material do vencedor e não sobrescreve edições. Erros de rede ou permissão não são tratados como
 * "não existe". Só a lista da pasta (index.json) segue sem trava, como em toda gravação (ver
 * `exclusive.ts`). O briefing sai do Plano da conta; o documento guarda o vínculo
 * de volta (`source`) e o servidor guarda o vínculo de ida (`crm_content_links`).
 *
 * Um documento ou conjunto sem projeto vive na pasta pessoal de quem o criou, e só essa pessoa o
 * abre. Para a equipe abrir, escolha um projeto da conta (a pasta do projeto é da equipe dele).
 */

export const artifactId = (content: Pick<Content, 'id'>) => `conteudo-${content.id}`

export class MaterialUnavailable extends Error {
  constructor() {
    super('Este material está na pasta pessoal de quem o criou, ou foi apagado. Escolha um projeto da conta para compartilhar com a equipe.')
  }
}

const docToScript = (doc: Pick<CopyDoc, 'blocks'>) =>
  joinParagraphs(doc.blocks.filter((b) => b.type !== 'divider').map((b) => plainOf(b.html)))

/** O hash que o vínculo guarda do documento: o texto, sem as marcas de formatação. */
export const copyHash = (doc: Pick<CopyDoc, 'blocks'>) => hashOf({ text: docToScript(doc) })

/** O hash do conjunto: os posts inteiros (design e legenda); a marca e os arquivos não entram. */
export const setHash = (set: Pick<CreativeSet, 'posts'>) => hashOf({ posts: set.posts })

export const readCopy = async (link: Pick<ContentLink, 'artifactId' | 'projectId'>) => {
  try {
    return await loadDoc(link.artifactId, link.projectId)
  } catch {
    return undefined
  }
}

export const readSet = async (link: Pick<ContentLink, 'artifactId' | 'projectId'>) => {
  try {
    return await loadSet(link.artifactId, link.projectId)
  } catch {
    return undefined
  }
}

export const docScript = docToScript

export const copyPath = (content: Pick<Content, 'id'>, projectId?: string) => `/copy/${artifactId(content)}?${projectId ? `projeto=${projectId}&` : ''}conteudo=${content.id}`
export const setPath = (content: Pick<Content, 'id'>, projectId?: string) => `/criativos/${artifactId(content)}?${projectId ? `projeto=${projectId}&` : ''}conteudo=${content.id}`
export const contentPath = (id: string) => `/conteudos/${id}`

/**
 * Abre o documento do Copy deste conteúdo; cria na primeira vez, com o briefing do Plano e o
 * roteiro. Devolve o endereço da tela.
 */
export async function forwardToCopy(content: Content, ctx: AccountContext | null, existing: ContentLink | undefined, project?: { id: string; name: string }): Promise<{ path: string; created: boolean }> {
  if (existing) {
    // Erros de leitura ou permissão sobem; só "não existe" vira MaterialUnavailable
    const found = await loadDoc(existing.artifactId, existing.projectId)
    if (!found) throw new MaterialUnavailable()
    return { path: copyPath(content, existing.projectId), created: false }
  }

  const now = Date.now()
  const texts = scriptParagraphs(content.script)
  const doc: CopyDoc = {
    id: artifactId(content),
    title: content.title,
    format: content.format,
    projectId: project?.id,
    projectName: project?.name,
    shared: !!project,
    brief: briefOf(ctx, content),
    source: { contentId: content.id, contextVersion: ctx?.version },
    blocks: (texts.length ? texts : ['']).map((t) => block('p', escapeHtml(t).replace(/\n/g, '<br>'))),
    comments: [],
    createdAt: now,
    updatedAt: now,
  }
  // Criação exclusiva: se outra aba ou pessoa criou antes, usa o documento dela, sem sobrescrever
  const { doc: final, created } = await createDocOnce(doc)
  await linkContent(content.id, 'copy', final.id, project?.id, await copyHash(final))
  return { path: copyPath(content, project?.id), created }
}

/** Traz o texto do documento do Copy para o roteiro (o chamador grava com a versão esperada). */
export async function scriptFromCopy(link: ContentLink): Promise<string> {
  const doc = await readCopy(link)
  if (!doc) throw new MaterialUnavailable()
  return docToScript(doc)
}

/** Manda o roteiro do conteúdo para o documento do Copy, trocando o texto dos blocos. */
export async function scriptToCopy(content: Content, link: ContentLink): Promise<void> {
  const doc = await readCopy(link)
  if (!doc) throw new MaterialUnavailable()
  const texts = scriptParagraphs(content.script)
  const next: CopyDoc = { ...doc, blocks: (texts.length ? texts : ['']).map((t) => block('p', escapeHtml(t).replace(/\n/g, '<br>'))), updatedAt: Date.now() }
  await saveDoc(next)
  await linkContent(content.id, 'copy', doc.id, link.projectId, await copyHash(next))
}

/**
 * Abre o conjunto de Criativos deste conteúdo; cria na primeira vez, na marca do projeto (ou
 * neutra), com um post de partida que leva o título e a legenda do roteiro. O briefing do Plano
 * vai junto em `brief`. Nada de conteúdo de outra marca entra.
 */
export async function forwardToCriativos(content: Content, ctx: AccountContext | null, existing: ContentLink | undefined, project?: { id: string; name: string }): Promise<{ path: string; created: boolean }> {
  if (existing) {
    const found = await loadSet(existing.artifactId, existing.projectId)
    if (!found) throw new MaterialUnavailable()
    return { path: setPath(content, existing.projectId), created: false }
  }

  let brand: SetBrand = setBrandFrom(null, project?.name ?? 'Marca')
  if (project) {
    const cloud = await loadProjectDoc(project.id)
    const source = cloud?.doc?.brand?.source
    const parsed = source?.trim() ? parseDesignMd(source).brand : null
    brand = setBrandFrom(parsed, project.name)
  } else {
    // Sem projeto não há DESIGN.md: usa a marca do conjunto mais recente da conta (cores, fontes, logo)
    brand = (await accountBrand()) ?? brand
  }
  const format = content.format === 'story' || content.format === 'reels' ? '9x16' : '4x5'
  const now = Date.now()
  const brief = briefText(briefOf(ctx, content))
  // O roteiro vira carrossel: pela IA quando conectada, senão fatiado por regra
  const photos = useCreativeLink.getState().providers.length > 0
  const post = (await aiCarousel(content, ctx, brand, format, brief, photos)) ?? carouselPost(content, brand, format, content.script || undefined, photos)
  if (!post.caption && content.script) post.caption = content.script
  const set: CreativeSet = {
    id: artifactId(content),
    name: content.title,
    projectId: project?.id,
    projectName: project?.name,
    shared: !!project,
    brand,
    source: { contentId: content.id, contextVersion: ctx?.version },
    brief,
    posts: [post],
    assets: [],
    createdAt: now,
    updatedAt: now,
  }
  const { set: final, created } = await createSetOnce(set)
  // As fotos vêm do Codex (ou do serviço de imagens pronto); sem elas o carrossel segue tipográfico
  let ready = final
  if (created && photos) {
    const id = toast.loading('Gerando as fotos do carrossel…')
    try {
      const out = await fillSetImages(final, [post.id], { signal: AbortSignal.timeout(300_000), provider: 'codex', onImage: (done, total) => toast.loading(`Gerando as fotos do carrossel… ${done} de ${total}`, { id }) })
      ready = out.set
      await saveSet(ready)
      if (out.failed.length) toast.message('Algumas fotos não saíram: gere de novo no editor.')
    } catch {
      toast.message('Não consegui gerar as fotos agora: o carrossel abre sem elas.')
    } finally {
      toast.dismiss(id)
    }
  }
  await linkContent(content.id, 'criativos', ready.id, project?.id, await setHash(ready))
  return { path: setPath(content, project?.id), created }
}
