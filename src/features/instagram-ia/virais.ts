/**
 * Arquivo de virais (o `swipe.py` do instagram-agent-skill, MIT, em português).
 *
 * Views brutas não são prova. Perfil de 2 milhões com 400 mil views teve uma terça fraca; perfil de
 * 4 mil com 400 mil views achou alguma coisa, e essa coisa dá para copiar (a forma, nunca o vídeo).
 * Ordena pelo múltiplo sobre a mediana do PRÓPRIO perfil, dá nome à fórmula do gancho e mostra o
 * que separa o terço de cima do de baixo.
 */
import { classifyHook, scoreHook } from './ganchos.ts'
import { median, round1, words } from './texto.ts'

export interface SwipeInput {
  perfil?: string
  seguidores?: number
  /** Views típicas dos últimos reels do perfil (a base certa). */
  mediana?: number
  views: number
  /** A primeira frase, falada ou na tela, nas palavras do criador. */
  gancho: string
  tela?: string
  segundos?: number
  chamada?: string
  link?: string
}

export interface SwipeRow extends SwipeInput {
  base: number
  multiplo?: number
  formula?: { id: number; nome: string }
  palavras: number
  nota_gancho: number
  veredito_gancho: string
}

export interface Swipe {
  base: 'mediana do perfil' | 'seguidores' | 'mistura'
  n: number
  perfis: number
  reels: SwipeRow[]
  /** Acima de 3x: sinal. */
  fora_da_curva: SwipeRow[]
  formulas_no_topo: Array<{ nome: string; vezes: number; embaixo: number }>
  nota_gancho: { topo: number; baixo: number }
  palavras_gancho: { topo: number; baixo: number }
  sem_formula: number
  confianca: string
}

const num = (v: unknown) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') return undefined
  const t = v.trim().toLowerCase().replace(/\s/g, '')
  const m = /^([\d.,]+)(mil|k|mi|m)?$/.exec(t)
  if (!m) return undefined
  const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return undefined
  return m[2] === 'mil' || m[2] === 'k' ? n * 1000 : m[2] === 'mi' || m[2] === 'm' ? n * 1_000_000 : n
}

/** Aceita a lista do agente (números como "12 mil", "1,2 mi"). */
export function normalizeSwipe(rows: Array<Record<string, unknown>>): SwipeInput[] {
  return rows
    .map((r) => ({
      perfil: typeof r.perfil === 'string' ? r.perfil : undefined,
      seguidores: num(r.seguidores),
      mediana: num(r.mediana),
      views: num(r.views) ?? 0,
      gancho: typeof r.gancho === 'string' ? r.gancho.trim() : '',
      tela: typeof r.tela === 'string' ? r.tela : undefined,
      segundos: num(r.segundos),
      chamada: typeof r.chamada === 'string' ? r.chamada : undefined,
      link: typeof r.link === 'string' ? r.link : undefined,
    }))
    .filter((r) => r.views > 0 && r.gancho)
}

export function rankSwipe(input: SwipeInput[]): Swipe {
  const rows: SwipeRow[] = input.map((r) => {
    const base = r.mediana || r.seguidores || 0
    const s = scoreHook(r.gancho)
    const f = classifyHook(r.gancho)
    return { ...r, base, ...(base ? { multiplo: round1(r.views / base) } : {}), ...(f ? { formula: { id: f.id, nome: f.nome } } : {}), palavras: words(r.gancho).length, nota_gancho: s.nota, veredito_gancho: s.veredito }
  })
  const ranked = [...rows].sort((a, b) => (b.multiplo ?? 0) - (a.multiplo ?? 0))
  const third = Math.max(1, Math.floor(ranked.length / 3))
  const top = ranked.slice(0, third)
  const bottom = ranked.slice(-third)
  const counts = new Map<string, { vezes: number; embaixo: number }>()
  for (const r of top) {
    const k = r.formula?.nome ?? 'sem fórmula'
    counts.set(k, { vezes: (counts.get(k)?.vezes ?? 0) + 1, embaixo: 0 })
  }
  for (const r of bottom) {
    const k = r.formula?.nome ?? 'sem fórmula'
    if (counts.has(k)) counts.get(k)!.embaixo++
  }
  const withMedian = rows.filter((r) => r.mediana).length
  const perfis = new Set(rows.map((r) => r.perfil ?? '')).size
  const n = rows.length
  return {
    base: withMedian === n ? 'mediana do perfil' : withMedian ? 'mistura' : 'seguidores',
    n,
    perfis,
    reels: ranked,
    fora_da_curva: ranked.filter((r) => (r.multiplo ?? 0) >= 3),
    formulas_no_topo: [...counts].map(([nome, c]) => ({ nome, ...c })).sort((a, b) => b.vezes - a.vezes),
    nota_gancho: { topo: round1(median(top.map((r) => r.nota_gancho))), baixo: round1(median(bottom.map((r) => r.nota_gancho))) },
    palavras_gancho: { topo: median(top.map((r) => r.palavras)), baixo: median(bottom.map((r) => r.palavras)) },
    sem_formula: rows.filter((r) => !r.formula).length,
    confianca:
      n >= 40 && perfis >= 6
        ? `${n} reels de ${perfis} perfis: já sustenta uma conclusão.`
        : `${n} reels de ${perfis} perfil(is): é pista, não prova. Com 40 reels de 6 perfis dá para afirmar alguma coisa.`,
  }
}

/** A nota do Cérebro (`instagram/virais.md`): o que a Iara e as skills leem depois. */
export function swipeMarkdown(s: Swipe, titulo = 'Arquivo de virais', data = new Date()) {
  const br = (n: number) => String(n).replace('.', ',')
  const mult = (r: SwipeRow) => (r.multiplo !== undefined ? `${String(r.multiplo).replace('.', ',')}x` : '?')
  const lines = [
    `# ${titulo}`,
    '',
    `**Atualizado:** ${data.toLocaleDateString('pt-BR')} · ${s.n} reels de ${s.perfis} perfis · base: ${s.base}`,
    '',
    `> ${s.confianca}`,
    '',
    '## O que está acima da curva',
    '',
    ...s.formulas_no_topo.slice(0, 5).map((f) => `- **${f.nome}**: ${f.vezes}x no terço de cima${f.embaixo ? `, ${f.embaixo}x no de baixo` : ', 0 no de baixo'}`),
    `- Nota mediana do gancho: ${br(s.nota_gancho.topo)} em cima, ${br(s.nota_gancho.baixo)} embaixo`,
    `- Palavras no gancho (mediana): ${br(s.palavras_gancho.topo)} em cima, ${br(s.palavras_gancho.baixo)} embaixo`,
    `- Sem fórmula: ${s.sem_formula} de ${s.n}. Leia esses à mão: é onde mora uma fórmula que ainda não está na lista.`,
    '',
    '## Os reels',
    '',
    ...s.reels.map((r) => `- **${mult(r)}** · ${r.formula ? `#${r.formula.id} ${r.formula.nome}` : 'sem fórmula'} · ${r.perfil ?? ''} · ${r.views.toLocaleString('pt-BR')} views (base ${r.base ? r.base.toLocaleString('pt-BR') : '?'}) · gancho ${br(r.nota_gancho)}\n  "${r.gancho}"${r.link ? `\n  ${r.link}` : ''}`),
    '',
    'Copie a fórmula, nunca o vídeo: o formato do gancho, a estrutura, a duração, o ritmo dos cortes. Nunca o roteiro, a voz ou a edição de quem fez.',
    '',
  ]
  return lines.join('\n')
}
