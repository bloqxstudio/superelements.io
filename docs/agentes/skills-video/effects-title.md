---
name: effects-title
description: Texto cinético do gancho animado palavra por palavra ATRÁS da pessoa recortada, em Remotion. Use em /effects-title.
---

# Effects Title

Texto cinético do gancho animado palavra por palavra ATRÁS da pessoa recortada, em Remotion. Saída: MP4 1080×1920, 30 fps, com o áudio original.

## Uso

```
/effects-title [opções]
```

Precisa de: vídeo + frase do gancho (opcional; sem ela, usa a primeira frase do vídeo). Se faltar, peça (uma pergunta só).

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
      {/* 2. efeito (texto) */}
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
Gere 3–4 stills nos momentos-chave (entrada, pico, keyword, saída), abra e olhe: rosto livre, texto legível, borda do recorte limpa. Corrija e só então renderize.

### 7. Render e entrega

```bash
npx remotion render src/index.ts Efeito out/video.mp4 --codec h264 --crf 18
```
Se o download do Chrome Headless falhar, use `--browser-executable=$(which chromium || which google-chrome)`.

Entregue o MP4 com uma linha de contexto. Nada de recap do processo.

---

## Efeito (texto cinético atrás da pessoa)

- Frase: a que o usuário mandar; se não mandar, a primeira frase do vídeo (gancho). Palavra-chave: a que ele indicar ou a mais forte da frase (verbo/resultado/número).
- Cada palavra entra no tempo dela na fala (`start - 2 frames`).
- Animação por palavra (6 frames, `Easing.out(Easing.cubic)`): escala 1.15 → 1, blur 8px → 0, opacidade 0 → 1.
- Palavra-chave: cor de destaque (padrão `#A78BFA`), glow (`textShadow: 0 0 40px <cor>88`) e tremor de 14 frames decaindo.
- Tipografia: Anton, caixa alta, `lineHeight: 0.92`, letras grandes (linha ocupa ~90% da largura). Branco `#F5F5F5`.
- Posição: bloco centralizado entre 18% e 45% da altura, de modo que a cabeça cubra PARTE do texto (é o efeito). A palavra-chave tem que continuar legível: se a cabeça cobrir, mude a quebra de linha ou suba o bloco.
- Saída: tudo some junto (blur 0 → 10, opacidade → 0, 6 frames) antes da próxima frase.
- Padrão: só no gancho. Se o usuário pedir no vídeo todo, aplique em 1 frase forte a cada 6–10 s, não em todas.

```tsx
const Word = ({text, at, isKey, accent}: {text: string; at: number; isKey: boolean; accent: string}) => {
  const f = useCurrentFrame() - at;
  const p = interpolate(f, [0, 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const shake = isKey && f > 0 && f < 14 ? Math.sin(f * 2.7) * 7 * (1 - f / 14) : 0;
  return (
    <span style={{display: 'inline-block', margin: '0 0.12em', opacity: p,
      transform: `translateX(${shake}px) scale(${1.15 - 0.15 * p})`, filter: `blur(${8 * (1 - p)}px)`,
      color: isKey ? accent : '#F5F5F5', textShadow: isKey ? `0 0 40px ${accent}88` : 'none'}}>{text}</span>
  );
};
```

---

## Problemas comuns

- Recorte desalinhado do vídeo: o `base.mp4` não estava em 30 fps antes da segmentação. Refaça o passo 1 e depois o 3.
- Recorte "pisca" ou come cabelo: use `resnet50` no RVM.
- Fonte errada no render: faltou `loadFont` de `@remotion/fonts` com o `.woff2` em `public/fonts`.
- Legenda fora de sincronia vinda de SRT: confirme que o SRT é do mesmo corte do vídeo (sem trechos removidos depois).
