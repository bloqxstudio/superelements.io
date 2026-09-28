import type { SectionNodeData } from '@/types/space'
import { createPdvLightLibraryTemplate } from './pdvLightLibraryTemplate'
import { createMenuzitoTemplate } from './menuzitoTemplate'
import { createUglyCashTemplate } from './uglyCashTemplate'
import { createProcessBaseTemplate } from './processbaseTemplate'
import { createZeloTemplates } from './zeloTemplate'
import { createInpelTemplates } from './inpelTemplate'
import { createPetshopTemplate } from './petshopTemplate'

type JsonRecord = Record<string, unknown>
type ElementorNode = JsonRecord & { id: string; elType: 'container' | 'widget'; settings: JsonRecord; elements: ElementorNode[]; widgetType?: string }

export interface LandingTemplate {
  id: string
  name: string
  description: string
  audience: string
  componentIds?: string[]
  sections: SectionNodeData[]
}

const px = (size: number) => ({ unit: 'px', size, sizes: [] })
const gap = (size: number) => ({ unit: 'px', size, row: String(size), column: String(size), isLinked: true })
const sides = (top: number, right: number, bottom: number, left: number) => ({ unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left), isLinked: top === right && right === bottom && bottom === left })
const image = (url: string, alt: string) => ({ id: 0, url, alt, source: 'url', size: '' })

const createBuilder = () => {
  let sequence = 0
  const uid = () => (++sequence).toString(16).padStart(7, '0')
  const node = (elType: 'container' | 'widget', settings: JsonRecord, elements: ElementorNode[] = [], widgetType?: string): ElementorNode => ({
    id: uid(), elType, settings, elements, ...(widgetType ? { widgetType, isInner: false } : { isInner: true }),
  })
  const container = (settings: JsonRecord, elements: ElementorNode[] = []) => node('container', settings, elements)
  const widget = (widgetType: string, settings: JsonRecord) => node('widget', settings, [], widgetType)

  const heading = (title: string, size: number, color: string, tag = 'h2', weight = '800') => widget('heading', {
    title, header_size: tag, title_color: color,
    typography_typography: 'custom', typography_font_family: 'Manrope', typography_font_size: px(size),
    typography_font_size_tablet: px(Math.max(36, Math.round(size * 0.7))), typography_font_size_mobile: px(Math.max(32, Math.round(size * 0.52))),
    typography_font_weight: weight, typography_line_height: { unit: 'em', size: 1.05, sizes: [] },
    typography_letter_spacing: px(size >= 48 ? -2 : -0.4), content_width: 'full',
  })
  const eyebrow = (title: string, color: string) => widget('heading', {
    title, header_size: 'p', title_color: color,
    typography_typography: 'custom', typography_font_family: 'Manrope', typography_font_size: px(12),
    typography_font_weight: '700', typography_text_transform: 'uppercase', typography_letter_spacing: px(1.5),
  })
  const text = (copy: string, color: string, size = 17) => widget('text-editor', {
    editor: `<p>${copy}</p>`, text_color: color,
    typography_typography: 'custom', typography_font_family: 'Manrope', typography_font_size: px(size),
    typography_font_weight: '400', typography_line_height: { unit: 'em', size: 1.65, sizes: [] },
  })
  const button = (label: string, dark = true) => widget('button', {
    text: label, link: { url: '#contato' },
    typography_typography: 'custom', typography_font_family: 'Manrope', typography_font_size: px(14), typography_font_weight: '700',
    button_text_color: dark ? '#F8F7F2' : '#152017', background_color: dark ? '#152017' : '#D9FF43',
    button_background_hover_color: dark ? '#D9FF43' : '#FFFFFF', hover_color: '#152017',
    border_radius: sides(999, 999, 999, 999), text_padding: sides(17, 28, 17, 28),
    custom_css: 'selector .elementor-button{transition-property:transform,background-color,color;transition-duration:220ms;transition-timing-function:cubic-bezier(.2,0,0,1)}selector .elementor-button:active{transform:scale(.96)}',
  })
  const photo = (src: string, alt: string, ratio = '4 / 5') => widget('image', {
    image: image(src, alt), image_size: 'custom', image_custom_dimension: { width: '1200', height: '1500' },
    image_border_radius: sides(24, 24, 24, 24),
    custom_css: `selector img{width:100%;aspect-ratio:${ratio};object-fit:cover;outline:1px solid oklch(0 0 0 / .1);outline-offset:-1px}`,
  })

  const root = (background: string, children: ElementorNode[], customCss = '') => container({
    content_width: 'boxed', boxed_width: px(1240), flex_direction: 'column', flex_gap: gap(0),
    background_background: 'classic', background_color: background,
    padding: sides(112, 40, 112, 40), padding_tablet: sides(80, 32, 80, 32), padding_mobile: sides(64, 20, 64, 20),
    custom_css: customCss,
  }, children)
  const stack = (children: ElementorNode[], size = 28, settings: JsonRecord = {}) => container({ content_width: 'full', flex_direction: 'column', flex_gap: gap(size), ...settings }, children)
  const grid = (children: ElementorNode[], columns = '1fr 1fr', size = 32, settings: JsonRecord = {}) => container({
    content_width: 'full', container_type: 'grid', grid_columns_grid: { unit: 'custom', size: columns, sizes: [] },
    grid_columns_grid_tablet: { unit: 'fr', size: 1, sizes: [] }, grid_columns_grid_mobile: { unit: 'fr', size: 1, sizes: [] },
    grid_rows_grid: { unit: 'fr', size: 1, sizes: [] }, grid_gaps: gap(size), ...settings,
  }, children)
  const section = (title: string, element: ElementorNode, sourceId: string): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([element]) })

  return { container, widget, heading, eyebrow, text, button, photo, root, stack, grid, section }
}

