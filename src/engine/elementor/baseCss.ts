import type { ElementorKit } from './types';

/**
 * CSS base que o motor precisa para reproduzir o frontend do Elementor.
 * É uma reimplementação enxuta (não uma cópia) das regras do tema Hello,
 * do frontend.css do Elementor e do CSS de cada widget suportado.
 */

// Tema Hello Elementor: é o reset que os componentes da biblioteca assumem
// (por exemplo, as margens negativas compensam o margin-bottom de .9rem do <p>).
const HELLO_RESET = `
html{line-height:1.15;-webkit-text-size-adjust:100%}
*,:after,:before{box-sizing:border-box}
body{margin:0;background-color:#fff;color:#333;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;font-size:1rem;font-weight:400;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
h1,h2,h3,h4,h5,h6{color:inherit;font-family:inherit;font-weight:500;line-height:1.2;margin-block-end:1rem;margin-block-start:.5rem}
h1{font-size:2.5rem}h2{font-size:2rem}h3{font-size:1.75rem}h4{font-size:1.5rem}h5{font-size:1.25rem}h6{font-size:1rem}
p{margin-block-end:.9rem;margin-block-start:0}
a{background-color:transparent;color:#c36;text-decoration:none}
a:active,a:hover{color:#336}
b,strong{font-weight:bolder}
small{font-size:80%}
img{border-style:none;height:auto;max-width:100%}
label{display:inline-block;line-height:1;vertical-align:middle}
button,input,optgroup,select,textarea{font-family:inherit;font-size:1rem;line-height:1.5;margin:0}
input[type=date],input[type=email],input[type=number],input[type=password],input[type=search],input[type=tel],input[type=text],input[type=time],input[type=url],select,textarea{border:1px solid #666;border-radius:3px;padding:.5rem 1rem;transition:all .3s;width:100%}
textarea{overflow:auto;resize:vertical}
[type=button],[type=submit],button{background-color:transparent;border:1px solid #c36;border-radius:3px;color:#c36;display:inline-block;font-size:1rem;font-weight:400;padding:.5rem 1rem;text-align:center;transition:all .3s;user-select:none;white-space:nowrap;cursor:pointer}
`;

