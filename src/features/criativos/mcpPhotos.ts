import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useMcpEvent, type McpEvent } from '@/features/mcp/live'
import { fillSetImages, generateAll } from './generate'
import { useCreativeLink } from './link'
import { loadSet, saveSet } from './storage'
import { useEditor } from './store'
import type { SyncPatch } from './syncPatch'
import type { CreativeSet, SetAsset } from './types'

/**
 * Fotos dos criativos feitos pela IA conectada (MCP), geradas pelo app local (2026-11-13, o usuário: "hoje vamos
 * usar IA MCP em tudo… precisa atender via MCP", sem passar pelo editor nem pela IA antiga). O MCP monta os posts
 * no servidor e deixa as fotos descritas (`prompt`, sem `src`); quem tem a chave de imagem é o conector deste
 * computador (o Codex, pelo plano da pessoa). Então qualquer aba do app aberta, em qualquer tela, com o conector
 * ligado, ouve o aviso ao vivo do MCP (criar, editar ou `sinfy_criativo_fotos`) e gera as fotos pendentes daquele
 * conjunto, sem ninguém abrir o editor. Com o conjunto aberto no editor, gera pelo editor (para não gravar por cima).
 *
 * Revisão de 2026-11-13: só gera nas abas da pessoa dona da chave (o aviso traz `usuario`; antes, cada membro da conta
 * com o conector gerava as mesmas fotos, porque a trava é por navegador), e quem abre o editor no meio da geração
 * recebe as fotos no estado dele (senão o próximo autosave do editor gravava a versão sem elas).
 */

const TOOLS = new Set(['sinfy_criativo_criar', 'sinfy_criativo_editar', 'sinfy_criativo_fotos'])
/** Uma aba por conjunto: as outras abas do mesmo navegador não repetem o trabalho. */
const LOCK = (id: string) => `mcp-fotos:${id}`
const LOCK_FOR = 6 * 60_000

const missingOf = (set: CreativeSet) =>
  set.posts.flatMap((p) => p.slides.flatMap((sl) => sl.layers.filter((l) => l.type === 'image' && !l.hidden && !l.src && !!l.prompt?.trim()).map((l) => ({ postId: p.id, slideId: sl.id, layerId: l.id, prompt: (l as { prompt?: string }).prompt!.trim() }))))

function claim(id: string): boolean {
  try {
    const at = Number(localStorage.getItem(LOCK(id)) || 0)
    if (Date.now() - at < LOCK_FOR) return false
    localStorage.setItem(LOCK(id), String(Date.now()))
  } catch {
    // Sem armazenamento: segue (no pior caso, duas abas geram)
  }
  return true
}
const release = (id: string) => {
  try {
    localStorage.removeItem(LOCK(id))
  } catch {
    // nada
  }
}

const running = new Set<string>()

/** Quanto tempo depois de gravar ainda vale levar as fotos a um editor que abriu este conjunto (a abertura leva segundos). */
const WATCH_EDITOR = 30_000

/**
 * Põe as fotos geradas no editor aberto neste conjunto, sobre o estado DELE (só as camadas ainda sem foto; o resto da
 * edição dele fica), como mudança remota: o arquivo já está gravado, e o próximo autosave do editor leva as fotos junto.
 */
function patchEditor(setId: string, made: Map<string, string>, assets: SetAsset[]) {
  const current = useEditor.getState().set
  if (!current || current.id !== setId) return
  const slides: NonNullable<SyncPatch['slides']> = []
  for (const p of current.posts)
    for (const sl of p.slides)
      if (sl.layers.some((l) => l.type === 'image' && !l.src && made.has(l.id)))
        slides.push({ postId: p.id, slide: { ...sl, layers: sl.layers.map((l) => (l.type === 'image' && !l.src && made.has(l.id) ? { ...l, src: made.get(l.id)!, genFailed: false } : l)) } })
  const extra = assets.filter((a) => !current.assets.some((b) => b.id === a.id))
  if (!slides.length && !extra.length) return
  useEditor.getState().applyRemote({ ...(slides.length ? { slides } : {}), ...(extra.length ? { assets: [...current.assets, ...extra] } : {}) })
}