const makeHero = (leadFocused: boolean): SectionNodeData => {
  const b = createBuilder()
  const asset = `${window.location.origin}/sections/c25/casa-horizonte.png`
  const copy = leadFocused
    ? 'Projetamos casas contemporâneas que respondem ao terreno, ao clima e à forma como você quer viver.'
    : 'Arquitetura feita para pertencer ao lugar.'
  const title = leadFocused ? 'Sua casa começa com uma boa conversa.' : 'Espaços que atravessam o tempo.'
  const content = b.stack([
    b.eyebrow('LINHA NORTE · ARQUITETURA', '#D9FF43'),
    b.heading(title, 72, '#FFFFFF', 'h1', '800'),
    b.text(copy, '#D8DED5', 18),
    b.button(leadFocused ? 'Agendar conversa inicial' : 'Conhecer projetos', false),
  ], 28, { flex_justify_content: 'center', padding: sides(40, 20, 40, 0) })
  const visual = b.container({ content_width: 'full', css_classes: 'ln-hero-visual', overflow: 'hidden', border_radius: sides(28, 28, 28, 28) }, [b.photo(asset, 'Casa do Horizonte ao pôr do sol', '4 / 5')])
  return b.section('Hero · Linha Norte', b.root('#152017', [b.grid([content, visual], '1fr .88fr', 64)], `
selector{min-height:92vh;display:flex;justify-content:center}
selector .ln-hero-visual img{transition-property:transform;transition-duration:900ms;transition-timing-function:cubic-bezier(.22,1,.36,1)}
@media(hover:hover) and (pointer:fine){selector .ln-hero-visual:hover img{transform:scale(1.035)}}
@media(prefers-reduced-motion:reduce){selector .ln-hero-visual img{transition-duration:.01ms}}
`), leadFocused ? 'modelo-hero-conversao' : 'modelo-hero-editorial')
}

const makeAbout = (): SectionNodeData => {
  const b = createBuilder()
  const numbers = [
    ['18', 'projetos construídos'], ['07', 'cidades brasileiras'], ['12', 'anos desenhando lugares'],
  ].map(([number, label]) => b.stack([b.heading(number, 48, '#152017', 'p'), b.text(label, '#5E685D', 14)], 8, {
    padding: sides(24, 24, 24, 24), border_radius: sides(20, 20, 20, 20), background_background: 'classic', background_color: '#FCFBF7',
  }))
  return b.section('Manifesto e números', b.root('#F3F0E9', [
    b.grid([
      b.stack([b.eyebrow('NOSSO NORTE', '#5E685D'), b.heading('Menos gesto. Mais intenção.', 58, '#152017'), b.text('Cada projeto nasce da escuta: do terreno, do clima, da matéria e das pessoas. O resultado é uma arquitetura precisa, mas nunca indiferente.', '#5E685D')], 28),
      b.grid(numbers, 'repeat(3, 1fr)', 16, { grid_columns_grid_tablet: { unit: 'fr', size: 3, sizes: [] } }),
    ], '1fr 1.1fr', 72),
  ]), 'modelo-manifesto')
}

