import { useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ZELO as C, ZELO_FONTS as F, ZELO_LAYOUT as L } from '@/features/zelo/tokens'

/** Guia da marca Zelo. Todo o CSS fica preso em `.zl-guide`. */

const A = '/zelo/assets'

const FONT_FACES = [
  ['Plus Jakarta Sans', 'jakarta-latin', '800'],
  ['Nunito', 'nunito-latin', '400 900'],
  ['Figtree', 'figtree-latin', '300 900'],
  ['Spline Sans Mono', 'spline-mono-latin', '400 600'],
].map(([family, file, weight]) => `@font-face{font-family:"${family}";src:url('${A}/fonts/${file}.woff2') format('woff2');font-weight:${weight};font-display:swap}`).join('')

const CSS = `${FONT_FACES}
.zl-guide{min-height:100vh;background:${C.paper};color:${C.ink};font-family:"${F.text}",system-ui,sans-serif;font-size:12.8px;line-height:1.62;-webkit-font-smoothing:antialiased}
.zl-guide *{box-sizing:border-box}
.zl-guide__wrap{max-width:1120px;margin:0 auto;padding:0 clamp(14.72px,3.2vw,38.4px)}
.zl-guide__bar{display:flex;align-items:center;justify-content:space-between;min-height:57px;border-bottom:1px solid ${C.line}}
.zl-guide__bar a{color:${C.soft};font-family:"${F.ui}";font-weight:500;text-decoration:none;transition:color .18s ease}
.zl-guide__bar a:hover{color:${C.green}}
.zl-guide section{padding:clamp(40px,6vw,72px) 0;border-bottom:1px solid ${C.line}}
.zl-guide h1{font-family:"${F.title}";font-weight:800;font-size:clamp(30.72px,4.96vw,53.12px);line-height:1.04;letter-spacing:-.032em;margin:0 0 22px;max-width:14ch;text-wrap:balance}
.zl-guide h2{font-family:"${F.ui}";font-weight:800;font-size:clamp(23.68px,3.12vw,34.56px);line-height:1.08;letter-spacing:-.032em;margin:0 0 24px}
.zl-guide p{margin:0}
.zl-guide__rail{display:flex;align-items:center;gap:10px;color:${C.green};font-family:"${F.ui}";font-weight:700;font-size:11.52px;margin-bottom:9px}
.zl-guide__rail::after{content:"";flex:1;height:1px;background:currentColor;opacity:.3}
.zl-guide__lede{color:${C.soft};font-size:14.46px;max-width:62ch;margin-top:14px}
.zl-guide__verde{background:linear-gradient(100deg,${C.titleDeep} 0%,${C.titleGreen} 32%,${C.titleShine} 47%,${C.titleGreen} 62%,${C.titleDeep} 100%) 0 0/210% 100% no-repeat;-webkit-background-clip:text;background-clip:text;color:transparent}
@media (prefers-reduced-motion:no-preference){.zl-guide__verde{animation:zl-guide-brilho 2.8s ease-in-out infinite alternate}}
@keyframes zl-guide-brilho{to{background-position:100% 0}}
.zl-guide__swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1px;background:${C.line};border:1px solid ${C.line};border-radius:${L.radius.md}px;overflow:hidden}
.zl-guide__swatch{background:${C.paper};padding:14px}
.zl-guide__swatch i{display:block;height:56px;border-radius:${L.radius.sm}px;border:1px solid ${C.lineStrong};margin-bottom:10px}
.zl-guide__swatch b{display:block;font-family:"${F.ui}";font-weight:600;font-size:12.29px}
.zl-guide__swatch code{font-family:"${F.mono}";font-size:10.5px;color:${C.soft}}
.zl-guide__type{display:grid;gap:18px}
.zl-guide__type div{display:grid;grid-template-columns:180px minmax(0,1fr);gap:16px;align-items:baseline;padding-bottom:18px;border-bottom:1px solid ${C.line}}
.zl-guide__type small{font-family:"${F.mono}";font-size:10.5px;color:${C.green}}
@media (max-width:767px){.zl-guide__type div{grid-template-columns:1fr;gap:6px}}
.zl-guide__row{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
.zl-guide__btn{display:inline-flex;align-items:center;font-family:"${F.ui}";font-weight:600;font-size:11.14px;padding:9.22px 14.72px;border-radius:999px;border:1px solid ${C.green};background:${C.green};color:#000;text-decoration:none;transition:transform .16s ease,background-color .16s ease,border-color .16s ease,color .16s ease}
.zl-guide__btn:hover{transform:translateY(-1px);background:${C.green2};border-color:${C.green2}}
.zl-guide__btn--ghost{background:transparent;color:${C.ink};border-color:${C.lineStrong}}
.zl-guide__btn--ghost:hover{background:transparent;color:${C.green};border-color:${C.green}}
.zl-guide__btn:focus-visible{outline:2px solid ${C.green};outline-offset:3px}
@media (prefers-reduced-motion:reduce){.zl-guide__btn:hover{transform:none}}
.zl-guide__pill{font-family:"${F.ui}";font-weight:700;font-size:11.26px;color:${C.green};padding:2.56px 9.22px;border:1px solid ${C.lineStrong};border-radius:999px}
.zl-guide__cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px}
.zl-guide__card{background:${C.raised};border:1px solid ${C.lineStrong};padding:20px}
.zl-guide__card b{display:block;font-family:"${F.ui}";font-weight:600;font-size:12.29px;margin-bottom:6px}
.zl-guide__card p{color:${C.soft};font-size:11.65px}
.zl-guide__icons{display:flex;flex-wrap:wrap;gap:14px}
.zl-guide__icons img{width:21px;height:21px}
.zl-guide__foot{padding:32px 0 48px;color:${C.soft};font-size:10.88px}
.zl-guide__foot a{color:${C.green}}
`

