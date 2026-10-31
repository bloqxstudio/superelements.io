import { architectureMotionScript } from './motion.mjs';

export const architectureAssets = {
  hero: '/brands/avence-studio/criativos/arquitetura/refinamento/horizonte-chegada-v2.webp',
  process: '/brands/avence-studio/criativos/arquitetura/refinamento/horizonte-croqui-v1.webp',
  detail: '/brands/avence-studio/criativos/arquitetura/refinamento/horizonte-materiais-v1.webp',
};

const BASE = `
/* Horizonte refinement v1: retain the existing editorial composition. */
selector{--g:#686860;--m:clamp(20px,2.8vw,64px);background-color:#faf9f6;scroll-margin-top:90px}
selector .elementor-widget,selector .e-con{min-width:0}
selector .kn-d .elementor-heading-title{font-size:clamp(40px,8.5vw,168px);line-height:.98;letter-spacing:-.045em}
selector .kn-t .elementor-heading-title{font-size:clamp(36px,4.7vw,88px);line-height:1.02;letter-spacing:-.04em}
selector .kn-s .elementor-heading-title{font-size:clamp(36px,5.8vw,106px);line-height:1.04;letter-spacing:-.035em}
selector .kn-p .elementor-heading-title{font-size:clamp(23px,2.15vw,34px);line-height:1.26;letter-spacing:-.02em}
selector .kn-sm,selector .kn-sm p,selector .kn-sm .elementor-heading-title{font-family:'Inter Tight',Arial,sans-serif;font-size:clamp(14px,1.04vw,17px);line-height:1.5}
selector .kn-lb,selector .kn-lb .elementor-heading-title{font-size:14px;line-height:1.4}
selector .kn-ln{padding:.12em .04em .16em;margin:-.12em -.04em -.16em}
selector a:focus-visible{outline:2px solid currentColor;outline-offset:5px}
selector img{max-width:100%}
@media(max-width:767px){selector .kn-grid{gap:28px}selector .kn-indent .elementor-heading-title{text-indent:0}selector .kn-p .elementor-heading-title{font-size:23px;line-height:1.3}}
@media(prefers-reduced-motion:reduce){selector *,selector *::before,selector *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

const CSS = {
  'kn-header': `selector{mix-blend-mode:normal;color:#fff;background:transparent}selector .kn-hrow{height:90px;padding:22px var(--m);background:linear-gradient(180deg,rgba(16,18,16,.68),transparent)}selector .kn-nav{gap:18px}selector .kn-nav .elementor-heading-title{font-size:14px;line-height:1.4}selector .kn-nav .elementor-heading-title a{padding:7px 0;text-shadow:none;transition:opacity .18s}selector .kn-nav .elementor-heading-title{height:auto;overflow:visible}selector .kn-nav .elementor-heading-title a:hover{transform:none;opacity:.7}selector .kn-logo .elementor-heading-title{font-size:15px;line-height:1.04}@media(max-width:767px){selector .kn-hrow{height:84px;padding:18px 20px;gap:22px}selector .kn-nav{gap:10px;flex-wrap:wrap;max-width:230px;justify-content:flex-end}selector .kn-nav .elementor-heading-title{font-size:12px}selector .kn-logo .elementor-heading-title{font-size:12px}}`,
  'kn-hero': `selector{height:92svh;min-height:580px;background:#20251f}selector .kn-hero-img,selector .kn-hero-img .elementor-widget-container{width:100%;height:100%}selector .kn-hero-img img{height:100%;width:100%;object-fit:cover;object-position:58% 55%}selector::after{background:linear-gradient(180deg,rgba(0,0,0,.1) 35%,rgba(0,0,0,.58))}selector .kn-hero-t{right:var(--m);bottom:6vw}selector .kn-hero-t .elementor-heading-title{font-size:clamp(42px,6.8vw,128px);line-height:1;max-width:15ch}selector .kn-hero-t .kn-serif{font-style:italic}@media(max-width:767px){selector{height:88svh;min-height:570px}selector .kn-hero-t{bottom:42px}selector .kn-hero-t .elementor-heading-title{font-size:clamp(38px,9.6vw,64px)}selector .kn-hero-img img{object-position:64% 50%}}`,
  'kn-sis': `selector{padding:clamp(80px,9vw,160px) 0 clamp(76px,8vw,144px)}selector .kn-caps{margin-top:42px;column-gap:32px}selector .kn-cap{grid-column:4 / span 4}selector .kn-cap+.kn-cap{grid-column:9 / span 4}selector .kn-cap p{max-width:32ch}selector .kn-wide{height:54vw;max-height:800px;margin-top:64px}selector .kn-wide-img{inset:0;height:100%}selector .kn-wide-img .elementor-widget-container{height:100%}selector .kn-wide-img img{height:100%;width:100%;object-fit:cover}@media(max-width:767px){selector .kn-wide{height:75vw;margin-top:36px}selector .kn-caps{margin-top:30px;gap:20px}}`,
  'kn-about': `selector{padding-bottom:clamp(70px,8vw,144px)}selector .kn-ab-bot{margin-top:80px;padding-top:32px;border-top:1px solid #deddd5}selector .kn-fact{grid-template-columns:100px 1fr;gap:18px}selector .kn-list .kn-sm{max-width:28ch}selector .kn-awards,selector .kn-pubs{grid-template-columns:110px 1fr;gap:16px}selector .kn-ab-p .elementor-heading-title{max-width:39ch}@media(max-width:767px){selector .kn-ab-bot{margin-top:44px}selector .kn-fact,selector .kn-awards,selector .kn-pubs{grid-template-columns:95px 1fr;gap:16px}}`,
  'kn-scope': `selector{padding:0 var(--m) clamp(80px,9vw,150px)}selector .kn-big{max-width:1400px}selector .kn-big .elementor-heading-title{font-size:clamp(38px,5.8vw,96px)}selector .kn-off{margin-top:56px}selector .kn-off-l{grid-column:1 / span 3}selector .kn-rows{grid-column:5 / span 11}selector .kn-orow{grid-template-columns:1.1fr .85fr 1.3fr 20px;gap:24px;padding:22px 0;border-color:#deddd5}@media(max-width:767px){selector .kn-orow{grid-template-columns:1fr 1fr 16px;gap:8px;padding:18px 0}selector .kn-off{margin-top:32px}}`,
  'kn-sketches': `selector{padding-bottom:clamp(60px,8vw,144px)}selector .kn-sketch{height:42vw;max-height:660px;overflow:hidden;background:#e8e4db;margin-top:40px}selector .kn-sketch .elementor-widget-container,selector .kn-sk-img{height:100%;width:100%}selector .kn-sk-img img{height:100%;width:100%;object-fit:cover}selector .kn-sk-grid,selector .kn-sk-grid2{margin-top:40px}selector .kn-sk-p .elementor-heading-title{max-width:36ch}selector .kn-sk-big{margin-top:60px}selector .kn-blk-b{margin-top:100px}@media(max-width:767px){selector .kn-sketch{height:75vw;margin-top:28px}selector .kn-sk-big{margin-top:38px}selector .kn-blk-b{margin-top:68px}selector .kn-sk-grid,selector .kn-sk-grid2{margin-top:28px}}`,
  'kn-projects': `selector{padding-bottom:clamp(80px,9vw,144px)}selector .kn-pj-head{margin-bottom:48px}selector .kn-pj-ph{background:#e8e4db;overflow:hidden}selector .kn-pj-img,selector .kn-pj-img .elementor-widget-container{height:100%;width:100%}selector .kn-pj-img img{height:100%;width:100%;object-fit:cover;transition:transform .65s cubic-bezier(.22,1,.36,1)}selector .kn-pj-meta{gap:12px;padding-top:16px}selector .kn-pj-meta .kn-lb .elementor-heading-title{font-family:'Inter Tight',sans-serif;font-size:13px}selector .kn-pj-v .elementor-heading-title{color:#686860}selector .kn-pj-r{gap:18px}@media(hover:hover){selector .kn-pj-ph:hover img{transform:scale(1.025)}}@media(max-width:767px){selector .kn-pj-meta{align-items:flex-start}selector .kn-pj-r{gap:10px}selector .kn-pj-a .elementor-heading-title{font-size:12px}}`,
  'kn-radial': `selector{height:auto!important;background:#faf9f6}selector .kn-scene{position:relative!important;min-height:560px;height:72svh;max-height:900px;margin-top:0!important}selector .kn-s2{background:#151713}selector .kn-sc-t .elementor-heading-title{font-size:clamp(40px,5vw,84px);line-height:1.05}selector .kn-ring{--rs:min(57vw,74vh)}@media(max-width:767px){selector .kn-scene{min-height:420px;height:65svh}selector .kn-ring{--rs:82vw}selector .kn-sc-t .elementor-heading-title{font-size:34px;max-width:16ch;margin:auto}selector .kn-rl{font-size:10px}}`,
  'kn-people': `selector{background:#151713;padding-top:clamp(76px,8vw,144px)}selector .kn-pp-track{height:auto!important;margin-top:64px}selector .kn-pp-stage{position:relative!important;top:auto!important;height:auto!important;min-height:80vw!important;display:flex!important;align-items:center;justify-content:center;overflow:clip}selector .kn-pp-center{position:relative!important;inset:auto!important;max-width:56vw}selector .kn-pp-d .elementor-heading-title{font-size:clamp(40px,7vw,120px);line-height:1.02}selector .kn-pp-caps{max-width:38vw;grid-template-columns:1fr;margin-top:26px;gap:16px}selector .kn-pp-caps .kn-sm{max-width:38ch}selector .kn-ph,html.kn-live selector .kn-ph{width:11vw;margin:-5.5vw 0 0 -5.5vw;transform:rotate(var(--a)) translateY(-33vw) rotate(calc(-1 * var(--a)));border-radius:2px;display:block!important}selector .kn-ph img{opacity:.86}selector .kn-pp-stats{position:relative!important;top:auto!important;height:auto!important;margin:0!important;padding:20px var(--m) 96px!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:32px!important}selector .kn-stat{position:relative!important;inset:auto!important;transform:none!important;opacity:1!important;display:flex;flex-direction:column;gap:20px;border-top:1px solid #4a4d44;padding-top:24px}selector .kn-stat-n .elementor-heading-title{font-size:clamp(40px,5vw,76px);line-height:1}selector .kn-stat-c{padding:0;margin:0}selector .kn-stat-c .elementor-heading-title{font-size:clamp(25px,2.4vw,40px);line-height:1.16}@media(max-width:767px){selector .kn-pp-stage{min-height:124vw!important}selector .kn-pp-center{max-width:63vw;padding:0}selector .kn-pp-d .elementor-heading-title{font-size:10vw}selector .kn-ph{width:16vw;margin:-8vw 0 0 -8vw;transform:rotate(var(--a)) translateY(-47vw) rotate(calc(-1 * var(--a)))}selector .kn-pp-caps{max-width:54vw;margin-top:18px}selector .kn-pp-caps .kn-sm{font-size:13px;line-height:1.45}selector .kn-pp-caps .kn-sm:nth-child(2){display:none}selector .kn-pp-stats{grid-template-columns:1fr 1fr;gap:28px!important;padding-bottom:68px!important}selector .kn-stat-c .elementor-heading-title{font-size:27px}}`,
  'kn-brands': `selector{background:#151713;height:70vw;min-height:600px}selector .kn-br-t{top:22vw}selector .kn-br-t .elementor-heading-title{font-size:clamp(36px,4.7vw,80px);line-height:1.05}selector .kn-disc{background:#e5dfd1}selector .kn-disc.k2{background:#baa88d}selector .kn-disc.k3{background:#7e8574;color:#fff}selector .kn-disc b{font-weight:400}@media(max-width:767px){selector{height:132vw;min-height:520px}selector .kn-br-t{top:65vw}selector .kn-br-t .elementor-heading-title{font-size:9.5vw}}`,
  'kn-footer': `selector{background:#151713;padding-top:clamp(60px,7vw,120px)}selector .kn-footgrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:40px}selector .kn-flogo{grid-column:auto}selector .kn-fcol:nth-of-type(n){grid-column:auto;display:flex;flex-direction:column;gap:18px}selector .kn-fcol:last-child{display:none}selector .kn-fl .elementor-heading-title{font-size:14px;height:auto;overflow:visible;line-height:1.5}selector .kn-fl .elementor-heading-title a{text-shadow:none;transition:opacity .18s}selector .kn-fl .elementor-heading-title a:hover{transform:none;opacity:.7}selector .kn-giant{margin-top:80px;padding-bottom:20px}selector .kn-giant .elementor-heading-title{font-size:31vw;line-height:.9}selector .kn-legal{display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;border-top:1px solid #45483f;padding:24px var(--m)}selector .kn-g .elementor-heading-title{color:#b9bcb2;font-size:12px}@media(max-width:767px){selector .kn-footgrid{display:grid;grid-template-columns:1fr 1fr;gap:32px 20px}selector .kn-flogo{grid-column:1/-1}selector .kn-fcol:nth-of-type(n){gap:16px}selector .kn-fcol:nth-of-type(4){grid-column:1/-1;max-width:32ch}selector .kn-giant{margin-top:48px}selector .kn-legal{gap:8px;align-items:flex-start}}`,
};

