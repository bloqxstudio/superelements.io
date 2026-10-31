# Brief de interface — Plano e Conteúdos (Superelements v2)

Continuidade do produto atual, não uma interface nova.

- **Base**: shadcn/Tailwind do projeto (`Button`, `Dialog`), tokens de `src/index.css`, tipografia Inter
  do app, ícones Lucide. Peças do CRM em `src/features/crm/ui.tsx` (`Page`, `PageHeader`, `FIELD`).
  Cards no mesmo desenho do Início (`Block`: fundo branco, anel de 6%, sombra mínima).
- **Cor**: neutros (gray/zinc). Verde existente (`emerald`) só para o que está aprovado/ok e para o
  atalho "Voltar ao conteúdo". Âmbar para o que pede atenção (em revisão, plano incompleto, conflito),
  vermelho para erro e data vencida. Sem cor nova de marca.
- **Estados** sempre visíveis: carregando (`Loader2`, `role="status"`), vazio com próxima ação, erro com
  "Tentar de novo", migração ausente com mensagem própria, conflito de versão com ação clara.
- **Acessibilidade**: todo campo com `label`; ajuda ligada por `aria-describedby`; filtros e visões como
  `radiogroup`; foco com `ring` em tudo clicável; avisos `role="alert"`; motivo de botão desligado dito em
  texto (não só em `title`); `beforeunload` com mudanças não salvas.
- **Responsivo**: uma coluna no celular; Plano e detalhe em duas colunas só a partir de `lg`; quadro em
  1, 2 e 4 colunas.
- **Texto da aprovação** é parte do desenho: "A aprovação vale só para o texto … não cobre o design dos
  Criativos nem links externos." Nunca sugerir que o material externo foi aprovado.
- **Fora do escopo**: portal público do cliente, editor de vídeo, catálogo, campanhas automáticas.
