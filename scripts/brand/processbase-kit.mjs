#!/usr/bin/env node
/**
 * Kit de marca da ProcessBase para o cliente usar no marketing: uma página
 * visual (index.html) com cada arquivo para baixar, e os arquivos separados:
 *
 *   logo/           assinatura nas quatro versões: SVG, PNG transparente
 *                   (800, 1600 e 3200 px), JPG com fundo e PDF vetorial
 *   emblema/        o emblema nas mesmas versões (PNG de 256 a 2048 px)
 *   icones/         ícones de app, favicon (PNG, SVG, ICO) e o do iPhone
 *   redes-sociais/  fotos de perfil 1080 × 1080, seguras no recorte redondo
 *   guia/           o guia de marca em PDF e SVG, e uma imagem por página
 *   processbase-kit-de-marca.zip  tudo isso numa pasta só
 *
 *   node scripts/brand/processbase-kit.mjs
 *
 * Gera o guia antes (processbase-guia.mjs). PNG, JPG e PDF saem do Edge
 * headless (CDP), a partir dos vetores de public/brands/processbase/logo e
 * icons. Saída: public/brands/processbase/kit/.
 */
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BRAND = path.join(ROOT, 'public/brands/processbase')
const KIT = path.join(BRAND, 'kit')
const ZIP = 'processbase-kit-de-marca'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const TAR = 'C:/Windows/System32/tar.exe'

const C = {
  navy: '#171A2C',
  raised: '#1E2237',
  orange: '#FF5900',
  orangeHover: '#E24E00',
  slate: '#829AAF',
  slateInk: '#5F7A91',
  white: '#FFFFFF',
  mist: '#F2F3F5',
  body: '#5E6472',
  border: '#C9CCD3',
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const r2 = (n) => Math.round(n * 100) / 100
const read = (file) => readFileSync(path.join(BRAND, file), 'utf8')
const write = (rel, data) => { const file = path.join(KIT, rel); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, data) }
const kb = (rel) => { const size = statSync(path.join(KIT, rel)).size; return size > 1048576 ? `${(size / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(size / 1024))} KB` }

// ── vetores ─────────────────────────────────────────────────────────────────

