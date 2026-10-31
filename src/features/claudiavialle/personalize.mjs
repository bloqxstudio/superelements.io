const ROOT = '/brands/claudia-vialle/';
const photo = name => ROOT + 'photos/' + name + '.webp';
const instagram = 'https://www.instagram.com/claudiaviallearquitetura/';
const whatsapp = 'https://wa.me/5541991660202';
const mail = 'mailto:claudia@vialle.arq.br';
const brand = `<span class="cv-brand"><img src="${ROOT}logo-avatar.jpg" width="42" height="42" alt="Símbolo oficial de Claudia Vialle"><span>Claudia Vialle<small>Arquitetura</small></span></span>`;
const lines = (...values) => values.map(value => `<span class="kn-ln"><span>${value}</span></span>`).join('');

const A_IMAGES = {
  kn0000a: ['instagram-00', 'Casa de Campo | AC · vista da piscina e fachada, publicada no Instagram'],
  kn0000h: ['instagram-03', 'Casa de Campo | AC · volumes em pedra e integração com a paisagem'],
  kn0002m: ['instagram-04', 'Casa de Campo | AC · textura da pedra e iluminação da fachada'],
  kn0002u: ['instagram-07', 'Apto | SL · marcenaria e iluminação da suíte'],
  kn00032: ['instagram-01', 'Casa de Campo | AC · acesso e implantação'],
  kn0003a: ['instagram-08', 'Apto | SL · ambiente de estar integrado à suíte'],
  kn0003i: ['instagram-10', 'Apto | SL · espaço de trabalho e marcenaria'],
};
const B_IMAGES = {
  tq0000e: ['instagram-02', 'Casa de Campo | AC · fachada em pedra e madeira'],
  tq0000g: ['ebs-03', 'Apto EBS · sala de jantar · fotografia Eduardo Macarios'],
  tq00014: ['ebs-00', 'Claudia Vialle · retrato divulgado por Club&Casa'],
  tq0001i: ['instagram-05', 'Casa de Campo | AC · vista lateral e iluminação'],
  tq0001o: ['instagram-09', 'Apto | SL · projeto de interiores da suíte'],
  tq0001u: ['ebs-02', 'Apto EBS · carvalho e estar · fotografia Eduardo Macarios'],
  tq0003l: ['instagram-06', 'Casa de Campo | AC · relação entre arquitetura e paisagem'],
  tq0003q: ['ebs-01', 'Apto EBS · sala de estar · fotografia Eduardo Macarios'],
  tq0003v: ['ebs-04', 'Apto EBS · arte e detalhes · fotografia Eduardo Macarios'],
};

