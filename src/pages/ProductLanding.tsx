import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, CircleCheck, Clock3, Monitor,
  CircleDot, Filter, LayoutDashboard, ListChecks, Menu, MessageCircle,
  Megaphone, MousePointer2, X,
} from 'lucide-react';
import { SinfyMark, SinfyWordmark, SINFY_SYMBOL } from '@/features/sinfy/SinfyBrand';
import { SinfyLoading } from '@/features/sinfy/SinfyLoading';
import { LiveJourney } from '@/features/sinfy/LiveJourney';
import { ProductTour } from '@/features/sinfy/ProductTour';
import { AggregatorNetwork } from '@/features/sinfy/AggregatorNetwork';
import { AGENCY_OFFER, monthlyBrl } from '@/features/superelements/agencyOffer';
import { SOLUTIONS as SOLUTION_DATA, PILLARS, BENEFITS, FAQ } from '@/features/sinfy/lpContent';
import './ProductLanding.css';

const SOLUTION_ICONS = { resultados: BarChart3, leads: MousePointer2, crm: Filter, whatsapp: MessageCircle, relatorios: ListChecks } as const;
const SOLUTIONS = SOLUTION_DATA.map((item) => ({ ...item, icon: SOLUTION_ICONS[item.id] }));

function Brand() {
  return <a className="lp-brand" href="#topo" aria-label="Sinfy, início"><SinfyWordmark /></a>;
}

function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return <p className="lp-label" data-section={number}>{children}</p>;
}

