// Relógio virtual: o tempo da página só anda quando o gravador manda (__vt.advance).
// rAF, timers, Date, performance.now e as animações CSS/WAAPI seguem esse relógio,
// para cada quadro do vídeo sair no tempo certo, sem depender da velocidade da captura.
(() => {
  if (window.__vt) return
  const W = window
  const R = {
    now: performance.now.bind(performance),
    raf: W.requestAnimationFrame.bind(W),
    dateNow: Date.now,
  }
  const epoch = R.dateNow() - R.now()
  let vnow = 0
  const now = () => vnow
  let seq = 1
  const timers = new Map()
  let rafs = new Map()
  W.setTimeout = (cb, ms = 0, ...args) => { const id = seq++; timers.set(id, { at: vnow + Math.max(0, +ms || 0), cb, args, every: 0 }); return id }
  W.setInterval = (cb, ms = 0, ...args) => { const id = seq++; const every = Math.max(1, +ms || 0); timers.set(id, { at: vnow + every, cb, args, every }); return id }
  W.clearTimeout = W.clearInterval = (id) => { timers.delete(id) }
  W.requestAnimationFrame = (cb) => { const id = seq++; rafs.set(id, cb); return id }
  W.cancelAnimationFrame = (id) => { rafs.delete(id) }
  performance.now = now
  const RD = Date
  class VDate extends RD {
    constructor(...a) { if (a.length) super(...a); else super(epoch + vnow) }
    static now() { return epoch + vnow }
  }
  W.Date = VDate
  const starts = new WeakMap()
  const run = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(String(fn)) } catch (e) { console.error('[vt]', e) } }
  function syncAnimations() {
    let list = []
    try { list = document.getAnimations() } catch (e) { return }
    for (const a of list) {
      if (!starts.has(a)) starts.set(a, vnow)
      try { a.pause(); a.currentTime = vnow - starts.get(a) } catch (e) {}
    }
  }
  function advance(to) {
    if (to < vnow) to = vnow
    for (;;) {
      let next = null, nextId = 0
      for (const [id, t] of timers) if (t.at <= to && (!next || t.at < next.at)) { next = t; nextId = id }
      if (!next) break
      vnow = Math.max(vnow, next.at)
      if (next.every) next.at += next.every; else timers.delete(nextId)
      run(next.cb, next.args)
    }
    vnow = to
    const due = rafs; rafs = new Map()
    for (const cb of due.values()) run(cb, [vnow])
    syncAnimations()
    return vnow
  }
  W.__vt = { advance, now, realFrame: () => new Promise((r) => R.raf(() => r())) }
})()
