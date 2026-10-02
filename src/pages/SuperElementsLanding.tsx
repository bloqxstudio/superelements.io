import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Blocks, Check, ChevronDown, ChevronRight, CircleCheck, CloudDownload,
  CloudUpload, Code2, Eye, FileText, FolderKanban, Globe2, Heading1, Image,
  Layers3, LayoutGrid, Library, Menu, MousePointer2, Palette, Play, Plus,
  RotateCcw, Search, ShieldCheck, Sparkles, Text, Users, WandSparkles, X,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import './SuperElementsLanding.css'

type Audience = 'empresa' | 'agencia'
type PublishState = 'ready' | 'publishing' | 'published'

const features: Array<{ icon: LucideIcon; title: string; text: string; list: string[] }> = [
  { icon: Blocks, title: 'Monte visualmente', text: 'Páginas inteiras ou seções individuais, mantendo cada elemento editável.', list: ['Canvas de páginas', 'Biblioteca de seções', 'Modelos completos', 'Preview responsivo'] },
  { icon: Palette, title: 'Trabalhe com a marca', text: 'A identidade do projeto acompanha cada seção, inclusive as novas.', list: ['Cores e tipografia', 'Botões, formas e imagens', 'Comparação antes e depois', 'Aplicação por camada'] },
  { icon: Layers3, title: 'Edite de verdade', text: 'A estrutura continua sendo Elementor nativo, do Navigator à publicação.', list: ['Containers e widgets nativos', 'Navigator organizado', 'Propriedades por camada', 'Edição no canvas'] },
  { icon: Globe2, title: 'Conecte o WordPress', text: 'Traga o site existente e devolva as alterações para o lugar certo.', list: ['Importação de páginas', 'Mídias do site', 'SEO e imagem destacada', 'Rascunho ou publicação'] },
  { icon: Users, title: 'Entregue em equipe', text: 'Cliente, atendimento e criação trabalham no mesmo projeto, com contexto.', list: ['Convites por projeto', 'Links de aprovação', 'Contexto do cliente', 'Projetos separados'] },
  { icon: ShieldCheck, title: 'Publique com segurança', text: 'A ação mais importante tem confirmação, histórico e saída de emergência.', list: ['Detecção de conflito', 'Backup automático', 'Restaurar versão', 'Validação de permissões'] },
]

const faqs = [
  ['Preciso trocar minha hospedagem?', 'Não. No plano Produto, o Super Elements conecta ao WordPress que já está na sua hospedagem. A hospedagem gerenciada é uma opção do plano Completo e pode ser adicionada por site no plano Agência.'],
  ['O site deixa de ser WordPress?', 'Não. O WordPress continua sendo seu e as páginas continuam em Elementor. O Super Elements funciona como uma camada visual de criação, organização e publicação.'],
  ['Consigo editar depois no Elementor?', 'Sim. O produto trabalha com containers e widgets nativos. Os nomes das camadas também chegam organizados ao Navigator do Elementor.'],
  ['Posso trazer um site que já existe?', 'Sim. Depois de conectar o WordPress, você pode importar páginas, marca e imagens disponíveis no site, trabalhar nelas e publicar novamente.'],
  ['A IA publica sozinha?', 'Não. A visão futura é usar IA para acelerar criação, adaptação e revisão. A decisão de publicar continua explícita e humana.'],
]

const Brand = ({ light = false }: { light?: boolean }) => (
  <span className={`se-brand${light ? ' se-brand--light' : ''}`}><Logo /><b>super elements</b></span>
)

