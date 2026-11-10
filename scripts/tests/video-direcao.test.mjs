import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SCENE_SYSTEM_BASE, VIDEO_STYLES, buildChecklist, buildSceneRequest, directionSummary, parseCheck, parseReading, parseShots, planCopy, wants3d,
} from '../../src/features/criativos/videoDirection.ts'

// A direção do vídeo (2026-11-10): "tá viciada num modelo, sempre gerando o mesmo formato e não seguindo as regras"

const plan = (patch = {}) => ({
  how: 'igual', topic: '', copy: '', rules: '', style: 'livre', shots: [], background: 'referencia',
  logo: 'escuro', logoPlace: 'fecho', narrate: true, voice: { voice: 'marin', tone: 'reels' }, captions: { style: 'pop', y: 0.8 }, ...patch,
})
const shots = [
  { fala: 'Seu site perde cliente.', tela: 'um funil vazando', texto: '', transicao: 'continua', start: 0, end: 3 },
  { fala: 'A Avence resolve.', tela: 'o funil se fecha', texto: 'Resolve', transicao: 'corte', start: 3, end: 6 },
]

test('o sistema e o contrato não trazem estética pronta; o estilo é um pacote opcional', () => {
  const base = SCENE_SYSTEM_BASE.join('\n')
  for (const vicio of [/tipografia gigante/i, /squash/i, /clarão/i, /app de comida/i, /quique/i]) assert.doesNotMatch(base, vicio)
  assert.match(VIDEO_STYLES.comercial.rules, /squash/)
  assert.match(VIDEO_STYLES.objetos.rules, /empilhamento/)
  assert.equal(VIDEO_STYLES.livre.rules, '')
  const src = readFileSync(new URL('../../src/features/criativos/scene.ts', import.meta.url), 'utf8')
  const contract = src.slice(src.indexOf('export const SCENE_CONTRACT ='), src.indexOf('export const SCENE_CONTRACT_3D'))
  assert.doesNotMatch(contract, /Linguagem publicitária|títulos gigantes|lib\.d3/)
  assert.match(src, /export const SCENE_CONTRACT_3D = `- lib\.d3/)
})

test('o 3D só entra quando escolhido, pedido ou já usado', () => {
  assert.equal(wants3d({ request: 'uma plataforma com componente conectado' }), false)
  assert.equal(wants3d({ request: 'Refaz este vídeo em 3D' }), true)
  assert.equal(wants3d({ style: '3d', request: '' }), true)
  assert.equal(wants3d({ request: 'mais rápido', code: 'lib.d3.run(ctx)' }), true)
})

test('o pedido segue a ordem de autoridade e não força título', () => {
  const req = buildSceneRequest({ plan: plan({ rules: '- sem título em caixa alta\nfundo branco' }), shots, duration: 7.8, narrated: true, frames: 6, brandHex: '#2B3CF0' })
  const order = ['## 1. Regras', '## 2. Decupagem', '## 3. A referência', '## 4. Estilo'].map((h) => req.indexOf(h))
  assert.ok(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), 'seções fora de ordem')
  assert.match(req, /- sem título em caixa alta\n- fundo branco/)
  assert.match(req, /Cena 1 · 0\.0s–3\.0s[\s\S]*texto na tela: NENHUM/)
  assert.match(req, /texto na tela: "Resolve" \(exatamente isto\)/)
  assert.match(req, /só no fecho/)
  assert.doesNotMatch(req, /rótulo de cada parte como título|caixa alta com espaçamento|queda com gravidade/)
  assert.match(req, /Nenhum pacote de estilo/)
})

test('sem referência, o pedido manda não repetir os últimos vídeos', () => {
  const req = buildSceneRequest({ plan: plan(), shots, duration: 7, narrated: true, frames: 0, brandHex: '', history: ['"Copos": estilo objetos'] })
  assert.match(req, /## Não repita[\s\S]*"Copos"/)
  const comRef = buildSceneRequest({ plan: plan(), shots, duration: 7, narrated: true, frames: 4, brandHex: '', history: ['x'] })
  assert.doesNotMatch(comRef, /Não repita/)
})

test('a lista de conferência traz as regras, o logo, o texto de cada cena e a faixa da legenda', () => {
  const list = buildChecklist(plan({ rules: 'mostrar o WhatsApp na cena 2' }), shots, '#000000')
  assert.equal(list[0], 'mostrar o WhatsApp na cena 2')
  assert.ok(list.some((c) => /Cena 1 .*nenhum texto escrito/.test(c)))
  assert.ok(list.some((c) => /Cena 2 .*"Resolve"/.test(c)))
  assert.ok(list.some((c) => /faixa entre 73% e 87%/.test(c)))
  const cin = buildChecklist(plan({ style: 'cinetico' }), shots, '')
  assert.ok(!cin.some((c) => /legenda/.test(c)))
})

test('leitura das respostas da IA', () => {
  const r = parseReading({ cenas: 5, texto: 'nenhum', ritmo: 'x', resumo: 'objetos de vidro sobre fundo preto' })
  assert.equal(r.texto, 'nenhum')
  assert.equal(r.ritmo, 'medio')
  assert.equal(parseReading({}), undefined)
  const s = parseShots([{ fala: 'a', quadro: 3, transicao: 'zoom' }, { fala: '' }, { fala: 'b', quadro: 99 }], 6)
  assert.equal(s.length, 2)
  assert.equal(s[0].ref, 3)
  assert.equal(s[1].ref, undefined)
  assert.equal(s[1].transicao, 'continua')
  assert.equal(planCopy({ shots: s, copy: 'ignorada' }), 'a b')
  assert.deepEqual(parseCheck('```json\n{"ok": true, "problemas": []}\n```'), { ok: true, problems: [] })
  assert.deepEqual(parseCheck('{"ok": true, "problemas": ["Cena 1: tire o título"]}'), { ok: false, problems: ['Cena 1: tire o título'] })
  assert.match(directionSummary({ style: 'objetos', shots, background: 'escuro' }), /estilo objetos e física; cenas: um funil vazando \/ o funil se fecha/)
})
