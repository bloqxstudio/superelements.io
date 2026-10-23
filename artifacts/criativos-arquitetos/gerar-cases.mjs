// Gera posts-cases.html: posts de feed (4:5) com os cases da Avence, no desenho do site da Avence.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AQUI } from './lib.mjs'
const style = readFileSync(path.join(AQUI, 'posts.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1]
const CASES = '../../public/brands/avence-studio/cases/'
const PB = 'capturas-cases/pb-'

// recorte de uma imagem: sx, sy, sw, sh na imagem original (largura `iw`), mostrado em x, y, w (altura sai da proporção)
const crop = ({ src, iw, sx, sy, sw, sh, w, cls = '', style = '', over = '' }) => {
  const k = w / sw, h = Math.round(sh * k)
  return `<div class="cropbox ${cls}" style="width:${w}px;height:${h}px;${style}"><img src="${src}" style="width:${Math.round(iw * k)}px;left:${-Math.round(sx * k)}px;top:${-Math.round(sy * k)}px">${over}</div>`
}
// anel de destaque, em coordenadas da imagem original, dentro de um recorte
const ring = (c, rx, ry, rw, rh, label, side = 'below') => {
  const k = c.w / c.sw
  const L = Math.round((rx - c.sx) * k), T = Math.round((ry - c.sy) * k), W = Math.round(rw * k), H = Math.round(rh * k)
  return `<div class="hl" style="left:${L}px;top:${T}px;width:${W}px;height:${H}px"></div><div class="hltag ${side}" style="left:${L}px;top:${side === 'below' ? T + H + 14 : T - 56}px">${label}</div>`
}
const win = (x, y, w, inner, url = '') => `<div class="lap" style="left:${x}px;top:${y}px;width:${w}px"><div class="bar"><b></b><b></b><b></b><u>${url}</u></div>${inner}</div>`
const post = (n, tone, meta, body) => `<article class="post ${tone === 'paper' ? 'paper' : ''}" data-post="${n}"><div class="dots"></div><div class="grid"></div><div class="ring" style="width:780px;height:780px;right:-380px;top:520px"></div><div class="brand">avence<i></i></div><div class="meta">${meta}</div>${body}</article>`
const head = (kick, l1, l2, fs = 112, top = 226) => `<div class="kick" style="top:176px">${kick}</div><h2 style="top:${top}px;font-size:${fs}px">${l1}<br><em>${l2}</em></h2>`
const lede = (t, top, w = 860) => `<p class="lede" style="top:${top}px;width:${w}px;font-size:29px">${t}</p>`
const foot = (l, r, top = 1286) => `<div class="foot" style="top:${top}px">${l}</div><div class="foot" style="top:${top}px;left:auto;right:64px">${r}</div>`

const posts = []
let n = 0
const add = (tone, meta, body) => posts.push(post(++n, tone, meta, body))

// ---------- ProcessBase · carrossel ----------
const PBP = CASES + 'processbase-pagina.webp'
// 1 capa
add('ink', 'Case · ProcessBase',
  head('Case · Consultoria de gestão', 'Um método,', 'um site que explica.', 112) +
  lede('A ProcessBase precisava mostrar o Método Base com clareza e levar a conversa ao diagnóstico. A Avence fez o site.', 520, 900) +
  win(64, 700, 952, `<img src="${PB}8.5.png" style="display:block;width:100%">`, 'processbase.com.br') +
  `<div class="tag b" style="left:44px;top:660px">WordPress + Elementor</div>` + `<div class="tag" style="right:44px;top:660px">Passe para o lado →</div>`)
// 2 emblema
{
  const c = { src: PB + '10.4.png', iw: 1280, sx: 20, sy: 190, sw: 700, sh: 440, w: 952 }
  add('ink', 'Detalhe 01 · ProcessBase',
    head('Detalhe em destaque', 'O logo se forma', 'enquanto você rola.', 108) +
    lede('O emblema monta, gira em 3D e acende um pilar de cada vez, junto com o texto de cada etapa.', 500) +
    win(64, 650, 952, crop({ ...c, cls: 'plain', over: ring(c, 90, 260, 400, 280, 'Pilares acesos no scroll', 'below') }), 'processbase.com.br') +
    foot('Efeito feito em Elementor + GSAP', 'Detalhe 01/04', 1296))
}
// 3 antes/depois
{
  const c = { src: PBP, iw: 1200, sx: 0, sy: 2500, sw: 1200, sh: 700, w: 952 }
  add('paper', 'Detalhe 02 · ProcessBase',
    head('Detalhe em destaque', 'Antes e depois,', 'em uma tela.', 112) +
    lede('Em vez de um texto longo, um card compara a operação de memória com a operação com padrão, ritmo e direção.', 500) +
    win(64, 660, 952, crop({ ...c, cls: 'plain', over: ring(c, 120, 80, 700, 340, 'Antes × Depois', 'below') }), 'processbase.com.br') +
    foot('Menos texto, mais comparação', 'Detalhe 02/04', 1296))
}
// 4 como funciona
{
  const c = { src: PBP, iw: 1200, sx: 0, sy: 3200, sw: 1200, sh: 700, w: 952 }
  add('ink', 'Detalhe 03 · ProcessBase',
    head('Detalhe em destaque', 'O caminho do cliente', 'em três passos.', 108) +
    lede('Conversa de diagnóstico, método pilar a pilar e estrutura em uso: o visitante vê o que acontece depois do contato.', 500) +
    win(64, 660, 952, crop({ ...c, cls: 'plain', over: ring(c, 60, 130, 1090, 290, '01 · 02 · 03', 'below') }), 'processbase.com.br') +
    foot('Menos dúvida antes de chamar', 'Detalhe 03/04', 1296))
}
// 5 hero
{
  const c = { src: PBP, iw: 1200, sx: 0, sy: 60, sw: 1200, sh: 640, w: 952 }
  add('paper', 'Detalhe 04 · ProcessBase',
    head('Detalhe em destaque', 'Primeira tela:', 'promessa e próximo passo.', 100) +
    lede('A primeira dobra diz o que a empresa faz e oferece dois caminhos: agendar o diagnóstico ou conhecer o método.', 500) +
    win(64, 660, 952, crop({ ...c, cls: 'plain', over: ring(c, 190, 195, 830, 140, 'Promessa clara', 'above') + ring(c, 395, 455, 410, 60, 'Dois caminhos', 'below') }), 'processbase.com.br') +
    foot('Foco em contato', 'Detalhe 04/04', 1296))
}
// 6 fecho
add('ink', 'Case · ProcessBase',
  head('Feito pela Avence', 'Quer um site', 'assim para o seu negócio?', 108) +
  lede('Site em WordPress e Elementor com movimento no scroll, o método explicado e um caminho claro até o contato.', 560, 860) +
  `<div class="chips" style="top:730px"><span>Site responsivo</span><span>Alta performance</span><span>SEO técnico</span></div>` +
  `<div class="btn" style="top:830px">Peça uma prévia</div><div style="position:absolute;left:470px;top:838px;font:500 28px/1.15 'Inter Tight';letter-spacing:-.02em;z-index:30"><small style="display:block;font:600 13px/1 'Inter Tight';letter-spacing:.16em;text-transform:uppercase;color:rgba(243,241,236,.6);margin-bottom:8px">Chame no Direct</small>@avencestudio</div>` +
  crop({ src: CASES + 'processbase-capa.webp', iw: 960, sx: 0, sy: 0, sw: 960, sh: 600, w: 520, cls: 'plain', style: 'left:64px;top:1000px;border:1px solid rgba(243,241,236,.2)' }) +
  crop({ src: CASES + 'processbase-celular.webp', iw: 520, sx: 0, sy: 0, sw: 520, sh: 1000, w: 250, cls: 'plain', style: 'left:640px;top:980px;border-radius:36px;border:8px solid #161616' }))

// ---------- grade de cases ----------
const grid = [['processbase', 'ProcessBase', 'Consultoria de gestão'], ['vizor', 'Vizor Películas', 'Películas para painéis de moto'], ['flavia-neto', 'Flávia Neto', 'Aulas de yoga'], ['zena-viagens', 'Zena Viagens', 'Viagens sob medida'], ['contplan', 'Contplan', 'Contabilidade para empresas'], ['prexparts', 'PrexParts', 'Peças e acessórios para motos']]
add('paper', 'Cases Avence',
  head('Sites no ar', 'Seis sites,', 'seis segmentos.', 96, 220) +
  grid.map(([s, nm, seg], i) => {
    const x = 64 + (i % 2) * 492, y = 440 + Math.floor(i / 2) * 296
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:460px;z-index:10"><div style="width:460px;height:240px;overflow:hidden;border:1px solid rgba(17,17,17,.2);background:#111"><img src="${CASES}${s}-capa.webp" style="width:460px;height:auto;display:block"></div><div style="display:flex;justify-content:space-between;margin-top:12px;font:600 14px/1 'Inter Tight';letter-spacing:.1em;text-transform:uppercase"><span>${nm}</span><span style="color:#66625a">${seg}</span></div></div>`
  }).join(''))

// ---------- um post por case, com detalhe em destaque ----------
const DET = [
  { slug: 'vizor', tone: 'ink', nome: 'Vizor Películas', seg: 'Películas para painéis de moto', stack: 'Astro', dom: 'vizorpeliculas.com.br', l1: 'Catálogo que', l2: 'ajuda a achar.',
    txt: 'Busca por marca, modelo e ano e uma página para quem quer revender.', c: { sx: 40, sy: 940, sw: 1120, sh: 380 }, r: [110, 1040, 980, 110, 'Marca · Modelo · Ano'] },
  { slug: 'flavia-neto', tone: 'paper', nome: 'Flávia Neto', seg: 'Aulas de yoga', stack: 'WordPress e Elementor', dom: 'flavianeto.com.br', l1: 'Um site de yoga', l2: 'com cara de estúdio.',
    txt: 'As aulas, o espaço, as perguntas frequentes e a aula experimental marcada pelo WhatsApp.', c: { sx: 0, sy: 40, sw: 1200, sh: 700 }, r: [560, 150, 540, 450, 'Fotos em formas orgânicas'] },
  { slug: 'zena-viagens', tone: 'ink', nome: 'Zena Viagens', seg: 'Viagens sob medida', stack: 'WordPress e Elementor', dom: 'zenaviagens.com', l1: 'Viagem sob medida,', l2: 'site sob medida.',
    txt: 'O método, os serviços e o pedido da viagem num formulário.', c: { sx: 0, sy: 40, sw: 1200, sh: 700 }, r: [430, 440, 340, 90, 'Um botão, um objetivo'] },
  { slug: 'contplan', tone: 'paper', nome: 'Contplan', seg: 'Contabilidade para empresas', stack: 'WordPress e Elementor', dom: 'contplan.com.br', l1: 'Contabilidade', l2: 'com planos claros.',
    txt: 'Os serviços, os planos, o caminho para virar cliente, a área do cliente e o contato.', c: { sx: 0, sy: 3060, sw: 1200, sh: 700 }, r: [90, 3250, 1020, 420, 'Três planos lado a lado'] },
  { slug: 'prexparts', tone: 'ink', nome: 'PrexParts', seg: 'Peças e acessórios para motos', stack: 'WordPress e Elementor', dom: 'prexparts.com.br', l1: 'Catálogo por modelo,', l2: 'fácil de percorrer.',
    txt: 'A linha de produtos organizada por modelo e as marcas atendidas.', c: { sx: 0, sy: 1040, sw: 1200, sh: 700 }, r: [40, 1270, 1100, 300, 'Produtos por modelo'] },
]
for (const d of DET) {
  const c = { src: CASES + d.slug + '-pagina.webp', iw: 1200, w: 952, ...d.c }
  add(d.tone, `Case · ${d.nome}`,
    head(`${d.seg}`, d.l1, d.l2, 104) +
    lede(d.txt, 480, 880) +
    win(64, 660, 952, crop({ ...c, cls: 'plain', over: ring(c, ...d.r, 'below') }), d.dom) +
    `<div class="tag b" style="left:44px;top:620px">Detalhe em destaque</div>` +
    foot(`${d.nome} · ${d.stack}`, '@avencestudio', 1306))
}


// ---------- novos formatos ----------
// lupa
{
  const c = { src: PB + '10.4.png', iw: 1280, sx: 40, sy: 190, sw: 560, sh: 560, w: 600 }
  add('ink', 'Detalhe · ProcessBase',
    head('Detalhe em destaque', 'Cada detalhe', 'pensado para o scroll.', 108) +
    lede('O emblema da ProcessBase acende pilar por pilar enquanto o visitante lê o método.', 500, 860) +
    win(64, 700, 760, `<img src="${PB}8.5.png" style="display:block;width:100%">`, 'processbase.com.br') +
    crop({ ...c, cls: 'lupa', style: 'left:400px;top:740px;border-radius:50%;border:6px solid #2b3cf0;box-shadow:0 0 0 12px rgba(43,60,240,.22),0 40px 90px -20px rgba(0,0,0,.9);z-index:20' }) +
    foot('Zoom no efeito', 'ProcessBase · WordPress e Elementor', 1306))
}
// lista do que tem no site
add('paper', 'Site Avence',
  head('O que tem num site Avence', 'Feito para', 'o cliente chamar.', 112) +
  `<ul class="chk" style="top:520px;width:560px"><li>Primeira tela com promessa e próximo passo</li><li>Cases e serviços em seções claras</li><li>WhatsApp e formulário em toda a página</li><li>Movimento no scroll, sem pesar</li><li>Site responsivo, editável em Elementor</li></ul>` +
  crop({ src: CASES + 'processbase-celular.webp', iw: 520, sx: 0, sy: 0, sw: 520, sh: 1000, w: 300, cls: 'plain', style: 'left:700px;top:560px;border-radius:44px;border:9px solid #161616;box-shadow:0 50px 90px -30px rgba(17,17,17,.6)' }) +
  foot('WordPress e Elementor', '@avencestudio', 1306))

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Avence · Posts de cases</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&display=swap">
<style>${style}
.cropbox{position:relative;overflow:hidden}.cropbox img{position:absolute;display:block;max-width:none}
.lap .cropbox{border:0}
.hl{position:absolute;border:4px solid var(--blue);border-radius:14px;box-shadow:0 0 0 6px rgba(43,60,240,.22);z-index:3}
.hltag{position:absolute;z-index:4;background:var(--blue);color:#fff;font:600 15px/1 "Inter Tight";letter-spacing:.1em;text-transform:uppercase;padding:13px 16px;white-space:nowrap}
.post h2 em{display:inline}
</style></head><body>
${posts.join('\n')}
<script>const q=new URLSearchParams(location.search).get('post');if(q){document.body.style.padding='0';document.body.style.gap='0';document.querySelectorAll('.post').forEach(p=>p.hidden=p.dataset.post!==q)}</script>
</body></html>`
writeFileSync(path.join(AQUI, 'posts-cases.html'), html)
console.log(posts.length + ' posts')
