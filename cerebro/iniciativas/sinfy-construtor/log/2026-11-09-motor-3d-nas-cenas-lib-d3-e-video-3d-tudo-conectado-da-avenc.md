# Motor 3D nas cenas (lib.d3) e vídeo 3D tudo conectado da Avence

**Data:** 2026-11-09 · **Iniciativa:** sinfy-construtor · **Quem:** o usuário com Claude Code

## O que aconteceu

O vídeo "Do anúncio até o atendimento" da Avence estava pouco fluido e com cara de diagrama. O usuário pediu 3D de verdade, câmera trocando de ângulo por etapa, sem título nem legenda, ícones do Instagram e do site melhores, e uma cidade tecnológica ou um mini componente com tudo conectado. Depois perguntou se o produto já faria isso sozinho e pediu as duas coisas para entrega: o motor 3D e a biblioteca de ícones.

## O que entregamos

- O vídeo refeito em 3D: o centro com o logo ligado a anúncio, Instagram, criativo, site e atendimento, com uma câmera contínua por etapa e camadas que se abrem em "o que sustenta". Fica no conjunto "Video para teste" (cena `n2vy687y`).
- `lib.d3` em toda cena em código: câmera, luz, sombras, prédios, conexões, telas vivas e 13 ícones mais o logo da marca. A IA de cena e a Iara usam o motor quando o pedido fala em 3D ou em "tudo conectado".
- No ar: PR #25, merge `63c1973`, conferido no domínio.

## O que aprendemos

O worker só tem canvas 2D. Um motor 3D pronto deixa a cena com 8,5 KB em vez de 48 KB, o que torna viável a IA escrever e ajustar vídeos assim.

## Próximo passo

Pedir à Iara um vídeo 3D numa conta de cliente e ver se a primeira tentativa sai no nível deste.