const A_TEXT = {
  kn00005: brand, kn0005w: brand,
  kn0000b: lines('Claudia Vialle', 'Arquitetura'),
  kn0000d: lines('Arquitetura,', 'interiores e design'),
  kn0000e: 'Espaços que aproximam arquitetura, interiores e paisagem. Uma seleção do portfólio publicado por Claudia Vialle.',
  kn0000f: 'Materiais naturais, luz e atenção ao detalhe orientam a leitura visual desta apresentação do escritório.',
  kn0000k: 'Escritório', kn0000l: 'Claudia Vialle', kn0000n: 'Localização', kn0000o: 'Curitiba · Brasil',
  kn0000q: 'Atuação', kn0000r: 'Arquitetura, interiores e design de produto.',
  kn0000u: 'Entre a arquitetura, os interiores e o design de produto, Claudia Vialle apresenta um olhar atento à matéria, à luz e à experiência de viver os espaços.',
  kn0000w: 'O olhar', kn0000x: 'Arquitetura', kn00013: 'Interiores',
  kn0000y: 'Paisagem<br><span class="g">A relação entre o espaço e o seu entorno.</span>',
  kn0000z: 'Materialidade<br><span class="g">Pedra, madeira e luz nos projetos publicados.</span>',
  kn00010: 'Proporção<br><span class="g">Volumes e percursos em diálogo.</span>',
  kn00014: 'Acolhimento<br><span class="g">A escala do cotidiano.</span>',
  kn00015: 'Marcenaria<br><span class="g">Desenho integrado ao ambiente.</span>',
  kn00016: 'Iluminação<br><span class="g">Atmosferas e diferentes momentos do dia.</span>',
  kn00017: 'Design de produto<br><span class="g">Uma das frentes de atuação do escritório.</span>',
  kn0001c: lines('O espaço como encontro entre matéria, luz e a vida que acontece nele.'),
  kn0001d: 'Áreas de atuação',
  kn0001e: 'Arquitetura', kn0001f: 'O espaço', kn0001g: 'Contexto, implantação e paisagem',
  kn0001j: 'Interiores', kn0001k: 'O cotidiano', kn0001l: 'Ambientes, materiais e marcenaria',
  kn0001o: 'Design de produto', kn0001p: 'O detalhe', kn0001q: 'Objetos e relações com o espaço',
  kn0001t: 'Vamos conversar', kn0001u: 'Curitiba · Brasil', kn0001v: 'claudia@vialle.arq.br',
  kn0002l: lines('O lugar', 'inspira'),
  kn0002o: lines('A textura da pedra. A luz no fim do dia. O desenho da paisagem.'),
  kn0002p: 'Casa de Campo<br>AC',
  kn0002q: 'Nas imagens da Casa de Campo | AC, os volumes de pedra, a madeira e as aberturas se relacionam com o terreno e com a paisagem ao redor.',
  kn0002t: lines('O detalhe', 'aproxima'),
  kn0002w: 'No Apto | SL, a marcenaria, a iluminação e os tons neutros compõem os ambientes. Um olhar mais próximo revela as relações entre cada escolha e o conjunto.',
  kn00030: lines('Do portfólio', 'publicado <sup class="kn-serif">(03)</sup>'),
  kn00034: 'Casa de Campo | AC', kn00035: 'Arquitetura', kn00036: '01',
  kn0003c: 'Apto | SL · estar', kn0003d: 'Interiores', kn0003e: '02',
  kn0003k: 'Apto | SL · trabalho', kn0003l: 'Interiores', kn0003m: '03',
  kn0004u: 'Ver mais projetos no Instagram',
  kn00055: 'Matéria e<br>identidade',
  kn00056: lines('Arquitetura, interiores e design de produto. Um olhar que atravessa diferentes escalas.'),
  kn00058: lines('Matéria,', 'luz e identidade'),
  kn00059: 'Pedra, madeira, luz e paisagem nas referências publicadas pelo escritório.',
  kn0005a: 'Conheça mais do trabalho de Claudia Vialle no Instagram.',
  kn0005e: '01', kn0005f: 'Arquitetura', kn0005h: '02', kn0005i: 'Interiores',
  kn0005k: '03', kn0005l: 'Design de<br>produto', kn0005n: '04', kn0005o: 'Vamos<br>conversar',
  kn0005u: lines('Matéria.', 'Luz.', 'Identidade.'),
  kn00060: 'Escritório', kn00062: 'Contato', kn00063: 'Conversar no WhatsApp',
  kn0006e: 'Conexões', kn00067: 'Instagram', kn00068: 'Portfólio', kn00069: 'E-mail', kn0006a: 'WhatsApp', kn0006c: 'Curitiba · Brasil', kn0006d: 'Link da bio',
  kn0006k: 'Claudia Vialle', kn0006h: 'Arquitetura | Interiores | Design de produto<br>Curitiba · Brasil',
  kn0006j: 'claudia@vialle.arq.br<br>@claudiaviallearquitetura',
  kn0006u: 'VIALLE', kn0006v: 'Claudia Vialle Arquitetura', kn0006w: 'Proposta de apresentação · Avence Studio',
  kn0006x: 'Imagens: perfil público do escritório', kn0006y: 'Fontes e créditos no projeto',
};
const B_TEXT = {
  tq00002: brand, tq00043: brand,
  tq0000d: 'Claudia Vialle · Arquitetura e interiores',
  tq0000j: 'Claudia Vialle · arquitetura e interiores',
  tq0000q: '<span class="tq-rvl-w"><span class="tq-rvl-i">Claudia Vialle Arquitetura. Arquitetura, interiores e design de produto, em Curitiba, Brasil.</span></span>',
  tq0000r: '<span class="tq-rvl-w"><span class="tq-rvl-i">Uma seleção de projetos publicados pelo escritório, apresentada a partir da matéria, da luz e do cuidado com cada ambiente.</span></span>',
  tq0000t: 'Curitiba · Brasil', tq0000w: 'Arquitetura e interiores', tq0000z: 'Design de produto',
  tq0001f: 'CASA DE CAMPO | AC', tq0001g: 'Arquitetura · portfólio publicado',
  tq0001l: 'APTO | SL', tq0001m: 'Interiores · portfólio publicado',
  tq0001r: 'APTO EBS', tq0001s: 'Interiores · Balneário Camboriú',
  tq00025: 'ESCUTA E<br>CONCEITO', tq0002c: 'O ponto de partida é uma conversa sobre o espaço, as necessidades e as referências para o projeto.',
  tq0002g: 'ESTUDO E<br>PROJETO', tq0002n: 'As ideias ganham forma em estudos de arquitetura e interiores, com atenção à organização dos ambientes.',
  tq0002r: 'MATERIAIS E<br>DETALHES', tq0002y: 'Texturas, marcenaria e iluminação ajudam a construir a linguagem dos espaços.',
  tq00032: 'APRESENTAÇÃO<br>DO CONJUNTO', tq00039: 'Desenhos e imagens permitem compreender as relações entre as escolhas e o conjunto do projeto.',
  tq0003o: 'Casa de Campo | AC: arquitetura e paisagem', tq0003t: 'Apto EBS: materiais naturais e acolhimento', tq0003y: 'Apto EBS: arte no cotidiano',
  tq0003n: 'Do perfil do escritório', tq0003s: 'Fotografia · Eduardo Macarios', tq0003x: 'Fotografia · Eduardo Macarios',
  tq00046: 'Vamos conversar sobre o seu projeto?',
  tq0004g: '<span class="tq-rl"><span class="tq-rl-in"><span>claudia@vialle.arq.br</span><span aria-hidden="true">claudia@vialle.arq.br</span><span aria-hidden="true">claudia@vialle.arq.br</span></span></span>',
  tq0004i: '<span class="tq-rl"><span class="tq-rl-in"><span>WhatsApp</span><span aria-hidden="true">WhatsApp</span><span aria-hidden="true">WhatsApp</span></span></span>',
  tq0004m: 'VIALLE', tq0004n: 'Claudia Vialle Arquitetura · proposta de apresentação',
  tq0004o: 'Apto EBS: fotos Eduardo Macarios / Club&Casa · demais fotos: perfil do escritório · apresentação Avence Studio',
};

