import { accountBrand } from '@/features/conteudos/carousel'
import { useEditor } from '../store'
import { loadSet, saveSet } from '../storage'
import { newScene } from '../scene'
import type { CodeScene, CreativeSet, SetBrand } from '../types'
import { EXPLAINER_SCENE } from './engine'
import { narrate, type VoiceAI } from './narracao'
import { researchCuriosity, type Research } from './pesquisa'
import { creditsLine, gatherMedia } from './midiaReal'
import { writeBriefing } from './roteiro'
import { videoLength } from './timeline'
import { emptyExplainer, type ExplainerData, type LookId } from './types'

/**
 * A linha de produção do modo briefing, a mesma para a tela (`NewExplainer`) e para a Iara
 * (`criar_video_explicativo`): pesquisa (opcional) → roteiro da IA → narração por voz de IA
 * (opcional) → a cena no conjunto aberto no editor. Nada é publicado.
 */

export type Step = (label: string, state?: 'doing' | 'done' | 'warn', detail?: string) => void

export interface BriefingInput {
  /** Tema para pesquisar na web (curiosidade verificada com fonte). */
  topic?: string
  /** Briefing escrito (além ou no lugar da pesquisa). */
  briefText?: string
  /** Pedido extra para a IA (público, tom). */
  brief?: string
  look?: LookId
  /** Narrar com voz de IA; null = sem voz. */
  voice?: VoiceAI | null
  /** Pesquisa já feita (a tela mostra antes de criar). */
  research?: Research
  reference?: string[]
  /** O resto do vídeo (fala transcrita, fotos, legenda) quando vem da tela. */
  base?: Partial<ExplainerData>
  /** Mídia real: produto do catálogo da conta, fotos livres e clipes curtos gerados (padrão: catálogo + 2 fotos, sem clipes). */
  media?: { free?: number; clips?: number } | false
}

/**
 * Grava uma mudança no conjunto e só volta quando ela está salva. Com o conjunto aberto no editor
 * desta aba, passa por ele (a tela acompanha) e espera o salvamento; senão, carrega o conjunto do
 * Storage, aplica e salva direto. Antes (2026-11-08) a Iara criava o vídeo pelo editor e, se o
 * estúdio fechava no meio (minutos de pesquisa e voz), a edição caía no vazio sem erro: o vídeo
 * "pronto" não existia.
 */
export async function commitToSet(set: Pick<CreativeSet, 'id' | 'projectId' | 'shared'>, fn: (s: CreativeSet) => CreativeSet): Promise<void> {
  const ed = useEditor.getState()
  if (ed.status === 'ready' && ed.set?.id === set.id) {
    ed.edit(fn)
    for (let i = 0; i < 120; i++) {
      const now = useEditor.getState()
      // O editor fechou no meio: o close já mandou salvar; confere no Storage abaixo
      if (now.set?.id !== set.id) break
      if (now.saving === 'saved') return
      if (now.saving === 'error') throw new Error('Não consegui salvar o conjunto.')
      if (now.saving === 'dirty') await now.flush()
      else await new Promise((r) => setTimeout(r, 250))
    }
  }
  const fresh = await loadSet(set.id, set.shared ? set.projectId : undefined)
  if (!fresh) throw new Error('Não consegui abrir o conjunto para salvar o vídeo.')
  const next = fn(fresh)
  // Já gravado pelo editor (as mesmas cenas, com o mesmo conteúdo, e as mesmas mídias)? Não grava de novo.
  // O conteúdo conta (2026-11-08): ligar uma mídia já enviada a uma cena muda só a cena, e antes não gravava
  const sceneKey = (x: CodeScene) => JSON.stringify({ ...x, updatedAt: 0 })
  const same = (a: CreativeSet, b: CreativeSet) => (a.scenes ?? []).map(sceneKey).join() === (b.scenes ?? []).map(sceneKey).join() && a.assets.length === b.assets.length
  if (!same(fresh, next)) await saveSet({ ...next, updatedAt: Date.now() })
}

/** A marca do vídeo: a do conjunto; conjunto sem cores usa o DESIGN.md da conta. */
export async function brandForSet(set: CreativeSet): Promise<{ brand?: SetBrand; used: SetBrand }> {
  if (set.brand.colors.length) return { used: set.brand }
  const b = await accountBrand().catch(() => undefined)
  return { brand: b, used: b ?? set.brand }
}

