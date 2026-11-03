import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FileBarChart, Globe2, ListChecks, Megaphone, MessageCircle, Pause, Play, TrendingUp, UserPlus } from 'lucide-react';
import { SinfyWordmark } from './SinfyBrand';
import './LiveJourney.css';

const STEPS = [
  { icon: Megaphone, tab: 'Anúncio', title: 'Sua campanha chama a atenção.', text: 'A agência acompanha os anúncios e o investimento. A jornada começa no interesse de uma pessoa.' },
  { icon: Globe2, tab: 'Visita', title: 'A pessoa chega até sua oferta.', text: 'O site recebe a visita e registra os eventos e a origem disponíveis.' },
  { icon: ListChecks, tab: 'Contato', title: 'O interesse vira uma oportunidade.', text: 'O formulário leva as respostas ao CRM. A origem acompanha o contato quando pode ser identificada.' },
  { icon: MessageCircle, tab: 'Conversa', title: 'A equipe entra na conversa.', text: 'Um responsável atende e acompanha o próximo passo, com o histórico por perto.' },
  { icon: FileBarChart, tab: 'Proposta', title: 'A negociação tem acompanhamento.', text: 'A equipe registra o andamento, o valor e o que precisa acontecer para a oportunidade avançar.' },
  { icon: TrendingUp, tab: 'Venda', title: 'O fechamento entra na história.', text: 'Com a venda registrada, agência e cliente podem analisar o caminho da oportunidade.' },
] as const;

const NAMES = ['Marina A.', 'Pedro S.', 'Carla M.', 'Bruno T.', 'Júlia R.', 'Rafael C.', 'Ana P.', 'Lucas F.', 'Bia N.', 'Diego L.', 'Sofia V.', 'Thiago O.', 'Laura K.', 'Gabriel D.', 'Helena B.', 'Caio M.'];
const CAMPAIGNS = ['Reels Closet', 'Remarketing', 'Carrossel Cozinha', 'Google · Busca'];
const TINTS = ['#d2f525', '#cce1b9', '#bcd3a8', '#e2edcf', '#c4deba', '#d8e7c7'];
/* Chance de seguir para a próxima etapa (o resto sai do funil). */
const CONV = [0.72, 0.4, 0.85, 0.55, 0.5];
const CPC = 0.68;
const TICKET = 18400;

type Person = { id: number; name: string; campaign: string; tint: string; stage: number; lane: number; age: number; leaving: boolean };
type Note = { id: number; kind: 'lead' | 'site' | 'proposta' | 'fechado'; title: string; sub: string };

