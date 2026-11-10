/**
 * A direção de um vídeo animado em código (2026-11-10; o usuário: "nossa ferramenta de vídeo tá viciada num
 * modelo, sempre gerando o mesmo formato e não seguindo as regras do que mandamos").
 *
 * O vício vinha de três lugares: o estilo de comercial de agência ia como obrigação em todo pedido (sistema e
 * contrato), o vídeo "Copos" virou regra fixa (título em caixa alta por parte, física de queda e empilhamento) e o
 * plano só sabia descrever um formato (título + elemento + partículas + logo). Nada conferia o resultado.
 *
 * Agora a autoridade tem ordem explícita e cada camada é separada:
 *   1. as regras do usuário e as escolhas globais (logo, fundo, legenda) mandam sobre tudo;
 *   2. a decupagem (o que aparece em cada cena) diz o vídeo cena a cena;
 *   3. a ficha da referência (lida pela IA, editável) diz a linguagem visual;
 *   4. o estilo é um pacote opcional (`VIDEO_STYLES`), nunca padrão;
 *   5. o contrato da cena (`scene.ts`) é só técnico.
 * Depois de rodar, a IA confere quadros do vídeo contra a lista de regras (`buildChecklist`) e corrige.
 *
 * Este arquivo não depende do app (só tipos): os testes do Node importam direto.
 */
import type { SceneCaptions } from './sceneEdit'
import type { VoiceAI } from './explicativo/voiceDirection'

// ── Estilos (pacotes opcionais) ───────────────────────────────────────────────────────────────────────────

export type StyleId = 'livre' | 'comercial' | 'objetos' | '3d' | 'editorial' | 'cinetico'

export const VIDEO_STYLES: Record<StyleId, { label: string; hint: string; rules: string }> = {
  livre: {
    label: 'Livre',
    hint: 'Segue a referência e a decupagem; sem referência, a IA escolhe pelo assunto.',
    rules: '',
  },
  comercial: {
    label: 'Comercial de agência',
    hint: 'Ritmo na batida, overshoot, rastro de velocidade, impactos.',
    rules: 'Linguagem de comercial de agência: cortes e impactos na batida, entradas com outExpo/outBack, saídas com inExpo, rastro de velocidade (lib.blurFrame) nos movimentos rápidos, squash and stretch no pouso (sx/sy), transições que empurram a cena (a próxima entra enquanto a outra sai), máscaras circulares que abrem, títulos gigantes que atravessam a tela, impactos com clarão. Nada parado mais de 1 s.',
  },
  objetos: {
    label: 'Objetos e física',
    hint: 'Objetos desenhados que caem, quicam e empilham; título curto por cena.',
    rules: 'Objetos desenhados em código (formas simples, personagens simples) com física simples: queda com gravidade, quique curto, empilhamento, encher e esvaziar. Um título curto por cena em caixa alta com espaçamento (52 a 72 px). Câmera que respira e transição contínua entre as cenas.',
  },
  '3d': {
    label: '3D conectado',
    hint: 'Cidade ou mini componente em 3D com tudo ligado à marca (lib.d3).',
    rules: 'Faça a cena em 3D com lib.d3 (ver o contrato 3D): o centro com o logo, um prédio com ícone para cada ponta, conexões com pulsos e a câmera trocando de ângulo a cada cena; sem título nem frase na tela, a menos que a decupagem ou as regras peçam texto.',
  },
  editorial: {
    label: 'Editorial calmo',
    hint: 'Muito respiro, tipografia grande em frase normal, entradas suaves.',
    rules: 'Linguagem editorial: muito espaço vazio, uma ideia por tela, tipografia grande em frase normal (nada de tudo em maiúsculas), alinhamento firme numa grade, entradas suaves (outCubic, 0,6 a 1 s), câmera quase parada, cortes limpos ou fusões curtas, sem partículas, sem tremida, sem clarão. Cor da marca só nos destaques.',
  },
  cinetico: {
    label: 'Texto cinético',
    hint: 'A própria fala vira a animação, palavra por palavra.',
    rules: 'Texto cinético: a tipografia é a animação. As palavras-chave da fala (env.data.words) entram no segundo em que são faladas, em composições que mudam de escala, peso, direção e alinhamento a cada frase; palavras de destaque na cor da marca. Neste estilo a cena desenha as palavras (o motor não desenha legenda).',
  },
}

export const STYLE_IDS = Object.keys(VIDEO_STYLES) as StyleId[]

// ── Ficha da referência ──────────────────────────────────────────────────────────────────────────────────

