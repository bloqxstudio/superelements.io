/**
 * Humanizador (o `humanize.py` + `detect.py` + `slop.json` do instagram-agent-skill, MIT), com o
 * léxico refeito para o português do Brasil: o "IA-ês" que aparece em legenda, roteiro e direct.
 *
 * Três passes automáticos: (1) caracteres invisíveis que teclado não produz, (2) tipografia
 * (travessão vira vírgula, aspas curvas viram retas), (3) léxico (troca o clichê pela palavra
 * comum ou apaga). As estruturas ("não é só X, é Y", trio, "O resultado?") são APONTADAS, não
 * reescritas: mudar a forma de uma frase pede julgamento, e isso é trabalho do agente.
 *
 * As 5 checagens são heurísticas locais, inspiradas no que detectores públicos olham. Não são
 * GPTZero nem nenhum outro, não chamam serviço nenhum e não prometem o veredito deles.
 */
import { clamp, mean, NUMBER, PROPER, pstdev, round1, rx } from './texto.ts'

interface Entry {
  find: string
  replace: string
  family: 'abertura' | 'fechamento' | 'conector' | 'verbo' | 'adjetivo' | 'substantivo' | 'instagram'
}
const E = (family: Entry['family'], pairs: Array<[string, string]>): Entry[] => pairs.map(([find, replace]) => ({ find, replace, family }))

