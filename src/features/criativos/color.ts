/** Cores: o que o degradê precisa para sumir sem sujar (o mesmo RGB com alfa 0). */

const parse = (value: string): [number, number, number, number] | undefined => {
  const v = value.trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(v)
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1) as [number, number, number, number]
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v)
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1]
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])]
  return undefined
}

/** A mesma cor com outra opacidade: `alpha('#111111', 0)` é o "transparente" que combina com ela num degradê. */
export function alpha(color: string, a: number): string {
  const c = parse(color)
  if (!c) return `rgba(0, 0, 0, ${a})`
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.round(a * 1000) / 1000})`
}
