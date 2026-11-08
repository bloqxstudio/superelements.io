/**
 * Desenhos a lápis para a Iara montar ilustrações no quadro (2026-11-07, o usuário, com a imagem de um
 * comparativo em sketchnote — bonecos de palito numa reunião, uma pessoa dentro do notebook falando para uma
 * plateia, X e ✓, títulos e listas à mão: "quero conseguir que o agente faça esse tipo de desenho com o lápis").
 * Um modelo de linguagem não desenha bem ponto a ponto; ele escolhe e posiciona estes desenhos. Cada um é uma
 * lista de traços numa caixa própria (largura × altura em px na escala 1), que `sketch.ts` passa pelo lápis.
 * Sem imports: roda no navegador e nos testes.
 */

export type P = [number, number]
export interface Stroke { pontos: P[]; fechado?: boolean; peso?: number }
export interface Doodle { w: number; h: number; strokes: Stroke[] }

/** Elipse como traço (começa num ângulo qualquer e passa um pouco do começo, como à mão). */
export const ring = (cx: number, cy: number, rx: number, ry = rx, start = -2.2, n = 22): P[] =>
  Array.from({ length: n + 2 }, (_, i) => { const a = start + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P })
/** Arco de `a0` a `a1` (radianos). */
export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): P[] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P })
const dot = (x: number, y: number): Stroke => ({ pontos: [[x, y], [x + 0.5, y + 0.3]], peso: 1 })

export type Mood = 'feliz' | 'triste' | 'neutro' | 'cansado' | 'falando'

/** O rosto dentro de uma cabeça (centro e raio). */
function face(cx: number, cy: number, r: number, mood: Mood = 'feliz'): Stroke[] {
  const ex = r * 0.38, ey = cy - r * 0.15
  const eyes: Stroke[] = mood === 'cansado'
    ? [{ pontos: [[cx - ex - 2, ey], [cx - ex + 2, ey]] }, { pontos: [[cx + ex - 2, ey], [cx + ex + 2, ey]] }]
    : [dot(cx - ex, ey), dot(cx + ex, ey)]
  const my = cy + r * 0.38
  const mouth: Stroke =
    mood === 'feliz' ? { pontos: arc(cx, my - r * 0.18, r * 0.4, r * 0.25, 0.3, Math.PI - 0.3, 6) }
    : mood === 'triste' || mood === 'cansado' ? { pontos: arc(cx, my + r * 0.12, r * 0.38, r * 0.2, Math.PI + 0.35, Math.PI * 2 - 0.35, 6) }
    : mood === 'falando' ? { pontos: ring(cx, my, r * 0.18, r * 0.14, 0, 10), fechado: true }
    : { pontos: [[cx - r * 0.3, my], [cx + r * 0.3, my]] }
  return [...eyes, mouth]
}

const person = (mood: Mood, arms: 'baixo' | 'cima' | 'aponta' | 'aceno' | 'cintura'): Doodle => {
  const s: Stroke[] = [{ pontos: ring(30, 14, 11), fechado: true }, ...face(30, 14, 11, mood), { pontos: [[30, 25], [30, 62]] }]
  const sh: P = [30, 33]
  const A: Record<typeof arms, P[][]> = {
    baixo: [[sh, [17, 50]], [sh, [43, 50]]],
    cima: [[sh, [15, 14]], [sh, [45, 14]]],
    aponta: [[sh, [16, 50]], [sh, [56, 26]]],
    aceno: [[sh, [16, 50]], [sh, [46, 20], [50, 10]]],
    cintura: [[sh, [18, 44], [27, 52]], [sh, [42, 44], [33, 52]]],
  }
  for (const a of A[arms]) s.push({ pontos: a })
  s.push({ pontos: [[30, 62], [19, 92]] }, { pontos: [[30, 62], [41, 92]] })
  return { w: 60, h: 95, strokes: s }
}

/** Sentado de lado, olhando para a direita (espelhe para a esquerda): cabeça, tronco, coxa, perna e braço na mesa. */
const seated = (mood: Mood): Doodle => ({
  w: 70, h: 95,
  strokes: [
    { pontos: ring(24, 16, 11), fechado: true }, ...face(26, 16, 10, mood),
    { pontos: [[24, 27], [26, 60]] },
    { pontos: [[25, 36], [44, 46], [56, 46]] },
    { pontos: [[26, 60], [50, 61]] }, { pontos: [[50, 61], [50, 92]] }, { pontos: [[50, 92], [57, 92]] },
  ],
})