const sharedCSS = `
/* Claudia Vialle: observed monochrome mark; warm neutral proposal palette. */
selector{--ink:#141414;--paper:#f1f0eb;--line:#1414142b}
selector .cv-brand{display:flex;align-items:center;gap:12px;line-height:1.05;text-transform:none;font-family:'Inter Tight',Arial,sans-serif;letter-spacing:-.01em;font-stretch:normal;white-space:nowrap}
selector .cv-brand img{display:block;width:42px!important;height:42px!important;object-fit:contain;flex:none}
selector .cv-brand>span{display:block;font-size:20px;font-weight:400}
selector .cv-brand small{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-top:5px;font-weight:400}
selector .cv-contact{display:inline-flex;align-items:center;min-height:48px;border-bottom:1px solid currentColor;font:400 17px/1.4 'Inter Tight',sans-serif;padding:10px 0}
selector .cv-credit{font-size:12px;line-height:1.5}
@media(max-width:767px){selector .cv-brand{gap:9px}selector .cv-brand img{width:34px!important;height:34px!important}selector .cv-brand>span{font-size:17px}selector .cv-brand small{font-size:9px}}
`;

const stageLabels = ['Escuta e conceito','Estudo e projeto','Materiais e detalhes','Apresentação'];
function diagram(index) {
  const drawings = [
    '<path d="M70 60h150v130H70zM115 60v130M70 118h150M115 118h65v72"/><path d="M82 92h20m-10-10v20M140 88h52M140 98h36"/>',
    '<path d="m70 150 80-45 85 45-80 45zM70 150V80l80-45 85 45v70M150 35v70M70 80l85 45 80-45M155 125v70"/>',
    '<path d="M65 55h95v95H65zM140 100h95v95h-95zM83 73h59v59H83zM160 120h55v55h-55z"/><path d="M65 170h55m-55 12h55M180 55h55m-55 12h55"/>',
    '<path d="M58 60h184v125H58zM58 85h184M150 85v100M73 105h60v55H73zM170 106h53m-53 15h40m-40 15h53M120 205h60M150 185v20"/>',
  ];
  return `<svg viewBox="0 0 300 240" role="img" aria-label="Diagrama ilustrativo: ${stageLabels[index]}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square">${drawings[index]}</g><text x="20" y="222" fill="currentColor" font-family="Arial,sans-serif" font-size="9" letter-spacing="2">${String(index+1).padStart(2,'0')} / ESTUDO DO ESPAÇO</text></svg>`;
}

