/**
 * Página "Proposta (anúncios)" do Avence Studio (2026-10-22): a página das campanhas do
 * Google Ads e do Instagram, com um formulário em quatro etapas que filtra o lead antes
 * de ele chegar à equipe. O usuário: "estamos recebendo muitos leads ruins e queremos
 * filtrar, pedindo alguns dados antes de salvar o lead no sistema".
 *
 * Decisões do usuário (2026-10-22): o lead vai pelo e-mail do formulário do WordPress
 * (sem CRM por enquanto); quem não passa no filtro também chega, marcado "Não qualificado"
 * no assunto e sem o botão do WhatsApp; as perguntas cobrem o negócio e o site atual, o
 * anúncio e a verba, o investimento no site, quem decide e o prazo; a conversão do
 * Google Ads e o Lead do pixel da Meta disparam só para o lead qualificado.
 *
 * O formulário é o nativo do Elementor Pro. Sem script, é um formulário longo com os
 * títulos das etapas, e o e-mail chega "Sem classificação". O script (um widget só de
 * comportamento, primeiro filho da abertura) divide as etapas, confere cada uma, guarda a
 * origem (UTM, gclid, fbclid), dá a nota e preenche os campos escondidos antes do envio;
 * depois do envio, mostra o resultado certo e dispara a conversão.
 */
import { AV, AV_CONTACT, AV_SERIF_CSS } from './tokens'

type Kind = 'out' | 'soft'

/** As perguntas, na ordem do formulário. As opções são o valor que chega no e-mail; `short` vai na mensagem do WhatsApp. */
export const LP_QUESTIONS = {
  negocio: {
    label: 'O que o seu negócio faz?',
    short: 'Negócio',
    options: [
      'Atende com hora marcada (saúde, advocacia, estética, contabilidade…)',
      'Presta outro serviço para clientes da região',
      'Vende pela internet (loja virtual)',
      'Ainda vou abrir o negócio',
    ],
  },
  site: { label: 'Vocês já têm site?', short: 'Site', options: ['Sim', 'Só Instagram', 'Ainda não'] },
  anuncio: {
    label: 'Quanto vocês investem por mês em anúncios no Google ou no Instagram?',
    short: 'Anúncios por mês',
    options: ['Ainda não anunciamos', 'Até R$ 500', 'De R$ 500 a R$ 2.000', 'Mais de R$ 2.000'],
  },
  investimento: {
    label: 'Quanto você pensa em investir no site? (valor único)',
    short: 'Investimento no site',
    options: ['Até R$ 500', 'De R$ 500 a R$ 1.500', 'De R$ 1.500 a R$ 3.000', 'Mais de R$ 3.000'],
  },
  decisao: { label: 'Quem decide sobre o site?', short: 'Quem decide', options: ['Eu decido (dono ou sócio)', 'Decido junto com outra pessoa', 'Outra pessoa decide'] },
  prazo: { label: 'Quando você quer começar?', short: 'Começar', options: ['Este mês', 'Nos próximos 3 meses', 'Só estou pesquisando'] },
} as const
type Question = keyof typeof LP_QUESTIONS

/**
 * O filtro (a partir de `brands/avence-studio/CLIENTE-IDEAL.md` §1, "Quem não é, por agora").
 * `out` reprova sozinho; `soft` tira 25 pontos da nota, e dois `soft` reprovam.
 * Os limites são decisão do studio: mude aqui e grave a seção de novo.
 */
export const LP_RULES: Array<{ field: Question; option: number; kind: Kind; reason: string }> = [
  { field: 'negocio', option: 2, kind: 'out', reason: 'Loja virtual' },
  { field: 'negocio', option: 3, kind: 'soft', reason: 'Negócio ainda não aberto' },
  { field: 'anuncio', option: 0, kind: 'soft', reason: 'Não anuncia' },
  // o padrão do funil é R$ 1.000 (configurações da Prospecção)
  { field: 'investimento', option: 0, kind: 'out', reason: 'Investimento até R$ 500' },
  { field: 'decisao', option: 2, kind: 'soft', reason: 'Não é quem decide' },
  { field: 'prazo', option: 2, kind: 'soft', reason: 'Só pesquisando' },
]

