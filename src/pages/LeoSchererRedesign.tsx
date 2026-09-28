import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Menu, Search, ShieldCheck, Smartphone, Truck, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './LeoSchererRedesign.css';

gsap.registerPlugin(ScrollTrigger);

const inventory = [
  { name: 'iPhone 18 Pro', category: 'Novo', detail: '256 GB, 512 GB, 1 TB ou 2 TB', price: 'Consulte disponibilidade', image: '/leoscherer/assets/official/iphone-18-pro-hero.jpg', tone: '#16090d', dark: true },
  { name: 'iPhone 16 128 GB Rosa', category: 'Seminovo', detail: 'Produto anunciado no estoque LS', price: 'R$ 4.490', image: '/leoscherer/assets/product-main.png', tone: '#f3d8e7' },
  { name: 'Apple Watch Series 10', category: 'Apple Watch', detail: 'Consulte modelos e tamanhos', price: 'Consulte disponibilidade', image: '/leoscherer/assets/watch.jpg', tone: '#050505', dark: true },
  { name: 'MacBook Air', category: 'Mac', detail: 'Novos e seminovos', price: 'Consulte disponibilidade', image: '/leoscherer/assets/macbook-air.png', tone: '#e8edf0' },
];

const features = [
  { index: '01', label: 'Câmera', title: 'Mais controle para criar.', copy: 'A câmera Fusion principal de 48 MP estreia abertura variável e novos controles Pro para fotos e vídeos.' },
  { index: '02', label: 'Desempenho', title: 'A potência do A20 Pro.', copy: 'O novo chip combina CPU de 6 núcleos, GPU de 7 núcleos e Neural Engine para desempenho profissional.' },
  { index: '03', label: 'Bateria', title: 'Até 43 horas de vídeo.', copy: 'O iPhone 18 Pro Max oferece a maior duração de bateria em um iPhone Pro, segundo a Apple.' },
];

