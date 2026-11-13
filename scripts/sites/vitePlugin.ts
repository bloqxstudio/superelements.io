import type { Plugin } from 'vite'
import { SITE_EVENTS, type PickedElement, type PublishMode, type SiteCall, type SiteResult, type SitePreview, type SitesState } from '../../src/features/sites/protocol.ts'
import { cloneRepo, discard, git, githubUser, listRepos, publish, pull, siteDiff, siteStatus } from './git.ts'
import { previews, startPreview, stopAll, stopPreview } from './preview.ts'
import { addSite, getSite, readSites, removeSite, updateSite } from './registry.ts'
import { envStatus, findText, inspect, listPages, replaceText, saveImage, setAttr, setEnv, setText } from './source.ts'

/**
 * Sites em código (Astro) no mesmo canal do chat do Space: o websocket do Vite no
 * `npm run dev` e o conector no app publicado. A aba manda `sites:chamar` e recebe
 * `sites:resposta`; a lista, as prévias e o terminal chegam sozinhos.
 */

const str = (v: unknown, max = 2000) => String(v ?? '').slice(0, max)

function picked(v: unknown): PickedElement {
  const p = (v ?? {}) as Partial<PickedElement>
  if (!p.file || !p.loc || !p.tag) throw new Error('Escolha um elemento na prévia.')
  return {
    file: str(p.file, 600),
    loc: str(p.loc, 20),
    tag: str(p.tag, 40),
    segments: Array.isArray(p.segments) ? p.segments.slice(0, 200).map((s) => str(s, 4000)) : [],
    attrs: {},
    chain: [],
  }
}

export const codeSites = (): Plugin => ({
  name: 'sinfy-sites',
  apply: 'serve',
  configureServer(server) {
    let github: SitesState['github'] | undefined
    const state = async (): Promise<SitesState> => {
      github ??= await githubUser()
      return { sites: readSites(), previews: previews(), github }
    }
    const broadcast = () => void state().then((s) => server.ws.send(SITE_EVENTS.state, s))
    const notify = (_: SitePreview) => broadcast()
    const log = (siteId: string, line: string) => server.ws.send(SITE_EVENTS.log, { siteId, line: line.slice(0, 2000) })
    const send = (result: SiteResult) => server.ws.send(SITE_EVENTS.result, result)

    server.ws.on(SITE_EVENTS.hello, () => broadcast())

    server.ws.on(SITE_EVENTS.call, (call: SiteCall) => {
      void (async () => {
        const id = str(call?.id, 80)
        if (!id) return
        const r = (call.request ?? {}) as Record<string, unknown>
        try {
          const data = await (async () => {
            switch (call.kind) {
              case 'list':
                github = await githubUser()
                return state()
              case 'repos':
                return listRepos()
              case 'connect': {
                const accountId = r.accountId ? str(r.accountId, 80) : undefined
                if (r.repo) {
                  const repo = str(r.repo, 200)
                  log('', `Clonando ${repo}…`)
                  const dir = await cloneRepo(repo)
                  const site = addSite({ dir, repo, accountId, name: r.name ? str(r.name, 80) : undefined, url: r.url ? str(r.url, 300) : undefined })
                  broadcast()
                  return site
                }
                if (!r.dir) throw new Error('Diga o repositório ou a pasta do site.')
                const dir = str(r.dir, 600)
                const origin = await git(dir, 'remote', 'get-url', 'origin').catch(() => '')
                const repo = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\s*$/.exec(origin.trim())?.[1] ?? (/^git@[\w.-]+:([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(origin.trim())?.[1])
                const site = addSite({ dir, repo, accountId, name: r.name ? str(r.name, 80) : undefined, url: r.url ? str(r.url, 300) : undefined })
                broadcast()
                return site
              }
              case 'update': {
                const site = updateSite(str(r.siteId, 40), { name: r.name as string | undefined, url: r.url as string | undefined })
                broadcast()
                return site
              }
              case 'remove':
                stopPreview(str(r.siteId, 40), notify)
                removeSite(str(r.siteId, 40))
                broadcast()
                return { ok: true }
              case 'start':
                return startPreview(getSite(r.siteId), notify, log)
              case 'stop':
                stopPreview(str(r.siteId, 40), notify)
                return { ok: true }
              case 'env':
                return envStatus(getSite(r.siteId))
              case 'env-set': {
                const site = getSite(r.siteId)
                const ignored = await git(site.dir, 'check-ignore', '-q', '.env').then(() => true, () => false)
                const values = r.values && typeof r.values === 'object' ? Object.fromEntries(Object.entries(r.values as Record<string, unknown>).slice(0, 60).map(([k, v]) => [str(k, 80), str(v, 4000)])) : {}
                const status = setEnv(site, values, ignored)
                // O Astro só lê o .env ao abrir: a prévia reinicia
                stopPreview(site.id, notify)
                await new Promise((resolve) => setTimeout(resolve, 3500))
                void startPreview(site, notify, log)
                return status
              }
              case 'pages':
                return listPages(getSite(r.siteId))
              case 'inspect':
                return inspect(getSite(r.siteId), picked(r.el))
              case 'text':
                return setText(getSite(r.siteId), picked(r.el), Array.isArray(r.after) ? r.after.slice(0, 200).map((s) => str(s, 4000)) : [])
              case 'attr':
                return setAttr(getSite(r.siteId), picked(r.el), str(r.name, 60), str(r.value, 2000))
              case 'find':
                return findText(getSite(r.siteId), str(r.text, 1000))
              case 'replace':
                return replaceText(getSite(r.siteId), { text: str(r.text, 1000), next: str(r.next, 4000), file: r.file ? str(r.file, 600) : undefined, line: Number(r.line) || undefined })
              case 'image': {
                const site = getSite(r.siteId)
                const saved = saveImage(site, { name: str(r.name, 120), data: str(r.data, 25_000_000) })
                if (r.el) await setAttr(site, picked(r.el), 'src', saved.src)
                return saved
              }
              case 'status':
                return siteStatus(getSite(r.siteId).dir, r.fetch === true)
              case 'diff':
                return siteDiff(getSite(r.siteId).dir)
              case 'publish':
                return publish(getSite(r.siteId).dir, (r.mode === 'revisao' ? 'revisao' : 'direto') as PublishMode, str(r.message, 200))
              case 'pull':
                return pull(getSite(r.siteId).dir, r.toDefault === true)
              case 'discard':
                return discard(getSite(r.siteId).dir, Array.isArray(r.files) ? r.files.slice(0, 200).map((f) => str(f, 600)) : undefined)
              default:
                throw new Error('Pedido desconhecido.')
            }
          })()
          send({ id, ok: true, data })
        } catch (error) {
          send({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      })()
    })

    server.httpServer?.once('close', stopAll)
    process.once('exit', stopAll)
  },
})