const brl = (v: number, d = 0) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}`;

export const LiveJourney: React.FC = () => {
  const box = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const seq = useRef(0);
  const live = useRef<Person[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [notes, setNotes] = useState<Note[]>([
    { id: -1, kind: 'fechado', title: 'Negócio fechado · Carla M.', sub: 'Carrossel Cozinha · R$ 18.400' },
    { id: -2, kind: 'lead', title: 'Novo lead · Pedro S.', sub: 'Google · Busca · quiz respondido' },
  ]);
  /* Totais acumulados (começam com uma semana de demonstração). */
  const [tot, setTot] = useState({ clicks: 904, site: 612, leads: 23, chats: 18, props: 6, won: 2 });

  useEffect(() => {
    const reduce = Boolean(reduceMotion);
    let visible = false;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.1 });
    if (box.current) io.observe(box.current);

    const seed: Person[] = [0, 0, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5].map((stage, k) => ({ id: seq.current++, name: NAMES[k], campaign: CAMPAIGNS[k % 4], tint: TINTS[k % TINTS.length], stage, lane: k % 6, age: k % 3, leaving: false }));
    if (!live.current.length) { live.current = seed; setPeople(seed); }
    if (reduce || paused) return () => io.disconnect();

    const push = (n: Omit<Note, 'id'>) => setNotes((list) => [{ ...n, id: seq.current++ }, ...list].slice(0, 4));

    const tick = () => {
      if (!visible || document.hidden) return;
      {
        const list = live.current;
        const next: Person[] = [];
        const add = { clicks: 0, site: 0, leads: 0, chats: 0, props: 0, won: 0 };
        for (const p of list) {
          if (p.leaving) continue;
          const age = p.age + 1;
          if (p.stage === 5) { if (age < 4) next.push({ ...p, age }); continue; }
          const dwell = p.stage === 0 ? 1 : p.stage === 1 ? 2 + (p.id % 3) : 3 + (p.id % 2);
          if (age < dwell) { next.push({ ...p, age }); continue; }
          if (Math.random() < CONV[p.stage]) {
            const stage = p.stage + 1;
            if (stage === 1) add.site++;
            if (stage === 2) { add.leads++; push({ kind: 'lead', title: `Novo lead · ${p.name}`, sub: `${p.campaign} · quiz respondido` }); }
            if (stage === 3) add.chats++;
            if (stage === 4) { add.props++; push({ kind: 'proposta', title: `Proposta enviada · ${p.name}`, sub: `${brl(TICKET)} · retorno na sexta` }); }
            if (stage === 5) { add.won++; push({ kind: 'fechado', title: `Negócio fechado · ${p.name}`, sub: `${p.campaign} · ${brl(TICKET)}` }); }
            next.push({ ...p, stage, age: 0 });
          } else {
            next.push({ ...p, leaving: true });
          }
        }
        const spawn = next.length < 34 ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0;
        for (let n = 0; n < spawn; n++) {
          const k = seq.current;
          next.push({ id: seq.current++, name: NAMES[k % NAMES.length], campaign: CAMPAIGNS[k % 4], tint: TINTS[k % TINTS.length], stage: 0, lane: k % 6, age: 0, leaving: false });
          add.clicks++;
        }
        setTot((t) => ({ clicks: t.clicks + add.clicks, site: t.site + add.site, leads: t.leads + add.leads, chats: t.chats + add.chats, props: t.props + add.props, won: t.won + add.won }));
        live.current = next;
        setPeople(next);
      }
    };
    const timer = window.setInterval(tick, 900);
    return () => { window.clearInterval(timer); io.disconnect(); };
  }, [paused, reduceMotion]);

  const spent = tot.clicks * CPC;
  const revenue = tot.won * TICKET;
  const counts = [tot.clicks, tot.site, tot.leads, tot.chats, tot.props, tot.won];
  const online = people.filter((p) => p.stage === 1 && !p.leaving).length + 9;

  return (
    <div ref={box} className="lp-live-board" aria-label="Jornada dos leads ao vivo, dados de demonstração">
      <div className="lp-win__bar"><SinfyWordmark /><span className="lp-live-board__crumb">Do clique ao cliente · simulação</span><button type="button" className="sinfy-demo-pause" onClick={() => setPaused(value => !value)} aria-pressed={paused} disabled={Boolean(reduceMotion)} aria-label={reduceMotion ? "Simulação estática: movimento reduzido ativado" : paused ? "Reproduzir simulação" : "Pausar simulação"}>{paused || reduceMotion ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}{paused || reduceMotion ? "Reproduzir" : "Pausar"}</button><em><i className="lp-dot" /> {online} no site</em></div>
      <div className="lp-live-board__body">
        <div className="lp-live-board__main">
          <div className="lp-lj-stages">
            {STEPS.map((s, k) => (
              <button type="button" key={s.tab} className={`lp-lj-stage${activeStep === k ? " is-selected" : ""}`} onClick={() => setActiveStep(k)} aria-pressed={activeStep === k} aria-controls="sinfy-journey-description">
                <i><s.icon /></i>
                {k > 0 && <span className="lp-lj-rate" title="Taxa ilustrativa entre etapas">{Math.round((counts[k] / Math.max(1, counts[k - 1])) * 100)}%</span>}
                <small>{s.tab}</small>
                <b>{counts[k].toLocaleString('pt-BR')}</b>
              </button>
            ))}
          </div>
          <div className="lp-lj-track" aria-hidden>
            {STEPS.map((s) => <span key={s.tab} className="lp-lj-col" />)}
            {people.map((p) => (
              <span key={p.id} className={`lp-lj-person${p.leaving ? ' is-out' : ''}${p.stage === 5 ? ' is-won' : ''}`}
                style={{ left: `calc(${((p.stage + 0.5) / 6) * 100}% - 15px)`, top: `${14 + p.lane * 32 + (p.id % 3) * 3}px`, background: p.tint }}>
                {p.name[0]}
              </span>
            ))}
          </div>
          <div className="lp-lj-calc">
            <div><small>Investido</small><b>{brl(spent)}</b></div>
            <div><small>Custo por lead</small><b>{brl(spent / tot.leads, 2)}</b></div>
            <div><small>Custo por venda</small><b>{brl(spent / Math.max(1, tot.won))}</b></div>
            <div><small>Vendas</small><b>{brl(revenue)}</b></div>
            <div className="hl"><small>Negócios ganhos</small><b>{tot.won}</b></div>
          </div>
        </div>
        <aside className="lp-lj-notes">
          <small>Notificações</small>
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.div key={n.id} layout initial={reduceMotion ? false : { opacity: 0, x: 30, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: reduceMotion ? 0 : 0.25 }} className={`lp-lj-note k-${n.kind}`}>
                <i>{n.kind === 'fechado' ? <TrendingUp /> : n.kind === 'proposta' ? <FileBarChart /> : <UserPlus />}</i>
                <div><b>{n.title}</b><span>{n.sub}</span></div>
                <em>agora</em>
              </motion.div>
            ))}
          </AnimatePresence>
        </aside>
      </div>
      <div className="sinfy-journey-detail" id="sinfy-journey-description" aria-live="polite"><span>0{activeStep + 1} / 06</span><div><h3>{STEPS[activeStep].title}</h3><p>{STEPS[activeStep].text}</p></div></div>
    </div>
  );
};

