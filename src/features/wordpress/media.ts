import { hash } from '@/features/space/brand/designMd'
import type { MediaReplacement } from '@/features/space/pageImages'
import { credentialsOf } from './connect'
import { wpUpload, WordPressError } from './rest'
import type { WordPressConnection } from './types'

/**
 * Imagens das seções que não estão no site do cliente vão para a biblioteca
 * de mídia dele antes de publicar: o Elementor não traz imagem de outro site,
 * e a imagem que só existe nesta máquina nem abriria lá.
 */

// Imagem já enviada para um site não sobe de novo a cada publicação
const CACHE_KEY = 'space-uploaded-media'

type UploadCache = Record<string, Record<string, MediaReplacement>>

const readCache = (): UploadCache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

const remember = (siteUrl: string, sourceUrl: string, uploaded: MediaReplacement) => {
  try {
    const cache = readCache()
    cache[siteUrl] = { ...cache[siteUrl], [sourceUrl]: uploaded }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Sem cache a próxima publicação só envia de novo
  }
}

/** A imagem já é do site do cliente (mesmo endereço): fica como está, com o id do anexo. */
export function isSiteMedia(url: string, siteUrl: string): boolean {
  try {
    return new URL(url, window.location.href).host === new URL(siteUrl).host
  } catch {
    return false
  }
}

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

const fileNameFor = (sourceUrl: string, type: string) => {
  let name = 'imagem'
  try {
    name = decodeURIComponent(new URL(sourceUrl, window.location.href).pathname.split('/').pop() || name)
  } catch {
    // URL estranha: fica o nome padrão
  }
  name = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagem'
  const ext = EXTENSION[type]
  return ext && !name.endsWith(`.${ext}`) && !/\.[a-z0-9]{2,4}$/.test(name) ? `${name}.${ext}` : name
}

async function readImage(url: string): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error('o navegador não conseguiu baixar a imagem (o servidor dela não libera cópia)')
  }
  if (!response.ok) throw new Error(`a imagem respondeu ${response.status}`)
  return response.blob()
}

/** PNG com o mesmo nome de um SVG, quando existe (os logos da marca vêm nos dois formatos). */
async function pngBeside(svgUrl: string): Promise<{ url: string; blob: Blob } | null> {
  const url = svgUrl.replace(/\.svg(?=$|[?#])/i, '.png')
  if (url === svgUrl) return null
  const blob = await readImage(url).catch(() => null)
  // O servidor de desenvolvimento devolve a página do app para arquivo que não existe
  return blob?.type === 'image/png' ? { url, blob } : null
}

/** Envia uma imagem para a biblioteca de mídia do site e devolve o anexo criado. */
export async function uploadImage(connection: WordPressConnection, sourceUrl: string): Promise<MediaReplacement> {
  const { siteUrl } = connection.site
  const cached = readCache()[siteUrl]?.[sourceUrl]
  if (cached) return cached

  const creds = credentialsOf(connection)
  const blob = await readImage(sourceUrl)
  let uploaded: { id: number; source_url: string }
  try {
    uploaded = await wpUpload(creds, blob, fileNameFor(sourceUrl, blob.type))
  } catch (error) {
    // Sem plugin, o WordPress recusa SVG: vai o PNG de mesmo nome, se houver
    if (!(error instanceof WordPressError) || blob.type !== 'image/svg+xml' || error.code === 'network') throw error
    const png = await pngBeside(sourceUrl)
    if (!png) throw new Error(`${error.message} O WordPress só aceita SVG com um plugin de SVG.`)
    uploaded = await wpUpload(creds, png.blob, fileNameFor(png.url, png.blob.type))
  }

  const result = { id: Number(uploaded.id), url: String(uploaded.source_url) }
  remember(siteUrl, sourceUrl, result)
  return result
}

/** Envia uma imagem feita aqui (data URL) e devolve o anexo; a mesma imagem não sobe duas vezes. */
export async function uploadDataUrl(connection: WordPressConnection, dataUrl: string, fileName: string): Promise<MediaReplacement> {
  const { siteUrl } = connection.site
  const key = `data:${hash(dataUrl)}:${dataUrl.length}`
  const cached = readCache()[siteUrl]?.[key]
  if (cached) return cached
  const blob = await (await fetch(dataUrl)).blob()
  const uploaded = await wpUpload(credentialsOf(connection), blob, fileNameFor(fileName, blob.type))
  const result = { id: Number(uploaded.id), url: String(uploaded.source_url) }
  remember(siteUrl, key, result)
  return result
}
