/**
 * Aprendizados da operação de volta ao Cérebro (nova jornada de criação, Fase 4, 2026-11-09: "o que
 * funcionou volta para o Cérebro"). Uma nota por mês, `aprendizados/AAAA-MM.md`, montada só com fatos
 * do banco (sem IA, nada inventado): os posts do Instagram que mais engajaram nos últimos 30 dias, o que
 * o cliente pediu para ajustar e como andou a aprovação. O contexto da conta (`accountContext`) leva a
 * nota mais recente para toda criação. Sem imports: roda no navegador e nos testes do Node.
 */

export interface LearningPost {
  caption: string
  permalink?: string
  postedAt: string
  kind: string
  likes: number
  comments: number
  saved: number
  shares: number
  reach: number
}

export interface LearningComment { title: string; body: string; at: string }

export interface LearningFacts {
  /** `AAAA-MM` */
  month: string
  posts: LearningPost[]
  clientComments: LearningComment[]
  approved: number
  adjusted: number
}

export const learningsPath = (month: string) => `aprendizados/${month}.md`
export const LEARNINGS_DIR = 'aprendizados'

/** Engajamento de um post: interações que custam mais pesam mais (salvar e compartilhar). */
export const engagement = (p: LearningPost) => p.likes + 2 * p.comments + 3 * p.saved + 3 * p.shares

const firstLine = (s: string, n = 90) => {
  const line = s.split('\n').map((l) => l.trim()).find(Boolean) ?? '(sem legenda)'
  return line.length > n ? `${line.slice(0, n)}…` : line
}

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`

const KIND: Record<string, string> = { REELS: 'Reels', CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Post', VIDEO: 'Vídeo' }

export function learningsNote(f: LearningFacts): string {
  const top = [...f.posts].sort((a, b) => engagement(b) - engagement(a)).slice(0, 5).filter((p) => engagement(p) > 0)
  const byKind = new Map<string, { n: number; eng: number }>()
  for (const p of f.posts) {
    const k = KIND[p.kind] ?? p.kind
    const cur = byKind.get(k) ?? { n: 0, eng: 0 }
    byKind.set(k, { n: cur.n + 1, eng: cur.eng + engagement(p) })
  }
  const kinds = [...byKind.entries()].filter(([, v]) => v.n > 0).map(([k, v]) => ({ k, n: v.n, avg: Math.round(v.eng / v.n) })).sort((a, b) => b.avg - a.avg)
  const decided = f.approved + f.adjusted

  const lines = [
    `# Aprendizados de ${f.month}`,
    '',
    '> Montado sozinho a partir dos números da conta (Instagram e aprovações dos últimos 30 dias). Vai junto em toda criação da IA. Pode acrescentar observações abaixo.',
    '',
    '## O que mais engajou no Instagram',
    ...(top.length
      ? top.map((p, i) => `${i + 1}. ${KIND[p.kind] ?? p.kind} de ${p.postedAt}: "${firstLine(p.caption)}" · ${n(p.likes, 'curtida', 'curtidas')}, ${n(p.comments, 'comentário', 'comentários')}, ${n(p.saved, 'salvamento', 'salvamentos')}, ${n(p.shares, 'compartilhamento', 'compartilhamentos')}${p.reach ? `, alcance ${p.reach}` : ''}${p.permalink ? ` · ${p.permalink}` : ''}`)
      : ['Sem posts com números nos últimos 30 dias (o Instagram está conectado?).']),
    ...(kinds.length > 1 ? ['', `Formato com mais engajamento por post: ${kinds.map((k) => `${k.k} (${k.avg} em média, ${k.n} post${k.n === 1 ? '' : 's'})`).join(' · ')}.`] : []),
    '',
    '## O que o cliente pediu para ajustar',
    ...(f.clientComments.length ? f.clientComments.slice(0, 12).map((c) => `- ${c.at} · ${c.title}: ${c.body.replace(/\s+/g, ' ').slice(0, 220)}`) : ['Nenhum pedido de ajuste do cliente no período.']),
    '',
    '## Aprovação',
    decided ? `${f.approved} de ${decided} peças aprovadas pelo cliente de primeira (${Math.round((f.approved / decided) * 100)}%); ${f.adjusted} voltaram com ajuste.` : 'Nenhuma peça decidida pelo cliente no período.',
  ]
  return lines.join('\n') + '\n'
}

/** Só o essencial da nota para ir no contexto da IA (sem o aviso do topo). */
export const learningsForContext = (md: string) => md.replace(/^> .*\n\n?/m, '').trim()
