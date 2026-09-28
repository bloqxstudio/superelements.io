# Vídeo ProcessBase 4:5: como renderizar de novo

O vídeo é um palco HTML (`stage.html`, 1080 × 1350) animado com GSAP. Ele roda os scripts reais da página (grafo do hero e emblema 3D) e mostra o site de verdade em dois iframes, desktop e celular, com a história do scroll funcionando.

A gravação é quadro a quadro: `vt.js` troca o relógio da página (rAF, timers, Date, performance.now e animações CSS) por um relógio virtual. Cada quadro sai no tempo exato, mesmo que a captura seja lenta. Os quadros são capturados em 2× e o ffmpeg reduz para 1080 × 1350, H.264 a 30 fps.

Na pasta desta fonte, com o repo em `C:/Users/Saipos/ShipStudio/superelements-io`:

1. Gerar a página e os scripts a partir do template:
   `../../../node_modules/.bin/esbuild entry.ts --bundle --platform=node --format=esm --outfile=build.mjs --alias:@=../../../src && node build.mjs`
2. Subir o servidor local (porta 5199, que serve esta pasta em `/reel/` e o `public/` do repo):
   `node server.mjs`
3. Conferir quadros soltos (saem em `stills/`): `node record.mjs stills 3,6.4,17.3,25`
4. Gravar: `node record.mjs video processbase-video-4x5.mp4`

Precisa de internet: o GSAP vem do jsDelivr, e a página usa Google Fonts e Font Awesome. O Playwright usado é o `playwright-core` 1.63 do cache do npx, com o Chrome instalado.

Textos e tempos das cenas ficam em `stage.html` (`__setup`). A copy dos pilares e do hero é a do template (`src/features/space/processbaseTemplate.ts`).
