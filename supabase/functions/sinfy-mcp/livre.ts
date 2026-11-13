/**
 * Slide livre (2026-11-12, o usuário pediu para copiar uma referência "100% fiel" e a IA respondeu que os
 * modelos prontos não davam controle de tipografia, fundo e posição). Com `"template": "livre"` a IA monta o
 * slide camada por camada, em pixels do formato (4x5 = 1080×1350, 1x1 = 1080×1080, 9x16 = 1080×1920), com as
 * mesmas camadas do editor (texto, forma, imagem, pontos), então tudo continua editável na Sinfy.
 *
 * camadas:
 *   {"tipo":"texto","texto","x","y","w","h"?,"fonte"?,"peso"?,"tamanho"?,"cor"?,"alinhamento"?,"altura_linha"?,"espaco_letras"?,"maiusculas"?,"italico"?,"destaque_cor"?,"opacidade"?,"rotacao"?}
 *     (*palavra* no texto = destaque, na `destaque_cor`, mesma fonte)
 *   {"tipo":"forma","x","y","w","h","cor","cor2"?,"angulo"?,"raio"?,"borda"?,"borda_largura"?,"opacidade"?,"rotacao"?}
 *   {"tipo":"imagem","x","y","w","h","arquivo"? (Cérebro) |"url"?|"prompt"? (a foto é gerada),"ajuste"?:"cover"|"contain","raio"?}
 *   {"tipo":"grade","tamanho"?:60,"cor"?,"espessura"?:2,"opacidade"?}   fundo quadriculado (linhas finas)
 *   {"tipo":"pontos","tamanho"?:40,"ponto"?:3,"cor"?,"opacidade"?}
 */

type Obj = Record<string, unknown>

const num = (v: unknown, d: number, min = -10000, max = 10000) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const color = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : d)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const uid = () => crypto.randomUUID().slice(0, 8)

/**
 * Guardrail de marca (2026-11-13, o usuário: "que respeite sempre a identidade da marca, os posts estão ficando
 * feios"). O slide livre deixava a IA escolher qualquer fonte e cor (o padrão era Inter e um azul fora da marca).
 * Agora, com a marca da conta: fonte fora da marca vira a de títulos (texto grande ou pesado) ou a de texto;
 * cor fora da paleta vai para a cor mais próxima da paleta (mais branco e preto). Opacidade continua livre, então
 * tons mais claros da marca seguem possíveis. Cada troca vai em `notes`, que volta para a IA.
 */
export interface BrandGuard { colors: string[]; heading: string; body: string; emphasis?: string; accent?: string }

const rgb = (hex: string) => {
  let h = hex.replace('#', '')
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
/** Distância de cor ponderada pelo olho (redmean). */
const dist = (a: number[], b: number[]) => {
  const r = (a[0] + b[0]) / 2
  return Math.sqrt((2 + r / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - r) / 256) * (a[2] - b[2]) ** 2)
}

