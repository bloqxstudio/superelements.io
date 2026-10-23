# Criativos Avence Studio · nicho de arquitetos

Case de exemplo **Casa 212** (escritório fictício "Horizonte Arquitetura"), feito a partir da estrutura da página "Luiza 343" da Planta & Obra. Sem nome, texto, logo, planta ou foto da Planta & Obra: as fotos são imagens genéricas da biblioteca do repo (`public/sections/c25`), só para mostrar capacidade de criação.

- Projeto no Space: "Avence · Case Arquitetura (exemplo)", página "Casa 212" (9 seções: cabeçalho, abertura, apresentação, capítulos, decisões de projeto, galeria, contato, rodapé, WhatsApp). Planta & Obra não foi alterada.
- Imagens e logos do case: `public/brands/avence-studio/criativos/arquitetura/`.

## Arquivos

- `arquitetos-casa-212-4x5.mp4` · 1080×1350, ~22 s, site em desktop dentro de uma janela. Feed e anúncio.
- `arquitetos-casa-212-9x16.mp4` · 1080×1920, ~21 s, versão mobile do site dentro de um celular. Reels, Stories e anúncio vertical.

Roteiro dos dois: gancho "Site de arquiteto tem que parecer projeto." → o case rolando, com legenda por seção (Abertura em tela cheia, Capítulos que empilham, Texto curto e lista clara, Galeria que desliza) → cartão final "Seu portfólio em tela cheia." com "Peça uma prévia" e @avencestudio. Rodapé do vídeo: "Projeto de exemplo · fotos ilustrativas".

## Gravar de novo

O app precisa estar rodando (a ponte do Space). Em `artifacts/criativos-arquitetos/`:

- `node gravar.mjs --formato 4x5` ou `--formato 9x16`
- Só fotos de conferência: `--quadros 2,6,12` (saem em `quadros/`)
- Textos, tempos e layout: `plano.json` e `stage.html`
- Mudar o case: edite a página "Casa 212" no Space (`space pull/push`) e grave de novo.

## Legendas (rascunho, nada foi publicado)

**Feed / Reels**
Site de arquiteto tem que parecer projeto. Foto grande, texto curto e movimento que conduz o olhar até o contato. Esse é um exemplo feito pela Avence Studio, em WordPress e Elementor. Quer ver uma prévia do site do seu escritório? Chama no Direct.

**Anúncio, variação A (dor)**
Seu portfólio está no Instagram e em PDF, mas o site não mostra o projeto? Fazemos o site do seu escritório com foto em tela cheia e movimento. Peça uma prévia.

**Anúncio, variação B (exemplo)**
Casa 212 é um projeto fictício que a gente usou para mostrar como o portfólio de um escritório de arquitetura pode ser apresentado. Quer uma prévia com o seu trabalho?

## Pendências

- Não há número, prazo, preço ou resultado nos criativos; nenhuma promessa de resultado.
- O CTA usa o Direct do @avencestudio (confirmar se o WhatsApp também entra).
- Os "fotos ilustrativas" são imagens geradas da biblioteca; confirmar se podem ir em anúncio pago.
- Nada foi publicado nem enviado; o case no Space não foi publicado no WordPress.

## Estáticos 4:5 (1080×1350) · copy de conversão

`estaticos/arquitetos-01.png` … `-06.png`, feitos de `posts.html` (renderizar: `node renderizar.mjs [n]`; capturas do case: `node capturar.mjs`, com o app rodando). O case aparece em mockup (janela de navegador inclinada e celular) com telas reais da página Casa 212.

1. **Capa:** "Seu site tem que fechar projeto." + prévia
2. **Dor:** "Seu portfólio cabe num PDF?" (três linhas de dor)
3. **Cases:** "Cada projeto em tela cheia."
4. **Empresa:** "Quem você é, em uma tela."
5. **Conversão:** "Mais conversa. Mais orçamento. Mais projeto."
6. **CTA:** "Veja o site do seu escritório antes de fechar." + Direct @avencestudio

Sem números nem promessa de resultado. "Responsivo · Alta performance · SEO técnico" vem da referência que o Igor passou; confirmar que a Avence entrega os três em todo site antes de anunciar.

