const A = '/menuzito/assets'

const icon = (value: string) => `<span class="mz-icon" aria-hidden="true">${value}</span>`

const pains = [
  ['⌛', 'Cliente esperando atendimento', 'Falta de agilidade faz o cliente reduzir o consumo.'],
  ['👥', 'Excesso de funcionários', 'Aumenta seu custo e risco trabalhista.'],
  ['↩', 'Baixa recorrência', 'Falta de ferramentas para fazer o cliente voltar com mais frequência.'],
  ['↘', 'Baixo ticket médio', 'Sem incentivos no momento certo, o cliente deixa de pedir bebidas, sobremesas e adicionais.'],
  ['◷', 'Mesas que demoram para liberar', 'Clientes esperando para pedir ou pagar reduzem a rotatividade das mesas.'],
  ['⚡', 'Garçom sobrecarregado', 'Mesmo com a equipe no limite, o atendimento continua lento e os erros aumentam.'],
  ['▣', 'Reservas perdidas', 'Mensagens esquecidas no WhatsApp resultam em mesas vazias.'],
  ['★', 'Poucas avaliações no Google', 'Seu restaurante tem nota baixa ou nem aparece nas buscas locais.'],
]

const features = [
  ['🍽️', 'Atendimento & Operação', ['Cardápio digital por QR Code', 'Pedidos na mesa', 'KDS e impressão automática', 'Reservas e fila de espera']],
  ['📣', 'Marketing & Fidelização', ['Cupons e campanhas', 'Programa de fidelidade', 'Meta Pixel integrado', 'Avaliações no Google']],
  ['♥', 'CRM & Relacionamento', ['Base de clientes', 'Histórico de consumo', 'Datas especiais', 'Comunicação segmentada']],
  ['⚙', 'Gestão & Administração', ['Múltiplas unidades', 'Perfis de acesso', 'Relatórios em tempo real', 'Atualização centralizada']],
]

const results = [
  ['−', 'Reduza custos', 'Opere com uma equipe mais enxuta e eficiente.'],
  ['↗', 'Venda mais', 'Sugestões e adicionais elevam o valor de cada pedido.'],
  ['⚡', 'Atenda mais rápido', 'O pedido vai direto do cliente para a produção.'],
  ['✓', 'Organize a operação', 'Centralize salão, cozinha e gestão em um só lugar.'],
  ['♥', 'Retenha clientes', 'Conheça quem compra e crie motivos para voltar.'],
  ['★', 'Ganhe avaliações', 'Transforme experiências positivas em reputação local.'],
]

const faqs = [
  ['O Menuzito é apenas um cardápio digital?', 'Não. É uma plataforma completa para atendimento, operação, marketing, CRM, reservas, fila de espera e muito mais.'],
  ['Como faço para começar a usar?', 'Crie sua conta, configure o estabelecimento e publique o seu cardápio. O teste é gratuito por 15 dias.'],
  ['Preciso trocar meu sistema atual?', 'Não. O Menuzito complementa sua operação e pode ser ativado gradualmente.'],
  ['Preciso comprar equipamentos?', 'Você pode começar com os dispositivos que já possui e adicionar equipamentos quando fizer sentido.'],
  ['Meus clientes precisam instalar algum aplicativo?', 'Não. Tudo funciona direto no navegador pelo QR Code.'],
  ['O sistema realmente ajuda a vender mais?', 'As sugestões, adicionais, campanhas e dados de consumo ajudam a aumentar ticket e recorrência.'],
  ['É difícil configurar?', 'A experiência foi pensada para ser simples, guiada e rápida.'],
  ['O Menuzito funciona em tablet?', 'Sim. A plataforma se adapta a celulares, tablets e computadores.'],
  ['O sistema traduz automaticamente o cardápio?', 'O cardápio pode ser disponibilizado em vários idiomas para atender públicos diferentes.'],
  ['Como o Menuzito melhora minhas avaliações no Google?', 'Após uma boa experiência, o cliente pode ser convidado a avaliar o estabelecimento.'],
  ['Posso cancelar quando quiser?', 'Sim. Os planos são transparentes e você mantém o controle da assinatura.'],
]