const makeProjects = (): SectionNodeData => {
  const b = createBuilder()
  const assetRoot = `${window.location.origin}/sections/c25`
  const projects = [
    ['casa-horizonte.png', 'RESIDENCIAL · UBATUBA', 'Casa do Horizonte'],
    ['apartamento-jardins.png', 'INTERIORES · SÃO PAULO', 'Apartamento Jardins'],
    ['pavilhao-terra.png', 'CULTURA · PORTO ALEGRE', 'Pavilhão Terra'],
  ].map(([src, label, title], index) => b.stack([
    b.photo(`${assetRoot}/${src}`, title),
    b.stack([b.eyebrow(label, '#D9FF43'), b.heading(title, 26, '#FFFFFF', 'h3')], 8, { css_classes: 'ln-project-copy' }),
  ], 0, { css_classes: `ln-project-card ln-project-card-${index + 1}`, overflow: 'hidden', border_radius: sides(24, 24, 24, 24), position: 'relative' }))
  return b.section('Projetos selecionados', b.root('#F3F0E9', [
    b.grid([
      b.stack([b.eyebrow('PROJETOS SELECIONADOS · 2026', '#5E685D'), b.heading('Arquitetura feita para pertencer ao lugar.', 56, '#152017')], 20),
      b.text('Três escalas, uma mesma atenção à luz, ao uso e à permanência.', '#5E685D'),
    ], '1.4fr .6fr', 64, { padding: sides(0, 0, 56, 0) }),
    b.grid(projects, 'repeat(3, 1fr)', 24),
  ], `
selector .ln-project-card{position:relative;isolation:isolate;background:#152017;box-shadow:0 18px 50px rgba(17,24,16,.08);transition-property:transform,box-shadow;transition-duration:500ms;transition-timing-function:cubic-bezier(.22,1,.36,1)}
selector .ln-project-card:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,transparent 35%,rgba(9,15,11,.88));}
selector .ln-project-card img{border-radius:24px;transition-property:transform,filter;transition-duration:700ms;transition-timing-function:cubic-bezier(.22,1,.36,1)}
selector .ln-project-copy{position:absolute;z-index:2;left:32px;right:32px;bottom:32px;transition-property:transform;transition-duration:500ms;transition-timing-function:cubic-bezier(.22,1,.36,1)}
@media(hover:hover) and (pointer:fine){selector .ln-project-card:hover{transform:translateY(-10px);box-shadow:0 28px 70px rgba(17,24,16,.18)}selector .ln-project-card:hover img{transform:scale(1.06);filter:saturate(1.05)}selector .ln-project-card:hover .ln-project-copy{transform:translateY(-8px)}}
@media(prefers-reduced-motion:reduce){selector .ln-project-card,selector .ln-project-card img,selector .ln-project-copy{transition-duration:.01ms}}
`), 'modelo-projetos')
}

const makeServices = (): SectionNodeData => {
  const b = createBuilder()
  const services = [
    ['01', 'Residências', 'Do estudo do terreno ao acompanhamento da obra.'],
    ['02', 'Interiores', 'Reformas completas, mobiliário e direção de materiais.'],
    ['03', 'Espaços culturais', 'Equipamentos públicos e privados que convidam à permanência.'],
  ].map(([number, title, copy]) => b.grid([
    b.heading(number, 20, '#5E685D', 'p'),
    b.heading(title, 30, '#152017', 'h3'),
    b.text(copy, '#5E685D', 15),
  ], '.2fr .8fr 1fr', 24, { css_classes: 'ln-service-row', padding: sides(28, 0, 28, 0) }))
  return b.section('Áreas de atuação', b.root('#FCFBF7', [
    b.grid([
      b.stack([b.eyebrow('O QUE FAZEMOS', '#5E685D'), b.heading('Da primeira ideia ao espaço vivido.', 54, '#152017')], 20),
      b.stack(services, 0),
    ], '.8fr 1.2fr', 72),
  ], 'selector .ln-service-row{border-top:1px solid rgba(21,32,23,.14);transition-property:padding-left;transition-duration:300ms;transition-timing-function:cubic-bezier(.2,0,0,1)}@media(hover:hover){selector .ln-service-row:hover{padding-left:12px}}'), 'modelo-servicos')
}