const ProductDemo = () => {
  const [selected, setSelected] = useState<'hero' | 'title' | 'button'>('title')
  const [publish, setPublish] = useState<PublishState>('ready')
  const send = () => {
    if (publish === 'publishing') return
    setPublish('publishing')
    window.setTimeout(() => setPublish('published'), 850)
  }

  return (
    <div className="se-demo" aria-label="Demonstração do Super Elements">
      <div className="se-demo__browser"><i /><i /><i /><span>Café Aurora / Home</span><em>● cafeaurora.com.br</em></div>
      <div className="se-demo__toolbar">
        <span><FileText /> Home <ChevronDown /></span><span><Layers3 /> Navigator</span><span><Library /> Biblioteca</span>
        <span className="se-demo__brand"><i /><i /><i /> Café Aurora</span><b />
        <span><Eye /> Player</span>
        <button type="button" className={publish === 'published' ? 'done' : ''} onClick={send}>
          {publish === 'publishing' ? <RotateCcw className="se-spin" /> : publish === 'published' ? <Check /> : <CloudUpload />}
          {publish === 'publishing' ? 'Publicando' : publish === 'published' ? 'Publicado' : 'Publicar no site'}
        </button>
      </div>
      <div className="se-demo__body">
        <aside>
          <header><strong>Navigator</strong><Search /></header>
          <button className={selected === 'hero' ? 'active' : ''} onClick={() => setSelected('hero')}><ChevronDown /><LayoutGrid /> Hero principal</button>
          <button className={`nested ${selected === 'title' ? 'active' : ''}`} onClick={() => setSelected('title')}><Heading1 /> Título do hero</button>
          <button className={`nested ${selected === 'button' ? 'active' : ''}`} onClick={() => setSelected('button')}><MousePointer2 /> Botão Reservar</button>
          <button><ChevronRight /><LayoutGrid /> Menu da semana</button>
          <button><ChevronRight /><Image /> História do café</button>
          <footer>Elementor nativo<span>6 containers · 14 widgets</span></footer>
        </aside>
        <main>
          <div className={`se-site selected-${selected}`}>
            <header><b>AURORA</b><span>Cardápio&nbsp;&nbsp; O café&nbsp;&nbsp; Contato</span><em>Reservar</em></header>
            <div className="se-site__hero">
              <div><small>torra local · desde 2018</small><h3>O café que faz<br />a cidade pausar.</h3><p>Grãos brasileiros, cozinha aberta<br />e uma mesa esperando por você.</p><button>Reservar uma mesa</button></div>
              <figure><span>CAFÉ<br />AURORA</span><i /><i /><i /></figure>
            </div>
            <label>{selected === 'hero' ? 'Hero principal' : selected === 'title' ? 'Título do hero' : 'Botão Reservar'}</label>
          </div>
          {publish === 'published' && <div className="se-toast"><CircleCheck /> Home publicada em cafeaurora.com.br</div>}
        </main>
      </div>
    </div>
  )
}

const AudienceBlock = () => {
  const [audience, setAudience] = useState<Audience>('empresa')
  const company = audience === 'empresa'
  return (
    <div className="se-audience-card">
      <div className="se-audience-copy">
        <div className="se-switch" role="tablist"><button aria-selected={company} onClick={() => setAudience('empresa')}>Sou uma empresa</button><button aria-selected={!company} onClick={() => setAudience('agencia')}>Sou uma agência</button></div>
        <small>{company ? 'Um site. Muito menos painel.' : 'Muitos clientes. Uma operação.'}</small>
        <h3>{company ? 'Sua empresa cuida do site sem precisar aprender WordPress.' : 'Sua agência troca de projeto, não de ferramenta.'}</h3>
        <p>{company ? 'Abra o projeto, encontre a página, mude o que precisa e publique. A parte técnica continua conectada, mas deixa de ocupar o centro.' : 'Cada cliente tem marca, contexto, páginas, equipe e WordPress próprios. Tudo visível sem abrir uma coleção de painéis e senhas.'}</p>
        <ul>{(company ? ['Acesso direto ao seu projeto', 'Marca e páginas organizadas', 'Hospedagem própria ou gerenciada'] : ['Carteira inteira na mesma conta', 'WordPress independente por cliente', 'Biblioteca, equipe e aprovações']).map(item => <li key={item}><Check />{item}</li>)}</ul>
      </div>
      <div className="se-audience-visual">
        {company ? <>
          <article className="se-project-card"><div><span>CA</span><i /><i /><i /></div><strong>Café Aurora</strong><small>4 páginas · Editado hoje</small></article>
          <div className="se-connect-line"><i /><span>conectado</span><i /></div>
          <article className="se-wp"><Globe2 /><div><strong>cafeaurora.com.br</strong><small>WordPress + Elementor</small></div><CircleCheck /></article>
        </> : <div className="se-project-list">
          {[['CA', 'Café Aurora', '#593f2a'], ['JA', 'Júnior Automáticos', '#b58222'], ['PB', 'ProcessBase', '#ff5900'], ['CP', 'Caramelo Pet', '#e5832c']].map(([initial, name, color], i) => <article key={name}><span style={{ background: color }}>{initial}</span><div><strong>{name}</strong><small>{4 + i} páginas</small></div><ChevronRight /></article>)}
          <button><Plus /> Novo projeto</button>
        </div>}
      </div>
    </div>
  )
}