const text = {
  kn00001: 'Início', kn00002: 'Projetos', kn00003: 'Estúdio',
  kn0000e: 'Cada projeto parte do lugar: luz, orientação solar, paisagem e a maneira de viver de quem vai ocupar o espaço.',
  kn0000f: 'Do primeiro traço ao detalhe construtivo, arquitetura e interiores seguem uma mesma ideia.',
  kn0000k: 'Estúdio', kn0000l: 'Horizonte', kn0000n: 'Natureza', kn0000o: 'Case conceitual',
  kn0000q: 'Atuação', kn0000r: 'Arquitetura residencial, interiores e espaços integrados à paisagem.',
  kn0000u: 'Arquitetura que aproxima o cotidiano da paisagem. Luz natural, materiais honestos e espaços desenhados para serem vividos — do primeiro croqui ao encontro entre cada detalhe.',
  kn0000w: 'Princípios', kn0000x: 'O lugar', kn00013: 'O desenho',
  kn0000y: 'Luz e orientação<br><span class="g">A implantação começa pelo sol.</span>',
  kn0000z: 'Paisagem presente<br><span class="g">Jardins e interiores em diálogo.</span>',
  kn00010: 'Escala humana<br><span class="g">Espaços a partir do cotidiano.</span>',
  kn00014: 'Clareza espacial<br><span class="g">Circulações simples e ambientes conectados.</span>',
  kn00015: 'Materialidade<br><span class="g">Concreto, madeira, pedra e vidro.</span>',
  kn00016: 'Precisão<br><span class="g">Cuidado nos encontros e nas proporções.</span>',
  kn00017: 'Permanência<br><span class="g">Uma linguagem que atravessa o tempo.</span>',
  kn0001d: 'Da ideia ao espaço',
  kn0001e: '01 · Escuta', kn0001f: 'Ponto de partida', kn0001g: 'Rotina, desejos e necessidades',
  kn0001j: '02 · Contexto', kn0001k: 'Leitura do lugar', kn0001l: 'Luz, terreno e paisagem',
  kn0001o: '03 · Conceito', kn0001p: 'Estudo inicial', kn0001q: 'Volumes, planta e implantação',
  kn0001t: '04 · Projeto', kn0001u: 'Desenvolvimento', kn0001v: 'Materiais e soluções espaciais',
  kn0001y: '05 · Detalhe', kn0001z: 'Definição técnica', kn00020: 'Encontros, medidas e acabamentos',
  kn00023: '06 · Integração', kn00024: 'Visão de conjunto', kn00025: 'Arquitetura, interiores e jardim',
  kn00028: '07 · Diálogo', kn00029: 'Decisões claras', kn0002a: 'Desenhos, modelos e referências',
  kn0002d: '08 · Continuidade', kn0002e: 'Do papel ao espaço', kn0002f: 'Coerência em cada etapa',
  kn0002q: 'Croquis, modelos e conversas ajudam a encontrar o essencial. Testamos a implantação, o percurso da luz e a relação entre os ambientes antes de definir a forma.',
  kn0002w: 'Plantas, volumes e detalhes evoluem juntos. Concreto, madeira e vidro encontram proporção, textura e luz em uma arquitetura que faz sentido como conjunto.',
  kn00035: 'Residencial · conceito', kn0003d: 'Residencial · conceito', kn0003l: 'Interiores · conceito', kn0003t: 'Arquitetura · conceito',
  kn00041: 'Hospitalidade · conceito', kn00049: 'Paisagismo · conceito', kn0004h: 'Interiores · conceito', kn0004p: 'Materialidade · conceito',
  kn0004g: 'Estúdio Nexo', kn0004o: 'Detalhe Horizonte',
  kn00036: '01', kn0003e: '02', kn0003m: '03', kn0003u: '04', kn00042: '05', kn0004a: '06', kn0004i: '07', kn0004q: '08',
  kn0004u: 'Seleção de estudos conceituais · imagens ilustrativas',
  kn00055: 'Processo e<br>materialidade',
  kn00059: 'Concreto, madeira, luz e paisagem. Um vocabulário comum, muitas possibilidades de morar.',
  kn0005a: 'Estudos conceituais e imagens ilustrativas criados para este case da Avence Studio.',
  kn0005e: '01', kn0005f: 'Escutar e<br>compreender',
  kn0005h: '02', kn0005i: 'Explorar e<br>desenhar',
  kn0005k: '03', kn0005l: 'Desenvolver e<br>detalhar',
  kn0005n: '04', kn0005o: 'Integrar e<br>construir',
  kn00060: 'Processo', kn00062: 'Materialidade', kn00063: 'Explorar os projetos',
  kn0006e: 'Universo', kn00067: 'Luz natural', kn00068: 'Paisagem', kn00069: 'Materiais', kn0006a: 'Interiores', kn0006c: 'Arquitetura', kn0006d: 'Processo',
  kn0006k: 'Sobre este case',
  kn0006h: 'Horizonte é um estúdio fictício. Esta página explora uma linguagem de arquitetura residencial contemporânea.',
  kn0006j: 'Projetos conceituais e imagens ilustrativas, incluindo variações geradas por IA.',
  kn0006v: 'Horizonte · Arquitetura Estúdio', kn0006y: 'Case demonstrativo',
};

