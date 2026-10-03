// Vídeo de case no formato dos posts da Awwwards: o site real numa tela no centro,
// sobre um fundo desfocado dele mesmo, rolando com easing de uma parada à outra.
//
// Tudo é JS. O site roda num relógio virtual (scripts/space/vt.js), então cada quadro
// sai no tempo exato, por mais que a captura demore; a rolagem segue o plano; e o palco
// (palco.html) compõe o quadro num canvas. O ffmpeg só junta os quadros prontos no .mp4.
//
//   node gravar.mjs planos/processbase.json                      grava o vídeo do plano
//   node gravar.mjs planos/processbase.json --quadros 3,9.5,20   só as fotos desses segundos
//   node gravar.mjs planos/processbase.json --formato 1x1 --out ../processbase-tela-1x1.mp4

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../..')
const NAVEGADORES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
/** Quadro final, largura da tela dentro dele e o tamanho do site na tela. */
const FORMATOS = {
  '4x5': { w: 1080, h: 1350, tela: 920 },
  '1x1': { w: 1080, h: 1080, tela: 880 },
  '9x16': { w: 1080, h: 1920, tela: 980 },
}
const FPS = 30
const CONFERIR_EM = [0, 0.15, 0.3, 0.5, 0.75, 0.98]
const EASES = {
  linear: (t) => t,
  suave: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  forte: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
}

// ---------- argumentos ----------

const argv = process.argv.slice(2)
const flag = (nome) => { const i = argv.indexOf(`--${nome}`); return i >= 0 ? argv[i + 1] : undefined }
const arquivoPlano = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
if (!arquivoPlano) {
  console.error('Uso: node gravar.mjs <plano.json> [--formato 4x5|1x1|9x16] [--out arquivo.mp4] [--quadros 2,8.5]')
  process.exit(1)
}
const plano = JSON.parse(readFileSync(path.resolve(arquivoPlano), 'utf8'))
const nomeFormato = flag('formato') ?? plano.formato ?? '4x5'
const formato = FORMATOS[nomeFormato]
if (!formato) throw new Error(`Formato desconhecido: ${nomeFormato} (${Object.keys(FORMATOS).join(', ')})`)
const viewport = { width: plano.tela?.largura ?? 1440, height: plano.tela?.altura ?? 900 }
// O site é capturado no dobro do tamanho em que aparece na tela, para o texto sair nítido
const escalaSite = Math.min(2, (2 * formato.tela) / viewport.width)
const fotos = flag('quadros')?.split(',').map(Number)
const saida = path.resolve(flag('out') ?? path.join(AQUI, '..', `${plano.nome}-tela-${nomeFormato}.mp4`))

// ---------- navegador (CDP) ----------

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = () => erro(new Error('CDP não abriu')) })
  let proximo = 0
  const aguardando = new Map()
  const ouvintes = new Map()
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (m.id && aguardando.has(m.id)) {
      const { ok, erro } = aguardando.get(m.id)
      aguardando.delete(m.id)
      m.error ? erro(new Error(m.error.message)) : ok(m.result)
    } else if (m.method) ouvintes.get(m.method)?.(m.params)
  }
  const send = (method, params = {}) => new Promise((ok, erro) => {
    const id = ++proximo
    aguardando.set(id, { ok, erro })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const avaliar = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  return { send, avaliar, ao: (method, fn) => ouvintes.set(method, fn), fechar: () => ws.close() }
}

async function comNavegador(trabalho) {
  const exe = NAVEGADORES.find((b) => existsSync(b))
  if (!exe) throw new Error('Não achei o Edge nem o Chrome')
  const porta = 9400 + Math.floor(Math.random() * 400)
  const perfil = mkdtempSync(path.join(os.tmpdir(), 'tela-awwwards-'))
  const filho = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    'about:blank',
  ], { stdio: 'ignore' })
  try {
    let alvos
    for (let i = 0; i < 50 && !alvos; i++) {
      await espera(200)
      alvos = await fetch(`http://127.0.0.1:${porta}/json/list`).then((r) => r.json()).catch(() => null)
    }
    if (!alvos) throw new Error('O navegador headless não abriu')
    const site = await cdp(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl)
    // O palco fica numa janela própria, para não ser tratado como aba em segundo plano
    const versao = await fetch(`http://127.0.0.1:${porta}/json/version`).then((r) => r.json())
    const navegador = await cdp(versao.webSocketDebuggerUrl)
    await navegador.send('Target.createTarget', { url: 'about:blank', newWindow: true })
    const lista = await fetch(`http://127.0.0.1:${porta}/json/list`).then((r) => r.json())
    const palco = await cdp(lista.find((t) => t.type === 'page' && t.webSocketDebuggerUrl !== alvos[0].webSocketDebuggerUrl && t.url === 'about:blank').webSocketDebuggerUrl)
    try {
      return await trabalho({ site, palco })
    } finally {
      site.fechar()
      palco.fechar()
      navegador.fechar()
    }
  } finally {
    filho.kill()
    await espera(400)
    rmSync(perfil, { recursive: true, force: true, maxRetries: 3 })
  }
}