/**
 * Conversões. `google` é o `send_to` da conversão do Google Ads ("AW-…/…"), que ainda não
 * existe (pendência no COPY.md): sem ele, o script só põe o evento no dataLayer, e o Tag
 * Manager pode disparar a conversão com o gatilho `lead_qualificado`. O Lead da Meta só
 * dispara se o pixel estiver no site.
 */
export const LP_CONVERSION = { google: '' }

/** Etapas: título e os campos de cada uma (os campos de contato ficam na última). */
export const LP_STEPS: Array<{ title: string; fields: string[] }> = [
  { title: 'O negócio', fields: ['negocio', 'site', 'endereco'] },
  { title: 'Os números', fields: ['anuncio', 'investimento'] },
  { title: 'A decisão', fields: ['decisao', 'prazo'] },
  { title: 'Seu contato', fields: ['nome', 'whatsapp', 'empresa'] },
]

/** Campos escondidos: o script preenche antes do envio; sem script, ficam com o valor padrão. */
export const LP_HIDDEN: Array<[string, string]> = [
  ['qualificacao', 'Sem classificação'],
  ['motivo', ''],
  ['nota', ''],
  ['origem', ''],
  ['utm_source', ''],
  ['utm_medium', ''],
  ['utm_campaign', ''],
  ['utm_term', ''],
  ['utm_content', ''],
  ['gclid', ''],
  ['fbclid', ''],
  ['pagina', ''],
]

type FormField = Record<string, unknown>

const field = (id: string, type: string, label: string, extra: FormField = {}): FormField => ({
  _id: id, custom_id: id, field_type: type, field_label: label, placeholder: '', required: '', width: '100', width_mobile: '100', ...extra,
})

const radio = (id: Question): FormField => field(id, 'radio', LP_QUESTIONS[id].label, {
  field_options: LP_QUESTIONS[id].options.join('\n'), required: 'true',
})

const stepHead = (n: number) => field(`etapa${n + 1}`, 'html', '', {
  field_html: `<p class="lp-step"><span class="lp-step-n">${n + 1} de ${LP_STEPS.length}</span><span class="lp-step-t">${LP_STEPS[n].title}</span></p>`,
})

/** Os campos do formulário, na ordem: título da etapa, perguntas, contato, escondidos e o anti-robô. */
export const lpFields = (): FormField[] => [
  stepHead(0),
  radio('negocio'),
  radio('site'),
  field('endereco', 'text', 'Endereço do site', { placeholder: 'seunegocio.com.br' }),
  stepHead(1),
  radio('anuncio'),
  radio('investimento'),
  stepHead(2),
  radio('decisao'),
  radio('prazo'),
  stepHead(3),
  field('nome', 'text', 'Seu nome', { placeholder: 'Nome e sobrenome', required: 'true', width: '50' }),
  field('whatsapp', 'tel', 'WhatsApp com DDD', { placeholder: '(51) 99999-9999', required: 'true', width: '50' }),
  field('empresa', 'text', 'Nome do negócio', { placeholder: 'Opcional' }),
  ...LP_HIDDEN.map(([id, value]) => field(id, 'hidden', id, { field_value: value })),
  field('anti_robo', 'honeypot', ''),
]

/** Assunto e corpo do e-mail: a classificação vem primeiro, para a equipe ver na caixa de entrada. */
export const LP_EMAIL = {
  subject: '[field id="qualificacao"] · Proposta (anúncio) · [field id="nome"]',
  content: [
    'Classificação: [field id="qualificacao"]',
    'Motivo: [field id="motivo"]',
    'Nota: [field id="nota"]',
    'Origem: [field id="origem"] · campanha: [field id="utm_campaign"]',
    '',
    '[all-fields]',
  ].join('\n'),
}

