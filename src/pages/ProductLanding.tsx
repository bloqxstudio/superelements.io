import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BarChart3, CalendarDays, Globe2, Image as ImageIcon, Lightbulb, Megaphone, MessageCircle, Sparkles, TrendingUp, Users, Workflow, FileBarChart } from 'lucide-react';
import { Logo } from '@/components/Logo';
import './ProductLanding.css';

const STEPS = [
  { icon: Lightbulb, tab: 'Conteúdos', title: 'Comece pela ideia.', text: 'Plano, pautas e conteúdos da semana no mesmo lugar, com agentes que sugerem e você aprova.' },
  { icon: ImageIcon, tab: 'Criativo', title: 'Crie o criativo.', text: 'Posts, stories e peças saem da pauta, na identidade do cliente, prontos para revisar.' },
  { icon: Megaphone, tab: 'Anúncios', title: 'Veja a campanha.', text: 'Valor gasto, alcance e resultado de cada anúncio, sem abrir o gerenciador.' },
  { icon: Globe2, tab: 'Visitas ao site', title: 'Acompanhe o site ao vivo.', text: 'Quem está no site agora, de qual estado, de qual campanha e o que fez.' },
  { icon: FileBarChart, tab: 'WhatsApp', title: 'Receba o relatório.', text: 'Resumo pronto no WhatsApp, com o que melhorar. Tudo ligado do começo ao fim.' },
];

const MODULES = [
  { icon: Globe2, t: 'Site em tempo real', d: 'Visitas ao vivo por estado, cidade, campanha e página. Cada contato, com a origem.' },
  { icon: Megaphone, t: 'Anúncios', d: 'Meta Ads com valor usado, resultados e custo por resultado, cruzados com o que aconteceu no site.' },
  { icon: Users, t: 'Oportunidades', d: 'O lead cai no funil já com origem, campanha e valor gasto. Aviso na hora no WhatsApp.' },
  { icon: MessageCircle, t: 'WhatsApp da equipe', d: 'Conversas dos clientes, rotinas de contato e relatórios chegando por onde você já trabalha.' },
  { icon: ImageIcon, t: 'Criativos e Instagram', d: 'Do post ao story agendado, com métricas de alcance e melhores publicações.' },
  { icon: Workflow, t: 'Agentes de IA', d: 'Agentes que escrevem, desenham, analisam e propõem melhorias. Você decide o que vai ao ar.' },
];

const FAQ = [
  ['Isso substitui as ferramentas que eu já uso?', 'Reúne o que importa numa tela só: anúncios, site, funil, conversas e conteúdo. Você conecta as contas que já tem.'],
  ['Os dados são em tempo real mesmo?', 'As visitas ao site aparecem ao vivo. Anúncios e redes atualizam automaticamente durante o dia.'],
  ['Funciona para várias empresas?', 'Sim. Cada cliente tem seu ambiente separado, com módulos que você liga ou desliga.'],
  ['A IA publica sozinha?', 'Não. Ela prepara, sugere e analisa. Publicar e enviar mensagens é sempre decisão de uma pessoa.'],
];

const useLive = () => {
  const [n, setN] = useState(14);
  useEffect(() => { const t = setInterval(() => setN((v) => Math.max(8, Math.min(24, v + (Math.random() > 0.5 ? 1 : -1)))), 1800); return () => clearInterval(t); }, []);
  return n;
};

const Bar = ({ label, v, max = 100 }: { label: string; v: number; max?: number }) => (
  <div className="lp-bar"><span>{label}</span><i><b style={{ width: `${(v / max) * 100}%` }} /></i><em>{v}</em></div>
);

const Panel: React.FC<{ i: number }> = ({ i }) => {
  const live = useLive();
  if (i === 0) return (
    <div className="lp-pn"><h4><CalendarDays /> Semana de 3 a 9</h4>
      <div className="lp-cal">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((d, k) => (
        <div key={d}><small>{d}</small><p className={k % 2 ? 'a' : 'b'}>{['Bastidores da obra', 'Antes e depois', 'Dúvida do cliente', 'Prova social', 'Oferta do mês'][k]}</p></div>))}</div>
      <label><Sparkles /> Agente sugeriu 5 pautas com base nos últimos posts</label></div>);
  if (i === 1) return (
    <div className="lp-pn"><h4><ImageIcon /> Criativos · Stories</h4>
      <div className="lp-crs">{[0, 1, 2, 3].map((k) => (<figure key={k} className={`c${k}`}><b>{['Novo', 'Antes', 'Depois', 'Fale'][k]}</b><span>{['lançamento', 'reforma', 'resultado', 'agora'][k]}</span></figure>))}</div>
      <label><Sparkles /> 4 peças prontas · aguardando sua aprovação</label></div>);
  if (i === 2) return (
    <div className="lp-pn"><h4><Megaphone /> Anúncios · últimos 7 dias</h4>
      <div className="lp-kpis"><div><small>Valor usado</small><b>R$ 1.284</b></div><div><small>Resultados</small><b>96</b></div><div><small>Custo por resultado</small><b>R$ 13,37</b></div></div>
      <Bar label="Campanha Verão" v={48} max={60} /><Bar label="Remarketing" v={31} max={60} /><Bar label="Institucional" v={17} max={60} /></div>);
  if (i === 3) return (
    <div className="lp-pn"><h4><Globe2 /> Site · agora <span className="lp-live"><i />{live} online</span></h4>
      <div className="lp-cols"><div><small>Por estado</small><Bar label="SP" v={42} /><Bar label="RS" v={27} /><Bar label="MG" v={18} /><Bar label="PR" v={9} /></div>
        <div><small>Por campanha</small><Bar label="Verão" v={38} /><Bar label="Remarketing" v={22} /><Bar label="Orgânico" v={31} /></div></div>
      <label><TrendingUp /> 7 contatos hoje · R$ 183 por contato</label></div>);
  return (
    <div className="lp-pn"><h4><FileBarChart /> Relatório semanal</h4>
      <div className="lp-wa"><p>Resumo da semana: o site recebeu mais visitas vindas do Remarketing, com o menor custo por contato.</p><p>Sugestão: mover verba da campanha Institucional para o Remarketing e testar um novo criativo.</p></div>
      <label><BarChart3 /> Enviado no WhatsApp · segunda, 8h</label></div>);
};

