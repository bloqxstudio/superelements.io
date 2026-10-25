// O contorno dos estados do Brasil para o mapa do painel Site (CRM › Site):
// lê a malha do IBGE (qualidade mínima, um polígono por UF), projeta no plano
// do mapa (`projectBr` em src/features/crm/siteGeo.ts), simplifica e grava
// `src/features/crm/brazilShapes.ts`.
//
//   node scripts/crm/brazil-map.mjs [arquivo.json]
//
// Sem arquivo, baixa de servicodados.ibge.gov.br. A projeção é a de
// `siteGeo.ts` (equirretangular com o cosseno de −15°): mudando uma, mude a outra.
import fs from 'node:fs'
import path from 'node:path'

const IBGE = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF'
const OUT = path.resolve('src/features/crm/brazilShapes.ts')

const LON0 = -54
const LAT0 = -15
const K = 25
const COS = Math.cos((LAT0 * Math.PI) / 180)
const TOLERANCE = 0.7

const UF = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL',
  28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
}

const project = ([lon, lat]) => [(lon - LON0) * COS * K, (LAT0 - lat) * K]

/** Douglas-Peucker num anel já projetado */
function simplify(points, tolerance) {
  if (points.length < 4) return points
  const keep = new Uint8Array(points.length)
  // O anel fecha no primeiro ponto: parte no ponto mais longe dele
  let split = 1
  for (let i = 1; i < points.length - 1; i++) {
    if (Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]) > Math.hypot(points[split][0] - points[0][0], points[split][1] - points[0][1])) split = i
  }
  keep[0] = keep[split] = keep[points.length - 1] = 1
  const stack = [
    [0, split],
    [split, points.length - 1],
  ]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = points[a]
    const [bx, by] = points[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let far = -1
    let index = -1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len
      if (d > far) {
        far = d
        index = i
      }
    }
    if (far > tolerance) {
      keep[index] = 1
      stack.push([a, index], [index, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

const r1 = (n) => Math.round(n * 10) / 10

function ringPath(ring) {
  const pts = simplify(ring.map(project), TOLERANCE)
  if (pts.length < 3) return ''
  return `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z`
}

/** Centro de massa do anel (para o rótulo da UF) */
function centroid(ring) {
  const pts = ring.map(project)
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    area += f
    cx += (pts[j][0] + pts[i][0]) * f
    cy += (pts[j][1] + pts[i][1]) * f
  }
  area /= 2
  return { area: Math.abs(area), x: cx / (6 * area), y: cy / (6 * area) }
}

const raw = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await (await fetch(IBGE)).text()
const geo = JSON.parse(raw)

const states = []
let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity
for (const feature of geo.features) {
  const uf = UF[Number(feature.properties?.codarea)]
  if (!uf) throw new Error(`UF desconhecida: ${feature.properties?.codarea}`)
  const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates]
  let d = ''
  let best = { area: -1, x: 0, y: 0 }
  let box = [Infinity, Infinity, -Infinity, -Infinity]
  for (const polygon of polygons) {
    for (const ring of polygon) d += ringPath(ring)
    const c = centroid(polygon[0])
    if (c.area > best.area) best = c
    for (const p of polygon[0].map(project)) {
      box = [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])]
    }
  }
  minX = Math.min(minX, box[0])
  minY = Math.min(minY, box[1])
  maxX = Math.max(maxX, box[2])
  maxY = Math.max(maxY, box[3])
  states.push({ uf, d, cx: r1(best.x), cy: r1(best.y), box: box.map(r1) })
}
states.sort((a, b) => a.uf.localeCompare(b.uf))

const pad = 12
const viewBox = [r1(minX - pad), r1(minY - pad), r1(maxX - minX + pad * 2), r1(maxY - minY + pad * 2)]

const body = `/**
 * Os estados do Brasil desenhados no plano do mapa do painel Site. Gerado por
 * \`node scripts/crm/brazil-map.mjs\` a partir da malha do IBGE (qualidade
 * mínima); não editar à mão. A projeção está em \`siteGeo.ts\` (\`projectBr\`).
 */

export const BR_PROJECTION = { lon0: ${LON0}, lat0: ${LAT0}, k: ${K} }

/** x, y, largura, altura */
export const BR_VIEWBOX: [number, number, number, number] = ${JSON.stringify(viewBox)}

export interface BrShape {
  uf: string
  /** Contorno em SVG */
  d: string
  /** Onde vai a sigla */
  cx: number
  cy: number
  /** Caixa do estado: x0, y0, x1, y1 (para aproximar o mapa) */
  box: [number, number, number, number]
}

export const BR_SHAPES: BrShape[] = [
${states.map((s) => `  { uf: '${s.uf}', cx: ${s.cx}, cy: ${s.cy}, box: ${JSON.stringify(s.box)}, d: '${s.d}' },`).join('\n')}
]
`
fs.writeFileSync(OUT, body)
console.log(`${OUT}: ${states.length} estados, ${(body.length / 1024).toFixed(1)} KB, viewBox ${viewBox.join(' ')}`)
