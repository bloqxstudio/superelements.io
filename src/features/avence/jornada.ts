/**
 * Página "Inicio · Captação" do Avence Studio (2026-10-15): o site redesenhado a
 * partir da série de posts da landing (`.space/avence-studio/landing-redesign/`),
 * com o mesmo formato (papel e tinta alternados, tinta com a grade de pontos azuis,
 * anéis finos, o quadrado azul girado, títulos grandes com uma palavra em itálico
 * e as ilustrações SVG) contando a jornada de quem chega até o WhatsApp.
 *
 * As ilustrações ficam em `public/brands/avence-studio/ilustracoes/` e entram como
 * fundo no CSS da seção (data URI): não sobem como arquivo (o WordPress recusa SVG),
 * ficam nítidas e o CSS sozinho já é a composição final. Com movimento, o script
 * troca o fundo pelo SVG dentro da página e anima as partes pelos ids do arquivo.
 */
import { AV, AV_SERIF_CSS } from './tokens'
import type { AvCase } from './cases'
import { T, tweak, sides, border, bg, cls, FIXED, AUTO, type AvBuilder, type TypeSpec, type Tone, type ButtonVariant } from './elementor'
import siteParado from '../../../public/brands/avence-studio/ilustracoes/site-parado.svg'
import camadas from '../../../public/brands/avence-studio/ilustracoes/camadas-wordpress.svg'
import cliqueConversa from '../../../public/brands/avence-studio/ilustracoes/clique-conversa.svg'
import antesDepois from '../../../public/brands/avence-studio/ilustracoes/antes-depois.svg'
import previaSite from '../../../public/brands/avence-studio/ilustracoes/previa-site.svg'

/** Escala dos posts, levada para a página: títulos maiores e mais justos que o resto do site. */
export const JR_T = {
  h1: { font: 'title', size: 112, tablet: 76, mobile: 50, weight: 500, line: 0.92, letter: -0.055 },
  h2: { font: 'title', size: 88, tablet: 64, mobile: 44, weight: 500, line: 0.95, letter: -0.05 },
  h3: { font: 'title', size: 25, tablet: 23, mobile: 21, weight: 500, line: 1.15, letter: -0.025 },
  support: { size: 22, tablet: 20, mobile: 18, line: 1.42, letter: -0.02 },
  /** número das etapas e das perguntas (a serifada itálica vem do CSS) */
  num: { font: 'title', size: 34, tablet: 30, mobile: 28, weight: 400, line: 1, letter: -0.02 },
} satisfies Record<string, TypeSpec>

const clean = (svg: string) => svg
  .replace(/<title[^>]*>[\s\S]*?<\/title>|<desc[^>]*>[\s\S]*?<\/desc>/g, '')
  .replace(/\s(role|aria-labelledby)="[^"]*"/g, '')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim()

/**
 * Palavra em destaque que troca (itálico azul): todas ficam no título, empilhadas no mesmo lugar, e o
 * espaço é o da maior. O leitor de tela lê só a primeira; sem script, com menos movimento e nas fotos
 * do Space, só a primeira aparece. O script (jrMotion) troca uma pela outra.
 */
export const jrWords = (words: string[]) =>
  `<span class="jr-words">${words.map((w, i) => `<em class="av-em"${i ? ' aria-hidden="true"' : ''}>${w}</em>`).join('')}</span>`

/** As cinco ilustrações da landing, com a proporção do viewBox. */
export const JR_ART = {
  parado: { svg: clean(siteParado), w: 650, h: 520 },
  camadas: { svg: clean(camadas), w: 620, h: 680 },
  conversa: { svg: clean(cliqueConversa), w: 920, h: 500 },
  depois: { svg: clean(antesDepois), w: 740, h: 680 },
  previa: { svg: clean(previaSite), w: 760, h: 640 },
} as const
export type JrArtName = keyof typeof JR_ART

/** CSS da ilustração: fundo em data URI com a proporção certa. */
export const jrArtCss = (name: JrArtName) => {
  const art = JR_ART[name]
  return `selector .jr-art-${name}{aspect-ratio:${art.w}/${art.h};background-image:url("data:image/svg+xml,${encodeURIComponent(art.svg)}")}`
}

const RING = { light: '#b9c3ff', dark: AV.blue } as const

