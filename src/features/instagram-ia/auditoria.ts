/**
 * O que funcionou (o `/ig-audit` do instagram-agent-skill, MIT), sobre os posts reais da conta
 * conectada (CRM › Instagram, números da Meta). Nada de views brutas: múltiplo sobre a mediana da
 * própria conta, envios por alcance (o sinal mais forte que dá para ganhar), salvos por alcance,
 * seguidores por alcance e tempo médio assistido nos reels.
 *
 * A Meta não dá o gancho falado nem a retenção aos 3 s por post: o gancho aqui é a primeira linha
 * da legenda (aproximação, e a auditoria diz isso).
 */
import { classifyHook } from './ganchos.ts'
import { mean, median, round1 } from './texto.ts'

export interface AuditPostInput {
  id: string
  /** IMAGE, VIDEO, CAROUSEL_ALBUM */
  type: string
  product?: string
  caption?: string
  permalink?: string
  postedAt: number
  likes?: number
  comments?: number
  insights: { reach?: number; views?: number; shares?: number; saved?: number; follows?: number; total_interactions?: number; ig_reels_avg_watch_time?: number; likes?: number; comments?: number }
}

export type AuditFormat = 'reels' | 'carrossel' | 'foto'
const formatOf = (p: AuditPostInput): AuditFormat | 'story' => (p.product === 'STORY' ? 'story' : p.product === 'REELS' || p.type === 'VIDEO' ? 'reels' : p.type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'foto')
const FORMAT_LABEL: Record<AuditFormat, string> = { reels: 'Reels', carrossel: 'Carrossel', foto: 'Foto' }

export interface AuditRow {
  id: string
  formato: AuditFormat
  data: string
  link?: string
  primeira_linha: string
  formula?: { id: number; nome: string }
  views: number
  alcance?: number
  multiplo: number
  /** Por mil de alcance. */
  envios_mil?: number
  salvos_mil?: number
  seguidores_mil?: number
  assistido_s?: number
  envios: number
  salvos: number
}

export interface AuditFinding {
  texto: string
  confianca: 'alta' | 'média' | 'baixa'
}

export interface Audit {
  n: number
  periodo: string
  mediana_views: number
  base: string
  topo: AuditRow[]
  baixo: AuditRow[]
  por_formato: Array<{ formato: string; posts: number; multiplo_medio: number; envios_mil?: number; salvos_mil?: number }>
  por_formula: Array<{ nome: string; posts: number; multiplo_medio: number }>
  achados: AuditFinding[]
  parar?: string
  fazer_mais?: string
  aviso: string
}