/** Edite à vontade: se a conta usa de verdade uma dessas palavras, tire daqui. */
export const LEXICON: Entry[] = [
  ...E('abertura', [
    ['no mundo acelerado de hoje', 'hoje'], ['no mundo de hoje', 'hoje'], ['nos dias de hoje', 'hoje'], ['na era digital', 'hoje'], ['no cenário atual', 'hoje'], ['em um mundo cada vez mais', 'num mundo mais'], ['num mundo cada vez mais', 'num mundo mais'], ['em um cenário cada vez mais', 'num cenário mais'],
    ['vamos combinar', ''], ['sejamos sinceros', ''], ['vamos ser sinceros', ''], ['pensa comigo', ''], ['imagine um mundo onde', 'imagine se'], ['não é segredo que', ''], ['todos nós já passamos por isso', ''], ['quem nunca', ''], ['a verdade é que', ''], ['a dura verdade é que', ''], ['sem mais delongas', ''], ['apertem os cintos', ''], ['é com muita alegria que', ''], ['tenho o prazer de anunciar', ''], ['estou muito feliz em compartilhar', ''], ['é com grande satisfação que', ''],
  ]),
  ...E('fechamento', [
    ['reflita sobre isso', ''], ['fica a reflexão', ''], ['a escolha é sua', ''], ['o futuro é agora', ''], ['o futuro já chegou', ''], ['no fim das contas', ''], ['no final do dia', ''], ['ao fim e ao cabo', ''], ['leia de novo', ''], ['leia novamente', ''], ['e o resto é história', ''], ['simples assim', ''], ['pura e simplesmente', ''],
  ]),
  ...E('conector', [
    ['além disso', 'e'], ['ademais', 'e'], ['outrossim', 'e'], ['adicionalmente', 'e'], ['dessa forma', 'assim'], ['desta forma', 'assim'], ['dessa maneira', 'assim'], ['nesse sentido', ''], ['neste sentido', ''], ['vale ressaltar que', ''], ['vale destacar que', ''], ['vale lembrar que', 'lembre que'], ['é importante destacar que', ''], ['é importante ressaltar que', ''], ['é importante lembrar que', 'lembre que'], ['cabe destacar que', ''], ['em suma', 'enfim'], ['em resumo', 'enfim'], ['em síntese', 'enfim'], ['com isso em mente', ''], ['quando se trata de', 'em'], ['no que diz respeito a', 'sobre'], ['no que tange a', 'sobre'], ['a fim de', 'para'], ['com o objetivo de', 'para'], ['uma ampla gama de', 'vários'], ['uma variedade de', 'vários'], ['mais do que nunca', 'agora'], ['sem sombra de dúvidas', ''], ['sem dúvida alguma', ''], ['de forma eficiente', 'bem'], ['de maneira eficaz', 'bem'], ['de forma estratégica', ''], ['de forma consistente', 'sempre'], ['tive a oportunidade de', 'pude'], ['avançando para hoje', 'hoje'],
  ]),
  ...E('verbo', [
    ['mergulhar fundo', 'entrar'], ['mergulhe nesse', 'entre nesse'], ['mergulhe neste', 'entre neste'], ['elevar o nível', 'melhorar'], ['vamos mergulhar', 'vamos ver'], ['alavancar', 'usar'], ['alavancando', 'usando'], ['potencializar', 'aumentar'], ['potencialize', 'aumente'], ['impulsionar', 'aumentar'], ['impulsione', 'aumente'], ['desbloquear', 'conseguir'], ['desbloqueie', 'consiga'], ['destravar', 'conseguir'], ['elevar ao próximo nível', 'melhorar'], ['levar ao próximo nível', 'melhorar'], ['otimizar', 'melhorar'], ['maximizar', 'aumentar'], ['agregar valor', 'ajudar'], ['fomentar', 'criar'], ['catalisar', 'acelerar'], ['revolucionar', 'mudar'], ['transformar sua vida', 'mudar sua rotina'], ['ressignificar', 'mudar'], ['empoderar', 'ajudar'], ['viabilizar', 'permitir'], ['proporcionar', 'dar'], ['proporciona', 'dá'], ['explorar o potencial', 'usar'],
  ]),
  ...E('adjetivo', [
    ['robusto', 'sólido'], ['robusta', 'sólida'], ['transformador', 'grande'], ['transformadora', 'grande'], ['revolucionário', 'novo'], ['revolucionária', 'nova'], ['inovador', 'novo'], ['inovadora', 'nova'], ['de ponta', 'novo'], ['disruptivo', 'novo'], ['disruptiva', 'nova'], ['crucial', 'importante'], ['primordial', 'importante'], ['imprescindível', 'necessário'], ['abrangente', 'completo'], ['holístico', 'completo'], ['holística', 'completa'], ['inigualável', 'raro'], ['incomparável', 'raro'], ['inestimável', 'útil'], ['meticuloso', 'cuidadoso'], ['meticulosamente', 'com cuidado'], ['minucioso', 'cuidadoso'], ['notável', 'bom'], ['extraordinário', 'muito bom'], ['extraordinária', 'muito boa'], ['excepcional', 'muito bom'], ['único no mercado', 'diferente'], ['experiência única', 'experiência'], ['sem esforço', 'fácil'], ['sem complicação', 'simples'], ['cativante', 'interessante'], ['deslumbrante', 'bonito'], ['de tirar o fôlego', 'bonito'], ['icônico', 'conhecido'], ['icônica', 'conhecida'], ['imperdível', 'bom'], ['indispensável', 'útil'], ['personalizado sob medida', 'sob medida'], ['eficaz', 'que funciona'],
  ]),
  ...E('substantivo', [
    ['sua jornada', 'seu caminho'], ['nessa jornada', 'nesse caminho'], ['jornada de transformação', 'mudança'], ['ecossistema', 'sistema'], ['tapeçaria', 'mistura'], ['alicerce', 'base'], ['divisor de águas', 'grande mudança'], ['virada de chave', 'mudança'], ['game changer', 'grande mudança'], ['mindset', 'cabeça'], ['sinergia', 'parceria'], ['paradigma', 'modelo'], ['um verdadeiro testemunho de', 'uma prova de'], ['prova viva de', 'prova de'], ['arsenal', 'conjunto'], ['o pulo do gato', 'o método'], ['o segredo do sucesso', 'o que funciona'], ['molho secreto', 'o método'], ['guia definitivo', 'guia'], ['guia completo', 'guia'], ['hack', 'truque'], ['próximo nível', 'outro patamar'], ['excelência', 'qualidade'], ['soluções completas', 'serviço'], ['soluções inovadoras', 'serviço'],
  ]),
  ...E('instagram', [
    ['pare de rolar', ''], ['para de rolar', ''], ['não pule esse vídeo', ''], ['não passa esse vídeo', ''], ['assista até o final', ''], ['assista até o fim', ''], ['fica até o final', ''], ['no vídeo de hoje', ''], ['neste vídeo eu vou te mostrar', ''], ['neste vídeo vou te mostrar', ''], ['hoje eu vou te mostrar', ''], ['você não vai acreditar', ''], ['ninguém está falando sobre isso', 'pouca gente faz isso'], ['ninguém fala sobre isso', 'pouca gente faz isso'], ['isso mudou tudo', 'isso funcionou'], ['isso muda tudo', 'isso funciona'], ['esse é o seu sinal para', ''], ['este é o seu sinal para', ''], ['segue para mais', ''], ['siga para mais conteúdos', ''], ['siga para mais dicas', ''], ['me segue para mais', ''], ['marque alguém que precisa ver isso', ''], ['marca alguém que precisa ver isso', ''], ['marque aquele amigo que', ''], ['marca aquele amigo que', ''], ['comenta aqui embaixo', ''], ['comente aqui embaixo', ''], ['me conta nos comentários', ''], ['deixe nos comentários', ''], ['deixa nos comentários', ''], ['compartilhe com quem precisa', ''], ['compartilha com quem precisa', ''], ['dá dois toques se', ''], ['dê dois toques se', ''], ['o algoritmo ama', 'o Instagram entrega'], ['o algoritmo adora', 'o Instagram entrega'], ['hackear o algoritmo', 'ter alcance'], ['vencer o algoritmo', 'ter alcance'], ['viralizar da noite pro dia', 'ter alcance'], ['viralizar da noite para o dia', 'ter alcance'], ['corre que', ''], ['corre pra', ''], ['salva esse post para depois', ''], ['salve esse post para depois', ''], ['salva pra não esquecer', ''], ['quem concorda', ''], ['concorda?', ''], ['faz sentido?', ''], ['bora pra cima', ''], ['conteúdo de valor', 'conteúdo'], ['entregar valor', 'ajudar'], ['gerar valor', 'ajudar'],
  ]),
]