/** O visual do formulário: opções em linhas para tocar, etapas, erros e navegação. */
export const LP_FORM_CSS = [
  'selector .elementor-field-type-hidden,selector .elementor-field-type-honeypot{display:none!important}',
  'selector .elementor-field-group .elementor-field-textual{padding:12px 14px;min-height:0;line-height:1.5;border-style:solid}',
  `selector .elementor-field-textual::placeholder{color:${AV.muted};opacity:1}`,
  `selector .elementor-field-textual:focus{border-color:${AV.blue};outline:2px solid ${AV.blue};outline-offset:1px;box-shadow:none}`,
  // título da etapa: o número na serifada itálica azul e o nome da etapa
  'selector .elementor-field-type-html{margin-bottom:0}',
  `selector .elementor-field-type-html{flex-basis:100%;max-width:100%}selector .lp-step{display:flex;align-items:baseline;gap:12px;width:100%;margin:0;padding:0 0 14px;border-bottom:1px solid ${AV.line}}`,
  `selector .lp-step-n{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:22px;line-height:1;color:${AV.blue}}`,
  `selector .lp-step-t{font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${AV.ink}}`,
  // as etapas 2 a 4 têm um respiro em cima quando o formulário é longo (sem script)
  'selector .elementor-field-group-etapa2,selector .elementor-field-group-etapa3,selector .elementor-field-group-etapa4{margin-top:18px}',
  'html.lp-live selector .elementor-field-group-etapa2,html.lp-live selector .elementor-field-group-etapa3,html.lp-live selector .elementor-field-group-etapa4{margin-top:0}',
  // as opções: uma por linha, com o quadrado azul quando marcada; o rádio continua lá para o teclado e o leitor de tela
  'selector .elementor-field-subgroup{display:grid;grid-template-columns:1fr;gap:8px;margin:0;padding:0;width:100%}',
  'selector .elementor-field-group-site .elementor-field-subgroup,selector .elementor-field-group-anuncio .elementor-field-subgroup,selector .elementor-field-group-investimento .elementor-field-subgroup,selector .elementor-field-group-prazo .elementor-field-subgroup{grid-template-columns:repeat(2,minmax(0,1fr))}',
  'selector .elementor-field-group-site .elementor-field-subgroup{grid-template-columns:repeat(3,minmax(0,1fr))}',
  'selector .elementor-field-option{position:relative;display:flex;margin:0!important;padding:0!important;width:100%}',
  'selector .elementor-field-option input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}',
  `selector .elementor-field-option label{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;margin:0!important;padding:11px 14px;border:1px solid ${AV.line};background:${AV.white};color:${AV.ink};font-size:15px;font-weight:500;line-height:1.35;letter-spacing:0;text-transform:none;cursor:pointer}`,
  `selector .elementor-field-option label::before{content:"";width:12px;height:12px;flex:none;border:1px solid ${AV.muted};background:${AV.white}}`,
  `selector .elementor-field-option label:hover{border-color:${AV.ink}}`,
  `selector .elementor-field-option input:checked+label{border-color:${AV.blue};background:${AV.blueMist};color:${AV.ink}}`,
  `selector .elementor-field-option input:checked+label::before{border-color:${AV.blue};background:${AV.blue}}`,
  `selector .elementor-field-option input:focus-visible+label{outline:2px solid ${AV.blue};outline-offset:2px}`,
  `selector .elementor-button:focus-visible{outline:2px solid ${AV.blue};outline-offset:3px}`,
  'selector .e-form__buttons{margin-top:6px}',
  // com o script: só a etapa atual aparece
  'html.lp-live selector .lp-off{display:none!important}',
  `selector .lp-err{display:block;width:100%;margin-top:8px;color:#b42318;font-size:13px;font-weight:500}`,
  `selector .lp-invalid .elementor-field-option label,selector .lp-invalid .elementor-field-textual{border-color:#b42318}`,
  // navegação entre as etapas (o script põe os botões)
  'selector .lp-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin-top:8px}',
  `selector .lp-back{appearance:none;border:0;background:none;padding:10px 0;color:${AV.muted};font:inherit;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}`,
  `selector .lp-back:hover{color:${AV.ink}}selector .lp-back[hidden]{display:inline-block!important;visibility:hidden}`,
  `selector .lp-next{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:52px;padding:17px 24px;border:1px solid ${AV.blue};border-radius:0;background:${AV.blue};color:${AV.white};font:inherit;font-size:12.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}`,
  `selector .lp-next:hover{background:${AV.ink};border-color:${AV.ink};color:${AV.paper}}`,
  `selector .lp-back:focus-visible,selector .lp-next:focus-visible{outline:2px solid ${AV.blue};outline-offset:3px}`,
  '@media(prefers-reduced-motion:no-preference){selector .elementor-field-textual,selector .elementor-field-option label,selector .lp-next{transition:border-color 180ms ease,background-color 180ms ease,color 180ms ease}selector .lp-now{animation:lpIn .35s cubic-bezier(.22,1,.36,1)}@keyframes lpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}',
  // no celular: uma opção por linha, e o Continuar na largura toda com o Voltar embaixo
  '@media(max-width:767px){selector .elementor-field-group{width:100%}selector .elementor-field-group-site .elementor-field-subgroup,selector .elementor-field-group-anuncio .elementor-field-subgroup,selector .elementor-field-group-investimento .elementor-field-subgroup,selector .elementor-field-group-prazo .elementor-field-subgroup{grid-template-columns:1fr}selector .elementor-field-option label{font-size:15px}selector .lp-nav{flex-direction:column-reverse;align-items:stretch;gap:4px}selector .lp-back[hidden]{display:none!important}selector .lp-back{text-align:center}}',
].join('')

