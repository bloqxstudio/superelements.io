import { processControls, processCSS, hoverCSS } from './case2-interactions.mjs';
/** Exclusive art direction for the second commercial architecture demonstration. */
const base = '/brands/avence-studio/criativos/arquitetura/case-2/';
export const case2Images = {
  tq0000e: ['hero-casa-areia', 'Casa Areia: entrada em reboco claro e madeira, integrada ao jardim'],
  tq0000g: ['hero-interior-areia', 'Casa Areia: sala em pedra clara e madeira aberta para o pátio'],
  tq00014: ['estudio', 'Estúdio de arquitetura com mesa de desenho, maquete e biblioteca de materiais'],
  tq0001i: ['projeto-areia', 'Casa Areia: fachada do jardim com espelho de água e volumes claros'],
  tq0001o: ['projeto-patio-oliva', 'Pátio Oliva: casa em terra compactada e madeira ao redor de uma oliveira'],
  tq0001u: ['projeto-casa-brisa', 'Casa Brisa: pavilhão de madeira leve entre vegetação costeira'],
  tq0002a: ['processo-maquete', 'Maquete física de uma casa-pátio, em papel e madeira clara'],
  tq0002l: ['processo-materiais', 'Paleta de travertino, carvalho, reboco claro, linho e vidro texturizado'],
  tq0002w: ['processo-render', 'Visualização conceitual de um pavilhão com abertura zenital e jardim'],
  tq00037: ['processo-detalhe', 'Detalhe de encontro entre reboco, esquadria de carvalho e peitoril de pedra'],
  tq0003l: ['caderno-luz', 'Luz zenital sobre a parede curva de uma escada'],
  tq0003q: ['caderno-patio', 'Pátio arborizado com samambaias, pedra clara e janela recuada de madeira'],
  tq0003v: ['caderno-escada', 'Escada de travertino, corrimão de madeira e vidro texturizado'],
};
const captions = {
  tq0000j: 'Casa Areia · arquitetura e interiores',
  tq0001f: 'CASA AREIA', tq0001g: 'Residencial · estudo conceitual',
  tq0001l: 'PÁTIO OLIVA', tq0001m: 'Casa-pátio · estudo conceitual',
  tq0001r: 'CASA BRISA', tq0001s: 'Residencial · estudo conceitual',
  tq0003o: 'Luz natural como ponto de partida do projeto',
  tq0003t: 'O pátio como encontro entre a casa e o jardim',
  tq0003y: 'Pedra e madeira: o cuidado nos encontros',
  tq0004n: '© 2026 Horizonte · case conceitual da Avence Studio · imagens ilustrativas',
};

export function refineCase2(section) {
  if (section.page !== 'Case 2') throw new Error('Este código pertence apenas à página Case 2.');
  const result = structuredClone(section);
  const walk = node => {
    const s = node.settings || {};
    const image = case2Images[node.id];
    if (image) s.image = { id: '', url: base + image[0] + '.webp', alt: image[1] + ' · imagem conceitual', source: 'url', size: '' };
    if (captions[node.id]) s.title = captions[node.id];
    // These are studio notes rather than claims of third-party press coverage.
    if (s.title) s.title = s.title.replaceAll('Imprensa', 'Caderno').replaceAll('IMPRENSA', 'CADERNO');
    const cls = s.css_classes || s._css_classes;
    // Replace the previous vertical pin/translate timeline with an independently
    // scrollable native region. This also works without GSAP and in reduced motion.
    if (node.widgetType === 'html' && cls?.includes('tq-motion')) {
      s.html = s.html.replace(/    \/\/ Processo: pina e leva as etapas para o lado[\s\S]*?(?=    \/\/ Imprensa)/, '    // Processo: native horizontal scrolling and accessible controls.\n\n');
    }
    if (cls === 'tq-proc-in') {
      const existing = node.elements.find(child => child.id === 'tqproccontrols');
      if (existing) existing.settings.html = processControls;
      else node.elements.splice(1, 0, { id: 'tqproccontrols', elType: 'widget', widgetType: 'html', isInner: false, settings: { _css_classes: 'tq-process-ui', html: processControls }, elements: [] });
    }
    const crops = {
      'tq-header': 'selector .tq-bar{width:100%;display:flex;align-items:center;justify-content:space-between;gap:28px}selector .tq-logo{flex:0 0 270px;width:270px}selector .tq-nav{position:static!important;left:auto!important;transform:none!important;width:auto!important;gap:32px;margin-left:auto;margin-right:auto}selector .tq-loc{flex:0 0 auto;width:auto}@media(max-width:1024px){selector .tq-logo{flex:0 1 auto;width:auto}selector .tq-nav,selector .tq-loc{display:none!important}selector .tq-mobile{margin-left:auto}}',
      'tq-hero': 'selector .tq-bg img{object-position:50% 50%}@media(max-width:767px){selector .tq-bg img{object-position:53% 50%}}',
      'tq-studio': 'selector .tq-studio-ph img{object-position:50% 50%}',
      'tq-projects': 'selector .tq-pj-img img{object-position:50% 50%}',
      'tq-press': 'selector .tq-pr-ph img{object-position:50% 50%}',
      'tq-proc': processCSS,
    };
    if (s.custom_css && node === result.elements[0]) {
      const mobile = '@media(max-width:767px){selector .tq-t .elementor-heading-title{display:block!important;font-size:clamp(30px,8.2vw,40px);line-height:1.1}selector .tq-t .tq-w{display:block;max-width:100%}selector .tq-t .tq-w>span{max-width:100%}}@media(prefers-reduced-motion:reduce){selector .tq-bg-b{display:none}}';
      s.custom_css = s.custom_css.split('/* Case 2 exclusive imagery */')[0].trimEnd() + '\n/* Case 2 exclusive imagery */\n' + (crops[cls] || '') + mobile + hoverCSS;
    }
    for (const child of node.elements || []) walk(child);
  };
  result.elements.forEach(walk);
  return result;
}
