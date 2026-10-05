import type { Offer, SalesBrief } from './funnel.ts'
import type { Lead } from './types.ts'

/**
 * Primeira versão da oferta e do roteiro de venda de uma empresa, montada com
 * o que a busca achou (plataforma, problemas do site, avaliações, nicho). É
 * um ponto de partida: quem vende ajusta no painel do funil, e o agente que
 * monta a página reescreve com o que descobriu sobre a empresa.
 *
 * Vendemos serviço, como agência: o site novo, entregue pronto, e um plano
 * mensal opcional para cuidar dele. O produto Superelements não entra na
 * conversa com o cliente. Valores ficam na oferta, nunca no roteiro.
 */

/** Profissões com regra de publicidade do conselho: o site novo segue a regra. */
const COUNCILS: Record<string, string> = {
  Advogados: 'da OAB (Provimento 205/2021)',
  Médicos: 'do CFM',
  Dentistas: 'do CFO',
  Psicólogos: 'do Conselho de Psicologia',
  Nutricionistas: 'do Conselho de Nutricionistas',
  Fisioterapeutas: 'do COFFITO',
  Contadores: 'do CFC',
  Arquitetos: 'do CAU',
  Engenheiros: 'do CREA',
  Veterinários: 'do CFMV',
}

/**
 * O nome como se fala com a pessoa: sem o slogan que o Google Maps junta
 * ("Fulano Advogados | Advogado Imobiliário") e sem tudo em maiúsculas.
 */
