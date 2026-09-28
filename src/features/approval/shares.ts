import { supabase } from '@/integrations/supabase/client'
import { rootRelativeAssets } from '@/features/projects/localAssets'

/**
 * Link de aprovação de uma página: uma foto do HTML renderizado que o cliente
 * abre sem login em `/aprovar/<id>`. O id é o segredo. A linha fica em
 * `space_page_shares` (só o dono lê) e o HTML no bucket público
 * `space-page-shares`, em `<id>/<arquivo>.html`, que ninguém lista.
 */

const BUCKET = 'space-page-shares'
const bucket = () => supabase.storage.from(BUCKET)

export type Decision = 'approved' | 'changes'

export interface ShareResponse {
  id?: string
  version: number
  decision: Decision
  name: string
  note: string
  createdAt: number
}

export interface PageShare {
  id: string
  projectId: string
  pageId: string
  projectName: string
  pageName: string
  htmlPath: string
  htmlHash: string
  version: number
  sharedAt: number
  /** Mais nova primeiro. */
  responses: ShareResponse[]
}

/** O que a página pública recebe: o link e as respostas da versão atual. */
export interface PublicShare {
  id: string
  projectName: string
  pageName: string
  htmlPath: string
  version: number
  sharedAt: number
  responses: ShareResponse[]
}

// Endereço público

/** Onde o app está publicado; sem `VITE_PUBLIC_APP_URL`, o endereço aberto agora. */
export const publicAppUrl = () => (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/+$/, '') || window.location.origin

/** O link só abre fora deste computador se o app estiver publicado. */
export const isLocalAppUrl = () => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(publicAppUrl())

export const shareUrl = (id: string) => `${publicAppUrl()}/aprovar/${id}`

/** Resumo curto do HTML, para saber se a página mudou depois da foto. Mudar só a porta local não conta. */
export async function htmlHash(html: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rootRelativeAssets(html)))
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const filePath = (id: string, version: number) => `${id}/v${version}-${crypto.randomUUID().slice(0, 8)}.html`

/** As imagens do app vão como caminho da raiz: abrem de onde o link for aberto. */
async function upload(path: string, html: string) {
  const body = new Blob([rootRelativeAssets(html)], { type: 'text/html' })
  const { error } = await bucket().upload(path, body, { contentType: 'text/html', cacheControl: '3600' })
  if (error) throw error
}

/** Apaga as fotos de um link (a pasta dele no bucket). */
async function removeFiles(id: string) {
  const { data, error } = await bucket().list(id, { limit: 100 })
  if (error) throw error
  if (data.length) {
    const { error: removeError } = await bucket().remove(data.map((f) => `${id}/${f.name}`))
    if (removeError) throw removeError
  }
}

// Dono: links do projeto

interface ShareRow {
  id: string
  project_id: string
  page_id: string
  project_name: string
  page_name: string
  html_path: string
  html_hash: string
  version: number
  shared_at: string
  space_page_share_responses?: Array<{ id: string; version: number; decision: string; name: string; note: string; created_at: string }>
}

const toShare = (row: ShareRow): PageShare => ({
  id: row.id,
  projectId: row.project_id,
  pageId: row.page_id,
  projectName: row.project_name,
  pageName: row.page_name,
  htmlPath: row.html_path,
  htmlHash: row.html_hash,
  version: row.version,
  sharedAt: Date.parse(row.shared_at),
  responses: (row.space_page_share_responses ?? [])
    .map((r) => ({ id: r.id, version: r.version, decision: r.decision as Decision, name: r.name, note: r.note, createdAt: Date.parse(r.created_at) }))
    .sort((a, b) => b.createdAt - a.createdAt),
})

const COLUMNS = 'id, project_id, page_id, project_name, page_name, html_path, html_hash, version, shared_at, space_page_share_responses(id, version, decision, name, note, created_at)'

export async function listShares(projectId: string): Promise<PageShare[]> {
  const { data, error } = await supabase.from('space_page_shares').select(COLUMNS).eq('project_id', projectId)
  if (error) throw error
  return (data as unknown as ShareRow[]).map(toShare)
}

interface SnapshotFields {
  projectName: string
  pageName: string
  html: string
}