const ELEMENTOR_CORE = `
.elementor *,.elementor :after,.elementor :before{box-sizing:border-box}
.elementor img{border:none;border-radius:0;box-shadow:none;height:auto;max-width:100%}
.elementor a{box-shadow:none;text-decoration:none}
.elementor .elementor-widget:not(.elementor-widget-text-editor) figure{margin:0}
.elementor-widget{position:relative}
.elementor-widget-wrap>.elementor-widget:not(:last-child){margin-block-end:20px}
.elementor-element.elementor-absolute,.elementor-element.elementor-fixed{z-index:1}
.elementor-screen-only{position:absolute;top:-10000em;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0}
.elementor-hidden{display:none}
@media (min-width:1025px){.elementor .elementor-hidden-desktop{display:none}}
@media (min-width:768px) and (max-width:1024px){.elementor .elementor-hidden-tablet{display:none}}
@media (max-width:767px){.elementor .elementor-hidden-mobile,.elementor .elementor-hidden-phone{display:none}}

/* Containers (flexbox e grid) */
.e-con{display:flex;flex-direction:column;flex:0 1 auto;position:relative;min-width:0;width:100%;padding:10px;gap:20px;
  --container-widget-width:100%;--container-widget-height:initial;--container-widget-flex-grow:0;--container-widget-align-self:initial;
  transition:background .3s,border .3s,box-shadow .3s,transform .4s}
.e-con-boxed{gap:0}
.e-con>.e-con-inner{display:flex;flex-direction:column;flex:1 1 auto;gap:20px;width:100%;height:100%;margin:0 auto;max-width:min(100%,var(--container-max-width,1140px))}
.elementor>.e-con{margin-left:auto;margin-right:auto}
.e-con .elementor-widget{min-width:0}
.e-con>.elementor-widget,.e-con>.e-con-inner>.elementor-widget{max-width:100%}
.e-con>.elementor-widget>.elementor-widget-container,.e-con>.e-con-inner>.elementor-widget>.elementor-widget-container{height:100%}
@media (max-width:767px){
  .e-con.e-flex{width:100%}
  .e-con-full.e-flex,.e-con.e-flex>.e-con-inner{flex-wrap:wrap}
}

/* Seções e colunas (layout antigo) */
.elementor-section{position:relative}
.elementor-section>.elementor-container{display:flex;margin-left:auto;margin-right:auto;position:relative}
.elementor-section-boxed>.elementor-container{max-width:var(--container-max-width,1140px)}
.elementor-column{display:flex;min-height:1px;position:relative}
.elementor-container>.elementor-column>.elementor-widget-wrap{padding:var(--se-column-gap,10px)}
.elementor-widget-wrap{display:flex;flex-wrap:wrap;align-content:flex-start;position:relative;width:100%}
.elementor-widget-wrap>.elementor-element{width:100%}
@media (max-width:767px){.elementor-section>.elementor-container{flex-wrap:wrap}.elementor-column{width:100%}}

/* Ícones */
.elementor-icon{color:#69727d;display:inline-block;font-size:50px;line-height:1;text-align:center;transition:all .3s}
.elementor-icon:hover{color:#69727d}
.elementor-icon i,.elementor-icon svg,.elementor-icon .e-svg-icon{display:block;height:1em;position:relative;width:1em}
.elementor-icon i:before{left:50%;position:absolute;transform:translateX(-50%)}
.elementor-view-stacked .elementor-icon{background-color:#69727d;color:#fff;fill:#fff;padding:.5em}
.elementor-view-framed .elementor-icon{background-color:transparent;border:3px solid #69727d;color:#69727d;padding:.5em}
.elementor-shape-square .elementor-icon{border-radius:0}
.elementor-shape-rounded .elementor-icon{border-radius:10%}
.elementor-shape-circle .elementor-icon{border-radius:50%}
.e-svg-icon{display:inline-block;width:1em;height:1em;vertical-align:middle;background-color:currentColor;-webkit-mask:var(--e-svg) center/contain no-repeat;mask:var(--e-svg) center/contain no-repeat}

/* Botão */
.elementor-button{background-color:#69727d;border-radius:3px;color:#fff;display:inline-block;fill:#fff;font-size:15px;line-height:1;padding:12px 24px;text-align:center;transition:all .3s}
.elementor-button:focus,.elementor-button:hover,.elementor-button:visited{color:#fff}
.elementor-button-content-wrapper{display:flex;flex-direction:row;gap:5px;justify-content:center}
.elementor-button-icon{align-items:center;display:flex}
.elementor-button-icon svg{height:auto;width:1em}
.elementor-button-text{display:inline-block}
.elementor-button span{text-decoration:inherit}
.elementor-animation-grow,.elementor-animation-shrink,.elementor-animation-float,.elementor-animation-sink{transition-duration:.3s;transition-property:transform}
.elementor-animation-grow:hover{transform:scale(1.1)}
.elementor-animation-shrink:hover{transform:scale(.9)}
.elementor-animation-float:hover{transform:translateY(-8px)}
.elementor-animation-sink:hover{transform:translateY(8px)}
@media (prefers-reduced-motion:reduce){[class*=elementor-animation-]{transition:none!important}}
.elementor-button.elementor-size-xs{border-radius:2px;font-size:13px;padding:10px 20px}
.elementor-button.elementor-size-md{border-radius:4px;font-size:16px;padding:15px 30px}
.elementor-button.elementor-size-lg{border-radius:5px;font-size:18px;padding:20px 40px}
.elementor-button.elementor-size-xl{border-radius:6px;font-size:20px;padding:25px 50px}
`;