const makeProcess = (): SectionNodeData => {
  const b = createBuilder()
  const steps = [
    ['01', 'Escuta', 'Objetivos, rotina, orçamento e as condições do lugar.'],
    ['02', 'Direção', 'Conceito, implantação e decisões que organizam o projeto.'],
    ['03', 'Detalhamento', 'Materiais, sistemas e documentação para construir bem.'],
    ['04', 'Obra', 'Acompanhamento para preservar a intenção até a entrega.'],
  ].map(([number, title, copy]) => b.stack([
    b.eyebrow(number, '#D9FF43'), b.heading(title, 28, '#FFFFFF', 'h3'), b.text(copy, '#C8D0C6', 15),
  ], 16, { padding: sides(28, 24, 28, 24), border_radius: sides(20, 20, 20, 20), background_background: 'classic', background_color: '#1E2A20' }))
  return b.section('Processo', b.root('#152017', [
    b.stack([b.eyebrow('COMO TRABALHAMOS', '#D9FF43'), b.heading('Clareza em cada etapa.', 56, '#FFFFFF'), b.text('Um processo legível reduz incerteza e abre espaço para as decisões que realmente importam.', '#C8D0C6')], 22, { padding: sides(0, 0, 48, 0) }),
    b.grid(steps, 'repeat(4, 1fr)', 16, { grid_columns_grid_tablet: { unit: 'fr', size: 2, sizes: [] } }),
  ]), 'modelo-processo')
}

const makeProof = (): SectionNodeData => {
  const b = createBuilder()
  const asset = `${window.location.origin}/sections/c25/apartamento-jardins.png`
  return b.section('Depoimento', b.root('#F3F0E9', [
    b.grid([
      b.photo(asset, 'Apartamento Jardins com madeira, pedra e vegetação', '5 / 4'),
      b.stack([
        b.eyebrow('CASA VIVIDA', '#5E685D'),
        b.heading('“O projeto traduziu uma rotina que a gente ainda não sabia explicar.”', 44, '#152017', 'blockquote'),
        b.text('Marina e Caio · Apartamento Jardins', '#5E685D', 14),
      ], 24, { flex_justify_content: 'center', padding: sides(24, 24, 24, 40) }),
    ], '1fr 1fr', 56),
  ]), 'modelo-depoimento')
}

const makeCta = (leadFocused: boolean): SectionNodeData => {
  const b = createBuilder()
  return b.section('Contato', b.root('#D9FF43', [
    b.grid([
      b.stack([b.eyebrow('PRÓXIMO PASSO', '#40500D'), b.heading(leadFocused ? 'Conte sobre o lugar que você quer construir.' : 'Um bom projeto começa antes do desenho.', 56, '#152017')], 20),
      b.stack([b.text('Uma conversa de 30 minutos para entender momento, terreno e ambição do projeto.', '#40500D'), b.button('Agendar conversa inicial', true)], 24, { flex_justify_content: 'center' }),
    ], '1.25fr .75fr', 72),
  ], 'selector{scroll-margin-top:24px}'), 'modelo-contato')
}

const makeFooter = (): SectionNodeData => {
  const b = createBuilder()
  return b.section('Rodapé', b.root('#101611', [
    b.grid([
      b.stack([b.heading('Linha Norte', 28, '#FFFFFF', 'p'), b.text('Arquitetura brasileira, do lugar para a vida.', '#AEB8AC', 14)], 12),
      b.stack([b.eyebrow('CONTATO', '#D9FF43'), b.text('oi@linhanorte.arq<br>São Paulo · Brasil', '#D8DED5', 14)], 10),
      b.stack([b.eyebrow('REDES', '#D9FF43'), b.text('Instagram<br>LinkedIn<br>ArchDaily', '#D8DED5', 14)], 10),
    ], '1.5fr .75fr .75fr', 40),
  ]), 'modelo-rodape')
}