const SWATCHES: Array<[string, string]> = [
  ['Papel', C.paper], ['Cartão', C.raised], ['Faixa', C.band], ['Tinta', C.ink], ['Tinta suave', C.soft],
  ['Verde da marca', C.green], ['Verde 2', C.green2], ['Linha 20%', C.line], ['Linha forte 38%', C.lineStrong],
  ['Vermelho (horas)', C.red], ['No ar', C.online],
]

const TYPE: Array<[string, string, CSSProperties]> = [
  ['Hero · Plus Jakarta Sans 800', 'Seu negócio perde tempo.', { fontFamily: F.title, fontWeight: 800, fontSize: 'clamp(30.72px,4.96vw,53.12px)', lineHeight: 1, letterSpacing: '-.032em' }],
  ['Seção · Nunito 800', 'Você decide, a IA executa.', { fontFamily: F.ui, fontWeight: 800, fontSize: 'clamp(23.68px,3.12vw,34.56px)', lineHeight: 1.08, letterSpacing: '-.032em' }],
  ['Operação · Nunito 700', 'Organiza por critério.', { fontFamily: F.ui, fontWeight: 700, fontSize: 'clamp(18.56px,2.1vw,24.96px)', lineHeight: 1.16, letterSpacing: '-.028em' }],
  ['Lede · Figtree 400', 'Você vê a automação funcionando numa demo antes de decidir.', { fontFamily: F.text, fontSize: 14.46, color: C.soft }],
  ['Números · Spline Sans Mono', '38h · 0.2s · #128', { fontFamily: F.mono, fontWeight: 500, fontSize: 20, color: C.red }],
]

const ICONS = ['chat', 'espalhado', 'sino', 'alerta', 'escudo', 'relogio', 'troca', 'equipe', 'mira', 'lupa', 'celular', 'faisca', 'cadeado', 'janela', 'infinito', 'planilha', 'caixa', 'check']

const ZeloStyleGuide = () => {
  useEffect(() => {
    const previous = document.title
    document.title = 'Zelo · guia de estilo'
    return () => { document.title = previous }
  }, [])

  return (
    <main className="zl-guide">
      <style>{CSS}</style>
      <div className="zl-guide__wrap">
        <nav className="zl-guide__bar" aria-label="Guia">
          <img src={`${A}/zelo-wordmark.png`} alt="Zelo" width={71} height={21} />
          <Link to="/zelo-elementor-preview">Ver o template no Elementor</Link>
        </nav>

        <section>
          <p className="zl-guide__rail">Zelo · guia de estilo</p>
          <h1>Automação e IA <span className="zl-guide__verde">sob medida</span>.</h1>
          <p className="zl-guide__lede">Papel preto, letra branca e um verde viridian que entra só nos elementos: rótulo, palavra pintada, ícone e botão. Nada de bloco inteiro em verde.</p>
        </section>

        <section id="cor">
          <h2>Cor</h2>
          <div className="zl-guide__swatches">
            {SWATCHES.map(([name, value]) => (
              <div className="zl-guide__swatch" key={name}><i style={{ background: value }} /><b>{name}</b><code>{value}</code></div>
            ))}
          </div>
        </section>

        <section>
          <h2>Tipografia</h2>
          <div className="zl-guide__type">
            {TYPE.map(([label, sample, style]) => (
              <div key={label}><small>{label}</small><p style={style}>{sample}</p></div>
            ))}
          </div>
          <p className="zl-guide__lede">O site mede tudo em rem com a raiz a 80% (1rem = 12,8px). No Elementor os valores entram em px.</p>
        </section>

        <section>
          <h2>Controles e superfícies</h2>
          <div className="zl-guide__row" style={{ marginBottom: 24 }}>
            <a className="zl-guide__btn" href="#cor">Agendar uma conversa</a>
            <a className="zl-guide__btn zl-guide__btn--ghost" href="#cor">Fazer a conta do meu tempo</a>
            <span className="zl-guide__pill">Análise</span>
          </div>
          <div className="zl-guide__cards">
            <div className="zl-guide__card" style={{ borderRadius: L.radius.sm }}><b>Aviso · 11px</b><p>Borda de 38% e filete verde de 3px à esquerda.</p></div>
            <div className="zl-guide__card" style={{ borderRadius: L.radius.md }}><b>Cartão · 16px</b><p>Total da conta, telinhas das operações e FAQ.</p></div>
            <div className="zl-guide__card" style={{ borderRadius: L.radius.lg }}><b>Painel · 21px</b><p>Livro-razão, documento do agente e formulário.</p></div>
          </div>
        </section>

        <section>
          <h2>Ícones</h2>
          <div className="zl-guide__icons">
            {ICONS.map((name) => <img key={name} src={`${A}/icons/${name}.svg`} alt={name} title={name} />)}
          </div>
        </section>

        <p className="zl-guide__foot">Fonte: zelosistemas.com.br, estilos calculados em 1440, 900 e 390px. Templates em <Link to="/zelo-elementor-preview">/zelo-elementor-preview</Link>.</p>
      </div>
    </main>
  )
}

export default ZeloStyleGuide
