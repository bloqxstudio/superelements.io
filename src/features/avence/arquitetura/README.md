# Horizonte · refinamento da página teste

Escopo: projeto `817e7afc-f37b-46b0-95da-860469e8e8aa`, página `teste`.
O refinamento é escrito em código; não usa automação de tela nem cria um modelo
na biblioteca. A página continua composta por elementos nativos editáveis.

## Fontes

- `src/features/avence/arquitetura/refine.mjs`: conteúdo, seleção de imagens,
  estilos responsivos e transformação dos elementos existentes.
- `src/features/avence/arquitetura/motion.mjs`: comportamento de animação,
  usando Web Animations API e IntersectionObserver, sem CDN de JavaScript.
- `public/brands/avence-studio/criativos/arquitetura/refinamento/`: imagens
  ilustrativas geradas com a ferramenta integrada imagegen e convertidas para WebP.
- `scripts/clients/horizonte/build.mjs`: gera as seções a partir da leitura atual.
- `scripts/clients/horizonte/verify.mjs`: renderiza e verifica desktop e celular
  por código, usando um Chrome headless temporário e isolado.

## Repetir a geração

Com o ambiente local e o projeto abertos no navegador:

```sh
node scripts/space/space.mjs pull --page teste
node scripts/clients/horizonte/build.mjs
node scripts/space/space.mjs push .space/avence-case-arquitetura-exemplo/teste/[0-9]*.json --label 'Refinar a página teste por código' --no-focus
node scripts/clients/horizonte/verify.mjs artifacts/horizonte-refinamento
```

O script mantém os IDs e dados das camadas. A geração é idempotente.
O primeiro estado anterior fica em `teste/before-refinement/`, fora do Git.
Um pull novo deve preceder cada nova rodada para não sobrescrever alterações
contemporâneas. O push também recusa conflitos detectados na conta.

## Decisões visuais e de conteúdo

Mantida a composição editorial, Inter Tight e Newsreader. Ajustados margens,
entrelinhas, contraste, menu, princípios, recortes e versões de celular.
Fundo claro levemente quente; blocos escuros em verde quase preto.

O anel passa de 22 imagens de negócios diversos para oito imagens relacionadas
a arquitetura, desenho, maquete e materiais. A abertura usa uma variação da
mesma residência sem carro ou personagem. O processo mostra croquis e maquete;
o detalhe mostra concreto, madeira e vidro. A seção de marcas fictícias passa
a apresentar o vocabulário de materiais. Prêmios, endereços, horários e números
inventados foram trocados por princípios e etapas de projeto.

As animações preservam conteúdo visível por padrão. Entradas curtas acontecem
ao entrar na tela; o radial acompanha a rolagem. Foram retirados Lenis, cursores
decorativos, números contados e sequências fixas com várias telas. Movimento
reduzido, inclusive ativado durante a visita, cancela animações e observadores.

## Validação

O verificador confirma carregamento de todas as imagens, ausência de
transbordamento horizontal em 1440 e 390 pixels, separação do menu e logo,
inicialização das animações e cancelamento em movimento reduzido. Grava uma
captura de cada seção e `verification.json`. A inspeção visual considera os
dois tamanhos. Nenhuma publicação no WordPress ou deploy é feita por esses scripts.

## Case 2 · seleção exclusiva para proposta comercial

`case2.mjs` define as 13 imagens e legendas da página `Case 2`, mantendo o layout
existente. Os assets exclusivos ficam em
`public/brands/avence-studio/criativos/arquitetura/case-2/`; `prompts.json` registra
os prompts completos usados com imagegen. A seleção usa pedra clara, terra,
madeira, pátios e luz natural para diferenciar o segundo case do primeiro.

```sh
node scripts/space/space.mjs pull --page 'Case 2' --page teste
node scripts/clients/horizonte/build-case2.mjs
node scripts/space/space.mjs push .space/avence-case-arquitetura-exemplo/case-2/[0-9]*.json --label 'Case 2: imagens exclusivas' --no-focus
node scripts/clients/horizonte/verify-case2.mjs artifacts/horizonte-case2
```

A geração valida 13 URLs e 13 hashes diferentes, e compara com as imagens da
página `teste`, inclusive as que estão em HTML. Também preserva os IDs e testa
idempotência. O primeiro estado fica em `case-2/before-exclusive-images/`.
As cenas são ilustrações de projetos conceituais; as metragens inventadas foram
retiradas das legendas. A antiga seção Imprensa passa a apresentar notas do
escritório como Caderno, sem alegar publicação por terceiros.

## Case 2 · hover e processo lateral

`case2-interactions.mjs` mantém as quatro etapas em uma região horizontal nativa
no desktop e no celular. Há índice completo, botões anterior/próxima, contador,
arraste com mouse, gesto de toque, barra de rolagem e teclas Home, End e setas.
O espaçador final permite alinhar a etapa 04 inteira ao início da faixa.
A antiga timeline que fixava e traduzia a seção no GSAP foi retirada pelo gerador;
o processo funciona mesmo sem o CDN, inclusive com movimento reduzido.

Os hovers usam uma camada de imagem diferente da animada pelo GSAP: zoom suave,
leve alteração de brilho, sublinhado de links e deslocamento de setas. O foco é
visível. Movimento reduzido desliga as transições.

O verificador também testa a etapa 04 completamente visível, o botão anterior
retornando para 03 e a tecla Home retornando para 01, nos dois tamanhos de tela.