const AhaBlock = () => {
  const [active, setActive] = useState(0)
  const moments: Array<{ icon: LucideIcon; title: string; text: string }> = [
    { icon: CloudDownload, title: 'O site que já existe entra no seu espaço.', text: 'Conecte o domínio, escolha as páginas e importe. Marca, imagens e conteúdo chegam organizados por projeto.' },
    { icon: Palette, title: 'Uma marca passa a valer para a página inteira.', text: 'Cores, fontes, botões e formas deixam de ser decisões repetidas. Aplique a identidade e compare antes de salvar.' },
    { icon: Layers3, title: 'O visual bonito continua editável no Elementor.', text: 'Nada de esconder a página em um bloco de HTML. Títulos, imagens, botões e containers chegam como camadas nativas.' },
    { icon: CloudUpload, title: 'Publicar deixa de ser um pequeno projeto.', text: 'Envie a página, organize as mídias, preserve um backup e saiba se alguém alterou o WordPress antes de você.' },
  ]
  const moment = moments[active]
  const Icon = moment.icon
  return (
    <div className="se-aha-grid">
      <div className="se-aha-nav">{moments.map((item, index) => { const ItemIcon = item.icon; return <button key={item.title} className={active === index ? 'active' : ''} onClick={() => setActive(index)}><span><ItemIcon /></span><strong>{item.title}</strong><ChevronRight /></button> })}</div>
      <div className="se-aha-scene">
        <div className="se-aha-copy"><span><Icon /></span><small>Aha #{active + 1}</small><h3>{moment.title}</h3><p>{moment.text}</p></div>
        {active === 0 && <div className="se-dialog se-import"><header><Globe2 /><b>cafeaurora.com.br</b><span>● Conectado</span></header>{['Home', 'Cardápio', 'Sobre o café'].map(page => <label key={page}><input type="checkbox" defaultChecked />{page}<small>Elementor</small></label>)}<button><CloudDownload /> Importar 3 páginas</button></div>}
        {active === 1 && <div className="se-dialog se-brand-dialog"><div><i /><i /><i /><i /></div><small>Tipografia</small><b>Fraunces / Inter</b><small>Aplicar em 18 seções</small><progress value="82" max="100" /><button><WandSparkles /> Aplicar marca</button></div>}
        {active === 2 && <div className="se-dialog se-tree"><p><ChevronDown /><LayoutGrid /> Hero principal <small>container</small></p><p className="n1"><ChevronDown /><LayoutGrid /> Conteúdo <small>container</small></p><p className="n2 active"><Heading1 /> Título do hero <small>heading</small></p><p className="n2"><Text /> Texto de apoio <small>text-editor</small></p><p className="n2"><MousePointer2 /> Reservar mesa <small>button</small></p><footer><Code2 /> Exportação Elementor <span>nativa</span></footer></div>}
        {active === 3 && <div className="se-dialog se-publish"><div><span><FileText /></span><i /><span><ShieldCheck /></span><i /><span className="active"><Globe2 /></span></div><h4>Pronto para atualizar a Home</h4><p><Check /> Backup da versão atual</p><p><Check /> 7 imagens prontas</p><p><Check /> Nenhum conflito</p><button><CloudUpload /> Atualizar no site</button></div>}
      </div>
    </div>
  )
}

