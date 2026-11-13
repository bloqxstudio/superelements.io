import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { editsFolder, phrases, speechSpans, srtOf, wavOf, silent } from '../../src/features/criativos/editsFormat.ts'

test('pasta do Edits: sem acento, só [a-z0-9-], com o id, igual à função sinfy-mcp', () => {
  assert.equal(editsFolder({ id: 'Ab12cd34', name: 'Curiosidade: BMW 1250 GS — é verdade?' }), 'curiosidade-bmw-1250-gs-e-verdade-ab12cd34')
  assert.equal(editsFolder({ id: 'x1', name: '!!!' }), 'video-x1')
  assert.ok(editsFolder({ id: 'z9', name: 'a'.repeat(200) }).length <= 80)
  const fn = readFileSync(new URL('../../supabase/functions/sinfy-mcp/index.ts', import.meta.url), 'utf8')
  const body = (src) => src.match(/const base = scene\.name[^\n]+\n[^\n]+\n[^\n]+/)[0]
  assert.equal(body(fn), body(readFileSync(new URL('../../src/features/criativos/editsFormat.ts', import.meta.url), 'utf8')))
})

test('legenda: frases curtas quebrando em pausa e pontuação, SRT válido', () => {
  const w = (t, s, e) => ({ w: t, s, e })
  const words = [w('Você', 0, 0.3), w('sabia', 0.3, 0.6), w('disso?', 0.6, 1), w('A', 1.1, 1.2), w('moto', 1.2, 1.5), w('tem', 2.5, 2.7), w('dois', 2.7, 2.9), w('cilindros', 2.9, 3.4)]
  const lines = phrases(words)
  assert.deepEqual(lines.map((l) => l.text), ['Você sabia disso?', 'A moto', 'tem dois cilindros'])
  const srt = srtOf(lines)
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,000\nVocê sabia disso\?\n/)
  assert.match(srt, /3\n00:00:02,500 --> 00:00:03,400\ntem dois cilindros\n/)
  assert.deepEqual(speechSpans(words), [{ inicio: 0, fim: 1.5 }, { inicio: 2.5, fim: 3.4 }])
})

test('WAV 16 bits estéreo com cabeçalho certo; silêncio detectado', async () => {
  const ch = [new Float32Array(480).fill(0.5), new Float32Array(480).fill(-1)]
  const buf = { numberOfChannels: 2, length: 480, sampleRate: 48000, getChannelData: (c) => ch[c] }
  const bytes = new DataView(await wavOf(buf).arrayBuffer())
  assert.equal(bytes.byteLength, 44 + 480 * 4)
  assert.equal(String.fromCharCode(...new Uint8Array(bytes.buffer, 0, 4)), 'RIFF')
  assert.equal(bytes.getUint32(24, true), 48000)
  assert.equal(bytes.getInt16(44, true), Math.trunc(0.5 * 0x7fff))
  assert.equal(bytes.getInt16(46, true), -0x8000)
  assert.equal(silent(buf), false)
  const zero = new Float32Array(480)
  assert.equal(silent({ numberOfChannels: 1, length: 480, sampleRate: 48000, getChannelData: () => zero }), true)
})