const clientLogos = ['02', '03', '04', '05', '06', '07', '08', '09', '11', '12', '13']

const brand = `<span class="mz-brand"><img class="mz-brand__duck" src="${A}/menuzito-mascot.webp" alt="Mascote Menuzito"><img class="mz-brand__word" src="${A}/menuzito-logo.webp" alt="Menuzito"></span>`

export interface MenuzitoSection {
  id: string
  title: string
  html: string
}

export const menuzitoSections: MenuzitoSection[] = [
  {
    id: 'hero',
    title: 'Menuzito · Navegação e hero',
    html: `<header class="mz-header">
      <div class="mz-container mz-header__inner">
        <a class="mz-logo" href="#inicio" aria-label="Menuzito">${brand}</a>
        <input class="mz-nav-toggle" id="mz-nav-toggle" type="checkbox" aria-label="Abrir menu">
        <label class="mz-nav-button" for="mz-nav-toggle"><span></span><span></span><span></span></label>
        <nav class="mz-nav" aria-label="Navegação principal">
          <a href="#inicio">Início</a><a href="#ecosystem">Recursos</a><a href="#pricing">Preços</a><a href="#blog">Blog</a><a href="#faq">FAQ</a>
        </nav>
        <div class="mz-header__actions"><button class="mz-language">🇧🇷 <strong>PT</strong>⌄</button><a class="mz-btn mz-btn--ghost" href="#">Entrar</a><a class="mz-btn mz-btn--primary mz-btn--small" href="#pricing">Começar Teste</a></div>
      </div>
    </header>
    <section class="mz-hero" id="inicio">
      <div class="mz-hero__glow"></div>
      <div class="mz-container mz-hero__grid">
        <div class="mz-hero__copy">
          <span class="mz-kicker mz-kicker--green">15 DIAS DE TESTE GRÁTIS</span>
          <h1>Reduza custos,<br>venda mais e <span>automatize o atendimento</span><br>do seu restaurante!</h1>
          <p>Cardápio Digital, Pedidos na Mesa, Reservas e Fila de Espera,<br class="mz-desktop"> CRM e Marketing. Tudo isso e muito mais!</p>
          <div class="mz-actions"><a class="mz-btn mz-btn--primary" href="#pricing">Quero testar grátis <span>→</span></a><a class="mz-btn mz-btn--outline" href="#ecosystem">Conheça os recursos</a></div>
          <div class="mz-trust"><span class="mz-stars">★★★★★</span> Aprovado por donos de estabelecimentos que buscam crescer.</div>
        </div>
        <div class="mz-hero__visual" aria-label="Conheça o Menuzito">
          <div class="mz-video-card"><img src="${A}/product/digital-menu-phones.webp" alt="Cardápio Menuzito em celulares"><span class="mz-play">▶</span></div>
        </div>
      </div>
    </section>`,
  },
  {
    id: 'proof',
    title: 'Menuzito · Métricas e marcas',
    html: `<section class="mz-proof"><div class="mz-container">
      <p class="mz-eyebrow mz-center">A TECNOLOGIA POR TRÁS DE OPERAÇÕES DE SUCESSO</p>
      <div class="mz-stats"><div><strong>500+</strong><span>Negócios Atendidos</span></div><div><strong>1M+</strong><span>Pedidos Processados</span></div><div><strong>50k+</strong><span>Avaliações Coletadas</span></div><div><strong>8+</strong><span>Anos de experiência</span></div></div>
      <div class="mz-logo-marquee"><div class="mz-logo-track">${[...clientLogos, ...clientLogos].map(n => `<img src="${A}/client-logos/brand-${n}.svg" alt="Marca cliente Menuzito">`).join('')}</div></div>
    </div></section>`,
  },
  {
    id: 'pains',
    title: 'Menuzito · Dores da operação',
    html: `<section class="mz-section mz-pains"><div class="mz-container"><h2 class="mz-section-title mz-center">Você está perdendo dinheiro se sua operação ainda sofre com isso:</h2><div class="mz-pain-grid">${pains.map(([i,t,d]) => `<article class="mz-pain-card">${icon(i)}<h3>${t}</h3><p>${d}</p></article>`).join('')}</div></div></section>`,
  },
  {
    id: 'showcase',
    title: 'Menuzito · Ecossistema 3D',
    html: `<section class="mz-showcase" id="ecosystem-showcase"><div class="mz-container"><div class="mz-showcase__heading"><span class="mz-kicker mz-kicker--glass">AUTOATENDIMENTO MENUZITO</span><h2>Mais agilidade no salão.<br>Mais controle na operação.</h2><p>O cliente faz o pedido, a cozinha recebe na hora e sua equipe acompanha tudo em tempo real. Menos espera, menos erros e uma operação muito mais organizada.</p></div><div class="mz-device-stage"><div class="mz-orbit mz-orbit--one"></div><div class="mz-orbit mz-orbit--two"></div><img src="${A}/product/ecosystem-lineup.png" alt="Ecossistema Menuzito com celular, display QR Code, KDS, tablet e impressora"><div class="mz-device-note mz-device-note--left">Pedido feito<br><strong>na mesa</strong></div><div class="mz-device-note mz-device-note--right">Produção<br><strong>em tempo real</strong></div></div></div></section>`,
  },
  {
    id: 'features',
    title: 'Menuzito · Recursos',
    html: `<section class="mz-section mz-features" id="ecosystem"><div class="mz-container"><div class="mz-heading"><span class="mz-kicker mz-kicker--blue">ECOSSISTEMA COMPLETO</span><h2>Tudo que seu estabelecimento precisa</h2><p>Centralize toda a sua operação em um só lugar e ative apenas os recursos que fazem sentido para o seu negócio.</p></div><div class="mz-feature-grid">${features.map(([i,t,items]) => `<article class="mz-feature-card">${icon(i as string)}<h3>${t}</h3><ul>${(items as string[]).map(item=>`<li><span>✓</span>${item}</li>`).join('')}</ul><a href="#pricing">Saiba mais <span>→</span></a></article>`).join('')}</div></div></section>`,
  },
  {
    id: 'results',
    title: 'Menuzito · Resultados',
    html: `<section class="mz-section mz-results"><div class="mz-container"><div class="mz-heading"><h2>Resultados práticos para o seu negócio</h2><p>O Menuzito não é apenas um cardápio, é uma máquina de otimização de lucros.</p></div><div class="mz-results__grid"><div class="mz-result-list">${results.map(([i,t,d])=>`<article>${icon(i)}<div><h3>${t}</h3><p>${d}</p></div></article>`).join('')}</div><div class="mz-phone-art"><span class="mz-blob"></span><img src="${A}/product/reviews-phones.webp" alt="Avaliações Menuzito exibidas em celulares"></div></div></div></section>`,
  },
  {
    id: 'comparison',
    title: 'Menuzito · Comparação antes e depois',
    html: `<section class="mz-section mz-comparison"><div class="mz-container"><div class="mz-heading"><h2>Compare a operação antes e depois do Menuzito</h2><p>Mova o divisor e descubra como a tecnologia transforma o dia a dia do seu estabelecimento.</p></div><div class="mz-compare"><div class="mz-compare__side mz-compare__before"><img src="${A}/comparison/traditional.jpg" alt="Operação tradicional"><span class="mz-compare__label">SEM MENUZITO</span><div class="mz-compare__metrics"><b>Tempo para fazer pedido</b><strong>5 a 15 min</strong><b>Ticket Médio</b><strong>Limitado</strong><b>Erros no Pedido</b><strong>Frequentes</strong></div></div><div class="mz-compare__side mz-compare__after"><img src="${A}/comparison/menuzito.jpg" alt="Operação com Menuzito"><span class="mz-compare__label">COM MENUZITO</span><div class="mz-compare__metrics"><b>Tempo para fazer pedido</b><strong>Imediato</strong><b>Ticket Médio</b><strong>Maior</strong><b>Erros no Pedido</b><strong>Reduzidos</strong></div></div><div class="mz-compare__divider"><span>↔</span></div></div></div></section>`,
  },
  {
    id: 'testimonials',
    title: 'Menuzito · Depoimentos',
    html: `<section class="mz-section mz-testimonials"><div class="mz-container"><div class="mz-heading"><h2>O que dizem nossos parceiros</h2><p>Resultados reais de quem usa nossa plataforma no dia a dia.</p></div><div class="mz-testimonial-grid"><article class="mz-quote mz-quote--featured"><div class="mz-quote__stars">★★★★★</div><blockquote>“Reduzimos os custos mensais e ganhamos agilidade. O Menuzito trouxe a organização e eficiência que a nossa operação precisava.”</blockquote><footer><span class="mz-avatar">RS</span><div><strong>Rafael Silva</strong><small>Restaurante parceiro</small></div></footer></article><article class="mz-quote"><div class="mz-quote__stars">★★★★★</div><blockquote>“Os pedidos ficaram mais rápidos e o cliente passou a consumir mais sem depender do garçom.”</blockquote><footer><span class="mz-avatar">MC</span><div><strong>Mariana Costa</strong><small>Empresária</small></div></footer></article><article class="mz-quote"><div class="mz-quote__stars">★★★★★</div><blockquote>“A equipe ganhou fôlego e hoje temos dados para melhorar todos os dias.”</blockquote><footer><span class="mz-avatar">AP</span><div><strong>André Pereira</strong><small>Gestor de operações</small></div></footer></article></div></div></section>`,
  },
  {
    id: 'segments',
    title: 'Menuzito · Segmentos',
    html: `<section class="mz-segments"><div class="mz-container"><h2>Ideal para qualquer operação gastronômica</h2><div class="mz-segment-track">${['Restaurantes','Bares','Hamburguerias','Pizzarias','Cafeterias','Açaí','Hotéis','Delivery','Praças de alimentação','Food trucks','Franquias','Quiosques','E MUITO +'].map(x=>`<span>${x}</span>`).join('')}</div></div></section>`,
  },
  {
    id: 'faq',
    title: 'Menuzito · Perguntas frequentes',
    html: `<section class="mz-section mz-faq" id="faq"><div class="mz-container"><div class="mz-heading"><h2>Perguntas Frequentes</h2><p>Tire suas dúvidas e veja como é simples começar.</p></div><div class="mz-faq-list">${faqs.map(([q,a],i)=>`<details${i===0?' open':''}><summary>${q}<span>+</span></summary><p>${a}</p></details>`).join('')}</div></div></section>`,
  },
  {
    id: 'pricing',
    title: 'Menuzito · Planos',
    html: `<section class="mz-section mz-pricing" id="pricing"><div class="mz-container"><div class="mz-heading"><h2>Planos simples e transparentes</h2><p>Comece com 15 dias grátis. Acesso completo a todos os recursos em qualquer plano.</p><span class="mz-region">🇧🇷 Preços em BRL para sua região</span></div><div class="mz-price-grid">${[
      ['Plano Mensal','R$ 77,00','/ mês','',false],['Plano Semestral','R$ 64,17','/ mês','2 meses grátis',true],['Plano Anual','R$ 51,33','/ mês','4 meses grátis',false]
    ].map(([name,price,period,badge,featured])=>`<article class="mz-price${featured?' mz-price--featured':''}">${featured?'<span class="mz-price__popular">MAIS POPULAR</span>':''}<h3>${name}</h3>${badge?`<span class="mz-price__saving">${badge}</span>`:''}<div class="mz-price__value"><strong>${price}</strong><span>${period}</span></div><p>Acesso a todos os recursos do Menuzito.</p><ul><li>✓ Cardápio digital completo</li><li>✓ Pedidos e KDS</li><li>✓ CRM e Marketing</li><li>✓ Reservas e fila</li><li>✓ Suporte online</li></ul><a class="mz-btn ${featured?'mz-btn--primary':'mz-btn--outline'}" href="#">Começar teste grátis</a><small>Sem taxa de adesão</small></article>`).join('')}</div></div></section>`,
  },
  {
    id: 'blog',
    title: 'Menuzito · Blog e chamada final',
    html: `<section class="mz-section mz-blog" id="blog"><div class="mz-container"><div class="mz-blog__head"><div><span class="mz-kicker mz-kicker--blue">CONTEÚDO PARA CRESCER</span><h2>Últimas do nosso Blog</h2><p>Dicas, guias e insights para o seu negócio!</p></div><a class="mz-btn mz-btn--outline" href="#blog">Ver todos os artigos</a></div><div class="mz-blog-grid">${[
      ['analytics.avif','Dados & Inteligência','O que o Meta Pixel diz sobre seus clientes?','21 de dez. de 2025','6 min de leitura'],
      ['restaurant.avif','Experiência','Como a espera na fila impacta a percepção do seu restaurante','18 de dez. de 2025','5 min de leitura'],
      ['digital-menu.avif','Gestão','Cardápio físico vs. Digital: Vantagens e desvantagens','12 de dez. de 2025','7 min de leitura']
    ].map(([img,cat,title,date,time])=>`<article class="mz-post"><img src="${A}/blog/${img}" alt=""><div><span>${cat}</span><small>${date} · ${time}</small><h3>${title}</h3><a href="#">Ler artigo →</a></div></article>`).join('')}</div></div></section><section class="mz-final-cta"><div class="mz-final-cta__orb"></div><div class="mz-container"><img src="${A}/menuzito-mascot.webp" alt="Mascote Menuzito"><div><h2>Descomplica, vai de Menuzito!</h2><p>Junte-se a centenas de estabelecimentos que já automatizaram o atendimento, cortaram gastos e estão lucrando mais.</p><a class="mz-btn mz-btn--primary" href="#pricing">Quero testar grátis por 15 dias →</a><small>Sem compromisso. Cancele quando quiser.</small></div></div></section><section class="mz-benefits"><div class="mz-container">${[['⚡','Tudo em um só lugar','Tudo o que seu negócio precisa, em um único sistema.'],['📱','Sem Downloads','Acesse pelo navegador, em qualquer dispositivo.'],['🏢','Múltiplas Unidades','Gerencie várias unidades com uma única conta.'],['▦','Múltiplos Cardápios','Crie experiências para cada momento do dia.']].map(([i,t,d])=>`<div>${icon(i)}<span><strong>${t}</strong><small>${d}</small></span></div>`).join('')}</div></section>`,
  },
  {
    id: 'footer',
    title: 'Menuzito · Rodapé',
    html: `<footer class="mz-footer"><div class="mz-container"><div class="mz-footer__brand">${brand}<p>Quack, Quack! 🩵</p><div class="mz-socials"><a href="#">◎</a><a href="#">▶</a></div></div><div><h3>Produto</h3><a href="#ecosystem">Recursos</a><a href="#blog">Blog</a><a href="#">Já tenho conta</a><a href="#pricing">Teste grátis!</a></div><div><h3>Legal</h3><a href="#">Termos de Uso</a><a href="#">Privacidade</a></div><div><h3>Conecte-se</h3><a href="#pricing">Teste grátis por 15 dias</a><a href="mailto:hello@menuzito.app">hello@menuzito.app</a><a href="#">Suporte Online</a></div></div><div class="mz-footer__bottom"><div class="mz-container"><span>© 2026 Menuzito. Todos os direitos reservados.</span><span>Feito com 🩵 para restaurantes.</span></div></div></footer>`,
  },
]

export const menuzitoDocumentMarkup = menuzitoSections.map(section => section.html).join('')
