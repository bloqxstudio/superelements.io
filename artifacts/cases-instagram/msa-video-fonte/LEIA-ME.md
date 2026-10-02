# Vídeo MSA 4:5: como renderizar de novo

O vídeo é um palco HTML (`stage.html`, 1080 × 1350): marca em cima, a homepage MSA de verdade no meio (iframe em 1120 × 1167, reduzido a 90%) e as cinco partes da página embaixo, com a linha sálvia enchendo conforme o scroll. A página roda o próprio movimento: preloader, entrada do hero, `.msa-rise`, fotos do Henrique e a marca do rodapé.

A gravação é quadro a quadro: `vt.js` troca o relógio da página (rAF, timers, Date, performance.now e animações CSS) por um relógio virtual. O relógio da página só começa quando a gravação começa, então o preloader aparece inteiro no vídeo. Os quadros são capturados em 2× e o ffmpeg reduz para 1080 × 1350, H.264 a 30 fps.

Na pasta desta fonte, com o repo em `C:/Users/Saipos/ShipStudio/superelements-io`:

1. Gerar a página a partir do template:
   `../../../node_modules/.bin/esbuild entry.ts --bundle --platform=node --format=esm --outfile=build.mjs --alias:@=../../../src && node build.mjs`
2. Subir o servidor local (porta 5199, que serve esta pasta em `/reel/` e o `public/` do repo):
   `node server.mjs`
3. Conferir quadros soltos (saem em `stills/`): `node record.mjs stills 3.6,12.5,19.5,38`
4. Gravar: `node record.mjs video ../msa-video-4x5.mp4`

Precisa de internet: o GSAP da página vem do jsDelivr (o do palco é a cópia local `gsap.min.js`). O Playwright usado é o `playwright-core` 1.63 do cache do npx, com o Chrome instalado.

Tempos do scroll e textos do fecho ficam em `stage.html` (`__setup` e a seção `.end`). A página vem de `src/features/space/msaTemplate.ts`; mudou o template, rode o passo 1 de novo.
