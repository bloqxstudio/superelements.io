/**
 * Conteúdo do hero Evermind: textos, links e as imagens que são conteúdo (o
 * ícone da pílula, a foto do segundo botão e o avatar do widget). O desenho e
 * as fotos do carrossel são os do original (elementor.ts).
 */
export interface EvContent {
  pill: { icon: string; text: string; url: string }
  /** Uma frase por linha com `<br>`. */
  title: string
  lede: string
  primary: { text: string; url: string }
  /** Botão com a miniatura (no original, a foto de quem atende) e o ponto lima. */
  secondary: { text: string; url: string; image: string }
  /** Widget de vidro "Client story". */
  story: { label: string; quote: string; name: string; role: string; avatar: string; avatarAlt: string }
  /** Widget de vidro com quatro barras (rótulo lima e valor). */
  bars: { title: string; items: [string, string][] }
  /** Card escuro do carrossel; o card inteiro é o link. */
  card: { label: string; title: string; number: string; caption: string; link: string; url: string }
  /** Widget de vidro do medidor. */
  gauge: { title: string; number: string; link: string }
}

/** Os textos do template, como estão no evermind-hero-2 da BYQ. */
export const EVERMIND_CONTENT: EvContent = {
  pill: { icon: 'byq-icon.png', text: 'BYQ® Studio celebrates the release of Evermind™ template', url: '#' },
  title: 'Every detail brings intelligence',
  lede: 'A Webflow template crafted for forward-thinking companies and businesses who value clarity, warmth, and adaptability.',
  primary: { text: 'Buy Template', url: '#' },
  secondary: { text: 'Book a call', url: '#', image: 'author.webp' },
  story: { label: 'Client story', quote: 'Evermind helped us from construction blueprints to digital templates', name: 'Jessica Mercedes', role: 'Marketing', avatar: 'jessica.webp', avatarAlt: 'Jessica Mercedes' },
  bars: { title: 'Top states', items: [['NY', '120K'], ['MA', '80K'], ['NH', '70K'], ['OR', '50K']] },
  card: { label: 'See how we helped FRANCO', title: 'We approached Evermind™ looking for something flexible yet timeless solutions.', number: '8x', caption: 'Faster launch times.', link: 'Read case study', url: '#' },
  gauge: { title: 'Quarter goal', number: '84%', link: 'Success Story' },
}

/**
 * Os textos do Superelements (brands/superelements/COPY.md), no desenho da
 * Evermind (pedido do usuário em 2026-10-03: "era só pra mudar conteúdo").
 * Sem números de resultado, clientes ou depoimentos: os widgets mostram o
 * produto (o agente, as etapas reais de publicar, uma publicação em curso).
 */
export const SUPERELEMENTS_CONTENT: EvContent = {
  pill: { icon: 'se-simbolo.png', text: 'Feito para WordPress + Elementor', url: '#' },
  title: 'Crie aqui.<br>Publique no WordPress.',
  lede: 'O site continua WordPress. Crie, organize e publique sites Elementor num espaço visual, cada cliente no seu projeto.',
  primary: { text: 'Criar meu primeiro projeto', url: '/auth' },
  // uma pessoa de verdade no botão, como no original (pedido do usuário): convite para conversar
  secondary: { text: 'Fale com a gente', url: '/contato', image: 'author.webp' },
  story: { label: 'Agente no canvas', quote: 'Peça a página. Veja ela ficar pronta, seção por seção.', name: 'Claude ou Codex', role: 'No painel do Space', avatar: 'se-simbolo.png', avatarAlt: 'Superelements' },
  // etapas reais do envio de uma página (src/features/wordpress/publish.ts)
  bars: { title: 'Publicar no WordPress', items: [['01', 'Preparar'], ['02', 'Imagens'], ['03', 'Página'], ['04', 'Cache CSS']] },
  card: { label: 'Para agências', title: 'Muitos clientes, uma operação: sua agência troca de projeto, não de ferramenta.', number: '1', caption: 'conta, um projeto por cliente.', link: 'Ver o plano Agência', url: '#' },
  gauge: { title: 'Publicando a Home', number: '84%', link: 'Ver no site' },
}