export type TextAmount = 'nenhum' | 'pouco' | 'titulos' | 'muito'
export type Rhythm = 'calmo' | 'medio' | 'rapido'
export const TEXT_LABEL: Record<TextAmount, string> = { nenhum: 'Sem texto', pouco: 'Pouco texto', titulos: 'Título por cena', muito: 'Muito texto' }
export const RHYTHM_LABEL: Record<Rhythm, string> = { calmo: 'Calmo', medio: 'Médio', rapido: 'Rápido' }

/** O que a IA leu na referência; aparece no criador e pode ser editado. */
export interface RefReading {
  /** Quantas cenas (planos) a referência tem. */
  cenas: number
  texto: TextAmount
  ritmo: Rhythm
  /** Fundo e luz (ex.: "quase preto com brilho azul"). */
  fundo: string
  /** O que aparece: objetos, pessoas, interface, tipografia, ícones… */
  elementos: string
  camera: string
  transicoes: string
  /** Uma ou duas frases: a linguagem visual inteira. */
  resumo: string
}

// ── Decupagem ────────────────────────────────────────────────────────────────────────────────────────────

export type ShotTransition = 'continua' | 'corte' | 'empurrar' | 'zoom' | 'mascara'
export const SHOT_TRANSITION_LABEL: Record<ShotTransition, string> = { continua: 'Contínua', corte: 'Corte seco', empurrar: 'Empurrar', zoom: 'Zoom', mascara: 'Máscara' }

/** Uma cena do vídeo. A fala de cada cena, em ordem, é a narração. */
export interface Shot {
  fala: string
  /** O que aparece na tela: elementos, composição, movimento. */
  tela: string
  /** O texto escrito na tela; vazio = nenhum texto nesta cena. */
  texto: string
  transicao: ShotTransition
  /** O quadro da referência (1, 2…) que esta cena segue. */
  ref?: number
}

// ── Plano ────────────────────────────────────────────────────────────────────────────────────────────────

export type LogoVersion = 'claro' | 'escuro' | 'nenhum'
export type LogoPlace = 'abertura-e-fecho' | 'fecho' | 'sempre'
export type Background = 'referencia' | 'escuro' | 'claro' | 'marca'

export interface VideoPlan {
  how: 'igual' | 'novo'
  topic: string
  /** A copy da narração quando ainda não há decupagem (com decupagem, a narração é a fala de cada cena). */
  copy: string
  /** Regras obrigatórias escritas pela pessoa (uma por linha). Entram no pedido e na conferência. */
  rules: string
  style: StyleId
  reading?: RefReading
  shots: Shot[]
  background: Background
  logo: LogoVersion
  logoPlace: LogoPlace
  narrate: boolean
  voice: VoiceAI
  captions: SceneCaptions
}

export const LOGO_LABEL: Record<LogoVersion, string> = { escuro: 'Para fundo escuro', claro: 'Para fundo claro', nenhum: 'Sem logo' }
export const LOGO_PLACE_LABEL: Record<LogoPlace, string> = { 'abertura-e-fecho': 'Abertura e fecho', fecho: 'Só no fecho', sempre: 'O vídeo todo (canto)' }
export const BG_LABEL: Record<Background, string> = { referencia: 'Como a referência', escuro: 'Escuro', claro: 'Claro', marca: 'Cor da marca' }

/** A narração do plano: a fala de cada cena, ou a copy. */
export const planCopy = (plan: Pick<VideoPlan, 'shots' | 'copy'>) => (plan.shots.length ? plan.shots.map((s) => s.fala.trim()).filter(Boolean).join(' ') : plan.copy.trim())

/** Segundos estimados de fala (2,6 palavras por segundo). */
export const spokenSeconds = (text: string) => Math.round((text.split(/\s+/).filter(Boolean).length / 2.6) * 10) / 10

// ── Leitura das respostas da IA ──────────────────────────────────────────────────────────────────────────

export const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback)
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function parseReading(v: unknown): RefReading | undefined {
  if (!v || typeof v !== 'object') return undefined
  const j = v as Record<string, unknown>
  const cenas = Math.round(Number(j.cenas))
  const r: RefReading = {
    cenas: Number.isFinite(cenas) && cenas > 0 ? Math.min(20, cenas) : 0,
    texto: pick(j.texto, ['nenhum', 'pouco', 'titulos', 'muito'] as const, 'pouco'),
    ritmo: pick(j.ritmo, ['calmo', 'medio', 'rapido'] as const, 'medio'),
    fundo: s(j.fundo, 200),
    elementos: s(j.elementos, 300),
    camera: s(j.camera, 200),
    transicoes: s(j.transicoes, 200),
    resumo: s(j.resumo, 500),
  }
  return r.resumo || r.elementos || r.fundo ? r : undefined
}