/** O visual dos posts, comum a todas as seções da página. */
export const jrCss = (tone: Tone, dots = false) => [
  'selector{position:relative;isolation:isolate;overflow:clip}',
  // a grade de pontos azuis da tinta, que apaga devagar nas bordas
  dots ? `selector::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:radial-gradient(circle,${AV.blueDeep} 1px,transparent 1.25px);background-size:20px 20px;-webkit-mask-image:radial-gradient(120% 95% at 58% 45%,#000 38%,rgba(0,0,0,.28) 100%);mask-image:radial-gradient(120% 95% at 58% 45%,#000 38%,rgba(0,0,0,.28) 100%)}` : '',
  // anéis: três círculos finos, metade fora da seção
  `selector .jr-rings{width:var(--jr-ring,560px)!important;height:auto;aspect-ratio:1;border:1px solid ${RING[tone]};border-radius:50%;opacity:.8}`,
  `selector .jr-rings::before,selector .jr-rings::after{content:"";position:absolute;inset:14%;border:1px solid ${RING[tone]};border-radius:50%}selector .jr-rings::after{inset:29%}`,
  // o quadrado azul girado
  `selector .jr-square{width:46px!important;height:46px;min-height:46px;background:${AV.blue};transform:rotate(28deg);z-index:2!important}`,
  // ilustração: fundo no CSS; com o script, o SVG entra no lugar
  'selector .jr-art{position:relative;width:100%;background-position:center;background-repeat:no-repeat;background-size:contain;pointer-events:none}',
  // janela de navegador com a capa de um case
  `selector .jr-window{position:relative;overflow:hidden}selector .jr-dot{width:9px!important;height:9px;min-height:9px;flex:none;border-radius:50%;background:#b9b9b9}selector .jr-window-dark .jr-dot{background:${AV.blueLight}}selector .jr-url{margin-left:auto}selector .jr-shot img{display:block;width:100%;height:auto;aspect-ratio:960/600;object-fit:cover;object-position:top}`,
  'selector .jr-art.jr-inlined{background-image:none!important}selector .jr-art .jr-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}',
  // números das etapas na serifada itálica
  `selector .jr-num .elementor-heading-title{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-variant-numeric:lining-nums}`,
  // a palavra em itálico fica um pouco maior, como nos posts
  'selector .jr-title .av-em{font-size:1.12em}',
  // as palavras que trocam: empilhadas no mesmo lugar, a largura é a da maior; sem script, só a primeira
  'selector .jr-words{display:inline-grid;justify-items:start;vertical-align:baseline}selector .jr-words>.av-em{grid-area:1/1;line-height:.84;white-space:nowrap;will-change:transform}selector .jr-words>.av-em:not(:first-child){visibility:hidden}',
  // enquanto trocam, a palavra corre dentro da própria linha (não passa por cima da linha de cima)
  'selector .jr-words-live{clip-path:inset(-.22em -.4em -.32em -.4em)}',
  // o que o script move não tem transição própria
  'selector .jr-art,selector .jr-rise,selector .jr-step,selector .jr-square,selector .jr-rings,selector .jr-hero .jr-window{transition:none!important}',
  // botão dos posts: o fundo sobe de baixo e o texto rola junto (sem mouse ou com menos movimento, só troca a cor)
  `@media(hover:hover) and (prefers-reduced-motion:no-preference){selector .jr-roll .elementor-button{overflow:hidden;background-image:linear-gradient(var(--jr-fill),var(--jr-fill));background-repeat:no-repeat;background-position:50% 100%;background-size:100% 0;transition:background-size .45s cubic-bezier(.22,1,.36,1),color .3s,border-color .3s,transform .18s!important}selector .jr-roll .elementor-button:hover{background-size:100% 100%;background-color:var(--jr-base)!important;border-color:var(--jr-edge)!important}selector .jr-roll .elementor-button-text{display:block;text-shadow:0 3em 0 var(--jr-text);transition:transform .45s cubic-bezier(.22,1,.36,1)}selector .jr-roll .elementor-button:hover .elementor-button-text{transform:translateY(-3em)}}`,
  // links de texto (padrão do site novo, 2026-10-15): as letras rolam para cima, como no menu. O script do
  // "Cabeçalho novo" separa as letras de .jr-link e .jr-link-list; o sublinhado fica parado (é fundo, não text-decoration)
  'selector .jr-letters{display:inline-block;line-height:1.15;vertical-align:bottom;clip-path:inset(-8% 0)}selector .jr-letters>span{display:inline-block;white-space:pre;text-shadow:0 1.4em currentColor;transition:translate .45s calc(var(--i,0) * 12.5ms) cubic-bezier(.16,1,.3,1)}',
  '@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){selector a:hover .jr-letters>span{translate:0 -1.4em}}',
  `selector .jr-roll-ink{--jr-fill:${AV.ink};--jr-text:${AV.paper}}selector .jr-roll-paper{--jr-fill:${AV.paper};--jr-text:${AV.ink}}`,
  // durante a subida, a base fica na cor de antes e a borda já na do preenchimento
  `selector .jr-base-blue{--jr-base:${AV.blue}}selector .jr-base-ink{--jr-base:${AV.ink}}selector .jr-base-paper{--jr-base:${AV.paper}}selector .jr-base-clear{--jr-base:transparent}selector .jr-roll-ink{--jr-edge:${AV.ink}}selector .jr-roll-paper{--jr-edge:${AV.paper}}`,
  // no celular, o título quebra sozinho (menos a quebra marcada para ficar)
  '@media(max-width:767px){selector .jr-title br:not(.jr-keep){display:none}}',
].join('')

