import { create } from 'zustand'
import { toast } from 'sonner'
import { coverJpeg, explainerToMp4, loadVoice, mixOptions, usesVoice } from './explicativo/media'
import { mixExplainer, sfxAt } from './explicativo/sfx'
import { outBeats, outWords } from './explicativo/timeline'
import { saveFileViaLink, useCreativeLink } from './link'
import { SceneRunner, sceneToMp4, type SceneInput } from './scene'
import { sceneDataOf } from './sceneEdit'
import { useEditor } from './store'
import { sizeOf, type CodeScene, type CreativeSet } from './types'
import { audioOfSrc, mixAudio } from './video'
import { zipFiles } from './zip'
import { EDITS_PATH, editsFolder, phrases, r2, silent, speechSpans, srtOf, wavOf } from './editsFormat'

/**
 * Levar um vídeo ao Edits (Instagram) (2026-11-13, o usuário: "estou fazendo um fluxo de criar vídeos com o MCP
 * do Edits… ele permite trabalhar com música e publicar direto da plataforma… precisamos de uma forma de exportar
 * os assets de um criativo e levar pra plataforma"; escolheu as camadas separadas, numa pasta do Mac e em ZIP).
 *
 * O pacote sai sem a trilha de fundo (a música entra no Edits) e com as camadas soltas para ajustar lá:
 *   video.mp4              o vídeo como no app (legenda, voz e efeitos), sem a música de fundo
 *   video-sem-legenda.mp4  o mesmo sem a legenda queimada (só quando o vídeo tem legenda)
 *   voz.wav · efeitos.wav  a narração tratada e os efeitos sonoros, cada um sozinho, do tamanho do vídeo
 *   trilha-original.wav    a trilha de uma animação sem narração (referência; o Edits troca)
 *   legenda.srt            a fala com o tempo (ou o texto de cada cena, sem fala)
 *   capa.jpg · post.txt    a capa do reels e a legenda do post
 *   manifesto.json         cenas com início e fim, palavras, trechos de fala (para abaixar a música) e batidas
 *
 * Com o conector (ou `npm run dev`) neste computador, grava em `~/Sinfy/Edits/<pasta>/`, que o MCP do
 * Edits lê; sem ele, baixa o ZIP. O manifesto é o último arquivo gravado: quando ele aparece, o pacote está pronto.
 * A IA conectada pede pelo MCP da Sinfy (`sinfy_video_edits`); a tela aberta do vídeo gera sozinha.
 */

export { editsFolder, EDITS_PATH }

const jpegOf = (bmp: ImageBitmap) => {
  const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Sem capa.'))), 'image/jpeg', 0.92))
}

const json = (v: unknown) => new Blob([`${JSON.stringify(v, null, 2)}\n`], { type: 'application/json' })
const text = (v: string) => new Blob([v.endsWith('\n') ? v : `${v}\n`], { type: 'text/plain;charset=utf-8' })

// ---------- o pacote ----------

export interface EditsFile { name: string; blob: Blob }
export interface EditsPack { folder: string; files: EditsFile[] }

export interface PackOptions {
  /** Também o vídeo sem a legenda queimada (gera o MP4 duas vezes). Padrão: sim, quando há legenda. */
  withoutCaptions?: boolean
  /** Animação em código: o que a cena recebe para desenhar fora da prévia (o mesmo do "Baixar MP4"). */
  sceneInput?: () => Promise<Omit<SceneInput, 'code' | 'width' | 'height' | 'duration'>>
  onStep?: (step: string, progress?: number) => void
  signal?: AbortSignal
}

