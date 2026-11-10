/**
 * Revisor de legenda (o `caption.py` do instagram-agent-skill, MIT, em português).
 *
 * O feed mostra uns 125 caracteres e esconde o resto atrás do "mais". Quase toda legenda que
 * falha, falha ali. Mostra essa janela como a pessoa rolando vê e confere o que vale conferir.
 * O corte de 125 é aproximado (muda com o aparelho e as quebras de linha): deixe margem.
 */
import { EMOJI, HASHTAG, LINK, MENTION, NUMBER, PROPER, all, fold, rx } from './texto.ts'

export const CAPTION_LIMIT = 2200
export const CAPTION_CUT = 125
/** Limite do Instagram desde 18/12/2025 (antes eram 30). */
export const HASHTAG_LIMIT = 5

const ASKS: Array<[RegExp, string]> = [
  // sem `i`: a palavra pedida vem em maiúsculas ("Comenta CONTRATO")
  [rx(String.raw`\b(?:[cC]omenta|[cC]omente|[cC]omentem|[eE]screve|[eE]screva|[dD]igita|[dD]igite)\s+(?:a palavra\s+|aqui\s+)?["“']?\p{Lu}{2,}\b`, 'u'), 'comentar uma palavra'],
  [rx(String.raw`\b(?:me chama|chama|me manda|manda|envia|mande)\s+(?:uma\s+)?(?:no |na |um |uma )?(?:direct|dm|inbox|mensagem|whats|whatsapp|zap)\b`), 'chamar no direct'],
  [rx(String.raw`\b(?:salva|salve|salvem|guarda|guarde)\s+(?:esse|este|essa|esta|o|pra|para)\b`), 'salvar'],
  [rx(String.raw`\b(?:compartilha|compartilhe|manda (?:pra|para) (?:alguém|quem|aquele|aquela|sua|seu)|envia (?:pra|para))\b`), 'compartilhar'],
  [rx(String.raw`\b(?:me segue|me siga|siga o perfil|segue o perfil|segue a gente|siga a gente|ativa o sininho)\b`), 'seguir'],
  [rx(String.raw`\b(?:link na bio|link no perfil|link da bio|clica no link|clique no link)\b`), 'link na bio'],
  [rx(String.raw`\b(?:arrasta|arraste|desliza|deslize|passa pro lado|passe para o lado)\b`), 'arrastar'],
  [rx(String.raw`\b(?:me conta|me fala|me diz|qual (?:você|vc) (?:prefere|escolhe|usaria)|qual delas|qual deles|você prefere|vc prefere)\b`), 'responder uma pergunta'],
  [rx(String.raw`\b(?:agende|agenda|reserve|reserva|garanta|compre|peça|encomende|faça seu pedido)\s+(?:já|agora|o seu|a sua|seu|sua|pelo|pela|no|na)\b`), 'comprar ou agendar'],
]

/** Hashtags que não descrevem nada. */
const FILLER_TAGS = new Set(['#viral', '#fyp', '#explore', '#explorar', '#explorepage', '#foryou', '#foryoupage', '#paravoce', '#pravoce', '#trending', '#trend', '#instagood', '#love', '#amor', '#follow', '#sigam', '#sdv', '#like4like', '#curtir', '#reels', '#reelsinstagram', '#reelsbrasil', '#viralreels', '#instadaily', '#brasil', '#tbt', '#fy'].map(fold))

export type CheckStatus = 'OK' | 'ATENCAO' | 'CORRIGIR'
export interface CaptionCheck {
  id: string
  nome: string
  status: CheckStatus
  detalhe: string
}
export interface CaptionLint {
  caracteres: number
  limite: number
  corte: number
  /** O que o feed mostra antes do "mais". */
  visivel: string
  cortada: boolean
  primeira_linha: number
  hashtags: string[]
  mencoes: string[]
  links: string[]
  emojis: number
  chamadas: string[]
  checks: CaptionCheck[]
  veredito: 'PRONTA' | 'REVISAR' | 'CORRIGIR'
}

const CONCRETE = new RegExp(`${NUMBER.source}|${PROPER.source}`, 'gmu')