/** Build a separate personalized page from its latest source; originals stay independent. */
export function personalize(section, variant) {
  const editorial = variant === 'editorial';
  const output = structuredClone(section);
  delete output.id;
  output.page = editorial ? 'Claudia Vialle · Editorial' : 'Claudia Vialle · Case 2';
  output.data = { sourceId: `cv-${variant}-${section.position}` };
  const texts = editorial ? A_TEXT : B_TEXT;
  const pictures = editorial ? A_IMAGES : B_IMAGES;
  const remove = new Set(editorial ? ['kn00022','kn00027','kn0002c','kn0002h','kn0003x','kn00045','kn0004d','kn0004l','kn0004t'] : []);
  const visit = node => {
    const oldId = node.id;
    const s = node.settings || {};
    delete s._se_component;
    if (texts[oldId] !== undefined) {
      if (node.widgetType === 'text-editor') s.editor = `<p>${texts[oldId]}</p>`;
      else s.title = texts[oldId];
    }
    if (pictures[oldId]) {
      const [name,alt] = pictures[oldId];
      s.image = { id:'',url:photo(name),alt,source:'url',size:'' };
    }
    if (editorial && oldId === 'kn00054') {
      s.html = `<div class="kn-orbit" aria-hidden="true">${['Luz','Pedra','Madeira','Paisagem','Escala','Textura','Detalhe','Design'].map((text,i)=>`<span class="kn-ph cv-orbit-word" style="--a:${i*45}deg"><b>${text}</b></span>`).join('')}</div>`;
    }
    if (!editorial && ['tq0002a','tq0002l','tq0002w','tq00037'].includes(oldId)) {
      const index = ['tq0002a','tq0002l','tq0002w','tq00037'].indexOf(oldId);
      node.widgetType='html';
      node.settings={_css_classes:'cv-process-diagram',html:diagram(index)};
    }
    if (s.html?.includes('tq-process-controls')) {
      ['Projeto arquitetônico','Interiores','Renderização','Definição técnica'].forEach((old,i)=>s.html=s.html.replace(`</span> ${old}</button>`,`</span> ${stageLabels[i]}</button>`));
    }
    if (s.html?.includes('<form')) s.html=`<a class="cv-contact" href="${whatsapp}" target="_blank" rel="noopener">Conversar sobre um projeto ↗</a>`;
    if (s.link?.url) {
      if (s.link.url.includes('horizonte.exemplo')) s.link.url=mail;
      if (['kn0004u','kn00067','kn00068','tq0004h'].includes(oldId)) s.link.url=instagram;
      if (['kn00063','kn0006a','tq0004i'].includes(oldId)) s.link.url=whatsapp;
      if (['kn00069','kn0006d','tq0004g'].includes(oldId)) s.link.url=mail;
      if (['kn0006c'].includes(oldId)) s.link.url='#contato';
    }
    if (['tq00009','tq00044'].includes(oldId)) s.title='<span class="on">PT</span>';
    if (s.html) s.html=s.html.replaceAll('HORIZONTE','CLAUDIA VIALLE').replaceAll('Horizonte','Claudia Vialle');
    if (s.custom_css) {
      s.custom_css=s.custom_css.replaceAll('#dfdddc','#f1f0eb').replaceAll('#d9d4c2','#ebe7dc').replaceAll('#151713','#151515')+sharedCSS;
      const cls=s.css_classes||s._css_classes;
      if(cls==='kn-header')s.custom_css+='selector .kn-logo{flex-basis:245px;width:245px}selector .kn-nav{margin-left:auto}@media(max-width:767px){selector .kn-logo{flex-basis:180px;width:180px}selector .kn-hrow{gap:12px}selector .kn-nav{gap:8px;max-width:130px}}';
      if(cls==='kn-hero')s.custom_css+='selector .kn-hero-img img{object-position:50% 50%}selector .kn-hero-t .elementor-heading-title{font-size:clamp(40px,7vw,128px)}';
      if(cls==='kn-projects')s.custom_css+='selector{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;padding:50px var(--m) 90px}selector .kn-pj-head,selector .kn-pj-all{grid-column:1/-1}selector .kn-pj{position:relative;inset:auto;grid-column:auto!important;width:100%!important;margin:0!important;padding:0!important}selector .kn-pj-ph{height:38vw;max-height:590px}selector .kn-pj-meta{display:flex;flex-direction:column;align-items:flex-start;gap:8px}selector .kn-pj-r{width:100%;justify-content:space-between}@media(max-width:767px){selector{grid-template-columns:1fr;gap:38px}selector .kn-pj-ph{height:112vw;max-height:none}}';
      if(cls==='kn-people')s.custom_css+='selector .cv-orbit-word{display:flex!important;align-items:center;justify-content:center;background:#ece8df;color:#151515;opacity:.9}selector .cv-orbit-word b{font:400 clamp(11px,1.2vw,18px)/1.2 "Inter Tight",Arial;text-align:center;padding:4px}';
      if(cls==='kn-footer')s.custom_css+='selector .kn-giant .elementor-heading-title{font-size:25vw}';
      if(cls==='tq-header')s.custom_css+='selector .tq-logo .elementor-heading-title{font-stretch:normal;white-space:normal}selector .tq-logo{flex-basis:280px;width:280px}@media(max-width:1024px){selector .tq-logo{flex-basis:auto;width:auto}}';
      if(cls==='tq-studio')s.custom_css+='selector .tq-st-img img{filter:none;object-position:50% 35%}';
      if(cls==='tq-proc')s.custom_css+='selector .cv-process-diagram,selector .cv-process-diagram .elementor-widget-container{width:100%;height:100%}selector .cv-process-diagram svg{width:100%;height:100%;display:block;background:#e6e3da;color:#292824;transition:transform .4s}selector .tq-step:hover .cv-process-diagram svg{transform:scale(1.025)}@media(prefers-reduced-motion:reduce){selector .tq-step:hover .cv-process-diagram svg{transform:none}}';
      if(cls==='tq-footer')s.custom_css+='selector .tq-giant .elementor-heading-title{font-size:21vw;letter-spacing:-.04em}selector .tq-legal{flex-wrap:wrap;gap:16px}';
    }
    node.elements=(node.elements||[]).filter(child=>!remove.has(child.id));
    node.elements.forEach(visit);
    node.id=(editorial?'cva':'cvb')+oldId;
  };
  output.elements.forEach(visit);
  if(editorial){
    const renamed={3:'Arquitetura, interiores e design',5:'Áreas de atuação',6:'Matéria, luz e cotidiano',7:'Do portfólio publicado',9:'Matéria e identidade',10:'Vocabulário visual'};
    output.title=renamed[section.position]||section.title;
  }
  return output;
}