const WIDGETS_CSS = `
/* Heading */
.elementor-heading-title{line-height:1;margin:0;padding:0}
.elementor-widget-heading .elementor-heading-title[class*=elementor-size-]>a{color:inherit;font-size:inherit;line-height:inherit}
.elementor-widget-heading .elementor-heading-title.elementor-size-small{font-size:15px}
.elementor-widget-heading .elementor-heading-title.elementor-size-medium{font-size:19px}
.elementor-widget-heading .elementor-heading-title.elementor-size-large{font-size:29px}
.elementor-widget-heading .elementor-heading-title.elementor-size-xl{font-size:39px}
.elementor-widget-heading .elementor-heading-title.elementor-size-xxl{font-size:59px}

/* Image */
.elementor-widget-image{text-align:center}
.elementor-widget-image a{display:inline-block}
.elementor-widget-image img{display:inline-block;vertical-align:middle}
.elementor-widget-image a img[src$=".svg"]{width:48px}
.widget-image-caption{font-size:.9em;margin-top:.5em}

/* Icon */
.elementor-widget-icon .elementor-icon-wrapper{line-height:1;text-align:center}

/* Icon box */
.elementor-widget-icon-box .elementor-icon-box-wrapper{display:flex;flex-direction:column;text-align:center}
.elementor-widget-icon-box .elementor-icon-box-icon{display:inline-block;flex:0 0 auto;line-height:0}
.elementor-widget-icon-box .elementor-icon-box-content{flex-grow:1;width:100%}
.elementor-widget-icon-box .elementor-icon-box-title a{color:inherit}
.elementor-widget-icon-box .elementor-icon-box-description{margin:0}
${['', 'tablet-', 'mobile-']
  .map((prefix) => {
    const rules = `.elementor-widget-icon-box.elementor-${prefix}position-inline-end .elementor-icon-box-wrapper{flex-direction:row-reverse;text-align:end}
