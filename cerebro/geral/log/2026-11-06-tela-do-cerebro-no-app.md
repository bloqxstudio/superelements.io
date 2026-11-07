# Tela do Cérebro no app

**Data:** 2026-11-06 · **Iniciativa:** geral · **Quem:** Igor, com o Claude Code

## O que aconteceu

Igor pediu uma view no sistema tipo Obsidian com as notas e as áreas do cérebro, funcionando no dev e no app publicado.

## O que entregamos

- Tela `/cerebro` (menu Plataforma › Cérebro, só o admin): árvore por área, nota, links para cá, sumário, busca e grafo.
- No `npm run dev` edita e cria notas direto nos arquivos.
- No app publicado lê uma cópia privada (bucket `cerebro` no Supabase), enviada pelo botão "Enviar ao app publicado".
- Detalhe técnico no [AGENTS.md](../../../AGENTS.md) (Segundo cérebro).

## O que aprendemos

As notas não podem ir dentro do JavaScript do app: qualquer pessoa leria. Por isso a cópia publicada fica num bucket privado.

## Próximo passo

Primeiro envio ao app publicado, logado como admin, e conferir a leitura em `app.avencestudio.com/cerebro` depois do deploy.