/** Partes recorrentes, montadas com o builder da seção. */
export const jrParts = (b: AvBuilder) => {
  const { row, col, container, heading, text, image, eyebrow, button } = b

  /** Rótulo do alto da seção (o usuário tirou o contador "01 / 08" dos posts em 2026-10-15). */
  const top = (label: string, tone: Tone = 'light', options: Record<string, unknown> = {}) => eyebrow(label, tone, options)

  const title = (html: string, tone: Tone = 'light', spec: TypeSpec = JR_T.h2, options: Record<string, unknown> = {}) => {
    const { _css_classes: extra, ...rest } = options as { _css_classes?: string }
    // um espaço antes de cada quebra: no celular a quebra some e as palavras não podem colar
    const spaced = html.replace(/([^\s>])<br/g, '$1 <br')
    return heading(spaced, spec, tone === 'dark' ? AV.paper : AV.ink, { header_size: 'h2', _css_classes: cls('jr-title', extra ?? ''), ...rest })
  }

  const support = (html: string, tone: Tone = 'light', options: Record<string, unknown> = {}) =>
    text(html, JR_T.support, tone === 'dark' ? AV.onDark : AV.body, options)

  /** Camada de fundo sem conteúdo (a posição vem do CSS da seção). */
  const rings = (extra: string) => container({ css_classes: cls('av-ht', 'jr-rings', extra) })
  const square = (extra: string) => container({ css_classes: cls('av-ht', 'jr-square', extra) })
  const art = (name: JrArtName, extra = '', settings: Record<string, unknown> = {}) => container({ css_classes: cls('jr-art', `jr-art-${name}`, extra), ...settings })

  /** Fio de 1px (a régua dos posts). */
  const rule = (color: string, options: Record<string, unknown> = {}) => container({ ...border(color, sides(1, 0, 0, 0)), css_classes: 'jr-rule', ...options })

  /**
   * Botão dos posts: cor nativa igual ao preenchimento que sobe (sem script, sem mouse
   * ou com menos movimento a troca é direta). No papel o fundo que sobe é a tinta; na tinta, o papel.
   */
  const cta = (label: string, url: string, variant: ButtonVariant, tone: Tone, options: Record<string, unknown> & { icon?: string; out?: boolean } = {}) => {
    const { _css_classes: extra, ...rest } = options as Record<string, unknown> & { _css_classes?: string }
    const fill = tone === 'dark' ? AV.paper : AV.ink
    const ink = tone === 'dark' ? AV.ink : AV.paper
    const base = variant === 'primary' ? 'blue' : variant === 'dark' ? 'ink' : variant === 'light' ? 'paper' : 'clear'
    return button(label, url, variant, {
      button_background_hover_color: fill, hover_color: ink, button_hover_border_color: fill,
      _css_classes: cls('jr-roll', tone === 'dark' ? 'jr-roll-paper' : 'jr-roll-ink', `jr-base-${base}`, extra ?? ''),
      ...rest,
    })
  }

  /** Número + título + texto (etapas e perguntas). */
  const step = (n: string, heading3: string, body: string, tone: Tone = 'light', options: Record<string, unknown> = {}) => col([
    heading(n, JR_T.num, tone === 'dark' ? AV.blueLight : AV.blue, { _css_classes: 'jr-num av-num' }),
    heading(heading3, JR_T.h3, tone === 'dark' ? AV.paper : AV.ink, { header_size: 'h3' }),
    text(body, tweak(T.body, { size: 15.5 }), tone === 'dark' ? AV.onDarkMuted : AV.muted),
  ], 12, options)

  /**
   * Janela de navegador com a capa de um case, no traço das ilustrações: no papel, branca com
   * contorno de tinta; na tinta, levantada com filete azul claro (como as camadas).
   */
  const caseWindow = (c: AvCase, tone: Tone = 'light', extra = '') => col([
    row([
      container({ css_classes: 'jr-dot' }), container({ css_classes: 'jr-dot' }), container({ css_classes: 'jr-dot' }),
      heading(c.domain, tweak(T.tag, { size: 10.5 }), tone === 'dark' ? AV.onDarkMuted : AV.muted, { ...FIXED, ...AUTO, _css_classes: 'jr-url' }),
    ], 7, { padding: sides(11, 14), ...border(tone === 'dark' ? AV.lineDark : AV.ink, sides(0, 0, tone === 'dark' ? 1 : 2, 0)) }),
    image(c.cover.path, `Página inicial do site ${c.name}`, { _css_classes: 'jr-shot' }),
  ], 0, {
    ...bg(tone === 'dark' ? AV.inkRaised : AV.white),
    ...border(tone === 'dark' ? AV.blueLight : AV.ink, sides(tone === 'dark' ? 1 : 2)),
    css_classes: cls('jr-window', tone === 'dark' ? 'jr-window-dark' : '', extra),
  })

  return { top, title, support, rings, square, art, rule, cta, step, caseWindow }
}