/** Leva as fotos ao editor agora e a um que termine de abrir este conjunto logo depois (leu a versão sem elas). */
function deliverToEditor(setId: string, made: Map<string, string>, assets: SetAsset[]) {
  if (!made.size) return
  patchEditor(setId, made, assets)
  const stop = useEditor.subscribe((s) => {
    if (s.status === 'ready' && s.set?.id === setId) patchEditor(setId, made, assets)
  })
  setTimeout(stop, WATCH_EDITOR)
}

/** O aviso é da chave de outra pessoa da conta: as abas dela geram, não as nossas. */
async function notMine(e: McpEvent) {
  if (!e.usuario) return false // aviso de antes do campo: segue como era
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id !== e.usuario
}

async function generateFor(setId: string, projectId?: string) {
  const link = useCreativeLink.getState()
  if (!link.connected || !link.providers.length || running.has(setId) || !claim(setId)) return
  running.add(setId)
  const toastId = toast.loading('IA conectada: gerando as fotos do criativo…')
  try {
    // O editor aberto neste conjunto recarrega a versão da IA ao fim da ferramenta; espera e gera por ele
    const editor = useEditor.getState()
    if (editor.set?.id === setId) {
      await new Promise((r) => setTimeout(r, 2500))
      const current = useEditor.getState().set
      if (current?.id !== setId) return
      const list = missingOf(current)
      if (!list.length) return
      const done = await generateAll(list, undefined, AbortSignal.timeout(10 * 60_000))
      toast.success(`${done} de ${list.length} foto(s) gerada(s) no criativo.`, { id: toastId })
      return
    }
    const set = await loadSet(setId, projectId)
    if (!set) return
    const list = missingOf(set)
    if (!list.length) return
    toast.loading(`IA conectada: gerando ${list.length} foto(s) do criativo…`, { id: toastId })
    const out = await fillSetImages(set, [...new Set(list.map((l) => l.postId))], {
      signal: AbortSignal.timeout(10 * 60_000),
      provider: 'codex',
      onImage: (n, total) => toast.loading(`IA conectada: foto ${n} de ${total}…`, { id: toastId }),
    })
    // Relê antes de gravar: se a IA mexeu no conjunto enquanto as fotos saíam, aplica as fotos na versão nova
    const fresh = (await loadSet(setId, projectId)) ?? set
    const made = new Map<string, string>()
    for (const p of out.set.posts) for (const sl of p.slides) for (const l of sl.layers) if (l.type === 'image' && l.src && list.some((x) => x.layerId === l.id)) made.set(l.id, l.src)
    const assets = out.set.assets.filter((a) => !fresh.assets.some((b) => b.id === a.id))
    await saveSet({
      ...fresh,
      assets: [...fresh.assets, ...assets],
      posts: fresh.posts.map((p) => ({ ...p, slides: p.slides.map((sl) => ({ ...sl, layers: sl.layers.map((l) => (l.type === 'image' && !l.src && made.has(l.id) ? { ...l, src: made.get(l.id)!, genFailed: false } : l)) })) })),
      updatedAt: Date.now(),
    })
    // Alguém abriu este conjunto no editor durante a geração: ele não sabe deste save
    deliverToEditor(setId, made, assets)
    toast.success(`${made.size} de ${list.length} foto(s) gerada(s) no criativo da IA conectada.`, { id: toastId })
  } catch (err) {
    toast.error(err instanceof Error ? `Fotos do criativo: ${err.message}` : 'Não consegui gerar as fotos do criativo.', { id: toastId })
  } finally {
    running.delete(setId)
    release(setId)
    setTimeout(() => toast.dismiss(toastId), 8000)
  }
}

/** Liga o gerador (uma vez, no `McpHost`, em todas as telas). */
export function useMcpPhotoWorker() {
  useMcpEvent((e: McpEvent) => {
    if (e.phase !== 'done' || e.ok === false || !TOOLS.has(e.tool)) return
    const setId = (typeof e.criado?.conjunto === 'string' && e.criado.conjunto) || (typeof e.onde.id === 'string' ? e.onde.id : '')
    if (!setId) return
    const projectId = (typeof e.criado?.projeto_id === 'string' && e.criado.projeto_id) || (typeof e.onde.projeto_id === 'string' ? e.onde.projeto_id : undefined)
    void notMine(e).then((skip) => (skip ? undefined : generateFor(setId, projectId || undefined)))
  })
}
