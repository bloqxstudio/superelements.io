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


const GRID = [['vizor', 'Vizor Películas', 'Películas para moto'], ['flavia-neto', 'Flávia Neto', 'Aulas de yoga'], ['zena-viagens', 'Zena Viagens', 'Viagens sob medida'], ['contplan', 'Contplan', 'Contabilidade'], ['prexparts', 'PrexParts', 'Motopeças'], ['processbase', 'ProcessBase', 'Consultoria']]
const cta = (top, tone = 'ink') => `<div class="btn" style="top:${top}px">Peça sua prévia</div><div style="position:absolute;left:440px;top:${top + 8}px;z-index:30;font:500 28px/1.15 'Inter Tight';letter-spacing:-.02em"><small style="display:block;font:600 13px/1 'Inter Tight';letter-spacing:.16em;text-transform:uppercase;color:${tone === 'paper' ? '#66625a' : 'rgba(243,241,236,.6)'};margin-bottom:8px">Chame no Direct</small>@avencestudio</div>`

// 1 · grade
add('paper', 'Sites que vendem',
  head('Sites no ar', 'Seis sites no ar.', 'O próximo é o seu?', 96, 220) +
  GRID.map(([s, nm, seg], i) => {
    const x = 64 + (i % 3) * 328, y = 470 + Math.floor(i / 3) * 300
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:296px;z-index:10"><div style="width:296px;height:240px;overflow:hidden;border:1px solid rgba(17,17,17,.2);background:#111"><img src="${CASES}${s}-capa.webp" style="height:240px;width:auto;display:block;margin-left:-40px"></div><div style="margin-top:12px;font:600 14px/1.2 'Inter Tight';letter-spacing:.1em;text-transform:uppercase">${nm}<br><span style="color:#66625a;letter-spacing:.06em">${seg}</span></div></div>`
  }).join('') +
  lede('Cada site pensado para o cliente entender, confiar e chamar no WhatsApp.', 1090, 900) + cta(1190, 'paper'))

// 2 a 6 · um por case, com detalhe em destaque e CTA
const DET = [
  { slug: 'vizor', tone: 'ink', nome: 'Vizor Películas', kick: 'Para quem vende produto', l1: 'Cliente acha o produto,', l2: 'você fecha a venda.',
    txt: 'Catálogo com busca por marca, modelo e ano. Menos pergunta no WhatsApp, mais pedido.', c: { sx: 40, sy: 940, sw: 1120, sh: 380 }, r: [110, 1040, 980, 110, 'Marca · Modelo · Ano'], dom: 'vizorpeliculas.com.br' },
  { slug: 'flavia-neto', tone: 'paper', nome: 'Flávia Neto', kick: 'Para estúdios e professores', l1: 'Quem pesquisa aula', l2: 'marca aula com você.',
    txt: 'Aulas, espaço e perguntas frequentes num site calmo, com botão direto para marcar a aula experimental.', c: { sx: 0, sy: 40, sw: 1200, sh: 640 }, r: [560, 150, 540, 450, 'Seu espaço em destaque'], dom: 'flavianeto.com.br' },
  { slug: 'zena-viagens', tone: 'ink', nome: 'Zena Viagens', kick: 'Para quem vende serviço sob medida', l1: 'Seu site tem que', l2: 'vender o seu serviço.',
    txt: 'Método, serviços e formulário de pedido: cada seção leva o visitante ao orçamento.', c: { sx: 0, sy: 40, sw: 1200, sh: 640 }, r: [430, 440, 340, 90, 'Um botão, um objetivo'], dom: 'zenaviagens.com' },
  { slug: 'contplan', tone: 'paper', nome: 'Contplan', kick: 'Para empresas de serviço B2B', l1: 'Planos claros,', l2: 'decisão mais rápida.',
    txt: 'Mostre seus planos lado a lado e leve o cliente certo até o contato.', c: { sx: 0, sy: 3060, sw: 1200, sh: 640 }, r: [90, 3250, 1020, 330, 'Três planos lado a lado'], dom: 'contplan.com.br' },
  { slug: 'prexparts', tone: 'ink', nome: 'PrexParts', kick: 'Para fabricantes e lojas', l1: 'Catálogo organizado,', l2: 'lojista que volta.',
    txt: 'Linha de produtos por modelo e marcas atendidas, fácil de percorrer no celular e no computador.', c: { sx: 0, sy: 1040, sw: 1200, sh: 640 }, r: [40, 1270, 1100, 300, 'Produtos por modelo'], dom: 'prexparts.com.br' },
]
for (const d of DET) {
  const c = { src: CASES + d.slug + '-pagina.webp', iw: 1200, w: 860, ...d.c }
  add(d.tone, `Case · ${d.nome}`,
    head(d.kick, d.l1, d.l2, 104) + lede(d.txt, 470, 880) +
    win(110, 610, 860, crop({ ...c, cls: 'plain', over: ring(c, ...d.r, 'below') }), d.dom) +
    `<div class="tag b" style="left:90px;top:572px">Detalhe em destaque</div>` + cta(1196, d.tone))
}

// 7 · só tipografia
add('paper', 'Pergunta direta',
  `<div class="kick" style="top:176px">Seu site hoje</div><h2 style="top:226px;font-size:132px">Seu site traz<br><em>cliente</em> ou só<br><em>existe?</em></h2>` +
  `<ul class="chk" style="top:760px;width:900px"><li>O visitante entende o que você faz em 5 segundos?</li><li>O botão de WhatsApp aparece sem ele procurar?</li><li>No celular, ele chega até o orçamento?</li></ul>` + cta(1150, 'paper') +
  `<div class="foot" style="top:1290px">Sites em WordPress e Elementor</div>`)

// 8 · oferta
add('ink', 'Oferta',
  `<div class="kick" style="top:176px">Site novo</div><h2 style="top:226px;font-size:124px">Seu site novo,<br><em>pago uma vez.</em></h2>` +
  `<ul class="chk" style="top:620px;width:900px"><li>Prévia do seu site antes de fechar</li><li>Pagamento único pelo site</li><li>Plano mensal opcional para cuidar dele</li><li>Feito em WordPress e Elementor</li></ul>` + cta(1150) +
  `<div class="foot" style="top:1290px">Sem mensalidade obrigatória</div>`)

// 9 · lista
add('paper', 'O que entregamos',
  head('O que tem num site Avence', 'Feito para', 'o cliente chamar.', 112) +
  `<ul class="chk" style="top:520px;width:560px"><li>Primeira tela com promessa e próximo passo</li><li>Cases e serviços em seções claras</li><li>WhatsApp e formulário em toda a página</li><li>Movimento no scroll, sem pesar</li><li>Responsivo, editável em Elementor</li></ul>` +
  crop({ src: CASES + 'processbase-celular.webp', iw: 520, sx: 0, sy: 0, sw: 520, sh: 1000, w: 300, cls: 'plain', style: 'left:700px;top:520px;border-radius:44px;border:9px solid #161616;box-shadow:0 50px 90px -30px rgba(17,17,17,.6)' }) + cta(1150, 'paper'))

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
writeFileSync(path.join(AQUI, 'posts-comercial.html'), html)
console.log(posts.length + ' posts')