// ---------- página ----------

/** Carrega as imagens e os fundos que o Elementor deixaria para depois. */
const SEM_LAZY = `document.addEventListener('DOMContentLoaded', () => {
  for (const img of document.images) { img.loading = 'eager'; img.decoding = 'sync' }
  document.querySelectorAll('.e-con, .elementor-section').forEach((el) => el.classList.add('e-lazyloaded'))
})`
const ESPERAR_ARQUIVOS = `Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.complete ? 0 : new Promise((ok) => { img.addEventListener('load', ok); img.addEventListener('error', ok) }))]).then(() => true)`

const TIPOS = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.css': 'text/css', '.js': 'text/javascript' }

/**
 * "trocar" no plano: endereços que o site publicado pede e que só existem no repo
 * (ex.: um localhost que escapou na publicação). Saem dos arquivos locais.
 */
async function trocarEnderecos(site) {
  const trocas = Object.entries(plano.trocar ?? {})
  if (!trocas.length) return
  site.ao('Fetch.requestPaused', async ({ requestId, request }) => {
    const [prefixo, pasta] = trocas.find(([p]) => request.url.replace(/^https:/, 'http:').startsWith(p)) ?? []
    const arquivo = prefixo && path.join(RAIZ, pasta, decodeURIComponent(new URL(request.url).pathname))
    if (!arquivo || !existsSync(arquivo)) {
      console.warn(`\n  ! sem arquivo local para ${request.url}`)
      return site.send('Fetch.failRequest', { requestId, errorReason: 'FileNotFound' })
    }
    const tipo = TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream'
    await site.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: tipo }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: readFileSync(arquivo).toString('base64') })
  })
  const padroes = trocas.flatMap(([p]) => [{ urlPattern: `${p}*` }, { urlPattern: `${p.replace(/^http:/, 'https:')}*` }])
  await site.send('Fetch.enable', { patterns: padroes })
  console.log(`  trocando ${trocas.map(([p, d]) => `${p} → ${d}`).join(', ')}`)
}

async function abrirSite(site) {
  await site.send('Page.enable')
  await trocarEnderecos(site)
  await site.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: escalaSite, mobile: false })
  await site.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await site.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(path.join(RAIZ, 'scripts/space/vt.js'), 'utf8') })
  await site.send('Page.addScriptToEvaluateOnNewDocument', { source: SEM_LAZY })
  await site.send('Page.navigate', { url: plano.url })
  for (let i = 0; i < 150; i++) {
    if (await site.avaliar('document.readyState === "complete"').catch(() => false)) break
    await espera(200)
  }
  await Promise.race([site.avaliar(ESPERAR_ARQUIVOS), espera(20_000)])
  await espera(1500)
}

/** Paradas do plano em px: número, "fim" ou um seletor (o topo do elemento). */
async function montarRoteiro(site) {
  const max = await site.avaliar('Math.max(0, document.documentElement.scrollHeight - innerHeight)')
  const resolver = async (ate) => {
    if (ate === 'fim') return max
    if (typeof ate === 'number') return Math.min(max, ate)
    const y = await site.avaliar(`(() => { const el = document.querySelector(${JSON.stringify(ate)}); return el ? el.getBoundingClientRect().top + scrollY : null })()`)
    if (y == null) throw new Error(`Seletor do plano não existe na página: ${ate}`)
    return Math.min(max, Math.round(y))
  }
  const trechos = []
  let t = plano.inicio ?? 2.5
  let de = 0
  for (const passo of plano.passos) {
    const para = await resolver(passo.ate)
    trechos.push({ t0: t, t1: t + passo.dur, de, para, ease: EASES[passo.ease ?? 'suave'] })
    t += passo.dur + (passo.pausa ?? 0)
    de = para
  }
  return { trechos, duracao: t, max }
}