const Price = ({ name, price, text, list, featured = false }: { name: string; price: string; text: string; list: string[]; featured?: boolean }) => <article className={`se-price${featured ? ' featured' : ''}`}>{featured && <em>Mais simples para a empresa</em>}<h3>{name}</h3><p>{text}</p><div><b>{price}</b><span>/ mês</span></div><Link to="/auth">Começar com este plano <ArrowRight /></Link><ul>{list.map(item => <li key={item}><Check />{item}</li>)}</ul></article>

const SuperElementsLanding: React.FC = () => {
  const [menu, setMenu] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  return <div className="se-page">
    <header className="se-header"><a href="#inicio"><Brand /></a><nav className={menu ? 'open' : ''}><a href="#produto">Produto</a><a href="#publicos">Para quem</a><a href="#funcionalidades">Funcionalidades</a><a href="#precos">Preços</a></nav><div><Link to="/auth">Entrar</Link><Link className="se-cta" to="/auth">Criar primeiro projeto <ArrowRight /></Link></div><button className="se-menu" onClick={() => setMenu(!menu)} aria-label={menu ? 'Fechar menu' : 'Abrir menu'}>{menu ? <X /> : <Menu />}</button></header>
    <main>
      <section className="se-hero" id="inicio"><div className="se-hero-copy"><p><i /> Criado para WordPress + Elementor</p><h1>O site continua WordPress.<br />O trabalho fica muito mais simples.</h1><h2>Crie, organize e publique sites Elementor em um espaço visual. Um site para sua empresa ou todos os clientes da sua agência.</h2><div><Link className="se-cta" to="/auth">Criar meu primeiro projeto <ArrowRight /></Link><a href="#produto"><Play /> Ver como funciona</a></div><small><Check /> Conecte sua hospedagem atual <Check /> Sem cartão para testar</small></div><div className="se-hero-demo"><ProductDemo /><p><MousePointer2 /> Experimente: selecione uma camada e publique.</p></div></section>
      <section className="se-proof"><div><Layers3 /><span><b>Elementor nativo</b>na entrada e na saída</span></div><div><Palette /><span><b>Uma marca</b>em todo o projeto</span></div><div><CloudUpload /><span><b>Publicação direta</b>no WordPress</span></div><div><FolderKanban /><span><b>Vários projetos</b>na mesma conta</span></div></section>
      <section className="se-section" id="publicos"><header className="se-heading split"><p>O mesmo produto, dois jeitos de ganhar tempo.</p><h2>Um espaço simples para a empresa.<br />Uma central de operação para a agência.</h2></header><AudienceBlock /></section>
      <section className="se-aha" id="produto"><header className="se-heading"><p>Você entende quando vê acontecer.</p><h2>Quatro momentos em que o WordPress deixa de pesar.</h2></header><AhaBlock /></section>
      <section className="se-native"><div><span><Layers3 /></span><h2>Não é uma imagem do site.<br />É o site, em camadas.</h2><p>Cada título continua título. Cada botão continua botão. Cada container continua editável no Navigator do Elementor.</p><a href="#funcionalidades">Conhecer todas as funções <ArrowRight /></a></div><div className="se-native-visual"><article><p><ChevronDown /><LayoutGrid /> Seção de benefícios</p><p className="n1"><ChevronDown /><LayoutGrid /> Grade de cards</p><p className="n2"><Heading1 /> Título</p><p className="n2"><Text /> Descrição</p><p className="n2 active"><MousePointer2 /> Começar agora</p></article><ArrowRight /><article><header><b>ELEMENTOR</b><small>Navigator</small></header><p><LayoutGrid /> Seção de benefícios</p><p className="n1"><LayoutGrid /> Grade de cards</p><p className="n2"><Heading1 /> Título</p><p className="n2"><Text /> Descrição</p><p className="n2 active"><MousePointer2 /> Começar agora</p></article></div></section>
      <section className="se-section" id="funcionalidades"><header className="se-heading split"><p>Do primeiro bloco à página publicada.</p><h2>As ferramentas que faltavam entre a ideia e o WordPress.</h2></header><div className="se-features">{features.map(({ icon: Icon, title, text, list }) => <article key={title}><span><Icon /></span><h3>{title}</h3><p>{text}</p><ul>{list.map(item => <li key={item}><Check />{item}</li>)}</ul></article>)}</div><div className="se-future"><span><Sparkles /></span><div><b>IA entra para acelerar, não para assumir o controle.</b><p>No roadmap: criação por briefing, adaptação de marca, revisão responsiva e sugestões. Você continua revisando e publicando.</p></div><em>Roadmap</em></div></section>
      <section className="se-pricing" id="precos"><header className="se-heading"><p>Comece com o que você já tem.</p><h2>Produto, hospedagem ou uma operação inteira.</h2><small>Valores fictícios para validar a proposta comercial.</small></header><div className="se-prices"><Price name="Produto" price="R$ 89" text="Para uma empresa que já tem WordPress e hospedagem." list={['1 site conectado', 'Editor visual e Navigator', 'Marca e biblioteca', 'Importação e publicação', '1 colaborador']} /><Price featured name="Completo" price="R$ 179" text="Super Elements e hospedagem gerenciada no mesmo plano." list={['Tudo do plano Produto', 'Hospedagem WordPress', 'SSL, backup e ambiente técnico', 'Atualizações e monitoramento', '3 colaboradores']} /><Price name="Agência" price="R$ 349" text="Uma central para criar e operar vários sites de clientes." list={['5 sites conectados', 'Projetos e marcas ilimitadas', 'Equipe e aprovações', 'Biblioteca compartilhada', 'Site adicional por R$ 39/mês', 'Hospedagem opcional por site']} /></div><p className="se-price-foot"><ShieldCheck /> O WordPress e o conteúdo continuam sendo seus.</p></section>
      <section className="se-section se-faq"><div><p>Sem letra pequena.</p><h2>Antes de conectar seu primeiro site.</h2><span>Ainda ficou alguma dúvida? <a href="mailto:contato@superelements.io">Fale com a gente</a>.</span></div><div>{faqs.map(([q, a], i) => <article className={faq === i ? 'open' : ''} key={q}><button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i}><b>{q}</b><Plus /></button><p>{a}</p></article>)}</div></section>
      <section className="se-final"><div><Brand light /><h2>Seu próximo site pode começar mais organizado.</h2><p>Crie um projeto, conecte um WordPress ou apenas explore o canvas.</p><Link to="/auth">Criar meu primeiro projeto <ArrowRight /></Link></div><div>{[[Library, 'Seção da biblioteca'], [Palette, 'Marca aplicada'], [Layers3, 'Elementor nativo'], [CloudUpload, 'Publicado no site']].map(([AnyIcon, text], i) => { const ItemIcon = AnyIcon as LucideIcon; return <span key={text as string}><ItemIcon />{text as string}{i === 3 && <Check />}</span> })}</div></section>
    </main>
    <footer className="se-footer"><Brand /><p>Crie aqui. Publique no WordPress.</p><nav><a href="#produto">Produto</a><a href="#precos">Preços</a><Link to="/auth">Entrar</Link><a href="mailto:contato@superelements.io">Contato</a></nav><small>© 2026 Super Elements. Página-conceito.</small></footer>
  </div>
}

export default SuperElementsLanding