function DemoWindow({ mode = 'crm', compact = false }: { mode?: string; compact?: boolean }) {
  return <div className={`lp-window${compact ? ' lp-window--compact' : ''}`}>
    <div className="lp-window__top"><span><SinfyMark /> Casa Lume <ChevronDown aria-hidden="true" /></span><span className="lp-demo-label">Empresa fictícia · demonstração</span></div>
    <div className="lp-window__layout">
      {!compact && <aside className="lp-window__sidebar" aria-label="Áreas ilustrativas da plataforma">
        <span className="lp-window__account">Área da empresa</span>
        {[['Visão geral', LayoutDashboard], ['Anúncios', Megaphone], ['Site', BarChart3], ['Leads', Filter], ['Conversas', MessageCircle]].map(([label, Icon]) => {
          const ItemIcon = Icon as typeof Filter;
          return <span key={String(label)} className={label === 'Leads' ? 'active' : ''}><ItemIcon aria-hidden="true" />{String(label)}</span>;
        })}
        <small>Agência e negócio.<br />Uma operação conectada.</small>
      </aside>}
      <div className="lp-window__content">
        {mode === 'whatsapp' || mode === 'relatorios' ? <>
          <div className="lp-screen-heading"><div><small>{mode === 'relatorios' ? 'Acompanhamento pelo WhatsApp' : 'Atendimento da equipe'}</small><h3>{mode === 'relatorios' ? 'Os dados perto de você.' : 'Toda conversa tem contexto.'}</h3></div><MessageCircle aria-hidden="true" /></div>
          <div className="lp-chat">
            <div className="lp-chat__person"><span className="lp-avatar">CL</span><div><b>{mode === 'relatorios' ? 'Resumo da operação' : 'Marina · cozinha planejada'}</b><small>{mode === 'relatorios' ? 'Casa Lume · últimos 7 dias' : 'Histórico da conversa'}</small></div></div>
            <p className="lp-bubble lp-bubble--mine">{mode === 'relatorios' ? 'Como foi nossa semana?' : 'Olá! Quero um orçamento de cozinha planejada.'}</p>
            <div className="lp-bubble">{mode === 'relatorios' ? <><b>Seu resumo da semana</b><span>24 contatos recebidos</span><span>8 medições agendadas</span><span>3 oportunidades em acompanhamento</span></> : <><b>Olá, Marina!</b><span>Vamos marcar a medição. Qual é o tamanho da cozinha?</span></>}</div>
            <p className="lp-chat__foot"><CircleCheck aria-hidden="true" /> {mode === 'relatorios' ? 'Informações da própria conta' : 'Atendimento registrado no histórico'}</p>
          </div>
        </> : mode === 'leads' ? <>
          <div className="lp-screen-heading"><div><small>Captação e qualificação</small><h3>Um contato com contexto.</h3></div><MousePointer2 aria-hidden="true" /></div>
          <div className="lp-contact"><span className="lp-avatar">MA</span><h4>Marina Albuquerque</h4><p>Interesse em cozinha planejada</p><dl>{[['Origem identificada', 'Meta Ads'], ['Campanha', 'Carrossel Cozinha'], ['Formulário', 'Orçamento de cozinha'], ['Resposta', 'Quer começar este mês']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><span className="lp-inline-status"><Check aria-hidden="true" /> Respostas vinculadas ao contato</span></div>
        </> : mode === 'resultados' ? <>
          <div className="lp-screen-heading"><div><small>Resultados · últimos 7 dias</small><h3>Da aquisição ao comercial.</h3></div><BarChart3 aria-hidden="true" /></div>
          <div className="lp-results"><div className="lp-screen-stats"><div><span>Investimento Meta</span><b>R$ 480</b></div><div><span>Contatos recebidos</span><b>24</b></div></div><h4>O que virou atendimento</h4>{[['Contatos', 24, 100], ['Em atendimento', 16, 67], ['Medições', 8, 33]].map(([label, count, width]) => <div className="lp-chart-row" key={label}><span>{label}</span><div><i style={{ width: `${width}%` }} /></div><b>{count}</b></div>)}<p>O avanço comercial depende do atendimento e dos registros da equipe.</p></div>
        </> : <>
          <div className="lp-screen-heading"><div><small>Comercial · últimos 7 dias</small><h3>Leads</h3></div><span className="lp-screen-period">Últimos 7 dias <ChevronDown aria-hidden="true" /></span></div>
          <div className="lp-screen-stats"><div><span>Contatos recebidos</span><b>24</b></div><div><span>Em atendimento</span><b>8</b></div><div><span>Medições</span><b>8</b></div></div>
          <div className="lp-board">{[
            { label: 'Novo contato', count: '08', name: 'Marina Albuquerque', detail: 'Cozinha planejada', origin: 'Meta Ads', person: 'MA', foot: 'Próximo passo: responder' },
            { label: 'Em atendimento', count: '08', name: 'Pedro Siqueira', detail: 'Closet do casal', origin: 'Formulário do site', person: 'PS', foot: 'Responsável: Ana' },
            { label: 'Medição agendada', count: '08', name: 'Carla Menezes', detail: 'Dormitório infantil', origin: 'Origem não identificada', person: 'CM', foot: 'Confirmado pela equipe' },
          ].map((column, i) => <div className="lp-board__column" key={column.label}><div className="lp-board__label"><span><i className={`stage-${i}`} />{column.label}</span><small>{column.count}</small></div><article><div className="lp-board__contact"><span className="lp-avatar">{column.person}</span><b>{column.name}</b></div><p>{column.detail}</p><span className="lp-origin">{column.origin}</span><footer>{i === 2 ? <CircleCheck aria-hidden="true" /> : <CircleDot aria-hidden="true" />}{column.foot}</footer></article><div className="lp-board__placeholder" aria-hidden="true"><i /><i /></div></div>)}</div>
        </>}
      </div>
    </div>
  </div>;
}

export default function ProductLanding() {
  const [solution, setSolution] = useState(0);
  const [audience, setAudience] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = SOLUTIONS[solution];
  const benefit = BENEFITS[audience];

  useEffect(() => {
    const title = document.title;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = theme?.content;
    if (theme) theme.content = '#171b19';
    const language = document.documentElement.lang;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousFavicon = favicon?.getAttribute('href');
    const previousFaviconType = favicon?.getAttribute('type');
    if (favicon) {
      favicon.href = `data:image/svg+xml,${encodeURIComponent(SINFY_SYMBOL)}`;
      favicon.type = 'image/svg+xml';
    }
    const socialMetadata = [
      ['og:title', 'Sinfy — sua agência e o cliente na mesma operação'],
      ['og:description', 'Seu serviço conectado a contatos, atendimento, oportunidades e resultados.'],
    ].map(([property, content]) => {
      const element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      const previous = element?.content;
      if (element) element.content = content;
      return { element, previous };
    });
    document.title = 'Sinfy — sua agência e o cliente na mesma operação';
    document.documentElement.lang = 'pt-BR';
    if (description) description.content = 'Entregue seu serviço com uma plataforma para o cliente acompanhar contatos, atendimento, oportunidades e resultados.';
    return () => {
      document.title = title;
      if (theme && previousTheme !== undefined) theme.content = previousTheme;
      if (favicon) {
        if (previousFavicon !== null && previousFavicon !== undefined) favicon.setAttribute('href', previousFavicon);
        else favicon.removeAttribute('href');
        if (previousFaviconType !== null && previousFaviconType !== undefined) favicon.setAttribute('type', previousFaviconType);
        else favicon.removeAttribute('type');
      }
      document.documentElement.lang = language;
      if (description && previousDescription !== undefined) description.content = previousDescription;
      socialMetadata.forEach(({ element, previous }) => { if (element && previous !== undefined) element.content = previous; });
    };
  }, []);

  function navigateTab(event: React.KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % SOLUTIONS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + SOLUTIONS.length) % SOLUTIONS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SOLUTIONS.length - 1;
    else return;
    event.preventDefault(); setSolution(next); tabs.current[next]?.focus();
  }

  return <div className="lp lp--sinfy" id="topo">
    <SinfyLoading />
    <a href="#conteudo" className="lp-skip">Pular para o conteúdo</a>
    <header className="lp-nav"><div className="lp-wrap lp-nav__inner"><Brand />
      <nav id="lp-mobile-links" className={`lp-nav__links${menuOpen ? ' is-open' : ''}`} aria-label="Navegação principal" onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); document.getElementById('lp-menu-trigger')?.focus(); } }}>{[['#operacao', 'Operação ao vivo'], ['#solucoes', 'Plataforma'], ['#por-que', 'Para agências'], ['#planos', 'Planos']].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
      <div className="lp-nav__actions"><Link to="/auth" className="lp-login">Entrar <ArrowUpRight aria-hidden="true" /></Link><a className="lp-button lp-button--small" href="#demonstracao">Ver a plataforma <ArrowRight aria-hidden="true" /></a><button id="lp-menu-trigger" type="button" className="lp-menu" aria-expanded={menuOpen} aria-controls="lp-mobile-links" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
    </div></header>

    <main id="conteudo">
      <section className="lp-hero" aria-labelledby="lp-title"><div className="lp-wrap">
        <div className="lp-hero__intro"><div><p className="lp-eyebrow"><span /> Instagram, anúncios, site, loja, WhatsApp e CRM.</p><h1 id="lp-title">Seus dados juntos.<br />Suas vendas<br /><span>mais rápidas.</span></h1></div>
          <div className="lp-hero__support"><p>A Sinfy junta tudo o que traz cliente numa tela só. Você vê na hora o que está acontecendo, pergunta à IA o que os números dizem e a equipe responde antes do lead esfriar.</p><a className="lp-button lp-button--primary" href="#demonstracao">Ver como funciona <ArrowDown aria-hidden="true" /></a><div className="lp-hero__signals"><span><Activity aria-hidden="true" /> Todos os canais, ao vivo</span><span><MessageCircle aria-hidden="true" /> IA que lê os seus números</span></div></div>
        </div>
        <div className="lp-hero__demo lp-hero__demo--tour" id="demonstracao"><div className="lp-demo-caption"><span><i /> A plataforma por dentro</span><span>Telas da Sinfy · empresa e dados fictícios</span><a href="#operacao">Ver a jornada <ArrowDown aria-hidden="true" /></a></div><ProductTour /></div>
        <div className="lp-hero__footer"><span>Um lead. Um responsável. Um próximo passo.</span><div><span><Megaphone aria-hidden="true" /> Anúncio</span><ArrowRight aria-hidden="true" /><span><MousePointer2 aria-hidden="true" /> Site</span><ArrowRight aria-hidden="true" /><span><MessageCircle aria-hidden="true" /> Conversa</span><ArrowRight aria-hidden="true" /><span><Filter aria-hidden="true" /> Venda</span></div></div>
      </div></section>

      <section className="lp-statement" aria-labelledby="statement-title"><div className="lp-wrap"><p className="lp-label">Tudo num lugar só</p><h2 id="statement-title">Seis abas abertas viram uma.<br /><span>E nenhum lead se perde entre elas.</span></h2>
        <p className="lp-hub__lede">Instagram, anúncios, site, loja, WhatsApp e CRM mandam os dados para um lugar só. A Sinfy cruza tudo, a IA lê junto com você e o aviso chega a quem precisa vender.</p>
        <AggregatorNetwork />
        <ol className="lp-pillars" aria-label="O que muda com tudo junto">{PILLARS.map(([title, text], i) => <li key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></div></section>

      <section className="lp-section lp-operation" id="operacao" aria-labelledby="operation-title"><div className="lp-wrap">
        <div className="lp-section-heading"><div><SectionLabel number="01">A plataforma, por dentro</SectionLabel><h2 id="operation-title">Do lead que chegou<br /><span>ao negócio fechado.</span></h2></div><p>O anúncio traz a visita, a visita vira contato e cada contato segue até a venda, com o aviso chegando na hora para quem precisa agir.</p></div>
        <div className="lp-hero__demo lp-journey"><div className="lp-demo-caption"><span><i /> Do clique ao cliente</span><span>Simulação · dados fictícios</span></div><LiveJourney /></div>
        <div className="lp-live-explained"><div><span className="lp-index">01</span><h3>Nenhum contato esquecido.</h3><p>Da visita à venda, cada lead tem etapa, responsável e o próximo passo registrado pela equipe.</p></div><div><span className="lp-index">02</span><h3>Quem precisa de você, primeiro.</h3><p>Contatos esperando resposta, conversas abertas e propostas sem retorno aparecem antes de esfriar.</p></div><aside><Clock3 aria-hidden="true" /><p><strong>Cada fonte, no seu ritmo.</strong> Leads e site recebem eventos. Os anúncios seguem a sincronização da Meta.</p></aside></div>
      </div></section>

      <section className="lp-section lp-solutions" id="solucoes" aria-labelledby="solutions-title"><div className="lp-wrap">
        <div className="lp-section-heading"><div><SectionLabel number="02">Uma plataforma. A operação inteira.</SectionLabel><h2 id="solutions-title">Cada etapa empurra<br />o lead para a venda.</h2></div><p>Anúncio, site, formulário, conversa e relatório conectados à rotina comercial do seu cliente.</p></div>
        <div className="lp-tabs" role="tablist" aria-label="Soluções da plataforma">{SOLUTIONS.map((item, i) => <button type="button" key={item.id} ref={el => { tabs.current[i] = el; }} id={`tab-${item.id}`} role="tab" aria-selected={solution === i} aria-controls={`panel-${item.id}`} tabIndex={solution === i ? 0 : -1} onClick={() => setSolution(i)} onKeyDown={event => navigateTab(event, i)}><item.icon aria-hidden="true" />{item.label}</button>)}</div>
        <div className="lp-solution" role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} tabIndex={0}><div className="lp-solution__copy"><p className="lp-kicker">{active.overline}</p><h3>{active.title}</h3><p>{active.description}</p><ul className="lp-checks">{active.items.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul><a className="lp-text-link" href="#planos">Conhecer o plano Agência <ArrowUpRight aria-hidden="true" /></a></div><div className="lp-solution__visual"><DemoWindow mode={active.id} compact /><p>Exemplo ilustrativo · empresa e dados fictícios.</p></div></div>
      </div></section>

      <section className="lp-section lp-partnership" id="por-que" aria-labelledby="benefits-title"><div className="lp-wrap">
        <div className="lp-partnership__intro"><SectionLabel number="03">Serviço + produto</SectionLabel><h2 id="benefits-title">Sua agência traz o lead.<br /><span>Seu cliente fecha.</span></h2><p>A campanha só vale o que vira venda. Com o mesmo ambiente, a agência vê o que acontece depois e o cliente tem o caminho para fechar.</p></div>
        <div className="lp-partnership__body"><div><div className="lp-audience" role="group" aria-label="Benefícios por público">{BENEFITS.map((item, i) => <button type="button" key={item.label} aria-pressed={audience === i} onClick={() => setAudience(i)}>{item.label}</button>)}</div><div className="lp-benefit-copy"><h3>{benefit.title}</h3><p>{benefit.text}</p><ul className="lp-checks">{benefit.items.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></div><a className="lp-text-link" href="#planos">Levar a Sinfy para meus clientes <ArrowUpRight aria-hidden="true" /></a></div>
          <div className="sinfy-routine__tasks"><div className="sinfy-routine__top"><span><ListChecks aria-hidden="true" /> Próximos passos</span><b aria-live="polite">{3 - completed.length} pendentes</b></div>{[
            { id: 'marina', name: 'Marina Albuquerque', detail: 'Novo contato · formulário', action: 'Enviar a primeira resposta', time: 'Chegou agora' },
            { id: 'pedro', name: 'Pedro Siqueira', detail: 'Em conversa · WhatsApp', action: 'Retomar o atendimento', time: 'Hoje' },
            { id: 'carla', name: 'Carla Menezes', detail: 'Proposta enviada', action: 'Acompanhar a decisão', time: 'Hoje' },
          ].map(task => { const done = completed.includes(task.id); return <article key={task.id} className={done ? 'is-done' : ''}><span className="lp-avatar">{task.name.charAt(0)}</span><div><span className="sinfy-task-time">{done ? 'Concluído no exemplo' : task.time}</span><h3>{task.name}</h3><p>{task.detail}</p><small>{task.action}</small></div><button type="button" aria-pressed={done} aria-label={`${done ? 'Reabrir' : 'Concluir'} tarefa de ${task.name}`} onClick={() => setCompleted(list => done ? list.filter(id => id !== task.id) : [...list, task.id])}><Check aria-hidden="true" /></button></article>; })}<p className="sinfy-routine__hint">Experimente concluir uma tarefa. Esta é uma simulação.</p></div>
        </div>
      </div></section>

      <section className="lp-section lp-pricing" id="planos" aria-labelledby="pricing-title"><div className="lp-wrap lp-pricing__layout">
        <div className="lp-pricing__intro"><SectionLabel number="04">Plano Agência</SectionLabel><h2 id="pricing-title">Do anúncio<br />à venda.<br /><span>Na mesma entrega.</span></h2><p>Conecte o que o cliente já tem. Leve cada contato ao atendimento na hora. Mostre no WhatsApp dele o que virou venda.</p><div className="lp-production"><article><Monitor aria-hidden="true" /><div><h3>Conecta o que já existe.</h3><p>Conta de anúncios da Meta, o site com um código e os formulários por webhook. Nada a refazer.</p></div></article><article><MessageCircle aria-hidden="true" /><div><h3>O resultado chega ao cliente.</h3><p>Resumos agendados e respostas sobre a própria conta, no WhatsApp do dono do negócio.</p></div></article></div><div className="lp-setup" id="como"><span>Como começar</span><p>Conecte anúncios e site <ArrowRight aria-hidden="true" /> Ligue formulários e WhatsApp <ArrowRight aria-hidden="true" /> Fechem juntos</p></div></div>
        <article className="lp-price-card" aria-label="Preço e recursos do plano Agência"><div className="lp-price-card__top"><p className="lp-kicker">{AGENCY_OFFER.name}</p><SinfyMark /></div><h3>Uma conta.<br />Do anúncio à venda.</h3><p className="lp-price"><strong>{monthlyBrl(AGENCY_OFFER.monthlyPerCompany)}</strong><span>por empresa ativa / mês</span></p><p className="lp-price-card__description">Sem mensalidade adicional de parceiro.<br />Você define sua oferta de serviço + plataforma.</p><ul className="lp-checks">{AGENCY_OFFER.items.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul><Link to="/auth" className="lp-button lp-button--primary">Acessar a plataforma <ArrowUpRight aria-hidden="true" /></Link><p className="lp-price-card__terms">Implantação, usuários e conexões são combinados na proposta. O investimento em anúncios e eventual consumo de IA são separados. O site e os criativos continuam com a agência.</p></article>
      </div></section>

      <section className="lp-section lp-faq lp-wrap" id="duvidas" aria-labelledby="faq-title"><div><SectionLabel number="05">Dúvidas frequentes</SectionLabel><h2 id="faq-title">Vamos<br />conectar os pontos.</h2></div><div className="lp-faq__list">{FAQ.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="lp-closing"><div className="lp-wrap"><p className="lp-eyebrow"><span /> Agência e cliente, do anúncio à venda.</p><h2>O próximo lead<br />pode virar <span>negócio fechado.</span></h2><div><p>Responda primeiro. Siga até o fim.</p><Link to="/auth" className="lp-button lp-button--primary">Começar com a Sinfy <ArrowUpRight aria-hidden="true" /></Link></div><div className="lp-footer"><Brand /><span>© {new Date().getFullYear()} Sinfy</span><a href="#topo">Voltar ao topo <ArrowUpRight aria-hidden="true" /></a></div></div></section>
    </main>
  </div>;
}