const COURSE_MOTION_SCRIPT = `<script>
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.documentElement.classList.add('course-motion-ready');
  function init(){
    var reveals=[].slice.call(document.querySelectorAll('.course-reveal'));
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting)return;
        var group=[].slice.call(entry.target.parentElement.querySelectorAll(':scope > .course-reveal'));
        var index=Math.max(0,group.indexOf(entry.target));
        var revealMotion=entry.target.animate([
          {opacity:0,transform:'translate3d(0,34px,0)',filter:'blur(8px)'},
          {opacity:1,transform:'translate3d(0,0,0)',filter:'blur(0)'}
        ],{duration:850,delay:index*90,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
        revealMotion.addEventListener('finish',function(){
          entry.target.style.opacity='1';
          entry.target.style.transform='translate3d(0,0,0)';
          entry.target.style.filter='blur(0)';
          revealMotion.cancel();
        },{once:true});
        observer.unobserve(entry.target);
      });
    },{threshold:.14,rootMargin:'0px 0px -8% 0px'});
    reveals.forEach(function(el){observer.observe(el)});

    document.querySelectorAll('.course-tilt').forEach(function(card){
      card.addEventListener('pointermove',function(event){
        if(event.pointerType==='touch')return;
        if(card.__courseReset)card.__courseReset.cancel();
        var rect=card.getBoundingClientRect();
        var rx=((event.clientY-rect.top)/rect.height-.5)*-7;
        var ry=((event.clientX-rect.left)/rect.width-.5)*7;
        card.style.transform='perspective(900px) rotateX('+rx+'deg) rotateY('+ry+'deg) translateY(-8px)';
      });
      card.addEventListener('pointerleave',function(){
        var from=card.style.transform;
        card.__courseReset=card.animate([{transform:from},{transform:'perspective(900px) rotateX(0) rotateY(0) translateY(0)'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
        card.__courseReset.addEventListener('finish',function(){card.style.transform='';card.__courseReset.cancel()},{once:true});
      });
    });

    document.querySelectorAll('.course-magnetic .elementor-button').forEach(function(button){
      button.addEventListener('pointermove',function(event){
        var rect=button.getBoundingClientRect();
        var x=(event.clientX-rect.left-rect.width/2)*.12;
        var y=(event.clientY-rect.top-rect.height/2)*.18;
        button.style.transform='translate3d('+x+'px,'+y+'px,0)';
      });
      button.addEventListener('pointerleave',function(){
        var reset=button.animate([{transform:button.style.transform},{transform:'translate3d(0,0,0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
        reset.addEventListener('finish',function(){button.style.transform='';reset.cancel()},{once:true});
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`

const courseRootCss = `
.course-motion-ready .course-reveal{opacity:0}
selector .course-pill{border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(12px)}
selector .course-card{box-shadow:0 1px 0 rgba(255,255,255,.08) inset,0 24px 70px rgba(0,0,0,.16)}
@media(prefers-reduced-motion:reduce){.course-motion-ready .course-reveal{opacity:1!important;transform:none!important;filter:none!important}}
`

const makeCourseHero = (): SectionNodeData => {
  const b = createBuilder()
  const vsl = b.widget('video', {
    video_type: 'youtube', youtube_url: 'https://www.youtube.com/watch?v=XHOmBV4js_E', aspect_ratio: '169',
    custom_css: 'selector .elementor-wrapper{overflow:hidden;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.4);outline:1px solid rgba(255,255,255,.12)}selector iframe{width:100%;height:100%}',
    _css_classes: 'course-reveal',
  })
  const copy = b.stack([
    b.eyebrow('CURSO ONLINE · TURMA 04', '#C9FF4A'),
    b.heading('Direção de Produto na prática.', 72, '#F8F7FF', 'h1'),
    b.text('Um sistema de trabalho para transformar contexto confuso em decisões claras, alinhamento real e produtos que avançam.', '#B7B4C7', 18),
    b.button('Quero liderar com clareza', false),
    b.text('Acesso imediato · 12 meses · Certificado', '#858196', 13),
  ], 24, { css_classes: 'course-reveal', flex_justify_content: 'center' })
  const script = b.widget('html', { html: COURSE_MOTION_SCRIPT })
  return b.section('Curso · Hero com VSL', b.root('#0B0D12', [
    b.grid([copy, vsl], '.82fr 1.18fr', 64), script,
  ], `${courseRootCss} selector{min-height:94vh;display:flex;justify-content:center;background-image:radial-gradient(circle at 12% 18%,rgba(139,92,246,.22),transparent 32%),radial-gradient(circle at 92% 82%,rgba(201,255,74,.08),transparent 28%)}`), 'curso-hero-vsl')
}