/** Invisíveis: apagados (ou viram espaço comum). */
const INVISIBLE: Array<[RegExp, string, string]> = [
  [/\u200D|[\u200B\u200C\u2060\uFEFF\u00AD\u180E\u061C\u200E\u200F\u2063]/g, '', 'caractere invisível (largura zero, marca de direção, hífen suave)'],
  [/[\u{E0000}-\u{E007F}]/gu, '', 'caractere de etiqueta Unicode (texto escondido)'],
  [/[\u00A0\u202F\u2009\u2007\u2003\u2002]/g, ' ', 'espaço especial (não separável, fino)'],
]

/** Tipografia que teclado de celular não faz. */
const TYPO: Array<[string, string, string]> = [
  ['—', ', ', 'travessão'],
  ['–', '-', 'meia-risca'],
  ['‘', "'", 'aspas curvas'],
  ['’', "'", 'aspas curvas'],
  ['“', '"', 'aspas curvas'],
  ['”', '"', 'aspas curvas'],
  ['…', '...', 'reticências de um caractere'],
  ['•', '-', 'marcador de lista'],
  ['→', '->', 'seta'],
]

interface Structure {
  id: string
  re: RegExp
  nome: string
  correcao: string
}
const S = (id: string, source: string, nome: string, correcao: string, flags = 'imu'): Structure => ({ id, re: rx(source, flags.includes('g') ? flags : `${flags}g`), nome, correcao })

