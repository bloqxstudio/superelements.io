/** A direção de voz da narração por IA: sem dependências, para o app e para testes no Node. */

/**
 * A direção de voz, no formato que o gpt-4o-mini-tts entende melhor (quem fala, afeto, tom, ritmo,
 * emoção, pronúncia, pausas e o que evitar). Uma frase genérica deixava a voz de "leitura".
 */
const TONE_PARTS = {
  reels: {
    label: 'Criador de reels',
    who: 'um criador de conteúdo brasileiro gravando um reels no celular, falando direto com quem assiste, como se contasse algo que descobriu',
    affect: 'energia alta mas genuína, curiosidade e confiança; sorriso na voz',
    pacing: 'rápido e com variação: acelera nas partes leves, desacelera um pouco antes da ideia principal',
    emotion: 'empolgação real nas revelações, cumplicidade nas dicas',
  },
  conversa: {
    label: 'Conversa próxima',
    who: 'alguém experiente explicando algo para um amigo, sentado à mesa, sem pressa',
    affect: 'calor, proximidade e calma; voz relaxada',
    pacing: 'médio e natural, com pausas de respiração entre as ideias',
    emotion: 'empatia e segurança, como quem quer de verdade ajudar',
  },
  anuncio: {
    label: 'Anúncio moderno',
    who: 'a voz de um comercial moderno de redes sociais, humana e próxima, não um locutor de rádio',
    affect: 'firme, entusiasmada e convidativa',
    pacing: 'marcado e ágil, com ênfase nas ofertas e uma pausa curta antes da chamada final',
    emotion: 'entusiasmo controlado e convicção',
  },
  elegante: {
    label: 'Elegante',
    who: 'a narração de uma marca premium, segura e sofisticada',
    affect: 'voz baixa, calorosa e aveludada',
    pacing: 'pausado, com respiros e silêncio antes das palavras importantes',
    emotion: 'serenidade e confiança, sem exagero',
  },
} as const
export type ToneId = keyof typeof TONE_PARTS
export const TONES: Record<ToneId, { label: string }> = TONE_PARTS

export type VoiceProvider = 'openai' | 'elevenlabs'

export interface VoiceAI {
  /** Sem o campo: OpenAI. */
  provider?: VoiceProvider
  /** OpenAI: o nome (marin, cedar…); ElevenLabs: o id da voz da conta. */
  voice: string
  /** ElevenLabs: o nome da voz, para mostrar. */
  voiceName?: string
  /** ElevenLabs: eleven_multilingual_v2 (estável) ou eleven_v3 (mais expressiva). */
  model?: string
  tone: ToneId
  /** 0,85 a 1,25: vai para a direção como ritmo (não estica o áudio). */
  speed: number
  /** Direção livre do usuário ("mais empolgado no começo", "pronuncie a marca como ‘avênce’"). */
  direction?: string
  /** Reescrever a fala de cada cena como um monólogo natural antes de narrar. Padrão: ligado. */
  rewrite?: boolean
}

export function directionFor(v: VoiceAI, brand?: string): string {
  const t = TONE_PARTS[v.tone] ?? TONE_PARTS.reels
  const pace = v.speed >= 1.12 ? ' Fale um pouco mais rápido que o normal.' : v.speed <= 0.93 ? ' Fale um pouco mais devagar que o normal.' : ''
  return [
    `Identidade: ${t.who}${brand ? `, falando pela marca ${brand}` : ''}.`,
    `Afeto: ${t.affect}.`,
    `Ritmo: ${t.pacing}.${pace}`,
    `Emoção: ${t.emotion}.`,
    'Sotaque e pronúncia: você é brasileiro nativo, nascido e criado em São Paulo; fale português do Brasil com sotaque paulistano natural, nunca de Portugal e sem nenhum traço de sotaque americano ou de estrangeiro aprendendo a língua. Vogais abertas e nasais do português do Brasil, "r" e "s" como um paulistano fala, "de" e "te" soando "dji" e "tchi", ritmo e melodia de quem conversa no Brasil. Palavras em inglês (nomes de motos, termos técnicos) do jeito que um brasileiro fala no dia a dia, aportuguesadas. Siglas como estão escritas no texto.',
    'Entonação: conversa, não leitura. Varie a melodia das frases, sobe nas perguntas, enfatiza a palavra que carrega a ideia, e não termine todas as frases descendo do mesmo jeito.',
    'Pausas: respire entre as ideias; pausas curtas nas vírgulas, um pouco maiores nos pontos, e um respiro antes da chamada final.',
    'Evite: voz de locutor, voz de robô ou de GPS, ritmo constante, ênfase em toda palavra, soletrar, ler pontuação.',
    v.direction?.trim() ? `Pedido específico: ${v.direction.trim()}` : '',
  ].filter(Boolean).join('\n')
}


/**
 * A ElevenLabs não recebe direção em texto: o jeito de falar vira estabilidade (menos = mais
 * expressiva e variada), estilo (o quanto exagera o jeito da voz) e velocidade.
 */
export function elevenSettings(v: VoiceAI): { stability: number; style: number; similarity: number; speed: number } {
  const base = ({ reels: { stability: 0.35, style: 0.45 }, conversa: { stability: 0.5, style: 0.2 }, anuncio: { stability: 0.4, style: 0.5 }, elegante: { stability: 0.6, style: 0.15 } } as const)[v.tone] ?? { stability: 0.45, style: 0.3 }
  const speed = v.speed >= 1.12 ? 1.1 : v.speed <= 0.93 ? 0.92 : 1
  return { ...base, similarity: 0.8, speed }
}
