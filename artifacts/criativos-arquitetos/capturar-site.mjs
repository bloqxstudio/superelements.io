// Captura uma vez os quadros do case (desktop) na linha do tempo do criativo e guarda em frames/.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AQUI, abrirSite, comNavegador, enderecoDoSpace } from './lib.mjs'
const SP = { projeto: '817e7afc-f37b-46b0-95da-860469e8e8aa', pagina: '30c4d7f3-08cb-4484-b7db-810531151953' }
const FPS = 30, SITE0 = 0.7, FIM = 1.8, INICIO = 3.2
const PASSOS = [[900, 1.3, 0.3], [1981, 1.0, 0.3], [2881, 0.8, 0.2], [3781, 0.8, 0.2], [4681, 0.8, 0.2], [5581, 1.0, 0.9], [6817, 1.1, 0.3], [8700, 3.4, 0.6, 'linear']]
const EASES = { linear: (t) => t, suave: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) }
let t = INICIO, de = 0
const trechos = []
for (const [ate, dur, pausa = 0, ease = 'suave'] of PASSOS) { trechos.push({ t0: t, t1: t + dur, de, para: ate, ease: EASES[ease] }); t += dur + pausa; de = ate }
const duracao = t + SITE0 + FIM, total = Math.round(duracao * FPS)
const rolagem = (ts) => { let y = 0; for (const s of trechos) { if (ts < s.t0) break; y = ts >= s.t1 ? s.para : s.de + (s.para - s.de) * s.ease((ts - s.t0) / (s.t1 - s.t0)) } return y }
const pasta = path.join(AQUI, 'frames'); rmSync(pasta, { recursive: true, force: true }); mkdirSync(pasta)
await comNavegador(async ({ site }) => {
  await abrirSite(site, { url: enderecoDoSpace({ ...SP, device: 'desktop' }), largura: 1280, altura: 900, escala: 1.25, mobile: false })
  for (let i = 0; i < total; i++) {
    const ts = Math.max(0, i / FPS - SITE0)
    await site.avaliar(`scrollTo({ top: ${rolagem(ts).toFixed(2)}, behavior: 'instant' }); dispatchEvent(new Event('scroll')); window.__vt.advance(${(ts * 1000).toFixed(2)}); window.__vt.realFrame().then(() => true)`)
    writeFileSync(path.join(pasta, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from((await site.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 })).data, 'base64'))
    if (i % 60 === 0) process.stdout.write(`\r${i}/${total} `)
  }
  writeFileSync(path.join(pasta, 'info.json'), JSON.stringify({ total, fps: FPS }))
})
console.log('\nok')
