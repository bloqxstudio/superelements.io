# Plano da nova jornada de criação

**Data:** 2026-11-09 · **Iniciativa:** sinfy-construtor · **Quem:** usuário + Claude Code

## O que aconteceu

O usuário achou o produto confuso na jornada de criação. Os pontos que levantou:

- Sites e Projetos são a mesma coisa.
- O Cérebro deveria vir primeiro.
- Pauta, Conteúdo e Texto se confundem.

Analisamos no código o menu, as rotas e como cada recurso usa o contexto da conta.

## O que entregamos

- **Diagnóstico e plano:** [jornada-de-criacao.md](../jornada-de-criacao.md).
  - Nova jornada: Entender → Planejar → Criar → Aprovar → Publicar e medir.
  - Um menu único para os três produtos.
  - Uma tabela De → Para.
  - Fases de entrega de 0 a 3.
- **Quadro "Nova jornada de criação"** na conta Avence Studio (`/quadros/53cc4de6-7e90-4d27-9c25-ab65d4ee7f06`), com seis blocos:
  1. O menu de hoje.
  2. O que confunde.
  3. A nova jornada, com a volta dos resultados para o Cérebro.
  4. O novo menu lateral.
  5. De → Para.
  6. As fases.
  - Inserido por SQL em `crm_boards`.
  - Conferido num render local. Ainda não foi visto logado no app.

## O que aprendemos

- Pauta e Conteúdos são a mesma tabela (`crm_contents`), mas cada tela usa seus próprios nomes de status.
- Só a Iara lê o Cérebro inteiro.
  - Textos usa a voz da Avence, que está fixa no código.
- A identidade de um cliente está espalhada em cerca de 8 lugares diferentes.

## Próximo passo

- O usuário aprova (ou ajusta) a proposta.
- Depois, implementar a Fase 0 (só o menu).