export async function createBriefingVideo(set: CreativeSet, input: BriefingInput, step: Step = () => undefined): Promise<{ scene: CodeScene; research?: Research }> {
  const { brand, used } = await brandForSet(set)
  let research = input.research
  if (!research && input.topic?.trim()) {
    const l = 'Pesquisando o tema na web'
    step(l)
    research = await researchCuriosity(input.topic, { brand: used, extra: input.brief, onStep: (d) => step(l, 'doing', d) })
    step(l, 'done', `${research.facts.length} fatos com fonte: ${research.title}`)
  }
  // Mídia real: o produto do catálogo da conta, fotos livres e clipes curtos
  let mediaPhotos: ExplainerData['photos'] = []
  const topicForMedia = [input.topic, research?.title].filter(Boolean).join(' ')
  if (input.media !== false && topicForMedia.trim()) {
    const l = 'Juntando fotos e vídeos reais'
    step(l)
    const got = await gatherMedia(set, { topic: topicForMedia, free: input.media?.free ?? 2, clips: input.media?.clips ?? 0, onStep: (d) => step(l, 'doing', d) })
    if (got.assets.length) await commitToSet(set, (cur) => ({ ...cur, assets: [...cur.assets, ...got.assets.filter((a) => !cur.assets.some((x) => x.id === a.id))] }))
    mediaPhotos = got.photos
    step(l, got.photos.length ? 'done' : 'warn', [`${got.photos.filter((p) => p.kind !== 'video').length} fotos, ${got.photos.filter((p) => p.kind === 'video').length} clipes`, ...got.notes].join(' · '))
  }
  const base: ExplainerData = {
    ...emptyExplainer(),
    ...input.base,
    mode: 'briefing',
    look: input.look ?? input.base?.look ?? 'editorial',
    briefText: [research?.briefing, input.briefText?.trim()].filter(Boolean).join('\n\n') || undefined,
    brief: input.brief?.trim() || input.base?.brief,
    layout: 'animacao',
    captions: input.base?.captions ?? 'pop',
    photos: [...(input.base?.photos ?? []), ...mediaPhotos],
    brand: brand ?? input.base?.brand,
    research,
  }
  if (!base.briefText && !base.words.length) throw new Error('Sem briefing: diga um tema para pesquisar, escreva o briefing ou mande uma fala.')

  const l = 'A IA escreve o roteiro e monta o vídeo'
  step(l)
  const r = await writeBriefing(set, base, { brand: used, reference: input.reference, onStep: (d) => step(l, 'doing', d) })
  step(l, 'done', `${r.beats.length} cenas`)
  // O crédito que a licença das fotos livres pede vai na legenda
  const credits = creditsLine(base.photos, new Set(r.beats.map((b) => b.photo).filter(Boolean) as string[]))
  let data: ExplainerData = { ...base, beats: r.beats, caption: [r.caption, credits].filter(Boolean).join('\n\n') || undefined }

  if (input.voice) {
    const n = `Narração por voz de IA (${input.voice.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'})`
    step(n)
    try {
      const out = await narrate(set, data, { ...input.voice, brand: used, onStep: (d) => step(n, 'doing', d) })
      await commitToSet(set, (cur) => (cur.assets.some((x) => x.id === out.asset.id) ? cur : { ...cur, assets: [...cur.assets, out.asset] }))
      data = { ...data, ...out.patch }
      step(n, 'done', `${Math.round(out.patch.media!.duration)} s de narração`)
    } catch (err) {
      step(n, 'warn', `${err instanceof Error ? err.message : 'a voz falhou'} O vídeo sai sem narração; dá para gerar depois em Estilo.`)
    }
  }

  const title = (research?.title || data.beats[0]?.headline || 'Vídeo explicativo').replace(/\*/g, '')
  const scene: CodeScene = { ...newScene(EXPLAINER_SCENE, title.length > 48 ? `${title.slice(0, 46)}…` : title), format: '9x16', duration: videoLength(data), explainer: data }
  await commitToSet(set, (cur) => ((cur.scenes ?? []).some((x) => x.id === scene.id) ? cur : { ...cur, scenes: [...(cur.scenes ?? []), scene] }))
  // Confere no Storage: o vídeo precisa estar no conjunto antes de dizer que está pronto
  const check = await loadSet(set.id, set.shared ? set.projectId : undefined)
  if (!check?.scenes?.some((x) => x.id === scene.id)) throw new Error('O vídeo foi montado mas não ficou salvo no conjunto. Tente de novo.')
  return { scene, research }
}
