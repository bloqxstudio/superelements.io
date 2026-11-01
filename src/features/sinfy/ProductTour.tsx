import React, { useEffect, useRef, useState } from 'react';
import {
  Check, ChevronDown, Filter, Globe2, Instagram, LayoutDashboard, ListChecks, Megaphone, MessageCircle, Mic, Paperclip, Search, Send, TrendingUp, UserPlus,
} from 'lucide-react';
import { SinfyWordmark } from './SinfyBrand';
import './ProductTour.css';

/**
 * Tour do produto na /lp: as áreas reais da plataforma desenhadas como componentes
 * na própria página (não imagens), com a marca Sinfy e uma empresa fictícia
 * (Caramelo Pet). Cada aba explica uma funcionalidade que existe no produto.
 */

type ScreenId = 'inicio' | 'oportunidades' | 'whatsapp' | 'formularios' | 'site' | 'anuncios' | 'instagram';

const SCREENS: { id: ScreenId; label: string; icon: React.ElementType; kicker: string; title: string; text: string; items: string[] }[] = [
  { id: 'inicio', label: 'Início', icon: LayoutDashboard, kicker: 'Visão geral', title: 'A empresa inteira em uma tela.', text: 'Visitas, contatos, oportunidades e investimento do período, comparados com o período anterior. O que precisa de atenção aparece primeiro.', items: ['Indicadores do período com comparação', 'Pontos de atenção com o motivo', 'Campanha → visitas → contatos → oportunidades'] },
  { id: 'oportunidades', label: 'Oportunidades', icon: Filter, kicker: 'CRM de vendas', title: 'Cada oportunidade tem dono e próximo passo.', text: 'O quadro mostra em que etapa cada negociação está, quem cuida dela e de onde ela veio. A equipe comenta no cartão e todos veem na hora.', items: ['Etapas arrastáveis, ao vivo para a equipe', 'Responsável, origem e comentários no cartão', 'Valor em aberto por etapa'] },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, kicker: 'Atendimento da equipe', title: 'Um número. A equipe toda atendendo.', text: 'As conversas do WhatsApp da empresa ficam numa caixa compartilhada, com etiquetas, fotos, áudios e o histórico de cada contato.', items: ['Caixa de entrada compartilhada', 'Etiquetas: quente, morno, frio, cliente', 'Áudio, foto, vídeo e documentos'] },
  { id: 'formularios', label: 'Formulários', icon: ListChecks, kicker: 'Captação e qualificação', title: 'O contato chega qualificado.', text: 'Formulários e quizzes publicados nas páginas levam as respostas e a origem da visita direto para o CRM, já na etapa certa.', items: ['Quizzes com perguntas de qualificação', 'Origem e campanha junto com as respostas', 'Aviso no WhatsApp a cada novo lead'] },
  { id: 'site', label: 'Visitas ao site', icon: Globe2, kicker: 'Analytics do site', title: 'Quem está no site agora, e de onde veio.', text: 'Cada visita com origem, páginas, tempo e cliques no WhatsApp. O mapa mostra as cidades e quem está navegando neste momento.', items: ['Visitantes ao vivo no mapa', 'Origem: Google, Meta, Instagram, direto', 'Contatos gerados por página e campanha'] },
  { id: 'anuncios', label: 'Anúncios', icon: Megaphone, kicker: 'Meta Ads', title: 'O investimento ao lado do resultado.', text: 'As campanhas da Meta com os nomes de métrica do Gerenciador, lidas pela conta de anúncios do cliente. Somente leitura: nada muda nas campanhas.', items: ['Valor usado, resultados e custo por resultado', 'Gráfico diário com a métrica que você escolher', 'Prévia nativa de cada anúncio'] },
  { id: 'instagram', label: 'Instagram', icon: Instagram, kicker: 'Perfil e conteúdo', title: 'O Instagram acompanhado de perto.', text: 'Seguidores, alcance e os melhores posts, com stories programados que a equipe aprova antes de ir ao ar.', items: ['Alcance por dia e por formato', 'Os posts que mais funcionaram', 'Stories programados com aprovação'] },
];

