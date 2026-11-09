---
name: effects-orbit
description: Cards de imagens ou vídeos girando em órbita 3D ao redor da pessoa recortada (atrás e na frente), em Remotion. Use em /effects-orbit.
---

# Effects Orbit

Cards de imagens ou vídeos girando em órbita 3D ao redor da pessoa recortada (atrás e na frente), em Remotion. Saída: MP4 1080×1920, 30 fps, com o áudio original.

## Uso

```
/effects-orbit [opções]
```

Precisa de: vídeo + 5 a 8 imagens/vídeos para os cards. Se faltar, peça (uma pergunta só).

Opções em texto livre: cor de destaque, trecho do vídeo (ex.: "só de 0 a 5s"), duração do efeito, fonte.

## Regras gerais

- Fale em português, curto. Não explique o processo; entregue o vídeo.
- Nunca invente números, dados ou nomes que a pessoa não falou. Gráfico só com números da fala ou fornecidos pelo usuário. Sem número, use texto/ícone/lista.
- Sincronia é o que vende o efeito: todo elemento entra 2 frames ANTES da palavra correspondente e sai antes da próxima ideia.
- Máximo de 4 palavras na tela por elemento de motion (legenda não conta).
- Rosto nunca fica coberto por card ou texto na frente.
- Antes do render final, sempre conferir stills (passo 6).

## Pipeline

### 1. Preparar o vídeo

```bash
ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json input.mp4
# normaliza para 1080x1920 @ 30fps (frames passam a bater 1:1 com a composição)
ffmpeg -y -i input.mp4 -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:v libx264 -crf 16 -preset veryfast -c:a aac -b:a 192k base.mp4
```
Se o vídeo for horizontal, o crop centraliza; extraia um frame (`ffmpeg -ss 1 -i base.mp4 -frames:v 1 frame.png`), olhe e ajuste o crop para centralizar o rosto.

`durationInFrames = Math.round(duracao_segundos * 30)`.

### 2. Transcrever (timestamps por palavra)

Ordem de preferência:
1. `.srt` enviado pelo usuário. SRT só tem tempo por bloco: distribua as palavras dentro de cada bloco proporcionalmente ao número de letras.
2. Whisper local:
   ```bash
   pip install -U openai-whisper   # em sandbox: --break-system-packages
   whisper base.mp4 --model small --language pt --word_timestamps True --output_format json --output_dir transcript
   ```
3. Se o download do modelo falhar (rede bloqueada), peça o `.srt` ao usuário (CapCut, Premiere e YouTube exportam).

Salve em `src/data/words.json` no formato `[{"text":"Para","start":0.12,"end":0.31}, ...]` (segundos). Converta com `Math.round(s*30)`.

Depois agrupe em IDEIAS (blocos de 1,5–4 s, quebrando em pausa > 0,35 s ou fim de frase). Salve em `src/data/ideas.json`: `[{"start":0.1,"end":2.3,"text":"...","key":"palavra-chave","keyStart":0.9}]`.

### 3. Recortar a pessoa

RobustVideoMatting (estável entre frames, bom em cabelo):
```bash
pip install torch torchvision av tqdm pims
```
```python
# segment.py
import torch
model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3").eval()
convert_video = torch.hub.load("PeterL1n/RobustVideoMatting", "converter")
convert_video(model, input_source="base.mp4", output_type="png_sequence",
              output_composition="public/person", downsample_ratio=None, seq_chunk=8)
```
Gera `public/person/0000.png, 0001.png...` (RGBA, um PNG por frame, alinhado com base.mp4). Rode em background; em CPU leva alguns minutos.

Confira a borda: componha um PNG sobre fundo magenta e olhe. Se o cabelo ficar ruim, troque `mobilenetv3` por `resnet50`.

### 4. Projeto Remotion

```bash
mkdir efeito && cd efeito && npm init -y
npm i remotion @remotion/cli @remotion/fonts react react-dom lucide-react
npm i -D typescript @types/react
mkdir -p public src/data && cp ../base.mp4 public/
```
Todos os pacotes `remotion` e `@remotion/*` na MESMA versão.

Fontes: instale via npm (`@fontsource/anton`, `@fontsource/inter`, `@fontsource/instrument-serif`, `@fontsource/archivo-black`), copie o `.woff2` de `node_modules/@fontsource/<fonte>/files/` para `public/fonts/` e carregue com `loadFont` de `@remotion/fonts` (ele espera a fonte antes de renderizar).

`src/index.ts` → `registerRoot(Root)`. `src/Root.tsx` registra `<Composition id="Efeito" width={1080} height={1920} fps={30} durationInFrames={N} component={Efeito} />`.