export async function buildEditsPack(scene: CodeScene, set: CreativeSet, opts: PackOptions = {}): Promise<EditsPack> {
  const step = opts.onStep ?? (() => {})
  await useEditor.getState().ensureAssets()
  const images = useEditor.getState().images
  const { width, height } = sizeOf(scene.format)
  const total = scene.duration
  const files: EditsFile[] = []
  const caption = (scene.caption ?? scene.explainer?.caption ?? '').trim()
  const base = { versao: 1, origem: 'Sinfy', conjunto: { id: set.id, nome: set.name }, video: { id: scene.id, nome: scene.name }, formato: scene.format, largura: width, altura: height, fps: 30, duracao: r2(total) }

  if (scene.explainer) {
    const data = scene.explainer
    const voice = usesVoice(data) ? (await loadVoice(set, data))?.data : undefined
    const mix = await mixOptions(set, data)
    const noMusic = { ...mix, music: undefined }
    step('Mixando o áudio sem a música')
    const full = await mixExplainer(voice, data, total, noMusic)
    const voz = voice ? await mixExplainer(voice, data, total, { ...noMusic, sfxVolume: 0 }) : undefined
    const fx = await mixExplainer(undefined, data, total, { ...noMusic, voiceVolume: 0 })

    const hasCaptions = data.captions !== 'nenhuma' && outWords(data).length > 0
    const both = hasCaptions && opts.withoutCaptions !== false
    step('Gerando o vídeo', 0)
    files.push({ name: 'video.mp4', blob: await explainerToMp4(scene, set, images, { mixed: full, signal: opts.signal, onProgress: (p) => step('Gerando o vídeo', both ? p / 2 : p) }) })
    if (both) {
      const clean: CodeScene = { ...scene, explainer: { ...data, captions: 'nenhuma' } }
      files.push({ name: 'video-sem-legenda.mp4', blob: await explainerToMp4(clean, set, images, { mixed: full, signal: opts.signal, onProgress: (p) => step('Gerando o vídeo sem legenda', 0.5 + p / 2) }) })
    }
    if (voz && !silent(voz)) files.push({ name: 'voz.wav', blob: wavOf(voz) })
    if (!silent(fx)) files.push({ name: 'efeitos.wav', blob: wavOf(fx) })

    step('Capa e legenda')
    files.push({ name: 'capa.jpg', blob: await coverJpeg(scene, set, images) })
    const words = outWords(data)
    const beats = outBeats(data, total)
    const lines = words.length ? phrases(words) : beats.map((b) => ({ text: b.fala || [b.headline, b.sub].filter(Boolean).join(' — '), s: b.start, e: b.end }))
    files.push({ name: 'legenda.srt', blob: text(srtOf(lines)) })
    if (caption) files.push({ name: 'post.txt', blob: text(caption) })
    files.push({
      name: 'manifesto.json',
      blob: json({
        ...base,
        gerado_em: new Date().toISOString(),
        tipo: 'roteiro',
        estilo: data.look ?? 'editorial',
        legenda_queimada: hasCaptions ? data.captions : null,
        arquivos: Object.fromEntries(files.map((f) => [f.name, describe(f.name)])),
        legenda_do_post: caption || null,
        musica: { no_video: false, trilha_do_app: data.music?.name ?? null, volume_no_app: data.music?.volume ?? null, dica: 'Escolha a música no Edits e abaixe-a nos trechos de fala (fala[]).' },
        fala: speechSpans(words),
        cenas: beats.map((b, i) => ({ n: i + 1, inicio: r2(b.start), fim: r2(b.end), padrao: b.pattern, texto: b.headline, apoio: b.sub ?? null, fala: b.fala ?? null, transicao: b.transition, efeito_sonoro: b.sfx, efeito_em: r2(sfxAt(b)) })),
        palavras: words.map((w) => ({ w: w.w, s: w.s, e: w.e })),
      }),
    })
    return { folder: editsFolder(scene), files }
  }

  // Animação em código
  if (!opts.sceneInput) throw new Error('Abra o vídeo no estúdio para exportar esta animação.')
  const input = await opts.sceneInput()
  const sd = sceneDataOf(scene.data)
  const words = (sd.words ?? []).filter((w) => w && typeof w.s === 'number')
  const narrated = !!scene.audio && words.length > 0
  const raw = scene.audio ? await audioOfSrc(scene.audio.src, set.assets) : undefined
  const track = raw && scene.audio ? await mixAudio(raw, scene.audio, total) : undefined
  const hasCaptions = !!sd.captions && sd.captions.style !== 'nenhuma' && words.length > 0
  const both = hasCaptions && opts.withoutCaptions !== false
  step('Gerando o vídeo', 0)
  // Narração fica no vídeo; trilha de música não (o Edits põe a dele)
  const audio = narrated && raw && scene.audio ? { data: raw, cfg: scene.audio } : undefined
  files.push({ name: 'video.mp4', blob: await sceneToMp4(scene, input, { audio, signal: opts.signal, onProgress: (p) => step('Gerando o vídeo', both ? p / 2 : p) }) })
  if (both) {
    const clean = { ...input, data: { ...sd, captions: { ...sd.captions!, style: 'nenhuma' as const } } }
    files.push({ name: 'video-sem-legenda.mp4', blob: await sceneToMp4(scene, clean, { audio, signal: opts.signal, onProgress: (p) => step('Gerando o vídeo sem legenda', 0.5 + p / 2) }) })
  }
  if (track && !silent(track)) files.push({ name: narrated ? 'voz.wav' : 'trilha-original.wav', blob: wavOf(track) })

  step('Capa e legenda')
  const parts = sd.parts ?? []
  const coverT = scene.coverAt !== undefined && scene.coverAt <= total ? scene.coverAt : parts[1] ? Math.min(total - 0.2, (parts[1].start + parts[1].end) / 2) : total * 0.55
  const runner = new SceneRunner({ ...input, code: scene.code, width, height, duration: total })
  try {
    await runner.load()
    files.push({ name: 'capa.jpg', blob: await jpegOf(await runner.frame(Math.max(0, coverT))) })
  } finally {
    runner.dispose()
  }
  const lines = words.length ? phrases(words) : parts.map((p) => ({ text: p.text, s: p.start, e: p.end }))
  if (lines.length) files.push({ name: 'legenda.srt', blob: text(srtOf(lines)) })
  if (caption) files.push({ name: 'post.txt', blob: text(caption) })
  files.push({
    name: 'manifesto.json',
    blob: json({
      ...base,
      gerado_em: new Date().toISOString(),
      tipo: 'animacao',
      legenda_queimada: hasCaptions ? sd.captions!.style : null,
      arquivos: Object.fromEntries(files.map((f) => [f.name, describe(f.name)])),
      legenda_do_post: caption || null,
      musica: { no_video: false, trilha_do_app: !narrated ? scene.audio?.name ?? null : null, dica: 'Escolha a música no Edits e abaixe-a nos trechos de fala (fala[]).' },
      fala: speechSpans(words),
      cenas: parts.map((p, i) => ({ n: i + 1, inicio: r2(p.start), fim: r2(p.end), rotulo: p.label, texto: p.text })),
      batidas: scene.beats?.map(r2) ?? [],
      bpm: scene.bpm ?? null,
      palavras: words.map((w) => ({ w: w.w, s: w.s, e: w.e })),
    }),
  })
  return { folder: editsFolder(scene), files }
}

