// Criativo final (modelo do 03): texto fixo, desktop do case com a entrada e o percurso.
//   node gravar-final.mjs [--quadros 4,12] [--out arq.mp4]
import { spawn } from 'node:child_process'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AQUI, RAIZ, abrirSite, comNavegador, enderecoDoSpace, espera } from './lib.mjs'
const argv = process.argv.slice(2)
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined }
const fotos = flag('quadros')?.split(',').map(Number)
const saida = path.resolve(flag('out') ?? path.join(AQUI, 'arquitetos-final-4x5.mp4'))
const SP = { projeto: '817e7afc-f37b-46b0-95da-860469e8e8aa', pagina: '30c4d7f3-08cb-4484-b7db-810531151953' }
const FPS = 30, SITE0 = 0.7, FIM = 1.8
// rótulo do mockup por trecho: [rótulo, ate, dur, pausa, ease]
const PASSOS = [
  ['Abertura em tela cheia', 900, 1.3, 0.3], ['Capítulos que empilham', 1981, 1.0, 0.3], ['Capítulos que empilham', 2881, 0.8, 0.2],
  ['Capítulos que empilham', 3781, 0.8, 0.2], ['Capítulos que empilham', 4681, 0.8, 0.2], ['Decisões de projeto', 5581, 1.0, 0.9],
  ['Galeria que desliza', 6817, 1.1, 0.3], ['Galeria que desliza', 8700, 3.4, 0.6, 'linear'],
]
const EASES = { linear: (t) => t, suave: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) }
const INICIO = 3.2 // o hero toca sozinho antes da primeira rolagem
let t = INICIO, de = 0
const trechos = [], etapas = [{ k: 'Abertura em tela cheia', t0: 0 }]
for (const [k, ate, dur, pausa = 0, ease = 'suave'] of PASSOS) {
  trechos.push({ t0: t, t1: t + dur, de, para: ate, ease: EASES[ease] })
  if (etapas.at(-1).k !== k && k !== 'Abertura em tela cheia') etapas.push({ k, t0: t + dur * 0.6 + SITE0 })
  t += dur + pausa; de = ate
}
const duracao = t + SITE0 + FIM
const rolagem = (ts) => { let y = 0; for (const s of trechos) { if (ts < s.t0) break; y = ts >= s.t1 ? s.para : s.de + (s.para - s.de) * s.ease((ts - s.t0) / (s.t1 - s.t0)) } return y }
function ffmpeg(arq) {
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), '-movflags', '+faststart', '-an', arq], { stdio: ['pipe', 'inherit', 'inherit'] })
  const fim = new Promise((ok, er) => { ff.on('error', () => er(new Error('Sem ffmpeg'))); ff.on('close', (c) => (c === 0 ? ok() : er(new Error('ffmpeg ' + c)))) })
  return { w: async (b) => { if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r)) }, fim: () => { ff.stdin.end(); return fim } }
}
await comNavegador(async ({ site, palco }) => {
  await palco.send('Page.enable')
  await palco.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false })
  await palco.send('Page.navigate', { url: pathToFileURL(path.join(AQUI, 'stage-final.html')).href })
  await espera(2500); await palco.avaliar('document.fonts.ready.then(() => true)')
  await palco.avaliar(`configurar(${JSON.stringify(etapas)})`)
  await abrirSite(site, { url: enderecoDoSpace({ ...SP, device: 'desktop' }), largura: 1280, altura: 900, escala: 1.25, mobile: false })
  const total = Math.round(duracao * FPS)
  console.log(`${duracao.toFixed(1)} s, ${total} quadros`)
  const em = fotos ? new Set(fotos.map((s) => Math.round(s * FPS))) : null
  const pasta = path.join(AQUI, 'quadros'); mkdirSync(pasta, { recursive: true })
  const v = em ? null : ffmpeg(saida)
  const ini = Date.now()
  for (let i = 0; i < total; i++) {
    if (em && i > Math.max(...em)) break
    const tt = i / FPS, ts = Math.max(0, tt - SITE0)
    await site.avaliar(`scrollTo({ top: ${rolagem(ts).toFixed(2)}, behavior: 'instant' }); dispatchEvent(new Event('scroll')); window.__vt.advance(${(ts * 1000).toFixed(2)}); window.__vt.realFrame().then(() => true)`)
    if (em && !em.has(i)) continue
    const dado = (await site.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 })).data
    await palco.avaliar(`quadro(${tt.toFixed(4)}, ${JSON.stringify(dado)})`)
    const buf = Buffer.from((await palco.send('Page.captureScreenshot', { format: em ? 'png' : 'jpeg', quality: 95 })).data, 'base64')
    if (v) await v.w(buf); else writeFileSync(path.join(pasta, `final-${tt.toFixed(1)}s.png`), buf)
    if (i % 45 === 0) process.stdout.write(`\r  ${i}/${total} · ${Math.round((Date.now() - ini) / 1000)} s `)
  }
  if (v) { await v.fim(); console.log(`\n✔ ${path.relative(RAIZ, saida)} · ${duracao.toFixed(1)} s, ${(statSync(saida).size / 1048576).toFixed(1)} MB`) }
})
