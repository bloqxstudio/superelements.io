// Navegador (CDP) e página do Space com relógio virtual, para os criativos da Avence.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const RAIZ = path.resolve(AQUI, '../..')
const NAVEGADORES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
export const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = () => erro(new Error('CDP não abriu')) })
  let proximo = 0
  const aguardando = new Map()
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (m.id && aguardando.has(m.id)) {
      const { ok, erro } = aguardando.get(m.id)
      aguardando.delete(m.id)
      m.error ? erro(new Error(m.error.message)) : ok(m.result)
    }
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
  return { send, avaliar, fechar: () => ws.close() }
}

/** Abre o navegador headless com duas janelas: a do site e o palco. */
export async function comNavegador(trabalho) {
  const exe = NAVEGADORES.find((b) => existsSync(b))
  if (!exe) throw new Error('Não achei o Chrome nem o Edge')
  const porta = 9400 + Math.floor(Math.random() * 400)
  const perfil = mkdtempSync(path.join(os.tmpdir(), 'criativo-avence-'))
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
    const versao = await fetch(`http://127.0.0.1:${porta}/json/version`).then((r) => r.json())
    const navegador = await cdp(versao.webSocketDebuggerUrl)
    await navegador.send('Target.createTarget', { url: 'about:blank', newWindow: true })
    const lista = await fetch(`http://127.0.0.1:${porta}/json/list`).then((r) => r.json())
    const palco = await cdp(lista.find((t) => t.type === 'page' && t.webSocketDebuggerUrl !== alvos[0].webSocketDebuggerUrl && t.url === 'about:blank').webSocketDebuggerUrl)
    try { return await trabalho({ site, palco }) } finally { site.fechar(); palco.fechar(); navegador.fechar() }
  } finally {
    filho.kill()
    await espera(400)
    rmSync(perfil, { recursive: true, force: true, maxRetries: 3 })
  }
}

const SEM_LAZY = `document.addEventListener('DOMContentLoaded', () => {
  for (const img of document.images) { img.loading = 'eager'; img.decoding = 'sync' }
  document.querySelectorAll('.e-con, .elementor-section').forEach((el) => el.classList.add('e-lazyloaded'))
})`
const ESPERAR = `Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.complete ? 0 : new Promise((ok) => { img.addEventListener('load', ok); img.addEventListener('error', ok) }))]).then(() => true)`

export function enderecoDoSpace({ projeto, pagina, device = 'desktop' }) {
  const ponte = JSON.parse(readFileSync(path.join(RAIZ, '.space/bridge.json'), 'utf8'))
  const q = new URLSearchParams({ token: ponte.token, device, motion: 'play', page: pagina, project: projeto })
  return `${ponte.url}/__space/render?${q}`
}

export async function abrirSite(site, { url, largura, altura, escala, mobile }) {
  await site.send('Page.enable')
  await site.send('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: escala, mobile: !!mobile })
  if (mobile) await site.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  await site.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await site.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(path.join(RAIZ, 'scripts/space/vt.js'), 'utf8') })
  await site.send('Page.addScriptToEvaluateOnNewDocument', { source: SEM_LAZY })
  await site.send('Page.navigate', { url })
  for (let i = 0; i < 150; i++) {
    if (await site.avaliar('document.readyState === "complete"').catch(() => false)) break
    await espera(200)
  }
  await Promise.race([site.avaliar(ESPERAR), espera(25_000)])
  await espera(1500)
}