export const displayName = (name: string) => {
  const base = name.replace(/^[^\p{L}\p{N}]+/u, '').split(/\s[|–—-]\s/)[0].trim()
  if (base !== base.toUpperCase() || base.length <= 5) return base
  const small = new Set(['e', 'de', 'da', 'do', 'das', 'dos'])
  return base
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

/** Problemas do site atual, em frases para o dono (sem jargão). */
const problemsOf = (lead: Lead) => {
  const scan = lead.scan
  const list: string[] = []
  if (!scan) return list
  if (scan.platform === 'fora-do-ar') list.push(`o site está fora do ar${scan.error ? ` (${scan.error})` : ''}`)
  const old = lead.reasons.filter((r) => /desatualizado/.test(r))
  if (old.length) list.push(`o site roda em versões antigas (${old.map((r) => r.replace(' desatualizado', '')).join(' e ')})`)
  if (scan.status && scan.status < 400 && !scan.https) list.push('o navegador mostra "não seguro" para quem abre o site')
  if (scan.error && scan.status && scan.status < 400) list.push(scan.error)
  if (scan.status && scan.status < 400 && !scan.viewport && scan.platform !== 'sem-site') list.push('o site não se adapta ao celular')
  if (scan.ms > 4000) list.push(`o site demora ${(scan.ms / 1000).toFixed(1).replace('.', ',')} s para responder`)
  if (scan.copyrightYear && scan.copyrightYear <= new Date().getFullYear() - 2) list.push(`o rodapé ainda diz ${scan.copyrightYear}`)
  if (scan.platform === 'sem-site') list.push(scan.builder ? `não tem site próprio, só ${scan.builder}` : 'não tem site próprio')
  if (scan.platform === 'construtor') list.push(`o site está no ${scan.builder ?? 'construtor'}, que limita o que dá para fazer`)
  return list
}

export const draftOffer = (lead: Lead): { offer: Offer; brief: SalesBrief } => {
  const scan = lead.scan
  const onWordPress = scan?.platform === 'wp-elementor' || scan?.platform === 'wordpress'
  const council = COUNCILS[lead.niche]
  const problems = problemsOf(lead)
  const channel = scan?.whatsapp ? `WhatsApp ${scan.whatsapp}` : lead.phone ? `telefone ${lead.phone}` : lead.email || scan?.emails[0] ? `e-mail ${lead.email || scan?.emails[0]}` : 'Instagram ou visita'
  const praise = lead.reviews && lead.reviews >= 30 && lead.rating ? `nota ${lead.rating.toFixed(1).replace('.', ',')} com ${lead.reviews} avaliações no Google` : null
  const who = displayName(lead.name)

  const service = onWordPress
    ? `Redesign do site de ${who}, feito por nós no mesmo WordPress que eles já têm e entregue pronto.`
    : `Site novo para ${who} em WordPress, feito por nós e entregue pronto, no lugar de ${scan?.platform === 'sem-site' ? 'só o perfil em rede social' : (scan?.builder ?? 'o site atual')}.`

  const what = [
    '- A página inicial nova, já montada: a conversa começa mostrando o site pronto, não um orçamento. Outras páginas: combinar.',
    '- Ajustes depois da conversa (fotos, nomes, textos que só a empresa sabe).',
    onWordPress ? '- Publicação no WordPress deles, com a versão atual guardada antes da troca.' : '- Instalação em WordPress e publicação (combinar domínio e hospedagem).',
    council ? `- Textos dentro das regras de publicidade ${council}.` : '',
    '- Opcional: plano mensal para cuidar do site depois (mudanças de texto, novas páginas, atualizações). Definir o que entra antes de oferecer.',
  ]
    .filter(Boolean)
    .join('\n')

  // Quem anuncia já paga para trazer gente ao site: a conversa começa por aí
  const paidAds = (scan?.ads ?? []).filter((ad) => ad !== 'Tag Manager')
  const adChannel = paidAds.includes('Google Ads') ? 'no Google' : paidAds.includes('Pixel da Meta') ? 'no Instagram' : 'em anúncios'
  // Frases curtas: o anúncio (se houver), depois um problema ou a reputação, depois o pedido
  const observation = problems[0]
    ? `Reparei que ${problems[0]}.`
    : praise
      ? `A reputação de vocês (${praise}) merece um site à altura.`
      : 'O site pode trabalhar mais por vocês.'
  const message = [
    'Olá! Aqui é [seu nome], da Avence Studio.',
    paidAds.length ? `Vi que vocês anunciam ${adChannel}, e é para o site que o anúncio leva as pessoas.` : `Vi o site de ${who}.`,
    observation,
    'Fizemos uma versão nova do site de vocês, já pronta. Posso te mandar o link para ver no celular?',
  ].join(' ')
  const how = [`Canal: ${channel}, em horário comercial.`, '', 'Primeira mensagem (curta, pedindo licença, sem anexo e sem preço):', `"${message}"`].join('\n')

  const best = [
    '1. Primeira mensagem curta e específica, com um único problema do site atual. Nada de lista, preço ou vídeo nesse primeiro toque.',
    '2. Com o "pode mandar": o link da versão nova e uma frase do que muda. O vídeo é opcional, só se ajudar.',
    '3. Conversa de 15 minutos, no celular de quem decide: o site atual e o novo lado a lado.',
    '4. Proposta por escrito: o valor do serviço, o que está incluído, o prazo e, se fizer sentido, o plano mensal.',
    '5. Sem resposta: um lembrete depois de 3 dias úteis, e no máximo mais um. Depois, marcar como Perdido com o motivo.',
    council ? `Profissão regulada: o site novo segue as regras de publicidade ${council}. Diga isso como cuidado, nunca como acusação ao site atual.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const points = [
    paidAds.length ? `Vocês já investem em anúncio (${paidAds.join(', ')}): o site é onde esse investimento chega. O novo encurta o caminho de quem clica até o WhatsApp.` : '',
    scan?.sales?.length ? `O site já vende (${scan.sales.join(', ')}): o novo põe isso em destaque em vez de esconder.` : '',
    ...problems.map((p) => `Hoje ${p}; no site novo isso não acontece.`),
    praise ? `Vocês têm ${praise}: o site novo mostra a empresa à altura disso.` : '',
    'Quem chega pelo celular entende em segundos o que vocês fazem e fala com vocês com um toque.',
    onWordPress ? 'Fica no mesmo WordPress e no mesmo endereço: nada de trocar de sistema nem de começar do zero.' : '',
    council ? `Os textos seguem as regras de publicidade ${council}.` : '',
    scan?.agency ? `O site atual foi feito por ${scan.agency.name}: não precisa romper com ninguém, é uma versão nova da página.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const objections = [
    `"Já temos quem cuide do site." → A versão nova entra no mesmo WordPress; quem cuida hoje pode seguir cuidando. Nós entregamos o site pronto.`,
    `"Agora não é prioridade." → O site novo já está feito; a decisão é só se vale pôr no ar. Posso deixar o link para vocês olharem com calma?`,
    `"Quanto custa?" → O valor do serviço, uma vez, com o que está incluído e o prazo. O plano mensal é opcional.`,
    paidAds.length ? `"Já gastamos com anúncio." → Justamente: o site é para onde o anúncio manda as pessoas. Um site mais claro aproveita melhor o que vocês já pagam.` : '',
    `"Vamos perder o Google?" → O endereço e o WordPress continuam os mesmos, e a versão atual fica guardada antes da troca.`,
    `"Não tenho tempo de mexer em site." → Não precisa: entregamos pronto e, se quiserem, o plano mensal cuida das mudanças.`,
  ]
    .filter(Boolean)
    .join('\n')

  return { offer: { service }, brief: { what, how, best, points, objections } }
}