export function brandGuardOf(brand: { colors?: { hex: string }[]; headingFont?: string; bodyFont?: string; emphasisFont?: string } | undefined): BrandGuard | undefined {
  const colors = (brand?.colors ?? []).map((c) => c.hex).filter((h) => /^#[0-9a-f]{3,8}$/i.test(h ?? ''))
  if (!colors.length || !brand?.headingFont) return undefined
  return { colors: [...new Set([...colors.map((c) => c.toLowerCase().slice(0, 7)), '#ffffff', '#000000'])], heading: brand.headingFont, body: brand.bodyFont || brand.headingFont, emphasis: brand.emphasisFont, accent: colors[0] }
}

export function guardColor(g: BrandGuard | undefined, value: string, notes?: string[]): string {
  if (!g) return value
  const v = value.toLowerCase().slice(0, 7)
  if (g.colors.includes(v)) return value
  const target = rgb(v)
  let best = g.colors[0], bestD = Infinity
  for (const c of g.colors) {
    const d = dist(target, rgb(c))
    if (d < bestD) { bestD = d; best = c }
  }
  notes?.push(`cor ${value} → ${best}`)
  return best
}

export function guardFont(g: BrandGuard | undefined, value: string, big: boolean, notes?: string[]): string {
  if (!g) return value
  const allowed = [g.heading, g.body, g.emphasis].filter(Boolean).map((f) => f!.toLowerCase())
  if (value && allowed.includes(value.toLowerCase())) return value
  const to = big ? g.heading : g.body
  if (value) notes?.push(`fonte ${value} → ${to}`)
  return to
}

/**
 * O grid do editor (`src/features/criativos/grid.ts`) no slide livre (2026-11-13, o usuário: "os criativos não
 * estão respeitando o grid proposto pela ferramenta"): margem de segurança de 7,78% do menor lado (84 px), 4
 * colunas com espaço de 1/3 da margem e, nos stories, as faixas que o Instagram cobre (13% no topo, 18% na base).
 * Texto fica sempre dentro; forma e imagem que não sangram entram na margem; tudo que fica perto de uma linha
 * (margem, coluna, centro) encaixa nela, como o ímã do editor. O que vai até a borda de propósito não muda.
 */
const SNAP = 24

export function gridLines(format: string) {
  const { w: W, h: H } = SIZES[format] ?? SIZES['4x5']
  const m = Math.round(Math.min(W, H) * 0.0778)
  const g = Math.round(m / 3)
  const col = (W - m * 2 - g * 3) / 4
  const v = [m, W - m, W / 2]
  for (let i = 0; i < 4; i++) v.push(Math.round(m + i * (col + g)), Math.round(m + i * (col + g) + col))
  const story = H / W > 1.6
  const top = story ? Math.round(H * 0.13) : m
  const bottom = story ? H - Math.round(H * 0.18) : H - m
  return { W, H, m, v, h: [m, H - m, H / 2, top, bottom], top, bottom }
}

const nearest = (value: number, lines: number[]) => {
  let best = value, d = SNAP + 1
  for (const l of lines) if (Math.abs(l - value) < d) { d = Math.abs(l - value); best = l }
  return best
}

/** Põe uma camada no grid (muda x, y, w, h no lugar). Devolve se mexeu. */
export function fitToGrid(layer: Obj, format: string): boolean {
  const G = gridLines(format)
  let { x, y, w, h } = layer as { x: number; y: number; w: number; h: number }
  const before = `${x},${y},${w},${h}`
  const isText = layer.type === 'text'
  const bleedX = !isText && (x <= 0 || x + w >= G.W)
  const bleedY = !isText && (y <= 0 || y + h >= G.H)
  if (!bleedX) {
    // Encaixa as bordas nas linhas próximas, depois garante a margem
    let left = nearest(x, G.v), right = nearest(x + w, G.v)
    if (right - left < 40) { left = x; right = x + w }
    left = Math.max(G.m, left)
    right = Math.min(G.W - G.m, right)
    if (right - left < Math.min(w, 160)) {
      // Estreito demais depois de cortar: desliza para dentro, sem encolher
      left = Math.max(G.m, Math.min(x, G.W - G.m - w))
      right = Math.min(G.W - G.m, left + w)
    }
    x = left
    w = right - left
  }
  if (!bleedY) {
    const top = isText ? G.top : G.m
    const bottom = isText ? G.bottom : G.H - G.m
    let t = nearest(y, G.h)
    if (Math.abs(t - y) > SNAP) t = y
    t = Math.max(top, t)
    if (t + h > bottom) t = Math.max(top, bottom - h)
    y = t
  }
  Object.assign(layer, { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.round(h) })
  return before !== `${layer.x},${layer.y},${layer.w},${layer.h}`
}

export const SIZES: Record<string, { w: number; h: number }> = { '4x5': { w: 1080, h: 1350 }, '1x1': { w: 1080, h: 1080 }, '9x16': { w: 1080, h: 1920 } }

/** Confere o pedido do slide livre (antes de gravar): até 60 camadas, tipos conhecidos. */
export function cleanFree(o: Obj, where: string, fail: (m: string) => never) {
  const camadas = Array.isArray(o.camadas) ? (o.camadas as Obj[]).slice(0, 60) : []
  if (!camadas.length) fail(`${where}: o slide livre precisa de "camadas".`)
  for (const [i, c] of camadas.entries()) {
    if (!c || typeof c !== 'object' || !['texto', 'forma', 'imagem', 'grade', 'pontos'].includes(String(c.tipo))) fail(`${where}, camada ${i + 1}: "tipo" é texto, forma, imagem, grade ou pontos.`)
    if (c.tipo === 'texto' && !text(c.texto, 2000).trim()) fail(`${where}, camada ${i + 1}: texto vazio.`)
  }
  return { template: 'livre', fundo: color(o.fundo, '#ffffff'), camadas }
}

/** As camadas do editor a partir do pedido. Imagem do Cérebro vai marcada (`_arquivo`) para virar anexo do conjunto. */
export function buildFree(spec: Obj, format: string, guard?: BrandGuard, notes?: string[]) {
  const size = SIZES[format] ?? SIZES['4x5']
  const layers: Obj[] = []
  const col = (v: unknown, d: string) => guardColor(guard, color(v, d), notes)
  for (const c of (spec.camadas as Obj[]) ?? []) {
    const base = { id: uid(), x: num(c.x, 0), y: num(c.y, 0), w: Math.max(1, num(c.w, size.w, 1)), h: Math.max(1, num(c.h, 100, 1)), ...(c.opacidade !== undefined && { opacity: num(c.opacidade, 1, 0, 1) }), ...(c.rotacao !== undefined && { rotation: num(c.rotacao, 0, -360, 360) }) }
    if (c.tipo === 'texto') {
      const t = text(c.texto, 2000)
      const size_ = num(c.tamanho, 64, 6, 600)
      const lines = t.split('\n').length
      layers.push({
        ...base, type: 'text', name: text(c.nome, 60) || t.replace(/\*/g, '').slice(0, 40) || 'Texto',
        h: c.h !== undefined ? base.h : Math.ceil(size_ * num(c.altura_linha, 1.1, 0.6, 3) * lines + 10),
        text: t, font: guardFont(guard, text(c.fonte, 80) || (guard ? '' : 'Inter'), size_ >= 44 || num(c.peso, 700, 100, 900) >= 600, notes), weight: num(c.peso, 700, 100, 900), size: size_, color: col(c.cor, '#111111'),
        align: c.alinhamento === 'center' || c.alinhamento === 'centro' ? 'center' : c.alinhamento === 'right' || c.alinhamento === 'direita' ? 'right' : 'left',
        lineHeight: num(c.altura_linha, 1.1, 0.6, 3), letterSpacing: num(c.espaco_letras, 0, -0.2, 1),
        ...(c.maiusculas === true && { upper: true }), ...(c.italico === true && { italic: true }),
        ...(/\*[^*]+\*/.test(t) && { emphasis: true, emphasisColor: col(c.destaque_cor, guard?.accent ?? '#2563eb'), emphasisFont: guardFont(guard, text(c.fonte, 80) || (guard ? '' : 'Inter'), size_ >= 44 || num(c.peso, 700, 100, 900) >= 600) }),
      })
    } else if (c.tipo === 'forma') {
      layers.push({ ...base, type: 'rect', name: text(c.nome, 60) || 'Forma', fill: col(c.cor, '#000000'), ...(c.cor2 ? { fill2: col(c.cor2, '#000000'), angle: num(c.angulo, 180, 0, 360) } : {}), radius: num(c.raio, 0, 0, 2000), ...(c.borda ? { stroke: col(c.borda, '#000000'), strokeWidth: num(c.borda_largura, 2, 0, 100) } : {}) })
    } else if (c.tipo === 'imagem') {
      layers.push({ ...base, type: 'image', name: text(c.nome, 60) || 'Imagem', src: typeof c.url === 'string' && /^https:\/\//.test(c.url) ? c.url : '', fit: c.ajuste === 'contain' ? 'contain' : 'cover', radius: num(c.raio, 0, 0, 2000), frame: 'none', ...(typeof c.prompt === 'string' && c.prompt && { prompt: c.prompt.slice(0, 600) }), ...(typeof c.arquivo === 'string' && c.arquivo && { _arquivo: c.arquivo.replace(/^\/+/, '').replace(/^cerebro\//, '') }) })
    } else if (c.tipo === 'pontos') {
      layers.push({ id: uid(), type: 'dots', name: 'Pontos', x: 0, y: 0, w: size.w, h: size.h, color: col(c.cor, '#000000'), gap: num(c.tamanho, 40, 8, 400), dot: num(c.ponto, 3, 1, 40), opacity: num(c.opacidade, 0.15, 0, 1) })
    } else if (c.tipo === 'grade') {
      // Quadriculado: linhas finas como formas, agrupadas (movem e somem juntas no editor)
      const gap = num(c.tamanho, 60, 10, 600)
      const line = num(c.espessura, 2, 1, 20)
      const fill = col(c.cor, '#000000')
      const opacity = num(c.opacidade, 0.08, 0, 1)
      const group = uid()
      for (let x = gap; x < size.w; x += gap) layers.push({ id: uid(), type: 'rect', name: 'Grade', group, x: Math.round(x - line / 2), y: 0, w: line, h: size.h, fill, radius: 0, opacity, locked: true })
      for (let y = gap; y < size.h; y += gap) layers.push({ id: uid(), type: 'rect', name: 'Grade', group, x: 0, y: Math.round(y - line / 2), w: size.w, h: line, fill, radius: 0, opacity, locked: true })
    }
  }
  // Grid do editor: só as camadas pedidas pela IA (a grade e os pontos ocupam o slide inteiro)
  let moved = 0
  for (const l of layers) if (l.type === 'text' || ((l.type === 'rect' || l.type === 'image') && l.name !== 'Grade')) if (fitToGrid(l, format)) moved++
  if (moved) notes?.push(`${moved} camada(s) encaixada(s) no grid (margem de ${gridLines(format).m} px e colunas)`)
  return { id: uid(), background: col(spec.fundo, '#ffffff'), layers }
}

/** Monta o post: os slides de modelo pelo construtor dos Criativos, os livres por `buildFree`, na ordem. */
export function buildMixed(post: { name: string; format: string; caption?: string; slides: Obj[] }, buildPost: (p: unknown) => { slides: Obj[] } & Obj, guard?: BrandGuard, notes?: string[]) {
  const free = post.slides.map((s) => s.template === 'livre')
  if (!free.some(Boolean)) return buildPost(post)
  const holder = post.slides.map((s) => (s.template === 'livre' ? { template: 'manifesto', title: ' ' } : s))
  const built = buildPost({ ...post, slides: holder })
  built.slides = built.slides.map((s, i) => (free[i] ? buildFree(post.slides[i], post.format, guard, notes) : s))
  return built
}