const lines = (...items) => items.map(item => `<span class="kn-ln"><span>${item}</span></span>`).join('');
CSS['kn-header'] += `selector .kn-hrow{display:flex;flex-direction:row;justify-content:space-between;width:100%}selector .kn-logo{flex:0 0 145px;width:145px}selector .kn-nav{margin-left:auto;width:auto;flex:0 1 auto;align-items:flex-start}@media(max-width:767px){selector .kn-logo{flex-basis:85px;width:85px}selector .kn-nav{max-width:220px}}`;
CSS['kn-about'] += `selector .kn-ab-bot{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));gap:24px}selector .kn-ach{grid-column:1/span 3;grid-row:1}selector .kn-awards{grid-column:4/span 6;grid-row:1}selector .kn-pubs{grid-column:10/span 6;grid-row:1}@media(max-width:1024px){selector .kn-ab-bot{display:flex;flex-direction:column;gap:30px}selector .kn-ab-bot>*{grid-row:auto}}`;
CSS['kn-people'] += `@media(max-width:767px){selector .kn-ph{width:14vw;margin:-7vw 0 0 -7vw;transform:rotate(var(--a)) translateY(-40vw) rotate(calc(-1 * var(--a)))}selector .kn-pp-stage{min-height:112vw!important}selector .kn-pp-center{max-width:61vw}}`;
CSS['kn-brands'] += `@media(max-width:767px){selector{height:auto;min-height:0;padding:68px 0 74px;display:flex;flex-direction:column;gap:36px}selector .kn-br-t{position:relative;inset:auto;order:0;padding:0 var(--m)}selector .kn-discs-w{position:relative;inset:auto;order:1;width:100%}selector .kn-discs{position:relative;inset:auto;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:0 var(--m)}selector .kn-disc{position:static;width:auto!important;height:auto!important;min-height:34px;padding:8px 14px;border-radius:2px}selector .kn-disc b{font-size:13px;padding:0;white-space:nowrap}}`;
const titles = {
  kn0001c: lines('Do primeiro traço ao último detalhe, uma arquitetura pensada como um todo.'),
  kn0002o: lines('Intuição para imaginar. Clareza para transformar a ideia em espaço.'),
  kn00030: lines('Projetos', 'selecionados <sup class="kn-serif">(08)</sup>'),
  kn00056: lines('Entre a matéria e a luz, o cuidado que dá forma ao cotidiano.'),
  kn00058: lines('Matéria,', 'luz e paisagem'),
  kn0005u: lines('Uma paleta', 'de materiais.', 'Infinitas', 'possibilidades.'),
};

