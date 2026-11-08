import test from 'node:test'
import assert from 'node:assert/strict'
import { segments, toSrc, cleanCuts, videoLength, outBeats, keptLength } from '../../src/features/criativos/explicativo/timeline.ts'

test('corte aos 24s editados preserva corte anterior e acrescenta CTA sem áudio', () => {
  const data = { mode: 'narracao', media: { duration: 32.6 }, cuts: [{ s: 1.55, e: 1.85 }], words: [], beats: [
    { id: 'a', start: 0, end: 10, pattern: 'titulo' },
    { id: 'b', start: 10, end: 32.6, pattern: 'titulo' },
  ] }
  const cutAt = toSrc(segments(data), 24)
  assert.equal(cutAt, 24.3)
  data.cuts = cleanCuts([...data.cuts, { s: cutAt, e: 32.6 }], 32.6)
  data.endCard = { duration: 4, headline: 'Ligue para o 0800 da Ready', sub: 'Precisa de atendimento?' }
  assert.equal(keptLength(segments(data)), 24)
  assert.equal(videoLength(data), 28)
  const beats = outBeats(data, 28)
  assert.equal(beats.at(-2).end, 24)
  assert.equal(beats.at(-1).start, 24)
  assert.equal(beats.at(-1).end, 28)
  assert.equal(beats.at(-1).fullScreen, true)
  assert.equal(beats.at(-1).headline, data.endCard.headline)
  delete data.endCard
  assert.equal(videoLength(data), 24.25)
})
