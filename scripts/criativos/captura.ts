import { execFile } from 'node:child_process'
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
const MAX_HEIGHT = 14000

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

const run = (bin: string, args: string[], signal?: AbortSignal) =>
  new Promise<string>((resolve, reject) => {
    const child = execFile(bin, args, { timeout: 90_000, maxBuffer: 80 * 1024 * 1024, windowsHide: true, signal }, (error, stdout) => (error && !stdout ? reject(error) : resolve(String(stdout))))
    child.stdin?.end()
  })

/** Mede a altura da página dentro do documento (depois de carregar as fontes e as imagens). */
const MEASURE = `<script>(function(){function m(){var b=0;[].slice.call(document.body.children).forEach(function(el){if(el.tagName==='SCRIPT'||el.tagName==='STYLE')return;var r=el.getBoundingClientRect();if(r.height>0)b=Math.max(b,r.bottom+window.scrollY)});if(!b)b=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);document.documentElement.setAttribute('data-se-h',String(Math.ceil(b)))}addEventListener('load',function(){setTimeout(m,500);setTimeout(m,2000);setTimeout(m,5000)})})()</script>`

export async function capturePage(html: string, width: number, signal?: AbortSignal): Promise<{ data: string; width: number; height: number }> {
  const bin = findBrowser()
  if (!bin) throw new Error('Não achei o Chrome, o Edge, o Brave nem o Chromium neste computador para fotografar a página. Instale um deles, ou diga onde está em SE_BROWSER_BIN.')
  const w = Math.min(2400, Math.max(320, Math.round(width)))
  const dir = mkdtempSync(path.join(os.tmpdir(), 'se-captura-'))
  try {
    const file = path.join(dir, 'pagina.html')
    writeFileSync(file, html.includes('</body>') ? html.replace('</body>', `${MEASURE}</body>`) : `${html}${MEASURE}`)
    const url = pathToFileURL(file).href
    // Perfil próprio e limpo: não briga com o navegador que a pessoa já tem aberto
    const base = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--force-device-scale-factor=1', `--user-data-dir=${path.join(dir, 'perfil')}`, '--virtual-time-budget=12000', '--run-all-compositor-stages-before-draw']
    const dom = await run(bin, [...base, `--window-size=${w},900`, '--dump-dom', url], signal)
    const measured = Number(/data-se-h="(\d+)"/.exec(dom)?.[1] ?? 0)
    const height = Math.min(MAX_HEIGHT, Math.max(600, measured || 1800))
    const out = path.join(dir, 'pagina.png')
    await run(bin, [...base, `--window-size=${w},${height}`, `--screenshot=${out}`, url], signal)
    if (!existsSync(out)) throw new Error('O navegador não gerou a imagem da página.')
    return { data: `data:image/png;base64,${readFileSync(out).toString('base64')}`, width: w, height }
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
