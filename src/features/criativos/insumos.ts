import type React from 'react'
import { create } from 'zustand'
import { accountImages, loadPlatformCreatives, type BrainTeam } from '@/features/cerebro/data'
import type { VaultMedia } from '@/features/cerebro/vault'
import { accountBrand } from '@/features/conteudos/carousel'
import { FORM_ICONS } from './icons'

/**
 * Os insumos de cada conta, guardados (2026-11-10, o usuário: "é bem lento carregar tudo, como podemos
 * fazer de forma mais natural?"). A janela abre na hora com o que já foi lido (memória e localStorage
 * deste navegador, `insumos:<conta>`) e atualiza por trás; o editor pré-carrega quando abre, sem esperar
 * a pessoa clicar. Os links assinados valem 7 dias, então a cópia guardada vale 5. As imagens dos posts
 * (que leem os conjuntos da conta) começam pela cópia do Cérebro (`cerebro-cofre:<conta>`) e só são relidas
 * quando o grupo abre e a cópia passou de 30 min, para não gastar o tráfego do Supabase.
 */

export interface BrandLogo { key: string; src: string; name: string }
interface Saved { at: number; files?: VaultMedia[]; filesAt?: number; posts?: VaultMedia[]; postsAt?: number; logos?: BrandLogo[] }

const KEY = (team: string) => `insumos:${team}`
const KEEP = 5 * 86_400_000
const FILES_FRESH = 60_000
const POSTS_FRESH = 30 * 60_000

const read = (team: string): Saved => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY(team)) ?? 'null') as Saved | null
    return s && Date.now() - s.at < KEEP ? s : { at: Date.now() }
  } catch { return { at: Date.now() } }
}
const write = (team: string, s: Saved) => {
  try {
    const raw = JSON.stringify({ ...s, at: Date.now() })
    if (raw.length < 1_500_000) localStorage.setItem(KEY(team), raw)
  } catch { /* cheio ou bloqueado: só não guarda */ }
}

/** As imagens dos posts que o Cérebro já guardou neste navegador. */
const fromBrainCopy = (team: string): VaultMedia[] | undefined => {
  try {
    const raw = JSON.parse(localStorage.getItem(`cerebro-cofre:${team}`) ?? 'null') as { at: number; vault: { media: VaultMedia[] } } | null
    if (!raw || Date.now() - raw.at > KEEP) return undefined
    const list = raw.vault.media.filter((m) => m.path.startsWith('plataforma/imagens/') && m.url)
    return list.length ? list : undefined
  } catch { return undefined }
}

interface State {
  team?: string
  files?: VaultMedia[]
  posts?: VaultMedia[]
  logos: BrandLogo[]
  loadingFiles: boolean
  loadingPosts: boolean
  error?: string
}

export const useInsumos = create<State>()(() => ({ logos: [], loadingFiles: false, loadingPosts: false }))

let saved: Saved = { at: 0 }
let filesAt = 0
let postsAt = 0
let filesRun: Promise<void> | undefined
let postsRun: Promise<void> | undefined

/** Troca de conta: mostra na hora a cópia guardada dela. */
function use(team: string) {
  if (useInsumos.getState().team === team) return
  saved = read(team)
  filesAt = saved.filesAt ?? 0
  postsAt = saved.postsAt ?? 0
  filesRun = postsRun = undefined
  useInsumos.setState({ team, files: saved.files, posts: saved.posts ?? fromBrainCopy(team), logos: saved.logos ?? [], loadingFiles: false, loadingPosts: false, error: undefined })
}

const persist = (team: string, patch: Partial<Saved>) => {
  if (useInsumos.getState().team !== team) return
  saved = { ...saved, ...patch }
  write(team, saved)
}

/** Arquivos do Cérebro e logos da marca da conta: cópia na hora, releitura por trás. */
export function refreshAccount(team: BrainTeam, force = false): Promise<void> {
  use(team.id)
  if (filesRun) return filesRun
  if (!force && Date.now() - filesAt < FILES_FRESH) return Promise.resolve()
  useInsumos.setState({ loadingFiles: true })
  filesRun = (async () => {
    const [files, brand] = await Promise.allSettled([accountImages(team.id), accountBrand()])
    if (useInsumos.getState().team !== team.id) return
    const patch: Partial<State> = { loadingFiles: false }
    if (files.status === 'fulfilled') { patch.files = files.value; patch.error = undefined }
    else if (!useInsumos.getState().files) patch.error = files.reason instanceof Error ? files.reason.message : 'Não consegui ler os arquivos da conta.'
    if (brand.status === 'fulfilled' && brand.value) {
      const b = brand.value
      patch.logos = (['logoOnLight', 'logoOnDark'] as const).flatMap((k) => (b[k] ? [{ key: `conta-${k}`, src: b[k]!, name: k === 'logoOnLight' ? 'Logo para fundo claro' : 'Logo para fundo escuro' }] : []))
    }
    filesAt = Date.now()
    useInsumos.setState(patch)
    persist(team.id, { files: patch.files ?? saved.files, filesAt, logos: patch.logos ?? saved.logos })
  })().finally(() => { filesRun = undefined; if (useInsumos.getState().loadingFiles) useInsumos.setState({ loadingFiles: false }) })
  return filesRun
}

/** As imagens que os posts da conta usam: só quando o grupo abre e a cópia está velha. */
export function refreshPosts(team: BrainTeam): Promise<void> {
  use(team.id)
  if (postsRun) return postsRun
  if (Date.now() - postsAt < POSTS_FRESH) return Promise.resolve()
  useInsumos.setState({ loadingPosts: true })
  postsRun = loadPlatformCreatives(team)
    .then((v) => {
      if (useInsumos.getState().team !== team.id) return
      const posts = v.media.filter((m) => m.path.startsWith('plataforma/imagens/') && m.url)
      postsAt = Date.now()
      useInsumos.setState({ posts })
      persist(team.id, { posts, postsAt })
    })
    .catch(() => { if (!useInsumos.getState().posts) useInsumos.setState({ posts: [] }) })
    .finally(() => { postsRun = undefined; useInsumos.setState({ loadingPosts: false }) })
  return postsRun
}

// ———————————————————————————————————— ícones

type IconComp = React.ComponentType<Record<string, unknown>>
type Loader = () => Promise<{ default: IconComp }>
let loaders: Promise<Record<string, Loader>> | undefined
const comps = new Map<string, IconComp>()
const loadingIcons = new Map<string, Promise<IconComp | undefined>>()

/** O componente de um ícone (guardado depois da primeira vez). */
export const iconComponent = (name: string) => comps.get(name)

export function loadIcons(names: string[]): Promise<void> {
  loaders ??= import('lucide-react/dynamicIconImports').then((m) => m.default as unknown as Record<string, Loader>)
  return Promise.all(names.map((n) => {
    if (comps.has(n)) return undefined
    let run = loadingIcons.get(n)
    if (!run) {
      run = loaders!.then((all) => all[n]?.()).then((m) => { if (m) comps.set(n, m.default); return m?.default }).catch(() => undefined)
      loadingIcons.set(n, run)
    }
    return run
  })).then(() => undefined)
}

/** Pré-carrega o que a janela de insumos mostra primeiro, quando o navegador estiver livre. */
export function prefetchInsumos(team?: BrainTeam) {
  if (!team) return
  use(team.id)
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200))
  idle(() => {
    void refreshAccount(team)
    void loadIcons([...FORM_ICONS])
  })
}