export function ProductTour() {
  const [active, setActive] = useState<ScreenId>('inicio');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const screen = SCREENS.find((s) => s.id === active)!;
  const index = SCREENS.indexOf(screen);

  function onKey(event: React.KeyboardEvent, i: number) {
    let next = i;
    if (event.key === 'ArrowRight') next = (i + 1) % SCREENS.length;
    else if (event.key === 'ArrowLeft') next = (i - 1 + SCREENS.length) % SCREENS.length;
    else return;
    event.preventDefault();
    setActive(SCREENS[next].id);
    tabs.current[next]?.focus();
  }

  return <div className="pt">
    <div className="pt-tabs" role="tablist" aria-label="Áreas da plataforma">
      {SCREENS.map((s, i) => <button key={s.id} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`pt-tab-${s.id}`} aria-selected={active === s.id} aria-controls="pt-panel" tabIndex={active === s.id ? 0 : -1} onClick={() => setActive(s.id)} onKeyDown={(e) => onKey(e, i)}><s.icon aria-hidden="true" />{s.label}</button>)}
    </div>

    <div className="pt-stage" role="tabpanel" id="pt-panel" aria-labelledby={`pt-tab-${active}`}>
      <div className="pt-app" aria-label={`Tela ${screen.label} da Sinfy, com dados fictícios`}>
        <aside className="pt-side">
          <SinfyWordmark />
          <span className="pt-account"><i>CP</i>Caramelo Pet<ChevronDown aria-hidden="true" /></span>
          <nav>{SCREENS.map((s) => <button key={s.id} type="button" tabIndex={-1} className={active === s.id ? 'is-on' : ''} onClick={() => setActive(s.id)}><s.icon aria-hidden="true" />{s.label}</button>)}</nav>
          <small>Empresa fictícia · demonstração</small>
        </aside>
        <div className="pt-main" key={active}>
          {active === 'inicio' && <Inicio />}
          {active === 'oportunidades' && <Oportunidades />}
          {active === 'whatsapp' && <WhatsApp />}
          {active === 'formularios' && <Formularios />}
          {active === 'site' && <Site />}
          {active === 'anuncios' && <Anuncios />}
          {active === 'instagram' && <InstagramScreen />}
        </div>
      </div>

      <div className="pt-explain">
        <span className="pt-count">{String(index + 1).padStart(2, '0')} / {String(SCREENS.length).padStart(2, '0')}</span>
        <div>
          <p className="pt-kicker">{screen.kicker}</p>
          <h3>{screen.title}</h3>
          <p>{screen.text}</p>
        </div>
        <ul>{screen.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
      </div>
    </div>
  </div>;
}

/* ---------- partes comuns ---------- */

const Head: React.FC<{ title: string; sub: string; children?: React.ReactNode }> = ({ title, sub, children }) =>
  <div className="pt-head"><div><h4>{title}</h4><p>{sub}</p></div>{children && <div className="pt-head__side">{children}</div>}</div>;

const Period = () => <span className="pt-pill">Últimos 7 dias <ChevronDown aria-hidden="true" /></span>;

const Kpi: React.FC<{ label: string; value: string; delta?: string; down?: boolean; dark?: boolean }> = ({ label, value, delta, down, dark }) =>
  <div className={`pt-kpi${dark ? ' is-dark' : ''}`}><span>{label}</span><b>{value}</b>{delta && <em className={down ? 'is-down' : ''}>{delta}</em>}</div>;