const makeCourseOutcomes = (): SectionNodeData => {
  const b = createBuilder()
  const cards = [
    ['01', 'Diagnóstico', 'Enxergue o problema certo antes de mobilizar design e engenharia.'],
    ['02', 'Direção', 'Converta evidências em apostas, recortes e critérios de sucesso.'],
    ['03', 'Ritmo', 'Crie cadências de decisão que mantêm o time avançando sem microgestão.'],
  ].map(([number, title, copy]) => b.stack([
    b.eyebrow(number, '#C9FF4A'), b.heading(title, 30, '#F8F7FF', 'h3'), b.text(copy, '#AAA6BA', 15),
  ], 18, {
    css_classes: 'course-card course-tilt course-reveal', padding: sides(34, 30, 34, 30),
    border_radius: sides(24, 24, 24, 24), background_background: 'classic', background_color: '#151820',
  }))
  return b.section('Curso · Transformação', b.root('#0F1117', [
    b.stack([b.eyebrow('O QUE MUDA', '#8B5CF6'), b.heading('Pare de reagir. Comece a dirigir.', 58, '#F8F7FF'), b.text('Ao final do curso, você terá um sistema replicável para conduzir discovery, estratégia e entrega com menos ruído.', '#AAA6BA')], 20, { css_classes: 'course-reveal', padding: sides(0, 0, 48, 0) }),
    b.grid(cards, 'repeat(3, 1fr)', 20),
  ], courseRootCss), 'curso-resultados')
}

const makeCourseCurriculum = (): SectionNodeData => {
  const b = createBuilder()
  const modules = [
    ['Módulo 01', 'Leitura de contexto', 'Sinais, restrições, stakeholders e definição do campo de jogo.'],
    ['Módulo 02', 'Problema e recorte', 'Como separar sintomas, causas e oportunidades acionáveis.'],
    ['Módulo 03', 'Estratégia como escolha', 'Apostas, trade-offs, métricas e o que deliberadamente não fazer.'],
    ['Módulo 04', 'Discovery que decide', 'Roteiros, evidências e sínteses que reduzem incerteza.'],
    ['Módulo 05', 'Alinhamento executivo', 'Narrativas, artefatos e reuniões que produzem compromisso.'],
    ['Módulo 06', 'Ritmo de execução', 'Cadência, checkpoints e aprendizado depois do lançamento.'],
  ].map(([label, title, copy]) => b.grid([
    b.eyebrow(label, '#6D28D9'), b.heading(title, 25, '#11131A', 'h3'), b.text(copy, '#626070', 14),
  ], '.35fr .8fr 1fr', 24, { css_classes: 'course-module course-reveal', padding: sides(24, 0, 24, 0) }))
  return b.section('Curso · Conteúdo detalhado', b.root('#F5F3FA', [
    b.grid([
      b.stack([b.eyebrow('CURRÍCULO', '#6D28D9'), b.heading('Do contexto à entrega, sem atalhos mágicos.', 54, '#11131A'), b.text('32 aulas objetivas, templates editáveis e estudos de caso baseados em situações reais de produto.', '#626070')], 22, { css_classes: 'course-reveal' }),
      b.stack(modules, 0),
    ], '.72fr 1.28fr', 72),
  ], `${courseRootCss} selector .course-module{border-top:1px solid rgba(17,19,26,.12);transition-property:padding-left,background-color;transition-duration:280ms;transition-timing-function:cubic-bezier(.2,0,0,1)}@media(hover:hover){selector .course-module:hover{padding-left:14px;background-color:rgba(139,92,246,.04)}}`), 'curso-curriculo')
}

const makeCourseBonus = (): SectionNodeData => {
  const b = createBuilder()
  const items = [
    ['Bônus 01', 'Kit de artefatos', 'Canvas de problema, mapa de apostas, roteiro de discovery e decision log.'],
    ['Bônus 02', 'Clínica de casos', 'Quatro sessões gravadas analisando decisões reais de produto.'],
    ['Bônus 03', 'Comunidade', 'Canal privado para perguntas, repertório e troca entre lideranças.'],
  ].map(([label, title, copy]) => b.stack([
    b.eyebrow(label, '#C9FF4A'), b.heading(title, 28, '#FFFFFF', 'h3'), b.text(copy, '#AAA6BA', 15),
  ], 14, { css_classes: 'course-card course-tilt course-reveal', padding: sides(30, 28, 30, 28), border_radius: sides(22, 22, 22, 22), background_background: 'classic', background_color: '#171A22' }))
  return b.section('Curso · Bônus', b.root('#0B0D12', [
    b.stack([b.eyebrow('ALÉM DAS AULAS', '#8B5CF6'), b.heading('Ferramentas para usar na segunda-feira.', 52, '#FFFFFF')], 18, { css_classes: 'course-reveal', padding: sides(0, 0, 42, 0) }),
    b.grid(items, 'repeat(3, 1fr)', 20),
  ], courseRootCss), 'curso-bonus')
}