/** Cadeira de lado (encosto à esquerda). */
const chair: Doodle = { w: 50, h: 70, strokes: [{ pontos: [[6, 0], [10, 38]] }, { pontos: [[10, 38], [44, 38]] }, { pontos: [[12, 38], [9, 70]] }, { pontos: [[40, 38], [44, 70]] }] }
const table: Doodle = { w: 110, h: 60, strokes: [{ pontos: [[0, 4], [110, 4]] }, { pontos: [[2, 10], [108, 10]] }, { pontos: [[55, 10], [55, 56]] }, { pontos: [[38, 58], [72, 58]] }] }

const laptop: Doodle = {
  w: 150, h: 105,
  strokes: [
    { pontos: [[16, 4], [134, 4], [134, 82], [16, 82]], fechado: true },
    { pontos: [[22, 10], [128, 10], [128, 76], [22, 76]], fechado: true, peso: 1 },
    { pontos: [[8, 86], [142, 86], [150, 100], [0, 100]], fechado: true },
    { pontos: [[64, 93], [86, 93]] },
  ],
}

/** Plateia: cabecinhas e ombros em fileiras, as de trás menores. */
const crowd = (rows = 3, cols = 5): Doodle => {
  const strokes: Stroke[] = []
  for (let r = 0; r < rows; r++) {
    const k = 1 - r * 0.12, y = 20 + (rows - 1 - r) * 30
    for (let c = 0; c < cols - (r % 2); c++) {
      const x = 16 + c * 26 + (r % 2) * 13
      // pequenos demais para rosto (vira borrão): só a cabeça e os ombros
      strokes.push({ pontos: ring(x, y, 7 * k), fechado: true })
      strokes.push({ pontos: arc(x, y + 22 * k, 11 * k, 12 * k, Math.PI + 0.2, Math.PI * 2 - 0.2, 8) })
    }
  }
  return { w: 16 + cols * 26, h: 20 + rows * 30 + 10, strokes }
}

