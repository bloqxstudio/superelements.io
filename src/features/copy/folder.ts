import { useProjectStore } from '@/features/projects/projectStore'
import { escapeHtml, htmlToMark } from './html'
import { formatById } from './knowledge'
import type { CopyRequest } from './protocol'
import { listDocs, loadDoc, saveDoc } from './storage'
import { block, EMPTY_BRIEF, uid, type CopyDoc, type CopySummary, type FormatId } from './types'

/**
 * Pastas: um assunto reúne vários documentos (a pesquisa, a copy da LP, o
 * conteúdo orgânico, o de conversão). Cada documento segue o seu caminho (um vai
 * para Projetos, outro para Criativos), mas os agentes leem a pesquisa e os
 * irmãos da pasta antes de escrever. A pasta é só o `folderId` nos documentos:
 * não há registro separado.
 */

export const projectIds = () => useProjectStore.getState().projects.map((p) => p.id)

export const folderDocs = async (folderId: string): Promise<CopySummary[]> => (await listDocs(projectIds())).filter((d) => d.folderId === folderId)

/** O que os agentes leem da pasta: a pesquisa primeiro, depois os outros documentos já escritos. */
export const folderReferences = (doc: CopyDoc) => (doc.folderId ? folderMaterial(doc.folderId, doc.id) : Promise.resolve([]))

export async function folderMaterial(folderId: string, exceptId?: string): Promise<NonNullable<CopyRequest['references']>> {
  try {
    const siblings = (await folderDocs(folderId)).filter((d) => d.id !== exceptId && d.words > 5).sort((a, b) => Number(b.format === 'pesquisa') - Number(a.format === 'pesquisa')).slice(0, 5)
    const loaded = await Promise.all(siblings.map((s) => loadDoc(s.id, s.shared ? s.projectId : undefined).catch(() => undefined)))
    return loaded
      .filter((d): d is CopyDoc => !!d)
      .map((d) => ({ kind: d.format === 'pesquisa' ? 'pesquisa da pasta' : `${formatById(d.format).label} da pasta`, label: d.title, text: d.blocks.map((b) => htmlToMark(b.html)).filter(Boolean).join('\n') }))
  } catch {
    return []
  }
}

/** Os conteúdos que uma pesquisa costuma gerar, cada um indo para o seu lugar. */
export const DERIVED: { id: string; format: FormatId; label: string; hint: string; objective: string }[] = [
  { id: 'lp', format: 'lp', label: 'Copy da landing page', hint: 'Vai para Projetos', objective: 'Converter quem chega na página em contato (WhatsApp ou formulário), usando as dores e objeções mapeadas na pesquisa' },
  { id: 'post', format: 'post-instagram', label: 'Posts de Instagram', hint: 'Cada post é um documento; vai para Criativos', objective: 'Um ângulo da pesquisa por post (dor, objeção, bastidor, prova), fechando com um convite claro' },
  { id: 'organico', format: 'carrossel', label: 'Conteúdo orgânico (carrossel)', hint: 'Vai para Criativos', objective: 'Educar e atrair seguidores do público certo, com ângulos tirados da pesquisa; fecha convidando a chamar' },
  { id: 'conversao', format: 'anuncio', label: 'Conteúdo de conversão (anúncios)', hint: 'Anúncios com ângulos e variações', objective: 'Levar quem já tem a dor a clicar e chamar, com promessa honesta e as objeções da pesquisa respondidas' },
  { id: 'linkedin', format: 'linkedin', label: 'Post de LinkedIn', hint: 'Vai para Criativos', objective: 'Mostrar domínio do assunto para o público profissional e abrir conversa' },
  { id: 'email', format: 'email', label: 'E-mail', hint: 'Sequência curta', objective: 'Aquecer quem já conhece e levar a uma conversa' },
]

export interface NewFolderDoc {
  base: CopyDoc
  format: FormatId
  objective?: string
  title?: string
}

/** Cria um documento na pasta de `base`, com o briefing herdado (nicho, público, tom, oferta). */
export async function createInFolder({ base, format, objective, title }: NewFolderDoc): Promise<CopyDoc> {
  const spec = formatById(format)
  const now = Date.now()
  const doc: CopyDoc = {
    id: uid(),
    title: title ?? `${spec.label} · ${base.folderName ?? base.title}`,
    format,
    niche: base.niche,
    projectId: base.projectId,
    projectName: base.projectName,
    shared: base.shared,
    folderId: base.folderId,
    folderName: base.folderName,
    brief: {
      ...EMPTY_BRIEF,
      audience: base.brief.audience,
      tone: base.brief.tone,
      offer: base.brief.offer,
      objective: objective ?? '',
      notes: `Assunto da pasta: ${base.folderName ?? base.title}. Use a pesquisa e os outros documentos da pasta como base: não invente o que a pesquisa não mostra.`,
    },
    blocks: spec.skeleton.map((b) => block(b.type, escapeHtml(b.text ?? ''), b.label)),
    comments: [],
    createdAt: now,
    updatedAt: now,
  }
  await saveDoc(doc)
  return doc
}

export async function renameFolder(folderId: string, name: string) {
  const docs = await folderDocs(folderId)
  await Promise.all(
    docs.map(async (s) => {
      const d = await loadDoc(s.id, s.shared ? s.projectId : undefined)
      if (d) await saveDoc({ ...d, folderName: name })
    })
  )
}

export const WRITE_FIRST = 'Escreva a primeira versão completa deste documento, usando a pesquisa e os outros documentos da pasta como base.'

/** Endereço de um documento; `rodar` já abre pedindo ao agente, `enviar` já abre o envio. */
export const docLink = (d: Pick<CopySummary, 'id' | 'projectId' | 'shared'>, extra: { rodar?: string; enviar?: boolean | 'pasta' } = {}) => {
  const q = new URLSearchParams()
  if (d.shared && d.projectId) q.set('projeto', d.projectId)
  if (extra.rodar) q.set('rodar', extra.rodar)
  if (extra.enviar) q.set('enviar', extra.enviar === 'pasta' ? 'pasta' : '1')
  const s = q.toString()
  return `/copy/${d.id}${s ? `?${s}` : ''}`
}