const Avatar: React.FC<{ name: string; tint?: string }> = ({ name, tint = '#e2edcf' }) =>
  <i className="pt-av" style={{ background: tint }}>{name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</i>;

/** Barras com crescimento ao entrar na tela. */
function useGrow() {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  return on;
}

/* ---------- telas ---------- */

function Inicio() {
  const grow = useGrow();
  const chain = [['Reels Verão', 'R$ 210', 312, 14, 6], ['Remarketing', 'R$ 140', 186, 9, 4], ['Google · Busca', '—', 154, 7, 3]] as const;
  return <>
    <Head title="Bom dia, Ana" sub="Caramelo Pet · o que aconteceu nos últimos 7 dias"><Period /></Head>
    <div className="pt-kpis">
      <Kpi label="Visitas ao site" value="652" delta="+18%" />
      <Kpi label="Contatos" value="38" delta="+9%" />
      <Kpi label="Oportunidades novas" value="24" delta="+4" />
      <Kpi label="Ganhas" value="7" delta="+2" />
      <Kpi label="Investido na Meta" value="R$ 480" delta="−6%" down dark />
    </div>
    <div className="pt-grid2">
      <section className="pt-card">
        <h5>Precisa de atenção</h5>
        {[['Marina Albuquerque', 'Novo lead sem responsável há 2 h', 'lead'], ['Pedro Siqueira', 'Em conversa sem próximo passo', 'passo'], ['Carla Menezes', 'Proposta: retorno era ontem', 'atrasado']].map(([name, why, kind]) =>
          <div className="pt-row" key={name}><Avatar name={name} /><div><b>{name}</b><span>{why}</span></div><em className={`pt-tag k-${kind}`}>{kind === 'lead' ? 'Assumir' : kind === 'passo' ? 'Definir' : 'Atrasado'}</em></div>)}
      </section>
      <section className="pt-card">
        <h5>Campanha → visitas → contatos → oportunidades</h5>
        <div className="pt-chain">
          <div className="pt-chain__h"><span>Campanha</span><span>Gasto</span><span>Visitas</span><span>Contatos</span><span>Oport.</span></div>
          {chain.map(([name, spend, visits, contacts, opps]) => <div key={name} className="pt-chain__r"><b>{name}</b><span>{spend}</span><span><i style={{ width: grow ? `${(visits / 312) * 100}%` : 0 }} />{visits}</span><span>{contacts}</span><span>{opps}</span></div>)}
        </div>
        <p className="pt-note">Ligação pelo nome da campanha no link (UTM) e pelo formulário.</p>
      </section>
    </div>
  </>;
}

function Oportunidades() {
  const cols = [
    { label: 'Novo lead', dot: '#93a3b8', value: 'R$ 3.600', cards: [{ n: 'Marina Albuquerque', d: 'Banho e tosa mensal', o: 'Meta Ads · quiz', who: '', c: 0 }, { n: 'Lucas Ferreira', d: 'Hotel para o fim de semana', o: 'Formulário do site', who: '', c: 0 }] },
    { label: 'Em conversa', dot: '#7c9cf5', value: 'R$ 5.400', cards: [{ n: 'Pedro Siqueira', d: 'Plano Clube do Banho', o: 'Google · Busca', who: 'AN', c: 3 }, { n: 'Júlia Rocha', d: 'Creche 3x por semana', o: 'Instagram', who: 'RF', c: 1 }] },
    { label: 'Proposta', dot: '#e3a33b', value: 'R$ 4.200', cards: [{ n: 'Carla Menezes', d: 'Pacote filhote', o: 'Meta Ads · Reels Verão', who: 'AN', c: 2 }] },
    { label: 'Fechado', dot: '#8fbf3a', value: 'R$ 9.800', cards: [{ n: 'Bruno Tavares', d: 'Clube do Banho anual', o: 'Remarketing', who: 'RF', c: 4 }] },
  ];
  return <>
    <Head title="Oportunidades" sub="Funil de vendas · ao vivo para a equipe"><span className="pt-filter">Comigo</span><span className="pt-filter is-on">Todos</span><span className="pt-btn"><UserPlus aria-hidden="true" />Novo cliente</span></Head>
    <div className="pt-board">
      {cols.map((col) => <div key={col.label} className="pt-col">
        <div className="pt-col__h"><span><i style={{ background: col.dot }} />{col.label}</span><small>{col.cards.length} · {col.value}</small></div>
        {col.cards.map((c) => <article key={c.n} className="pt-opp">
          <b>{c.n}</b><p>{c.d}</p><span className="pt-origin">{c.o}</span>
          <footer>{c.who ? <i className="pt-av pt-av--sm">{c.who}</i> : <span className="pt-claim">Assumir</span>}{c.c > 0 && <span className="pt-comments"><MessageCircle aria-hidden="true" />{c.c}</span>}</footer>
        </article>)}
      </div>)}
    </div>
  </>;
}

function WhatsApp() {
  const chats = [
    { n: 'Marina Albuquerque', m: 'Pode ser sábado de manhã?', t: '09:42', u: 2, tag: 'Quente', tint: '#d2f525' },
    { n: 'Pedro Siqueira', m: '🎤 Mensagem de voz (0:24)', t: '09:15', u: 0, tag: 'Morno', tint: '#cce1b9' },
    { n: 'Júlia Rocha', m: 'Vocês aceitam gato também?', t: 'Ontem', u: 0, tag: 'Frio', tint: '#e2edcf' },
    { n: 'Bruno Tavares', m: 'Obrigado! Até semana que vem', t: 'Ontem', u: 0, tag: 'Cliente', tint: '#bcd3a8' },
  ];
  return <div className="pt-wa">
    <div className="pt-wa__list">
      <div className="pt-search"><Search aria-hidden="true" />Buscar conversa</div>
      <div className="pt-wa__tags"><span className="is-on">Todas</span><span>Quente</span><span>Morno</span><span>Frio</span></div>
      {chats.map((c, i) => <div key={c.n} className={`pt-chat${i === 0 ? ' is-on' : ''}`}><Avatar name={c.n} tint={c.tint} /><div><b>{c.n}</b><span>{c.m}</span><em className={`pt-wtag t-${c.tag}`}>{c.tag}</em></div><small>{c.t}{c.u > 0 && <i>{c.u}</i>}</small></div>)}
    </div>
    <div className="pt-wa__thread">
      <div className="pt-wa__top"><Avatar name="Marina Albuquerque" tint="#d2f525" /><div><b>Marina Albuquerque</b><span>Veio do quiz · Meta Ads · Reels Verão</span></div><em className="pt-wtag t-Quente">Quente</em></div>
      <div className="pt-wa__msgs">
        <p className="in">Oi! Vi o anúncio do Clube do Banho. Como funciona?</p>
        <p className="out">Olá, Marina! São 4 banhos por mês com tosa higiênica. Qual é o porte do seu cachorro?</p>
        <p className="in">É um shih-tzu, pequeno 🐶</p>
        <p className="out">Perfeito. Tenho horário sábado às 9h ou às 11h.</p>
        <p className="in">Pode ser sábado de manhã?</p>
      </div>
      <div className="pt-wa__reply"><Paperclip aria-hidden="true" /><span>Escreva uma mensagem</span><Mic aria-hidden="true" /><i><Send aria-hidden="true" /></i></div>
    </div>
  </div>;
}

function useStep(max: number, every: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(max); return; }
    const t = window.setInterval(() => setN((v) => (v >= max + 2 ? 0 : v + 1)), every);
    return () => window.clearInterval(t);
  }, [max, every]);
  return Math.min(n, max);
}

