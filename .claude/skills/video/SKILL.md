---
name: video
description: Gravar o vídeo de uma página de cliente do Space, rolando do topo ao fim com as animações, para mostrar ao cliente, aprovar ou postar. Use quando o usuário pedir "/video", "grava um vídeo da página", "vídeo da home", "vídeo do case", "vídeo no celular" ou "vídeo para mandar ao cliente" de um projeto do Space.
---

# Vídeo da página do cliente

Uma linha grava a página como o cliente vê no site, com preloader, entradas e movimento, quadro a quadro num relógio virtual. Assim a animação sai lisa, por mais que a captura demore. O vídeo vem do projeto aberto no Space, pela mesma ponte da skill `/cliente`: `node scripts/space/space.mjs` (abreviado aqui como `space`).

## Passos

1. **Qual página.** Rode `space status`. Se o usuário não disse a página, use a página ativa do canvas, que é a marcada com "← ativa". Só pergunte se ele falou de uma página que não existe.
2. **Avise no canvas.** `space say "Gravando o vídeo da página <nome>"`.
3. **Grave:** `space video --page "<página>"`. Adapte ao pedido:
   - **celular:** `--device mobile` (390×844, saída em 780×1688);
   - **os dois:** `--device all`;
   - **página com preloader, ou "mostra mais a abertura":** `--pause 3.5` (o padrão é 2,5 s parado no topo antes de rolar);
   - **"mais devagar" ou "mais rápido":** `--speed 300` ou `--speed 600` (px por segundo; o padrão é 420);
   - **outro lugar:** `--out <arquivo.mp4>`.
4. **Confira antes de entregar.** O comando grava, ao lado do vídeo, `<nome>-quadros.png`, com seis quadros: começo, 15%, 30%, metade, 75% e fim. Leia essa imagem. Se aparecer um quadro em branco, uma imagem faltando ou um preloader que não sai, grave de novo. Se o problema continuar, diga o que viu.
5. **Entregue.** `space say --kind done "Vídeo pronto: <arquivo>"`. No chat, informe o caminho do vídeo, a duração e o tamanho, e o que você viu nos quadros, em uma linha.

## Tempo

Uma página curta leva uns 30 s para gravar, e uma longa leva de 2 a 3 min (são uns 8 quadros por segundo de captura). Não rode a foto (`shot`) antes do vídeo: os quadros já servem de conferência.

## Fora do escopo do comando

- **Post 4:5 do Instagram com margem, marca e card de fecho:** é o palco em `artifacts/cases-instagram/msa-video-fonte/` (leia o `LEIA-ME.md`). Ele exige montar o palco à mão para cada case.
- **Vídeo do canvas** (o Space trabalhando, a página saindo do borrado): o comando não grava isso, porque o canvas só abre com login.

## Codex

No Codex, o `video` precisa rodar fora do sandbox, com a aprovação do usuário. O sandbox do Windows barra o Edge headless, e o erro aparece como "O navegador headless não abriu".