function describe(name: string): string {
  return ({
    'video.mp4': 'O vídeo como no app (legenda, voz e efeitos), sem a música de fundo. H.264 + AAC, 30 fps.',
    'video-sem-legenda.mp4': 'O mesmo vídeo sem a legenda queimada, para legendar no Edits.',
    'voz.wav': 'Só a narração, do tamanho do vídeo (WAV 48 kHz).',
    'efeitos.wav': 'Só os efeitos sonoros, no tempo das cenas (WAV 48 kHz).',
    'trilha-original.wav': 'A trilha usada no app (referência; troque pela música do Edits).',
    'legenda.srt': 'A legenda com o tempo de cada frase.',
    'capa.jpg': 'A capa do reels.',
    'post.txt': 'A legenda do post.',
  } as Record<string, string>)[name] ?? name
}

// ---------- gravar ----------

const CHUNK = 12 * 1024 * 1024

const base64Of = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1))
    r.onerror = () => reject(r.error ?? new Error('Não consegui ler o arquivo.'))
    r.readAsDataURL(blob)
  })

/** O conector (ou o `npm run dev`) está de pé neste computador: dá para gravar na pasta. */
export const canSaveToFolder = () => {
  const s = useCreativeLink.getState()
  return !!s.channel && s.connected && !s.stale
}

