// Monta estáticos e vídeos das variações de copy (escuro e claro) com os quadros guardados em frames/.
//   node compor.mjs [--so-estaticos] [--copy v2] [--tema claro]
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AQUI, comNavegador, espera } from './lib.mjs'
const argv = process.argv.slice(2)
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined }
const STORY = argv.includes('--story')
const H = STORY ? 1920 : 1350
const PREF = STORY ? 'stories' : 'arquitetos'
const soEstaticos = argv.includes('--so-estaticos')
const copys = JSON.parse(readFileSync(path.join(AQUI, 'copys.json'), 'utf8')).filter((c) => !flag('copy') || c.id === flag('copy'))
const temas = ['escuro', 'claro'].filter((t) => !flag('tema') || t === flag('tema'))
const { total, fps } = JSON.parse(readFileSync(path.join(AQUI, 'frames/info.json'), 'utf8'))
const quadro = (i) => readFileSync(path.join(AQUI, 'frames', `f${String(i).padStart(4, '0')}.jpg`)).toString('base64')
const FOTO = Math.round(3.85 * fps)
mkdirSync(path.join(AQUI, 'estaticos'), { recursive: true }); mkdirSync(path.join(AQUI, 'videos'), { recursive: true })
function ffmpeg(arq) {
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(fps), '-movflags', '+faststart', '-an', arq], { stdio: ['pipe', 'inherit', 'inherit'] })
  const fim = new Promise((ok, er) => { ff.on('error', () => er(new Error('Sem ffmpeg'))); ff.on('close', (c) => (c === 0 ? ok() : er(new Error('ffmpeg ' + c)))) })
  return { w: async (b) => { if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r)) }, fim: () => { ff.stdin.end(); return fim } }
}
await comNavegador(async ({ palco }) => {
  await palco.send('Page.enable')
  await palco.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: H, deviceScaleFactor: 1, mobile: false })
  await palco.send('Page.navigate', { url: pathToFileURL(path.join(AQUI, STORY ? 'stage-story.html' : 'stage-final.html')).href })
  await espera(2500); await palco.avaliar('document.fonts.ready.then(() => true)')
  for (const c of copys) for (const tema of temas) {
    await palco.avaliar(`configurar(${JSON.stringify({ copy: c, tema })})`)
    const nome = `${PREF}-${c.id}-${tema}`
    await palco.avaliar(`quadro(${(FOTO / fps).toFixed(4)}, ${JSON.stringify(quadro(FOTO))})`)
    writeFileSync(path.join(AQUI, 'estaticos', nome + '.png'), Buffer.from((await palco.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    console.log('estático', nome)
    if (soEstaticos) continue
    const out = path.join(AQUI, 'videos', nome + '.mp4'), v = ffmpeg(out)
    for (let i = 0; i < total; i++) {
      await palco.avaliar(`quadro(${(i / fps).toFixed(4)}, ${JSON.stringify(quadro(i))})`)
      await v.w(Buffer.from((await palco.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 })).data, 'base64'))
    }
    await v.fim(); console.log('vídeo', nome, (statSync(out).size / 1048576).toFixed(1) + ' MB')
  }
})
