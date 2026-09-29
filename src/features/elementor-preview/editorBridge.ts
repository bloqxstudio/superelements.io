/**
 * Ponte do editor visual: roda dentro do iframe do preview, que continua isolado
 * (sandbox sem allow-same-origin, porque os widgets HTML das seções rodam ali).
 * Ela só observa e mede; quem desenha seleção, alças e linha de soltar é o
 * canvas, com as caixas que a ponte manda. Nada daqui entra no JSON exportado.
 *
 * Mensagens que saem (para o PreviewFrame):
 *   se-ready, se-select, se-geometry, se-inline-edit, se-editing, se-drag, se-drop,
 *   se-hit-result, se-preview-wheel, se-preview-key
 * Mensagens que entram:
 *   se-editor-state { selectedId, hoverId, scale }, se-morph, se-hit, se-hit-clear, se-edit-text
 */

export interface BridgeRect {
  x: number
  y: number
  w: number
  h: number
}

/** Caixa de um elemento medida no documento do preview, em px do iframe. */
export interface BridgeBox {
  id: string
  type: string
  widgetType: string
  rect: BridgeRect
  /** Padding em px: cima, direita, baixo, esquerda. */
  padding: [number, number, number, number]
  /** Caixa onde o padding vale, quando não é a do elemento (widget: o container interno). */
  padRect: BridgeRect | null
  /** Como os filhos se organizam: display e direção do flex, gap linha/coluna. */
  display: string
  direction: string
  gap: [number, number]
  children: BridgeRect[]
  /** Filho de widget aninhado (item de acordeão): não sai do lugar. */
  locked: boolean
}

export interface BridgeGeometry {
  selected: BridgeBox | null
  hover: BridgeBox | null
}

/** Linha (ou área, num container vazio) de onde o elemento vai entrar. */
export interface BridgeIndicator {
  rect: BridgeRect
  inside: boolean
  container: BridgeRect | null
}

export interface BridgeDropTarget {
  parentId: string | null
  index: number
  indicator: BridgeIndicator
}

export type PreviewEditorMessage =
  | { type: 'se-select'; elementId: string; widgetType?: string }
  | { type: 'se-inline-edit'; elementId: string; field: 'title' | 'editor' | 'text'; value: string }
  | { type: 'se-editing'; elementId: string }
  | { type: 'se-geometry'; geometry: BridgeGeometry }
  | { type: 'se-drag'; indicator: BridgeIndicator | null }
  | { type: 'se-drop'; elementId: string; parentId: string | null; index: number }
  | { type: 'se-hit-result'; token: number; target: BridgeDropTarget | null }

export const EDITOR_MESSAGE_TYPES = new Set(['se-select', 'se-inline-edit', 'se-editing', 'se-geometry', 'se-drag', 'se-drop', 'se-hit-result'])

const EDITOR_CSS = `<style id="se-editor-css">
[data-se-editor] body{-webkit-user-select:none;user-select:none}
[data-se-editor] [contenteditable="true"]{cursor:text;-webkit-user-select:text;user-select:text;outline:none;caret-color:#7c3aed}
[data-se-editor] [contenteditable="true"]:empty:before{content:'Digite aqui';color:#9ca3af}
[data-se-editor] .se-dragging{opacity:.3}
[data-se-editor].se-drag-active,[data-se-editor].se-drag-active *{cursor:grabbing!important}
[data-se-editor] .e-con-full:empty,[data-se-editor] .e-con-inner:empty{min-height:96px;background:rgba(124,58,237,.05);outline:2px dashed rgba(124,58,237,.35);outline-offset:-6px;border-radius:4px}
</style>`