const DOODLES: Record<string, (o: { humor?: Mood }) => Doodle> = {
  pessoa: (o) => person(o.humor ?? 'feliz', 'baixo'),
  pessoa_bracos_cima: (o) => person(o.humor ?? 'feliz', 'cima'),
  pessoa_apontando: (o) => person(o.humor ?? 'falando', 'aponta'),
  pessoa_acenando: (o) => person(o.humor ?? 'feliz', 'aceno'),
  pessoa_cintura: (o) => person(o.humor ?? 'neutro', 'cintura'),
  pessoa_sentada: (o) => seated(o.humor ?? 'neutro'),
  cadeira: () => chair,
  mesa: () => table,
  notebook: () => laptop,
  plateia: () => crowd(3, 5),
  x: () => ({ w: 80, h: 80, strokes: [{ pontos: [[8, 6], [74, 76]], peso: 2 }, { pontos: [[14, 4], [77, 69]], peso: 1 }, { pontos: [[74, 6], [6, 76]], peso: 2 }, { pontos: [[78, 12], [12, 78]], peso: 1 }] }),
  certo: () => ({ w: 80, h: 80, strokes: [{ pontos: [[6, 44], [28, 70], [76, 6]], peso: 2 }, { pontos: [[12, 42], [29, 62], [72, 3]], peso: 1 }] }),
  ondas: () => ({ w: 34, h: 50, strokes: [{ pontos: arc(0, 25, 10, 10, -0.9, 0.9, 6) }, { pontos: arc(0, 25, 20, 18, -0.9, 0.9, 8) }, { pontos: arc(0, 25, 30, 24, -0.9, 0.9, 10) }] }),
  seta: () => ({ w: 120, h: 30, strokes: [{ pontos: [[0, 16], [40, 13], [80, 17], [114, 15]] }, { pontos: [[100, 4], [116, 15], [100, 27]] }] }),
  seta_curva: () => ({ w: 110, h: 70, strokes: [{ pontos: arc(55, 70, 50, 56, Math.PI + 0.2, Math.PI * 2 - 0.25, 12) }, { pontos: [[92, 49], [103, 57], [107, 44]] }] }),
  lampada: () => ({ w: 70, h: 90, strokes: [{ pontos: [...arc(35, 34, 22, 22, Math.PI * 0.75, Math.PI * 2.25, 16)], peso: 2 }, { pontos: [[26, 52], [26, 64], [44, 64], [44, 52]] }, { pontos: [[27, 70], [43, 70]] }, { pontos: [[30, 76], [40, 76]] }, { pontos: [[35, 2], [35, 8]] }, { pontos: [[6, 14], [11, 18]] }, { pontos: [[64, 14], [59, 18]] }, { pontos: [[0, 36], [7, 36]] }, { pontos: [[63, 36], [70, 36]] }] }),
  balao: () => ({ w: 110, h: 80, strokes: [{ pontos: [[10, 4], [100, 4], [106, 10], [106, 50], [100, 56], [40, 56], [22, 74], [26, 56], [10, 56], [4, 50], [4, 10]], fechado: true }, { pontos: [[22, 22], [88, 22]] }, { pontos: [[22, 36], [70, 36]] }] }),
  celular: () => ({ w: 56, h: 100, strokes: [{ pontos: [[6, 2], [50, 2], [54, 8], [54, 92], [50, 98], [6, 98], [2, 92], [2, 8]], fechado: true }, { pontos: [[8, 14], [48, 14], [48, 82], [8, 82]], fechado: true, peso: 1 }, { pontos: ring(28, 90, 3), fechado: true }] }),
  conversa: () => ({ w: 56, h: 100, strokes: [{ pontos: [[6, 2], [50, 2], [54, 8], [54, 92], [50, 98], [6, 98], [2, 92], [2, 8]], fechado: true }, { pontos: [[10, 22], [34, 22], [34, 34], [16, 34], [11, 39], [12, 34], [10, 34]], fechado: true }, { pontos: [[22, 46], [46, 46], [46, 58], [44, 58], [45, 63], [40, 58], [22, 58]], fechado: true }, { pontos: [[10, 70], [30, 70], [30, 80], [10, 80]], fechado: true }] }),
  grafico: () => ({ w: 110, h: 90, strokes: [{ pontos: [[6, 0], [6, 84], [108, 84]] }, { pontos: [[12, 70], [36, 52], [56, 60], [82, 26], [100, 12]], peso: 2 }, { pontos: [[88, 10], [101, 11], [99, 24]] }] }),
  dinheiro: () => ({ w: 100, h: 60, strokes: [{ pontos: [[2, 4], [98, 4], [98, 56], [2, 56]], fechado: true }, { pontos: ring(50, 30, 14), fechado: true }, { pontos: [[50, 20], [50, 40]] }, { pontos: [[56, 24], [46, 24], [44, 29], [56, 32], [54, 37], [44, 37]] }] }),
  estrela: () => ({ w: 80, h: 76, strokes: [{ pontos: [[40, 2], [50, 28], [78, 28], [55, 45], [64, 73], [40, 56], [16, 73], [25, 45], [2, 28], [30, 28]], fechado: true }] }),
  coracao: () => ({ w: 80, h: 70, strokes: [{ pontos: [[40, 66], [10, 38], ...arc(22, 22, 18, 18, Math.PI * 0.8, Math.PI * 1.9, 8), [40, 18], ...arc(58, 22, 18, 18, Math.PI * 1.1, Math.PI * 2.2, 8), [70, 38]], fechado: true }] }),
  alvo: () => ({ w: 90, h: 90, strokes: [{ pontos: ring(45, 45, 42), fechado: true }, { pontos: ring(45, 45, 28), fechado: true }, { pontos: ring(45, 45, 13), fechado: true }, { pontos: [[45, 45], [84, 6]], peso: 2 }, { pontos: [[74, 6], [84, 6], [84, 16]] }] }),
  relogio: () => ({ w: 80, h: 80, strokes: [{ pontos: ring(40, 40, 36), fechado: true }, { pontos: [[40, 40], [40, 16]] }, { pontos: [[40, 40], [56, 48]] }] }),
  calendario: () => ({ w: 90, h: 86, strokes: [{ pontos: [[4, 12], [86, 12], [86, 82], [4, 82]], fechado: true }, { pontos: [[4, 28], [86, 28]] }, { pontos: [[24, 4], [24, 18]] }, { pontos: [[66, 4], [66, 18]] }, { pontos: [[20, 44], [28, 44]] }, { pontos: [[42, 44], [50, 44]] }, { pontos: [[64, 44], [72, 44]] }, { pontos: [[20, 62], [28, 62]] }, { pontos: [[42, 62], [50, 62]] }] }),
  carrinho: () => ({ w: 100, h: 80, strokes: [{ pontos: [[2, 6], [16, 6], [28, 52], [84, 52], [94, 18], [20, 18]] }, { pontos: ring(36, 66, 7), fechado: true }, { pontos: ring(76, 66, 7), fechado: true }] }),
  megafone: () => ({ w: 100, h: 70, strokes: [{ pontos: [[10, 26], [56, 8], [56, 62], [10, 44]], fechado: true }, { pontos: [[10, 26], [4, 26], [4, 44], [10, 44]] }, { pontos: [[22, 48], [28, 66], [36, 64], [32, 52]] }, { pontos: arc(60, 35, 16, 18, -0.8, 0.8, 6) }, { pontos: arc(60, 35, 28, 28, -0.8, 0.8, 8) }] }),
  caixa: () => ({ w: 90, h: 80, strokes: [{ pontos: [[6, 26], [46, 10], [86, 26], [46, 42]], fechado: true }, { pontos: [[6, 26], [6, 62], [46, 78], [86, 62], [86, 26]] }, { pontos: [[46, 42], [46, 78]] }] }),
  moto: () => ({ w: 130, h: 80, strokes: [{ pontos: ring(24, 58, 18), fechado: true }, { pontos: ring(106, 58, 18), fechado: true }, { pontos: [[24, 58], [50, 36], [84, 36], [106, 58]] }, { pontos: [[50, 36], [62, 54], [84, 36]] }, { pontos: [[84, 36], [92, 14], [104, 12]] }, { pontos: [[44, 32], [70, 30]], peso: 2 }] }),
  casa: () => ({ w: 90, h: 86, strokes: [{ pontos: [[4, 40], [45, 4], [86, 40]] }, { pontos: [[12, 34], [12, 82], [78, 82], [78, 34]] }, { pontos: [[36, 82], [36, 56], [54, 56], [54, 82]] }] }),
  quadro_branco: () => ({ w: 140, h: 110, strokes: [{ pontos: [[4, 4], [136, 4], [136, 80], [4, 80]], fechado: true }, { pontos: [[40, 80], [26, 108]] }, { pontos: [[100, 80], [114, 108]] }, { pontos: [[20, 64], [48, 44], [72, 54], [112, 22]] }] }),
}

