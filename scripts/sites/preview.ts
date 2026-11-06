import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import type { CodeSite, SitePreview } from '../../src/features/sites/protocol.ts'
import { OVERLAY_JS } from './overlay.ts'
import { HOME } from './registry.ts'

/**
 * A prévia de cada site: o `astro dev` do próprio site, rodando nesta máquina
 * (`127.0.0.1`, porta livre a partir da 4321). Sobe pela API do Astro do site com
 * duas coisas a mais, só na prévia: as marcas de arquivo e posição em cada
 * elemento (o Astro só põe com a barra de ferramentas ligada; ela fica escondida)
 * e o script de edição (`overlay.ts`). O `astro.config` do site não muda.
 */

const RUNNER = String.raw`import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
const [root, port, overlayFile] = process.argv.slice(2)
const require = createRequire(path.join(root, 'package.json'))
const entry = require.resolve('astro')
const astro = await import(pathToFileURL(entry).href)
const overlay = readFileSync(overlayFile, 'utf8')
const server = await astro.dev({
  root,
  server: { port: Number(port), host: '127.0.0.1', open: false },
  devToolbar: { enabled: true },
  integrations: [{ name: 'superelements-editor', hooks: { 'astro:config:setup': ({ injectScript }) => injectScript('head-inline', overlay) } }],
})
console.log('SE_READY ' + JSON.stringify(server.address))
const close = async () => {
  // O stop do Astro às vezes não volta: sai de qualquer jeito
  setTimeout(() => process.exit(0), 1500).unref()
  try { await server.stop() } finally { process.exit(0) }
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
process.on('disconnect', close)
`

interface Running {
  child?: ChildProcess
  preview: SitePreview
}

const running = new Map<string, Running>()

/** Pede para fechar; se em 3 s não fechou, mata. */
function kill(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }, 3000).unref()
}

const freePort = (port: number): Promise<number> =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(port < 4400 ? freePort(port + 1) : Promise.resolve(0)))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(port)))
  })

const used = () => new Set([...running.values()].map((r) => Number(r.preview.url?.split(':').pop())).filter(Boolean))

function installCommand(dir: string): [string, string[]] {
  if (existsSync(path.join(dir, 'pnpm-lock.yaml'))) return ['pnpm', ['install', '--frozen-lockfile']]
  if (existsSync(path.join(dir, 'yarn.lock'))) return ['yarn', ['install', '--frozen-lockfile']]
  if (existsSync(path.join(dir, 'bun.lockb')) || existsSync(path.join(dir, 'bun.lock'))) return ['bun', ['install']]
  if (existsSync(path.join(dir, 'package-lock.json'))) return ['npm', ['ci', '--no-audit', '--no-fund']]
  return ['npm', ['install', '--no-audit', '--no-fund']]
}

export const previews = (): SitePreview[] => [...running.values()].map((r) => r.preview)
export const previewOf = (id: string) => running.get(id)?.preview

type Notify = (preview: SitePreview) => void
type Log = (siteId: string, line: string) => void

function pipe(child: ChildProcess, siteId: string, log: Log, onLine?: (line: string) => void) {
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = ''
    stream?.setEncoding('utf8')
    stream?.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        // Sem as cores do terminal
        // eslint-disable-next-line no-control-regex
        const line = buffer.slice(0, nl).replace(/\x1b\[[\d;]*m/g, '').trimEnd()
        buffer = buffer.slice(nl + 1)
        if (!line.trim()) continue
        onLine?.(line)
        log(siteId, line)
      }
    })
  }
}

function install(site: CodeSite, log: Log): Promise<void> {
  const [bin, args] = installCommand(site.dir)
  log(site.id, `$ ${bin} ${args.join(' ')}`)
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: site.dir, env: { ...process.env, CI: '1' }, shell: process.platform === 'win32' })
    pipe(child, site.id, log)
    child.on('error', (error) => reject(new Error(`Não consegui rodar ${bin}: ${error.message}`)))
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${bin} terminou com erro (${code}). Veja o terminal da prévia.`))))
  })
}

export async function startPreview(site: CodeSite, notify: Notify, log: Log): Promise<SitePreview> {
  const current = running.get(site.id)
  if (current && current.preview.state !== 'erro' && current.preview.state !== 'parada') return current.preview
  const entry: Running = { preview: { siteId: site.id, state: 'iniciando' } }
  running.set(site.id, entry)
  const set = (patch: Partial<SitePreview>) => {
    entry.preview = { ...entry.preview, ...patch }
    notify(entry.preview)
  }
  try {
    if (!existsSync(path.join(site.dir, 'node_modules', 'astro'))) {
      set({ state: 'instalando', error: undefined })
      await install(site, log)
    }
    set({ state: 'iniciando' })
    mkdirSync(HOME, { recursive: true })
    const runner = path.join(HOME, 'astro-runner.mjs')
    const overlay = path.join(HOME, 'astro-overlay.js')
    writeFileSync(runner, RUNNER)
    writeFileSync(overlay, OVERLAY_JS)
    let port = 0
    for (let p = 4321; p < 4400 && !port; p++) if (!used().has(p)) port = (await freePort(p)) || 0
    if (!port) throw new Error('Sem porta livre para a prévia (4321–4399).')
    const child = spawn(process.execPath, [runner, site.dir, String(port), overlay], { cwd: site.dir, env: { ...process.env, FORCE_COLOR: '0', ASTRO_TELEMETRY_DISABLED: '1' } })
    entry.child = child
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('A prévia não respondeu em 2 minutos. Veja o terminal.')), 120_000)
      pipe(child, site.id, log, (line) => {
        if (line.startsWith('SE_READY')) {
          clearTimeout(timer)
          set({ state: 'rodando', url: `http://127.0.0.1:${port}`, error: undefined })
          resolve()
        }
      })
      child.on('exit', (code) => {
        clearTimeout(timer)
        if (running.get(site.id) !== entry) return
        if (entry.preview.state === 'rodando' || entry.preview.state === 'iniciando') {
          set({ state: code ? 'erro' : 'parada', error: code ? `A prévia parou (código ${code}). Veja o terminal.` : undefined, url: undefined })
        }
        reject(new Error(entry.preview.error ?? 'A prévia parou antes de abrir.'))
      })
    })
    return entry.preview
  } catch (error) {
    kill(entry.child)
    set({ state: 'erro', error: error instanceof Error ? error.message : String(error), url: undefined })
    return entry.preview
  }
}

export function stopPreview(id: string, notify: Notify) {
  const entry = running.get(id)
  if (!entry) return
  running.delete(id)
  kill(entry.child)
  notify({ siteId: id, state: 'parada' })
}

/** Fecha as prévias junto com o servidor de dev ou o conector. */
export function stopAll() {
  // Saindo o processo, não dá para esperar: SIGKILL direto
  for (const entry of running.values()) entry.child?.kill('SIGKILL')
  running.clear()
}