export const STRUCTURES: Structure[] = [
  S('nao-e-so', String.raw`\bnão (?:é|foi|são) (?:só|apenas|somente) [^.!?\n]{2,60}[,.;—-]\s*(?:é|foi|são|mas)\b`, '"Não é só X, é Y"', 'Diga a única coisa que você quer dizer. Apague a metade que prepara.'),
  S('nao-so-mas', String.raw`\bnão (?:só|somente|apenas)\b[^.!?\n]{2,80}\bmas (?:também|tambem)\b`, '"Não só X, mas também Y"', 'Quebre em duas frases ou corte a metade mais fraca.'),
  S('nao-e-sobre', String.raw`\bnão é sobre [^.!?\n]{2,60}[.!]\s*é sobre\b`, '"Não é sobre X. É sobre Y."', 'Comece pelo Y. A inversão é o que entrega.'),
  S('o-resultado', String.raw`^\s*(?:o resultado|a melhor parte|o detalhe|o problema|a pegadinha|o segredo|a resposta|o motivo)\?\s*$`, 'Pergunta retórica de uma linha ("O resultado?")', 'Responda na mesma frase em vez de encenar a revelação.'),
  S('aprendi', String.raw`\b(?:aqui está|eis|esse é|isso é) o que (?:eu )?aprendi\b|\b(?:o que|tudo que) (?:eu )?aprendi:`, '"Aqui está o que aprendi"', 'Diga a lição. Pule o anúncio.'),
  S('trio', String.raw`\b\p{L}+, \p{L}+ e \p{L}+[.!]`, 'Trio de três ("rápido, simples e eficaz.")', 'Dois itens ou quatro. Três é o ritmo padrão da máquina.'),
  S('emoji-ia', String.raw`[\u{1F680}\u{1F525}\u{1F4A1}\u{2728}\u{1F3AF}\u{1F4AA}]`, 'Foguete, fogo, lâmpada, brilho, alvo, braço', 'No máximo um emoji, e não um desses.', 'gu'),
  S('parede-hashtag', String.raw`(?:#[\p{L}\p{N}_]+[ \t]*){6,}`, 'Parede de hashtags (6 ou mais)', 'No máximo cinco, de tema. O Instagram limitou a cinco.'),
  S('como-ia', String.raw`\bcomo (?:uma )?(?:ia|inteligência artificial|modelo de linguagem)\b`, 'A IA falando de si', 'Apague a frase.'),
  S('em-resumo', String.raw`^\s*(?:em resumo|em suma|resumindo|concluindo|em conclusão|para concluir)\b`, 'Abertura de conclusão de redação', 'Post não precisa de parágrafo de conclusão.'),
  S('isca', String.raw`(?:\bconcorda\?|\be (?:você|vc)\?|\bfaz sentido\?|\bquem mais\b|\bestou errado\?|\btô errado\?)\s*$`, 'Isca de engajamento no fim', 'Faça uma pergunta que só você faria, sobre o assunto do post.'),
  S('pare-rolar', String.raw`^\s*(?:pare de rolar|para de rolar|não (?:pule|pula|passe|passa)|espera,? não)\b`, 'Abertura "pare de rolar"', 'O que faz parar tem que ser a própria afirmação. Pedir atenção mostra que você não conquistou.'),
  S('neste-video', String.raw`\b(?:no vídeo de hoje|neste vídeo|nesse vídeo|hoje (?:eu )?vou te mostrar|vou te (?:mostrar|ensinar) como)\b`, 'Preâmbulo ("neste vídeo vou te mostrar")', 'Apague e comece na entrega. Os dois primeiros segundos decidem o reels.'),
  S('lista-emoji', String.raw`^\s*[\u{1F300}-\u{1FAFF}✅➡⬅✔✨\u{1F449}]\s*\S`, 'Lista com emoji no lugar de marcador', 'Use hífen ou quebra de linha. Lista de emoji é a coisa mais "modelo pronto" de uma legenda.', 'gmu'),
  S('caixa-alta', String.raw`\b[A-ZÀ-Ý]{3,}\b(?:\s+\b[A-ZÀ-Ý]{3,}\b){2,}`, 'Três ou mais palavras gritadas seguidas', 'Caixa alta é volume, não marca-texto. Uma palavra, no máximo.', 'gu'),
  S('isca-seguir', String.raw`\b(?:segue para mais|siga para mais|me segue para|marque alguém|marca alguém|marque aquele|marca aquele|dois toques se|compartilhe se|compartilha se|comenta aqui se)\b`, 'Isca de seguir ou marcar', 'Peça a única ação que este post merece. O pedido genérico ensina o público a ignorar todos.'),
]