## Variações de copy para fechar cliente rápido (escuro e claro)

Mesma estrutura do final (título em duas linhas com a segunda em serifa itálica, apoio de duas linhas, mockup do case com a entrada e o scroll). Textos em `copys.json`; `node capturar-site.mjs` guarda os quadros do case em `frames/` (uma vez), `node compor.mjs [--so-estaticos] [--copy v2] [--tema claro]` gera tudo.

| id | Título | Apoio |
|---|---|---|
| v1 | Seu portfólio / *vende ou só enfeita?* | Transformamos seu portfólio em um site que mostra cada projeto em tela cheia e leva o cliente direto ao seu WhatsApp. |
| v2 | Projeto bom / *chama cliente.* | Cases em tela cheia e um caminho direto até o seu WhatsApp. Mostre o trabalho e receba mais conversas. |
| v3 | Mais orçamento. / *Menos explicação.* | O site apresenta o escritório e os cases por você. O cliente chega ao WhatsApp já sabendo quem você é. |
| v4 | Seu escritório / *pronto para vender.* | Site com acabamento de estúdio para apresentar seus projetos. Chame no Direct e veja a prévia antes de fechar. |

Saídas: `estaticos/arquitetos-vN-escuro.png` e `-claro.png`; `videos/arquitetos-vN-escuro.mp4` e `-claro.mp4` (1080×1350, ~19 s).

## Posts de feed com os cases da Avence (`cases/`, 4:5, 1080×1350)

Gerados por `node gerar-cases.mjs` (textos, recortes e destaques) e `node renderizar-cases.mjs [n]`, no desenho do site da Avence (tinta e papel, Inter Tight, serifa itálica, quadrado azul). Telas reais dos cases em `public/brands/avence-studio/cases/` e quadros do efeito da ProcessBase em `capturas-cases/`.

- **Carrossel ProcessBase (01 a 06):** capa, 4 detalhes em destaque (emblema que se forma no scroll, antes e depois, caminho em três passos, primeira tela) e fecho.
- **07:** grade "Seis sites, seis segmentos".
- **08 a 12:** um post por case (Vizor, Flávia Neto, Zena Viagens, Contplan, PrexParts) com um detalhe circulado.
- **13:** formato lupa (zoom no efeito da ProcessBase). **14:** lista "O que tem num site Avence".

Só fatos que as páginas mostram; nenhum número, resultado ou depoimento. Autorização de cada cliente para aparecer em post é item em aberto (COPY.md).

## Rodada comercial (2026-10-22)

- **ProcessBase (só vídeo, copy de case de sucesso, sem apelo comercial):** `videos/case-processbase-feed.mp4` (4:5, desktop) e `videos/case-processbase-story.mp4` (9:16, celular), 8,8 s: o scroll da primeira dobra à segunda, a partir das gravações do site (`processbase-efeito*.mp4`). Estáticos em `estaticos/case-processbase-feed.png` e `-story.png`. Fonte: `stage-pb.html`, `compor-pb.mjs`.
- **Posts comerciais (`comercial/`, 4:5):** grade "Seis sites no ar. O próximo é o seu?"; um post por case com a dor do nicho e CTA (Vizor, Flávia Neto, Zena, Contplan, PrexParts); "Seu site traz cliente ou só existe?"; "Seu site novo, pago uma vez" (oferta); "O que tem num site Avence". Todos fecham com "Peça sua prévia" + Direct @avencestudio. Fonte: `gerar-comercial.mjs`, `renderizar-comercial.mjs`.
- A oferta usa o modelo do funil (pagamento único + plano mensal opcional, prévia antes de fechar), sem valores.

**Atualização da copy da ProcessBase (mais comercial):** "Processo complexo, *site simples.*"; apoio: "A ProcessBase organiza cultura, processos, treinamentos e planejamento em quatro pilares: o Método Base. O site que a Avence fez explica cada pilar com clareza e leva o visitante ao diagnóstico."; CTA "Peça sua prévia" + "Quer o mesmo para o seu método? Chame no Direct · @avencestudio".