function Formularios() {
  const step = useStep(3, 1500);
  return <>
    <Head title="Quiz · Primeiro banho" sub="Publicado na página de oferta · 128 respostas"><span className="pt-live"><i />Publicado</span></Head>
    <div className="pt-grid2 pt-grid2--form">
      <section className="pt-card">
        <h5>Perguntas</h5>
        {[['1', 'Qual é o porte do seu pet?', 'Pequeno · Médio · Grande'], ['2', 'Com que frequência ele toma banho?', 'Toda semana · A cada 15 dias · Raramente'], ['3', 'Qual o melhor horário?', 'Manhã · Tarde · Sábado'], ['4', 'Seu WhatsApp', 'Telefone · obrigatório']].map(([n, q, a]) =>
          <div className="pt-q" key={n}><span>{n}</span><div><b>{q}</b><small>{a}</small></div></div>)}
        <div className="pt-rule"><Check aria-hidden="true" />Toda semana ou a cada 15 dias → lead <b>quente</b></div>
      </section>
      <section className="pt-card">
        <h5>Lead chegando · agora</h5>
        {step === 0 ? <p className="pt-wait"><i className="pt-dot" />Esperando a próxima resposta…</p> : <>
          <div className="pt-lead pt-in"><Avatar name="Marina Albuquerque" tint="#d2f525" /><div><b>Marina Albuquerque</b><span>(51) 9•••-•••2 · respondeu o quiz</span></div><em className="pt-tag k-lead">Quente</em></div>
          <dl className="pt-dl pt-in">{[['Porte', 'Pequeno'], ['Frequência', 'Toda semana'], ['Origem', 'Meta Ads'], ['Campanha', 'Reels Verão']].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </>}
        {step >= 2 && <div className="pt-flow pt-in"><Check aria-hidden="true" />Entrou em Oportunidades como <b>Novo lead</b></div>}
        {step >= 3 && <div className="pt-wa-alert pt-in"><span className="pt-wa-alert__app"><MessageCircle aria-hidden="true" />WhatsApp · Equipe Caramelo</span><b>🔔 Novo lead: Marina Albuquerque</b><p>Quiz Primeiro banho · Meta Ads · Reels Verão<br />Porte pequeno · banho toda semana</p><small>agora</small></div>}
      </section>
    </div>
  </>;
}

/** Visitantes fictícios que andam pelo site: troca de página, um chega, um clica no WhatsApp. */
const PAGES = ['/inicio', '/clube-do-banho', '/servicos/tosa', '/hotel', '/contato'];
const VISITORS = [
  { id: 'a', place: 'Porto Alegre, RS', from: 'Meta Ads · Reels Verão', device: 'iPhone' },
  { id: 'b', place: 'São Leopoldo, RS', from: 'Google · Busca', device: 'Android' },
  { id: 'c', place: 'Canoas, RS', from: 'Instagram', device: 'Android' },
  { id: 'd', place: 'Novo Hamburgo, RS', from: 'Direto', device: 'Computador' },
];
function useLiveVisitors() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 2600);
    return () => window.clearInterval(t);
  }, []);
  const count = 3 + (tick % 4 === 3 ? 1 : 0);
  return VISITORS.slice(0, count).map((v, i) => {
    const step = tick + i * 2;
    const converted = v.id === 'a' && tick % 8 >= 5;
    return { ...v, page: converted ? '/contato' : PAGES[step % PAGES.length], seconds: 40 + ((tick * 3 + i * 47) % 280), converted };
  });
}

