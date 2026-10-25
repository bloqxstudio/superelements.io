import { BR_PROJECTION } from './brazilShapes'

/**
 * Os estados do Brasil para o mapa do painel Site: siglas, nomes, o centro de
 * cada um (para pôr a bolha de quem não tem cidade) e a projeção do mapa. O
 * nome do estado chega de três jeitos (a MaxMind manda a sigla, a Meta manda
 * "Rio Grande do Sul" ou "Sao Paulo (state)"), e `ufOf` acha a sigla em todos.
 */

export const UF_NAME: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
}

const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\((state|estado)\)/g, '')
    .replace(/^(state of|estado d[eoa]s?)\s+/, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const BY_NAME = new Map<string, string>([
  ...Object.entries(UF_NAME).map(([uf, name]) => [plain(name), uf] as [string, string]),
  ['federal district', 'DF'],
  ['brasilia', 'DF'],
])

/** `RS`, `Rio Grande do Sul`, `Sao Paulo (state)`, `Federal District` viram a sigla; o resto, `undefined`. */
export function ufOf(value: string | null | undefined) {
  if (!value) return undefined
  const code = value.trim().toUpperCase().replace(/^BR-/, '')
  if (UF_NAME[code]) return code
  return BY_NAME.get(plain(value))
}

/** O plano do mapa: equirretangular com o cosseno de −15° (o mesmo de `scripts/crm/brazil-map.mjs`). */
const COS = Math.cos((BR_PROJECTION.lat0 * Math.PI) / 180)
export function projectBr(lat: number, lon: number): [number, number] {
  return [(lon - BR_PROJECTION.lon0) * COS * BR_PROJECTION.k, (BR_PROJECTION.lat0 - lat) * BR_PROJECTION.k]
}

/** O estado fica no Brasil? (para o mapa não desenhar quem está fora) */
export const inBrazil = (lat: number, lon: number) => lat < 6 && lat > -34.5 && lon > -74.5 && lon < -28
