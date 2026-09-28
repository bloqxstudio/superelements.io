// Grava o palco quadro a quadro no relógio virtual e manda os JPEG para o ffmpeg.
// node record.mjs stills 1,3,6      -> PNGs de conferência em ./stills
// node record.mjs video out.mp4     -> vídeo final
import { chromium } from 'file:///C:/Users/Saipos/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const [mode = 'stills', arg = '1,5,9'] = process.argv.slice(2)
const FPS = 30, DSF = Number(process.env.DSF || 2)
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: DSF, reducedMotion: 'no-preference' })
await ctx.addInitScript({ path: 'vt.js' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[vt]')) console.log('console:', m.text().slice(0, 300)) })
await page.goto('http://127.0.0.1:5199/reel/stage.html', { waitUntil: 'load' })
const frame = () => page.evaluate(() => window.__vt.realFrame())
let T = 0, ready = 0
for (let i = 0; i < 2400; i++) {
  T += 1000 / FPS
  await page.evaluate((t) => window.__warm ? window.__warm(t) : window.__vt.advance(t), T)
  await frame()
  if (await page.evaluate(() => !!(window.__stageReady && window.__stageReady()))) { if (++ready > 90) break }
  if (i % 300 === 299) console.log('aguardando', i, await page.evaluate(() => ({ gsap: !!window.gsap, fonts: document.fonts.status })))
}
if (ready <= 90) { console.log('palco não ficou pronto'); await browser.close(); process.exit(1) }
const measures = await page.evaluate((base) => window.__setup(base), T + 1000 / FPS)
console.log('medidas', JSON.stringify(measures))
const duration = await page.evaluate(() => window.__duration)
const total = Math.round(duration * FPS)
const cdp = await ctx.newCDPSession(page)
const shot = async (format) => Buffer.from((await cdp.send('Page.captureScreenshot', format === 'png' ? { format: 'png' } : { format: 'jpeg', quality: 93 })).data, 'base64')

if (mode === 'stills') {
  fs.mkdirSync('stills', { recursive: true })
  const wanted = new Set(arg.split(',').map((s) => Math.round(Number(s) * FPS)))
  const last = Math.max(...wanted)
  for (let i = 0; i <= last; i++) {
    await page.evaluate((t) => window.__frame(t), i / FPS)
    await frame()
    if (wanted.has(i)) { fs.writeFileSync(`stills/t${(i / FPS).toFixed(2)}.jpg`, await shot('jpeg')); console.log('still', (i / FPS).toFixed(2)) }
  }
} else {
  const out = arg
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'warning', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=1080:1350:flags=lanczos:in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.1',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] })
  const t0 = Date.now()
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__frame(t), i / FPS)
    await frame()
    const buf = await shot('jpeg')
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % 60 === 0) console.log(`quadro ${i}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log('pronto', out)
}
await browser.close()
