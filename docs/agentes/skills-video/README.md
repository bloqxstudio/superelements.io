# Skills de vídeo (referência)

Cinco skills recebidas do usuário em 2026-11-09 (`effects-*.zip`), guardadas aqui como especificação. Cada uma descreve um efeito de vídeo falado montado fora do app (ffmpeg, Whisper, RobustVideoMatting e Remotion).

O usuário escolheu levar os efeitos para o estúdio de vídeo e quer, mais adiante, ter "skills para vídeos dentro da plataforma". Estes arquivos são o ponto de partida para isso.

| Skill | No estúdio (estilo "Efeitos com recorte", `explicativo/engine.ts`) |
| --- | --- |
| `effects-title` | `texto-fundo` (já existia) |
| `effects-orbit` | `orbita-cartoes` (e `orbita`, que gira a palavra de destaque) |
| `effects-carousel` | `carrossel` |
| `effects-split` | `tela-dividida` |
| `effects-chart` | `grafico` |

No app, os efeitos usam a marca da conta (cores, fontes e logo) em vez das cores fixas das skills. O recorte da pessoa roda no navegador, pelo MediaPipe (`recorte.ts`), e não pelo RobustVideoMatting. As fotos do vídeo viram os cartões.
