# Quadros: fluxograma com um clique, fotos nas notas e itens do sistema

**Data:** 2026-11-11 · **Iniciativa:** sinfy-construtor · **Quem:** usuário + Claude Code

## O que aconteceu

O usuário estava planejando uma campanha num quadro e pediu três melhorias: criar um bloco ligado com um clique, a foto de quem colaborou em cima de cada nota, e trazer para o quadro o que já existe no sistema (criativos e arquivos, páginas, sites, formulários, funis, dashboards), do jeito que está hoje.

## O que entregamos

- "+" nos quatro lados do bloco ou nota escolhido: cria um igual, ligado por seta, e já abre o texto. Um segundo "+" para o mesmo lado vira um galho, sem cobrir nada.
- Foto de quem criou ou escreveu em cima de cada nota, e um botão para marcar pessoas da equipe da conta na nota.
- Botão "Do sistema": criativos (os slides dos posts em imagens, num frame com o link para o editor), logos e imagens do Cérebro, e páginas, sites, formulários, funis e dashboards ao vivo, dentro do quadro.
- Detalhes em `docs/agentes/quadros.md`. Publicado na `main` (Hostinger publica pelo push).

## O que aprendemos

- O Excalidraw ouve o teclado no próprio `.excalidraw`, não no documento.
- `convertToExcalidrawElements` não completa os campos de um embeddable: quebrava o canvas ao selecionar. Agora ele é montado com `restoreElements`.

## Próximo passo

Testar logado, num quadro real: as listas de cada aba, um criativo real, as fotos vistas por outra pessoa e a marcação de pessoas.