function rolagemEm(t, trechos) {
  let y = 0
  for (const s of trechos) {
    if (t < s.t0) break
    y = t >= s.t1 ? s.para : s.de + (s.para - s.de) * s.ease((t - s.t0) / (s.t1 - s.t0))
  }
  return y
}

// ---------- gravação ----------

function abrirFfmpeg(arquivo) {
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-r', String(FPS), '-movflags', '+faststart', '-an', arquivo,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const fim = new Promise((ok, erro) => {
    ff.on('error', () => erro(new Error('Não achei o ffmpeg')))
    ff.on('close', (code) => (code === 0 ? ok() : erro(new Error(`O ffmpeg parou com o código ${code}`))))
  })
  return { escrever: async (buf) => { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)) }, fechar: () => { ff.stdin.end(); return fim } }
}

await comNavegador(async ({ site, palco }) => {
  await palco.send('Page.enable')
  await palco.send('Emulation.setDeviceMetricsOverride', { width: formato.w, height: formato.h, deviceScaleFactor: 1, mobile: false })
  await palco.send('Page.navigate', { url: pathToFileURL(path.join(AQUI, 'palco.html')).href })
  await espera(800)
  await palco.avaliar(`configurar(${JSON.stringify({ ...formato, escurecer: plano.fundo?.escurecer ?? 0.45, desfoque: plano.fundo?.desfoque ?? 26, sombra: 0.55 })})`)

  console.log(`Abrindo ${plano.url} (${viewport.width}×${viewport.height}, ${escalaSite.toFixed(2)}×)…`)
  await abrirSite(site)
  const { trechos, duracao, max } = await montarRoteiro(site)
  const total = Math.round(duracao * FPS)
  console.log(`Roteiro: ${trechos.length} trechos, ${max}px de rolagem, ${duracao.toFixed(1)} s (${total} quadros)`)

  const pastaFotos = path.join(AQUI, 'quadros')
  const fotosEm = new Set((fotos ?? CONFERIR_EM.map((f) => f * duracao)).map((s) => Math.min(total - 1, Math.round(s * FPS))))
  const ultimaFoto = Math.max(...fotosEm)
  mkdirSync(pastaFotos, { recursive: true })
  const video = fotos ? null : abrirFfmpeg(saida)

  const inicio = Date.now()
  let composicao = Promise.resolve()
  for (let i = 0; i < total; i++) {
    if (fotos && i > ultimaFoto) break
    const t = i / FPS
    const y = rolagemEm(t, trechos)
    // Rola, avisa a página, anda o relógio um quadro e espera o navegador desenhar
    await site.avaliar(`scrollTo({ top: ${y.toFixed(2)}, behavior: 'instant' }); dispatchEvent(new Event('scroll')); window.__vt.advance(${(t * 1000).toFixed(2)}); window.__vt.realFrame().then(() => true)`)
    if (fotos && !fotosEm.has(i)) continue
    const { data } = await site.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
    // O palco compõe este quadro enquanto o site já avança para o próximo
    await composicao
    composicao = (async () => {
      await palco.avaliar(`desenhar(${JSON.stringify(data)})`)
      const shot = await palco.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 })
      const buf = Buffer.from(shot.data, 'base64')
      if (video) await video.escrever(buf)
      if (fotosEm.has(i)) writeFileSync(path.join(pastaFotos, `${plano.nome}-${nomeFormato}-${t.toFixed(1)}s.jpg`), buf)
    })()
    if (i % 60 === 0) process.stdout.write(`\r  quadro ${i}/${total} · ${Math.round((Date.now() - inicio) / 1000)} s   `)
  }
  await composicao
  process.stdout.write('\r')
  if (video) {
    await video.fechar()
    const mb = (statSync(saida).size / 1024 / 1024).toFixed(1)
    console.log(`✔ ${path.relative(RAIZ, saida)} · ${formato.w}×${formato.h}, ${duracao.toFixed(1)} s, ${mb} MB, em ${Math.round((Date.now() - inicio) / 1000)} s`)
  }
  console.log(`  quadros de conferência em ${path.relative(RAIZ, pastaFotos)}`)
})