const makeCourseProof = (): SectionNodeData => {
  const b = createBuilder()
  const quotes = [
    ['“Finalmente parei de usar discovery como ritual e comecei a usá-lo para decidir.”', 'Camila Rocha · Senior PM'],
    ['“O módulo de direção mudou a qualidade das conversas com engenharia e liderança.”', 'Rafael Lima · Head de Produto'],
    ['“Os templates viraram parte do nosso processo já na primeira semana.”', 'Nina Alves · Product Lead'],
  ].map(([quote, author]) => b.stack([
    b.heading(quote, 24, '#11131A', 'h3', '600'), b.text(author, '#6A6877', 13),
  ], 20, { css_classes: 'course-card course-tilt course-reveal', padding: sides(30, 28, 30, 28), border_radius: sides(22, 22, 22, 22), background_background: 'classic', background_color: '#FFFFFF' }))
  return b.section('Curso · Depoimentos', b.root('#F5F3FA', [
    b.stack([b.eyebrow('QUEM JÁ APLICOU', '#6D28D9'), b.heading('Mais clareza. Menos teatro de produto.', 52, '#11131A')], 18, { css_classes: 'course-reveal', padding: sides(0, 0, 42, 0) }),
    b.grid(quotes, 'repeat(3, 1fr)', 20),
  ], courseRootCss), 'curso-prova-social')
}

const makeCoursePricing = (): SectionNodeData => {
  const b = createBuilder()
  const makePrice = (name: string, price: string, description: string, features: string[], featured = false) => b.stack([
    b.eyebrow(featured ? 'MAIS ESCOLHIDO' : name.toUpperCase(), featured ? '#C9FF4A' : '#8B5CF6'),
    b.heading(name, 28, '#FFFFFF', 'h3'),
    b.heading(price, 48, '#FFFFFF', 'p'),
    b.text(description, '#AAA6BA', 14),
    b.widget('icon-list', {
      icon_list: features.map((item, index) => ({ _id: `feature-${index}`, text: item, selected_icon: { value: 'fas fa-check', library: 'fa-solid' } })),
      icon_color: featured ? '#C9FF4A' : '#A78BFA', text_color: '#E8E6EF', icon_size: px(13), space_between: px(14),
      icon_typography_typography: 'custom', icon_typography_font_family: 'Manrope', icon_typography_font_size: px(14),
    }),
    b.button(featured ? 'Começar agora' : 'Escolher plano', !featured),
  ], 20, {
    css_classes: `course-price course-tilt course-reveal${featured ? ' course-price-featured' : ''}`,
    padding: sides(featured ? 38 : 32, 30, featured ? 38 : 32, 30), border_radius: sides(26, 26, 26, 26),
    background_background: 'classic', background_color: featured ? '#25194A' : '#151820',
  })
  const prices = [
    makePrice('Essencial', '12× R$ 49', 'Para estudar no seu ritmo.', ['32 aulas gravadas', 'Templates editáveis', '12 meses de acesso']),
    makePrice('Completo', '12× R$ 79', 'A experiência recomendada.', ['Tudo do Essencial', 'Clínica de casos', 'Comunidade privada', 'Certificado'], true),
    makePrice('Times', 'R$ 2.490', 'Cinco acessos para o time.', ['5 licenças completas', 'Onboarding de 60 min', 'Trilha para liderança']),
  ]
  return b.section('Curso · Pricing', b.root('#0B0D12', [
    b.stack([b.eyebrow('INVESTIMENTO', '#C9FF4A'), b.heading('Escolha como quer avançar.', 54, '#FFFFFF'), b.text('Garantia incondicional de 15 dias em qualquer plano.', '#AAA6BA')], 18, { css_classes: 'course-reveal', padding: sides(0, 0, 46, 0) }),
    b.grid(prices, 'repeat(3, 1fr)', 20, { grid_align_items: 'center' }),
  ], `${courseRootCss} selector .course-price{outline:1px solid rgba(255,255,255,.1);box-shadow:0 24px 70px rgba(0,0,0,.2)}selector .course-price-featured{outline:1px solid rgba(201,255,74,.45);box-shadow:0 30px 90px rgba(109,40,217,.28)}`), 'curso-pricing')
}