// Script da ponte, em JS puro de navegador (sem template strings dentro).
const EDITOR_SCRIPT = `<script>(function(){
var EL='[data-element_type][data-id]';
var html=document.documentElement;
html.setAttribute('data-se-editor','');
var selectedId='',externalHover='',hoverEl=null,editing=null,drag=null,scale=0.33,pending=false;

function post(m){parent.postMessage(m,'*')}
function clean(id){return String(id||'').replace(/[^a-zA-Z0-9_-]/g,'')}
function byId(id){id=clean(id);return id?document.querySelector('[data-element_type][data-id="'+id+'"]'):null}
function elementOf(t){return t&&t.closest?t.closest(EL):null}
function typeOf(el){return el.getAttribute('data-element_type')}
function widgetTypeOf(el){return typeOf(el)==='widget'?(el.getAttribute('data-widget_type')||'').split('.')[0]:''}
function parentOf(el){var p=el.parentElement;return p?p.closest(EL):null}
function rootList(){return document.querySelector('body > .elementor')}
function layoutOf(el){
 if(!el)return rootList();
 var t=typeOf(el);
 if(t==='container')return el.querySelector(':scope > .e-con-inner')||el;
 if(t==='column')return el.querySelector(':scope > .elementor-widget-wrap')||el;
 if(t==='section')return el.querySelector(':scope > .elementor-container')||el;
 return null
}
function kids(el){var l=layoutOf(el);return l?Array.prototype.filter.call(l.children,function(c){return c.matches(EL)}):[]}
function locked(el){var p=parentOf(el);return !!p&&typeOf(p)==='widget'}
function rect(el){var r=el.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}}
function num(v){var n=parseFloat(v);return isFinite(n)?n:0}

function box(el){
 if(!el)return null;
 var t=typeOf(el),layout=layoutOf(el),ls=layout?getComputedStyle(layout):null;
 var padEl=t==='widget'?(el.querySelector(':scope > .elementor-widget-container')||el):t==='column'?(layout||el):el;
 var ps=getComputedStyle(padEl);
 return {id:el.dataset.id,type:t,widgetType:widgetTypeOf(el),rect:rect(el),
  padding:[num(ps.paddingTop),num(ps.paddingRight),num(ps.paddingBottom),num(ps.paddingLeft)],
  padRect:padEl!==el?rect(padEl):null,
  display:ls?ls.display:'',direction:ls?ls.flexDirection:'',gap:ls?[num(ls.rowGap),num(ls.columnGap)]:[0,0],
  children:layout&&t!=='widget'?kids(el).map(rect):[],locked:locked(el)}
}

function report(){
 if(pending)return;pending=true;
 requestAnimationFrame(function(){
  pending=false;
  var sel=byId(selectedId);
  var hov=hoverEl&&document.contains(hoverEl)?hoverEl:byId(externalHover);
  post({type:'se-geometry',geometry:{selected:box(sel),hover:hov&&hov!==sel?box(hov):null}})
 })
}
new ResizeObserver(report).observe(document.body);
addEventListener('load',report);
document.addEventListener('load',report,true);

// Texto direto no preview
function editableNode(el){
 var t=widgetTypeOf(el);
 if(t==='heading')return el.querySelector('.elementor-heading-title>a,.elementor-heading-title');
 if(t==='text-editor')return el.querySelector('.elementor-widget-container');
 if(t==='button')return el.querySelector('.elementor-button-text');
 return null
}
function fieldOf(el){var t=widgetTypeOf(el);return t==='heading'?'title':t==='text-editor'?'editor':t==='button'?'text':null}
function beginEdit(el,x,y){
 var node=editableNode(el),field=fieldOf(el);
 if(!node||!field||editing)return;
 var before=node.innerHTML;editing=node;
 node.setAttribute('contenteditable','true');node.setAttribute('spellcheck','true');node.focus();
 // Pelo mouse, o cursor entra onde foi o clique; pelo Enter, o texto todo fica selecionado
 var range=typeof x==='number'&&document.caretRangeFromPoint?document.caretRangeFromPoint(x,y):null;
 if(!range||!node.contains(range.startContainer)){range=document.createRange();range.selectNodeContents(node)}
 var s=getSelection();s.removeAllRanges();s.addRange(range);
 function key(e){
  if(field!=='editor'&&e.key==='Enter'){e.preventDefault();node.blur()}
  if(e.key==='Escape'){e.preventDefault();node.innerHTML=before;node.blur()}
  e.stopPropagation()
 }
 node.addEventListener('keydown',key);
 node.addEventListener('blur',function(){
  node.removeEventListener('keydown',key);node.removeAttribute('contenteditable');node.removeAttribute('spellcheck');editing=null;
  getSelection().removeAllRanges();
  if(node.innerHTML!==before)post({type:'se-inline-edit',elementId:el.dataset.id,field:field,value:node.innerHTML});
  report()
 },{once:true});
 post({type:'se-editing',elementId:el.dataset.id})
}

// Onde um elemento solto no ponto (x, y) entraria
function accepts(p,kind){if(!p)return kind==='container';var t=typeOf(p);return t==='container'||(t==='column'&&kind==='widget')}
function axisOf(p){var l=layoutOf(p);if(!l)return 'y';var cs=getComputedStyle(l);return cs.display.indexOf('grid')>=0||cs.flexDirection.indexOf('row')===0?'grid':'y'}
function indexAt(list,x,y,axis){
 for(var i=0;i<list.length;i++){
  var r=list[i].getBoundingClientRect();
  if(axis==='y'){if(y<r.top+r.height/2)return i}
  else{if(y<r.top)return i;if(y<=r.bottom&&x<r.left+r.width/2)return i}
 }
 return list.length
}
function contentRect(p){
 var l=layoutOf(p);if(!l)return null;var r=l.getBoundingClientRect(),cs=getComputedStyle(l);
 var x=r.left+num(cs.paddingLeft),y=r.top+num(cs.paddingTop);
 return {x:x+scrollX,y:y+scrollY,w:Math.max(0,r.width-num(cs.paddingLeft)-num(cs.paddingRight)),h:Math.max(0,r.height-num(cs.paddingTop)-num(cs.paddingBottom))}
}
function dropAt(x,y,dragged,kind){
 var band=8/(scale||0.33);
 var cur=elementOf(document.elementFromPoint(x,y)),target=null,found=false;
 while(cur){
  if(dragged&&(cur===dragged||dragged.contains(cur))){cur=parentOf(cur);continue}
  var t=typeOf(cur);
  if((t==='container'||t==='column')&&accepts(cur,kind)){
   var r=cur.getBoundingClientRect(),p=parentOf(cur);
   var edge=p&&accepts(p,kind)&&r.height>band*4&&r.width>band*4&&(axisOf(p)==='y'?(y-r.top<band||r.bottom-y<band):(x-r.left<band||r.right-x<band));
   if(!edge){target=cur;found=true;break}
  }
  cur=parentOf(cur)
 }
 if(!found&&!accepts(null,kind)&&kind!=='widget')return null;
 var all=target?kids(target):kids(null);
 var list=all.filter(function(c){return c!==dragged});
 var axis=target?axisOf(target):'y';
 var k=indexAt(list,x,y,axis);
 var index=k<list.length?all.indexOf(list[k]):all.length;
 var container=target?rect(target):null,line;
 if(!list.length){var c=contentRect(target);line={rect:c||{x:0,y:0,w:innerWidth,h:40},inside:true}}
 else if(axis==='y'){
  var cr=contentRect(target)||{x:0,w:innerWidth},prev=list[k-1]&&rect(list[k-1]),next=list[k]&&rect(list[k]);
  var ly=prev&&next?(prev.y+prev.h+next.y)/2:next?next.y:prev.y+prev.h;
  line={rect:{x:cr.x,y:ly,w:cr.w,h:0},inside:false}
 }else{
  var a=list[k-1]&&rect(list[k-1]),b=list[k]&&rect(list[k]);
  var ref=b||a,lx=a&&b&&Math.abs(a.y-b.y)<2?(a.x+a.w+b.x)/2:b?b.x:a.x+a.w;
  line={rect:{x:lx,y:ref.y,w:0,h:ref.h},inside:false}
 }
 line.container=container;
 return {parentId:target?target.dataset.id:null,index:index,indicator:line}
}

// Seleção e arrasto
document.addEventListener('pointerdown',function(e){
 if(e.button!==0)return;
 if(editing&&editing.contains(e.target))return;
 var el=elementOf(e.target);
 if(!el){selectedId='';post({type:'se-select',elementId:''});report();return}
 var was=el.dataset.id===selectedId;
 selectedId=el.dataset.id;
 post({type:'se-select',elementId:selectedId,widgetType:widgetTypeOf(el)});
 report();
 drag={el:el,sx:e.screenX,sy:e.screenY,started:false,was:was,target:null,id:e.pointerId}
},true);
function endDrag(){
 if(!drag)return;
 drag.el.classList.remove('se-dragging');html.classList.remove('se-drag-active');
 try{html.releasePointerCapture(drag.id)}catch(err){}
 post({type:'se-drag',indicator:null})
}
document.addEventListener('pointermove',function(e){
 if(drag){
  if(!drag.started){
   if(Math.hypot(e.screenX-drag.sx,e.screenY-drag.sy)<5)return;
   if(locked(drag.el)){drag=null;return}
   drag.started=true;drag.el.classList.add('se-dragging');html.classList.add('se-drag-active');
   try{html.setPointerCapture(drag.id)}catch(err){}
  }
  var kind=typeOf(drag.el)==='container'?'container':'widget';
  drag.el.style.pointerEvents='none';
  drag.target=dropAt(e.clientX,e.clientY,drag.el,kind);
  drag.el.style.pointerEvents='';
  post({type:'se-drag',indicator:drag.target?drag.target.indicator:null});
  return
 }
 var el=elementOf(e.target);
 if(el!==hoverEl){hoverEl=el;report()}
});
document.addEventListener('pointerup',function(e){
 if(!drag)return;
 var d=drag;
 if(d.started){
  endDrag();drag=null;
  if(d.target)post({type:'se-drop',elementId:d.el.dataset.id,parentId:d.target.parentId,index:d.target.index});
  return
 }
 drag=null;
 if(d.was&&fieldOf(d.el))beginEdit(d.el,e.clientX,e.clientY)
},true);
document.addEventListener('pointercancel',function(){endDrag();drag=null});
document.documentElement.addEventListener('mouseleave',function(){if(hoverEl){hoverEl=null;report()}});
document.addEventListener('dblclick',function(e){var el=elementOf(e.target);if(el&&fieldOf(el))beginEdit(el,e.clientX,e.clientY)});
// O preview não navega nem envia: link, botão, acordeão e formulário ficam parados para editar
document.addEventListener('click',function(e){if(!(editing&&editing.contains(e.target)))e.preventDefault()},true);
document.addEventListener('submit',function(e){e.preventDefault()},true);
document.addEventListener('dragstart',function(e){e.preventDefault()},true);

// Roda e teclas voltam para o canvas; texto em edição e campos ficam com as teclas deles
addEventListener('wheel',function(e){e.preventDefault();post({type:'se-preview-wheel',x:e.clientX,y:e.clientY,deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey})},{passive:false});
var KEYS=['Delete','Backspace','Escape','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
function key(e){
 var t=e.target;
 if(t&&t.closest&&t.closest('[contenteditable="true"],input,textarea,select'))return;
 var mod=e.ctrlKey||e.metaKey,k=(e.key||'').toLowerCase();
 if(e.code==='Space')e.preventDefault();
 else if(e.type!=='keydown')return;
 else if(mod&&'zycvdgx'.indexOf(k)>=0&&k.length===1){if((k==='c'||k==='x')&&String(getSelection()))return;e.preventDefault()}
 else if(KEYS.indexOf(e.key)>=0)e.preventDefault();
 else if(mod||e.altKey||!/^[a-z]$/.test(k))return;
 post({type:'se-preview-key',event:e.type,key:e.key,code:e.code,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey,altKey:e.altKey,repeat:e.repeat})
}
addEventListener('keydown',key);addEventListener('keyup',key);

// Atualização sem recarregar: troca os estilos e a árvore do .elementor
function morph(d){
 if(editing)editing.blur();
 var styles=d.styles||{};
 ['se-base','se-elements','se-motion'].forEach(function(id){
  var el=document.getElementById(id),css=styles[id];
  if(typeof css==='string'){if(!el){el=document.createElement('style');el.id=id;document.head.appendChild(el)}if(el.textContent!==css)el.textContent=css}
  else if(el)el.remove()
 });
 (d.links||[]).forEach(function(href){
  if(typeof href!=='string'||!/^https:\\/\\//.test(href))return;
  var has=Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'),function(l){return l.getAttribute('href')===href});
  if(!has){var l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
 });
 var current=rootList();
 if(current&&typeof d.html==='string'){var tpl=document.createElement('template');tpl.innerHTML=d.html;var next=tpl.content.firstElementChild;if(next)current.replaceWith(next)}
 hoverEl=null;report()
}

addEventListener('message',function(e){
 var d=e.data;if(!d||typeof d!=='object')return;
 if(d.type==='se-editor-state'){
  selectedId=clean(d.selectedId);externalHover=clean(d.hoverId);
  if(typeof d.scale==='number'&&d.scale>0)scale=d.scale;
  report()
 }else if(d.type==='se-morph')morph(d);
 else if(d.type==='se-hit'){
  var kind=d.kind==='container'?'container':'widget';
  post({type:'se-hit-result',token:d.token,target:dropAt(Number(d.x)||0,Number(d.y)||0,null,kind)})
 }else if(d.type==='se-edit-text'){var el=byId(d.elementId);if(el)beginEdit(el)}
});
post({type:'se-ready'});
report();
})()</script>`

export const EDITOR_BRIDGE = EDITOR_CSS + EDITOR_SCRIPT
