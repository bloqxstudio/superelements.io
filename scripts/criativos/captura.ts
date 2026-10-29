import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Captura de uma página: o app manda o HTML dela (montado com a marca do
 * projeto) e o navegador desta máquina (Chrome, Edge, Brave ou Chromium), em
 * modo escondido, abre e fotografa a página inteira. Nada vai para a nuvem: o
 * arquivo temporário fica na pasta temporária do sistema e é apagado no fim.
 */

const isWindows = process.platform === 'win32'
const MAX_HEIGHT = 40000

/** O navegador instalado: variável de ambiente, locais conhecidos e o PATH. */
export function findBrowser(): string | undefined {
  const env = process.env.SE_BROWSER_BIN?.trim()
  if (env) return existsSync(env) ? env : undefined
  const win = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean) as string[]
  const known = isWindows
    ? win.flatMap((base) => [path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(base, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')])
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : []
  const found = known.find((f) => existsSync(f))
  if (found) return found
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean))
    for (const name of isWindows ? ['msedge.exe', 'chrome.exe'] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']) {
      const full = path.join(dir, name)
      if (existsSync(full)) return full
    }
  return undefined
}

async function openCdp(url: string) {
  const ws = new WebSocket(url)
  await new Promise<void>((resolve, reject) => { ws.onopen = () => resolve(); ws.onerror = () => reject(new Error('Falha ao conectar à captura.')) })
  let id = 0
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  ws.onmessage = event => {
    const result = JSON.parse(String(event.data))
    const call = pending.get(result.id)
    if (!call) return
    pending.delete(result.id)
    result.error ? call.reject(new Error(result.error.message)) : call.resolve(result.result)
  }
  return {
    send: (method: string, params: Record<string, unknown> = {}): Promise<any> => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); ws.send(JSON.stringify({ id: next, method, params })) }),
    close: () => ws.close(),
  }
}

export async function capturePage(html: string, width: number, signal?: AbortSignal): Promise<{ data: string; width: number; height: number }> {
  const bin = findBrowser()
  if (!bin) throw new Error('Não achei o Chrome, o Edge, o Brave nem o Chromium neste computador para fotografar a página. Instale um deles, ou diga onde está em SE_BROWSER_BIN.')
  const w = Math.min(2400, Math.max(320, Math.round(width)))
  const dir = mkdtempSync(path.join(os.tmpdir(), 'se-captura-'))
  try {
    const file = path.join(dir, 'pagina.html')
    writeFileSync(file, html)
    const url = pathToFileURL(file).href
    // Viewport fixo: aumentar a janela para a altura da página estica os blocos em vh.
    const child = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(dir, 'perfil')}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' })
    const stop = () => child.kill()
    signal?.addEventListener('abort', stop, { once: true })
    let tab: Awaited<ReturnType<typeof openCdp>> | undefined
    try {
      const portFile = path.join(dir, 'perfil', 'DevToolsActivePort')
      for (let i = 0; i < 100 && !existsSync(portFile); i++) { signal?.throwIfAborted(); await new Promise(r => setTimeout(r, 100)) }
      if (!existsSync(portFile)) throw new Error('O navegador da captura não iniciou.')
      const port = readFileSync(portFile, 'utf8').split('\n')[0]
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()) as { type: string; webSocketDebuggerUrl: string }[]
      const page = pages.find(p => p.type === 'page')
      if (!page) throw new Error('A captura não abriu a página.')
      tab = await openCdp(page.webSocketDebuggerUrl)
      await tab.send('Page.enable')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false })
      await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      await tab.send('Page.navigate', { url })
      const evaluate = async (expression: string) => {
        const result = await tab!.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (result.exceptionDetails) throw new Error('Falha ao preparar a captura da página.')
        return result.result.value
      }
      for (let i = 0; i < 150; i++) { signal?.throwIfAborted(); if (await evaluate('document.readyState === "complete"')) break; await new Promise(r => setTimeout(r, 100)) }
      await evaluate(`Promise.race([(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(async i=>{i.loading='eager';try{await i.decode()}catch{}}));return true})(),new Promise(r=>setTimeout(()=>r(true),20000))])`)
      const height = Math.min(MAX_HEIGHT, Math.max(600, await evaluate('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)')))
      const shot = await tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height, scale: 1 } })
      return { data: `data:image/png;base64,${shot.data}`, width: w, height }
    } finally {
      tab?.close()
      signal?.removeEventListener('abort', stop)
      child.kill()
    }
  } finally {
    setTimeout(() => {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 })
      } catch {
        // fica para a limpeza do sistema
      }
    }, 1500).unref()
  }
}
