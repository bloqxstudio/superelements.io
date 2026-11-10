import { accountContext } from '@/features/cerebro/accountContext'
import { useCrm } from '@/features/crm/crmStore'
import { referenceShotUrl, type Reference as SavedReference } from '@/features/referencias/api'
import { accountSets } from './accountSets'
import { downloadReelViaLink } from './link'
import { referenceShots, type DenseReference } from './sceneAi'
import { loadSet } from './storage'
import type { CodeScene, CreativeSet } from './types'
import { createVideoFromReference } from './videoFromReference'
import { DEFAULT_PLAN, STYLE_IDS, recentDirections, suggestPlan, type StyleId, type VideoPlan } from './videoPlan'

/**
 * Um vídeo novo a partir de uma referência, pedido no chat (2026-11-10; o usuário: "isso acontece quando faço pela
 * interface? ou só pelo chat? identifique quando seleciono uma referência… permitir criar um novo vídeo com base
 * nisso"). O mesmo caminho do criador, sem a tela: abre o conjunto, lê a referência (o movimento pelo link, se for
 * reel do Instagram e a pessoa pediu pelo chat; senão os quadros guardados), a IA monta a ficha e a decupagem, e o
 * vídeo sai em modo agente (`videoAgent.ts`). Devolve o vídeo para a Iara abrir no estúdio.
 */

const IG = /instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\//i

const dataUrlOf = async (url: string) => {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export interface ChatVideoInput {
  reference?: SavedReference
  /** Id ou parte do nome do conjunto; sem ele, o primeiro da conta. */
  set?: string
  how: 'igual' | 'novo'
  topic?: string
  rules?: string
  style?: string
  copy?: string
  /** Ler o vídeo da referência pelo link (padrão: sim, quando é reel do Instagram). */
  motion?: boolean
  onStep?: (label: string, detail?: string) => void
}

/** A referência pronta para a geração: o movimento (quadros densos) ou os quadros guardados. */
export async function referenceInput(teamId: string, r: SavedReference, motion = true, onStep?: (d: string) => void): Promise<{ frames: string[]; times?: number[]; dense?: DenseReference }> {
  if (motion && IG.test(r.url)) {
    try {
      onStep?.('Lendo o movimento da referência pelo link (o vídeo não fica guardado)…')
      const out = await downloadReelViaLink(r.url)
      const blob = await (await fetch(out.data)).blob()
      return await referenceShots(new File([blob], out.name, { type: out.type }), 12)
    } catch (e) {
      onStep?.(`Não consegui ler o vídeo (${e instanceof Error ? e.message : 'erro'}); sigo com os quadros guardados.`)
    }
  }
  const frames: string[] = []
  for (const p of [r.mediaPath, ...r.frames].filter((x): x is string => !!x).slice(0, 12)) {
    try { frames.push(await dataUrlOf(await referenceShotUrl(teamId, p))) } catch { /* segue com os outros */ }
  }
  return { frames }
}

export async function videoFromChat(o: ChatVideoInput): Promise<{ set: CreativeSet; scene: CodeScene }> {
  const team = useCrm.getState().team
  if (!team) throw new Error('Abra uma conta primeiro.')
  const step = o.onStep ?? (() => undefined)
  const sets = await accountSets(team.id, team.isHome)
  if (!sets.length) throw new Error('A conta não tem conjunto de criativos: crie um em Criativos primeiro.')
  const hint = o.set?.trim().toLowerCase()
  const sum = (hint && (sets.find((s) => s.id === o.set) ?? sets.find((s) => s.name.toLowerCase().includes(hint)))) || sets[0]
  const set = await loadSet(sum.id, sum.shared ? sum.projectId : undefined)
  if (!set) throw new Error('Não consegui abrir o conjunto.')
  step('Conjunto', set.name)

  const ref = o.reference ? await referenceInput(team.id, o.reference, o.motion !== false, (d) => step('Referência', d)) : { frames: [] as string[] }
  step('Referência', o.reference ? `${ref.dense ? `${ref.dense.frames.length} quadros com movimento` : `${ref.frames.length} quadros parados`} de "${o.reference.title || o.reference.url}"` : 'Sem referência')

  const brief = (await accountContext('9x16').catch(() => undefined))?.context
  const history = recentDirections(set)
  const style = (STYLE_IDS as string[]).includes(o.style ?? '') ? (o.style as StyleId) : 'livre'
  const base: VideoPlan = {
    ...DEFAULT_PLAN,
    how: o.how,
    topic: o.topic?.trim() ?? '',
    rules: o.rules?.trim() ?? '',
    copy: o.copy?.trim() ?? '',
    style,
    logo: set.brand.logoOnDark ? 'escuro' : set.brand.logoOnLight ? 'claro' : 'nenhum',
  }
  step('Plano', 'A IA lê a referência e monta a ficha e a decupagem…')
  const s = await suggestPlan(set, { frames: ref.frames, notes: o.reference?.notes, title: o.reference?.title, brief, plan: base, history }, (d) => step('Plano', d))
  const plan: VideoPlan = { ...base, ...s, how: base.how, rules: base.rules, voice: base.voice, narrate: base.narrate, topic: base.how === 'novo' && base.topic ? base.topic : s.topic ?? base.topic, captions: { ...base.captions, ...s.captions } }
  step('Plano', `${plan.shots.length} cenas, estilo ${plan.style}`)
  const scene = await createVideoFromReference(set, { frames: ref.frames, times: ref.times, dense: ref.dense, how: plan.how, topic: plan.topic, notes: o.reference?.notes || undefined, title: o.reference?.title, plan }, { brief, history, onStep: step })
  return { set, scene }
}
