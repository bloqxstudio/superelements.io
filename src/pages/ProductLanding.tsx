import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check, CircleCheck, CloudUpload, Eye, FileText, Heading1, Layers3, Library, LayoutGrid, MousePointer2, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PLANS, EXTRA_SITE, brl } from '@/features/superelements/plans';
import './ProductLanding.css';

const STEPS = [
  { n: '01', title: 'Peça em uma frase.', text: 'Diga o que mudar. O agente lê a página e entende a estrutura.' },
  { n: '02', title: 'Veja antes de valer.', text: 'A mudança aparece no canvas, camada por camada, ainda como rascunho.' },
  { n: '03', title: 'Publique com um clique.', text: 'Backup automático, histórico e volta atrás quando quiser.' },
  { n: '04', title: 'No ar.', text: 'Seu WordPress atualizado, em Elementor nativo.' },
];

const FAQ = [
  ['Preciso trocar minha hospedagem?', 'Não. No plano Produto o Superelements conecta ao WordPress que você já tem. A hospedagem gerenciada é opcional.'],
  ['O site deixa de ser WordPress?', 'Não. Continua WordPress e Elementor. O Superelements é a camada visual para criar, organizar e publicar.'],
  ['Preciso usar um agente de IA?', 'Não. Dá para editar à mão no canvas. O agente acelera, mas a decisão de publicar é sempre sua.'],
  ['Dá para cuidar de vários clientes?', 'Sim. No plano Agência, cada cliente tem marca, equipe e WordPress próprios, tudo na mesma conta.'],
];

const Story: React.FC = () => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(p, 'change', (v) => setStep(v < 0.28 ? 0 : v < 0.55 ? 1 : v < 0.8 ? 2 : 3));

  const rotateX = useTransform(p, [0, 0.2], [reduce ? 0 : 34, 0]);
  const scale = useTransform(p, [0, 0.2, 0.8, 1], [reduce ? 1 : 0.78, 1, 1.03, 1.04]);
  const y = useTransform(p, [0, 0.2], [reduce ? 0 : 80, 0]);
  const cx = useTransform(p, [0.5, 0.78], ['18%', '82%']);
  const cy = useTransform(p, [0.5, 0.78], ['70%', '9%']);
  const cOpacity = useTransform(p, [0.5, 0.58, 0.9, 0.96], [0, 1, 1, 0]);

  const s = reduce ? 3 : step;
  const changed = s >= 1;
  const publishing = s >= 2;
  return (
    <section ref={ref} className="lp-story" aria-label="Como funciona">
      <div className="lp-story__sticky">
        <div className="lp-story__caption">
          <AnimatePresence mode="wait">
            <motion.div key={s} initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }} transition={{ duration: 0.4 }}>
              <span>{STEPS[s].n}</span><h2>{STEPS[s].title}</h2><p>{STEPS[s].text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.div className="lp-win" style={{ rotateX, scale, y }}>
          <div className="lp-win__bar"><span><FileText /> Home</span><span className="lp-hide"><Layers3 /> Navigator</span><span className="lp-hide"><Library /> Biblioteca</span><b />
            <span className="lp-hide"><Eye /> Player</span>
            <em className={publishing ? 'is-on' : ''}>{s === 3 ? <><Check /> Publicado</> : <><CloudUpload /> Publicar no site</>}</em></div>
          <div className="lp-win__body">
            <aside className="lp-hide">
              <i className="on"><LayoutGrid /> Abertura</i>
              <i className="sub"><Heading1 /> Título</i>
              <i className="sub"><MousePointer2 /> Botão</i>
              <i><LayoutGrid /> Cardápio</i><i><LayoutGrid /> A história</i>
            </aside>
            <div className="lp-win__canvas">
              <div className="lp-site">
                <header><b>AURORA</b><span>Cardápio · O café · Contato</span></header>
                <small>torra local · desde 2018</small>
                <h3 className={changed ? 'changed' : ''}>
                  <AnimatePresence mode="wait"><motion.span key={changed ? 'b' : 'a'} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                    {changed ? 'Café fresco, mesa livre e cidade devagar.' : 'O café que faz a cidade pausar.'}
                  </motion.span></AnimatePresence>
                </h3>
                <p>Grãos brasileiros, cozinha aberta e uma mesa esperando por você.</p>
                <button type="button">Reservar uma mesa</button>
                {changed && <motion.label initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}><Sparkles /> Claude Code mudou</motion.label>}
              </div>
              {s === 0 && <motion.div className="lp-chat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>“Deixe o título do hero mais acolhedor.”</motion.div>}
              {s === 3 && <motion.div className="lp-toast" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}><CircleCheck /> Home publicada em cafeaurora.com.br</motion.div>}
            </div>
          </div>
          {!reduce && <motion.div className="lp-cursor" style={{ left: cx, top: cy, opacity: cOpacity }}><MousePointer2 /></motion.div>}
        </motion.div>
      </div>
    </section>
  );
};