const Story: React.FC = () => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(p, 'change', (v) => setStep(Math.min(4, Math.max(0, Math.floor((v - 0.12) / 0.17)))));
  const rotateX = useTransform(p, [0, 0.12], [reduce ? 0 : 32, 0]);
  const scale = useTransform(p, [0, 0.12], [reduce ? 1 : 0.8, 1]);
  const y = useTransform(p, [0, 0.12], [reduce ? 0 : 70, 0]);
  const s = reduce ? 0 : step;
  return (
    <section ref={ref} className="lp-story" aria-label="Como funciona">
      <div className="lp-story__sticky">
        <div className="lp-story__caption">
          <AnimatePresence mode="wait">
            <motion.div key={s} initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }} transition={{ duration: 0.4 }}>
              <span>0{s + 1} / 05</span><h2>{STEPS[s].title}</h2><p>{STEPS[s].text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.div className="lp-win" style={{ rotateX, scale, y }}>
          <div className="lp-win__bar"><b>Superelements</b><em>● Tempo real</em></div>
          <div className="lp-win__body">
            <aside className="lp-hide"><small>Sua empresa</small><i><Globe2 /> Início</i>{STEPS.map((st, k) => <i key={st.tab} className={k === s ? 'on' : ''}><st.icon /> {st.tab}</i>)}</aside>
            <div className="lp-win__canvas">
              <AnimatePresence mode="wait"><motion.div key={s} className="lp-pnwrap" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}><Panel i={s} /></motion.div></AnimatePresence>
            </div>
          </div>
        </motion.div>
        <div className="lp-dots" aria-hidden>{STEPS.map((_, k) => <i key={k} className={k === s ? 'on' : ''} />)}</div>
      </div>
    </section>
  );
};

const ProductLanding: React.FC = () => (
  <div className="lp">
    <nav className="lp-nav"><Link to="/" className="lp-nav__brand"><Logo /><b>superelements</b></Link>
      <div><a href="#como">Como funciona</a><a href="#modulos">O que conecta</a><a href="#duvidas">Dúvidas</a></div>
      <Link to="/auth" className="lp-btn lp-btn--light">Entrar</Link></nav>

    <header className="lp-hero">
      <div className="lp-glow" aria-hidden />
      <span className="lp-pill"><i /> Operação do cliente, de ponta a ponta</span>
      <h1>Da ideia ao<br /><em>resultado.</em></h1>
      <p>Criativo, campanha, site em tempo real e relatório na mesma plataforma. Tudo conectado, sem abrir dez painéis.</p>
      <div className="lp-hero__cta"><Link to="/auth" className="lp-btn lp-btn--lime">Começar agora <ArrowRight /></Link><a href="#como" className="lp-btn lp-btn--ghost">Ver em ação</a></div>
    </header>

    <div id="como"><Story /></div>

    <section className="lp-big">
      <h2>Tudo conectado.<br /><em>Tudo ao vivo.</em></h2>
      <p>O que o anúncio gasta, quem chegou ao site, de qual estado e campanha, quem virou conversa. Uma visão só, atualizando enquanto acontece.</p>
      <div className="lp-stats">
        <div><b>Ao vivo</b><span>visitas por estado e campanha</span></div>
        <div><b>R$</b><span>valor gasto ligado ao contato</span></div>
        <div><b>1 tela</b><span>da ideia ao relatório</span></div>
      </div>
    </section>

    <section id="modulos" className="lp-big lp-big--grid">
      {MODULES.map((m) => (<article key={m.t}><m.icon /><h3>{m.t}</h3><p>{m.d}</p></article>))}
    </section>

    <section id="duvidas" className="lp-faq">
      <h2>Dúvidas comuns</h2>
      {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </section>

    <section className="lp-final">
      <h2>Menos painel.<br /><em>Mais resultado.</em></h2>
      <Link to="/auth" className="lp-btn lp-btn--lime lp-btn--xl">Criar minha conta <ArrowRight /></Link>
      <small>Dados das telas são ilustrativos.</small>
    </section>
    <footer className="lp-foot"><Logo /><span>© Superelements</span></footer>
  </div>
);

export default ProductLanding;
