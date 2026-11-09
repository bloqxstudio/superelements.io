import { test } from 'node:test'
import assert from 'node:assert/strict'
import { due, kindOf, metaOf, metricsOf, parseCount, postLinksIn, postUrlOf, shotName, threadUrlOf, windowOrders } from '../src/rules.ts'

test('acha os posts da conversa: links do Instagram, compartilhados e colados, sem repetir', () => {
  const links = postLinksIn(
    ['/p/De-OxbRiTRr/', 'https://www.instagram.com/avencestudio/reel/DevRyFxyw5w/?igsh=1', '/direct/inbox/', '/stories/x/123'],
    'olha esse https://www.instagram.com/reel/DevRyFxyw5w e esse instagram.com/p/AbCdEf12345/?utm=1',
  )
  assert.deepEqual(links, ['https://www.instagram.com/p/De-OxbRiTRr/', 'https://www.instagram.com/reel/DevRyFxyw5w/', 'https://www.instagram.com/p/AbCdEf12345/'])
  assert.equal(postUrlOf('https://instagram.com/tv/AbCdEf12345'), 'https://www.instagram.com/reel/AbCdEf12345/')
})

test('endereço do grupo', () => {
  assert.equal(threadUrlOf('https://www.instagram.com/direct/t/340282366841710300949128123456789/'), 'https://www.instagram.com/direct/t/340282366841710300949128123456789/')
  assert.equal(threadUrlOf('https://www.instagram.com/direct/inbox/'), undefined)
})

test('autor e legenda pelo og:description, em inglês e português', () => {
  assert.deepEqual(metaOf('1,234 likes, 56 comments - estudio.x on November 1, 2026: "Seu site tem que\nfechar projeto." '), { author: 'estudio.x', caption: 'Seu site tem que\nfechar projeto.' })
  assert.deepEqual(metaOf('12 curtidas, 3 comentários - marca_y em 1 de novembro de 2026: "Legenda"'), { author: 'marca_y', caption: 'Legenda' })
  assert.deepEqual(metaOf('5 likes, 0 comments - corretorja.oficial no November 9, 2026: "Site em instantes."'), { author: 'corretorja.oficial', caption: 'Site em instantes.' })
  assert.deepEqual(metaOf(undefined), {})
})

test('tipo pela página e rotina', () => {
  assert.equal(kindOf('https://www.instagram.com/reel/x/', { video: true, slides: 1 }), 'reels')
  assert.equal(kindOf('https://www.instagram.com/p/x/', { video: false, slides: 4 }), 'carrossel')
  assert.equal(kindOf('https://www.instagram.com/p/x/', { video: true, slides: 1 }), 'video')
  const base = { enabled: true, every_minutes: 60, last_run_at: new Date(1_000_000).toISOString(), run_requested_at: null }
  assert.equal(due(base, 1_000_000 + 30 * 60_000), false)
  assert.equal(due(base, 1_000_000 + 61 * 60_000), true)
  assert.equal(due({ ...base, run_requested_at: new Date(1_000_500).toISOString() }, 1_000_600), true)
  assert.equal(due({ ...base, enabled: false }, 9e12), false)
  assert.equal(shotName('https://www.instagram.com/reel/DevRyFxyw5w/', 'capa'), 'referencias/DevRyFxyw5w-capa.jpg')
})

test('números do Instagram e engajamento', () => {
  assert.equal(parseCount('1,234'), 1234)
  assert.equal(parseCount('12K'), 12000)
  assert.equal(parseCount('1.2M'), 1200000)
  assert.equal(parseCount('1,2 mil'), 1200)
  assert.deepEqual(metricsOf('12K likes, 345 comments - x no November 9, 2026: "a"', 'Reels 1,5 mi visualizações'), { likes: 12000, comments: 345, views: 1500000 })
  assert.deepEqual(metricsOf('1.234 curtidas, 56 comentários - x em 1 de novembro: "a"'), { likes: 1234, comments: 56, views: undefined })
})

test('ordem do grupo: cada leitura refaz a ordem do que leu; os de fora ficam abaixo', () => {
  const first = windowOrders(['A', 'B'], 1_000_000)
  const later = windowOrders(['N', 'A', 'X', 'B'], 2_000_000)
  assert.ok(later.N > later.A && later.A > later.X && later.X > later.B)
  // um post mais antigo que só a primeira leitura viu fica abaixo de todos os da leitura nova
  assert.ok(windowOrders(['Z'], 1_000_000).Z - 50 < later.B)
  assert.ok(first.A > first.B)
})
