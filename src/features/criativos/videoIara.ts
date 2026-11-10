import { useIaraScreen, type IaraAction, type IaraDone } from '@/features/iara/store'
import { useEditor } from './store'
import { sceneFrames } from './sceneCheck'
import { writeSceneCode } from './sceneAi'
import { CAPTION_STYLES, narrateParts, sceneDataOf, type CaptionStyle, type SceneCaptions } from './sceneEdit'
import { DEFAULT_VOICE } from './explicativo/VoicePicker'
import { tryScene } from './videoFromReference'
import type { CodeScene, CreativeSet } from './types'

/**
 * O estúdio de animação na Iara (2026-11-09; o usuário, apontando o "prompt avançado" do estúdio: "esse comando
 * de IA pode estar dentro da Iara, não?"). Com o vídeo aberto, a Iara sabe a cena (partes, campos, legenda) e
 * age nela pelas ações abaixo. Trocar campo e legenda é na hora; ajustar a animação e narrar levam minutos e
 * rodam como trabalho na aba. Tudo entra pelo editor aberto (aparece na prévia, é salvo, desfaz).
 */

type Result = { done: IaraDone[]; data?: unknown; images?: { name: string; data: string }[] }
type Full = IaraAction & { exec?: (args: Record<string, unknown>) => Promise<Result> }

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

const current = (id: string) => {
  const st = useEditor.getState()
  const scene = st.set?.scenes?.find((s) => s.id === id)
  if (!st.set || !scene) throw new Error('O vídeo não está mais aberto nesta aba.')
  return { set: st.set, scene }
}
const editScene = (id: string, fn: (s: CodeScene) => CodeScene) =>
  useEditor.getState().edit((set: CreativeSet) => ({ ...set, scenes: (set.scenes ?? []).map((s) => (s.id === id ? { ...fn(s), updatedAt: Date.now() } : s)) }))

/** Quadros do vídeo como a pessoa vê (JPEG pequeno), para a Iara conferir. */
const frames = async (set: CreativeSet, scene: CodeScene, times: number[]) => (await sceneFrames(set, scene, times)).map(({ name, data }) => ({ name, data }))
const defaultTimes = (scene: CodeScene) => {
  const parts = sceneDataOf(scene.data).parts
  return parts?.length ? parts.slice(0, 6).map((p) => Math.min(p.end - 0.1, p.start + 1.4)) : [0.15, 0.35, 0.6, 0.85].map((k) => k * scene.duration)
}

function describe(set: CreativeSet, scene: CodeScene, error?: string) {
  const d = sceneDataOf(scene.data)
  return [
    `Estúdio de vídeo com a animação "${scene.name}" (vídeo ${scene.id}, conjunto "${set.name}") aberta: ${scene.duration} s, ${scene.format}${scene.audio ? `, trilha "${scene.audio.name}"` : ', sem trilha'}.`,
    d.parts?.length ? `Narração em partes:\n${d.parts.map((p, i) => `${i + 1}. ${p.start.toFixed(1)}–${p.end.toFixed(1)} s · "${p.label}" · ${p.text}`).join('\n')}` : 'Sem narração.',
    d.fields?.length ? `Campos editáveis (video_editar):\n${d.fields.map((f) => `- ${f.key} (${f.type}${f.options ? `: ${f.options.join(' | ')}` : ''}${f.group ? `, ${f.group}` : ''}) "${f.label}" = ${JSON.stringify(f.value)}`).join('\n')}` : 'A animação ainda não tem campos editáveis (video_ajustar com "deixar editável" cria).',
    `Legenda do motor: ${d.captions?.style ?? 'nenhuma'}${d.words?.length ? '' : ' (sem palavras marcadas: precisa de narração)'}.`,
    error ? `A cena está com erro agora: ${error}` : '',
    '"Este vídeo", "a animação", "aqui" = este vídeo. Para trocar texto, cor, efeito ou legenda use video_editar (na hora); para mudar o desenho ou o movimento, video_ajustar; para mudar a fala ou a voz, video_narrar; para olhar, video_ver.',
  ].filter(Boolean).join('\n')
}