// ---------- os passes ----------

const URL = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lexRe = (find: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(find).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu')
const ORDERED = [...LEXICON].sort((a, b) => b.find.length - a.find.length)

const matchCase = (src: string, repl: string) => {
  if (!repl) return repl
  if (src.length > 1 && src === src.toUpperCase() && /\p{L}/u.test(src)) return repl.toUpperCase()
  if (/^\p{Lu}/u.test(src)) return repl[0].toUpperCase() + repl.slice(1)
  return repl
}

export interface HumanizeChange {
  tipo: 'invisivel' | 'tipografia' | 'lexico'
  de: string
  para: string
  vezes: number
}
export interface StructureFlag {
  id: string
  nome: string
  vezes: number
  correcao: string
}

export function scanStructures(text: string): StructureFlag[] {
  const flags: StructureFlag[] = []
  for (const s of STRUCTURES) {
    const n = (text.match(s.re) ?? []).length
    if (n) flags.push({ id: s.id, nome: s.nome, vezes: n, correcao: s.correcao })
  }
  const lens = (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim().split(/\s+/).length).filter((n) => n > 2)
  if (lens.length >= 4) {
    const cv = mean(lens) ? pstdev(lens) / mean(lens) : 0
    if (cv < 0.35) flags.push({ id: 'frases-iguais', nome: `Frases do mesmo tamanho (variação ${cv.toFixed(2).replace('.', ',')})`, vezes: lens.length, correcao: 'Quebre uma frase no meio. Deixe outra correr longa. Máquina escreve tudo igual.' })
  }
  return flags
}

export interface Humanized {
  texto: string
  mudancas: HumanizeChange[]
  estruturas: StructureFlag[]
  total: number
}

export function humanize(input: string): Humanized {
  const mudancas: HumanizeChange[] = []
  const urls: string[] = []
  let text = input.replace(URL, (m) => `\uE000${urls.push(m) - 1}\uE000`)

  for (const [re, to, name] of INVISIBLE) {
    const n = (text.match(re) ?? []).length
    if (n) {
      mudancas.push({ tipo: 'invisivel', de: name, para: to ? 'espaço' : 'apagado', vezes: n })
      text = text.replace(re, to)
    }
  }
  // Outros caracteres de formatação invisíveis (categoria Cf), menos o separador dos links guardados
  const stray = text.match(/[^\P{Cf}\uE000]/gu) ?? []
  if (stray.length) {
    mudancas.push({ tipo: 'invisivel', de: 'outro caractere de formatação invisível', para: 'apagado', vezes: stray.length })
    text = text.replace(/[^\P{Cf}\uE000]/gu, '')
  }

  for (const [ch, to, name] of TYPO) {
    const n = text.split(ch).length - 1
    if (!n) continue
    mudancas.push({ tipo: 'tipografia', de: `${ch} ${name}`, para: to.trim() || 'espaço', vezes: n })
    if (ch === '—') text = text.replace(/\s*—\s*/g, ', ')
    else if (ch === '–') text = text.replace(/\s*–\s*(?=\d)/g, '-').replace(/\s+–\s+/g, ', ').replace(/–/g, '-')
    else text = text.split(ch).join(to)
  }
  text = text.replace(/,\s*([,.;:!?])/g, '$1').replace(/,\s*\n/g, '\n')

  for (const e of ORDERED) {
    const re = lexRe(e.find)
    const found = text.match(re)
    if (!found) continue
    mudancas.push({ tipo: 'lexico', de: e.find, para: e.replace || '(apagado)', vezes: found.length })
    text = text.replace(re, (m) => matchCase(m, e.replace))
  }
  // Limpeza do que as exclusões deixam: espaço duplo, pontuação órfã, linha começando com vírgula
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*(?:[,.;:!?]+[ \t]*)+/gm, '')
    .replace(/^[ \t](?=\S)/gm, '')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/,\s*([,.;:!?])/g, '$1')
    .replace(/\.\.\./g, '\uE001')
    .replace(/\.\s*\.+/g, '.')
    .replace(/([!?])\s*\./g, '$1')
    .replace(/\uE001/g, '...')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    // "Além disso, X" vira "E X" (sem a vírgula que sobra)
    .replace(/(^|[.!?][ \t]+|\n)([Ee]), /gu, '$1$2 ')
  // Frase que perdeu a abertura começa em minúscula: volta a maiúscula, se o texto usa maiúsculas
  const starts = input.match(/(?:^|[.!?]\s+|\n)\s*(\p{L})/gu) ?? []
  const upper = starts.filter((s) => /\p{Lu}/u.test(s.slice(-1))).length
  if (starts.length && upper * 2 >= starts.length) text = text.replace(/(^|[.!?] |[.!?]\n|\n)(\s*)(\p{Ll})/gu, (_m, a: string, b: string, c: string) => a + b + c.toUpperCase())

  text = text.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => urls[Number(i)] ?? '').trim()
  return { texto: text, mudancas, estruturas: scanStructures(text), total: mudancas.reduce((s, m) => s + m.vezes, 0) }
}