/** Grava na pasta do Edits pelo conector (o manifesto por último) e devolve o caminho dela. */
export async function savePackToFolder(pack: EditsPack, onStep?: (step: string, progress?: number) => void, signal?: AbortSignal): Promise<string> {
  const ordered = [...pack.files.filter((f) => f.name !== 'manifesto.json'), ...pack.files.filter((f) => f.name === 'manifesto.json')]
  const size = ordered.reduce((n, f) => n + f.blob.size, 0) || 1
  let sent = 0
  let dir = ''
  for (const f of ordered) {
    for (let at = 0, parte = 0; at < f.blob.size || parte === 0; at += CHUNK, parte++) {
      const piece = f.blob.slice(at, at + CHUNK)
      const res = await saveFileViaLink({ pasta: pack.folder, nome: f.name, data: await base64Of(piece), parte }, signal)
      dir = res.pasta
      sent += piece.size
      onStep?.(`Gravando ${f.name}`, sent / size)
    }
  }
  return dir
}

export async function downloadPackZip(pack: EditsPack) {
  const blob = await zipFiles(pack.files.map((f) => ({ name: f.name, blob: f.blob })))
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${pack.folder}-edits.zip` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}

// ---------- o trabalho (um por vez, visível em qualquer estúdio) ----------

interface EditsState {
  running: boolean
  sceneId?: string
  step?: string
  progress?: number
  /** Onde ficou o último pacote (pasta no Mac ou ZIP). */
  last?: { sceneId: string; where: 'pasta' | 'zip'; path?: string }
}

export const useEditsExport = create<EditsState>(() => ({ running: false }))

/**
 * Gera o pacote e grava na pasta do Edits (ou baixa o ZIP, sem conector ou quando pedem `zip`).
 * `zip: true` força o ZIP; com o conector, o ZIP também pode ser pedido à parte.
 */
export async function exportToEdits(scene: CodeScene, set: CreativeSet, opts: Omit<PackOptions, 'onStep'> & { zip?: boolean; quiet?: boolean } = {}) {
  if (useEditsExport.getState().running) {
    toast.info('Já estou gerando um pacote para o Edits. Espere terminar.')
    return
  }
  const onStep = (step: string, progress?: number) => useEditsExport.setState({ step, progress })
  useEditsExport.setState({ running: true, sceneId: scene.id, step: 'Preparando', progress: undefined })
  try {
    const pack = await buildEditsPack(scene, set, { ...opts, onStep })
    const toFolder = !opts.zip && canSaveToFolder()
    if (toFolder) {
      try {
        const path = await savePackToFolder(pack, onStep, opts.signal)
        useEditsExport.setState({ last: { sceneId: scene.id, where: 'pasta', path } })
        toast.success('Pacote pronto para o Edits', { description: path, duration: 12_000 })
        return { where: 'pasta' as const, path }
      } catch (err) {
        // Conector antigo (não conhece o pedido) ou disco: cai para o ZIP
        const msg = err instanceof Error ? err.message : String(err)
        toast.warning('Não gravei na pasta do Edits; baixei o ZIP.', { description: /desconhecido/i.test(msg) ? 'Baixe o conector de novo para gravar direto na pasta.' : msg })
      }
    }
    await downloadPackZip(pack)
    useEditsExport.setState({ last: { sceneId: scene.id, where: 'zip' } })
    if (!opts.quiet) toast.success('Pacote do Edits baixado (ZIP).')
    return { where: 'zip' as const }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Não consegui gerar o pacote do Edits.')
  } finally {
    useEditsExport.setState({ running: false, step: undefined, progress: undefined })
  }
}
