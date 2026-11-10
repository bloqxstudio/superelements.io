import { iaFor } from '@/features/ia/porTarefa'
import { callAiQuiet } from './link'
import { SceneRunner, sceneBitmaps } from './scene'
import { useEditor } from './store'
import { sizeOf, type CodeScene, type CreativeSet } from './types'
import { CHECK_SYSTEM, parseCheck } from './videoDirection'

/**
 * Ver o vídeo como a pessoa vê e conferir contra o pedido (2026-11-10). Antes só se conferia se o código rodava;
 * agora a IA olha quadros do vídeo pronto e diz o que não cumpre as regras (`buildChecklist`).
 */

/** Quadros do vídeo como a pessoa vê (JPEG pequeno), com os logos da marca carregados. */
export async function sceneFrames(set: CreativeSet, scene: CodeScene, times: number[], width = 360) {
  const st = useEditor.getState()
  await Promise.all([set.brand.logoOnLight, set.brand.logoOnDark].filter((x): x is string => !!x).map((src) => st.ensureImage(src).catch(() => undefined)))
  const { width: W, height: H } = sizeOf(scene.format)
  const r = new SceneRunner({ code: scene.code, width: W, height: H, duration: scene.duration, images: await sceneBitmaps(scene, useEditor.getState().images, set.brand), brand: { name: set.brand.name, colors: set.brand.colors.map((c) => c.hex), font: set.brand.headingFont }, data: scene.data })
  try {
    await r.load()
    const out: { name: string; data: string; t: number }[] = []
    for (const t0 of times) {
      const t = Math.max(0, Math.min(scene.duration - 0.05, t0))
      const bmp = await r.frame(t)
      const h = Math.round((width * H) / W)
      const c = Object.assign(document.createElement('canvas'), { width, height: h })
      c.getContext('2d')!.drawImage(bmp, 0, 0, width, h)
      bmp.close()
      out.push({ name: `quadro-${t.toFixed(1)}s.jpg`, data: c.toDataURL('image/jpeg', 0.82), t })
    }
    return out
  } finally {
    r.dispose()
  }
}

/** A IA confere os quadros contra a lista de regras. `labels` diz a cena de cada quadro. */
export async function checkScene(set: CreativeSet, scene: CodeScene, checklist: string[], at: { t: number; label: string }[], onStep?: (s: string) => void): Promise<{ ok: boolean; problems: string[] }> {
  const shots = await sceneFrames(set, scene, at.map((x) => x.t))
  const prompt = [
    `## As regras do pedido\n${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
    `## Os quadros anexados, em ordem\n${shots.map((s, i) => `${i + 1}. ${s.t.toFixed(1)} s · ${at[i]?.label ?? ''}`).join('\n')}`,
  ].join('\n\n')
  const out = await callAiQuiet<{ reply?: string; items?: { ref: string; text: string }[] }>('agent', { ...iaFor('video'), system: CHECK_SYSTEM, prompt, images: shots.map((s) => s.data) }, undefined, (_s, d) => onStep?.(d || 'A IA confere os quadros…'))
  return parseCheck((out.items ?? []).find((i) => i.ref === 'resultado')?.text)
}