function actionsFor(sceneId: string): Full[] {
  return [
    {
      name: 'video_ver',
      doc: '{"tempos"?:[segundos]} — quadros do vídeo aberto como imagem (padrão: um por parte da narração), para conferir texto, logo, legenda e composição.',
      run: async () => ({ label: 'Olhei o vídeo.', ok: true }),
      exec: async (a) => {
        const { set, scene } = current(sceneId)
        const times = Array.isArray(a.tempos) ? a.tempos.map(Number).filter(Number.isFinite).slice(0, 8) : defaultTimes(scene)
        return { done: [], data: { video: scene.name, duracao: scene.duration }, images: await frames(set, scene, times.length ? times : defaultTimes(scene)) }
      },
    },
    {
      name: 'video_editar',
      doc: `{"campos"?:{chave:valor},"legenda"?:{"estilo"?:${CAPTION_STYLES.map((c) => `"${c.id}"`).join('|')},"altura"?:0.1-0.92,"tamanho"?:0.6-1.6,"cor"?:"#RRGGBB"},"rotulos"?:[texto por parte],"nome"?:string} — muda na hora o vídeo aberto, sem refazer a animação: valores dos campos editáveis (as chaves da tela), a legenda desenhada pelo motor, os rótulos das partes, o nome.`,
      run: async () => ({ label: 'Vídeo editado.', ok: true }),
      exec: async (a) => {
        const { scene } = current(sceneId)
        const d = sceneDataOf(scene.data)
        const changed: string[] = []
        const campos = a.campos && typeof a.campos === 'object' ? (a.campos as Record<string, unknown>) : {}
        const fields = (d.fields ?? []).map((f) => {
          if (!(f.key in campos)) return f
          const v = campos[f.key]
          let value: typeof f.value = f.value
          if (f.type === 'numero' && Number.isFinite(Number(v))) value = Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, Number(v)))
          else if (f.type === 'liga') value = v === true || v === 'true'
          else if (f.type === 'opcao' && f.options?.includes(String(v))) value = String(v)
          else if (f.type === 'cor' && /^#[0-9a-f]{6}$/i.test(String(v))) value = String(v).toUpperCase()
          else if (f.type === 'texto' && typeof v === 'string') value = v.slice(0, 200)
          if (value !== f.value) changed.push(`${f.label}: ${JSON.stringify(value)}`)
          return { ...f, value }
        })
        const unknown = Object.keys(campos).filter((k) => !(d.fields ?? []).some((f) => f.key === k))
        let captions = d.captions
        if (a.legenda && typeof a.legenda === 'object') {
          const l = a.legenda as Record<string, unknown>
          const next: SceneCaptions = { ...(d.captions ?? { style: 'nenhuma' }) }
          if (CAPTION_STYLES.some((c) => c.id === l.estilo)) next.style = l.estilo as CaptionStyle
          if (Number.isFinite(Number(l.altura))) next.y = Math.min(0.92, Math.max(0.1, Number(l.altura)))
          if (Number.isFinite(Number(l.tamanho))) next.size = Math.min(1.6, Math.max(0.6, Number(l.tamanho)))
          if (typeof l.cor === 'string' && /^#[0-9a-f]{6}$/i.test(l.cor)) next.color = l.cor.toUpperCase()
          captions = next
          changed.push(`legenda ${next.style}`)
        }
        const rotulos = Array.isArray(a.rotulos) ? a.rotulos.map((x) => String(x).slice(0, 60)) : undefined
        const parts = rotulos && d.parts ? d.parts.map((p, i) => (rotulos[i] ? { ...p, label: rotulos[i] } : p)) : d.parts
        if (rotulos) changed.push('rótulos das partes')
        const nome = str(a.nome, 80)
        if (nome) changed.push(`nome "${nome}"`)
        editScene(sceneId, (s) => ({ ...s, name: nome ?? s.name, data: { ...sceneDataOf(s.data), fields, captions, parts } }))
        return {
          done: [{ label: changed.length ? `Vídeo: ${changed.join(', ')}` : 'Nada mudou no vídeo.', ok: changed.length > 0 }],
          data: unknown.length ? { campos_que_nao_existem: unknown, campos_validos: (d.fields ?? []).map((f) => f.key) } : undefined,
        }
      },
    },
    {
      name: 'video_ajustar',
      doc: '{"pedido":string} — o agente de criativos reescreve a animação do vídeo aberto (desenho, composição, movimento, efeitos, logo, deixar editável) mantendo a narração, os tempos e os campos. O motor confere antes de gravar (com uma correção). Leva de 1 a 4 minutos; devolve o que mudou e quadros para conferir.',
      label: (a) => `Ajustar a animação: ${str(a.pedido, 80) ?? ''}`,
      long: true,
      run: async () => ({ label: 'Animação ajustada.', ok: true }),
      exec: async (a) => {
        const pedido = str(a.pedido)
        if (!pedido) throw new Error('Diga o que mudar na animação.')
        const { set, scene } = current(sceneId)
        let out = await writeSceneCode(set, scene, pedido, { adjust: true })
        const data = (fields = out.fields) => ({ ...sceneDataOf(scene.data), fields: fields ?? sceneDataOf(scene.data).fields })
        let error = await tryScene(out.code, set, out.duration ?? scene.duration, data(), scene.format)
        if (error) {
          out = await writeSceneCode(set, { ...scene, code: out.code, data: data() }, `${pedido}\n\nO código abaixo deu este erro ao rodar: ${error}\nCorrija sem mudar a ideia.`, { adjust: true })
          error = await tryScene(out.code, set, out.duration ?? scene.duration, data(), scene.format)
        }
        if (error) throw new Error(`A animação ajustada não rodou (${error}); o vídeo ficou como estava.`)
        editScene(sceneId, (s) => ({ ...s, code: out.code, prompt: pedido, duration: sceneDataOf(s.data).parts?.length ? s.duration : out.duration ?? s.duration, data: { ...sceneDataOf(s.data), fields: out.fields ?? sceneDataOf(s.data).fields } }))
        const fresh = current(sceneId)
        return {
          done: [{ label: `Animação ajustada: ${scene.name}`, ok: true }],
          data: { o_que_mudou: out.reply, campos: (out.fields ?? []).map((f) => f.key) },
          images: await frames(fresh.set, fresh.scene, defaultTimes(fresh.scene)).catch(() => undefined),
        }
      },
    },
    {
      name: 'video_narrar',
      doc: '{"partes"?:[{"rotulo":string,"fala":string}],"voz"?:"marin"|"cedar"|…} — narra de novo o vídeo aberto (voz da OpenAI): as falas novas (sem "partes", as de agora) e a voz. Os tempos das partes e a duração seguem a voz nova; a animação acompanha. Leva cerca de 1 minuto.',
      label: () => 'Narrar o vídeo de novo',
      long: true,
      run: async () => ({ label: 'Narração refeita.', ok: true }),
      exec: async (a) => {
        const { set, scene } = current(sceneId)
        const d = sceneDataOf(scene.data)
        const given = Array.isArray(a.partes) ? (a.partes as Record<string, unknown>[]).map((p) => ({ label: String(p.rotulo ?? '').slice(0, 60), text: String(p.fala ?? '').trim() })).filter((p) => p.text) : undefined
        const parts = given?.length ? given : (d.parts ?? []).map((p) => ({ label: p.label, text: p.text }))
        if (!parts.length) throw new Error('Diga as falas (partes) para narrar.')
        const voice = { ...(d.voice ?? DEFAULT_VOICE), ...(str(a.voz, 30) ? { provider: 'openai' as const, voice: str(a.voz, 30)! } : {}) }
        const n = await narrateParts(set, parts, voice)
        useEditor.getState().edit((cur) => ({
          ...cur,
          assets: cur.assets.some((x) => x.id === n.asset.id) ? cur.assets : [...cur.assets, { ...n.asset, kind: 'audio', duration: n.seconds }],
          scenes: (cur.scenes ?? []).map((s) => s.id !== sceneId ? s : {
            ...s,
            duration: Math.round((n.seconds + 1.8) * 10) / 10,
            audio: { src: `asset:${n.asset.id}`, name: n.name, volume: s.audio?.volume ?? 1, offset: 0, fadeIn: 0, fadeOut: 0.4 },
            data: { ...sceneDataOf(s.data), parts: n.parts, words: n.words, voice },
            updatedAt: Date.now(),
          }),
        }))
        return { done: [{ label: `Narração refeita (${n.name}, ${n.seconds.toFixed(1)} s)`, ok: true }], data: { partes: n.parts.map((p) => `${p.start.toFixed(1)}s ${p.label}`) } }
      },
    },
  ]
}

/** Registra o vídeo aberto na Iara (a tela, a seleção e as ações de vídeo). */
export function useVideoIara(set: CreativeSet | null | undefined, scene: CodeScene | undefined, error?: string) {
  useIaraScreen(
    set && scene
      ? {
          id: `video:${set.id}:${scene.id}`,
          title: `Vídeo: ${scene.name}`,
          describe: () => {
            const st = useEditor.getState()
            const s = st.set?.scenes?.find((x) => x.id === scene.id)
            return st.set && s ? describe(st.set, s, error) : ''
          },
          selection: () => `Vídeo "${useEditor.getState().set?.scenes?.find((x) => x.id === scene.id)?.name ?? scene.name}"`,
          actions: actionsFor(scene.id),
        }
      : null
  )
}