export function parseShots(v: unknown, frames = 0): Shot[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x): Shot | null => {
      if (!x || typeof x !== 'object') return null
      const j = x as Record<string, unknown>
      const fala = s(j.fala, 400)
      if (!fala) return null
      const ref = Math.round(Number(j.quadro ?? j.ref))
      return {
        fala,
        tela: s(j.tela, 400),
        texto: s(j.texto, 80),
        transicao: pick(j.transicao, ['continua', 'corte', 'empurrar', 'zoom', 'mascara'] as const, 'continua'),
        ...(frames && ref >= 1 && ref <= frames ? { ref } : {}),
      }
    })
    .filter((x): x is Shot => !!x)
    .slice(0, 12)
}

/** Tira o JSON de uma resposta (com ou sem cerca de código). */
export function parseJson(raw: string | undefined): Record<string, unknown> {
  const text = (raw ?? '').trim().replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '')
  const j = JSON.parse(text)
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('não é um objeto')
  return j as Record<string, unknown>
}

// ── Textos para a IA ─────────────────────────────────────────────────────────────────────────────────────

export const readingText = (r: RefReading) =>
  [
    r.resumo,
    r.cenas ? `${r.cenas} cenas.` : '',
    `Texto na tela: ${TEXT_LABEL[r.texto].toLowerCase()}. Ritmo ${RHYTHM_LABEL[r.ritmo].toLowerCase()}.`,
    r.fundo ? `Fundo e luz: ${r.fundo}.` : '',
    r.elementos ? `Elementos: ${r.elementos}.` : '',
    r.camera ? `Câmera: ${r.camera}.` : '',
    r.transicoes ? `Transições: ${r.transicoes}.` : '',
  ].filter(Boolean).join(' ')

/** Uma linha que resume a direção de um vídeo, guardada nele para os próximos não repetirem a estrutura. */
export const directionSummary = (plan: Pick<VideoPlan, 'style' | 'shots' | 'background' | 'reading'>) =>
  [
    `estilo ${VIDEO_STYLES[plan.style].label.toLowerCase()}`,
    plan.reading?.resumo ? `linguagem: ${plan.reading.resumo.slice(0, 160)}` : '',
    plan.shots.length ? `cenas: ${plan.shots.map((x) => x.tela.slice(0, 60) || x.texto || '…').join(' / ')}` : '',
  ].filter(Boolean).join('; ').slice(0, 600)

/** As regras de fundo, logo e legenda do plano (o que a pessoa escolheu). */
function globalRules(plan: VideoPlan, brandHex: string): string[] {
  const out: string[] = []
  if (plan.background === 'escuro') out.push('Fundo escuro (quase preto).')
  else if (plan.background === 'claro') out.push('Fundo claro (off-white ou o fundo claro da marca).')
  else if (plan.background === 'marca') out.push(`Fundo na cor principal da marca (${brandHex}).`)
  if (plan.logo === 'nenhum') out.push('Sem logo em nenhum momento.')
  else {
    const name = plan.logo === 'escuro' ? 'env.images.logo_escuro' : 'env.images.logo'
    out.push(`Logo: o logo de verdade (${name}, nunca o nome escrito), ${plan.logoPlace === 'sempre' ? 'pequeno no canto superior esquerdo o vídeo todo e grande no fecho' : plan.logoPlace === 'fecho' ? 'só no fecho, grande e centralizado' : 'na abertura (pequeno, no alto) e no fecho (grande, centralizado)'}.`)
  }
  const capY = Math.round((plan.captions.y ?? 0.8) * 100)
  if (plan.narrate && plan.captions.style !== 'nenhuma' && plan.style !== 'cinetico') out.push(`A legenda da fala é desenhada pelo motor em ${capY}% da altura: a faixa entre ${capY - 7}% e ${capY + 7}% fica livre de texto e de elementos importantes.`)
  return out
}

const userRules = (plan: VideoPlan) => plan.rules.split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)

export interface TimedShot extends Shot {
  start: number
  end: number
}