/**
 * Movimento da página: um widget HTML só de comportamento, primeiro filho da
 * abertura. GSAP e ScrollTrigger do jsDelivr. O CSS sozinho já é a página
 * pronta; com menos movimento, no editor do Elementor e em página que não rola
 * (as fotos do Space) nada roda.
 *
 * - a ilustração da abertura assenta girando e o site dentro dela se monta;
 * - os blocos `.jr-rise` sobem 24px uma vez ao entrar;
 * - do clique à conversa: o anúncio entra, o caminho se desenha, os pontos
 *   acendem junto com as quatro etapas embaixo, e a conversa aparece no celular;
 * - bonito não basta: a tela antiga apaga e recua, a nova chega na frente;
 * - a prévia: o texto e o botão da página nova se montam;
 * - a troca: as três camadas se encaixam com a rolagem (vai e volta);
 * - os anéis e o quadrado andam devagar com a rolagem.
 */
export const jrMotion = () => `<script>(function(){
var d=document.documentElement;if(d.dataset.jrMotion)return;d.dataset.jrMotion='1';
if(!document.querySelector('link[href*="Instrument+Serif"]')){var l=document.createElement('link');l.rel='stylesheet';l.href=${JSON.stringify(AV_SERIF_CSS)};document.head.appendChild(l)}
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var editor=document.body&&document.body.classList.contains('elementor-editor-active');
if(reduce||editor)return;
d.classList.add('jr-wait');
var free=function(){d.classList.remove('jr-wait')};setTimeout(free,2600);
function scrollable(){return d.scrollHeight-innerHeight>80}
function load(src,cb){var s=document.createElement('script');s.src=src;s.onload=cb;s.onerror=free;document.head.appendChild(s)}
function inline(){[].forEach.call(document.querySelectorAll('.jr-art'),function(el){
 if(el.querySelector('.jr-svg'))return;
 /* o Elementor segura os fundos das seções de baixo (e-lazyloaded); a ilustração está no próprio CSS, então pode vir já */
 var par=el.closest('.e-parent');if(par)par.classList.add('e-no-lazyload');
 var bgi=getComputedStyle(el).backgroundImage||'',at=bgi.indexOf('data:image/svg+xml,');if(at<0)return;
 var raw=bgi.slice(at+19).replace(/["']?\\)\\s*$/,'');
 var name=(/jr-art-([a-z]+)/.exec(el.className)||[])[1]||'art';
 var svg;try{svg=new DOMParser().parseFromString(decodeURIComponent(raw),'image/svg+xml').documentElement}catch(e){return}
 if(!svg||svg.nodeName.toLowerCase()!=='svg')return;
 [].forEach.call(svg.querySelectorAll('[id]'),function(n){n.id='jr-'+name+'-'+n.id});
 svg.setAttribute('class','jr-svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 el.appendChild(document.importNode(svg,true));el.classList.add('jr-inlined')})}
function $(s){return document.querySelector(s)}
function $$(s){return [].slice.call(document.querySelectorAll(s))}
function below(el){return el.getBoundingClientRect().top>innerHeight*.9}
function run(){
 var g=window.gsap,ST=window.ScrollTrigger;if(!g||!ST){free();return}
 g.registerPlugin(ST);inline();d.classList.add('jr-live');free();
 var E='expo.out';
 /* abertura (o giro final é o do CSS, que muda no celular) */
 var hero=$('.jr-hero .jr-art');
 if(hero){g.from(hero,{opacity:0,y:48,rotate:'+=7',duration:1.2,ease:E,delay:.1,clearProps:'transform,opacity'});
  var acc=$('#jr-parado-browser-accent');if(acc)g.from(acc,{scaleY:0,transformOrigin:'50% 100%',duration:.8,ease:E,delay:.55});
  g.from($$('#jr-parado-browser-copy rect'),{scaleX:0,transformOrigin:'0% 50%',duration:.7,ease:E,stagger:.09,delay:.7});
  var img=$('#jr-parado-browser-image');if(img)g.from(img,{opacity:0,y:24,duration:.8,ease:E,delay:.9})}
 /* a palavra em destaque troca: a atual sobe e some, a próxima sobe de baixo; duas voltas e para na primeira */
 $$('.jr-words').forEach(function(box){var w=[].slice.call(box.children);if(w.length<2)return;
  var i=0,turns=0,max=w.length*2,timer=null,seen=true;
  w.forEach(function(e,k){if(k){e.style.visibility='visible';g.set(e,{opacity:0,yPercent:55})}});
  box.classList.add('jr-words-live');
  function next(){var a=w[i];i=(i+1)%w.length;var b=w[i];turns++;
   g.to(a,{opacity:0,yPercent:-55,filter:'blur(4px)',duration:.42,ease:'power2.in'});
   g.fromTo(b,{opacity:0,yPercent:55,filter:'blur(4px)'},{opacity:1,yPercent:0,filter:'blur(0px)',duration:.75,ease:E,delay:.2});
   if(turns>=max){clearInterval(timer);timer=null}}
  function play(){if(!timer&&turns<max)timer=setInterval(next,2600)}
  function stop(){if(timer){clearInterval(timer);timer=null}}
  ST.create({trigger:box,start:'top bottom',end:'bottom top',onToggle:function(s){seen=s.isActive;if(seen&&!document.hidden)play();else stop()}});
  document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else if(seen)play()});
  play()});
 /* abertura com as janelas dos cases: chegam uma por cima da outra */
 var wins=$$('.jr-hero .jr-window');
 if(wins.length)g.from(wins,{opacity:0,y:56,rotate:'+=6',duration:1.2,ease:E,stagger:.16,delay:.1,clearProps:'transform,opacity'});
 /* blocos que sobem */
 var rise=$$('.jr-rise').filter(below);g.set(rise,{opacity:0,y:24});
 ST.batch(rise,{start:'top 90%',once:true,onEnter:function(b){g.to(b,{opacity:1,y:0,duration:.85,ease:E,stagger:.09,overwrite:true})}});
 /* do clique à conversa */
 var conv=$('.jr-art-conversa');
 if(conv&&below(conv)){
  var steps=$$('.jr-step'),nodes=$$('#jr-conversa-journey-nodes rect'),path=$('#jr-conversa-journey-path');
  var tl=g.timeline({paused:true});
  tl.from('#jr-conversa-ad-card',{opacity:0,x:-30,duration:.7,ease:E})
   .addLabel('n0',.35);
  if(steps[0])tl.from(steps[0],{opacity:.25,duration:.4},'n0');
  if(path)tl.fromTo(path,{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:1.3,ease:'power2.inOut'},.45);
  nodes.forEach(function(n,i){tl.from(n,{scale:0,transformOrigin:'50% 50%',duration:.45,ease:'back.out(2)'},.5+i*.3)});
  tl.from('#jr-conversa-phone',{opacity:0,y:40,duration:.8,ease:E},.9);
  if(steps[1])tl.from(steps[1],{opacity:.25,duration:.4},.85);
  if(steps[2])tl.from(steps[2],{opacity:.25,duration:.4},1.15);
  tl.from('#jr-conversa-message-in',{opacity:0,y:12,duration:.45,ease:E},1.5)
   .from('#jr-conversa-message-out',{opacity:0,y:12,scale:.92,transformOrigin:'100% 100%',duration:.5,ease:E},1.85)
   .from('#jr-conversa-message-burst path',{opacity:0,scale:.4,transformOrigin:'0% 100%',stagger:.05,duration:.35,ease:E},2.15)
   .from('#jr-conversa-message-reply',{opacity:0,y:12,duration:.45,ease:E},2.35);
  if(steps[3])tl.from(steps[3],{opacity:.25,duration:.4},1.9);
  ST.create({trigger:conv,start:'top 72%',once:true,onEnter:function(){tl.play()}})}
 /* bonito não basta */
 var dep=$('.jr-art-depois');
 if(dep&&below(dep)){var t2=g.timeline({paused:true});
  t2.from('#jr-depois-device-before',{opacity:1,x:40,duration:1,ease:E})
   .from('#jr-depois-device-after',{opacity:0,x:-50,duration:1,ease:E},.15)
   .from($$('#jr-depois-device-after rect').slice(1,6),{scaleX:0,transformOrigin:'0% 50%',stagger:.06,duration:.6,ease:E},.5);
  ST.create({trigger:dep,start:'top 75%',once:true,onEnter:function(){t2.play()}})}
 /* a prévia */
 var pre=$('.jr-art-previa');
 if(pre&&below(pre)){var t3=g.timeline({paused:true});
  t3.from($$('#jr-previa-preview-copy rect'),{scaleX:0,transformOrigin:'0% 50%',stagger:.08,duration:.6,ease:E})
   .from('#jr-previa-preview-cta',{scale:.5,opacity:0,transformOrigin:'0% 50%',duration:.55,ease:'back.out(1.6)'},.4)
   .from('#jr-previa-preview-image',{opacity:0,y:20,duration:.8,ease:E},.2)
   .from($$('#jr-previa-preview-cards rect'),{opacity:0,y:24,stagger:.08,duration:.6,ease:E},.5);
  ST.create({trigger:pre,start:'top 75%',once:true,onEnter:function(){t3.play()}})}
 /* a troca: as camadas se encaixam com a rolagem */
 var cam=$('.jr-art-camadas');
 if(cam){var t4=g.timeline({scrollTrigger:{trigger:cam,start:'top 92%',end:'center 55%',scrub:.6}});
  t4.from('#jr-camadas-layer-back',{y:-70,x:30,opacity:.2,ease:'none'},0)
   .from('#jr-camadas-layer-middle',{x:-90,opacity:.2,ease:'none'},0)
   .from('#jr-camadas-layer-front',{y:90,x:40,opacity:.2,ease:'none'},0)
   .from('#jr-camadas-projection-grid',{opacity:0,ease:'none'},.2)}
 /* anéis e quadrado andam devagar */
 /* (o que já está na tela ao abrir só começa a andar quando a seção sobe, sem pulo) */
 function drift(el,to){var sec=el.closest('.e-parent')||el.parentNode;var seen=sec.getBoundingClientRect().top<innerHeight;
  g.to(el,Object.assign({ease:'none',scrollTrigger:{trigger:sec,start:seen?'top top':'top bottom',end:'bottom top',scrub:true}},to))}
 $$('.jr-rings').forEach(function(r){drift(r,{yPercent:-12})});
 $$('.jr-square').forEach(function(s){drift(s,{rotate:'+=90'})});
 addEventListener('load',function(){ST.refresh()});
}
function start(){if(!scrollable()){free();return}
 if(window.gsap&&window.ScrollTrigger)return run();
 var C='https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';load(C+'gsap.min.js',function(){load(C+'ScrollTrigger.min.js',run)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();</script>`

/** Enquanto o script carrega, a ilustração da abertura espera (no máximo 2,6 s). */
export const JR_WAIT_CSS = 'html.jr-wait selector .jr-hero-art{opacity:0}'
