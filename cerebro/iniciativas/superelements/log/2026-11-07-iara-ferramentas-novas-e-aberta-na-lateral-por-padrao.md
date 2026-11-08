# Iara: ferramentas novas e aberta na lateral por padrão

**Data:** 2026-11-07 · **Iniciativa:** superelements · **Quem:** Claude Code

## O que aconteceu

O usuário pediu que a Iara opere as ferramentas novas (quadros, formulários, funis, campanhas, imagens, páginas), venha aberta por padrão e que as telas parem de ficar por trás dela.

## O que entregamos

- Ações novas da Iara (`src/features/iara/toolActions.ts`): quadros (listar, ler, criar, adicionar notas/colunas/mapa), oportunidades do CRM (listar, criar, mudar etapa), formulários (listar, ler, criar em rascunho), funis (listar, ler números, criar), análise de campanhas da Meta, projetos (listar, criar e abrir) e gerar imagem (guarda no Cérebro).
- O quadro aberto avisa à Iara o que está escrito e o que está selecionado; com o quadro aberto, as notas entram ao vivo.
- Iara aberta e na lateral por padrão no computador (fechada no celular); diálogos, avisos, barra do Plano, prévia em tela cheia e visualizador de imagens respeitam a coluna dela.
- Conector refeito (`npm run conector`). Nada commitado nem publicado.

## O que aprendemos

A ponte da Iara corta em 30 s: ações demoradas (gerar imagem, ler a Meta) rodam como trabalho na aba e o resultado volta à conversa.

## Próximo passo

Testar logado: as ações novas pelo chat e o layout nas telas (Pauta, Oportunidades, Quadros, diálogos); baixar o conector novo.