.elementor-widget-icon-box.elementor-${prefix}position-inline-start .elementor-icon-box-wrapper{flex-direction:row;text-align:start}
.elementor-widget-icon-box.elementor-${prefix}position-block-start .elementor-icon-box-wrapper{align-items:unset!important;flex-direction:column;text-align:center}
.elementor-widget-icon-box.elementor-${prefix}position-block-end .elementor-icon-box-wrapper{align-items:unset!important;flex-direction:column-reverse;text-align:center}`;
    if (prefix === 'tablet-') return `@media (max-width:1024px){${rules}}`;
    if (prefix === 'mobile-') return `@media (max-width:767px){${rules}}`;
    return rules;
  })
  .join('\n')}

/* Icon list */
.elementor-widget .elementor-icon-list-items{list-style-type:none;margin:0;padding:0}
.elementor-widget .elementor-icon-list-item{margin:0;padding:0;position:relative}
.elementor-widget .elementor-icon-list-item:after{inset-block-end:0;position:absolute;width:100%}
.elementor-widget .elementor-icon-list-item,.elementor-widget .elementor-icon-list-item a{align-items:var(--icon-vertical-align,center);display:flex;font-size:inherit}
.elementor-widget .elementor-icon-list-icon+.elementor-icon-list-text{align-self:center;padding-inline-start:5px}
.elementor-widget .elementor-icon-list-icon{display:flex;position:relative;top:var(--icon-vertical-offset,initial)}
.elementor-widget .elementor-icon-list-icon .e-svg-icon{height:var(--e-icon-list-icon-size,1em);width:var(--e-icon-list-icon-size,1em)}
.elementor-widget .elementor-icon-list-icon i{font-size:var(--e-icon-list-icon-size);width:1.25em}
.elementor-widget.elementor-widget-icon-list .elementor-icon-list-icon{text-align:var(--e-icon-list-icon-align)}
.elementor-widget.elementor-widget-icon-list .elementor-icon-list-icon .e-svg-icon{margin:var(--e-icon-list-icon-margin,0 calc(var(--e-icon-list-icon-size, 1em) * .25) 0 0)}
.elementor-widget.elementor-list-item-link-full_width a{width:100%}
.elementor-widget.elementor-icon-list--layout-inline .elementor-widget-container{overflow:hidden}
.elementor-widget .elementor-icon-list-items.elementor-inline-items{display:flex;flex-wrap:wrap;margin-inline:-8px}
.elementor-widget .elementor-icon-list-items.elementor-inline-items .elementor-inline-item{word-break:break-word}
.elementor-widget .elementor-icon-list-items.elementor-inline-items .elementor-icon-list-item{margin-inline:8px}
.elementor-widget .elementor-icon-list-items.elementor-inline-items .elementor-icon-list-item:after{border-width:0;border-inline-start-width:1px;border-style:solid;height:100%;inset-inline-end:-8px;inset-inline-start:auto;position:relative;width:auto}
.elementor-widget:not(.elementor-align-end) .elementor-icon-list-item:after{inset-inline-start:0}

/* Social icons */
.elementor-widget-social-icons .elementor-widget-container{text-align:center}
.elementor-widget-social-icons .elementor-social-icons-wrapper{display:flex;flex-wrap:wrap;gap:var(--grid-row-gap,5px) var(--grid-column-gap,5px);justify-content:var(--justify-content,center);font-size:0;line-height:1}
.elementor-widget-social-icons .elementor-grid-item{display:inline-flex}
.elementor-icon.elementor-social-icon{font-size:var(--icon-size,25px);height:calc(var(--icon-size, 25px) + 2 * var(--icon-padding, .5em));line-height:var(--icon-size,25px);width:calc(var(--icon-size, 25px) + 2 * var(--icon-padding, .5em))}
.elementor-social-icon{--e-social-icon-icon-color:#fff;align-items:center;background-color:#69727d;cursor:pointer;display:inline-flex;justify-content:center;text-align:center}
.elementor-social-icon i{color:var(--e-social-icon-icon-color)}
.elementor-social-icon .e-svg-icon{background-color:var(--e-social-icon-icon-color)}
.elementor-social-icon:hover{color:#fff;opacity:.9}
.elementor-social-icon-facebook,.elementor-social-icon-facebook-f{background-color:#3b5998}
.elementor-social-icon-twitter{background-color:#1da1f2}
.elementor-social-icon-x-twitter,.elementor-social-icon-threads,.elementor-social-icon-tiktok{background-color:#000}
.elementor-social-icon-instagram{background-color:#262626}
.elementor-social-icon-linkedin,.elementor-social-icon-linkedin-in{background-color:#0077b5}
.elementor-social-icon-youtube{background-color:#cd201f}
.elementor-social-icon-vk{background-color:#45668e}
.elementor-social-icon-behance{background-color:#1769ff}
.elementor-social-icon-pinterest,.elementor-social-icon-pinterest-p{background-color:#bd081c}
.elementor-social-icon-medium,.elementor-social-icon-medium-m{background-color:#00ab6b}
.elementor-social-icon-tumblr{background-color:#35465c}
.elementor-social-icon-vimeo,.elementor-social-icon-vimeo-v{background-color:#1ab7ea}
.elementor-social-icon-telegram,.elementor-social-icon-telegram-plane{background-color:#2ca5e0}
.elementor-social-icon-whatsapp{background-color:#25d366}
.elementor-social-icon-dribbble{background-color:#ea4c89}
.elementor-social-icon-github{background-color:#333}

/* Divider */
.elementor-widget-divider{--divider-border-style:none;--divider-border-width:1px;--divider-color:#0c0d0e;--divider-icon-size:20px;--divider-element-spacing:10px}
.elementor-widget-divider .elementor-divider{display:flex}
.elementor-widget-divider .elementor-divider__text{font-size:15px;line-height:1;max-width:95%}
.elementor-widget-divider .elementor-divider__element{flex-shrink:0;margin:0 var(--divider-element-spacing)}
.elementor-widget-divider .elementor-icon{font-size:var(--divider-icon-size)}
.elementor-widget-divider .elementor-divider-separator{direction:ltr;display:flex;margin:0}
.elementor-widget-divider--view-line_icon .elementor-divider-separator,.elementor-widget-divider--view-line_text .elementor-divider-separator{align-items:center}
.elementor-widget-divider--view-line_icon .elementor-divider-separator:after,.elementor-widget-divider--view-line_icon .elementor-divider-separator:before,.elementor-widget-divider--view-line_text .elementor-divider-separator:after,.elementor-widget-divider--view-line_text .elementor-divider-separator:before{border-block-end:0;border-block-start:var(--divider-border-width) var(--divider-border-style) var(--divider-color);content:"";display:block;flex-grow:1}
.elementor-widget-divider--element-align-start .elementor-divider-separator:before,.elementor-widget-divider--element-align-end .elementor-divider-separator:after{content:none}
.elementor-widget-divider--element-align-start .elementor-divider__element{margin-inline-start:0}
.elementor-widget-divider--element-align-end .elementor-divider__element{margin-inline-end:0}
.elementor-widget-divider:not(.elementor-widget-divider--view-line_text):not(.elementor-widget-divider--view-line_icon) .elementor-divider-separator{border-block-start:var(--divider-border-width) var(--divider-border-style) var(--divider-color)}
.e-con>.elementor-widget-divider,.e-con-inner>.elementor-widget-divider{width:var(--container-widget-width,100%);flex-grow:var(--container-widget-flex-grow)}

/* Spacer */
.elementor-widget-spacer .elementor-spacer-inner{height:var(--spacer-size)}
.e-con>.elementor-widget-spacer,.e-con-inner>.elementor-widget-spacer{width:var(--container-widget-width,var(--spacer-size));align-self:var(--container-widget-align-self,initial);flex-shrink:0}
.e-con>.elementor-widget-spacer>.elementor-widget-container,.e-con-inner>.elementor-widget-spacer>.elementor-widget-container{height:100%;width:100%}
.e-con>.elementor-widget-spacer .elementor-spacer,.e-con-inner>.elementor-widget-spacer .elementor-spacer{height:100%}
.e-con>.elementor-widget-spacer .elementor-spacer-inner,.e-con-inner>.elementor-widget-spacer .elementor-spacer-inner{height:var(--container-widget-height,var(--spacer-size))}

/* Counter */
.elementor-counter{align-items:stretch;display:flex;flex-direction:column-reverse;justify-content:center}
.elementor-counter .elementor-counter-number{flex-grow:var(--counter-number-grow,0)}
.elementor-counter .elementor-counter-number-wrapper{display:flex;flex:1;font-size:69px;font-weight:600;line-height:1;text-align:center}
.elementor-counter .elementor-counter-number-prefix{flex-grow:var(--counter-prefix-grow,1);text-align:end;white-space:pre-wrap}
.elementor-counter .elementor-counter-number-suffix{flex-grow:var(--counter-suffix-grow,1);text-align:start;white-space:pre-wrap}
.elementor-counter .elementor-counter-title{align-items:center;display:flex;flex:1;font-size:19px;font-weight:400;justify-content:center;line-height:2.5;margin:0;padding:0}

/* Nested carousel */
.elementor-widget-nested-carousel{--e-n-carousel-slides:3;--e-n-carousel-gap:10px}
.elementor-widget-nested-carousel .e-n-carousel{position:relative}
.elementor-widget-nested-carousel .swiper-wrapper{display:flex;gap:var(--e-n-carousel-gap);overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none}
.elementor-widget-nested-carousel .swiper-wrapper::-webkit-scrollbar{display:none}
.elementor-widget-nested-carousel .swiper-slide{display:flex;flex:0 0 calc((100% - (var(--e-n-carousel-slides) - 1) * var(--e-n-carousel-gap)) / var(--e-n-carousel-slides));overflow:hidden;scroll-snap-align:start}
.elementor-swiper-button{position:absolute;z-index:2;display:inline-flex;cursor:pointer;font-size:25px;color:hsla(0,0%,93%,.9);fill:currentColor;top:50%;transform:translateY(-50%)}
.elementor-swiper-button svg{width:1em;height:1em;fill:currentColor}
.elementor-swiper-button-prev{left:10px}
.elementor-swiper-button-next{right:10px}
.elementor-widget-nested-carousel .swiper-pagination{display:flex;justify-content:center;gap:12px;z-index:2}
.swiper-pagination-bullet{display:inline-block;width:6px;height:6px;border-radius:50%;background:#000;opacity:.2;cursor:pointer}
.swiper-pagination-bullet-active,.swiper-pagination-bullet:hover{opacity:1}

/* Nested accordion */
.e-n-accordion{display:flex;flex-direction:column}
.e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 15px;border:1px solid #d5d8dc;cursor:pointer;list-style:none;color:#1f2124}
.e-n-accordion-item-title::-webkit-details-marker{display:none}
.e-n-accordion-item:not([open]) .e-opened,.e-n-accordion-item[open] .e-closed{display:none}
.e-n-accordion-item>.e-con{border:1px solid #d5d8dc;border-top:none}

/* Form */
.elementor-form-fields-wrapper{display:flex;flex-wrap:wrap;margin-left:calc(var(--e-form-column-gap,10px) / -2);margin-right:calc(var(--e-form-column-gap,10px) / -2);margin-bottom:calc(var(--e-form-row-gap,10px) * -1)}
.elementor-field-group{display:flex;align-items:center;flex-wrap:wrap;padding-left:calc(var(--e-form-column-gap,10px) / 2);padding-right:calc(var(--e-form-column-gap,10px) / 2);margin-bottom:var(--e-form-row-gap,10px)}
.elementor-field-group.elementor-field-type-submit{align-items:flex-end}
.elementor-labels-above .elementor-field-group>.elementor-field-label,.elementor-labels-above .elementor-field-group>input,.elementor-labels-above .elementor-field-group>textarea,.elementor-labels-above .elementor-field-group>.elementor-select-wrapper,.elementor-labels-above .elementor-field-group .elementor-field-subgroup{flex-basis:100%;max-width:100%}
.elementor-field-label{cursor:pointer}
.elementor-field-group .elementor-field-textual{background-color:#fff;border:1px solid #69727d;color:#1f2124;flex-grow:1;max-width:100%;vertical-align:middle;width:100%;line-height:1.4;font-size:15px;min-height:40px;padding:5px 14px;border-radius:3px}
.elementor-field-group .elementor-field-textual:focus{box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);outline:0}
.elementor-field-group .elementor-field-textual::placeholder{color:inherit;font-family:inherit;opacity:.6}
.elementor-field-group .elementor-select-wrapper{display:flex;position:relative;width:100%}
.elementor-field-group .elementor-select-wrapper select{appearance:none;-webkit-appearance:none;color:inherit;flex-basis:100%;font:inherit;padding-inline-end:20px}
.elementor-field-subgroup{display:flex;flex-wrap:wrap;gap:4px 16px}
.elementor-field-option label{display:inline-block;margin-inline-start:4px}
.elementor-field-textual.elementor-size-xs{border-radius:2px;font-size:13px;min-height:33px;padding:4px 12px}
.elementor-field-textual.elementor-size-md{border-radius:4px;font-size:16px;min-height:47px;padding:6px 16px}
.elementor-field-textual.elementor-size-lg{border-radius:5px;font-size:18px;min-height:59px;padding:7px 20px}
.elementor-field-textual.elementor-size-xl{border-radius:6px;font-size:20px;min-height:72px;padding:8px 24px}
.elementor-form .elementor-button{border:none;padding-block:0;white-space:normal}
.elementor-form .elementor-button-content-wrapper,.elementor-form .elementor-button>span{display:flex;flex-direction:row;gap:5px;justify-content:center}
.elementor-form .elementor-button.elementor-size-xs{min-height:33px}
.elementor-form .elementor-button.elementor-size-sm{min-height:40px}
.elementor-form .elementor-button.elementor-size-md{min-height:47px}
.elementor-form .elementor-button.elementor-size-lg{min-height:59px}
.elementor-form .elementor-button.elementor-size-xl{min-height:72px}
.elementor-button-align-stretch .elementor-field-type-submit .elementor-button{flex-basis:100%}
.elementor-button-align-center .elementor-field-type-submit{justify-content:center}
.elementor-button-align-start .elementor-field-type-submit{justify-content:flex-start}
.elementor-button-align-end .elementor-field-type-submit{justify-content:flex-end}

/* Search form (skin clássica) */
.elementor-search-form{display:block}
.elementor-search-form__container{display:flex;overflow:hidden;border:0 solid transparent;min-height:50px}
.elementor-search-form input[type=search]{flex-basis:100%;flex-grow:1;min-width:0;width:auto;margin:0;border:0;border-radius:0;background:none;padding:0 15px;font-size:15px;color:inherit;outline:0;appearance:none;-webkit-appearance:none}
.elementor-search-form__input::-webkit-search-cancel-button{display:none}
.elementor-search-form__submit{display:flex;align-items:center;justify-content:center;gap:6px;flex-shrink:0;border:0;border-radius:0;padding:0 12px;background-color:#69727d;color:#fff;font-size:16px;cursor:pointer;transition:color .3s,background .3s}
${[10, 11, 12, 14, 16, 20, 25, 30, 33, 40, 50, 60, 66, 70, 75, 80, 83, 90, 100]
  .map((n) => `.elementor-col-${n}{width:${n === 33 ? 33.333 : n === 66 ? 66.666 : n === 16 ? 16.666 : n === 83 ? 83.333 : n === 14 ? 14.285 : n === 11 ? 11.111 : n === 12 ? 12.5 : n}%}`)
  .join('')}
@media (max-width:767px){.elementor-field-group.elementor-column{width:100%}}

/* Price list */
.elementor-price-list{list-style:none;margin:0;padding:0}
.elementor-price-list li{margin:0;padding:0}
.elementor-price-list-item-link{display:block;color:inherit}
.elementor-price-list-item{display:flex;align-items:flex-start}
.elementor-price-list-image{flex-shrink:0;max-width:50%;padding-right:25px}
.elementor-price-list-image img{width:100%}
.elementor-price-list-text{flex-grow:1;display:flex;flex-direction:column}
.elementor-price-list-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap;font-size:19px;font-weight:600;line-height:1.3;margin-bottom:5px}
.elementor-price-list-title{max-width:80%}
.elementor-price-list-separator{flex-grow:1;height:0}
.elementor-price-list-description{font-size:15px;margin:0}

/* Rating */
.e-rating{display:flex}
.e-rating .e-rating-wrapper{display:flex;flex-wrap:wrap;gap:0}
.e-rating .e-icon{position:relative;font-size:24px;line-height:0}
.e-rating .e-icon-wrapper svg{display:block;width:1em;height:1em}
.e-rating .e-icon-marked{position:absolute;inset:0;width:var(--e-rating-icon-marked-width,100%);overflow:hidden;z-index:1;fill:#f0ad4e}
.e-rating .e-icon-unmarked{fill:#ccd6df}

/* Progress */
.elementor-widget-progress .elementor-title{display:block}
.elementor-progress-wrapper{background-color:#eee;border-radius:2px;color:#fff;overflow:hidden;position:relative}
.elementor-progress-bar{display:flex;align-items:center;height:30px;line-height:30px;background-color:#69727d;font-size:11px;transition:width 1s ease-in-out}
.elementor-progress-text{flex-grow:1;padding-inline-start:15px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.elementor-progress-percentage{padding-inline-end:15px}

/* Google Maps e vídeo */
.elementor-widget-google_maps .elementor-custom-embed{line-height:0}
.elementor-widget-google_maps iframe{height:300px;width:100%;border:0}
.elementor-widget-video .elementor-wrapper{position:relative;overflow:hidden;aspect-ratio:16/9;background:#000}
.elementor-video{position:absolute;inset:0;width:100%;height:100%;border:0}
.elementor-custom-embed-image-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:50%;cursor:pointer}
.elementor-custom-embed-play i{font-size:100px;color:#fff;text-shadow:1px 0 6px rgba(0,0,0,.3)}

/* Image box */
.elementor-widget-image-box .elementor-image-box-wrapper{display:flex;flex-direction:column;text-align:center}
.elementor-widget-image-box .elementor-image-box-img{display:inline-block;flex:0 0 auto;margin:0;width:30%;line-height:0}
.elementor-widget-image-box.elementor-position-block-start .elementor-image-box-img{margin-inline:auto}
.elementor-widget-image-box.elementor-position-inline-start .elementor-image-box-wrapper{flex-direction:row;text-align:start}
.elementor-widget-image-box.elementor-position-inline-end .elementor-image-box-wrapper{flex-direction:row-reverse;text-align:end}
.elementor-widget-image-box .elementor-image-box-img img{display:block;width:100%}
.elementor-widget-image-box .elementor-image-box-content{flex-grow:1;width:100%}
.elementor-widget-image-box .elementor-image-box-description{margin:0}

/* Widget sem renderizador */
.se-unsupported{padding:16px;border:1px dashed #b8bec8;border-radius:4px;background:repeating-linear-gradient(45deg,#f6f7f9,#f6f7f9 8px,#fff 8px,#fff 16px);color:#5b6270;font:13px/1.4 system-ui,sans-serif;text-align:center}
`;

