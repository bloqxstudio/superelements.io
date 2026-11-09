// Cidade tecnológica conectada (Avence), feita com lib.d3: o centro com o logo ligado a cinco pontas.
scene({
  fonts: ['Inter Tight'],
  draw(ctx, t, env) {
    const L = env.lib, D = L.d3, E = L.ease
    const P = env.data?.params || {}
    const DUR = env.duration || 31.6
    const st = [0, 4.5, 10.9, 14.86, 18.12, 25.24].map((d, i) => env.data?.parts?.[i]?.start ?? d)
    const tTexto = D.wordAt(env, 'texto', st[4], st[4] + 2.7), tOrg = D.wordAt(env, 'organização', st[4], st[4] + 3.2)
    const tBot = D.wordAt(env, 'botão', st[4], st[4] + 4.2), tCon = D.wordAt(env, 'conectar', st[5], st[5] + 0.3)
    const prog = (x, a, b, e = E.inOutCubic) => e(L.clamp((x - a) / (b - a)))

    // Câmera: um ângulo por etapa, numa trajetória contínua (yaw sempre girando para o mesmo lado)
    const CAM = [
      [0, { at: [0, 0.2, 0], yaw: -40, pitch: 72, dist: 25, fov: 50 }],
      [st[1] * 0.55, { at: [0, 0.7, 0], yaw: -62, pitch: 50, dist: 20.5 }],
      [st[1] - 0.15, { at: [0, 1.1, 0], yaw: -95, pitch: 34, dist: 17.5 }],
      [st[1] + 1.7, { at: [-2.7, 1.6, -2.0], yaw: -128, pitch: 17, dist: 9.2, fov: 52 }],
      [st[1] + 4.0, { at: [0, 1.8, -2.3], yaw: -172, pitch: 21, dist: 11 }],
      [st[2] - 1.1, { at: [2.7, 1.6, -2.3], yaw: -208, pitch: 18, dist: 8.8 }],
      [st[2] + 1.5, { at: [3.0, 1.25, 2.4], yaw: -346, pitch: 7, dist: 6.4, fov: 50 }],
      [st[3] - 0.25, { at: [3.0, 1.15, 2.4], yaw: -362, pitch: 5, dist: 5.7 }],
      [st[3] + 1.4, { at: [1.7, 2.3, 3.4], yaw: -385, pitch: 15, dist: 6.8, fov: 52 }],
      [st[4] - 0.35, { at: [0.1, 2.3, 3.9], yaw: -410, pitch: 13, dist: 7.6 }],
      [st[4] + 1.8, { at: [-0.6, -3.4, 0.2], yaw: -428, pitch: 26, dist: 22.5 }],
      [tTexto - 0.2, { at: [-0.9, -4.8, 0.3], yaw: -440, pitch: 24, dist: 22.5 }],
      [tBot + 0.6, { at: [-1.0, -5.2, 0.3], yaw: -452, pitch: 22, dist: 22 }],
      [st[5] + 0.2, { at: [0, -0.6, 0], yaw: -470, pitch: 28, dist: 18 }],
      [st[5] + 2.2, { at: [0, 1.2, 0], yaw: -492, pitch: 33, dist: 18, fov: 50 }],
      [DUR - 1.6, { at: [0, 2.6, 0], yaw: -528, pitch: 18, dist: 9.6 }],
      [DUR, { at: [0, 2.75, 0], yaw: -536, pitch: 15, dist: 8.6 }],
    ]

    D.run(ctx, t, env, CAM, (c, time) => {
      const w = D.world(c, time, env, { camera: CAM, background: P.fundo ?? '#070912', accent: P.destaque ?? '#2B3CF0', dust: P.particulas ?? true })
      const part = st.reduce((acc, s, i) => (time >= s - 0.001 ? i : acc), 0)
      const open = prog(time, st[4] + 0.5, st[4] + 2.0) * (1 - prog(time, st[5] - 0.1, st[5] + 1.3))
      const lit = (at) => prog(time, at - 0.05, at + 0.35, E.outCubic) * (1 - prog(time, st[5] - 0.2, st[5] + 0.6))
      const hubBoost = prog(time, st[5] + 0.2, st[5] + 1.4, E.outCubic)

      w.plate({ open, layers: [{ kind: 'texto', lit: lit(tTexto), at: tTexto }, { kind: 'grade', lit: lit(tOrg), at: tOrg }, { kind: 'botao', lit: lit(tBot), at: tBot }], tracesAlpha: L.clamp(time / 1.2) })

      // As pontas: [nome, x, z, altura, forma, ícone, etapas em foco]
      const SPOTS = [
        ['hub', 0, 0, 1.25, 'nucleo', 'logo', [0, 5]],
        ['ads', -3.0, -2.2, 2.7, 'torre', 'anuncio', [1]],
        ['ig', 2.9, -2.5, 2.0, 'recuo', 'instagram', [1]],
        ['cri', -3.1, 2.4, 1.45, 'estudio', 'criativo', []],
        ['site', 3.0, 2.3, 1.95, 'largo', 'site', [2]],
        ['chat', 0, 3.9, 1.7, 'cilindro', 'atendimento', [3]],
      ]
      w.city({ rise: 0.15, avoid: SPOTS.map((s) => [s[1], s[2], s[0] === 'hub' ? 2.0 : 1.55]), roads: [...SPOTS.slice(1).map((s) => [0, 0, s[1], s[2]]), [-5.6, -2.2, -3.0, -2.2], [-3.0, -5.6, -3.0, -2.2]] })
      SPOTS.slice(1).forEach((s, i) => w.road([0, 0], [s[1], s[2]], 0.5, { seed: i * 0.2, alpha: L.clamp((time - 0.35) / 0.9) }))
      w.road([-5.5, -2.2], [-3.0, -2.2], 0.5, { lane: false }); w.road([-3.0, -5.5], [-3.0, -2.2], 0.5, { lane: false })

      const N = {}
      SPOTS.forEach(([id, x, z, h, shape, icon, focusParts], i) => {
        const k = i === 0 ? 2.2 : i - 1
        const grow = E.outBack(L.clamp((time - 0.35 - k * 0.14) / 0.9))
        const pop = E.outBack(L.clamp((time - 0.9 - i * 0.14) / 0.6))
        const focus = focusParts.includes(part) ? prog(time, st[part], st[part] + 0.6, E.outCubic) : 0
        N[id] = w.node({ x, z, h, shape, icon, grow, pop, focus, band: id === 'ig' ? '#E1306C' : id === 'chat' ? '#22C55E' : undefined, tileW: id === 'hub' ? 1.75 : undefined, tileScale: id === 'hub' ? 1 + 0.28 * hubBoost : 1, lift: id === 'hub' ? 1.15 + 0.25 * hubBoost : undefined, halo: id === 'hub' ? 0.35 * hubBoost : 0 })
      })
      // Tela viva do site: a página monta e ganha estrelas e selo
      if (N.site.screen) w.panel({ id: 'site', corners: N.site.screen, nudge: [0, 0, 0.05], draw: (g, W, H) => D.browser(g, W, H, prog(time, st[2] - 0.2, st[2] + 2.9, E.linear), w.accent, time) })

      // Conexões: do centro a cada ponta e em anel entre as pontas
      const dim = 1 - 0.55 * open
      const focusOf = (parts) => { const prev = parts.includes(part - 1) ? 1 : 0, cur = parts.includes(part) ? 1 : 0; return prev + (cur - prev) * prog(time, st[part], st[part] + 0.7) }
      const wave = (d) => Math.max(0, 1 - Math.abs(time - (tCon + 0.3 + d)) / 0.5)
      const LINKS = [['hub', 'ads', [1]], ['hub', 'ig', [1]], ['hub', 'cri', []], ['hub', 'site', [2]], ['hub', 'chat', [3]], ['ads', 'ig', [1]], ['ig', 'site', [2]], ['site', 'chat', [3]], ['chat', 'cri', []], ['cri', 'ads', []]]
      const curves = {}
      LINKS.forEach(([a, b, fp], i) => {
        const start = i < 5 ? 1.55 + i * 0.16 : 2.6 + (i - 5) * 0.15
        curves[a + b] = w.link(N[a].top, N[b].top, { grow: prog(time, start, start + 0.85), focus: focusOf(fp), dim, flash: 0.6 * wave(a === 'hub' ? 0 : 0.5) * dim })
      })

      // Etapa 2: público chegando ao anúncio, ondas de alcance e curtidas no Instagram
      const crowd = prog(time, st[1] - 0.2, st[1] + 0.6) * (1 - prog(time, st[2] + 0.5, st[2] + 1.2))
      w.people({ from: [-5.4, -2.2], to: [-3.75, -2.2], count: 9, alpha: crowd, seed: 1 })
      w.people({ from: [-3.0, -5.4], to: [-3.0, -3.0], count: 9, alpha: crowd, seed: 2 })
      if (time > st[1]) for (let k = 0; k < 3; k++) w.ripple({ at: [N.ads.top[0], N.ads.top[1] + 0.05, N.ads.top[2]], phase: ((time - st[1]) * 0.55 + k / 3) % 1, r0: 0.4, r1: 2.8, alpha: 0.8 * crowd })
      if (time > st[1] + 1) w.floaters({ at: [2.9, N.ig.tile[1] + 0.6, -2.5], kind: 'coracao', alpha: crowd })
      // Criativos viajando do estúdio até o anúncio
      if (time > 3.4) for (let k = 0; k < 3; k++) {
        const ph = ((time - 3.4) * 0.22 + k / 3) % 1, p = curves.criads.at(1 - ph)
        w.sprite(p, (g, x, y, s) => { const r = s * 0.16; g.save(); g.translate(x, y); g.rotate(Math.sin(time + k) * 0.3); g.globalAlpha = Math.min(1, ph * 5, (1 - ph) * 5) * (1 - open); g.fillStyle = '#FFFFFF'; L.roundRect(g, -r, -r * 1.2, r * 2, r * 2.4, r * 0.25); g.fill(); g.fillStyle = '#FFB02E'; L.roundRect(g, -r * 0.75, -r * 0.95, r * 1.5, r * 1.2, r * 0.12); g.fill(); g.restore() })
      }

      // Etapa 4: o contato sai do site como cometa e vira conversa no atendimento
      w.comet(curves.sitechat, prog(time, st[3] + 0.25, st[3] + 2.2))
      const arrive = st[3] + 2.2, out = 1 - prog(time, st[4] + 0.2, st[4] + 0.8, E.inCubic), base = N.chat.tile[1]
      const side = (dx, dy) => [w.cam.right[0] * dx, base + dy, 3.9 + w.cam.right[2] * dx]
      const b1 = E.outBack(L.clamp((time - arrive + 0.1) / 0.45)) * out, b2 = E.outBack(L.clamp((time - arrive - 1.2) / 0.45)) * out
      const typing = time > arrive + 0.5 && time < arrive + 1.2 ? E.outBack(L.clamp((time - arrive - 0.5) / 0.35)) * out : 0
      w.tile({ at: side(-0.72, 0.95), icon: 'msg_in', w: 1.35, scale: b1, sway: -0.1 })
      if (b2 > 0.01) w.tile({ at: side(0.62, 1.7), icon: 'msg_out', w: 1.35, scale: b2, sway: 0.1, halo: 0.25, haloColor: '#22C55E' })
      else w.tile({ at: side(0.62, 1.7), icon: 'digitando', w: 1.0, scale: typing, sway: 0.1 })
      if (time > arrive - 0.1 && time < arrive + 1.2) { const k = L.clamp((time - arrive + 0.1) / 1.3); w.glow([0, base, 3.9], 1.2 + 2 * k, '#22C55E', 0.6 * (1 - k)) }

      // Fecho: ondas saindo do centro
      for (let k = 0; k < 3; k++) w.ripple({ at: [0, 0.01, 0], phase: L.clamp((time - tCon - k * 0.45) / 2.0), r0: 1.2, r1: 6.4, width: 4, ground: true })

      w.render()
      const fade = 1 - prog(time, 0, 0.6, E.outCubic)
      if (fade > 0) { c.fillStyle = 'rgba(7,9,18,' + fade + ')'; c.fillRect(0, 0, env.width, env.height) }
    })
  },
})
