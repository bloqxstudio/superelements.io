# Comercial animado no vídeo explicativo

**Data:** 2026-11-08 · **Iniciativa:** superelements · **Quem:** Claude Code, a pedido do usuário

## O que aconteceu

O usuário mandou o reel de uma agência (tipografia cinética com locução, 31 s) e pediu para recriar com o mesmo nível de animação, dentro do produto, como um vídeo explicativo da conta da Avence.

## O que entregamos

- Novo estilo do vídeo explicativo, "Comercial animado", com motor próprio de 17 planos (`src/features/criativos/explicativo/comercial.ts`).
- "Modelo pronto: comercial animado" na criação do vídeo explicativo: 23 cenas em 31,4 s, copy da Avence e telas dos cases.
- Commit `dfa013e` em `main`, publicado em app.avencestudio.com e conferido no código publicado.

## O que aprendemos

O amarelo de fundo do reel não pode virar azul na Avence (azul só como destaque): virou o tom claro do azul, e o azul ficou nas cunhas, faixas e palavras de destaque.

## Próximo passo

Criar o vídeo na conta da Avence pelo botão, gerar a narração em Estilo › Som (precisa do conector com a chave da OpenAI) e revisar antes de publicar.