/**
 * Regras que o Elementor gera a partir do Kit (cores e fontes globais) para
 * os widgets que não têm cor/fonte definida no próprio JSON.
 */
const kitCss = (kit: ElementorKit) => {
  const vars = [
    ...Object.entries(kit.colors).map(([id, value]) => `--e-global-color-${id}:${value}`),
    ...Object.entries(kit.typography).flatMap(([id, t]) => [
      t.family && `--e-global-typography-${id}-font-family:"${t.family}"`,
      t.weight && `--e-global-typography-${id}-font-weight:${t.weight}`,
    ]),
  ].filter(Boolean);

  const font = (id: string) => `font-family:var(--e-global-typography-${id}-font-family),Sans-serif;font-weight:var(--e-global-typography-${id}-font-weight)`;
  const c = (id: string) => `var(--e-global-color-${id})`;

  return `
:root{${vars.join(';')};--container-max-width:${kit.containerWidth}px}
@media (max-width:1024px){:root{--container-max-width:1024px}}
@media (max-width:767px){:root{--container-max-width:767px}}
.elementor-widget-heading .elementor-heading-title{${font('primary')};color:${c('primary')}}
.elementor-widget-text-editor{${font('text')};color:${c('text')}}
.elementor-widget-image .widget-image-caption{${font('text')};color:${c('text')}}
.elementor-widget-button .elementor-button{${font('accent')};background-color:${c('accent')}}
.elementor-widget-icon.elementor-view-stacked .elementor-icon,.elementor-widget-icon-box.elementor-view-stacked .elementor-icon{background-color:${c('primary')}}
.elementor-widget-icon.elementor-view-framed .elementor-icon,.elementor-widget-icon.elementor-view-default .elementor-icon,.elementor-widget-icon-box.elementor-view-framed .elementor-icon,.elementor-widget-icon-box.elementor-view-default .elementor-icon{color:${c('primary')};border-color:${c('primary')};fill:${c('primary')}}
.elementor-widget-icon-box .elementor-icon-box-title,.elementor-widget-icon-box .elementor-icon-box-title a{${font('primary')}}
.elementor-widget-icon-box .elementor-icon-box-title{color:${c('primary')}}
.elementor-widget-icon-box .elementor-icon-box-description{${font('text')};color:${c('text')}}
.elementor-widget-icon-list .elementor-icon-list-item:not(:last-child):after{border-color:${c('text')}}
.elementor-widget-icon-list .elementor-icon-list-icon i,.elementor-widget-icon-list .elementor-icon-list-icon .e-svg-icon{color:${c('primary')}}
.elementor-widget-icon-list .elementor-icon-list-text{color:${c('secondary')}}
.elementor-widget-icon-list .elementor-icon-list-item>.elementor-icon-list-text,.elementor-widget-icon-list .elementor-icon-list-item>a{${font('text')}}
.elementor-widget-counter .elementor-counter-number-wrapper{${font('primary')};color:${c('primary')}}
.elementor-widget-counter .elementor-counter-title{${font('secondary')};color:${c('secondary')}}
.elementor-widget-divider{--divider-color:${c('secondary')}}
.elementor-widget-divider .elementor-divider__text{${font('secondary')};color:${c('secondary')}}
.elementor-widget-divider.elementor-view-stacked .elementor-icon{background-color:${c('secondary')}}
.elementor-widget-divider.elementor-view-framed .elementor-icon,.elementor-widget-divider.elementor-view-default .elementor-icon{color:${c('secondary')};border-color:${c('secondary')};fill:${c('secondary')}}
.elementor-widget-form .elementor-field-group>label,.elementor-widget-form .elementor-field-subgroup label{color:${c('text')}}
.elementor-widget-form .elementor-field-group .elementor-field,.elementor-widget-form .elementor-field-subgroup label{${font('text')}}
.elementor-widget-form .elementor-button{${font('accent')};background-color:${c('accent')}}
.elementor-widget-image-box .elementor-image-box-title{${font('primary')};color:${c('primary')}}
.elementor-widget-image-box .elementor-image-box-description{${font('text')};color:${c('text')}}
.elementor-widget-price-list .elementor-price-list-header{${font('primary')};color:${c('primary')}}
.elementor-widget-price-list .elementor-price-list-description{${font('text')};color:${c('text')}}
.elementor-widget-price-list .elementor-price-list-separator{border-bottom-color:${c('secondary')}}
.elementor-widget-progress .elementor-progress-wrapper .elementor-progress-bar{background-color:${c('primary')}}
.elementor-widget-progress .elementor-title{${font('text')};color:${c('primary')}}
.elementor-widget-nested-accordion .e-n-accordion-item-title-text{${font('accent')}}
`;
};

export const buildBaseCss = (kit: ElementorKit) => [HELLO_RESET, ELEMENTOR_CORE, WIDGETS_CSS, kitCss(kit)].join('\n');
