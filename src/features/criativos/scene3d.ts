/**
 * `lib.d3`: um motor 3D pronto para as cenas em código (2026-11-09; o usuário: "agora conseguimos fazer esses
 * 3d?" e "pode fazer ambos para entrega"). O worker só tem canvas 2D; isto projeta um mundo 3D nele: câmera em
 * perspectiva numa trajetória contínua (Hermite pelos quadros-chave), luz direcional, névoa, sombras projetadas,
 * faces de trás descartadas, ordem por profundidade e texturas nas faces. Inclui uma biblioteca de ícones 3D
 * (anúncio, Instagram, site, atendimento, WhatsApp, criativo, loja, agenda, e-mail, busca, gráfico, vídeo,
 * pagamento, logo da marca), prédios prontos, conexões com pulsos, público, ondas, telas vivas e a placa em
 * camadas que se abre. Vai como texto para dentro de `SCENE_WORKER_SOURCE` (sem crases nem interpolação aqui).
 */

export const SCENE3D_SOURCE = String.raw`
const d3 = (() => {
  const texCache = new Map()
  const hex = (h) => { const s = String(h || '#000000').replace('#', ''); const v = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6), 16) || 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')'
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
  const col = (c) => (Array.isArray(c) ? c : hex(c))
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
  const WHITE = [255, 255, 255]

  // ---------- formas ----------
  const rrPoly = (w, d, r, seg) => {
    seg = seg || 4; r = Math.max(0.001, Math.min(r, w / 2 - 0.001, d / 2 - 0.001))
    const pts = [], cs = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, Math.PI / 2], [-w / 2 + r, -d / 2 + r, Math.PI], [w / 2 - r, -d / 2 + r, Math.PI * 1.5]]
    for (const c of cs) for (let s = 0; s <= seg; s++) { const a = c[2] + (s / seg) * Math.PI / 2; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]) }
    return pts
  }
  const circPoly = (r, n) => { n = n || 22; const out = []; for (let k = 0; k < n; k++) out.push([Math.cos(k / n * Math.PI * 2) * r, Math.sin(k / n * Math.PI * 2) * r]); return out }
  const extrude = (poly, a, b, map) => {
    const top = poly.map((p) => map(p[0], p[1], b)), bot = poly.map((p) => map(p[0], p[1], a))
    const faces = [{ p: top, tag: 'top' }, { p: bot.slice().reverse(), tag: 'bot' }]
    for (let k = 0; k < poly.length; k++) { const j = (k + 1) % poly.length; faces.push({ p: [bot[k], bot[j], top[j], top[k]], tag: 'side' }) }
    return faces
  }
  const vert = (x, z, rot, y) => { const c = Math.cos(rot || 0), s = Math.sin(rot || 0), y0 = y || 0; return (u, v, w) => [x + u * c - v * s, y0 + w, z + u * s + v * c] }

  // ---------- ícones (256 × 256) ----------
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
  const lin = (g, stops) => { const q = g.createLinearGradient(0, 256, 256, 0); stops.forEach((c, i) => q.addColorStop(i / (stops.length - 1), c)); return q }
  const sheen = (g) => { const q = g.createLinearGradient(0, 0, 0, 256); q.addColorStop(0, 'rgba(255,255,255,0.28)'); q.addColorStop(0.45, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 256, 256) }
  const bg = (g, stops) => { g.fillStyle = lin(g, stops); g.fillRect(0, 0, 256, 256); sheen(g) }
  const starPath = (g, x, y, ro, ri, n) => { g.beginPath(); for (let j = 0; j < n * 2; j++) { const r = j % 2 ? ri : ro, a = j * Math.PI / n - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) } g.closePath() }
  const ICONS = {
    anuncio(g, ac) {
      bg(g, [toHex(mixc(hex(ac), [0, 0, 0], 0.25)), ac, toHex(mixc(hex(ac), WHITE, 0.35))])
      g.fillStyle = '#FFFFFF'
      g.beginPath(); g.moveTo(78, 106); g.lineTo(160, 66); g.quadraticCurveTo(170, 62, 170, 74); g.lineTo(170, 182); g.quadraticCurveTo(170, 194, 160, 190); g.lineTo(78, 150); g.closePath(); g.fill()
      rr(g, 52, 102, 34, 52, 10); g.fill()
      g.beginPath(); g.moveTo(84, 150); g.lineTo(108, 156); g.lineTo(116, 196); g.quadraticCurveTo(117, 204, 108, 204); g.lineTo(100, 204); g.quadraticCurveTo(94, 204, 92, 196); g.closePath(); g.fill()
      g.strokeStyle = '#FFFFFF'; g.lineCap = 'round'; g.lineWidth = 13
      g.beginPath(); g.arc(176, 128, 30, -0.75, 0.75); g.stroke()
      g.globalAlpha = 0.65; g.beginPath(); g.arc(176, 128, 56, -0.7, 0.7); g.stroke(); g.globalAlpha = 1
    },
    instagram(g) {
      const q = g.createRadialGradient(70, 270, 10, 70, 270, 330)
      q.addColorStop(0, '#FEDA75'); q.addColorStop(0.25, '#FA7E1E'); q.addColorStop(0.5, '#D62976'); q.addColorStop(0.75, '#962FBF'); q.addColorStop(1, '#4F5BD5')
      g.fillStyle = q; g.fillRect(0, 0, 256, 256); sheen(g)
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 17; rr(g, 62, 62, 132, 132, 40); g.stroke()
      g.beginPath(); g.arc(128, 128, 31, 0, Math.PI * 2); g.stroke()
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(165, 91, 10, 0, Math.PI * 2); g.fill()
    },
    criativo(g, ac) {
      bg(g, ['#FF6B3D', '#FF9E2C', '#FFD23F'])
      g.save(); g.translate(118, 134); g.rotate(-0.2); g.fillStyle = 'rgba(255,255,255,0.45)'; rr(g, -50, -60, 100, 120, 14); g.fill(); g.restore()
      g.save(); g.translate(138, 130); g.rotate(0.1)
      g.fillStyle = '#FFFFFF'; rr(g, -52, -62, 104, 124, 14); g.fill()
      g.fillStyle = '#E4E7FD'; rr(g, -40, -50, 80, 62, 8); g.fill()
      g.fillStyle = ac; g.beginPath(); g.moveTo(-40, 6); g.lineTo(-14, -22); g.lineTo(4, -4); g.lineTo(18, -16); g.lineTo(40, 6); g.lineTo(40, 12); g.lineTo(-40, 12); g.closePath(); g.fill()
      g.fillStyle = '#FFB02E'; g.beginPath(); g.arc(22, -34, 8, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#111111'; rr(g, -40, 24, 56, 9, 4.5); g.fill()
      g.fillStyle = '#C9C6BE'; rr(g, -40, 40, 38, 8, 4); g.fill()
      g.restore()
      g.fillStyle = '#FFFFFF'; starPath(g, 196, 62, 24, 6, 4); g.fill()
    },
    site(g, ac) {
      bg(g, ['#0E1330', '#1A2370', ac])
      g.fillStyle = '#FFFFFF'; rr(g, 40, 58, 176, 140, 18); g.fill()
      g.fillStyle = '#E9ECFF'; rr(g, 40, 58, 176, 30, 18); g.fill(); g.fillRect(40, 74, 176, 14)
      ;['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(60 + i * 16, 73, 5.5, 0, Math.PI * 2); g.fill() })
      g.fillStyle = '#FFFFFF'; rr(g, 112, 66, 90, 14, 7); g.fill()
      g.fillStyle = '#111111'; rr(g, 56, 104, 92, 12, 6); g.fill()
      g.fillStyle = '#C9C6BE'; rr(g, 56, 124, 70, 9, 4.5); g.fill()
      g.fillStyle = ac; rr(g, 56, 146, 64, 24, 12); g.fill()
      g.fillStyle = '#E4E7FD'; rr(g, 158, 102, 44, 70, 8); g.fill()
      g.save(); g.translate(176, 166); g.rotate(-0.35)
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 46); g.lineTo(11, 35); g.lineTo(20, 54); g.lineTo(28, 50); g.lineTo(19, 31); g.lineTo(34, 31); g.closePath()
      g.fillStyle = '#111111'; g.fill(); g.strokeStyle = '#FFFFFF'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke(); g.restore()
    },
    atendimento(g) {
      bg(g, ['#0E9F4C', '#22C55E', '#5BE38E'])
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(128, 122, 70, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.moveTo(74, 160); g.lineTo(58, 206); g.lineTo(108, 186); g.closePath(); g.fill()
      g.fillStyle = '#16A34A'; [-26, 0, 26].forEach((x) => { g.beginPath(); g.arc(128 + x, 122, 10, 0, Math.PI * 2); g.fill() })
    },
    whatsapp(g) {
      bg(g, ['#128C7E', '#25D366', '#5BE38E'])
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 15; g.beginPath(); g.arc(128, 124, 66, 0, Math.PI * 2); g.stroke()
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(74, 160); g.lineTo(56, 206); g.lineTo(104, 186); g.closePath(); g.fill()
      g.save(); g.translate(128, 124); g.rotate(-0.6); g.fillStyle = '#FFFFFF'
      rr(g, -12, -36, 24, 72, 12); g.fill(); rr(g, -24, -36, 30, 18, 8); g.fill(); rr(g, -24, 18, 30, 18, 8); g.fill(); g.restore()
    },
    loja(g, ac) {
      bg(g, ['#7C3AED', '#A855F7', '#E879F9'])
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(66, 100); g.lineTo(190, 100); g.lineTo(178, 200); g.quadraticCurveTo(176, 210, 166, 210); g.lineTo(90, 210); g.quadraticCurveTo(80, 210, 78, 200); g.closePath(); g.fill()
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.arc(128, 100, 32, Math.PI, 0); g.stroke()
      g.fillStyle = ac; starPath(g, 128, 156, 24, 10, 5); g.fill()
    },
    agenda(g) {
      bg(g, ['#DC2626', '#F43F5E', '#FB7185'])
      g.fillStyle = '#FFFFFF'; rr(g, 52, 64, 152, 140, 20); g.fill()
      g.fillStyle = '#F43F5E'; rr(g, 52, 64, 152, 40, 20); g.fill(); g.fillRect(52, 88, 152, 16)
      g.fillStyle = '#FFFFFF'; rr(g, 84, 48, 14, 32, 7); g.fill(); rr(g, 158, 48, 14, 32, 7); g.fill()
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.fillStyle = r === 1 && c === 2 ? '#F43F5E' : '#E5E7EB'; rr(g, 70 + c * 32, 118 + r * 26, 22, 18, 5); g.fill() }
    },
    email(g, ac) {
      bg(g, ['#0369A1', '#0EA5E9', '#7DD3FC'])
      g.fillStyle = '#FFFFFF'; rr(g, 50, 74, 156, 112, 16); g.fill()
      g.strokeStyle = ac; g.lineWidth = 11; g.lineJoin = 'round'; g.beginPath(); g.moveTo(62, 88); g.lineTo(128, 140); g.lineTo(194, 88); g.stroke()
    },
    busca(g) {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 256)
      const q = g.createLinearGradient(0, 0, 0, 256); q.addColorStop(0, 'rgba(0,0,0,0)'); q.addColorStop(1, 'rgba(0,0,0,0.06)'); g.fillStyle = q; g.fillRect(0, 0, 256, 256)
      g.lineWidth = 22; g.lineCap = 'round'
      ;[['#4285F4', -0.9, 0.5], ['#34A853', 0.5, 1.9], ['#FBBC05', 1.9, 3.2], ['#EA4335', 3.2, 5.4]].forEach((s) => { g.strokeStyle = s[0]; g.beginPath(); g.arc(114, 114, 46, s[1], s[2]); g.stroke() })
      g.strokeStyle = '#1F2937'; g.lineWidth = 26; g.beginPath(); g.moveTo(152, 152); g.lineTo(196, 196); g.stroke()
    },
    grafico(g, ac) {
      bg(g, ['#047857', '#10B981', '#6EE7B7'])
      g.fillStyle = 'rgba(255,255,255,0.85)'; [[62, 150, 60], [104, 126, 84], [146, 100, 110]].forEach((b) => { rr(g, b[0], b[1], 30, b[2], 8); g.fill() })
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round'
      g.beginPath(); g.moveTo(60, 120); g.lineTo(108, 92); g.lineTo(140, 108); g.lineTo(196, 62); g.stroke()
      g.beginPath(); g.moveTo(170, 60); g.lineTo(198, 60); g.lineTo(198, 88); g.stroke()
    },
    video(g) {
      bg(g, ['#B91C1C', '#EF4444', '#F87171'])
      g.fillStyle = '#FFFFFF'; rr(g, 50, 76, 156, 104, 26); g.fill()
      g.fillStyle = '#EF4444'; g.beginPath(); g.moveTo(112, 102); g.lineTo(158, 128); g.lineTo(112, 154); g.closePath(); g.fill()
    },
    pagamento(g, ac) {
      bg(g, ['#111827', '#1F2937', '#374151'])
      g.fillStyle = ac; rr(g, 46, 72, 164, 112, 16); g.fill()
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(46, 96, 164, 22)
      g.fillStyle = '#FDE68A'; rr(g, 62, 132, 34, 26, 6); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.8)'; rr(g, 110, 140, 80, 10, 5); g.fill()
    },
    msg_in(g) { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 320, 150); [[230, '#1F2937'], [170, '#9CA3AF'], [120, '#9CA3AF']].forEach((l, i) => { g.fillStyle = l[1]; rr(g, 30, 34 + i * 30, l[0], 16, 8); g.fill() }) },
    msg_out(g) {
      g.fillStyle = '#DCFCE7'; g.fillRect(0, 0, 320, 150); [[240, '#14532D'], [150, '#4D7C5E']].forEach((l, i) => { g.fillStyle = l[1]; rr(g, 30, 34 + i * 30, l[0], 16, 8); g.fill() })
      g.strokeStyle = '#2B9BF0'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; for (const dx of [0, 16]) { g.beginPath(); g.moveTo(236 + dx, 112); g.lineTo(246 + dx, 122); g.lineTo(266 + dx, 100); g.stroke() }
    },
    digitando(g) { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 320, 150); [0, 1, 2].forEach((k) => { g.fillStyle = '#9CA3AF'; g.beginPath(); g.arc(120 + k * 40, 75, 14, 0, Math.PI * 2); g.fill() }) },
  }
  const WIDE = { msg_in: 1, msg_out: 1, digitando: 1 }
  const ALIAS = { anuncios: 'anuncio', ads: 'anuncio', insta: 'instagram', chat: 'atendimento', conversa: 'atendimento', creative: 'criativo', post: 'criativo', web: 'site', loja_online: 'loja', ecommerce: 'loja', calendario: 'agenda', google: 'busca', relatorio: 'grafico', metricas: 'grafico', reels: 'video', pix: 'pagamento' }
  function iconTex(name, accent, env) {
    if (name && typeof name === 'object') return name
    const key = String(name || 'logo')
    const id = ALIAS[key] || key
    if (id === 'logo' || id === 'logo_escuro') {
      const k = id + ':' + (env.images && env.images[id] ? 'img' : 'txt') + ':' + (env.brand && env.brand.name)
      if (texCache.has(k)) return texCache.get(k)
      const c = new OffscreenCanvas(512, 320), g = c.getContext('2d')
      const dark = id === 'logo_escuro'
      const q = g.createLinearGradient(0, 0, 0, 320)
      q.addColorStop(0, dark ? '#1B1F33' : '#FFFFFF'); q.addColorStop(1, dark ? '#0D1020' : '#ECEAE4'); g.fillStyle = q; g.fillRect(0, 0, 512, 320)
      const img = env.images && env.images[id]
      if (img) image(g, img, 256, 160, 360, 130, 'contain')
      else { g.fillStyle = dark ? '#FFFFFF' : '#111111'; g.font = '700 60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((env.brand && env.brand.name) || 'Marca', 256, 160, 460) }
      texCache.set(k, c); return c
    }
    if (env.images && env.images[key] && !ICONS[id]) return env.images[key]
    const k = id + ':' + accent
    if (texCache.has(k)) return texCache.get(k)
    const paint = ICONS[id] || ICONS.site
    const c = WIDE[id] ? new OffscreenCanvas(320, 150) : new OffscreenCanvas(256, 256)
    paint(c.getContext('2d'), accent)
    texCache.set(k, c)
    return c
  }

  // ---------- tela viva de navegador (para panel) ----------
  function browser(g, W, H, p, accent, t) {
    const sx = W / 640, sy = H / 400
    g.save(); g.scale(sx, sy)
    const on = Math.min(1, p * 3)
    g.fillStyle = '#0B0E1C'; g.fillRect(0, 0, 640, 400)
    g.globalAlpha = 0.35 + 0.65 * on
    g.fillStyle = '#F7F6F2'; g.fillRect(0, 0, 640, 400)
    g.fillStyle = '#E6E8F5'; g.fillRect(0, 0, 640, 38)
    ;['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(24 + i * 20, 19, 6, 0, Math.PI * 2); g.fill() })
    g.fillStyle = '#FFFFFF'; rr(g, 110, 9, 300, 20, 10); g.fill()
    const b = (i) => ease.outCubic(clamp((p - 0.05 - i * 0.07) / 0.18))
    g.fillStyle = '#111111'; rr(g, 40, 70, Math.max(1, 320 * b(0)), 30, 8); g.fill(); rr(g, 40, 110, Math.max(1, 250 * b(1)), 30, 8); g.fill()
    g.fillStyle = '#B9B5AC'; rr(g, 40, 160, Math.max(1, 280 * b(2)), 12, 6); g.fill(); rr(g, 40, 182, Math.max(1, 220 * b(2)), 12, 6); g.fill()
    const cta = b(3), pl = 1 + 0.05 * Math.sin((t || 0) * 3) * cta
    if (cta > 0.01) { g.save(); g.translate(110, 245); g.scale(pl * cta, pl * cta); g.fillStyle = accent; rr(g, -70, -24, 140, 48, 24); g.fill(); g.fillStyle = '#FFFFFF'; rr(g, -40, -5, 80, 10, 5); g.fill(); g.restore() }
    if (b(1) > 0.01) {
      g.fillStyle = '#DCE0FB'; rr(g, 400, 66, 200, Math.max(1, 200 * b(1)), 16); g.fill()
      g.save(); g.globalAlpha *= b(1); g.fillStyle = accent; g.beginPath(); g.moveTo(420, 240); g.lineTo(470, 170); g.lineTo(505, 210); g.lineTo(530, 185); g.lineTo(580, 240); g.closePath(); g.fill(); g.restore()
    }
    for (let k = 0; k < 5; k++) { const s = ease.outBack(clamp((p - 0.6 - k * 0.04) / 0.1)); if (s <= 0) continue; g.save(); g.translate(60 + k * 46, 335); g.scale(s, s); g.fillStyle = '#FFB800'; starPath(g, 0, 0, 19, 8, 5); g.fill(); g.restore() }
    const seal = ease.outBack(clamp((p - 0.85) / 0.12))
    if (seal > 0) { g.save(); g.translate(540, 330); g.scale(seal, seal); g.fillStyle = '#22C55E'; g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#FFFFFF'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-15, 1); g.lineTo(-4, 12); g.lineTo(17, -11); g.stroke(); g.restore() }
    g.restore()
  }

  // ---------- câmera ----------
  const CAM_FIELDS = ['at', 'yaw', 'pitch', 'dist', 'fov']
  function normKeys(keys) {
    const out = []
    let prev = { at: [0, 0, 0], yaw: -40, pitch: 35, dist: 18, fov: 50 }
    for (const k of keys || []) {
      const tt = Array.isArray(k) ? k[0] : k.t
      const v = Array.isArray(k) ? k[1] || {} : k
      const cur = {}
      for (const f of CAM_FIELDS) cur[f] = v[f] !== undefined ? v[f] : prev[f]
      out.push([tt, cur.at[0], cur.at[1], cur.at[2], cur.yaw, cur.pitch, cur.dist, cur.fov])
      prev = cur
    }
    if (!out.length) out.push([0, 0, 0, 0, prev.yaw, prev.pitch, prev.dist, prev.fov])
    out.sort((a, b) => a[0] - b[0])
    return out
  }
  function cameraAt(keys, time, W, H, drift) {
    const K = keys.length && Array.isArray(keys[0]) && typeof keys[0][1] === 'number' ? keys : normKeys(keys)
    const v = []
    if (K.length === 1) for (let c = 1; c < 8; c++) v.push(K[0][c])
    else {
      let i = 0
      while (i < K.length - 2 && time > K[i + 1][0]) i++
      const a = K[i], b = K[i + 1], h = Math.max(1e-6, b[0] - a[0]), u = clamp((time - a[0]) / h)
      const tan = (j, c) => (j <= 0 || j >= K.length - 1) ? 0 : 0.85 * (K[j + 1][c] - K[j - 1][c]) / (K[j + 1][0] - K[j - 1][0])
      const u2 = u * u, u3 = u2 * u
      for (let c = 1; c < 8; c++) v.push((2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * tan(i, c) * h + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * tan(i + 1, c) * h)
    }
    const dr = drift === undefined ? 1 : drift
    const yaw = (v[3] + 1.6 * dr * Math.sin(time * 0.33)) * Math.PI / 180
    const pitch = Math.max(-1.45, Math.min(1.45, (v[4] + 0.8 * dr * Math.sin(time * 0.27 + 1)) * Math.PI / 180))
    const tgt = [v[0], v[1], v[2]]
    const pos = add(tgt, mul([Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)], v[5]))
    const fwd = nrm(sub(tgt, pos)), right = nrm(cross(fwd, [0, 1, 0])), up = cross(right, fwd)
    return { pos, fwd, right, up, f: (H / 2) / Math.tan(v[6] * Math.PI / 360), yaw, pitch, tgt, dist: v[5], cx: W / 2, cy: H / 2 }
  }

  // ---------- o mundo de um quadro ----------
  function world(ctx, t, env, o) {
    o = o || {}
    const W = env.width, H = env.height, U = W / 1080
    const AC = col(o.accent || (env.brand && env.brand.colors && env.brand.colors[3]) || '#2B3CF0'), ACL = mixc(AC, WHITE, 0.45)
    const acHex = toHex(AC)
    const BGc = col(o.background || '#070912')
    const LIGHT = nrm(o.light || [-0.55, 1.0, 0.42])
    const cam = cameraAt(o.camera || [], t, W, H, o.drift)
    const fogNear = o.fogNear === undefined ? 9 : o.fogNear, fogFar = o.fogFar === undefined ? 39 : o.fogFar
    const proj = (p) => { const d = sub(p, cam.pos), z = dot(d, cam.fwd); if (z < 0.2) return null; return [cam.cx + dot(d, cam.right) * cam.f / z, cam.cy - dot(d, cam.up) * cam.f / z, z] }
    const depth = (p) => dot(sub(p, cam.pos), cam.fwd)
    const fog = (c, z) => mixc(c, BGc, clamp((z - fogNear) / (fogFar - fogNear)) * 0.55)
    const items = [], ground = [], shadows = [], slabs = []
    const push = (p, fn) => items.push({ z: depth(p), fn })

    const path2 = (pp) => { ctx.beginPath(); pp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath() }
    const poly = (pts, fill, alpha) => { const pp = pts.map(proj); if (pp.some((q) => !q)) return; ctx.globalAlpha = alpha === undefined ? 1 : alpha; path2(pp); ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1 }
    const line = (pts, color, width, alpha) => {
      const pp = pts.map(proj); if (pp.some((q) => !q)) return
      ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.beginPath(); pp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])))
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.globalAlpha = 1
    }
    const glowNow = (p, r, c, a) => {
      const q = proj(p); if (!q) return
      const rr2 = r * cam.f / q[2]; if (rr2 < 0.5 || a <= 0.003) return
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr2)
      g.addColorStop(0, rgb(WHITE, a)); g.addColorStop(0.18, rgb(c, a * 0.9)); g.addColorStop(1, rgb(c, 0))
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], rr2, 0, Math.PI * 2); ctx.fill()
    }
    const texQuad = (img, corners, clipPts, alpha) => {
      const q = corners.map(proj); if (q.some((v) => !v)) return
      const iw = img.width, ih = img.height
      ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha
      path2(clipPts); ctx.clip()
      const p0 = q[0], p1 = q[1], p2 = q[2], p3 = q[3]
      const grow = (pts) => { const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3; return pts.map((v) => [v[0] + (v[0] - cx) * 0.02, v[1] + (v[1] - cy) * 0.02]) }
      ctx.save(); path2(grow([p0, p1, p3])); ctx.clip()
      ctx.transform((p1[0] - p0[0]) / iw, (p1[1] - p0[1]) / iw, (p3[0] - p0[0]) / ih, (p3[1] - p0[1]) / ih, p0[0], p0[1]); ctx.drawImage(img, 0, 0); ctx.restore()
      ctx.save(); path2(grow([p1, p2, p3])); ctx.clip()
      ctx.transform(-(p3[0] - p2[0]) / iw, -(p3[1] - p2[1]) / iw, -(p1[0] - p2[0]) / ih, -(p1[1] - p2[1]) / ih, p3[0] + p1[0] - p2[0], p3[1] + p1[1] - p2[1]); ctx.drawImage(img, 0, 0); ctx.restore()
      ctx.restore()
    }
    const solid = (faces, center, base, opt) => {
      opt = opt || {}
      const vis = []
      for (const f of faces) {
        let n = nrm(cross(sub(f.p[1], f.p[0]), sub(f.p[2], f.p[0])))
        const fc = f.p.reduce((s, p) => add(s, p), [0, 0, 0]).map((v) => v / f.p.length)
        if (dot(n, sub(fc, center)) < 0) n = mul(n, -1)
        if (dot(n, sub(cam.pos, fc)) <= 0) continue
        const pp = f.p.map(proj); if (pp.some((q) => !q)) continue
        vis.push({ f, n, pp, z: pp.reduce((s, q) => s + q[2], 0) / pp.length })
      }
      for (const v of vis) {
        const b = col(opt[v.f.tag] || base)
        let c
        if (opt.emit && opt.emit[v.f.tag]) c = b
        else { const lam = Math.max(0, dot(v.n, LIGHT)); c = mixc(mul(b, 0.42 + 0.58 * lam + 0.1 * Math.max(0, v.n[1])), AC, 0.05 + 0.05 * Math.max(0, -v.n[1])) }
        c = fog(c, v.z)
        path2(v.pp); ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha
        ctx.fillStyle = rgb(c); ctx.fill(); ctx.strokeStyle = rgb(c); ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1
        if (opt.tex && v.f.tag === (opt.texTag || 'top')) texQuad(opt.tex, opt.texCorners, v.pp, opt.alpha)
      }
    }
    const hull = (pts) => {
      const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
      const cr = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0])
      const lo = [], hi = []
      for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
      for (const q of p.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q) }
      return lo.slice(0, -1).concat(hi.slice(0, -1))
    }
    const shadowOf = (pl, map, h, a) => {
      if (h <= 0.01) return
      const pts = []
      for (const uv of pl) { const b = map(uv[0], uv[1], 0), tp = map(uv[0], uv[1], h); pts.push([b[0], b[2]]); const k = tp[1] / LIGHT[1]; pts.push([tp[0] - LIGHT[0] * k, tp[2] - LIGHT[2] * k]) }
      const hl = hull(pts)
      shadows.push(() => poly(hl.map((q) => [q[0], 0.004, q[1]]), 'rgba(0,0,0,1)', a))
    }
    const footprint = (o2) => {
      const s = o2.shape || 'caixa', w = o2.w || 1, d = o2.d || w
      if (s === 'cilindro') return circPoly(w / 2, 22)
      return rrPoly(w, d, o2.radius === undefined ? Math.min(w, d) * 0.16 : o2.radius, s === 'caixa' ? 1 : 3)
    }

    const api = {
      cam, U, accent: acHex, proj, depth,
      /** Prisma (caixa arredondada ou cilindro) no chão ou numa altura y. */
      block(b) {
        const h = b.h === undefined ? 1 : b.h
        if (h <= 0.005) return api
        const y = b.y || 0, pl = b.poly || footprint(b), map = vert(b.x || 0, b.z || 0, b.rot || 0, y)
        const center = [b.x || 0, y + h / 2, b.z || 0]
        push(center, () => solid(extrude(pl, 0, h, map), center, b.color || '#E9E6DF', { top: b.top, side: b.side, emit: b.emit ? { top: true, side: b.emit === 'tudo' } : null, alpha: b.alpha }))
        if (!y && b.shadow !== false) shadowOf(pl, map, h, b.shadowAlpha === undefined ? 0.3 : b.shadowAlpha)
        return api
      },
      /** Anel aceso em volta de um prédio (faixa de luz). */
      band(b) {
        const pl = (b.poly || footprint(b)).map((q) => [q[0] * 1.04 + Math.sign(q[0]) * 0.02, q[1] * 1.04 + Math.sign(q[1]) * 0.02])
        const center = [b.x || 0, b.y, b.z || 0]
        push(center, () => solid(extrude(pl, 0, b.h || 0.07, vert(b.x || 0, b.z || 0, b.rot || 0, b.y)).filter((f) => f.tag === 'side'), center, b.color || acHex, { emit: { side: true } }))
        return api
      },
      /** Plaquinha com ícone (gira para a câmera). icon: nome da biblioteca, 'logo', 'logo_escuro' ou uma imagem. */
      tile(o2) {
        const s = o2.scale === undefined ? 1 : o2.scale
        if (s < 0.01) return api
        const img = iconTex(o2.icon, acHex, env)
        const w = (o2.w || (img.width > img.height * 1.3 ? 1.5 : 1.05)) * s, h = (o2.h || (o2.w || (img.width > img.height * 1.3 ? 1.5 : 1.05)) * img.height / img.width) * s, d = (o2.depth || 0.14) * s
        const yaw = o2.yaw !== undefined ? o2.yaw : cam.yaw + 0.18 + (o2.sway || 0)
        const r = [Math.cos(yaw), 0, -Math.sin(yaw)], nz = [Math.sin(yaw), 0, Math.cos(yaw)], c = o2.at
        const map = (u, v, wv) => add(add(add(c, mul(r, u)), [0, v, 0]), mul(nz, wv))
        const pl = rrPoly(w, h, Math.min(w, h) * (o2.round === undefined ? 0.2 : o2.round), 4)
        const corners = [map(-w / 2, h / 2, d / 2 + 0.002), map(w / 2, h / 2, d / 2 + 0.002), map(w / 2, -h / 2, d / 2 + 0.002), map(-w / 2, -h / 2, d / 2 + 0.002)]
        push(c, () => {
          if (o2.halo) glowNow(add(c, mul(nz, -0.1)), Math.max(w, h) * 1.2, col(o2.haloColor || AC), o2.halo)
          solid(extrude(pl, -d / 2, d / 2, map), c, '#F2F0EA', { side: '#D8D4CA', top: '#FFFFFF', tex: img, texTag: 'top', texCorners: corners, alpha: o2.alpha })
        })
        return api
      },
      /** Tela plana viva: corners [sup-esq, sup-dir, inf-dir, inf-esq]; draw(g, largura, altura) pinta o conteúdo. */
      panel(o2) {
        const res = o2.res || [640, 400]
        const key = 'panel:' + (o2.id || 'a') + ':' + res[0] + 'x' + res[1]
        let cv = texCache.get(key); if (!cv) { cv = new OffscreenCanvas(res[0], res[1]); texCache.set(key, cv) }
        const cs = o2.corners
        const center = mul(cs.reduce((s, p) => add(s, p), [0, 0, 0]), 0.25)
        push(add(center, o2.nudge || [0, 0, 0]), () => {
          const n = nrm(cross(sub(cs[3], cs[0]), sub(cs[1], cs[0])))
          if (dot(n, sub(cam.pos, center)) * (o2.flip ? -1 : 1) <= 0 && !o2.twoSided) return
          const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, res[0], res[1]); o2.draw(g, res[0], res[1])
          const pp = cs.map(proj); if (pp.some((q) => !q)) return
          texQuad(cv, cs, pp, o2.alpha)
        })
        return api
      },
      /**
       * Prédio pronto com plaquinha de ícone em cima. shape: 'torre' | 'recuo' | 'estudio' | 'largo' | 'cilindro' |
       * 'nucleo' | 'caixa'. grow (0..1) faz o prédio subir; pop (0..1) faz a plaquinha aparecer; focus (0..1) destaca.
       * Devolve { top, tile, screen } (screen: os cantos da fachada do 'largo', para api.panel).
       */
      node(n) {
        const x = n.x || 0, z = n.z || 0, g = n.grow === undefined ? 1 : n.grow, H0 = n.h || 2, hh = H0 * g
        const s = n.shape || 'torre', body = n.color || '#E9E6DF', band = n.band || acHex, focus = n.focus || 0
        const res = { top: [x, hh + 0.12, z], screen: null }
        if (s === 'torre') { api.block({ x, z, w: 1.7, d: 1.7, h: 0.35 * Math.min(1, g * 2), color: '#D9D5CC', shape: 'round' }); api.block({ x, z, w: 1.3, d: 1.3, h: hh, color: body, top: '#F7F5F0', shape: 'round' }); if (g > 0.6) { api.band({ x, z, w: 1.3, d: 1.3, shape: 'round', y: hh * 0.45, color: band }); api.band({ x, z, w: 1.3, d: 1.3, shape: 'round', y: hh * 0.75, color: band }) } }
        else if (s === 'recuo') { api.block({ x, z, w: 1.5, d: 1.5, h: Math.min(hh, 1.1 * g), color: body, top: '#F7F5F0', shape: 'round', radius: 0.3 }); api.block({ x, z, w: 1.15, d: 1.15, h: hh, color: body, top: '#F7F5F0', shape: 'round', radius: 0.3 }); if (g > 0.6) api.band({ x, z, w: 1.15, d: 1.15, shape: 'round', radius: 0.3, y: hh * 0.82, color: band }) }
        else if (s === 'estudio') { const h1 = Math.min(hh, H0 * 0.6 * g); api.block({ x, z, w: 1.8, d: 1.3, h: h1, color: body, top: '#F7F5F0', shape: 'round', radius: 0.18 }); if (hh > h1 + 0.02) api.block({ x: x + 0.12, z: z - 0.05, y: h1, w: 1.25, d: 1.0, h: hh - h1, rot: 0.35, color: n.color2 || '#FFB02E', top: '#FFD27A', shape: 'round', radius: 0.18 }) }
        else if (s === 'largo') {
          api.block({ x, z, w: 2.5, d: 0.9, h: hh, color: body, top: '#F7F5F0', shape: 'round', radius: 0.16, rot: n.rot || 0 })
          const m = vert(x, z, n.rot || 0), zf = 0.452, y0 = hh * 0.22, y1 = hh * 0.22 + 1.35 * Math.min(1, hh / Math.max(0.01, H0))
          res.screen = [m(-1.08, zf, y1), m(1.08, zf, y1), m(1.08, zf, y0), m(-1.08, zf, y0)]
        }
        else if (s === 'cilindro') { api.block({ x, z, w: 1.44, h: hh, color: body, top: '#F7F5F0', shape: 'cilindro' }); if (g > 0.6) api.band({ x, z, w: 1.44, shape: 'cilindro', y: hh * 0.6, color: band }) }
        else if (s === 'nucleo') { api.block({ x, z, w: 2.7, h: 0.32 * Math.min(1, g * 2), color: '#D9D5CC', shape: 'cilindro' }); api.block({ x, z, w: 1.9, h: hh, color: n.color || '#1A1F3A', shape: 'cilindro' }); if (g > 0.5) { api.band({ x, z, w: 1.9, shape: 'cilindro', y: hh * 0.35, color: band }); api.band({ x, z, w: 1.9, shape: 'cilindro', y: hh * 0.65, color: band }); api.band({ x, z, w: 1.9, shape: 'cilindro', y: hh - 0.07, color: toHex(ACL) }) } }
        else api.block({ x, z, w: n.w || 1.2, d: n.d || n.w || 1.2, h: hh, color: body, top: '#F7F5F0', shape: 'round' })
        if (n.icon) {
          const pop = n.pop === undefined ? 1 : n.pop
          const lift = n.lift === undefined ? (s === 'nucleo' ? 1.15 : 0.95) : n.lift
          const bob = Math.sin(t * 0.9 + x * 1.3 + z) * 0.08
          const sc = pop * (1 + 0.16 * focus) * (n.tileScale || 1)
          const ty = hh + lift + bob
          res.tile = [x, ty, z]
          api.tile({ at: res.tile, icon: n.icon, scale: sc, w: n.tileW, sway: Math.sin(t * 0.6 + x) * 0.12, halo: 0.12 + 0.3 * focus + (n.halo || 0), haloColor: n.haloColor })
          if (pop > 0.05) push([x, hh + lift * 0.5, z], () => line([[x, hh, z], [x, ty - 0.45 * sc, z]], rgb(ACL), 2 * U, 0.5 * pop))
        }
        return res
      },
      /**
       * Conexão em arco entre dois pontos, com pulsos de dados. grow (0..1) desenha a linha; focus (0..1) acende;
       * pulses = quantos pulsos (0 desliga). Devolve a curva: at(s) → ponto em s (0..1).
       */
      link(a, b, o2) {
        o2 = o2 || {}
        const d = Math.hypot(b[0] - a[0], b[2] - a[2]), hgt = Math.max(a[1], b[1]) + (o2.lift === undefined ? 0.9 + d * 0.12 : o2.lift)
        const m = [(a[0] + b[0]) / 2, hgt, (a[2] + b[2]) / 2]
        const at = (s) => { const u = 1 - s; return [u * u * a[0] + 2 * u * s * m[0] + s * s * b[0], u * u * a[1] + 2 * u * s * m[1] + s * s * b[1], u * u * a[2] + 2 * u * s * m[2] + s * s * b[2]] }
        const grow = o2.grow === undefined ? 1 : o2.grow, focus = o2.focus || 0, bright = (0.5 + 0.5 * focus) * (o2.dim === undefined ? 1 : o2.dim) + (o2.flash || 0)
        const c = col(o2.color || AC), cl = mixc(c, WHITE, 0.45)
        if (grow > 0) {
          const SEG = o2.segments || 22, pts = []
          for (let s = 0; s <= SEG; s++) pts.push(at((s / SEG) * grow))
          for (let s = 0; s < SEG; s++) {
            const p0 = pts[s], p1 = pts[s + 1]
            push(mul(add(p0, p1), 0.5), () => {
              const pa = proj(p0), pb = proj(p1); if (!pa || !pb) return
              const wz = cam.f / ((pa[2] + pb[2]) / 2)
              ctx.lineCap = 'round'
              ctx.strokeStyle = rgb(c, 0.22 * bright); ctx.lineWidth = Math.max(2, 0.2 * wz); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke()
              ctx.strokeStyle = rgb(mixc(cl, WHITE, Math.min(1, 0.2 + 0.4 * (focus + (o2.flash || 0)))), Math.min(1, 0.55 + 0.45 * bright)); ctx.lineWidth = Math.max(1.2, 0.05 * wz * (1 + 0.5 * focus))
              ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke()
            })
          }
          const np = o2.pulses === undefined ? 3 : o2.pulses
          if (grow >= 1) for (let k = 0; k < np; k++) {
            const ph = (t * (o2.speed || 0.32 + 0.1 * focus) + k / np + (o2.seed || d * 0.37)) % 1
            const p = at(k % 2 ? 1 - ph : ph)
            push(p, () => { ctx.globalCompositeOperation = 'lighter'; glowNow(p, 0.22 + 0.16 * focus, c, Math.min(1, 0.55 + 0.4 * bright)); ctx.globalCompositeOperation = 'source-over' })
          }
        }
        return { at, a, b }
      },
      /** Cometa: um pulso grande com rastro passando por uma curva (link(...).at) na fração p. */
      comet(curve, p, o2) {
        o2 = o2 || {}
        if (p <= 0 || p >= 1) return api
        const c = col(o2.color || AC)
        for (let k = 0; k < 8; k++) { const q = curve.at(Math.max(0, p - k * 0.025)); push(q, () => { ctx.globalCompositeOperation = 'lighter'; glowNow(q, (o2.size || 0.55) * (1 - k / 9), k ? c : WHITE, 0.9 * (1 - k / 9)); ctx.globalCompositeOperation = 'source-over' }) }
        return api
      },
      /** Brilho (luz aditiva) num ponto. */
      glow(p, r, color, a) { push(p, () => { ctx.globalCompositeOperation = 'lighter'; glowNow(p, r, col(color || AC), a === undefined ? 0.6 : a); ctx.globalCompositeOperation = 'source-over' }); return api },
      /** Pessoas andando de from [x, z] até to [x, z] (fluxo contínuo). */
      people(o2) {
        const n = o2.count || 9, a = o2.from, b = o2.to, vis = o2.alpha === undefined ? 1 : o2.alpha
        if (vis <= 0.01) return api
        for (let k = 0; k < n; k++) {
          const ph = (t * (o2.speed || 0.16) + rand(k * 13 + (o2.seed || 0))) % 1, side = (rand(k * 17 + (o2.seed || 0)) - 0.5) * 0.3
          const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
          const x = a[0] + dx * ph - dz / l * side, z = a[1] + dz * ph + dx / l * side
          const fade = Math.min(1, ph * 6, (1 - ph) * 6) * vis, step = Math.abs(Math.sin(t * 5 + k)) * 0.03
          push([x, 0.2, z], () => {
            const head = proj([x, 0.36 + step, z]), feet = proj([x, 0.02 + step, z]); if (!head || !feet) return
            const s = cam.f / head[2]
            ctx.globalAlpha = fade; ctx.fillStyle = rgb(k % 3 ? [235, 233, 226] : ACL)
            roundRect(ctx, feet[0] - 0.07 * s, head[1] + 0.06 * s, 0.14 * s, Math.max(1, feet[1] - head[1] - 0.06 * s), 0.07 * s); ctx.fill()
            ctx.beginPath(); ctx.arc(head[0], head[1], 0.055 * s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
          })
        }
        return api
      },
      /** Onda circular horizontal: phase 0..1 (de r0 a r1, some no fim). ground: true desenha no chão, por baixo de tudo. */
      ripple(o2) {
        const ph = o2.phase; if (ph <= 0 || ph >= 1) return api
        const c = o2.at, r = (o2.r0 || 0.4) + ph * ((o2.r1 || 2.6) - (o2.r0 || 0.4))
        const ring = circPoly(r, 44).map((q) => [c[0] + q[0], c[1], c[2] + q[1]]); ring.push(ring[0])
        const draw = () => line(ring, rgb(col(o2.color || ACL)), (o2.width || 3) * U, (1 - ph) * (o2.alpha === undefined ? 0.85 : o2.alpha))
        if (o2.ground) ground.push(draw); else push(c, draw)
        return api
      },
      /** Coisas subindo de um ponto (corações, estrelas ou curtidas): kind 'coracao' | 'estrela'. */
      floaters(o2) {
        const n = o2.count || 7, c = o2.at, vis = o2.alpha === undefined ? 1 : o2.alpha
        if (vis <= 0.01) return api
        for (let k = 0; k < n; k++) {
          const ph = (t * (o2.speed || 0.42) + k / n) % 1
          const x = c[0] + Math.sin(k * 2.1 + t * 1.2) * 0.45, y = c[1] + ph * (o2.rise || 1.8), z = c[2] + Math.cos(k * 1.7) * 0.3
          push([x, y, z], () => {
            const q = proj([x, y, z]); if (!q) return
            const s = cam.f / q[2] * (o2.size || 0.2) * (0.6 + 0.4 * ease.outBack(clamp(ph * 4)))
            ctx.globalAlpha = Math.min(1, (1 - ph) * 2) * vis; ctx.fillStyle = o2.color || (o2.kind === 'estrela' ? '#FFB800' : '#FF3B6B')
            if (o2.kind === 'estrela') { ctx.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? s * 0.42 : s, a = j * Math.PI / 5 - Math.PI / 2; ctx.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r) } ctx.closePath(); ctx.fill() }
            else { ctx.beginPath(); ctx.moveTo(q[0], q[1] + s * 0.9); ctx.bezierCurveTo(q[0] - s * 1.3, q[1] - s * 0.1, q[0] - s * 0.55, q[1] - s * 1.0, q[0], q[1] - s * 0.35); ctx.bezierCurveTo(q[0] + s * 0.55, q[1] - s * 1.0, q[0] + s * 1.3, q[1] - s * 0.1, q[0], q[1] + s * 0.9); ctx.fill() }
            ctx.globalAlpha = 1
          })
        }
        return api
      },
      /** Desenho 2D livre num ponto 3D, na ordem de profundidade: fn(ctx, x, y, escala, profundidade). */
      sprite(p, fn) { push(p, () => { const q = proj(p); if (q) fn(ctx, q[0], q[1], cam.f / q[2], q[2]) }); return api },
      /** Linha 3D (lista de pontos), na ordem de profundidade. */
      line(pts, color, width, alpha) { push(mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length), () => line(pts, color || rgb(ACL), (width || 2) * U, alpha)); return api },
      /** Rua no chão, de [x, z] a [x, z], com faixa acesa. */
      road(a, b, w, o2) {
        o2 = o2 || {}
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, wid = w || 0.5, nx = -dz / l * wid / 2, nz = dx / l * wid / 2
        ground.push(() => {
          poly([[a[0] + nx, 0.003, a[1] + nz], [b[0] + nx, 0.003, b[1] + nz], [b[0] - nx, 0.003, b[1] - nz], [a[0] - nx, 0.003, a[1] - nz]], o2.color || '#1D2238')
          if (o2.lane !== false) line([[a[0], 0.006, a[1]], [b[0], 0.006, b[1]]], rgb(AC), 1.6 * U, 0.35 * (o2.alpha === undefined ? 1 : o2.alpha))
        })
        if (o2.lane !== false) { const ph = (t * 0.35 + (o2.seed || 0)) % 1; ground.push(() => glowNow([a[0] + dx * ph, 0.02, a[1] + dz * ph], 0.25, AC, 0.5 * (o2.alpha === undefined ? 1 : o2.alpha))) }
        return api
      },
      /**
       * Quarteirões baixos (chips) preenchendo a placa, fora de avoid [[x, z, raio]] e das ruas roads [[ax, az, bx, bz]].
       * rise: segundo em que a cidade sobe a partir do centro (omitido: já de pé).
       */
      city(o2) {
        o2 = o2 || {}
        const ext = o2.extent || 4.95, seed = o2.seed || 1
        const key = 'city:' + seed + ':' + ext + ':' + JSON.stringify(o2.avoid || []) + JSON.stringify(o2.roads || [])
        let list = texCache.get(key)
        if (!list) {
          list = []
          const segDist = (px, pz, r) => { const vx = r[2] - r[0], vz = r[3] - r[1]; const k = clamp(((px - r[0]) * vx + (pz - r[1]) * vz) / (vx * vx + vz * vz || 1)); return Math.hypot(px - r[0] - vx * k, pz - r[1] - vz * k) }
          let n = seed * 1000
          const steps = Math.floor(ext)
          for (let gx = -steps; gx <= steps; gx++) for (let gz = -steps; gz <= steps; gz++) {
            n++
            const x = gx * 0.98 + (rand(n * 3) - 0.5) * 0.18, z = gz * 0.98 + (rand(n * 5) - 0.5) * 0.18
            if (Math.max(Math.abs(x), Math.abs(z)) > ext) continue
            if ((o2.avoid || []).some((a) => Math.hypot(x - a[0], z - a[1]) < a[2])) continue
            if ((o2.roads || []).some((r) => segDist(x, z, r) < 0.62)) continue
            if (rand(n * 7) < (o2.gaps === undefined ? 0.3 : o2.gaps)) continue
            list.push({ x, z, w: 0.5 + rand(n * 13) * 0.3, d: 0.5 + rand(n * 17) * 0.3, h: 0.14 + Math.pow(rand(n * 11), 2.2) * (o2.height || 1.15), glow: rand(n * 19) < 0.22, delay: Math.hypot(x, z) * 0.1 + rand(n) * 0.25 })
          }
          texCache.set(key, list)
        }
        for (const fl of list) {
          const g = o2.rise === undefined ? 1 : ease.outCubic(clamp((t - o2.rise - fl.delay) / 0.7))
          api.block({ x: fl.x, z: fl.z, w: fl.w, d: fl.d, h: fl.h * g, color: '#262C4A', top: fl.glow ? toHex(mixc(AC, WHITE, 0.15 + 0.15 * Math.sin(t * 0.9 + fl.x))) : '#363E62', emit: fl.glow, shape: 'caixa', radius: 0.06, shadowAlpha: 0.18 })
        }
        return api
      },
      /**
       * A placa do mini componente (chão do mundo), com trilhas de circuito e, opcional, camadas por baixo que se
       * abrem em escada: layers [{ kind: 'texto' | 'grade' | 'botao' | 'vazio', lit (0..1), at (segundo em que acende) }],
       * open (0..1) abre as camadas.
       */
      plate(o2) {
        o2 = o2 || {}
        const size = o2.size || 11.2, pl = rrPoly(size, size, o2.radius || 1.4, 5), open = o2.open || 0
        const th = o2.thickness || 0.42, top = col(o2.color || '#141829'), side = col(o2.side || '#0C0F1C')
        const dir = o2.openDir || [-1.25, 0.3], sep = open * (o2.gap || 2.9)
        slabs.push({ y0: -th, y1: 0, ox: 0, oz: 0, top, side, kind: 'cidade', lit: 0, pl })
        ;(o2.layers || []).forEach((L, i) => {
          const k = i + 1
          slabs.push({ y0: -th - k * 0.44 - sep * k, y1: -th - k * 0.44 - sep * k + 0.36, ox: dir[0] * open * k, oz: dir[1] * open * k, top: col(L.color || '#1F2644'), side: col(L.side || '#10142A'), kind: L.kind || 'vazio', lit: L.lit || 0, at: L.at, pl, open })
        })
        if (o2.traces !== false) {
          const key = 'traces:' + (o2.seed || 1) + ':' + size
          let tr = texCache.get(key)
          if (!tr) {
            tr = []; const ext = size / 2 - 0.4, sd = o2.seed || 1
            for (let k = 0; k < (o2.traces || 34); k++) {
              let x = Math.round((rand(k * 31 + sd) * 2 - 1) * 5) * 0.98, z = Math.round((rand(k * 37 + sd) * 2 - 1) * 5) * 0.98
              const pts = [[x, z]]
              for (let s = 0; s < 3; s++) { const len = (1 + Math.floor(rand(k * 41 + s + sd) * 3)) * 0.49; if ((s + k) % 2) x += (rand(k * 43 + s + sd) < 0.5 ? -1 : 1) * len; else z += (rand(k * 47 + s + sd) < 0.5 ? -1 : 1) * len; x = Math.max(-ext, Math.min(ext, x)); z = Math.max(-ext, Math.min(ext, z)); pts.push([x, z]) }
              tr.push(pts)
            }
            texCache.set(key, tr)
          }
          const show = o2.tracesAlpha === undefined ? 1 : o2.tracesAlpha
          ground.unshift(() => tr.forEach((p, k) => {
            const a = (0.22 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.9 + k))) * show
            line(p.map((q) => [q[0], 0.005, q[1]]), rgb(AC), 1.4 * U, a)
            const e = p[p.length - 1]; glowNow([e[0], 0.01, e[1]], 0.12, AC, a)
          }))
        }
        api._plateOpen = open
        return api
      },
      /** Desenha tudo na ordem certa. Chame no fim. */
      render() {
        // fundo
        const g = ctx.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, rgb(mixc(BGc, AC, 0.16))); g.addColorStop(0.55, rgb(BGc)); g.addColorStop(1, rgb(mixc(BGc, [0, 0, 0], 0.5)))
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        const o0 = proj([0, -0.5, 0])
        if (o0) { const r = Math.max(W, H) * 0.75, q = ctx.createRadialGradient(o0[0], o0[1], 0, o0[0], o0[1], r); q.addColorStop(0, rgb(AC, 0.32)); q.addColorStop(0.4, rgb(AC, 0.08)); q.addColorStop(1, rgb(AC, 0)); ctx.fillStyle = q; ctx.fillRect(0, 0, W, H) }
        if (o.dust !== false) for (let k = 0; k < 46; k++) {
          const px = ((rand(k * 3 + 1) * 1.6 - cam.yaw * 0.08) % 1.6 + 1.6) % 1.6 - 0.3, py = rand(k * 5 + 2) * 1.1 - 0.05 + Math.sin(t * 0.2 + k) * 0.01
          ctx.fillStyle = rgb(ACL, (0.18 + 0.4 * rand(k * 7)) * (0.6 + 0.4 * Math.sin(t * 0.8 + k * 1.7)))
          ctx.beginPath(); ctx.arc(px * W, py * H, (1 + 2.2 * rand(k * 9)) * U, 0, Math.PI * 2); ctx.fill()
        }
        // camadas de baixo, a placa e o chão
        const camY = cam.pos[1]
        const city = slabs[0], under = slabs.slice(1)
        const open = api._plateOpen || 0
        const drawSlab = (S) => {
          const lc = [S.ox, (S.y0 + S.y1) / 2, S.oz]
          solid(extrude(S.pl, S.y0, S.y1, vert(S.ox, S.oz)), lc, toHex(S.side), { top: toHex(mixc(S.top, AC, 0.25 * S.lit)) })
          const ring = S.pl.map((q) => [q[0] + S.ox, S.y1 + 0.002, q[1] + S.oz]); ring.push(ring[0])
          line(ring, rgb(AC), (S.kind === 'cidade' ? 2.4 : 2) * U, S.kind === 'cidade' ? 0.65 : 0.35 + 0.6 * S.lit + 0.25 * open)
          if (S.kind !== 'cidade') decal(S)
        }
        under.filter((S) => S.y1 < camY).sort((a, b) => a.y1 - b.y1).forEach(drawSlab)
        if (city) {
          drawSlab(city)
          const ring = city.pl.map((q) => [q[0], city.y0, q[1]]); ring.push(ring[0])
          line(ring, rgb(AC), 1.6 * U, 0.35 + 0.4 * open)
        }
        ground.forEach((f) => f()); shadows.forEach((f) => f())
        if (open > 0.02) {
          ctx.globalCompositeOperation = 'lighter'
          under.forEach((S, i) => { const up = slabs[i]; for (let k = 0; k < 4; k++) {
            const x = [-3, 3, -3, 3][k] * 0.9, z = [-3, -3, 3, 3][k] * 0.9
            line([[x + S.ox, S.y1, z + S.oz], [x + up.ox, up.y0, z + up.oz]], rgb(AC), 2.4 * U, 0.35 * open * (0.4 + S.lit))
            const ph = (t * 0.8 + k * 0.25 + i * 0.1) % 1
            glowNow([x + S.ox + (up.ox - S.ox) * ph, S.y1 + (up.y0 - S.y1) * ph, z + S.oz + (up.oz - S.oz) * ph], 0.18, AC, 0.7 * open)
          } })
          ctx.globalCompositeOperation = 'source-over'
        }
        items.sort((a, b) => b.z - a.z)
        for (const it of items) it.fn()
        under.filter((S) => S.y1 >= camY).sort((a, b) => b.y1 - a.y1).forEach(drawSlab)
        if (o.vignette !== false) { const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H) }
      },
    }
    // conteúdo das camadas: texto (linhas), grade (organização) e botão (com clique)
    function decal(S) {
      const lit = S.lit, open = S.open || 0, vis = Math.max(open, lit)
      if (vis < 0.01) return
      const y = S.y1 + 0.006, sh = (pts) => pts.map((q) => [q[0] + S.ox, q[1], q[2] + S.oz])
      const lp = (pts, fill) => poly(sh(pts), fill), ll = (pts, c, w, a) => line(sh(pts), c, w, a)
      const since = (d) => (S.at === undefined ? 1 : clamp((t - S.at - d) / 0.5))
      const fill = rgb(mixc([92, 102, 160], mixc(ACL, WHITE, 0.35), lit), 0.5 + 0.5 * Math.max(lit, open * 0.6))
      if (S.kind === 'texto') {
        for (let r = 0; r < 9; r++) {
          const b0 = 3.7 - r * 0.86, w = 2.6 + rand(r * 7 + 3) * 4.6, a0 = 4.3, th = r === 0 ? 0.55 : 0.26
          const ww = w * Math.max(open * 0.6, ease.outCubic(since(r * 0.05))) * (r === 0 ? 0.8 : 1)
          lp([[b0, y, a0], [b0, y, a0 - ww], [b0 - th, y, a0 - ww], [b0 - th, y, a0]], fill)
        }
      } else if (S.kind === 'grade') {
        for (let gx = 0; gx < 3; gx++) for (let gz = 0; gz < 3; gz++) {
          const s = 1.45 * (0.55 + 0.45 * Math.max(open * 0.7, ease.outBack(since((gx + gz) * 0.06))))
          const x = -3.1 + gx * 3.1, z = -3.1 + gz * 3.1
          lp(rrPoly(s * 1.5, s * 1.5, 0.22, 3).map((q) => [x + q[0], y, z + q[1]]), fill)
          if (lit > 0.01) lp(rrPoly(s * 1.1, s * 0.28, 0.1, 2).map((q) => [x + q[0], y + 0.004, z + q[1] + s * 0.4]), rgb(WHITE, 0.5 * lit))
        }
      } else if (S.kind === 'botao') {
        const tb = S.at === undefined ? -99 : S.at
        const press = Math.sin(clamp((t - tb - 0.35) / 0.35) * Math.PI) * lit, s = 1 - press * 0.06
        lp(rrPoly(6.0 * s, 1.7 * s, 0.85 * s, 6).map((q) => [q[1] - 2.3, y, -q[0]]), rgb(mixc([60, 66, 100], AC, Math.max(lit, open * 0.35)), 0.55 + 0.45 * Math.max(lit, open * 0.5)))
        lp(rrPoly(3.0, 0.32, 0.16, 2).map((q) => [q[1] - 2.3, y + 0.004, -(q[0] - 0.4)]), rgb(WHITE, 0.35 + 0.6 * lit))
        const cx = -2.5 - (1 - ease.outCubic(clamp((t - tb + 0.2) / 0.5))) * 1.6, cz = -1.9
        lp([[cx, y + 0.01, cz], [cx - 1.0, y + 0.01, cz], [cx - 0.76, y + 0.01, cz - 0.26], [cx - 1.1, y + 0.01, cz - 0.5], [cx - 1.0, y + 0.01, cz - 0.66], [cx - 0.68, y + 0.01, cz - 0.44], [cx - 0.66, y + 0.01, cz - 0.76]], rgb(WHITE, 0.3 + 0.7 * Math.max(lit, open * 0.4)))
        if (press > 0.01) for (let k = 0; k < 2; k++) {
          const ph = clamp((t - tb - 0.45 - k * 0.25) / 1.1)
          if (ph > 0 && ph < 1) { const ring = circPoly(0.8 + ph * 3.5, 40).map((q) => [q[0] * 0.7 - 2.3, y + 0.01, q[1] * 1.6]); ring.push(ring[0]); ll(ring, rgb(ACL), 3 * U, (1 - ph) * 0.9) }
        }
      }
    }
    return api
  }

  /** Roda o quadro com rastro de velocidade só quando a câmera anda rápido. frame(ctx, t) monta e desenha o mundo. */
  function run(ctx, t, env, camera, frame, o) {
    o = o || {}
    const W = env.width, H = env.height
    const a = cameraAt(camera, t, W, H, o.drift), b = cameraAt(camera, t + 1 / 30, W, H, o.drift)
    const speed = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]) * 30 / Math.max(4, a.dist)
    if (o.blur !== false && speed > (o.blurAt || 0.55)) blurFrame(ctx, t, 3, 1 / 40, (c, tt) => frame(c, Math.max(0, tt)))
    else frame(ctx, t)
  }

  /** Segundo em que uma palavra é falada (env.data.words), a partir de after; sem achar, devolve fallback. */
  function wordAt(env, word, after, fallback) {
    const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
    const w = norm(word), list = (env.data && env.data.words) || []
    const f = list.find((x) => x.s >= (after || 0) && norm(x.w) === w)
    return f ? f.s : fallback
  }

  return { world, run, camera: cameraAt, icons: Object.keys(ICONS).filter((k) => !WIDE[k]).concat(['logo', 'logo_escuro']), browser, wordAt }
})()
`
