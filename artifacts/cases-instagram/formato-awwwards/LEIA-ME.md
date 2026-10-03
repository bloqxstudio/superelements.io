# Formato "tela flutuante" para os cases

É o formato dos posts de Site of the Day da Awwwards: o site real, numa tela no centro do quadro, sobre um fundo desfocado dele mesmo, rolando de seção em seção com easing. Não leva texto, marca nem card: é só o site.

Tudo é feito em JS:

- O site abre num Edge headless com o relógio virtual (`scripts/space/vt.js`). rAF, timers, Date e animações CSS só andam quando o gravador manda, então cada quadro sai no tempo exato e as animações (GSAP, ScrollTrigger, entradas do Elementor) ficam lisas, por mais que a captura demore.
- A rolagem segue o plano (`planos/<case>.json`): cada passo vai até uma parada com easing e espera um pouco nela.
- O palco (`palco.html`) compõe cada quadro num canvas: o fundo é o próprio quadro do site, cortado, reduzido e desfocado, com 55% de preto por cima; a tela fica no centro, com sombra.
- O ffmpeg só junta os quadros prontos no .mp4 (H.264, 30 fps). Ele não grava a tela.

## Gravar

Na pasta `artifacts/cases-instagram/formato-awwwards/`:

- Vídeo 4:5 (1080 × 1350): `node gravar.mjs planos/processbase.json`
- Outro formato: `--formato 1x1` (1080 × 1080) ou `--formato 9x16` (1080 × 1920)
- Conferir só alguns segundos, sem gerar vídeo: `--quadros 3,9.5,20` (as fotos saem em `quadros/`)
- Outro arquivo: `--out ../arquivo.mp4`

O vídeo sai em `artifacts/cases-instagram/<nome>-tela-<formato>.mp4`. A gravação também salva seis quadros de conferência em `quadros/`. O vídeo da ProcessBase (34 s, 1032 quadros) leva uns 2 min e 40 s.

## Plano de um case novo

Copie `planos/processbase.json` e mude:

- `url`: o site publicado;
- `tela`: o tamanho da janela do site (1440 × 900 é o desktop);
- `inicio`: segundos parados no topo (entrada do hero);
- `passos`: cada um com `ate` (px, `"fim"` ou um seletor CSS, que para no topo do elemento), `dur` (segundos da rolagem), `pausa` (segundos parado depois) e, se quiser, `ease` (`suave`, o padrão; `forte` ou `linear`);
- `trocar` (opcional): endereços que o site publicado pede mas que só existem no repo, servidos dos arquivos locais.

Nas histórias com ScrollTrigger, ponha uma parada em cada momento da história (no fim de cada `start`/`end`). Assim cada etapa toca como uma animação e para antes da próxima.

## ProcessBase

- Paradas: o grafo forma o emblema, o emblema gira e acende o pilar 1, os pilares 2, 3 e 4, depois O que muda, Como funciona, O que fica, Quem conduz, Dúvidas, formulário e rodapé.
- `trocar` está no plano porque o site publicado (02/10/2026) pede duas SVGs em `http://localhost:53471/`: o gráfico de "Capacidade de execução" e o símbolo do rodapé. O WordPress recusou as SVGs e a publicação manteve o endereço local, então no site essas imagens aparecem quebradas. O vídeo usa os arquivos de `public/brands/processbase/`. Corrigido o site, o `trocar` pode sair do plano.
