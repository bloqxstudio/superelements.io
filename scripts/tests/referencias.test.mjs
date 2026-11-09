import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentFormatOf, parseRefUrl, parseTags, referencesText } from '../../src/features/referencias/rules.ts'

test('Instagram: post, reel e reel com usuário viram o embed oficial', () => {
  const p = parseRefUrl('https://www.instagram.com/p/De-OxbRiTRr/?igsh=abc')
  assert.equal(p.platform, 'instagram')
  assert.equal(p.url, 'https://www.instagram.com/p/De-OxbRiTRr/')
  assert.equal(p.embed, 'https://www.instagram.com/p/De-OxbRiTRr/embed/')
  assert.equal(p.kind, 'estatico')
  const r = parseRefUrl('instagram.com/avencestudio/reel/DevRyFxyw5w')
  assert.equal(r.embed, 'https://www.instagram.com/reel/DevRyFxyw5w/embed/')
  assert.equal(r.kind, 'reels')
  assert.equal(parseRefUrl('https://www.instagram.com/avencestudio/').embed, undefined)
})

test('YouTube, Shorts e TikTok', () => {
  assert.equal(parseRefUrl('https://youtu.be/dQw4w9WgXcQ').embed, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
  assert.equal(parseRefUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ').kind, 'reels')
  assert.equal(parseRefUrl('https://www.tiktok.com/@marca/video/7300000000000000000').embed, 'https://www.tiktok.com/embed/v2/7300000000000000000')
})

test('link que não é web volta vazio; site comum fica como site', () => {
  assert.equal(parseRefUrl('não é link'), undefined)
  assert.equal(parseRefUrl('https://exemplo.com.br/pagina').platform, 'site')
})

test('etiquetas, formato da Pauta e texto para a IA', () => {
  assert.deepEqual(parseTags('Tipografia, #cor, tipografia, , motion'), ['tipografia', 'cor', 'motion'])
  assert.equal(contentFormatOf('motion'), 'reels')
  assert.equal(contentFormatOf('carrossel'), 'carrossel')
  const t = referencesText([{ title: 'Capa forte', kind: 'reels', url: 'https://x', notes: 'Gancho em 1s', tags: ['gancho'] }])
  assert.equal(t, '- Reels: Capa forte (https://x) — o que aproveitar: Gancho em 1s [gancho]')
})
