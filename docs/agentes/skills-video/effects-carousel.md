---
name: effects-carousel
description: Duas fileiras infinitas de cards 9:16 passando ATRÁS da pessoa recortada, em Remotion. Use em /effects-carousel.
---

# Effects Carousel

Duas fileiras infinitas de cards 9:16 passando ATRÁS da pessoa recortada, em Remotion. Saída: MP4 1080×1920, 30 fps, com o áudio original.

## Uso

```
/effects-carousel [opções]
```

Precisa de: vídeo + 6 ou mais imagens/vídeos para os cards. Se faltar, peça (uma pergunta só).

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
      {/* 2. efeito (carrossel) */}
      <EfeitoAtras />
      {/* 3. pessoa recortada por cima, pixel a pixel alinhada */}
      <Img src={staticFile(`person/${pad(frame)}.png`)}
           style={{position: 'absolute', inset: 0, width: 1080, height: 1920,
                   filter: 'drop-shadow(0 0 24px rgba(0,0,0,0.45))'}} />
    </AbsoluteFill>
  );
};
```
O escurecimento entra e sai junto com o efeito (interpolate de 0 até 0.35 em 8 frames), para o vídeo ficar normal fora dele.

### 6. Conferir antes do render

```bash
npx remotion still src/index.ts Efeito out/check_1.png --frame=<F>
```
Gere 3–4 stills nos momentos-chave (entrada, pico, keyword, saída), abra e olhe: rosto livre, texto legível, sem buraco no carrossel, borda do recorte limpa. Corrija e só então renderize.

### 7. Render e entrega

```bash
npx remotion render src/index.ts Efeito out/video.mp4 --codec h264 --crf 18
```
Se o download do Chrome Headless falhar, use `--browser-executable=$(which chromium || which google-chrome)`.

Entregue o MP4 com uma linha de contexto. Nada de recap do processo.

---

## Efeito (fileiras infinitas atrás da pessoa)

- Mídias: pasta do usuário. Imagens entram direto. Vídeos: extraia 1 frame de cada (`ffmpeg -ss 1 -i v.mp4 -frames:v 1 thumb.png`) para não pesar o render; só use vídeo animado se pedirem.
- Cards 9:16 de 300×533, `borderRadius: 24`, `boxShadow: '0 20px 40px rgba(0,0,0,0.45)'`, `objectFit: 'cover'`.
- 2 fileiras: centro em ~30% e ~62% da altura, ambas passando atrás de cabeça/tronco. Fileira A para a esquerda (velocidade 2.2 px/frame), fileira B para a direita (1.5 px/frame).
- Loop sem buraco: repita as mídias até um ciclo (`W = n × (300 + gap)`) ser ≥ 1080 + 300, e renderize 3 cópias do ciclo.
- Fade nas bordas: máscara em cada fileira.
- Entrada: fileiras deslizam e aparecem em 12 frames no início do efeito (ou quando a fala citar "meus vídeos/trabalhos/resultados"), saída igual.
- Para o vídeo inteiro fazer loop perfeito: `speed = k × W / durationInFrames` (k inteiro).

```tsx
const Row = ({items, speed, dir, top}: {items: string[]; speed: number; dir: 'left' | 'right'; top: number}) => {
  const frame = useCurrentFrame();
  const STEP = 300 + 28;
  const W = items.length * STEP;
  const off = ((frame * speed) % W + W) % W;
  const x = dir === 'left' ? -off : -W + off;  // sempre entre -W e 0
  const track = [...items, ...items, ...items];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, height: 533,
      WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%)'}}>
      <div style={{position: 'absolute', left: 0, display: 'flex', gap: 28, transform: `translateX(${x}px)`}}>
        {track.map((src, i) => (
          <Img key={i} src={staticFile(src)} style={{width: 300, height: 533, borderRadius: 24, objectFit: 'cover',
            boxShadow: '0 20px 40px rgba(0,0,0,0.45)'}} />
        ))}
      </div>
    </div>
  );
};
```

---

## Problemas comuns

- Recorte desalinhado do vídeo: o `base.mp4` não estava em 30 fps antes da segmentação. Refaça o passo 1 e depois o 3.
- Recorte "pisca" ou come cabelo: use `resnet50` no RVM.
- Fonte errada no render: faltou `loadFont` de `@remotion/fonts` com o `.woff2` em `public/fonts`.
- Carousel com buraco: o ciclo `W` ficou menor que 1080 + largura do card; repita mais as mídias.