const makeCourseFaq = (): SectionNodeData => {
  const b = createBuilder()
  const faq = [
    ['O curso é para quem está começando?', 'Sim. Os fundamentos partem do zero, mas os exemplos e ferramentas também servem a profissionais experientes.'],
    ['Quanto tempo preciso por semana?', 'Com duas horas semanais você conclui a trilha principal em oito semanas e já aplica os exercícios no trabalho.'],
    ['As aulas são ao vivo?', 'O conteúdo principal é gravado. A clínica de casos e os encontros de comunidade ficam disponíveis também em replay.'],
    ['Posso pedir reembolso?', 'Sim. Você tem 15 dias para explorar o curso e solicitar reembolso integral, sem justificativa.'],
  ]
  const html = `<div class="course-faq-list">${faq.map(([q, a]) => `<details class="course-reveal"><summary>${q}<span>+</span></summary><p>${a}</p></details>`).join('')}</div>`
  return b.section('Curso · FAQ', b.root('#F5F3FA', [
    b.grid([
      b.stack([b.eyebrow('PERGUNTAS FREQUENTES', '#6D28D9'), b.heading('Antes de decidir.', 52, '#11131A'), b.text('Se sua dúvida não estiver aqui, fale com a equipe pelo WhatsApp.', '#626070')], 20, { css_classes: 'course-reveal' }),
      b.widget('html', { html, _css_classes: 'course-faq' }),
    ], '.72fr 1.28fr', 72),
  ], `${courseRootCss}
selector .course-faq-list details{border-top:1px solid rgba(17,19,26,.14);padding:22px 0;color:#11131a;font-family:Manrope,sans-serif}
selector .course-faq-list summary{display:flex;justify-content:space-between;gap:20px;cursor:pointer;list-style:none;font-size:18px;font-weight:700}
selector .course-faq-list summary::-webkit-details-marker{display:none}
selector .course-faq-list summary span{color:#6d28d9;font-size:22px;transition-property:transform;transition-duration:260ms}
selector .course-faq-list details[open] summary span{transform:rotate(45deg)}
selector .course-faq-list p{margin:14px 36px 0 0;color:#626070;font-size:15px;line-height:1.65}
`), 'curso-faq')
}

const makeCourseFinalCta = (): SectionNodeData => {
  const b = createBuilder()
  return b.section('Curso · CTA final', b.root('#8B5CF6', [
    b.stack([
      b.eyebrow('PRÓXIMA TURMA', '#DFFFA4'),
      b.heading('Seu time não precisa de mais cerimônias. Precisa de direção.', 58, '#FFFFFF'),
      b.text('Comece hoje e use o primeiro template ainda nesta semana.', '#E8E1FF', 17),
      b.button('Entrar no Direção de Produto', false),
    ], 24, { css_classes: 'course-reveal course-magnetic', flex_align_items: 'center', text_align: 'center' }),
  ], `${courseRootCss} selector{text-align:center}`), 'curso-cta-final')
}

export const createLandingTemplates = (): LandingTemplate[] => [
  createPetshopTemplate(),
  ...createInpelTemplates(),
  ...createZeloTemplates(),
  createUglyCashTemplate(),
  createMenuzitoTemplate(),
  createProcessBaseTemplate(),
  ...[createPdvLightLibraryTemplate()].filter((template): template is LandingTemplate => template !== null),
  {
    id: 'portfolio-editorial',
    name: 'Portfólio editorial',
    description: 'Narrativa de marca com manifesto, projetos, processo e prova social.',
    audience: 'Escritórios autorais',
    sections: [makeHero(false), makeAbout(), makeProjects(), makeProcess(), makeProof(), makeCta(false), makeFooter()],
  },
  {
    id: 'captacao-residencial',
    name: 'Captação residencial',
    description: 'Modelo orientado a conversão, com serviços claros e CTA recorrente.',
    audience: 'Projetos residenciais',
    sections: [makeHero(true), makeAbout(), makeServices(), makeProjects(), makeProcess(), makeProof(), makeCta(true), makeFooter()],
  },
  {
    id: 'curso-vsl',
    name: 'Curso com VSL',
    description: 'Página de infoproduto com vídeo, currículo, bônus, depoimentos, pricing e FAQ.',
    audience: 'Cursos e mentorias',
    sections: [makeCourseHero(), makeCourseOutcomes(), makeCourseCurriculum(), makeCourseBonus(), makeCourseProof(), makeCoursePricing(), makeCourseFaq(), makeCourseFinalCta()],
  },
]