/** Pure, deterministic refinement of the project's native nodes; IDs and pins survive. */
export function refineArchitectureSection(section) {
  const output = structuredClone(section);
  if (output.page !== 'teste') throw new Error('Este refinamento pertence somente à página teste.');
  function visit(node) {
    const s = node.settings ?? {};
    if (text[node.id] !== undefined) {
      if (node.widgetType === 'text-editor') s.editor = `<p>${text[node.id]}</p>`;
      else s.title = text[node.id];
    }
    if (titles[node.id]) s.title = titles[node.id];
    const cls = s.css_classes || s._css_classes || '';
    if (node.widgetType === 'image' && s.image) {
      s.image = { ...s.image, id: '', url: s.image.url, alt: s.image.alt || 'Estudo conceitual de arquitetura' };
      // Drop page-specific image URLs so the intended local asset is always rendered.
      delete s.image.url_mobile;
    }
    const replacements = {
      kn0000a: [architectureAssets.hero, 'Estudo conceitual: fachada de concreto, madeira e vidro integrada ao jardim'],
      kn0000h: [architectureAssets.detail, 'Luz natural sobre concreto aparente, brises de madeira e piso de pedra'],
      kn0002m: [architectureAssets.process, 'Croquis, planta e maquete de uma residência sobre a mesa de projeto'],
      kn0002u: [architectureAssets.detail, 'Encontro entre concreto, madeira e vidro no interior de uma residência'],
      kn00032: [architectureAssets.hero, 'Casa Chegada · estudo conceitual de arquitetura residencial'],
      kn0004e: ['/brands/avence-studio/criativos/arquitetura/nexo.webp', 'Estúdio Nexo · espaço de convivência com pé-direito duplo'],
      kn0004m: [architectureAssets.detail, 'Detalhe Horizonte · estudo de concreto, madeira, pedra e vidro'],
    };
    if (replacements[node.id]) {
      const [url, alt] = replacements[node.id];
      s.image = { id: '', url, alt, source: 'url', size: '' };
    }
    if (node.widgetType === 'image' && cls.includes('kn-pj-img')) {
      s.image.alt = s.image.alt.replace(/,.*$/, '').replace(/(?: · estudo conceitual de arquitetura)+$/, '') + ' · estudo conceitual de arquitetura';
    }
    if (cls.includes('kn-motion')) s.html = `<script>${architectureMotionScript}</script>`;
    if (node.id === 'kn00054') {
      const images = [architectureAssets.process, architectureAssets.detail, architectureAssets.hero,
        '/brands/avence-studio/criativos/arquitetura/patio.webp',
        '/brands/avence-studio/criativos/arquitetura/sala.webp',
        '/brands/avence-studio/criativos/arquitetura/vereda.webp',
        architectureAssets.detail, architectureAssets.process];
      s.html = `<div class="kn-orbit" aria-hidden="true">${images.map((url, i) => `<span class="kn-ph" style="--a:${i * 45}deg"><img src="${url}" alt="" loading="lazy" decoding="async"></span>`).join('')}</div>`;
    }
    if (node.id === 'kn0005t') {
      const materials = ['Concreto','Madeira','Pedra','Vidro','Luz','Textura','Sombra','Jardim','Terra','Água','Cal','Aço','Fibra','Areia','Argila','Trama','Ar'];
      let index = 0;
      s.html = s.html.replace(/<b>[^<]*<\/b>/g, () => `<b>${materials[index++]}</b>`);
    }
    if (node.id === 'kn00060') s.link.url = '#processo';
    if (['kn00062','kn00069'].includes(node.id)) s.link.url = '#materialidade';
    if (node.id === 'kn00063' || ['kn00067','kn00068','kn0006a','kn0006c'].includes(node.id)) s.link.url = '#projetos';
    if (node.id === 'kn0006d') s.link.url = '#processo';
    if (cls === 'kn-people') s._element_id = 'processo';
    if (cls === 'kn-brands') s._element_id = 'materialidade';
    if (cls === 'kn-about') s._element_id = 'sobre';
    if (s.custom_css && CSS[cls]) {
      // Reapplying is idempotent; subsequent manual edits before this marker survive.
      s.custom_css = s.custom_css.split('/* Horizonte refinement v1:')[0].trimEnd() + BASE + CSS[cls];
    }
    for (const child of node.elements || []) visit(child);
  }
  output.elements.forEach(visit);
  return output;
}