export const DOODLE_NAMES = Object.keys(DOODLES)

/** Um desenho da biblioteca, ou undefined. */
export const doodle = (name: string, o: { humor?: Mood } = {}): Doodle | undefined => DOODLES[name]?.(o)

/** Cenas prontas (caixa própria): combinações dos desenhos acima. */
export interface Placed { nome: string; x: number; y: number; escala?: number; espelhar?: boolean; humor?: Mood }
export const SCENES: Record<string, { w: number; h: number; parts: Placed[] }> = {
  // duas pessoas sentadas frente a frente numa mesa (uma cansada, outra falando), como uma sessão um a um
  reuniao: { w: 244, h: 110, parts: [
    { nome: 'cadeira', x: 6, y: 40 }, { nome: 'pessoa_sentada', x: 0, y: 12, humor: 'cansado' },
    { nome: 'mesa', x: 54, y: 56, escala: 1.24 },
    { nome: 'cadeira', x: 188, y: 40, espelhar: true }, { nome: 'pessoa_sentada', x: 174, y: 12, espelhar: true, humor: 'falando' },
  ] },
  // uma pessoa dentro do notebook falando, ondas de som e a plateia
  live: { w: 330, h: 130, parts: [
    { nome: 'notebook', x: 0, y: 22 }, { nome: 'pessoa_acenando', x: 44, y: 0, escala: 0.98, humor: 'falando' },
    { nome: 'ondas', x: 140, y: 26 },
    { nome: 'plateia', x: 182, y: 22 },
  ] },
  // pessoa apontando para um quadro com um gráfico subindo
  apresentacao: { w: 240, h: 120, parts: [{ nome: 'quadro_branco', x: 90, y: 0 }, { nome: 'pessoa_apontando', x: 10, y: 22 }] },
  // pessoa com o celular e as mensagens
  atendimento: { w: 170, h: 110, parts: [{ nome: 'pessoa', x: 0, y: 12, humor: 'feliz' }, { nome: 'conversa', x: 80, y: 6 }] },
}