/** O pedido à IA que escreve a cena, na ordem de autoridade. */
export function buildSceneRequest(o: {
  plan: VideoPlan
  shots: TimedShot[]
  duration: number
  narrated: boolean
  frames: number
  notes?: string
  brandHex: string
  /** Resumos dos últimos vídeos da conta (sem referência: não repetir). */
  history?: string[]
}): string {
  const { plan, shots } = o
  const rules = [...userRules(plan), ...globalRules(plan, o.brandHex)]
  const style = VIDEO_STYLES[plan.style]
  return [
    `## 1. Regras obrigatórias (mandam sobre a referência e sobre o estilo)\n${rules.map((r) => `- ${r}`).join('\n')}\n- Não desenhe nada que não esteja na decupagem, na referência ou no estilo (nada de título, cartão, partícula ou frase "por padrão").`,
    `## 2. Decupagem (siga cena por cena; cada cena entra no segundo de start, como env.data.parts[i])\nO vídeo dura ${o.duration} s${o.narrated ? ' e é narrado' : ' e não tem narração'}.\n${shots
      .map((x, i) => `Cena ${i + 1} · ${x.start.toFixed(1)}s–${x.end.toFixed(1)}s\n  na tela: ${x.tela || '(livre, na linguagem da referência)'}\n  texto na tela: ${x.texto ? `"${x.texto}" (exatamente isto)` : 'NENHUM'}\n  transição para a próxima: ${SHOT_TRANSITION_LABEL[x.transicao].toLowerCase()}${x.ref ? `\n  segue o quadro ${x.ref} da referência` : ''}\n  fala: ${x.fala}`)
      .join('\n')}`,
    o.frames
      ? `## 3. A referência (${o.frames} quadros anexados, numerados de 1 a ${o.frames} em ordem)\nRecrie a LINGUAGEM VISUAL dela como uma animação nova, desenhada do zero: o mesmo tipo de elemento, a mesma composição, a mesma câmera, o mesmo ritmo e o mesmo tipo de movimento. Não acrescente o que ela não tem.${plan.reading ? `\nFicha: ${readingText(plan.reading)}` : ''}${o.notes ? `\nNotas: ${o.notes}` : ''}${plan.background === 'referencia' ? '\nFundo e luz: os da referência; as cores da marca entram nos destaques. Cores com sentido na referência (vermelho de erro, verde de acerto) mantêm o sentido.' : ''}`
      : `## 3. Sem referência\nEscolha uma linguagem visual que sirva ao assunto${plan.style === 'livre' ? ' (não um comercial genérico)' : ''}.${plan.background === 'referencia' ? ' Fundo à sua escolha, coerente com a marca.' : ''}`,
    style.rules ? `## 4. Estilo: ${style.label}\n${style.rules}` : '## 4. Estilo\nNenhum pacote de estilo: a decupagem e a referência decidem.',
    !o.frames && o.history?.length ? `## Não repita\nOs últimos vídeos desta conta foram assim; faça uma estrutura e uma linguagem visual diferentes:\n${o.history.map((h) => `- ${h}`).join('\n')}` : '',
    '## Técnico\nEscala de celular (1080 × 1920): os elementos principais ocupam de 50% a 80% da largura; nada de texto abaixo de 26 px; use a altura toda. Deixe a cena editável (item `campos`): o texto de cada cena que tem texto (grupo "Cena N"), o fundo, a cor de destaque e de 2 a 4 escolhas de efeito que mudem de verdade o visual.',
  ].filter(Boolean).join('\n\n')
}

/** A lista que a conferência usa: cada item dá para ver num quadro. */
export function buildChecklist(plan: VideoPlan, shots: TimedShot[], brandHex: string): string[] {
  return [
    ...userRules(plan),
    ...globalRules(plan, brandHex),
    ...shots.map((x, i) => `Cena ${i + 1} (${x.start.toFixed(1)}s–${x.end.toFixed(1)}s): ${x.texto ? `o texto na tela é "${x.texto}"` : 'nenhum texto escrito na tela'}${x.tela ? `; mostra: ${x.tela}` : ''}.`),
    plan.style === 'cinetico' ? '' : 'A cena não desenha legenda, frase de rodapé nem a fala escrita.',
    'Nenhum texto cortado, sobreposto ou saindo da tela.',
  ].filter(Boolean)
}

export const CHECK_SYSTEM = [
  'Você é o revisor de um vídeo animado. Recebe a lista de regras do pedido e quadros do vídeo (cada um com o segundo e a cena). Diga o que NÃO foi cumprido.',
  'Só reprove o que dá para ver nos quadros; na dúvida, aprove. Não opine sobre gosto. Cada problema em uma frase concreta que diga a cena e o que corrigir (ex.: "Cena 2: aparece o título VENDA MAIS, mas a cena não tem texto: tire o título").',
  'Responda pelo esquema: `reply` com uma frase; `items` com {"ref": "resultado", "text": JSON {"ok": true|false, "problemas": ["..."]}}.',
].join('\n')

