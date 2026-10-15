import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isPublicHost } from '../../supabase/functions/_shared/siteScan.ts'
import type { ContactSpot, PhoneCapture } from '../../src/features/prospects/demand.ts'

/**
 * A página aberta num celular, para o Diagnóstico de site: o Edge (ou o
 * Chrome) headless desta máquina, pelo CDP, em 390 × 844. Mede quando a
 * primeira tela aparece com 4G lento e processador 4× mais lento (as condições
 * do teste de celular do Google), fotografa a primeira tela e a página tela a
 * tela, e acha onde estão o WhatsApp, o telefone e o formulário, os textos da
 * primeira tela, os sinais de confiança e a medição. Só no servidor de dev
 * (`vitePlugin.ts`); no app publicado isso pede um serviço de captura.
 */

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const PHONE = { width: 390, height: 844, scale: 2 }
const MOBILE_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
/** O 4G lento do Lighthouse com limitação aplicada (latência × 3,75; banda × 0,9) e o processador 4× mais lento. */
const SLOW_4G = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1474.56 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
}
const CPU_SLOWDOWN = 4
const LOAD_CAP = 30_000
const MAX_SCREENS = 8

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const findBrowser = () => [process.env.SPACE_BROWSER_BIN, ...BROWSERS].find((bin): bin is string => Boolean(bin && existsSync(bin)))

interface Tab {
  send: <T = Record<string, unknown>>(method: string, params?: Record<string, unknown>) => Promise<T>
  once: (method: string) => Promise<unknown>
  close: () => void
}

