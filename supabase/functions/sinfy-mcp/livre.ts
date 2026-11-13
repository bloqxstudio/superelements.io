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
 *   {"tipo":"imagem","x","y","w","h","arquivo"? (Cérebro) |"url"?|"prompt"? (gerar no editor),"ajuste"?:"cover"|"contain","raio"?}
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
export function buildFree(spec: Obj, format: string) {
  const size = SIZES[format] ?? SIZES['4x5']
  const layers: Obj[] = []
  for (const c of (spec.camadas as Obj[]) ?? []) {
    const base = { id: uid(), x: num(c.x, 0), y: num(c.y, 0), w: Math.max(1, num(c.w, size.w, 1)), h: Math.max(1, num(c.h, 100, 1)), ...(c.opacidade !== undefined && { opacity: num(c.opacidade, 1, 0, 1) }), ...(c.rotacao !== undefined && { rotation: num(c.rotacao, 0, -360, 360) }) }
    if (c.tipo === 'texto') {
      const t = text(c.texto, 2000)
      const size_ = num(c.tamanho, 64, 6, 600)
      const lines = t.split('\n').length
      layers.push({
        ...base, type: 'text', name: text(c.nome, 60) || t.replace(/\*/g, '').slice(0, 40) || 'Texto',
        h: c.h !== undefined ? base.h : Math.ceil(size_ * num(c.altura_linha, 1.1, 0.6, 3) * lines + 10),
        text: t, font: text(c.fonte, 80) || 'Inter', weight: num(c.peso, 700, 100, 900), size: size_, color: color(c.cor, '#111111'),
        align: c.alinhamento === 'center' || c.alinhamento === 'centro' ? 'center' : c.alinhamento === 'right' || c.alinhamento === 'direita' ? 'right' : 'left',
        lineHeight: num(c.altura_linha, 1.1, 0.6, 3), letterSpacing: num(c.espaco_letras, 0, -0.2, 1),
        ...(c.maiusculas === true && { upper: true }), ...(c.italico === true && { italic: true }),
        ...(/\*[^*]+\*/.test(t) && { emphasis: true, emphasisColor: color(c.destaque_cor, '#2563eb'), emphasisFont: text(c.fonte, 80) || 'Inter' }),
      })
    } else if (c.tipo === 'forma') {
      layers.push({ ...base, type: 'rect', name: text(c.nome, 60) || 'Forma', fill: color(c.cor, '#000000'), ...(c.cor2 ? { fill2: color(c.cor2, '#000000'), angle: num(c.angulo, 180, 0, 360) } : {}), radius: num(c.raio, 0, 0, 2000), ...(c.borda ? { stroke: color(c.borda, '#000000'), strokeWidth: num(c.borda_largura, 2, 0, 100) } : {}) })
    } else if (c.tipo === 'imagem') {
      layers.push({ ...base, type: 'image', name: text(c.nome, 60) || 'Imagem', src: typeof c.url === 'string' && /^https:\/\//.test(c.url) ? c.url : '', fit: c.ajuste === 'contain' ? 'contain' : 'cover', radius: num(c.raio, 0, 0, 2000), frame: 'none', ...(typeof c.prompt === 'string' && c.prompt && { prompt: c.prompt.slice(0, 600) }), ...(typeof c.arquivo === 'string' && c.arquivo && { _arquivo: c.arquivo.replace(/^\/+/, '').replace(/^cerebro\//, '') }) })
    } else if (c.tipo === 'pontos') {
      layers.push({ id: uid(), type: 'dots', name: 'Pontos', x: 0, y: 0, w: size.w, h: size.h, color: color(c.cor, '#000000'), gap: num(c.tamanho, 40, 8, 400), dot: num(c.ponto, 3, 1, 40), opacity: num(c.opacidade, 0.15, 0, 1) })
    } else if (c.tipo === 'grade') {
      // Quadriculado: linhas finas como formas, agrupadas (movem e somem juntas no editor)
      const gap = num(c.tamanho, 60, 10, 600)
      const line = num(c.espessura, 2, 1, 20)
      const fill = color(c.cor, '#000000')
      const opacity = num(c.opacidade, 0.08, 0, 1)
      const group = uid()
      for (let x = gap; x < size.w; x += gap) layers.push({ id: uid(), type: 'rect', name: 'Grade', group, x: Math.round(x - line / 2), y: 0, w: line, h: size.h, fill, radius: 0, opacity, locked: true })
      for (let y = gap; y < size.h; y += gap) layers.push({ id: uid(), type: 'rect', name: 'Grade', group, x: 0, y: Math.round(y - line / 2), w: size.w, h: line, fill, radius: 0, opacity, locked: true })
    }
  }
  return { id: uid(), background: color(spec.fundo, '#ffffff'), layers }
}

/** Monta o post: os slides de modelo pelo construtor dos Criativos, os livres por `buildFree`, na ordem. */
export function buildMixed(post: { name: string; format: string; caption?: string; slides: Obj[] }, buildPost: (p: unknown) => { slides: Obj[] } & Obj) {
  const free = post.slides.map((s) => s.template === 'livre')
  if (!free.some(Boolean)) return buildPost(post)
  const holder = post.slides.map((s) => (s.template === 'livre' ? { template: 'manifesto', title: ' ' } : s))
  const built = buildPost({ ...post, slides: holder })
  built.slides = built.slides.map((s, i) => (free[i] ? buildFree(post.slides[i], post.format) : s))
  return built
}