export default function LeoSchererRedesign({ proposal = false }: { proposal?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const product = inventory[selected];

  useLayoutEffect(() => {
    if (!root.current) return;
    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.ls18-nav-inner', { y: -18, opacity: 0, duration: 0.6, ease: 'power3.out' });
        gsap.from('.ls18-hero-copy > *', { y: 28, opacity: 0, stagger: 0.08, duration: 0.75, ease: 'power3.out', delay: 0.1 });
        gsap.from('.ls18-hero-device', { y: 60, scale: 0.92, opacity: 0, duration: 1.1, ease: 'power3.out', delay: 0.15 });
        gsap.to('.ls18-hero-device', { yPercent: 12, scale: 1.04, ease: 'none', scrollTrigger: { trigger: '.ls18-hero', start: 'top top', end: 'bottom top', scrub: 0.8 } });
        ScrollTrigger.batch('.ls18-reveal', { start: 'top 88%', once: true, onEnter: (items) => gsap.fromTo(items, { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.65, ease: 'power3.out' }) });
      });
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.ls18-feature-card');
        const timeline = gsap.timeline({ scrollTrigger: { trigger: '.ls18-product-story', start: 'top top', end: '+=1700', pin: true, scrub: 0.7 } });
        cards.forEach((_, index) => {
          timeline.to(cards, { opacity: (itemIndex) => itemIndex === index ? 1 : 0.22, duration: 0.45 }, index);
          timeline.to('.ls18-feature-image', { scale: 1 + index * 0.035, yPercent: index * -2, duration: 0.65 }, index);
        });
      });
      return () => mm.revert();
    }, root);
    return () => context.revert();
  }, []);

  return (
    <div className="ls18" ref={root}>
      <header className="ls18-nav"><div className="ls18-nav-inner">
        <a href="#inicio" className="ls18-brand" aria-label="LS, início"><img src="/leoscherer/assets/logo.png" alt="LS Produtos Apple e Importados" /></a>
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Navegação principal">
          <a href="#lancamento" onClick={() => setMenuOpen(false)}>iPhone 18 Pro</a><a href="#produtos" onClick={() => setMenuOpen(false)}>Produtos</a><a href="#seminovos" onClick={() => setMenuOpen(false)}>Seminovos</a><a href="#vantagens" onClick={() => setMenuOpen(false)}>Por que a LS</a>
        </nav>
        <div className="ls18-nav-actions"><button aria-label="Buscar"><Search size={18} /></button><a href="#contato" className="ls18-nav-cta">Simule sua compra <ArrowRight size={15} /></a><button className="ls18-menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Abrir menu">{menuOpen ? <X /> : <Menu />}</button></div>
      </div></header>

      <main>
        <section className="ls18-hero" id="inicio">
          <div className="ls18-hero-copy"><p className="ls18-eyebrow">Disponível na LS</p><h1>iPhone 18 Pro</h1><h2>Muito mais Pro.</h2><p>Conheça a nova geração com câmera Fusion de 48 MP, chip A20 Pro e a maior duração de bateria em um iPhone Pro.</p><div className="ls18-actions"><a className="ls18-button primary" href="#contato">Adquira o seu conosco <ArrowRight size={17} /></a><a className="ls18-button text" href="#lancamento">Ver novidades <ChevronDown size={17} /></a></div></div>
          <div className="ls18-hero-media"><span>Nova cor bordô</span><img className="ls18-hero-device" src="/leoscherer/assets/official/iphone-18-pro-hero.jpg" alt="iPhone 18 Pro e iPhone 18 Pro Max na cor bordô" /></div>
        </section>

        <section className="ls18-proof" aria-label="Vantagens da LS"><div><ShieldCheck /><span><b>1 ano de garantia</b> em produtos novos</span></div><div><Smartphone /><span><b>Seu usado na troca</b> a partir do iPhone 7</span></div><div><Truck /><span><b>Entrega no mesmo dia</b> no Vale dos Sinos e região metropolitana</span></div></section>

        <section className="ls18-launch" id="lancamento">
          <div className="ls18-launch-copy ls18-reveal"><p className="ls18-eyebrow dark">iPhone 18 Pro</p><h2>Quatro acabamentos.<br />Uma linha totalmente Pro.</h2><p>Preto, prateado, glacial e o novo bordô. Escolha entre 256 GB, 512 GB, 1 TB e 2 TB.</p><a href="#contato">Consultar cores e capacidades <ArrowRight size={16} /></a></div>
          <figure className="ls18-launch-image ls18-reveal"><img src="/leoscherer/assets/official/iphone-18-pro-colors.jpg" alt="Linha iPhone 18 Pro nas cores preto, prateado, glacial e bordô" /><figcaption>Imagem oficial Apple • iPhone 18 Pro</figcaption></figure>
        </section>

        <section className="ls18-product-story">
          <div className="ls18-feature-visual"><img className="ls18-feature-image" src="/leoscherer/assets/official/iphone-18-pro-camera.jpg" alt="Retrato em preto e branco fotografado com iPhone 18 Pro" /><span>Fotografado com iPhone 18 Pro</span></div>
          <div className="ls18-feature-list">{features.map((feature) => <article className="ls18-feature-card" key={feature.index}><div><span>{feature.index}</span><b>{feature.label}</b></div><h3>{feature.title}</h3><p>{feature.copy}</p></article>)}</div>
        </section>

        <section className="ls18-catalog" id="produtos">
          <div className="ls18-section-title ls18-reveal"><div><p className="ls18-eyebrow dark">Produtos em destaque</p><h2>Encontre seu próximo Apple.</h2></div><p>Produtos novos e seminovos com atendimento para escolher o modelo certo.</p></div>
          <div className="ls18-explorer ls18-reveal">
            <div className="ls18-product-menu" role="tablist" aria-label="Produtos em destaque">{inventory.map((item, index) => <button key={item.name} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)} role="tab" aria-selected={selected === index}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{item.name}</b><small>{item.category}</small></div><ArrowRight size={17} /></button>)}</div>
            <article className={`ls18-product-view ${product.dark ? 'dark' : ''}`} style={{ '--tone': product.tone } as React.CSSProperties}><div className="ls18-product-meta"><span>{product.category}</span><p>{product.detail}</p></div><img key={product.image} src={product.image} alt={product.name} /><div className="ls18-product-bottom"><div><h3>{product.name}</h3><strong>{product.price}</strong></div><a href="#contato">Tenho interesse <ArrowRight size={16} /></a></div></article>
          </div>
        </section>

        <section className="ls18-seminovos" id="seminovos"><div className="ls18-seminovos-copy ls18-reveal"><p className="ls18-eyebrow dark">Seminovos LS</p><h2>Procedência para comprar com tranquilidade.</h2><p>Produtos usados com garantia e parcelamento em até 18 vezes. Consulte o estoque atualizado e encontre a melhor opção para o seu momento.</p><a className="ls18-button dark" href="#contato">Ver seminovos disponíveis <ArrowRight size={17} /></a></div><div className="ls18-seminovos-photo ls18-reveal"><img src="/leoscherer/assets/product-1.jpeg" alt="iPhone 16 rosa seminovo disponível na LS" /></div></section>

        <section className="ls18-trade" id="vantagens"><img src="/leoscherer/assets/official/apple-trade-in.jpg" alt="Troca de um iPhone usado por um iPhone novo" /><div className="ls18-trade-copy ls18-reveal"><p className="ls18-eyebrow dark">Troca facilitada</p><h2>Seu usado vale na compra do próximo.</h2><p>A LS aceita aparelhos a partir do iPhone 7. Envie os dados do seu aparelho para receber uma avaliação.</p><a href="#contato">Avaliar meu aparelho <ArrowRight size={16} /></a></div></section>

        <section className="ls18-benefits"><article className="ls18-reveal"><span>01</span><h3>Entrega no mesmo dia</h3><p>Para o Vale dos Sinos e região metropolitana, conforme disponibilidade.</p></article><article className="ls18-reveal"><span>02</span><h3>Transferência de dados</h3><p>A equipe transfere seus dados do iPhone ou ajuda a criar seu Apple ID ao migrar do Android.</p></article><article className="ls18-reveal"><span>03</span><h3>Até 18 vezes</h3><p>Simule as parcelas antes de fechar a compra.</p></article></section>

        <section className="ls18-contact" id="contato"><div className="ls18-contact-copy ls18-reveal"><p className="ls18-eyebrow">Atendimento LS</p><h2>Qual é o seu próximo Apple?</h2><p>Conte o que você procura e receba disponibilidade, condições e uma simulação de compra.</p></div><form className="ls18-contact-form ls18-reveal" onSubmit={(event) => event.preventDefault()}><label>Seu nome<input type="text" placeholder="Como podemos chamar você?" /></label><label>Produto de interesse<select defaultValue=""><option value="" disabled>Selecione</option><option>iPhone 18 Pro</option><option>Outro iPhone novo</option><option>iPhone seminovo</option><option>Apple Watch</option><option>Mac</option><option>Outro produto</option></select></label><label>WhatsApp<input type="tel" placeholder="(00) 00000-0000" /></label><button type="submit">Solicitar atendimento <ArrowRight size={17} /></button></form></section>

        {proposal && <section className="ls18-proposal"><div className="ls18-proposal-heading"><p>Proposta enxuta</p><h2>Uma vitrine melhor, pronta para vender.</h2><span>Escopo focado na home, no catálogo atual e na conversão para o atendimento.</span></div><div className="ls18-proposal-grid"><article><p>Incluído</p><ul>{['Redesign responsivo da página inicial', 'Campanha iPhone 18 Pro', 'Organização da vitrine e navegação', 'GSAP no hero e em uma seção de produto', 'Aplicação no WordPress atual', 'Uma rodada de ajustes e publicação'].map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul></article><article className="ls18-price"><p>Investimento fechado</p><strong>R$ 5.900</strong><span>50% no início • 50% na entrega</span><div><b>10 dias úteis</b><small>após aprovação e acessos</small></div><a href="#inicio">Rever a proposta <ArrowRight size={16} /></a></article></div><p className="ls18-scope-note">Mantém WooCommerce, checkout e cadastro de produtos atuais. Novas integrações, fotografia, cadastro massivo e páginas internas adicionais podem ser orçados separadamente.</p></section>}
      </main>

      <footer className="ls18-footer"><img src="/leoscherer/assets/logo.png" alt="LS Produtos Apple e Importados" /><p>Produtos Apple novos e seminovos.</p><div><a href="#produtos">Produtos</a><a href="#seminovos">Seminovos</a><a href="#contato">Contato</a></div><span>Proposta de redesign • 2026</span></footer>
    </div>
  );
}