export function lintCaption(raw: string, opts: { palavras?: string[]; corte?: number } = {}): CaptionLint {
  const cut = opts.corte ?? CAPTION_CUT
  const text = raw.trim()
  const chars = [...text].length
  const firstLine = (text.split('\n')[0] ?? '').trim()
  const tags = all(HASHTAG, text, 1)
  const mentions = all(MENTION, text, 1)
  const links = all(LINK, text)
  const emoji = all(EMOJI, text)
  const visible = [...text].slice(0, cut).join('')
  const asks = ASKS.filter(([re]) => re.test(text)).map(([, n]) => n)
  const filler = tags.filter((t) => FILLER_TAGS.has(fold(t)))
  const keywords = (opts.palavras ?? []).map((k) => k.trim()).filter(Boolean)
  const checks: CaptionCheck[] = []
  const add = (id: string, nome: string, status: CheckStatus, detalhe: string) => checks.push({ id, nome, status, detalhe })

  add('tamanho', 'Tamanho', chars > CAPTION_LIMIT ? 'CORRIGIR' : 'OK', `${chars} de ${CAPTION_LIMIT} caracteres${chars > CAPTION_LIMIT ? `, ${chars - CAPTION_LIMIT} acima do limite` : ''}`)

  if (!firstLine) add('primeira', 'Primeira linha', 'CORRIGIR', 'a legenda começa com uma linha em branco')
  else if (/^[#@]/.test(firstLine)) add('primeira', 'Primeira linha', 'CORRIGIR', 'começa com hashtag ou menção, no único lugar que vale uma frase')
  else if (/^\p{Extended_Pictographic}/u.test(firstLine)) add('primeira', 'Primeira linha', 'ATENCAO', 'começa com emoji: a primeira coisa lida devia ser palavra')
  else if (/^(?:oi|olá|ola|bom dia|boa tarde|boa noite|e aí|fala galera)\b/i.test(firstLine)) add('primeira', 'Primeira linha', 'CORRIGIR', 'começa com saudação: ninguém abre o post para ser cumprimentado')
  else if ([...firstLine].length > cut) add('primeira', 'Primeira linha', 'ATENCAO', `${[...firstLine].length} caracteres: o feed corta em ${cut} no meio da ideia. Tudo bem se o corte for suspense; ruim se for no meio de uma oração`)
  else add('primeira', 'Primeira linha', 'OK', `${[...firstLine].length} caracteres, aparece inteira`)

  const concrete = visible.match(CONCRETE) ?? []
  add('concreto', 'Gancho concreto', concrete.length ? 'OK' : 'ATENCAO', concrete.length ? `${concrete.length} número(s) ou nome(s) antes do "mais"` : 'nada que dê para conferir antes do "mais"')

  if (tags.length > HASHTAG_LIMIT) add('hashtags', 'Hashtags', 'CORRIGIR', `${tags.length} hashtags, acima do limite de ${HASHTAG_LIMIT} do Instagram (desde dez/2025). As que passam da quinta não contam e o bloco parece antigo`)
  else if (filler.length) add('hashtags', 'Hashtags', 'ATENCAO', `${tags.length} hashtag(s), ${filler.length} genérica(s) (${filler.slice(0, 3).join(', ')}): não descrevem nada. Use tema, não "viral"`)
  else add('hashtags', 'Hashtags', 'OK', tags.length ? `${tags.length}: ${tags.join(' ')}` : 'nenhuma (tudo bem: hashtag virou etiqueta, não alcance)')

  const tagInWindow = tags.some((t) => visible.includes(t))
  add('lugar-hashtags', 'Lugar das hashtags', tagInWindow ? 'ATENCAO' : 'OK', !tags.length ? 'sem hashtags' : tagInWindow ? 'tem hashtag na parte visível, gastando o espaço do feed com etiqueta' : 'hashtags depois do "mais"')

  add('links', 'Links', links.length ? 'ATENCAO' : 'OK', links.length ? `${links.length} link(s) na legenda, e legenda não é clicável. Mande para a bio ou para o direct` : 'nenhum link morto no texto')

  if (asks.length === 1) add('chamada', 'Uma chamada', 'OK', `uma chamada: ${asks[0]}`)
  else if (!asks.length) add('chamada', 'Uma chamada', 'ATENCAO', 'sem chamada. Decida para que serve este post')
  else add('chamada', 'Uma chamada', 'ATENCAO', `${asks.length} chamadas (${asks.join(', ')}). Duas chamadas valem o mesmo que nenhuma`)

  const density = (emoji.length * 100) / Math.max(chars, 1)
  add('emoji', 'Emoji', density > 4 ? 'ATENCAO' : 'OK', `${emoji.length} emoji(s), ${density.toFixed(1).replace('.', ',')} a cada 100 caracteres${density > 4 ? ': vira enfeite' : ''}`)

  if (keywords.length) {
    const low = fold(text)
    const found = keywords.filter((k) => low.includes(fold(k)))
    const missing = keywords.filter((k) => !low.includes(fold(k)))
    const inWindow = found.filter((k) => fold(visible).includes(fold(k)))
    add('busca', 'Termos de busca', !missing.length ? 'OK' : found.length ? 'ATENCAO' : 'CORRIGIR', `${found.length} de ${keywords.length} no texto${found.length ? `, ${inWindow.length} na parte visível` : ''}${missing.length ? `. Faltam: ${missing.join(', ')}` : ''}`)
  }

  const fails = checks.filter((c) => c.status === 'CORRIGIR').length
  const warns = checks.filter((c) => c.status === 'ATENCAO').length
  return {
    caracteres: chars,
    limite: CAPTION_LIMIT,
    corte: cut,
    visivel: visible,
    cortada: chars > cut,
    primeira_linha: [...firstLine].length,
    hashtags: tags,
    mencoes: mentions,
    links,
    emojis: emoji.length,
    chamadas: asks,
    checks,
    veredito: fails ? 'CORRIGIR' : warns ? 'REVISAR' : 'PRONTA',
  }
}