function Site() {
  const cities = [['Porto Alegre', 214], ['São Leopoldo', 168], ['Novo Hamburgo', 97], ['Canoas', 81], ['Gravataí', 42]] as const;
  const grow = useGrow();
  const pins = [[52, 38, true], [58, 46, true], [47, 55, false], [63, 30, false], [41, 44, true], [55, 62, false], [66, 52, false]] as const;
  const live = useLiveVisitors();
  const converted = live.find((v) => v.converted);
  return <>
    <Head title="Visitas ao site" sub="caramelopet.exemplo · 652 visitas no período"><span className="pt-live"><i />{live.length} no site agora</span><Period /></Head>
    <div className="pt-kpis pt-kpis--4">
      <Kpi label="Visitas" value="652" delta="+18%" />
      <Kpi label="Pessoas" value="511" />
      <Kpi label="Tempo médio" value="1 min 42 s" />
      <Kpi label="Chegaram a um contato" value="38" delta="5,8%" />
    </div>
    <div className="pt-grid2">
      <section className="pt-card pt-map">
        <h5>Mapa · Região Metropolitana</h5>
        <svg viewBox="0 0 100 80" aria-hidden="true"><path d="M20 18 L48 8 L78 14 L90 34 L84 60 L60 74 L30 70 L12 50 Z" fill="#eef3e6" stroke="#cfdcc0" strokeWidth=".6" /><path d="M40 10 L44 40 L30 70 M48 40 L84 40 M44 40 L60 74" stroke="#dfe7d4" strokeWidth=".5" fill="none" />
          {pins.map(([x, y, live], i) => <g key={i}>{live && <circle cx={x} cy={y} r="4.5" className="pt-pulse" />}<circle cx={x} cy={y} r={live ? 2 : 1.6} fill={live ? '#6f8c3a' : '#b4c49d'} /></g>)}</svg>
        <div className="pt-legend"><span><i className="is-live" />Ao vivo</span><span><i />Visitas do período</span></div>
      </section>
      <section className="pt-card">
        <h5>No site agora</h5>
        <div className="pt-visitors" aria-live="polite">{live.map((v) => <div key={v.id} className={`pt-visitor${v.converted ? ' is-converted' : ''}`}>
          <i className="pt-dot" /><div><b>{v.place}</b><span>{v.from} · {v.device}</span></div>
          <code key={v.page}>{v.page}</code><small>{Math.floor(v.seconds / 60)}:{String(v.seconds % 60).padStart(2, '0')}</small>
        </div>)}</div>
        {converted && <div className="pt-toast" key="toast"><MessageCircle aria-hidden="true" /><div><b>Clicou no WhatsApp</b><span>{converted.place} · {converted.from}</span></div></div>}
        <h5 className="pt-mt">Cidades</h5>
        {cities.slice(0, 3).map(([c, n]) => <div key={c} className="pt-bar"><span>{c}</span><div><i style={{ width: grow ? `${(n / 214) * 100}%` : 0 }} /></div><b>{n}</b></div>)}
      </section>
    </div>
  </>;
}

