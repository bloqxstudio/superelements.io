/**
 * Fluxograma com um clique (2026-11-11, o usuário: "ao usar um bloco de fluxograma, permita com 1 clique,
 * pode ser ao lado do bloco, na bolinha, que já crie um novo conectado igual a esse"). Sem imports, testável
 * no Node: onde o bloco novo entra (ao lado, sem cobrir nada) e quem colaborou numa nota.
 */

export type Dir = 'right' | 'down' | 'left' | 'up'
export interface Box { x: number; y: number; width: number; height: number }

export const DIRS: Dir[] = ['right', 'down', 'left', 'up']
const GAP = 80

const hits = (a: Box, b: Box, pad = 16) =>
  a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad

/**
 * O lugar do bloco novo, do mesmo tamanho, ao lado de `src` na direção pedida. Se já houver algo ali (o segundo
 * "+" para a direita, por exemplo), desce (ou vai para o lado, nas direções verticais) até achar espaço livre,
 * alternando os dois lados do eixo: o fluxo vira uma árvore organizada em vez de empilhar um bloco sobre o outro.
 */
export function nextSpot(src: Box, dir: Dir, others: Box[], gap = GAP): { x: number; y: number } {
  const horizontal = dir === 'right' || dir === 'left'
  const base = {
    x: dir === 'right' ? src.x + src.width + gap : dir === 'left' ? src.x - src.width - gap : src.x,
    y: dir === 'down' ? src.y + src.height + gap : dir === 'up' ? src.y - src.height - gap : src.y,
  }
  const step = horizontal ? src.height + gap / 2 : src.width + gap / 2
  for (let i = 0; i < 24; i++) {
    // 0, +1, -1, +2, -2… passos no eixo perpendicular
    const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2)
    const spot = horizontal ? { x: base.x, y: base.y + k * step } : { x: base.x + k * step, y: base.y }
    if (!others.some((o) => hits({ ...spot, width: src.width, height: src.height }, o))) return spot
  }
  return base
}

/** Quem escreveu numa nota: a foto aparece em cima dela. */
export interface Person { id: string; name: string; avatar?: string; color: string }
export const MAX_PEOPLE = 8

/** A lista com a pessoa (sem repetir; quem já está mantém o lugar, os dados ficam os mais novos). */
export function withPerson(list: Person[] | undefined, p: Person): Person[] {
  const cur = Array.isArray(list) ? list.filter((x) => x && typeof x.id === 'string') : []
  const i = cur.findIndex((x) => x.id === p.id)
  if (i >= 0) {
    const same = cur[i].name === p.name && cur[i].avatar === p.avatar && cur[i].color === p.color
    return same ? (cur.length === list!.length ? list! : cur) : cur.map((x, j) => (j === i ? p : x))
  }
  return [...cur, p].slice(-MAX_PEOPLE)
}

export const withoutPerson = (list: Person[] | undefined, id: string): Person[] => (Array.isArray(list) ? list.filter((x) => x.id !== id) : [])