const viewBoxOf = (svg) => svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number)
const innerOf = (svg) => svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).replace(/<title>[\s\S]*?<\/title>/, '')
/** Troca a largura e a altura do <svg> raiz. */
const sized = (svg, w, h) => {
  const open = svg.match(/<svg[^>]*>/)[0]
  return svg.replace(open, open.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', `<svg width="${w}" height="${h}"`))
}
/** O desenho sobre um fundo, com `pad` de respiro em volta (unidades do viewBox). */
const framed = (svg, bg, pad) => {
  const [x, y, w, h] = viewBoxOf(svg)
  const vb = [x - pad, y - pad, w + 2 * pad, h + 2 * pad].map(r2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}"><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${bg}"/>${innerOf(svg)}</svg>`
}

const SYMBOL = [...read('logo/processbase-symbol.svg').matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
const EMB = 102.04
/** Peças na ordem dos arquivos: superior direita, inferior direita, inferior esquerda, superior esquerda. */
const E = {
  primary: [C.orange, C.navy, C.navy, C.navy],
  reverse: [C.orange, C.white, C.white, C.white],
  white: [C.white, C.white, C.white, C.white],
}
/** Foto de perfil: quadrado cheio, emblema a 46% (cabe no recorte redondo). */
const avatarSvg = (bg, emblem) => {
  const S = 1080, size = S * 0.46, off = r2((S - size) / 2), k = (size / EMB).toFixed(5)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="ProcessBase"><title>ProcessBase</title><rect width="${S}" height="${S}" fill="${bg}"/><g transform="translate(${off} ${off}) scale(${k})">${SYMBOL.map((d, i) => `<path d="${d}" fill="${emblem[i]}"/>`).join('')}</g></svg>`
}

const VERSIONS = [
  { id: 'principal', name: 'Principal', use: 'Para fundos claros', logo: 'logo/processbase-logo.svg', symbol: 'logo/processbase-symbol.svg', preview: C.white, jpg: C.white },
  { id: 'negativo', name: 'Negativo', use: 'Para navy e fotos escuras', logo: 'logo/processbase-logo-reverse.svg', symbol: 'logo/processbase-symbol-reverse.svg', preview: C.navy, jpg: C.navy },
  { id: 'navy', name: 'Uma cor · navy', use: 'Impressão em uma cor', logo: 'logo/processbase-logo-mono-dark.svg', symbol: 'logo/processbase-symbol-mono-dark.svg', preview: C.mist, jpg: C.white },
  { id: 'branco', name: 'Uma cor · branco', use: 'Sobre laranja ou foto', logo: 'logo/processbase-logo-mono-white.svg', symbol: 'logo/processbase-symbol-mono-white.svg', preview: C.orange, jpg: C.orange },
]
const LOGO_PNG = [800, 1600, 3200]
const SYMBOL_PNG = [256, 512, 1024, 2048]

const ICONS = [
  { id: 'icone-app-laranja', name: 'Ícone de app', use: 'Laranja com o emblema branco', svg: read('icons/app-icon.svg'), png: [1024, 512, 192] },
  { id: 'icone-app-navy', name: 'Ícone de app · navy', use: 'Navy com o emblema negativo', svg: read('icons/app-icon-navy.svg'), png: [1024, 512, 192] },
  { id: 'favicon', name: 'Favicon', use: 'Aba do navegador e atalhos', svg: read('icons/favicon.svg'), png: [48, 32, 16] },
]
// no iPhone o sistema arredonda os cantos: o ícone vai quadrado e cheio
const APPLE = read('icons/favicon.svg').replace(/\srx="[^"]*"/, '')

const AVATARS = [
  { id: 'perfil-navy', name: 'Perfil navy', use: 'Instagram, LinkedIn e WhatsApp', svg: avatarSvg(C.navy, E.reverse) },
  { id: 'perfil-laranja', name: 'Perfil laranja', use: 'Destaque em fundos neutros', svg: avatarSvg(C.orange, E.white) },
  { id: 'perfil-branco', name: 'Perfil branco', use: 'Para perfis em tema claro', svg: avatarSvg(C.white, E.primary) },
]

const GUIDE_LABELS = ['Capa', 'Logo', 'Construção', 'O que não fazer', 'Cores', 'Tipografia', 'Forma', 'Texturas e efeitos', 'Componentes', 'Movimento e voz']

// ── Edge headless ───────────────────────────────────────────────────────────

const doc = (body, css = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}${css}</style></head><body>${body}</body></html>`

async function openEdge() {
  const port = 9200 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(path.join(os.tmpdir(), 'pb-kit-'))
  const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--disable-gpu', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch {}
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('O Edge headless não abriu.')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let seq = 0
  const waiting = new Map()
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data)
    if (!data.id || !waiting.has(data.id)) return
    const { resolve, reject, method } = waiting.get(data.id)
    waiting.delete(data.id)
    if (data.error) reject(new Error(`${method}: ${data.error.message}`))
    else resolve(data.result)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    waiting.set(id, { resolve, reject, method })
    ws.send(JSON.stringify({ id, method, params }))
  })
  await send('Page.enable')
  const { frameTree } = await send('Page.getFrameTree')
  const load = async (html, width, height, scale = 1, transparent = false) => {
    await send('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {})
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false })
    await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html })
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))', awaitPromise: true })
  }
  return {
    /** PNG com fundo transparente, no tamanho exato. */
    async png(svg, width, height) {
      await load(doc(sized(svg, width, height)), width, height, 1, true)
      return Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')
    },
    /** JPG de uma página HTML já montada (`scale` reduz a foto). */
    async jpg(html, width, height, quality = 90, scale = 1) {
      await load(html, width, height, scale)
      return Buffer.from((await send('Page.captureScreenshot', { format: 'jpeg', quality })).data, 'base64')
    },
    /** PDF vetorial; o tamanho da página vem do @page do HTML. */
    async pdf(html) {
      await load(html, 1600, 1000)
      const result = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 })
      return Buffer.from(result.data, 'base64')
    },
    async close() {
      ws.close()
      proc.kill()
      await sleep(500)
      try { rmSync(profile, { recursive: true, force: true }) } catch {}
    },
  }
}

const pdfDoc = (svg, w, h) => doc(sized(svg, w, h), `@page{size:${w}px ${h}px;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}`)

/** ICO com as imagens PNG dentro (aceito desde o Windows Vista e por todos os navegadores). */
function ico(images) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0); entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8); entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })
  return Buffer.concat([head, ...entries, ...images.map((image) => image.data)])
}

// ── geração ─────────────────────────────────────────────────────────────────

for (const dir of ['logo', 'emblema', 'icones', 'redes-sociais', 'guia', 'index.html', `${ZIP}.zip`]) rmSync(path.join(KIT, dir), { recursive: true, force: true })

const guide = spawnSync(process.execPath, [path.join(ROOT, 'scripts/brand/processbase-guia.mjs')], { stdio: 'inherit' })
if (guide.status) process.exit(guide.status ?? 1)

const edge = await openEdge()
const files = { logo: {}, emblema: {}, icones: {}, perfis: {} }
try {
  // logo e emblema, nas quatro versões
  for (const v of VERSIONS) {
    for (const [kind, src, sizes, jpgSide, jpgPad] of [['logo', v.logo, LOGO_PNG, 1600, EMB], ['emblema', v.symbol, SYMBOL_PNG, 1080, EMB / 2]]) {
      const svg = read(src)
      const [, , vw, vh] = viewBoxOf(svg)
      const base = `${kind}/processbase-${kind}-${v.id}`
      const list = []
      write(`${base}.svg`, svg)
      list.push({ href: `${base}.svg`, label: 'SVG', title: 'Vetor, para site, Figma e Canva' })
      for (const w of sizes) {
        const h = Math.round((w * vh) / vw)
        write(`${base}-${w}.png`, await edge.png(svg, w, h))
        list.push({ href: `${base}-${w}.png`, label: `PNG ${w}`, title: `PNG transparente, ${w} × ${h} px` })
      }
      // JPG com fundo: respiro de uma altura de emblema no logo, meia no emblema
      const boxed = framed(svg, v.jpg, jpgPad)
      const [, , bw, bh] = viewBoxOf(boxed)
      const jw = jpgSide, jh = Math.round((jpgSide * bh) / bw)
      write(`${base}.jpg`, await edge.jpg(doc(sized(boxed, jw, jh)), jw, jh, 92))
      list.push({ href: `${base}.jpg`, label: 'JPG', title: `Com fundo, ${jw} × ${jh} px` })
      write(`${base}.pdf`, await edge.pdf(pdfDoc(svg, Math.round(vw * 2), Math.round(vh * 2))))
      list.push({ href: `${base}.pdf`, label: 'PDF', title: 'Vetor, para gráfica e impressão' })
      files[kind][v.id] = list
      console.log(`${base} · ${list.length} arquivos`)
    }
  }

  // ícones de app e favicon
  for (const icon of ICONS) {
    const base = `icones/processbase-${icon.id}`
    const list = []
    write(`${base}.svg`, icon.svg)
    list.push({ href: `${base}.svg`, label: 'SVG', title: 'Vetor' })
    const pngs = []
    for (const size of icon.png) {
      const data = await edge.png(icon.svg, size, size)
      pngs.push({ size, data })
      write(`${base}-${size}.png`, data)
      list.push({ href: `${base}-${size}.png`, label: `PNG ${size}`, title: `PNG, ${size} × ${size} px` })
    }
    if (icon.id === 'favicon') {
      write('icones/favicon.ico', ico(pngs.sort((a, b) => a.size - b.size)))
      list.push({ href: 'icones/favicon.ico', label: 'ICO', title: 'Favicon clássico, 16, 32 e 48 px' })
      write('icones/apple-touch-icon-180.png', await edge.png(APPLE, 180, 180))
      list.push({ href: 'icones/apple-touch-icon-180.png', label: 'iPhone 180', title: 'Ícone do iPhone (apple-touch-icon), 180 × 180 px' })
    }
    files.icones[icon.id] = list
    console.log(`${base} · ${list.length} arquivos`)
  }

  // fotos de perfil
  for (const avatar of AVATARS) {
    const base = `redes-sociais/processbase-${avatar.id}`
    write(`${base}.svg`, avatar.svg)
    write(`${base}-1080.png`, await edge.png(avatar.svg, 1080, 1080))
    write(`${base}-1080.jpg`, await edge.jpg(doc(avatar.svg), 1080, 1080, 92))
    files.perfis[avatar.id] = [
      { href: `${base}-1080.png`, label: 'PNG 1080', title: 'PNG, 1080 × 1080 px' },
      { href: `${base}-1080.jpg`, label: 'JPG 1080', title: 'JPG, 1080 × 1080 px' },
      { href: `${base}.svg`, label: 'SVG', title: 'Vetor' },
    ]
    console.log(`${base} · 3 arquivos`)
  }

  // guia: PDF com as dez páginas, uma imagem por página e miniaturas
  const guideSvg = readFileSync(path.join(KIT, 'guia/processbase-guia-de-marca.svg'), 'utf8')
  const font = guideSvg.match(/<style>[\s\S]*?<\/style>/)[0]
  const pages = guideSvg.slice(guideSvg.indexOf('\n') + 1, guideSvg.lastIndexOf('\n</svg>')).split(/\n(?=<svg id="pagina-)/)
  const guideDoc = (body, css) => doc(`${font}${body}`, css)
  write('guia/processbase-guia-de-marca.pdf', await edge.pdf(guideDoc(
    pages.map((p) => `<div class="p">${p}</div>`).join(''),
    '@page{size:1600px 1000px;margin:0}.p{width:1600px;height:1000px;overflow:hidden;break-after:page}.p:last-child{break-after:auto}',
  )))
  files.paginas = []
  for (const [i, p] of pages.entries()) {
    const slug = p.match(/id="pagina-(\d+-[^"]+)"/)[1]
    const html = guideDoc(p, '')
    write(`guia/paginas/${slug}.jpg`, await edge.jpg(html, 1600, 1000, 88))
    write(`guia/miniaturas/${slug}.jpg`, await edge.jpg(html, 1600, 1000, 82, 0.5))
    files.paginas.push({ slug, n: i + 1, label: GUIDE_LABELS[i] })
  }
  console.log(`guia · PDF, SVG e ${pages.length} páginas`)
} finally {
  await edge.close()
}

// ── página visual ───────────────────────────────────────────────────────────

const ICON = {
  down: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg class="i i-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  out: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const chips = (list) => `<div class="chips">${list.map((f) => `<a class="chip" href="${f.href}" download title="${esc(f.title)} · ${kb(f.href)}">${ICON.down}<span>${f.label}</span></a>`).join('')}</div>`
const card = ({ preview, bg, line, name, use, list, kind = '' }) => `
        <article class="card${kind ? ` card--${kind}` : ''}">
          <div class="core">
            <div class="preview" style="background:${bg}"${line ? ' data-line' : ''}>${preview}</div>
            <div class="info">
              <div class="meta"><h3>${name}</h3><p>${use}</p></div>
              ${chips(list)}
            </div>
          </div>
        </article>`
const head = (n, label, title, lede) => `
      <div class="head">
        <p class="eyebrow">${n} · ${label}</p>
        <h2>${title}</h2>
        ${lede ? `<p class="lede">${lede}</p>` : ''}
      </div>`

const swatch = ([name, hex, role, ink]) => {
  const n = parseInt(hex.slice(1), 16)
  return `<button class="swatch" type="button" data-hex="${hex}" style="--c:${hex};--ink:${ink}"${hex === C.white || hex === C.mist ? ' data-line' : ''}>
          <span class="sw-name">${name}</span><span class="sw-role">${role}</span>
          <span class="sw-foot"><span class="sw-hex">${hex}</span><span class="sw-rgb">RGB ${n >> 16} · ${(n >> 8) & 255} · ${n & 255}</span></span>
          <span class="sw-copy">Copiar</span>
        </button>`
}

const zipHref = `${ZIP}.zip`
const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ProcessBase · Kit de marca</title>
  <meta name="description" content="Logo, emblema, ícones, fotos de perfil, cores e o guia de marca da ProcessBase, em todos os formatos.">
  <link rel="icon" href="icones/processbase-favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{--navy:${C.navy};--raised:${C.raised};--orange:${C.orange};--orange-h:${C.orangeHover};--slate:${C.slate};--slate-ink:${C.slateInk};--mist:${C.mist};--body:${C.body};--line:${C.border};--shell:#E6E8EC;--ease:cubic-bezier(.2,.7,.2,1)}
    *{box-sizing:border-box}
    html{scroll-padding-top:88px;-webkit-text-size-adjust:100%}
    @media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
    body{margin:0;background:#fff;color:var(--body);font:400 15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    img{display:block;max-width:100%}
    a{color:inherit;text-decoration:none}
    h1,h2,h3,p{margin:0}
    h1,h2,h3{color:var(--navy);font-weight:400;text-wrap:balance}
    .wrap{max-width:1344px;margin:0 auto;padding:0 32px}
    section{padding:112px 0;position:relative}
    .dark{background:var(--navy);color:rgba(255,255,255,.72)}
    .dark h1,.dark h2,.dark h3{color:#fff}
    .mist{background:var(--mist)}
    .eyebrow{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--navy)}
    .eyebrow::before{content:"";flex:none;width:20px;height:2px;background:var(--orange)}
    .dark .eyebrow{color:var(--slate)}
    h1{font-size:64px;line-height:1.02;letter-spacing:-.05em}
    h2{font-size:48px;line-height:1.05;letter-spacing:-.042em}
    h3{font-size:19px;line-height:1.2;letter-spacing:-.018em}
    .hl{font-weight:600;letter-spacing:-.035em;color:var(--slate-ink)}
    .dark .hl{color:var(--slate)}
    .lede{font-size:18px;max-width:640px}
    .head{display:grid;gap:22px;margin-bottom:56px}
    .i{width:1em;height:1em;flex:none}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:13px 24px;border:1.5px solid transparent;border-radius:8px;font-size:15px;font-weight:500;line-height:1.2;white-space:nowrap;cursor:pointer}
    .btn-primary{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600}
    .btn-primary:hover{background:var(--orange-h);border-color:var(--orange-h)}
    .btn-outline{border-color:rgba(255,255,255,.36);color:#fff}
    .btn-outline:hover{border-color:#fff;background:rgba(255,255,255,.06)}
    .btn-sm{min-height:40px;padding:9px 16px;font-size:14px}
    .btn .i{font-size:.9em}
    @media (prefers-reduced-motion:no-preference){
      .btn,.chip,.swatch,.page img{transition:color .2s var(--ease),background-color .2s var(--ease),border-color .2s var(--ease),transform .2s var(--ease)}
      .btn .i-arrow{transition:transform .2s var(--ease)}
      .btn:hover .i-arrow{transform:translateX(3px)}
      .btn:active,.chip:active,.swatch:active{transform:scale(.96)}
    }
    a:focus-visible,button:focus-visible{outline:2px solid var(--orange);outline-offset:3px}

    /* navegação: o vidro da marca */
    .nav{position:sticky;top:0;z-index:20;background:rgba(23,26,44,.82);-webkit-backdrop-filter:saturate(1.4) blur(16px);backdrop-filter:saturate(1.4) blur(16px);border-bottom:1px solid rgba(130,154,175,.18)}
    @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.nav{background:var(--navy)}}
    .nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;height:68px}
    .nav-in>a:first-child img{width:180px;height:auto}
    .nav ul{display:flex;gap:28px;list-style:none;margin:0;padding:0;font-size:14px;font-weight:500;color:rgba(255,255,255,.8)}
    .nav ul a:hover{color:#fff}

    /* abertura */
    .hero{overflow:hidden;padding:120px 0 128px;background:radial-gradient(ellipse 55% 60% at 12% 0%,rgba(130,154,175,.16),transparent 70%),var(--navy)}
    .hero-super{position:absolute;right:-180px;top:50%;width:760px;transform:translateY(-50%);opacity:.06;pointer-events:none}
    .hero-in{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:72px;align-items:center}
    .hero-copy{display:grid;gap:26px;justify-items:start}
    .hero-copy .lede{color:rgba(255,255,255,.72)}
    .hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
    .hero-note{font-size:13px;color:var(--slate)}
    .collage{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .tile{border-radius:16px;display:grid;place-items:center;overflow:hidden}
    .tile--wide{grid-column:1/-1;aspect-ratio:2.6/1;background:#fff}
    .tile--wide img{width:64%}
    .tile--sq{aspect-ratio:1/1}
    .tile--orange{background:var(--orange)}
    .tile--orange img{width:42%}
    .tile--raised{background:var(--raised);border:1px solid rgba(255,255,255,.06)}
    .tile--raised img{width:54%;border-radius:50%}
    .tile--palette{grid-column:1/-1;display:flex;height:56px;border-radius:12px}
    .tile--palette span{flex:var(--w)}

    /* formatos */
    .formats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
    .fmt{display:grid;gap:12px;align-content:start;padding:28px;border:1px solid var(--line);border-radius:16px}
    .tag{display:inline-grid;place-items:center;width:64px;height:64px;margin-bottom:8px;border-radius:12px;background:var(--navy);color:#fff;font-size:16px;font-weight:700;letter-spacing:.06em}
    .fmt:nth-child(2) .tag{background:var(--orange)}
    .fmt:nth-child(3) .tag{background:var(--slate);color:var(--navy)}
    .fmt:nth-child(4) .tag{background:var(--mist);color:var(--navy);box-shadow:inset 0 0 0 1px var(--line)}
    .fmt p{font-size:14px}

    /* cards: a moldura dupla da marca */
    .grid{display:grid;gap:20px}
    .grid--2{grid-template-columns:repeat(2,1fr)}
    .grid--3{grid-template-columns:repeat(3,1fr)}
    .grid--4{grid-template-columns:repeat(4,1fr)}
    .card{padding:6px;border-radius:22px;background:var(--shell);border:1px solid #DADDE3}
    .card .core{height:100%;display:flex;flex-direction:column;padding:10px;border-radius:16px;background:#fff;border:1px solid #DDE0E5}
    .preview{display:grid;place-items:center;aspect-ratio:16/7;border-radius:10px;overflow:hidden}
    .preview[data-line]{box-shadow:inset 0 0 0 1px #E3E5EA}
    .preview>img{width:62%}
    .card--sq .preview{aspect-ratio:1/1}
    .card--sq .preview>img{width:44%}
    .card--icon .preview{aspect-ratio:4/3}
    .card--icon .preview>img{width:30%}
    .card--fav .preview{display:flex;align-items:center;justify-content:center;gap:20px;aspect-ratio:4/3}
    .card--fav .preview>img{width:auto}
    .card--avatar .preview{aspect-ratio:4/3}
    .card--avatar .preview>img{width:52%;border-radius:50%}
    .info{flex:1;display:grid;gap:16px;align-content:space-between;padding:16px 10px 8px}
    .meta{display:grid;gap:4px}
    .meta p{font-size:13px}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 11px;border:1px solid var(--line);border-radius:8px;color:var(--navy);font-size:12px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
    .chip .i{font-size:13px;color:var(--orange)}
    .chip:hover{background:var(--navy);border-color:var(--navy);color:#fff}
    .chip:hover .i{color:#fff}
    .dark .card{background:rgba(130,154,175,.07);border-color:rgba(130,154,175,.16)}
    .dark .card .core{background:var(--raised);border-color:rgba(255,255,255,.06)}
    .dark .meta p{color:rgba(255,255,255,.72)}
    .dark .chip{border-color:rgba(255,255,255,.2);color:#fff}
    .dark .chip:hover{background:#fff;border-color:#fff;color:var(--navy)}
    .dark .chip:hover .i{color:var(--orange)}
    .note{margin-top:28px;display:flex;align-items:center;gap:12px;font-size:14px}
    .note::before{content:"";flex:none;width:20px;height:2px;background:var(--orange)}

    /* cores */
    .swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
    .swatches--sm{grid-template-columns:repeat(6,1fr);margin-top:20px}
    .swatch{position:relative;display:flex;flex-direction:column;gap:6px;min-height:280px;padding:24px;border:0;border-radius:16px;background:var(--c);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
    .swatch[data-line]{box-shadow:inset 0 0 0 1px var(--line)}
    .swatches--sm .swatch{min-height:150px;padding:18px;border-radius:12px}
    .sw-name{font-size:24px;letter-spacing:-.025em;line-height:1.15}
    .swatches--sm .sw-name{font-size:15px;font-weight:600;letter-spacing:0}
    .sw-role{font-size:13px;opacity:.8}
    .sw-foot{margin-top:auto;display:grid;gap:2px}
    .sw-hex{font-size:20px;font-weight:600;letter-spacing:.02em}
    .swatches--sm .sw-hex{font-size:14px}
    .sw-rgb{font-size:13px;opacity:.8}
    .swatches--sm .sw-rgb{font-size:12px}
    .sw-copy{position:absolute;top:18px;right:18px;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:0}
    .swatch[data-line] .sw-copy,.swatch[style*="#829AAF"] .sw-copy,.swatch[style*="#C9CCD3"] .sw-copy{background:rgba(23,26,44,.08)}
    .swatch:hover .sw-copy,.swatch:focus-visible .sw-copy,.swatch.is-copied .sw-copy{opacity:1}

    /* tipografia */
    .type{display:grid;grid-template-columns:1.4fr 1fr;gap:20px}
    .type .core{padding:36px;gap:18px}
    .type .aa{font-size:168px;line-height:.9;letter-spacing:-.05em;color:var(--navy)}
    .weights{display:flex;flex-wrap:wrap;gap:8px 28px;font-size:20px;color:var(--navy)}
    .wordmark{width:min(100%,340px);margin:28px 0 30px}
    .type p{font-size:14px}
    .type .chips{margin-top:auto}

    /* guia */
    .guide-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:28px 40px;margin-bottom:48px}
    .guide-head .head{margin:0}
    .pages{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}
    .page{display:grid;gap:10px;font-size:13px;color:rgba(255,255,255,.72)}
    .page img{width:100%;height:auto;aspect-ratio:16/10;border-radius:10px;border:1px solid rgba(130,154,175,.18)}
    .page:hover img{border-color:var(--slate)}
    .page b{color:var(--orange);font-weight:600;margin-right:8px}

    .foot{padding:40px 0;border-top:1px solid rgba(130,154,175,.18)}
    .foot .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;font-size:13px}
    .foot img{width:150px;height:auto}
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

    @media (max-width:1024px){
      .wrap{padding:0 24px}
      section{padding:88px 0}
      .hero{padding:88px 0 96px}
      h1{font-size:52px}
      h2{font-size:40px}
      .nav ul{display:none}
      .hero-in{grid-template-columns:1fr;gap:56px}
      .collage{max-width:560px}
      .formats,.grid--4,.swatches{grid-template-columns:repeat(2,1fr)}
      .grid--3,.swatches--sm{grid-template-columns:repeat(3,1fr)}
      .type{grid-template-columns:1fr}
      .pages{grid-template-columns:repeat(3,1fr)}
    }
    @media (max-width:767px){
      .wrap{padding:0 20px}
      section{padding:64px 0}
      .hero{padding:64px 0 72px}
      h1{font-size:40px}
      h2{font-size:32px}
      .lede{font-size:16px}
      .head{margin-bottom:40px}
      .nav-in{height:60px}
      .nav-in>a:first-child img{width:144px}
      .formats,.grid--2,.grid--3,.grid--4,.swatches{grid-template-columns:1fr}
      .swatches--sm{grid-template-columns:repeat(2,1fr)}
      .swatch{min-height:200px}
      .pages{grid-template-columns:repeat(2,1fr)}
      .type .aa{font-size:120px}
      .card--sq .preview{aspect-ratio:16/9}
      .card--sq .preview>img{width:30%}
      .type .core{padding:24px}
    }
  </style>
</head>
<body>
  <header class="nav">
    <div class="wrap nav-in">
      <a href="#topo" aria-label="ProcessBase, voltar ao topo"><img src="logo/processbase-logo-negativo.svg" alt="ProcessBase" width="180" height="25"></a>
      <ul>
        <li><a href="#logo">Logo</a></li>
        <li><a href="#emblema">Emblema</a></li>
        <li><a href="#icones">Ícones</a></li>
        <li><a href="#redes-sociais">Redes sociais</a></li>
        <li><a href="#cores">Cores</a></li>
        <li><a href="#guia">Guia</a></li>
      </ul>
      <a class="btn btn-primary btn-sm" href="${zipHref}" download>${ICON.down}Baixar tudo</a>
    </div>
  </header>

  <main id="topo">
    <section class="hero dark">
      <img class="hero-super" src="emblema/processbase-emblema-branco.svg" alt="">
      <div class="wrap hero-in">
        <div class="hero-copy">
          <p class="eyebrow">Kit de marca</p>
          <h1>A marca ProcessBase, <span class="hl">pronta para usar.</span></h1>
          <p class="lede">Logo e emblema em todas as versões e formatos, ícones, fotos de perfil, cores e o guia de marca completo.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="${zipHref}" download>Baixar o kit completo ${ICON.arrow}</a>
            <a class="btn btn-outline" href="guia/processbase-guia-de-marca.pdf" target="_blank" rel="noopener">Abrir o guia de marca</a>
          </div>
          <p class="hero-note">Um arquivo .zip com tudo desta página · ${'{{ZIP_SIZE}}'}</p>
        </div>
        <div class="collage" aria-hidden="true">
          <div class="tile tile--wide"><img src="logo/processbase-logo-principal.svg" alt=""></div>
          <div class="tile tile--sq tile--orange"><img src="emblema/processbase-emblema-branco.svg" alt=""></div>
          <div class="tile tile--sq tile--raised"><img src="redes-sociais/processbase-perfil-navy-1080.png" alt=""></div>
          <div class="tile tile--palette"><span style="--w:42;background:${C.navy};box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)"></span><span style="--w:26;background:#fff"></span><span style="--w:16;background:${C.mist}"></span><span style="--w:10;background:${C.slate}"></span><span style="--w:6;background:${C.orange}"></span></div>
        </div>
      </div>
    </section>

    <section id="formatos">
      <div class="wrap">${head('00', 'Antes de baixar', 'Qual arquivo usar', 'Todo logo vem em quatro formatos. Na dúvida, use o PNG.')}
        <div class="formats">
          <div class="fmt"><span class="tag">SVG</span><h3>Site e design</h3><p>Vetor: cresce sem perder qualidade. Use no site, no Figma e no Canva.</p></div>
          <div class="fmt"><span class="tag">PNG</span><h3>Redes e apresentações</h3><p>Fundo transparente, em três tamanhos. O formato do dia a dia.</p></div>
          <div class="fmt"><span class="tag">JPG</span><h3>Quando o transparente falha</h3><p>Já com fundo, para WhatsApp, e-mail e sistemas que trocam o transparente por preto.</p></div>
          <div class="fmt"><span class="tag">PDF</span><h3>Gráfica e impressão</h3><p>Vetor para cartão, banner, adesivo, brinde e qualquer impressão.</p></div>
        </div>
      </div>
    </section>

    <section id="logo" class="mist">
      <div class="wrap">${head('01', 'Logo', 'Assinatura', 'O emblema ao lado do nome. Escolha a versão pelo fundo onde o logo vai ficar.')}
        <div class="grid grid--2">${VERSIONS.map((v) => card({
          preview: `<img src="logo/processbase-logo-${v.id}.svg" alt="Logo ProcessBase, versão ${esc(v.name.toLowerCase())}" loading="lazy">`,
          bg: v.preview, line: v.preview === C.white, name: v.name, use: v.use, list: files.logo[v.id],
        })).join('')}
        </div>
        <p class="note">Abaixo de 24 px de altura, use só o emblema. Deixe livre em volta do logo metade da altura do emblema.</p>
      </div>
    </section>

    <section id="emblema">
      <div class="wrap">${head('02', 'Emblema', 'O emblema sozinho', 'Para espaços pequenos, selos e aplicações em que o nome já aparece por perto.')}
        <div class="grid grid--4">${VERSIONS.map((v) => card({
          preview: `<img src="emblema/processbase-emblema-${v.id}.svg" alt="Emblema ProcessBase, versão ${esc(v.name.toLowerCase())}" loading="lazy">`,
          bg: v.preview === C.white ? C.mist : v.preview, name: v.name, use: v.use, list: files.emblema[v.id], kind: 'sq',
        })).join('')}
        </div>
      </div>
    </section>

    <section id="icones" class="mist">
      <div class="wrap">${head('03', 'Ícones', 'Ícones e favicon', 'Para o site, atalhos no celular e perfis de aplicativos.')}
        <div class="grid grid--3">${card({
          preview: '<img src="icones/processbase-icone-app-laranja.svg" alt="Ícone de app laranja" loading="lazy">',
          bg: C.mist, name: ICONS[0].name, use: ICONS[0].use, list: files.icones['icone-app-laranja'], kind: 'icon',
        })}${card({
          preview: '<img src="icones/processbase-icone-app-navy.svg" alt="Ícone de app navy" loading="lazy">',
          bg: C.mist, name: ICONS[1].name, use: ICONS[1].use, list: files.icones['icone-app-navy'], kind: 'icon',
        })}${card({
          preview: '<img src="icones/processbase-favicon-48.png" width="48" height="48" alt="Favicon, 48 px" loading="lazy"><img src="icones/processbase-favicon-32.png" width="32" height="32" alt="Favicon, 32 px" loading="lazy"><img src="icones/processbase-favicon-16.png" width="16" height="16" alt="Favicon, 16 px" loading="lazy">',
          bg: C.mist, name: ICONS[2].name, use: ICONS[2].use, list: files.icones.favicon, kind: 'fav',
        })}
        </div>
      </div>
    </section>

    <section id="redes-sociais" class="dark">
      <div class="wrap">${head('04', 'Redes sociais', 'Fotos de perfil', 'Quadradas, 1080 × 1080 px, com o emblema no centro: ficam inteiras no recorte redondo do Instagram, do LinkedIn e do WhatsApp.')}
        <div class="grid grid--3">${AVATARS.map((a) => card({
          preview: `<img src="redes-sociais/processbase-${a.id}-1080.png" alt="${esc(a.name)}, como aparece no recorte redondo" loading="lazy">`,
          bg: 'rgba(130,154,175,.12)', name: a.name, use: a.use, list: files.perfis[a.id], kind: 'avatar',
        })).join('')}
        </div>
      </div>
    </section>

    <section id="cores">
      <div class="wrap">${head('05', 'Cores', 'Navy com um ponto laranja', 'Muito navy, muito branco e um único destaque laranja por peça. Clique numa cor para copiar o código.')}
        <div class="swatches">
        ${[['Navy', C.navy, 'Primária: fundos, títulos e o emblema no claro', '#FFFFFF'], ['Laranja ignição', C.orange, 'Acento: botões e pequenos destaques', C.navy], ['Ardósia', C.slate, 'Secundária: rótulos e destaques no navy', C.navy], ['Branco', C.white, 'Páginas claras, cards e texto no navy', C.navy]].map(swatch).join('')}
        </div>
        <div class="swatches swatches--sm">
        ${[['Navy elevado', C.raised, 'Cards no navy', '#FFFFFF'], ['Laranja hover', C.orangeHover, 'Botão sob o mouse', '#FFFFFF'], ['Ardósia escura', C.slateInk, 'Destaque no claro', '#FFFFFF'], ['Cinza-frio', C.mist, 'Faixas claras', C.navy], ['Texto corrido', C.body, 'Parágrafos', '#FFFFFF'], ['Filete', C.border, 'Bordas de 1 px', C.navy]].map(swatch).join('')}
        </div>
        <p class="sr" aria-live="polite" id="copiado"></p>
      </div>
    </section>

    <section id="tipografia" class="mist">
      <div class="wrap">${head('06', 'Tipografia', 'Inter, regular e justa', 'Títulos grandes em Inter Regular, sem negrito. A Lexend Deca vive só dentro do logotipo.')}
        <div class="type">
          <article class="card"><div class="core">
            <p class="aa" aria-hidden="true">Aa</p>
            <h3>Inter</h3>
            <div class="weights"><span style="font-weight:400">Regular</span><span style="font-weight:500">Medium</span><span style="font-weight:600">Semibold</span><span style="font-weight:700">Bold</span></div>
            <p>Títulos, textos, rótulos e botões. Gratuita, no Google Fonts.</p>
            <div class="chips"><a class="chip" href="https://fonts.google.com/specimen/Inter" target="_blank" rel="noopener">${ICON.out}<span>Inter no Google Fonts</span></a></div>
          </div></article>
          <article class="card"><div class="core">
            <img class="wordmark" src="logo/processbase-logo-principal.svg" alt="Logotipo ProcessBase, em Lexend Deca">
            <h3>Lexend Deca</h3>
            <p>Só no logotipo, que já vem em contornos nos arquivos. Não use em títulos nem em textos.</p>
            <div class="chips"><a class="chip" href="https://fonts.google.com/specimen/Lexend+Deca" target="_blank" rel="noopener">${ICON.out}<span>Lexend Deca no Google Fonts</span></a></div>
          </div></article>
        </div>
      </div>
    </section>

    <section id="guia" class="dark">
      <div class="wrap">
        <div class="guide-head">${head('07', 'Guia de marca', 'O guia completo', 'Construção do emblema, usos incorretos, contraste, forma, texturas, componentes, movimento e voz, em dez páginas.')}
          <div class="hero-actions">
            <a class="btn btn-primary" href="guia/processbase-guia-de-marca.pdf" download>${ICON.down}Baixar o PDF · ${kb('guia/processbase-guia-de-marca.pdf')}</a>
            <a class="btn btn-outline" href="guia/processbase-guia-de-marca.svg" download>SVG editável</a>
          </div>
        </div>
        <div class="pages">${files.paginas.map((p) => `
          <a class="page" href="guia/paginas/${p.slug}.jpg" target="_blank" rel="noopener"><img src="guia/miniaturas/${p.slug}.jpg" width="800" height="500" alt="Página ${p.n} do guia: ${esc(p.label)}" loading="lazy"><span><b>${String(p.n).padStart(2, '0')}</b>${esc(p.label)}</span></a>`).join('')}
        </div>
      </div>
    </section>
  </main>

  <footer class="foot dark">
    <div class="wrap">
      <img src="logo/processbase-logo-negativo.svg" alt="ProcessBase" width="150" height="21">
      <p>Kit de marca · versão 1 · outubro de 2026</p>
    </div>
  </footer>

  <script>
    (function () {
      var live = document.getElementById('copiado');
      function copy(text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        var area = document.createElement('textarea');
        area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(area); }
        return Promise.resolve();
      }
      [].forEach.call(document.querySelectorAll('.swatch'), function (button) {
        var label = button.querySelector('.sw-copy');
        button.addEventListener('click', function () {
          var hex = button.getAttribute('data-hex');
          copy(hex).then(function () {
            label.textContent = 'Copiado';
            button.classList.add('is-copied');
            live.textContent = hex + ' copiado';
            clearTimeout(button._t);
            button._t = setTimeout(function () { label.textContent = 'Copiar'; button.classList.remove('is-copied'); }, 1400);
          });
        });
      });
    })();
  </script>
</body>
</html>
`

// ── .zip ────────────────────────────────────────────────────────────────────

// a página entra no .zip; o tamanho dele vai depois, então a página leva uma estimativa da pasta
const folderSize = (dir) => readdirSync(dir, { withFileTypes: true })
  .reduce((total, entry) => total + (entry.isDirectory() ? folderSize(path.join(dir, entry.name)) : statSync(path.join(dir, entry.name)).size), 0)
const stage = mkdtempSync(path.join(os.tmpdir(), 'pb-kit-zip-'))
const zipTmp = path.join(stage, `${ZIP}.zip`)
const writeIndex = (size) => write('index.html', html.replace('{{ZIP_SIZE}}', size))
writeIndex(`cerca de ${(folderSize(KIT) / 1048576).toFixed(0)} MB`)
cpSync(KIT, path.join(stage, ZIP), { recursive: true })
const tar = spawnSync(TAR, ['-a', '-c', '-f', zipTmp, '-C', stage, ZIP], { stdio: 'inherit' })
if (tar.status) process.exit(tar.status ?? 1)
cpSync(zipTmp, path.join(KIT, `${ZIP}.zip`))
rmSync(stage, { recursive: true, force: true })
writeIndex(kb(`${ZIP}.zip`))
console.log(`kit · ${path.relative(ROOT, KIT)} · ${ZIP}.zip ${kb(`${ZIP}.zip`)}`)