const per1k = (x: number | undefined, reach: number | undefined) => (reach && x !== undefined ? round1((x * 1000) / reach) : undefined)
const day = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const firstLine = (c?: string) => (c ?? '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 140) ?? ''
const confidence = (n: number): AuditFinding['confianca'] => (n >= 8 ? 'alta' : n >= 4 ? 'média' : 'baixa')

/**
 * `posts`: os da conta (os stories ficam de fora: somem em 24 h e se medem de outro jeito).
 * O múltiplo é sobre a mediana do mesmo formato quando ele tem 5 posts ou mais (reels e foto têm
 * escalas diferentes); senão, sobre a mediana da conta.
 */
export function auditPosts(all: AuditPostInput[], opts: { dias?: number; agora?: number } = {}): Audit | null {
  const now = opts.agora ?? Date.now()
  const since = opts.dias ? now - opts.dias * 86_400_000 : 0
  const posts = all.filter((p) => formatOf(p) !== 'story' && p.postedAt >= since && (p.insights.views ?? p.insights.reach))
  if (!posts.length) return null
  const viewsOf = (p: AuditPostInput) => p.insights.views ?? p.insights.reach ?? 0
  const overall = median(posts.map(viewsOf))
  const byFormat = new Map<AuditFormat, AuditPostInput[]>()
  for (const p of posts) {
    const f = formatOf(p) as AuditFormat
    byFormat.set(f, [...(byFormat.get(f) ?? []), p])
  }
  const formatMedian = new Map([...byFormat].map(([f, list]) => [f, list.length >= 5 ? median(list.map(viewsOf)) : overall]))

  const rows: AuditRow[] = posts.map((p) => {
    const f = formatOf(p) as AuditFormat
    const views = viewsOf(p)
    const reach = p.insights.reach
    const line = firstLine(p.caption)
    const formula = line ? classifyHook(line) : undefined
    return {
      id: p.id,
      formato: f,
      data: day(p.postedAt),
      ...(p.permalink ? { link: p.permalink } : {}),
      primeira_linha: line,
      ...(formula ? { formula: { id: formula.id, nome: formula.nome } } : {}),
      views,
      ...(reach ? { alcance: reach } : {}),
      multiplo: round1(views / (formatMedian.get(f) || overall || 1)),
      envios: p.insights.shares ?? 0,
      salvos: p.insights.saved ?? 0,
      ...(per1k(p.insights.shares, reach) !== undefined ? { envios_mil: per1k(p.insights.shares, reach) } : {}),
      ...(per1k(p.insights.saved, reach) !== undefined ? { salvos_mil: per1k(p.insights.saved, reach) } : {}),
      ...(p.insights.follows !== undefined && reach ? { seguidores_mil: per1k(p.insights.follows, reach) } : {}),
      ...(p.insights.ig_reels_avg_watch_time ? { assistido_s: round1(p.insights.ig_reels_avg_watch_time / 1000) } : {}),
    }
  })

  // Ordena pelo múltiplo e, no empate, pelos envios por alcance
  const ranked = [...rows].sort((a, b) => b.multiplo - a.multiplo || (b.envios_mil ?? 0) - (a.envios_mil ?? 0))
  const k = Math.min(5, Math.max(1, Math.floor(ranked.length / 3)))
  const topo = ranked.slice(0, k)
  const baixo = ranked.slice(-k).reverse()

  const por_formato = [...byFormat.keys()].map((f) => {
    const list = rows.filter((r) => r.formato === f)
    const env = list.map((r) => r.envios_mil).filter((x): x is number => x !== undefined)
    const sav = list.map((r) => r.salvos_mil).filter((x): x is number => x !== undefined)
    return { formato: FORMAT_LABEL[f], posts: list.length, multiplo_medio: round1(mean(list.map((r) => r.multiplo))), ...(env.length ? { envios_mil: round1(mean(env)) } : {}), ...(sav.length ? { salvos_mil: round1(mean(sav)) } : {}) }
  })
  const formulaMap = new Map<string, AuditRow[]>()
  for (const r of rows) {
    const key = r.formula ? `#${r.formula.id} ${r.formula.nome}` : 'sem fórmula na 1ª linha'
    formulaMap.set(key, [...(formulaMap.get(key) ?? []), r])
  }
  const por_formula = [...formulaMap].map(([nome, list]) => ({ nome, posts: list.length, multiplo_medio: round1(mean(list.map((r) => r.multiplo))) })).sort((a, b) => b.multiplo_medio - a.multiplo_medio)

  const achados: AuditFinding[] = []
  const rest = (pred: (r: AuditRow) => boolean) => {
    const a = rows.filter(pred)
    const b = rows.filter((r) => !pred(r))
    return { a, b, ma: mean(a.map((r) => r.multiplo)), mb: mean(b.map((r) => r.multiplo)) }
  }
  // Formato
  if (por_formato.length > 1) {
    const best = [...por_formato].sort((a, b) => b.multiplo_medio - a.multiplo_medio)
    if (best[0].multiplo_medio >= best[best.length - 1].multiplo_medio * 1.5)
      achados.push({ texto: `${best[0].formato} rende ${String(best[0].multiplo_medio).replace('.', ',')}x a mediana; ${best[best.length - 1].formato}, ${String(best[best.length - 1].multiplo_medio).replace('.', ',')}x (n=${best[0].posts} e ${best[best.length - 1].posts}).`, confianca: confidence(Math.min(best[0].posts, best[best.length - 1].posts)) })
  }
  // Fórmula da primeira linha
  const named = por_formula.filter((f) => !f.nome.startsWith('sem') && f.posts >= 2)
  if (named.length) {
    const f = named[0]
    const { mb } = rest((r) => (r.formula ? `#${r.formula.id} ${r.formula.nome}` : '') === f.nome)
    if (f.multiplo_medio > mb * 1.3) achados.push({ texto: `Posts que abrem com a fórmula ${f.nome}: ${String(f.multiplo_medio).replace('.', ',')}x contra ${String(round1(mb)).replace('.', ',')}x do resto (n=${f.posts}).`, confianca: confidence(f.posts) })
  }
  // Número na primeira linha
  {
    const { a, b, ma, mb } = rest((r) => /\d/.test(r.primeira_linha))
    if (a.length >= 2 && b.length >= 2 && Math.abs(ma - mb) >= 0.3) achados.push({ texto: `Primeira linha com número: ${String(round1(ma)).replace('.', ',')}x; sem número: ${String(round1(mb)).replace('.', ',')}x (n=${a.length} e ${b.length}).`, confianca: confidence(Math.min(a.length, b.length)) })
  }
  // Views sem envio: alcance que não vira nada
  const viewsNoSends = topo.filter((r) => (r.envios_mil ?? 0) < 1 && r.multiplo >= 1.5)
  if (viewsNoSends.length >= 2) achados.push({ texto: `${viewsNoSends.length} dos melhores em views quase não foram enviados (menos de 1 envio a cada mil de alcance): alcance que não vira recomendação.`, confianca: 'média' })
  // Perfil × gancho
  const follows = rows.filter((r) => r.seguidores_mil !== undefined)
  if (follows.length >= 4) {
    const hi = follows.filter((r) => r.multiplo >= 1.5)
    if (hi.length >= 2 && mean(hi.map((r) => r.seguidores_mil ?? 0)) < 1)
      achados.push({ texto: 'Os posts que mais rodam quase não trazem seguidor (menos de 1 a cada mil de alcance). Isso é problema de perfil, não de gancho: rode a análise de perfil antes de reescrever ganchos.', confianca: confidence(hi.length) })
  }
  // Dia da semana por último, e só se nada mais apareceu
  if (!achados.length) achados.push({ texto: 'Nada separa claramente os melhores dos piores nesta amostra. Dia e horário quase nunca são a causa: olhe primeiro o gancho e o formato.', confianca: 'baixa' })

  const worstFormat = [...por_formato].sort((a, b) => a.multiplo_medio - b.multiplo_medio)[0]
  const bestFormula = named[0]
  const dates = posts.map((p) => p.postedAt)
  return {
    n: rows.length,
    periodo: `${day(Math.min(...dates))} a ${day(Math.max(...dates))}`,
    mediana_views: Math.round(overall),
    base: [...byFormat].some(([, l]) => l.length >= 5) ? 'mediana do mesmo formato (quando tem 5 posts ou mais), senão da conta' : 'mediana da conta',
    topo,
    baixo,
    por_formato,
    por_formula,
    achados,
    ...(por_formato.length > 1 && worstFormat.multiplo_medio < 0.8 ? { parar: `${worstFormat.formato} (${String(worstFormat.multiplo_medio).replace('.', ',')}x a mediana)` } : {}),
    ...(bestFormula && bestFormula.multiplo_medio >= 1.3 ? { fazer_mais: `${bestFormula.nome} (${String(bestFormula.multiplo_medio).replace('.', ',')}x)` } : {}),
    aviso:
      (rows.length < 12 ? `Só ${rows.length} posts: dá para ver pista, não padrão. ` : '') +
      'A fórmula é lida na primeira linha da legenda (a Meta não entrega o gancho falado nem a retenção aos 3 s por post; a retenção fica no app do Instagram).',
  }
}
