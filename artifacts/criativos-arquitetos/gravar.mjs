// Vídeo de campanha da Avence para arquitetos: o case rolando dentro do palco com a identidade
// (gancho, janela, legendas por seção e cartão final). Tudo por tempo virtual, quadro a quadro.
//   node gravar.mjs --formato 4x5 [--quadros 1,5,9.5] [--out arquivo.mp4]
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AQUI, RAIZ, abrirSite, comNavegador, enderecoDoSpace, espera } from './lib.mjs'

const argv = process.argv.slice(2)
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined }
const nomeFormato = flag('formato') ?? '4x5'
const plano = JSON.parse(readFileSync(path.join(AQUI, 'plano.json'), 'utf8'))
const F = plano.formatos[nomeFormato]
if (!F) throw new Error(`Formato desconhecido: ${nomeFormato}`)
const fotos = flag('quadros')?.split(',').map(Number)
const saida = path.resolve(flag('out') ?? path.join(AQUI, `${plano.nome}-${nomeFormato}.mp4`))
const FPS = 30
const FINAL = 4.6 // segundos de cartão final depois que a janela sai
const EASES = { linear: (t) => t, suave: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) }

async function roteiro(site) {
  const max = await site.avaliar('Math.max(0, document.documentElement.scrollHeight - innerHeight)')
  let t = F.inicio, de = 0
  const trechos = [], etapas = plano.etapas.map((e, i) => ({ ...e, n: String(i + 1).padStart(2, '0'), t0: Infinity, t1: 0 }))
  for (const p of F.passos) {
    const para = Math.min(max, p.ate)
    trechos.push({ t0: t, t1: t + p.dur, de, para, ease: EASES[p.ease ?? 'suave'] })
    const e = etapas[p.etapa]
    // o tempo do site vira tempo do vídeo na hora de legendar
    e.t0 = Math.min(e.t0, t - 0.2 + plano.tempos.siteInicio); e.t1 = Math.max(e.t1, t + p.dur + (p.pausa ?? 0) + plano.tempos.siteInicio)
    t += p.dur + (p.pausa ?? 0); de = para
  }
  etapas.forEach((e, i) => { if (i === 0) e.t0 = plano.tempos.winIn + 0.5 })
  return { trechos, fimSite: t, etapas, max }
}
const rolagemEm = (t, trechos) => { let y = 0; for (const s of trechos) { if (t < s.t0) break; y = t >= s.t1 ? s.para : s.de + (s.para - s.de) * s.ease((t - s.t0) / (s.t1 - s.t0)) } return y }

function abrirFfmpeg(arquivo) {
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), '-movflags', '+faststart', '-an', arquivo], { stdio: ['pipe', 'inherit', 'inherit'] })
  const fim = new Promise((ok, erro) => { ff.on('error', () => erro(new Error('Sem ffmpeg'))); ff.on('close', (c) => (c === 0 ? ok() : erro(new Error(`ffmpeg ${c}`)))) })
  return { escrever: async (b) => { if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r)) }, fechar: () => { ff.stdin.end(); return fim } }
}

await comNavegador(async ({ site, palco }) => {
  await palco.send('Page.enable')
  await palco.send('Emulation.setDeviceMetricsOverride', { width: F.w, height: F.h, deviceScaleFactor: 1, mobile: false })
  await palco.send('Page.navigate', { url: pathToFileURL(path.join(AQUI, 'stage.html')).href })
  await espera(2500)
  await palco.avaliar('document.fonts.ready.then(() => true)')

  await abrirSite(site, { url: enderecoDoSpace({ ...plano.space, device: F.site.device }), largura: F.site.largura, altura: F.site.altura, escala: F.site.escala, mobile: F.site.mobile })
  const { trechos, fimSite, etapas, max } = await roteiro(site)
  const tFimSite = fimSite + plano.tempos.siteInicio
  const T = { hookOut: plano.tempos.hookOut, winIn: plano.tempos.winIn, winOut: tFimSite + 0.1, endIn: tFimSite + 0.2 }
  const duracao = T.endIn + FINAL
  await palco.avaliar(`configurar(${JSON.stringify({ w: F.w, h: F.h, kind: F.kind, layout: F.layout, etapas, t: T })})`)
  const total = Math.round(duracao * FPS)
  console.log(`${nomeFormato}: ${duracao.toFixed(1)} s, ${total} quadros, rolagem ${max}px`)

  const fotosEm = fotos ? new Set(fotos.map((s) => Math.round(s * FPS))) : new Set()
  const pasta = path.join(AQUI, 'quadros'); mkdirSync(pasta, { recursive: true })
  const video = fotos ? null : abrirFfmpeg(saida)
  const inicio = Date.now()
  for (let i = 0; i < total; i++) {
    const t = i / FPS
    if (fotos && i > Math.max(...fotosEm)) break
    let dado = null
    const ts = t - plano.tempos.siteInicio
    if (ts >= 0 && t <= T.winOut + 1) {
      await site.avaliar(`scrollTo({ top: ${rolagemEm(ts, trechos).toFixed(2)}, behavior: 'instant' }); dispatchEvent(new Event('scroll')); window.__vt.advance(${(ts * 1000).toFixed(2)}); window.__vt.realFrame().then(() => true)`)
      if (!fotos || fotosEm.has(i)) dado = (await site.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 })).data
    }
    if (fotos && !fotosEm.has(i)) continue
    await palco.avaliar(`quadro(${t.toFixed(4)}, ${dado ? JSON.stringify(dado) : 'null'})`)
    const shot = await palco.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 })
    const buf = Buffer.from(shot.data, 'base64')
    if (video) await video.escrever(buf)
    else writeFileSync(path.join(pasta, `${plano.nome}-${nomeFormato}-${t.toFixed(1)}s.jpg`), buf)
    if (i % 45 === 0) process.stdout.write(`\r  quadro ${i}/${total} · ${Math.round((Date.now() - inicio) / 1000)} s   `)
  }
  process.stdout.write('\r')
  if (video) { await video.fechar(); console.log(`✔ ${path.relative(RAIZ, saida)} · ${F.w}×${F.h}, ${duracao.toFixed(1)} s, ${(statSync(saida).size / 1048576).toFixed(1)} MB`) }
})
