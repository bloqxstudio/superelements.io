import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasMotion, hasMotionData, setPostStatic } from '../../src/features/criativos/motionFlags.ts'

// O post animado pode sair estático sem perder a animação, e voltar (2026-11-09)
const layer = (motion) => ({ id: 'l1', type: 'text', text: 'Olá', ...(motion ? { motion } : {}) })
const post = (motion) => ({ id: 'p1', format: '4x5', slides: [{ id: 's1', layers: [layer(motion)] }] })
const animated = post({ preset: 'fade', start: 0, dur: 0.6 })

test('estático sai parado e guarda a animação; animado volta', () => {
  assert.equal(hasMotion(animated), true)
  const still = setPostStatic(animated, true)
  assert.equal(hasMotion(still), false)
  assert.equal(hasMotionData(still), true)
  assert.deepEqual(still.slides, animated.slides)
  const back = setPostStatic(still, false)
  assert.equal(hasMotion(back), true)
  assert.equal(back.motion.paused, undefined)
})

test('post sem animação nunca é animado, nem com a marca desligada', () => {
  assert.equal(hasMotion(post()), false)
  assert.equal(hasMotionData(post()), false)
  assert.equal(hasMotion(setPostStatic(post(), false)), false)
})

test('post estático não gera vídeo no carrossel nem na publicação (2026-11-10)', async () => {
  const { slideMoves } = await import('../../src/features/criativos/motionFlags.ts')
  const s = animated.slides[0]
  assert.equal(slideMoves(animated, s), true)
  assert.equal(slideMoves(setPostStatic(animated, true), s), false)
  assert.equal(slideMoves(setPostStatic(setPostStatic(animated, true), false), s), true)
})