### 5. Estrutura de camadas

```tsx
import {AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame} from 'remotion';
const pad = (n: number) => String(n).padStart(4, '0');

export const Efeito = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* 1. fundo: vídeo original (traz o áudio) */}
      <OffthreadVideo src={staticFile('base.mp4')} />
      {/* 1b. escurecer o fundo para o efeito saltar (0.25–0.45) */}
      <AbsoluteFill style={{background: 'rgba(0,0,0,0.35)'}} />
      {/* 2. efeito (cards de trás da órbita) */}
      <EfeitoAtras />
      {/* 3. pessoa recortada por cima, pixel a pixel alinhada */}
      <Img src={staticFile(`person/${pad(frame)}.png`)}
           style={{position: 'absolute', inset: 0, width: 1080, height: 1920,
                   filter: 'drop-shadow(0 0 24px rgba(0,0,0,0.45))'}} />
      {/* 4. cards da frente */}
    </AbsoluteFill>
  );
};
```
O escurecimento entra e sai junto com o efeito (interpolate de 0 até 0.35 em 8 frames), para o vídeo ficar normal fora dele.

### 6. Conferir antes do render

```bash
npx remotion still src/index.ts Efeito out/check_1.png --frame=<F>
```
Gere 3–4 stills nos momentos-chave (entrada, pico, keyword, saída), abra e olhe: rosto livre, texto legível, borda do recorte limpa. Corrija e só então renderize.

### 7. Render e entrega

```bash
npx remotion render src/index.ts Efeito out/video.mp4 --codec h264 --crf 18
```
Se o download do Chrome Headless falhar, use `--browser-executable=$(which chromium || which google-chrome)`.

Entregue o MP4 com uma linha de contexto. Nada de recap do processo.

---

## Efeito (cards em órbita 3D ao redor da pessoa)

- 5–8 mídias (vídeos viram 1 frame cada: `ffmpeg -ss 1 -i v.mp4 -frames:v 1 thumb.png`; só use vídeo animado se pedirem). Cards 9:16 de 220×390, `borderRadius: 20`, borda 3px `rgba(255,255,255,0.85)`, sombra.
- Centro da órbita: no peito, não no rosto. Pegue um still, ache o rosto e defina `CX` = centro horizontal do corpo, `CY` ≈ queixo + 180px.
- Plano inclinado (visto de cima): cards da frente passam mais baixo (na frente do tronco), cards de trás passam mais alto (atrás da cabeça). Assim o rosto nunca é coberto.
- O truque: cards com profundidade negativa renderizam ANTES da pessoa recortada; os de profundidade positiva, DEPOIS. Cada grupo ordenado por profundidade.
- Velocidade padrão: 1 volta a cada 8 s (240 frames).
- Entrada: cada card nasce do centro (escala 0 → 1, raio 0 → R) em cascata de 3 frames, ~18 frames no total. Saída inversa.

```tsx
const N = items.length, TURN = 240, RX = 460, TILT = 110;
const cards = items.map((src, i) => {
  const t = (i * 2 * Math.PI) / N + (2 * Math.PI * frame) / TURN;
  const depth = Math.cos(t);                       // 1 = frente, -1 = trás
  return {
    src, depth,
    x: CX + Math.sin(t) * RX,
    y: CY + depth * TILT,                          // frente mais baixo
    s: interpolate(depth, [-1, 1], [0.62, 1.08]),
    rot: Math.sin(t) * -28,                        // giro do card para dar 3D
    o: interpolate(depth, [-1, 1], [0.7, 1]),
    blur: depth < 0 ? interpolate(depth, [-1, 0], [2.5, 0]) : 0,
  };
});
const back = cards.filter(c => c.depth < 0).sort((a, b) => a.depth - b.depth);
const front = cards.filter(c => c.depth >= 0).sort((a, b) => a.depth - b.depth);
// ordem: base.mp4 → escurecer → back → pessoa recortada → front
// estilo do card: transform: `translate(-50%,-50%) perspective(1200px) rotateY(${rot}deg) scale(${s})`
```

---

## Problemas comuns

- Recorte desalinhado do vídeo: o `base.mp4` não estava em 30 fps antes da segmentação. Refaça o passo 1 e depois o 3.
- Recorte "pisca" ou come cabelo: use `resnet50` no RVM.
- Fonte errada no render: faltou `loadFont` de `@remotion/fonts` com o `.woff2` em `public/fonts`.
- Card da órbita cobrindo o rosto: baixe `CY` ou aumente `TILT`.