const ProductLanding: React.FC = () => (
  <div className="lp">
    <nav className="lp-nav"><Link to="/" className="lp-nav__brand"><Logo /><b>superelements</b></Link>
      <div><a href="#como">Como funciona</a><a href="#precos">Preços</a><a href="#duvidas">Dúvidas</a></div>
      <Link to="/auth" className="lp-btn lp-btn--light">Entrar</Link></nav>

    <header className="lp-hero">
      <div className="lp-glow" aria-hidden />
      <span className="lp-pill"><i /> Elementor, sem a complicação</span>
      <h1>O Elementor<br />ficou <em>simples.</em></h1>
      <p>Crie, mude e publique páginas do seu WordPress num canvas visual. Com ou sem agente de IA.</p>
      <div className="lp-hero__cta"><Link to="/auth" className="lp-btn lp-btn--lime">Começar agora <ArrowRight /></Link><a href="#como" className="lp-btn lp-btn--ghost">Ver em ação</a></div>
    </header>

    <div id="como"><Story /></div>

    <section className="lp-big">
      <h2>Todos os seus clientes<br /><em>num lugar só.</em></h2>
      <p>Um projeto por cliente, cada um com marca, equipe e WordPress próprios. Sem abrir um painel por site.</p>
      <div className="lp-stats">
        <div><b>3.503</b><span>seções prontas</span></div>
        <div><b>17</b><span>categorias</span></div>
        <div><b>100%</b><span>Elementor nativo</span></div>
      </div>
    </section>

    <section className="lp-big lp-big--grid">
      {[['Marca aplicada', 'Cores, fontes e botões do projeto em cada seção nova.'], ['Componentes ligados', 'Mude um, atualize todos. Cabeçalho e rodapé do site inteiro.'], ['Aprovação por link', 'O cliente vê, comenta e aprova sem criar conta.'], ['Volta atrás', 'Backup antes de publicar e histórico para restaurar.']].map(([t, d]) => (
        <article key={t}><h3>{t}</h3><p>{d}</p></article>
      ))}
    </section>

    <section id="precos" className="lp-prices">
      <h2>Preço simples,<br /><em>por mês.</em></h2>
      <div className="lp-prices__grid">
        {PLANS.map((pl) => (
          <article key={pl.key} className={pl.featured ? 'is-featured' : ''}>
            {pl.featured && <span className="lp-tag">{pl.featured}</span>}
            <h3>{pl.name}</h3><p>{pl.text}</p>
            <div className="lp-price"><b>{brl(pl.price)}</b><span>/mês</span></div>
            <ul>{pl.items.map((i) => <li key={i}><Check />{i}</li>)}</ul>
            <Link to="/auth" className={`lp-btn ${pl.featured ? 'lp-btn--lime' : 'lp-btn--ghost'}`}>{pl.cta}</Link>
          </article>
        ))}
      </div>
      <small>Site adicional no plano Agência: {brl(EXTRA_SITE)}/mês.</small>
    </section>

    <section id="duvidas" className="lp-faq">
      <h2>Dúvidas comuns</h2>
      {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </section>

    <section className="lp-final">
      <h2>Menos painel.<br /><em>Mais site no ar.</em></h2>
      <Link to="/auth" className="lp-btn lp-btn--lime lp-btn--xl">Criar minha conta <ArrowRight /></Link>
    </section>
    <footer className="lp-foot"><Logo /><span>© Superelements</span></footer>
  </div>
);

export default ProductLanding;