// ---------- as 5 checagens ----------

const WORDS = /[\p{L}']+/gu
const scale = (value: number, human: number, machine: number) => (human === machine ? 50 : clamp(((value - machine) / (human - machine)) * 100))
/** Marcas de fala do português (o equivalente às contrações do inglês). */
const SPOKEN = /(?<![\p{L}])(?:pra|pro|pros|pras|tá|tô|tava|né|cê|num|numa|dum|duma|vamo|bora|tipo|aí|daí|a gente|tão|tamo|ó)(?![\p{L}])/giu
const PERSON = /(?<![\p{L}])(?:eu|me|meu|minha|meus|minhas|nós|nosso|nossa|a gente|você|vocês|vc|seu|sua|seus|suas|te)(?![\p{L}])/giu

export const HUMAN_CHECKS = ['RITMO', 'CONCRETO', 'CLICHES', 'DIGITAL', 'VOZ'] as const
export type HumanCheck = (typeof HUMAN_CHECKS)[number]
export const HUMAN_CHECK_LABEL: Record<HumanCheck, string> = { RITMO: 'Ritmo das frases', CONCRETO: 'Concreto', CLICHES: 'Clichês', DIGITAL: 'Digital (caracteres)', VOZ: 'Voz' }

export interface HumanScore {
  nota: number
  veredito: 'PASSA' | 'REVISAR' | 'SINALIZADO'
  checks: Record<HumanCheck, { nota: number; detalhe: string }>
  pior: HumanCheck
}

export function detect(text: string): HumanScore {
  const w = text.match(WORDS) ?? []
  const lens = (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim().split(/\s+/).length).filter((n) => n > 2)
  const r = {} as Record<HumanCheck, [number, string]>

  if (lens.length < 4) r.RITMO = [50, 'curto demais para julgar']
  else {
    const cv = mean(lens) ? pstdev(lens) / mean(lens) : 0
    r.RITMO = [scale(cv, 0.7, 0.22), `variação ${cv.toFixed(2).replace('.', ',')} em ${lens.length} frases (bom: 0,55 ou mais)`]
  }

  if (w.length < 25) r.CONCRETO = [50, 'curto demais para julgar']
  else {
    const hits = (text.match(NUMBER) ?? []).filter((s) => s.trim()).length + new Set(text.match(PROPER) ?? []).size
    const d = (hits * 100) / w.length
    r.CONCRETO = [scale(d, 6, 0.5), `${hits} marcas concretas, ${d.toFixed(1).replace('.', ',')} a cada 100 palavras (bom: 4 ou mais)`]
  }

  if (!w.length) r.CLICHES = [50, 'vazio']
  else {
    let hits = 0
    const found: string[] = []
    for (const e of LEXICON) {
      const n = (text.match(lexRe(e.find)) ?? []).length
      if (n) {
        hits += n
        found.push(e.find)
      }
    }
    const d = (hits * 100) / w.length
    r.CLICHES = [scale(d, 0, 4), `${hits} clichê(s), ${d.toFixed(1).replace('.', ',')} a cada 100 palavras${found.length ? ` (${found.slice(0, 4).join(', ')}${found.length > 4 ? ', …' : ''})` : ''}`]
  }

  {
    const invisible = (text.match(/\p{Cf}/gu) ?? []).length
    const em = text.split('—').length - 1
    const curly = (text.match(/[‘’“”]/g) ?? []).length
    const ellip = text.split('…').length - 1
    const hard = (text.match(/[\u00A0\u202F\u2009]/g) ?? []).length
    const per1k = ((invisible * 4 + em * 2 + curly + ellip + hard) * 1000) / Math.max(text.length, 1)
    r.DIGITAL = [scale(per1k, 0, 12), `${invisible} invisível, ${em} travessão, ${curly} aspas curvas, ${ellip} reticências, ${hard} espaço especial`]
  }

  if (w.length < 25) r.VOZ = [50, 'curto demais para julgar']
  else {
    const per = 100 / w.length
    const spoken = (text.match(SPOKEN) ?? []).length * per
    const person = (text.match(PERSON) ?? []).length * per
    const flags = scanStructures(text).filter((f) => f.id !== 'frases-iguais')
    const tells = flags.reduce((s, f) => s + f.vezes, 0)
    const bullets = (text.match(/^\s*[-*•]\s+(.+)$/gm) ?? []).map((b) => b.trim().split(/\s+/).length)
    const uniform = bullets.length >= 3 && pstdev(bullets) < 1.6
    let score = scale(spoken, 2, 0) * 0.3 + scale(person, 8, 1) * 0.4 + clamp(100 - tells * 22) * 0.3
    if (uniform) score -= 12
    r.VOZ = [clamp(score), `${spoken.toFixed(1).replace('.', ',')} marcas de fala ("pra", "tá", "a gente") e ${person.toFixed(1).replace('.', ',')} pronomes pessoais a cada 100 palavras, ${tells} estrutura(s) de máquina${flags.length ? ` [${flags.slice(0, 4).map((f) => f.id).join(', ')}]` : ''}${uniform ? ', lista com itens do mesmo tamanho' : ''}`]
  }

  const scores = HUMAN_CHECKS.map((c) => r[c][0])
  const nota = mean(scores) * 0.6 + Math.min(...scores) * 0.4
  const pior = HUMAN_CHECKS.reduce((a, b) => (r[b][0] < r[a][0] ? b : a))
  return {
    nota: round1(nota),
    veredito: nota >= 70 && Math.min(...scores) >= 55 ? 'PASSA' : nota >= 50 ? 'REVISAR' : 'SINALIZADO',
    checks: Object.fromEntries(HUMAN_CHECKS.map((c) => [c, { nota: round1(r[c][0]), detalhe: r[c][1] }])) as HumanScore['checks'],
    pior,
  }
}

/** Limpa e mede antes e depois: o que a Iara mostra (nunca a nota sozinha). */
export function humanizeReport(text: string) {
  const antes = detect(text)
  const h = humanize(text)
  const depois = detect(h.texto)
  return { ...h, antes, depois }
}