const connect = async (wsUrl: string): Promise<Tab> => {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('O CDP do navegador não abriu'))
  })
  let next = 0
  const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  const listeners = new Map<string, ((params: unknown) => void)[]>()
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(String(data))
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id)!
      waiting.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    } else if (message.method) listeners.get(message.method)?.forEach((fn) => fn(message.params))
  }
  return {
    send: <T>(method: string, params: Record<string, unknown> = {}) =>
      new Promise<T>((resolve, reject) => {
        const id = ++next
        waiting.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    once: (method: string) => new Promise((resolve) => listeners.set(method, [...(listeners.get(method) ?? []), resolve])),
    close: () => ws.close(),
  }
}

/** O LCP que o navegador reporta, guardado na página desde o primeiro byte. */
const LCP_SCRIPT = `(() => { window.__seLcp = 0; try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__seLcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch (e) {} })()`

/** Os contatos da página: links do WhatsApp, telefone e e-mail, botões flutuantes de plugin e formulários. */
const CONTACTS_SCRIPT = `window.__seContacts = () => {
  const shown = (el) => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' }
  const pinned = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true; return false }
  const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim()
  const list = []
  const seen = new Set()
  const add = (el, kind, extra) => {
    if (seen.has(el) || !shown(el)) return
    seen.add(el)
    const fixed = pinned(el)
    const r = el.getBoundingClientRect()
    list.push(Object.assign({ kind, fixed, text: clean(el.innerText).slice(0, 60) || undefined, x: Math.round(r.left), y: Math.round(fixed ? r.top : r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }, extra || {}))
  }
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || ''
    if (/wa\\.me\\/|whatsapp\\.com\\/|^whatsapp:/i.test(href)) add(a, 'whatsapp', { prefilled: /[?&]text=[^&]/i.test(href) })
    else if (/^tel:/i.test(href)) add(a, 'phone')
    else if (/^mailto:/i.test(href)) add(a, 'email')
  }
  for (const el of document.querySelectorAll('.joinchat__button, .joinchat__open, #ht-ctc-chat, .ht-ctc-chat, .qlwapp__button, .wa__btn_popup, .wh-widget-send-button')) {
    if (!el.closest('a[href]')) add(el, 'whatsapp')
  }
  for (const el of document.querySelectorAll('[class*="whatsapp" i], [id*="whatsapp" i]')) {
    const r = el.getBoundingClientRect()
    if (!el.closest('a[href]') && pinned(el) && r.width < 200 && r.height < 200) add(el, 'whatsapp')
  }
  for (const form of document.querySelectorAll('form')) {
    if (form.matches('[role=search], .search-form, .elementor-search-form') || form.querySelector('input[type=search], input[name=s]')) continue
    if (form.querySelectorAll('input:not([type=hidden]):not([type=submit]), textarea').length < 2) continue
    add(form, 'form')
  }
  return list
}`

/** O resto da página, lido uma vez, com a página no topo. */
const FACTS_SCRIPT = `(() => {
  const vh = innerHeight
  const shown = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' }
  const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim()
  const top = (el) => el.getBoundingClientRect().top + scrollY

  const firstScreenText = []
  const seen = new Set()
  let h1 = null
  let big = null
  let bigSize = 0
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, a, button, .elementor-heading-title, .elementor-button')) {
    if (!shown(el) || top(el) >= vh) continue
    const text = clean(el.innerText)
    if (text.length < 2 || seen.has(text)) continue
    const button = el.matches('button, .elementor-button, [class*="btn"], [class*="button"]') || (el.tagName === 'A' && /btn|button|cta/i.test(el.className))
    const title = el.matches('h1, h2, h3, h4, .elementor-heading-title')
    if (el.tagName === 'A' && !button) continue
    if (el.closest('nav, header nav, .menu, .elementor-nav-menu')) continue
    // Item de menu montado com títulos ("ESCRITÓRIO", "CONTATO"): é navegação, não mensagem
    if (title && text.split(' ').length <= 2 && (el.closest('a') || el.querySelector('a'))) continue
    seen.add(text)
    firstScreenText.push({ kind: title ? 'titulo' : button ? 'botao' : 'texto', text: text.slice(0, 220) })
    if (title) {
      const r = el.getBoundingClientRect()
      const box = { text: text.slice(0, 160), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }
      if (el.tagName === 'H1' && !h1) h1 = box
      const size = parseFloat(getComputedStyle(el).fontSize) || 0
      if (size > bigSize) { bigSize = size; big = box }
    }
    if (firstScreenText.length >= 30) break
  }

  const headings = [...document.querySelectorAll('h1, h2, h3')].filter(shown).map((el) => clean(el.innerText).slice(0, 160)).filter(Boolean).slice(0, 30)
  const text = clean(document.body ? document.body.innerText : '')
  const html = document.documentElement.outerHTML

  const trust = []
  if (/trustindex|ti-widget|elfsight-app|grw-|wp-google-reviews|google-reviews|reviews-widget|rplg/i.test(html) || /avalia[çc][õo]es? (no|do) google|\\b[1-5][.,]\\d\\s*(★|estrelas)/i.test(text)) trust.push('Avaliações do Google')
  if (document.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"], .elementor-widget-google_maps')) trust.push('Mapa')
  if (/\\b(rua|r\\.|av\\.|avenida|travessa|alameda|rodovia|estrada|pra[çc]a)\\s+[^\\n,]{2,60},?\\s*(n[º°o.]?\\s*)?\\d{1,5}/i.test(text)) trust.push('Endereço')
  if (/\\b(OAB|CRM|CRO|CRP|CRN|CREFITO|CRMV|CRC|CREA|CAU|COREN)\\s*[\\/\\-–]?\\s*[A-Z]{2}\\s*(n[º°o.]?\\s*)?\\d[\\d.]{2,}/.test(text)) trust.push('Registro profissional')
  if (/depoimento|o que (nossos |os )?(clientes|pacientes) dizem/i.test(text)) trust.push('Depoimentos')
  if (/\\bdesde\\s+(19|20)\\d{2}\\b|\\b\\d{1,2}\\s+anos\\s+de\\s+(experi|atua|hist|mercado|tradi)/i.test(text)) trust.push('Tempo de atuação')
  if (/\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}/.test(text)) trust.push('CNPJ')

  const tracking = new Set()
  for (const id of Object.keys(window.google_tag_manager || {})) {
    if (/^GTM-/.test(id)) tracking.add('Tag Manager')
    else if (/^G-/.test(id)) tracking.add('Google Analytics')
    else if (/^AW-/.test(id)) tracking.add('Google Ads')
  }
  if (/gtag\\/js\\?id=G-|['"]G-[A-Z0-9]{6,}['"]/.test(html)) tracking.add('Google Analytics')
  if (/\\bAW-\\d{6,}/.test(html)) tracking.add('Google Ads')
  if (typeof window.fbq === 'function') tracking.add('Pixel da Meta')
  if (window.ttq) tracking.add('Pixel do TikTok')
  if (window.clarity) tracking.add('Microsoft Clarity')
  if (window.hj) tracking.add('Hotjar')

  let cookieBanner = false
  for (const el of document.querySelectorAll('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="lgpd" i], [class*="lgpd" i]')) {
    if (!shown(el) || getComputedStyle(el).position !== 'fixed') continue
    const r = el.getBoundingClientRect()
    if (r.width * r.height > innerWidth * vh * 0.12 && r.top < vh) { cookieBanner = true; break }
  }

  return { url: location.href, firstScreenText, headline: h1 || big || undefined, headings, pageText: text.slice(0, 6000), trust, tracking: [...tracking], cookieBanner, pageHeight: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) }
})()`

type Facts = Omit<PhoneCapture, 'viewport' | 'firstScreen' | 'strip' | 'lcpMs' | 'contacts'>

/** Abre o site num celular emulado e devolve a foto e as medidas. Lança se o site não abrir. */
export const capturePhone = async (input: string, signal?: AbortSignal): Promise<PhoneCapture> => {
  const url = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`
  if (!isPublicHost(new URL(url).hostname)) throw new Error('Esse endereço é interno.')
  const browser = findBrowser()
  if (!browser) throw new Error('Não achei o Edge nem o Chrome nesta máquina (ou diga onde está em SPACE_BROWSER_BIN).')
  if (typeof WebSocket === 'undefined') throw new Error('A foto do celular precisa do Node 22 ou mais novo.')

  const profile = mkdtempSync(path.join(os.tmpdir(), 'se-celular-'))
  const port = 9500 + Math.floor(Math.random() * 400)
  const child = spawn(
    browser,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-color-profile=srgb',
      '--mute-audio',
      'about:blank',
    ],
    {
      stdio: 'ignore',
    }
  )
  let tab: Tab | undefined
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
  // No Windows o Edge abre vários processos: fecha a árvore inteira, ou a pasta do perfil fica presa
  const stop = () => {
    tab?.close()
    if (child.exitCode !== null || !child.pid) return
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else child.kill()
  }
  signal?.addEventListener('abort', stop, { once: true })
  const check = () => {
    if (signal?.aborted) throw new DOMException('Parou', 'AbortError')
  }
  try {
    let targets: { type: string; webSocketDebuggerUrl: string }[] | null = null
    for (let i = 0; i < 50 && !targets; i++) {
      await wait(200)
      targets = await fetch(`http://127.0.0.1:${port}/json/list`)
        .then((r) => r.json() as Promise<{ type: string; webSocketDebuggerUrl: string }[]>)
        .catch(() => null)
    }
    const page = targets?.find((t) => t.type === 'page')
    if (!page) throw new Error('O navegador headless não abriu.')
    tab = await connect(page.webSocketDebuggerUrl)
    const evaluate = async <T>(expression: string): Promise<T> =>
      (
        await tab!.send<{ result: { value: T } }>('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        })
      ).result.value

    const { width, height, scale } = PHONE
    await tab.send('Page.enable')
    await tab.send('Network.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: true,
    })
    await tab.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    })
    await tab.send('Emulation.setUserAgentOverride', {
      userAgent: MOBILE_AGENT,
      acceptLanguage: 'pt-BR,pt;q=0.9',
      platform: 'Android',
    })
    await tab.send('Page.addScriptToEvaluateOnNewDocument', {
      source: LCP_SCRIPT,
    })
    await tab.send('Network.emulateNetworkConditions', SLOW_4G)
    await tab.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })

    const loaded = tab.once('Page.loadEventFired')
    const navigation = await tab.send<{ errorText?: string }>('Page.navigate', {
      url,
    })
    if (navigation.errorText) throw new Error(`O site não abriu no celular (${navigation.errorText}).`)
    // O LCP vale quando para de mudar: 1,5 s depois do load, ou 4 s parado se o load demora (página pesada)
    let done = false
    void loaded.then(() => (done = true))
    const started = Date.now()
    let lcp = 0
    let stableSince = Date.now()
    while (Date.now() - started < LOAD_CAP) {
      await wait(500)
      check()
      const now = await evaluate<number>('window.__seLcp || 0').catch(() => lcp)
      if (now !== lcp) {
        lcp = now
        stableSince = Date.now()
      }
      if (lcp > 0 && Date.now() - stableSince >= (done ? 1500 : 4000)) break
    }

    // Daqui em diante a rede volta ao normal: só fotos e medidas
    await tab.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })
    await tab.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await evaluate('document.fonts.ready.then(() => true)')
    await wait(1200)
    check()

    const first = await tab.send<{ data: string }>('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 72,
    })
    await evaluate(CONTACTS_SCRIPT)
    const facts = await evaluate<Facts>(FACTS_SCRIPT)
    const contacts = await evaluate<ContactSpot[]>('window.__seContacts()')

    // Tela a tela: carrega o que só aparece rolando (imagens, entradas do Elementor) e fotografa
    const screens = Math.max(1, Math.min(MAX_SCREENS, Math.ceil(facts.pageHeight / height)))
    const strip: { data: string; height: number }[] = []
    for (let i = 0; i < screens; i++) {
      check()
      const y = i * height
      const slice = Math.min(height, facts.pageHeight - y)
      if (slice < 40) break
      await evaluate(`(scrollTo(0, ${y}), true)`)
      await wait(i === 0 ? 300 : 700)
      // Botão flutuante que só aparece depois de rolar: conta a partir desta tela
      if (i > 0 && !contacts.some((c) => c.kind === 'whatsapp')) {
        const late = (await evaluate<ContactSpot[]>('window.__seContacts()')).find((c) => c.kind === 'whatsapp' && c.fixed)
        if (late) contacts.push({ ...late, fixed: false, y: y + late.y })
      }
      const shot = await tab.send<{ data: string }>('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 55,
        clip: { x: 0, y, width, height: slice, scale: 0.4 },
      })
      strip.push({ data: shot.data, height: slice })
    }

    return {
      ...facts,
      viewport: { width, height },
      firstScreen: `data:image/jpeg;base64,${first.data}`,
      strip: strip.length
        ? {
            height: strip.reduce((sum, s) => sum + s.height, 0),
            screens: strip.map((s) => ({
              image: `data:image/jpeg;base64,${s.data}`,
              height: s.height,
            })),
          }
        : undefined,
      lcpMs: lcp > 0 ? Math.round(lcp) : undefined,
      contacts,
    }
  } finally {
    signal?.removeEventListener('abort', stop)
    stop()
    await Promise.race([exited, wait(3000)])
    removeProfile(profile)
  }
}

/** Apaga o perfil temporário do navegador; se o Windows ainda segura algum arquivo, tenta de novo depois, sem falhar a foto. */
const removeProfile = (dir: string, attempt = 0) => {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  } catch {
    if (attempt < 3) setTimeout(() => removeProfile(dir, attempt + 1), 5000 * (attempt + 1)).unref()
  }
}