export function parseCheck(raw: string | undefined): { ok: boolean; problems: string[] } {
  const j = parseJson(raw)
  const problems = Array.isArray(j.problemas) ? j.problemas.map((p) => String(p).trim()).filter(Boolean).slice(0, 10) : []
  return { ok: j.ok === true && !problems.length, problems }
}

/** O sistema da IA que escreve a cena, sem estética embutida (o estilo vem no pedido). */
export const SCENE_SYSTEM_BASE = [
  'Você é um motion designer sênior que escreve animações em código para canvas 2D, para Reels e anúncios. Você executa a direção que recebe: regras do usuário primeiro, depois a decupagem, depois a referência, depois o estilo. Quando nada disso define algo, escolha o que serve ao conteúdo, sem cair num formato pronto. Movimento sempre fluido, sem micro-tremidas.',
  'Você escreve UMA cena: um código JavaScript que segue exatamente o contrato abaixo. Desenhe tudo com o ctx e a lib; quando houver imagens no material, use-as pelo nome em env.images e tenha um desenho de reserva quando faltarem. O código precisa rodar sem erro na primeira vez: declare tudo que usar, não use import, DOM, rede, setTimeout nem estado entre quadros.',
  'Use as cores e o nome da marca do material (env.brand); quando vierem quadros de um vídeo de referência, siga a linguagem visual dele, mas nunca copie a marca, o logo ou os textos de outra empresa.',
  'Textos em português do Brasil. Nenhum preço, número ou promessa que não esteja no pedido; se o pedido não der preços e a cena precisar, use preços de exemplo e diga isso no `reply`.',
  'A cena é editável sem a IA: tudo o que a pessoa pode querer trocar vira um campo, e o código lê o valor em env.data.params (sempre com reserva: `const P = env.data?.params || {}` e `P.titulo1 ?? "TEXTO"`). Exponha todo texto que aparece na tela, as cores principais (fundo, destaque) e de 2 a 4 escolhas de efeito que mudem de verdade o visual. Não desenhe legenda da fala: o motor desenha a legenda por cima quando a pessoa liga (exceto no estilo de texto cinético).',
  'Responda pelo esquema: `reply` com 2 ou 3 frases dizendo o roteiro (as cenas e os tempos) e o que trocar; `items` com um item {"ref": "cena", "text": o código inteiro}, um item {"ref": "campos", "text": JSON da lista de campos} e, opcional, {"ref": "duracao", "text": segundos}.',
  'Cada campo: {"key": nome-de-variável (letras, números, _), "label": nome curto em português, "type": "texto" | "cor" | "numero" | "opcao" | "liga", "value": o valor padrão, "group": "Cena 1" | "Cores" | "Efeitos" | …} e, conforme o tipo, "options": [lista de textos] (opcao), "min", "max", "step" (numero). Cor em #RRGGBB. Até 30 campos. Ao ajustar uma cena que já tem campos, mantenha as chaves e os valores escolhidos pela pessoa, a menos que o pedido mude isso.',
]

/** O 3D entra só quando foi escolhido, quando a cena já usa lib.d3 ou quando o pedido fala em 3D. */
export const wants3d = (o: { style?: StyleId; request: string; code?: string }) =>
  o.style === '3d' || /lib\.d3/.test(o.code ?? '') || /\b3d\b|tridimensional/i.test(o.request)

/** O papel do agente que trabalha na pasta (`scripts/criativos/videoAgent.ts`): sem o formato de resposta. */
export const SCENE_AGENT_SYSTEM = SCENE_SYSTEM_BASE.slice(0, 5).join('\n')
/** Como gravar `campos.json` (vai no fim do contrato que o agente recebe). */
export const AGENT_FIELDS_NOTE = `## Campos (campos.json)\nUma lista JSON. ${SCENE_SYSTEM_BASE[6]}`

/** Cada cena do vídeo e o segundo da referência em que ela começa (pelo quadro escolhido na decupagem). */
export function referenceMap(shots: TimedShot[], frameTimes: number[] | undefined) {
  if (!frameTimes?.length) return undefined
  const map = shots.flatMap((x) => (x.ref && frameTimes[x.ref - 1] !== undefined ? [{ start: x.start, end: x.end, refStart: frameTimes[x.ref - 1] }] : []))
  return map.length ? map : undefined
}
