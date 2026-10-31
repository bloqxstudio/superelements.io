import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BarChart3, Filter, Globe2, Image as ImageIcon, ListChecks, Megaphone, MessageCircle, Sparkles, TrendingUp, UserPlus, Users, Workflow, FileBarChart } from 'lucide-react';
import { Logo } from '@/components/Logo';
import './ProductLanding.css';

const STEPS = [
  { icon: Megaphone, tab: 'Anúncios', title: 'O clique começa aqui.', text: 'A campanha roda na Meta. O valor gasto já aparece no produto, campanha por campanha.' },
  { icon: ListChecks, tab: 'Formulários', title: 'Um formulário só seu.', text: 'Crie formulários e quizzes no produto, publique no site ou em um link direto. Sem plugin de terceiros.' },
  { icon: UserPlus, tab: 'Oportunidades', title: 'O lead chega com história.', text: 'Cada resposta vira oportunidade no funil, com origem, campanha, página e quanto foi investido.' },
  { icon: Filter, tab: 'Funil', title: 'Acompanhe cada etapa.', text: 'Do novo lead ao fechado, a equipe move os cards e o histórico fica registrado.' },
  { icon: Globe2, tab: 'Visitas ao site', title: 'Veja o custo de cada lead.', text: 'Visitas ao vivo por estado e campanha, cruzadas com o valor gasto e os contatos gerados.' },
  { icon: FileBarChart, tab: 'WhatsApp', title: 'Receba o que melhorar.', text: 'Um resumo no WhatsApp com os números da semana e o próximo passo sugerido.' },
];