function Anuncios() {
  const days = [32, 48, 41, 66, 58, 72, 61];
  const grow = useGrow();
  return <>
    <Head title="Anúncios da Meta" sub="Conta Caramelo Pet · somente leitura"><Period /><span className="pt-btn pt-btn--ghost">Gerenciador ↗</span></Head>
    <div className="pt-kpis pt-kpis--4">
      <Kpi label="Valor usado" value="R$ 480,20" />
      <Kpi label="Resultados" value="31" delta="Leads" />
      <Kpi label="Custo por resultado" value="R$ 15,49" />
      <Kpi label="CTR (taxa de cliques no link)" value="2,84%" />
    </div>
    <div className="pt-grid2 pt-grid2--ads">
      <section className="pt-card pt-chart">
        <div className="pt-chart__h"><h5>Por dia</h5><span className="pt-pill">Resultados <ChevronDown aria-hidden="true" /></span></div>
        <div className="pt-cols">{days.map((v, i) => <div key={i}><i style={{ height: grow ? `${v}%` : '2%' }} className={i === 5 ? 'is-hi' : ''} /><span>{['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'][i]}</span></div>)}</div>
      </section>
      <section className="pt-card">
        <h5>Campanhas</h5>
        <div className="pt-camp pt-camp--h"><span>Campanha</span><span>Usado</span><span>Result.</span><span>Custo</span></div>
        {[['Reels Verão', 'R$ 210', '16', 'R$ 13,12', true], ['Remarketing', 'R$ 140', '9', 'R$ 15,55', true], ['Carrossel Cozinha', 'R$ 130', '6', 'R$ 21,66', false]].map(([n, s, r, c, on]) =>
          <div key={String(n)} className="pt-camp"><b><i className={on ? 'is-on' : ''} />{n}</b><span>{s}</span><span>{r}</span><span>{c}</span></div>)}
      </section>
    </div>
  </>;
}

function InstagramScreen() {
  const grow = useGrow();
  const reach = [40, 52, 46, 70, 64, 88, 76, 92, 70, 84];
  const path = reach.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (reach.length - 1)) * 100} ${40 - (v / 100) * 36}`).join(' ');
  return <>
    <Head title="Instagram" sub="@caramelopet.exemplo · perfil profissional"><span className="pt-filter is-on">Perfil</span><span className="pt-filter">Stories</span><span className="pt-filter">Caixa</span></Head>
    <div className="pt-ig">
      <section className="pt-ig__followers">
        <span>Seguidores</span><b>4.812</b><em>+126 em 7 dias</em>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke="#d2f525" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
      </section>
      <div className="pt-kpis pt-kpis--3">
        <Kpi label="Alcance" value="18,4 mil" delta="+22%" />
        <Kpi label="Interações" value="1.296" delta="+8%" />
        <Kpi label="Toques no link" value="214" delta="+31%" />
      </div>
    </div>
    <div className="pt-grid2">
      <section className="pt-card">
        <h5>Melhores posts · 30 dias</h5>
        <div className="pt-posts">{[['#f4d9b8', 'Reels', '6,2 mil'], ['#cfe0f1', 'Carrossel', '3,8 mil'], ['#e2edcf', 'Foto', '2,1 mil'], ['#f1d3d9', 'Reels', '1,9 mil']].map(([bg, f, r], i) =>
          <div key={i} style={{ background: bg }}><span>{f}</span><b>{r}<small> alcance</small></b></div>)}</div>
      </section>
      <section className="pt-card">
        <h5>Stories programados</h5>
        {[['Hoje · 18:00', 'Antes e depois do banho', 'Agendado'], ['Amanhã · 10:00', 'Dica: escovação diária', 'Aguardando aprovação'], ['Sex · 12:00', 'Clube do Banho', 'Ideia']].map(([when, t, s]) =>
          <div className="pt-row" key={t}><span className="pt-story" /><div><b>{t}</b><span>{when}</span></div><em className={`pt-tag ${s === 'Agendado' ? 'k-ok' : s === 'Ideia' ? '' : 'k-passo'}`}>{s}</em></div>)}
        <div className="pt-bars-mini">{[64, 80, 52, 90, 70].map((v, i) => <i key={i} style={{ height: grow ? `${v}%` : '4%' }} />)}<span><TrendingUp aria-hidden="true" />Alcance dos stories da semana</span></div>
      </section>
    </div>
  </>;
}