/** Primeiro link da página: a linha antes do arquivo, porque só o dono de um link grava na pasta dele. */
export async function createShare(projectId: string, pageId: string, { projectName, pageName, html }: SnapshotFields): Promise<PageShare> {
  const id = crypto.randomUUID()
  const path = filePath(id, 1)
  const hash = await htmlHash(html)
  const { data, error } = await supabase
    .from('space_page_shares')
    .insert({ id, project_id: projectId, page_id: pageId, project_name: projectName, page_name: pageName, html_path: path, html_hash: hash })
    .select(COLUMNS)
    .single()
  if (error) throw error
  try {
    await upload(path, html)
  } catch (uploadError) {
    await supabase.from('space_page_shares').delete().eq('id', id)
    throw uploadError
  }
  return toShare(data as unknown as ShareRow)
}

/** Nova foto no mesmo link: o cliente passa a ver a página atual, e as respostas recomeçam. */
export async function updateShare(share: PageShare, { projectName, pageName, html }: SnapshotFields): Promise<PageShare> {
  const path = filePath(share.id, share.version + 1)
  const hash = await htmlHash(html)
  await upload(path, html)
  const { data, error } = await supabase
    .from('space_page_shares')
    .update({ html_path: path, html_hash: hash, version: share.version + 1, shared_at: new Date().toISOString(), project_name: projectName, page_name: pageName })
    .eq('id', share.id)
    // Outra aba atualizou antes: não passa por cima
    .eq('version', share.version)
    .select(COLUMNS)
  if (error || !data?.length) {
    void bucket().remove([path])
    if (error) throw error
    throw new Error('O link foi atualizado em outra aba. Feche e abra o player de novo.')
  }
  void bucket().remove([share.htmlPath])
  return toShare(data[0] as unknown as ShareRow)
}

/** Desativa o link: as fotos saem antes da linha, que é o que dá permissão sobre elas. */
export async function deleteShare(share: PageShare) {
  await removeFiles(share.id)
  const { error } = await supabase.from('space_page_shares').delete().eq('id', share.id)
  if (error) throw error
}

/** Ao excluir o projeto: as fotos públicas dos links não podem ficar para trás. */
export async function removeProjectShares(projectId: string) {
  const { data, error } = await supabase.from('space_page_shares').select('id').eq('project_id', projectId)
  if (error) throw error
  for (const { id } of data) await removeFiles(id)
}

// Página pública

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** O link aberto pelo cliente; undefined se ele não existe (ou foi desativado). */
export async function getPublicShare(id: string): Promise<PublicShare | undefined> {
  if (!UUID.test(id)) return undefined
  const { data, error } = await supabase.rpc('get_page_share', { p_id: id })
  if (error) throw error
  if (!data) return undefined
  const row = data as { id: string; project_name: string; page_name: string; html_path: string; version: number; shared_at: string; responses: Array<{ decision: string; name: string; note: string; created_at: string }> }
  return {
    id: row.id,
    projectName: row.project_name,
    pageName: row.page_name,
    htmlPath: row.html_path,
    version: row.version,
    sharedAt: Date.parse(row.shared_at),
    responses: row.responses.map((r) => ({ version: row.version, decision: r.decision as Decision, name: r.name, note: r.note, createdAt: Date.parse(r.created_at) })),
  }
}

export async function fetchShareHtml(path: string) {
  const { publicUrl } = bucket().getPublicUrl(path).data
  const response = await fetch(publicUrl)
  if (!response.ok) throw new Error(`Foto da página não encontrada (${response.status})`)
  // Fotos gravadas antes com o endereço local completo também abrem
  return rootRelativeAssets(await response.text())
}

export type RespondError = 'link_inativo' | 'versao_antiga' | 'comentario_obrigatorio' | 'limite_respostas' | 'erro'

export async function respondToShare(id: string, version: number, decision: Decision, name: string, note: string): Promise<{ at: number } | { error: RespondError }> {
  const { data, error } = await supabase.rpc('respond_page_share', { p_id: id, p_version: version, p_decision: decision, p_name: name, p_note: note })
  if (error) {
    const known = (['link_inativo', 'versao_antiga', 'comentario_obrigatorio', 'limite_respostas'] as const).find((code) => error.message.includes(code))
    return { error: known ?? 'erro' }
  }
  return { at: Date.parse(String(data)) }
}
