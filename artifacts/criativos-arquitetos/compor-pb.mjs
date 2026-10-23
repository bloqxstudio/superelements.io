// Vídeo do case ProcessBase: o scroll da primeira dobra à segunda, a partir das gravações do site.
//   node compor-pb.mjs [--so-estaticos]
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AQUI, comNavegador, espera } from './lib.mjs'
const soEst = process.argv.includes('--so-estaticos')
const FPS = 30, HOLD0 = 2.8, SCROLL = 3.4, HOLD1 = 2.6
const D = HOLD0 + SCROLL + HOLD1
const ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
const ler = (dir, i) => readFileSync(path.join(AQUI, dir, `f${String(Math.max(1, i)).padStart(4, '0')}.jpg`)).toString('base64')
const src = (t, fim) => Math.round(1 + (fim * 30 - 1) * ease(Math.min(1, Math.max(0, (t - HOLD0) / SCROLL))))
mkdirSync(path.join(AQUI, 'estaticos'), { recursive: true }); mkdirSync(path.join(AQUI, 'videos'), { recursive: true })
function ffmpeg(arq) {
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), '-movflags', '+faststart', '-an', arq], { stdio: ['pipe', 'inherit', 'inherit'] })
  const fim = new Promise((ok, er) => { ff.on('error', () => er(new Error('Sem ffmpeg'))); ff.on('close', (c) => (c === 0 ? ok() : er(new Error('ffmpeg ' + c)))) })
  return { w: async (b) => { if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r)) }, fim: () => { ff.stdin.end(); return fim } }
}
await comNavegador(async ({ palco }) => {
  await palco.send('Page.enable')
  for (const formato of ['feed', 'story']) {
    await palco.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: formato === 'story' ? 1920 : 1350, deviceScaleFactor: 1, mobile: false })
    await palco.send('Page.navigate', { url: pathToFileURL(path.join(AQUI, 'stage-pb.html')).href })
    await espera(2500); await palco.avaliar('document.fonts.ready.then(() => true)')
    await palco.avaliar(`configurar(${JSON.stringify({ formato })})`)
    const story = formato === 'story', dir = story ? 'frames-pb-mob' : 'frames-pb-desk', fim = story ? 3.0 : 3.5
    const frame = (t) => { const b = JSON.stringify(ler(dir, src(t, fim))); return story ? ['null', b] : [b, 'null'] }
    const nome = `case-processbase-${formato}`
    let [a, b] = frame(D - 0.3)
    await palco.avaliar(`quadro(${(D - 0.3).toFixed(3)}, ${a}, ${b})`)
    writeFileSync(path.join(AQUI, 'estaticos', nome + '.png'), Buffer.from((await palco.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    console.log('estático', nome)
    if (soEst) continue
    const out = path.join(AQUI, 'videos', nome + '.mp4'), v = ffmpeg(out), total = Math.round(D * FPS)
    for (let i = 0; i < total; i++) {
      const t = i / FPS; [a, b] = frame(t)
      await palco.avaliar(`quadro(${t.toFixed(4)}, ${a}, ${b})`)
      await v.w(Buffer.from((await palco.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 })).data, 'base64'))
    }
    await v.fim(); console.log('vídeo', nome, (statSync(out).size / 1048576).toFixed(1) + ' MB')
  }
})