/**
 * O comportamento do formulário (widget HTML só de comportamento). Roda também com menos
 * movimento (só as transições somem); no editor do Elementor não roda, e lá o formulário
 * fica inteiro, com os dois resultados à vista para editar.
 */
export const lpScript = () => {
  const rules = LP_RULES.map((r) => [r.field, LP_QUESTIONS[r.field].options[r.option], r.kind, r.reason])
  const labels = Object.fromEntries(Object.entries(LP_QUESTIONS).map(([k, q]) => [k, q.short]))
  return `<script>(function(){
var d=document.documentElement;if(d.dataset.lpForm)return;d.dataset.lpForm='1';
if(!document.querySelector('link[href*="Instrument+Serif"]')){var l=document.createElement('link');l.rel='stylesheet';l.href=${JSON.stringify(AV_SERIF_CSS)};document.head.appendChild(l)}
var RULES=${JSON.stringify(rules)},LABELS=${JSON.stringify(labels)},CONV=${JSON.stringify(LP_CONVERSION)};
var WA=${JSON.stringify(AV_CONTACT.whatsapp)},SITE_YES=${JSON.stringify(LP_QUESTIONS.site.options[0])};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function store(k,v){try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){return null}}
/* origem: a primeira visita da sessão vale (UTM, gclid, fbclid) */
var KEYS=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'];
var q=new URLSearchParams(location.search),src={};
KEYS.forEach(function(k){var v=q.get(k);if(v)src[k]=v.slice(0,200)});
if(q.get('gbraid')||q.get('wbraid'))src.gclid=src.gclid||q.get('gbraid')||q.get('wbraid');
if(Object.keys(src).length)store('lp-src',JSON.stringify(src));else{try{src=JSON.parse(store('lp-src')||'{}')||{}}catch(e){src={}}}
function origin(){var s=(src.utm_source||'').toLowerCase();
 if(src.gclid||/google|adwords/.test(s))return 'Google Ads';
 if(src.fbclid||/^(ig|instagram|facebook|fb|meta)/.test(s))return 'Instagram (Meta)';
 if(s)return s;var r=document.referrer;try{if(r&&new URL(r).host!==location.host)return 'Link: '+new URL(r).host}catch(e){}
 return 'Direto'}
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn()}
ready(function(){if(document.body.classList.contains('elementor-editor-active'))return;
 [].forEach.call(document.querySelectorAll('.lp-form'),setup)});
function setup(widget){
 var form=widget.querySelector('form');if(!form||form.dataset.lp)return;form.dataset.lp='1';
 var card=widget.closest('.lp-card')||widget.parentNode,wrap=form.querySelector('.elementor-form-fields-wrapper')||form;
 var groups=[].slice.call(wrap.children).filter(function(g){return g.classList.contains('elementor-field-group')});
 var submitG=groups.filter(function(g){return g.classList.contains('elementor-field-type-submit')||g.classList.contains('e-form__buttons')})[0];
 var steps=[];groups.forEach(function(g){if(g===submitG||/elementor-field-type-(hidden|honeypot)/.test(g.className))return;
  if(g.querySelector('.lp-step'))steps.push({head:g,items:[]});else if(steps.length)steps[steps.length-1].items.push(g)});
 if(steps.length<2)return;
 d.classList.add('lp-live');
 function group(id){return form.querySelector('.elementor-field-group-'+id)}
 function answer(id){var g=group(id);if(!g)return '';var r=g.querySelector('input:checked');
  if(r){var v=r.value;if(!v||v==='on'){var lb=g.querySelector('label[for="'+r.id+'"]');v=lb?lb.textContent:''}return v.trim()}
  var t=g.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,select');return t?t.value.trim():''}
 function setHidden(id,v){var el=form.querySelector('#form-field-'+id)||form.querySelector('[name="form_fields['+id+']"]');if(el)el.value=v}
 function judge(){var out=[],soft=[];RULES.forEach(function(r){if(answer(r[0])===r[1])(r[2]==='out'?out:soft).push(r[3])});
  var ok=!out.length&&soft.length<2;return {ok:ok,reasons:out.concat(soft),score:out.length?0:Math.max(0,100-soft.length*25)}}
 function fill(){var j=judge();
  setHidden('qualificacao',j.ok?'Qualificado':'Não qualificado');setHidden('motivo',j.reasons.join('; ')||'Nenhum');setHidden('nota',j.score+'/100');
  setHidden('origem',origin());KEYS.forEach(function(k){setHidden(k,src[k]||'')});setHidden('pagina',location.origin+location.pathname);return j}
 /* o endereço do site só aparece para quem tem site */
 function conditional(){var g=group('endereco');if(g)g.classList.toggle('lp-skip',answer('site')!==SITE_YES)}
 /* navegação */
 var nav=document.createElement('div');nav.className='lp-nav elementor-field-group elementor-column elementor-col-100';
 var back=document.createElement('button');back.type='button';back.className='lp-back';back.textContent='← Voltar';
 var next=document.createElement('button');next.type='button';next.className='lp-next';next.textContent='Continuar';
 nav.appendChild(back);nav.appendChild(next);wrap.appendChild(nav);
 var bar=card.querySelector('.lp-progress-fill'),i=0;
 function show(n,focus){i=n;steps.forEach(function(s,k){[s.head].concat(s.items).forEach(function(g){g.classList.toggle('lp-off',k!==n);g.classList.toggle('lp-now',k===n)})});
  conditional();[].forEach.call(form.querySelectorAll('.lp-skip'),function(g){g.classList.add('lp-off')});
  var last=n===steps.length-1;if(submitG)submitG.classList.toggle('lp-off',!last);next.hidden=last;next.style.display=last?'none':'';back.hidden=n===0;
  if(bar)bar.style.transform='scaleX('+((n+1)/steps.length)+')';
  if(focus){var top=card.getBoundingClientRect().top;if(top<0||top>innerHeight*.6)card.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
   var first=steps[n].items.filter(function(g){return !g.classList.contains('lp-off')})[0];var el=first&&first.querySelector('input,textarea,select');
   if(el)try{el.focus({preventScroll:true})}catch(e){}}}
 function clear(g){g.classList.remove('lp-invalid');var e=g.querySelector('.lp-err');if(e)e.remove()}
 function valid(n){var bad=null;steps[n].items.forEach(function(g){if(g.classList.contains('lp-off')||g.classList.contains('lp-skip'))return;clear(g);
  var req=g.classList.contains('elementor-field-required'),radios=g.querySelectorAll('input[type=radio]'),msg='';
  if(radios.length){if(req&&!g.querySelector('input:checked'))msg='Escolha uma opção.'}
  else{var t=g.querySelector('input,textarea'),v=t?t.value.trim():'';
   if(req&&!v)msg='Preencha este campo.';else if(t&&t.type==='tel'&&v&&v.replace(/\\D/g,'').length<10)msg='Coloque o WhatsApp com DDD.'}
  if(msg){g.classList.add('lp-invalid');var e=document.createElement('span');e.className='lp-err';e.setAttribute('role','alert');e.textContent=msg;g.appendChild(e);if(!bad)bad=g}});
  if(bad){var el=bad.querySelector('input');if(el)try{el.focus()}catch(e){}}return !bad}
 next.addEventListener('click',function(){if(valid(i)){fill();show(i+1,true)}});
 /* Enter num campo de texto antes da última etapa avança, em vez de tentar enviar */
 form.addEventListener('keydown',function(e){if(e.key==='Enter'&&i<steps.length-1&&e.target.tagName==='INPUT'){e.preventDefault();next.click()}});
 back.addEventListener('click',function(){if(i>0)show(i-1,true)});
 form.addEventListener('change',function(e){var g=e.target.closest('.elementor-field-group');if(g)clear(g);conditional();if(e.target.type==='radio'&&group('endereco')&&g===group('site'))show(i);fill()});
 /* envio: antes do Elementor (fase de captura no documento), confere tudo e preenche os campos escondidos */
 var sent=null;
 document.addEventListener('submit',function(e){if(e.target!==form)return;
  if(i<steps.length-1){e.preventDefault();e.stopPropagation();if(valid(i)){fill();show(i+1,true)}return}
  for(var k=0;k<steps.length;k++){if(!valid(k)){e.preventDefault();e.stopPropagation();show(k,true);valid(k);return}}
  var j=fill();sent={j:j,text:summary()}},true);
 function summary(){var lines=['Olá! Respondi o formulário da Avence Studio.','Nome: '+answer('nome')];
  if(answer('empresa'))lines.push('Empresa: '+answer('empresa'));
  ['negocio','site','anuncio','investimento','decisao','prazo'].forEach(function(id){var a=answer(id);if(a)lines.push(LABELS[id]+': '+a+(id==='site'&&answer('endereco')?' ('+answer('endereco')+')':''))});
  return lines.join('\\n')}
 /* depois do envio: o resultado certo e a conversão (só do lead qualificado) */
 function done(){if(card.classList.contains('lp-done'))return;var s=sent||{j:judge(),text:summary()};
  card.classList.add('lp-done',s.j.ok?'lp-ok':'lp-no');
  var a=card.querySelector('.lp-result-ok .lp-wa a');if(a&&s.j.ok)a.href='https://wa.me/'+WA+'?text='+encodeURIComponent(s.text);
  var dl=window.dataLayer=window.dataLayer||[];dl.push({event:s.j.ok?'lead_qualificado':'lead_nao_qualificado',lead_origem:origin(),lead_nota:s.j.score,lead_motivo:s.j.reasons.join('; ')});
  if(s.j.ok){if(CONV.google&&typeof window.gtag==='function')window.gtag('event','conversion',{send_to:CONV.google});if(typeof window.fbq==='function')window.fbq('track','Lead')}
  var h=card.querySelector((s.j.ok?'.lp-result-ok':'.lp-result-no')+' .lp-result-title');
  var top=card.getBoundingClientRect().top;if(top<0)card.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  if(h){h.setAttribute('tabindex','-1');try{h.focus({preventScroll:true})}catch(e){}}}
 if(window.jQuery)window.jQuery(form).on('submit_success',done);
 new MutationObserver(function(){if(form.querySelector('.elementor-message-success'))done()}).observe(form,{childList:true,subtree:true});
 show(0,false);fill()}
})();</script>`
}
