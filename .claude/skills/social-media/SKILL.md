---
name: social-media
description: Criar posts, carrosséis e stories de Instagram para uma conta de cliente nos Criativos do produto, no nível de craft de agência (social media de varejo do Behance, como a Haizer de Alisson Narloch), com fotos de produto e cenas geradas pelo Codex. Use quando o usuário pedir criativos, posts, stories, carrossel, "modelo de publicação", "versões", "conteúdo pro Instagram" ou "cronograma de postagens" de um cliente, ou disser que os criativos estão "com cara de IA", "montados" ou "sem craft".
---

# Social media no nível de agência, nos Criativos

A entrega é um **conjunto nos Criativos da conta do cliente**, gravado pela ponte do produto, que a equipe abre, ajusta e aprova. Nunca um arquivo solto. Aprendido no piloto da Vizor Películas (2026-11-03, sete rodadas com o usuário: `.space/vizor/build/`).

## Regra fixa: tudo editável, em camadas

O usuário, em 2026-11-04: "eles precisam ser editáveis… em outros projetos de criativos… é bem bom de mexer… Eu quero criar nesse padrão sempre". Todo criativo vai para o editor **em camadas**: a foto do Codex **sem nenhum texto** como camada de imagem, e título, subtítulo, botão, véu de legibilidade, logo e rodapé como camadas de texto e forma. **Nunca** peça ao Codex para escrever o texto na imagem ("sobreposição de texto publicitário"), nem grave a peça pronta como uma imagem só. A peça inteira vira arquivo único apenas na exportação.
- Se a ideia veio de uma peça com texto pronto, gere (ou reaproveite) a **foto base sem texto** e refaça o texto por cima, em camadas.
- Quebras de linha escritas à mão (`\n`) e a mesma régua do bloco em todo o conjunto (título → subtítulo → botão).
- Exemplo: `.space/avence-studio/corretoras/editavel.mjs` (Reels das corretoras: foto 2:3 cobrindo 1280×1920 com `x` escolhendo a faixa, véu em degradê `#rrggbbaa` → transparente, título em serifa caixa alta, botão preenchido, zonas do Reels conferidas no script).

## O que o usuário rejeitou (não repetir)

- **Cara de IA:** cena cinematográfica escura e genérica, vidro desfocado, degradê escuro no topo para o logo.
- **Post montado:** produto num quadrinho sobre um fundo, muitos elementos do mesmo peso, rodapé igual em todo post.
- **Infantil:** elementos inclinados, adesivo torto com sombra deslocada, céu saturado de pôr do sol.
- **Azul bebê** num público masculino; gírias ("POV") para público conservador.
- **Pessoas geradas por IA com rosto:** seja conservador. Mãos e piloto de capacete, sim; rosto, só se o usuário pedir.
- **Montagem do produto sobre a cena:** colar o recorte do catálogo em cima de uma foto parece montagem.

## A gramática que funciona (referência Haizer)

1. **Título em itálico com pesos misturados:** linhas em 900 itálico e linhas em 300–400 itálico, uma linha na cor de destaque da marca, e um *kicker* curto em itálico leve acima ("MAS AFINAL..."). Use `italic: true` na camada de texto (o editor tem o campo desde 2026-11-03).
2. **O produto pousado na cena**, com chão, luz e reflexo. A cena é gerada **com o produto dentro** pelo Codex, usando a imagem do catálogo como referência (`references`), e não colada depois.
3. **Painel da cor da marca com um canto grande arredondado** cortando a foto, com o logo dentro. Faça com um retângulo enorme que sai do post: só o canto aparece.
4. **Código ou nome do produto gigante e apagado ao fundo** (opacidade 0.06–0.08).
5. **Listas em barras-pílula** com o ícone num círculo na ponta; **cartões de especificação** com o modelo em itálico pesado.
6. **Linha de apoio com barra vertical** ("| PROTEÇÃO QUE ACOMPANHA / CADA QUILÔMETRO"), só onde o fundo é limpo.
7. **Rodapé pequeno** (site e @) em itálico, não um rodapé pesado.
8. **Variar o formato no grid:** foto inteira, painel de cor chapada, metade foto e metade ficha, lista, pergunta. Nunca o mesmo layout seguido.

## Fotos (sempre pelo serviço de imagens do produto)

- `.space/vizor/build/imagem.mjs` faz o mesmo pedido `image` que o editor faz pelo canal do Vite, com o Codex, e aceita `references` (até 4 imagens, data URL). Não depende de aba aberta.
- **Produto:** passe o recorte do catálogo como referência e descreva "the exact … from the reference image (same shape…)". A forma sai fiel; o conteúdo da tela é aproximado.
- **Recortes:** peça "isolated cutout on a fully transparent background (PNG with alpha channel)… generous empty margin". Confira o canal alfa (`ffmpeg … alphaextract`).
- **Prompts simples e claros** acertam mais do que estilo carregado ("moody low-key" escureceu tudo).
- **Nunca** use imagem com marca de outra empresa como referência nem a publique (o catálogo da Vizor tinha fotos com "PROTLE"). Do concorrente pegue só o estilo.
- Uma foto leva cerca de 1 minuto; gere de 2 em 2.

## Montagem e gravação

- Monte as camadas num script (como `.space/vizor/build/v7/v7.mjs`): mede o texto no Chrome **só depois de confirmar as fontes carregadas** (sem isso a medida sai da fonte reserva e o texto quebra), desenha a prévia local e grava pela ponte.
- **Cada versão num conjunto novo** (`SET_ID`/`SET_NAME`). Não sobrescreva o que o usuário está comparando.
- Antes de gravar: `creatives` `account` com o `teamId` do cliente e `close` (o editor guarda a cópia antiga em memória). Depois: `show`, que reabre lendo do armazenamento.
- **Confira pelo editor:** exporte cada slide com `creatives` `export` e olhe. Só reporte o que viu.

## Portão de qualidade (antes de mostrar)

- Todo texto com contraste firme sobre o que está atrás; nada sobre detalhe da foto (painel, rosto, roda).
- Story: texto fora de 250 px no topo e 300 px embaixo; a API não publica figurinhas, então a interação é "responde aqui".
- Nenhum texto quebrando para fora do bloco; nenhuma peça inclinada.
- Só fatos do catálogo e do Plano: modelo, anos, códigos, contato do site. Promessa de resultado ou de encaixe que não está escrita vai como pergunta ao usuário.
- Legenda pronta em cada post, no tom do Plano.
