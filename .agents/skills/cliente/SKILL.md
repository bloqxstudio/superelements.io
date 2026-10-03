---
name: cliente
description: Trabalhar junto com o usuário na página de um cliente direto no canvas do Space (ProcessBase, MSA, Júnior Automáticos, Caramelo Pet, Inpel e qualquer outro projeto). Use sempre que ele citar um projeto ou cliente e pedir para analisar uma página, criar, mudar, tirar ou reordenar uma seção, montar uma página, ou falar de "essa seção" ou "esse título" que está selecionado no Space. A entrega é a mudança feita na página do projeto, no canvas, e não um modelo novo no código.
---

# Trabalhar na página do cliente, no canvas

O processo é o mesmo do Claude e fica num lugar só: **leia `.claude/skills/cliente/SKILL.md` e siga esse arquivo do começo ao fim.** A ponte (`node scripts/space/space.mjs`) é a mesma para os dois agentes.

O que muda no Codex:

- **Sandbox:** `status`, `pull`, `push`, `remove`, `move`, `say`, `focus` e `build` funcionam dentro do sandbox (testado em 2026-10-02). Já o `shot` abre o Edge headless, e o sandbox do Windows barra esse processo (`spawn EPERM`, que aparece como "O navegador headless não abriu"). Rode o `shot` pedindo para sair do sandbox, com a aprovação do usuário.
- **Nome no painel:** o painel e as marcas nas seções mostram quem mexeu. A ponte reconhece o Codex pelas variáveis `CODEX_`. Se aparecer "Agente", rode os comandos com `SPACE_AGENT=Codex`.
- **Sessão:** cada conversa trabalha no seu projeto, guardado por sessão. A ponte usa `CODEX_THREAD_ID` ou `CODEX_SESSION_ID`; se o `status` disser `codex-sem-sessao` (rode `status --json` e veja `session`), rode os comandos com `SPACE_SESSION=<um id só desta conversa>`, senão duas conversas do Codex dividem o mesmo projeto.
