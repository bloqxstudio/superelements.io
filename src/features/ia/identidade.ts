import { create } from 'zustand'

/**
 * A identidade do estúdio: um documento só, que todos os agentes recebem junto
 * do próprio perfil. O que está aqui (quem somos, o que vendemos, para quem,
 * como falamos, o que nunca dizer e a cara da marca) vale para criativos, Copy,
 * sites, comercial e rotinas. Os textos de fábrica vêm de `brands/avence-studio`
 * e do cliente ideal; edite em Agentes › Configurar › Identidade.
 */

export interface Identity {
  name: string
  /** Quem somos e o que vendemos. */
  about: string
  /** Para quem vendemos (o cliente ideal). */
  audience: string
  /** Como falamos. */
  voice: string
  /** O que vale sempre (uma por linha). */
  always: string
  /** O que nunca (uma por linha). */
  never: string
  /** A cara da marca: cores, fontes, logo. */
  visual: string
}

export const DEFAULT_IDENTITY: Identity = {
  name: 'Avence Studio',
  about:
    'Estúdio de sites em WordPress e Elementor focado em velocidade, em São Leopoldo (RS), @avencestudio. Vendemos um serviço, como uma agência: um site novo entregue pronto, com prévia antes de fechar, pagamento único e um plano mensal opcional de cuidado. Não vendemos o produto Superelements.',
  audience:
    'O dono de um negócio local de serviço (advocacia, odontologia, clínicas, estética, contabilidade, arquitetura, imobiliária) que já paga por anúncios e cujo site não devolve conversa no WhatsApp. Decide sozinho, não tem equipe de marketing e pensa em contatos, não em tecnologia. Em profissão regulada, tem medo de errar na publicidade.',
  voice:
    'Direta, concreta e humana, em português do Brasil: frases curtas, voz ativa, palavras do dia a dia. Fala do que a página faz por quem chega (contatos, WhatsApp, anúncios), nunca de versão de WordPress, PHP ou plugin. Sem jargão de marketing, sem adjetivo vazio, sem emoji.',
  always:
    'Falar em contatos e conversas.\nMarcar [a confirmar] onde faltar um fato.\nEscrever dentro das regras da profissão do cliente (OAB, CFM, CFO).\nAssinar mensagens como "Aqui é [nome], da Avence Studio".',
  never:
    'Citar o Superelements ou planos de plataforma para o cliente final.\nInventar número, prazo, preço, resultado, depoimento ou cliente.\nPrometer resultado ou usar urgência falsa.\nContatar alguém, publicar ou enviar sem aprovação da pessoa.',
  visual:
    'Papel #f3f1ec, tinta #111111, azul #2b3cf0 só como acento (nunca fundo de seção). Títulos em Inter Tight 500, destaque editorial em Instrument Serif itálico (uma palavra por título). Logo: "avence" em Geist Medium com um pequeno quadrado azul. Cantos retos, texturas discretas.',
}

const KEY = 'identidade-estudio'

const read = (): Identity => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Identity>
    return { ...DEFAULT_IDENTITY, ...v }
  } catch {
    return DEFAULT_IDENTITY
  }
}

interface State {
  identity: Identity
  save: (patch: Partial<Identity>) => void
  reset: () => void
}

export const useIdentity = create<State>()((set, get) => ({
  identity: read(),
  save: (patch) => {
    const identity = { ...get().identity, ...patch }
    try {
      localStorage.setItem(KEY, JSON.stringify(identity))
    } catch {
      // vale até recarregar
    }
    set({ identity })
  },
  reset: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // vale até recarregar
    }
    set({ identity: DEFAULT_IDENTITY })
  },
}))

const lines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => `- ${x}`).join('\n')

/** O texto que todo agente recebe: a identidade do estúdio. */
export const identityText = (i: Identity = useIdentity.getState().identity): string =>
  [
    `Identidade do estúdio (vale para todo trabalho, de todos os agentes): ${i.name}.`,
    i.about.trim() && `Quem somos e o que vendemos: ${i.about.trim()}`,
    i.audience.trim() && `Para quem vendemos: ${i.audience.trim()}`,
    i.voice.trim() && `Como falamos: ${i.voice.trim()}`,
    i.always.trim() && `Sempre:\n${lines(i.always)}`,
    i.never.trim() && `Nunca:\n${lines(i.never)}`,
    i.visual.trim() && `A cara da marca: ${i.visual.trim()}`,
  ]
    .filter(Boolean)
    .join('\n')

export const useIdentityText = () => identityText(useIdentity((s) => s.identity))