const MODULES = [
  { icon: ListChecks, t: 'Formulários e quizzes próprios', d: 'Crie no produto, publique no site ou em link direto. Cada resposta vira lead no funil, com a origem da campanha.' },
  { icon: Globe2, t: 'Site em tempo real', d: 'Visitas ao vivo por estado, cidade, campanha e página. Cada contato, com a origem.' },
  { icon: Megaphone, t: 'Anúncios', d: 'Meta Ads com valor usado, resultados e custo por resultado, cruzados com o que aconteceu no site.' },
  { icon: Users, t: 'Oportunidades', d: 'O lead cai no funil já com origem, campanha e valor gasto. Aviso na hora no WhatsApp.' },
  { icon: MessageCircle, t: 'WhatsApp da equipe', d: 'Conversas dos clientes, rotinas de contato e relatórios chegando por onde você já trabalha.' },
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

const COLS = ['Novo lead', 'Em conversa', 'Proposta', 'Fechado'];

const Panel: React.FC<{ i: number; sub: number }> = ({ i, sub }) => {
  const live = useLive();
  if (i === 0) return (
    <div className="lp-pn"><h4><Megaphone /> Anúncios · últimos 7 dias</h4>
      <div className="lp-kpis"><div><small>Valor usado</small><b>R$ 1.284</b></div><div><small>Cliques no link</small><b>1.912</b></div><div><small>Alcance</small><b>38,4 mil</b></div></div>
      <Bar label="Verão" v={48} max={60} /><Bar label="Remarketing" v={31} max={60} /><Bar label="Institucional" v={17} max={60} /></div>);
  if (i === 1) return (
    <div className="lp-pn lp-formpn"><h4><ListChecks /> Quiz · Orçamento de reforma</h4>
      <div className="lp-qbar"><i style={{ width: `${34 + sub * 33}%` }} /></div>
      <p className="lp-q">Qual o tamanho do imóvel?</p>
      <div className="lp-ops">{['Até 60 m²', '60 a 120 m²', 'Acima de 120 m²'].map((o, k) => <span key={o} className={k === 1 ? 'on' : ''}><i />{o}</span>)}</div>
      <label><Sparkles /> Publicado no site e em link direto · sem plugin</label></div>);
  if (i === 2) return (
    <div className="lp-pn"><h4><UserPlus /> Novo lead agora</h4>
      <div className="lp-lead"><b>Marina Albuquerque</b><span>Quiz · Orçamento de reforma</span></div>
      <div className="lp-meta"><div><small>Canal</small>Meta Ads</div><div><small>Campanha</small>Verão</div><div><small>Estado</small>RS</div><div><small>Valor da campanha</small>R$ 612</div></div>
      <label><MessageCircle /> Aviso enviado no WhatsApp da equipe</label></div>);
  if (i === 3) {
    const stage = Math.min(3, sub + 1);
    return (
      <div className="lp-pn"><h4><Filter /> Funil de vendas</h4>
        <div className="lp-kan">{COLS.map((c, k) => (
          <div key={c}><small>{c}</small>
            {k === 0 && <p className="g">Pedro · Reforma</p>}
            {k === 1 && <p className="g">Carla · Cozinha</p>}
            {k === stage && <motion.p layoutId="lead" className="hl">Marina · Reforma</motion.p>}
            {k === 2 && stage !== 2 && <p className="g">Bruno · Sala</p>}
          </div>))}</div>
        <label><TrendingUp /> Cada mudança de etapa fica no histórico do cliente</label></div>);
  }
  if (i === 4) return (
    <div className="lp-pn"><h4><Globe2 /> Site · agora <span className="lp-live"><i />{live} online</span></h4>
      <div className="lp-cols"><div><small>Por estado</small><Bar label="SP" v={42} /><Bar label="RS" v={27} /><Bar label="MG" v={18} /><Bar label="PR" v={9} /></div>
        <div><small>Custo por lead</small><Bar label="Verão" v={38} /><Bar label="Remarketing" v={22} /><Bar label="Orgânico" v={31} /></div></div>
      <label><TrendingUp /> 7 contatos hoje · R$ 183 por contato</label></div>);
  return (
    <div className="lp-pn"><h4><FileBarChart /> Relatório semanal</h4>
      <div className="lp-wa"><p>Resumo da semana: 23 leads, 4 propostas e 1 fechado. O Remarketing teve o menor custo por lead.</p><p>Sugestão: mover verba da Institucional para o Remarketing e testar um novo criativo.</p></div>
      <label><BarChart3 /> Enviado no WhatsApp · segunda, 8h</label></div>);
};

const Story: React.FC = () => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState(0);
  useMotionValueEvent(p, 'change', (v) => { const x = Math.max(0, (v - 0.1) / 0.15); setStep(Math.min(5, Math.floor(x))); setSub(Math.min(2, Math.floor((x % 1) * 3))); });
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
              <span>0{s + 1} / 06</span><h2>{STEPS[s].title}</h2><p>{STEPS[s].text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.div className="lp-win" style={{ rotateX, scale, y }}>
          <div className="lp-win__bar"><b>Superelements</b><em>● Tempo real</em></div>
          <div className="lp-win__body">
            <aside className="lp-hide"><small>Sua empresa</small><i><Globe2 /> Início</i>{STEPS.map((st, k) => <i key={st.tab} className={k === s ? 'on' : ''}><st.icon /> {st.tab}</i>)}</aside>
            <div className="lp-win__canvas">
              <AnimatePresence mode="wait"><motion.div key={s} className="lp-pnwrap" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}><Panel i={s} sub={sub} /></motion.div></AnimatePresence>
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
      <span className="lp-pill"><i /> Funil, formulário e acompanhamento</span>
      <h1>Do clique<br />ao <em>cliente.</em></h1>
      <p>Anúncio, formulário próprio, funil e relatório na mesma plataforma. Cada lead com origem, campanha e custo, em tempo real.</p>
      <div className="lp-hero__cta"><Link to="/auth" className="lp-btn lp-btn--lime">Começar agora <ArrowRight /></Link><a href="#como" className="lp-btn lp-btn--ghost">Ver em ação</a></div>
    </header>

    <div id="como"><Story /></div>

    <section className="lp-big">
      <h2>Cada lead<br /><em>com história.</em></h2>
      <p>Quanto o anúncio gastou, quem preencheu o formulário, de qual estado e campanha veio, em que etapa do funil está. Uma visão só, atualizando enquanto acontece.</p>
      <div className="lp-stats">
        <div><b>Ao vivo</b><span>visitas por estado e campanha</span></div>
        <div><b>R$</b><span>custo de cada lead</span></div>
        <div><b>1 funil</b><span>do formulário ao fechado</span></div>
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
