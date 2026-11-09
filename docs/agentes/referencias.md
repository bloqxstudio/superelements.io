# Referências visuais da conta

**2026-11-09.** O usuário: "quero ter dentro do sistema uma aba pra referências, pra mandar links de vídeos do
Instagram e salvar como referência visual, para conseguir salvar as melhores e enviar pra ideias / produção de
criativos… as melhores refs pra aquela empresa, com os links de postagens, pode ser estáticos, vídeos, motion etc."

## Onde está

- **Tela:** `/referencias` (`src/pages/References.tsx`). Fica no menu em Criação, depois de Quadros, e só aparece
  para quem tem conta de empresa.
- **Dados:** `crm_references` (migração `20261109160000_crm_referencias.sql`, aplicada).
  - Uma linha por referência, por conta (RLS por `team_id`; testado: quem é de fora não vê).
  - Guarda: link, plataforma, tipo (estático, carrossel, vídeo, motion, Reels, story), nome, o que aproveitar,
    etiquetas, a estrela das melhores e a captura.
  - Um link salvo uma vez por conta.
- **Captura:** opcional. Fica no Cérebro da conta, pasta `referencias/` (`uploadFiles`), com link de 7 dias guardado
  no navegador (`mediaUrl`, regra de egress).
- **Regras:** `src/features/referencias/rules.ts` (`parseRefUrl`, `parseTags`, `referencesText`, `contentFormatOf`),
  testadas em `scripts/tests/referencias.test.mjs`. O acesso ao banco fica em `referencias/api.ts`.

## O que a tela faz

- **Ver o post:** pelo embed oficial da rede (Instagram `/p|reel/<código>/embed/`, YouTube, TikTok), só quando a
  pessoa clica em "Ver o post aqui".
  - Nada é baixado nem guardado do Instagram: a regra de nunca raspar continua (AGENTS.md).
  - Pinterest, Behance e sites não têm prévia; aparece a captura, se houver.
- **Ideia:** cria um conteúdo na Pauta (formato pelo tipo, com o link e o que aproveitar).
- **Criativo:** abre a Iara com o pedido de um criativo na linha da referência, na marca da conta, sem copiar
  texto, logo ou foto.
- **Estrela:** as referências marcadas (até 8) entram no contexto do Cérebro de toda criação (`accountContext`;
  área "Referências no contexto" em `CONNECTED_AREAS`).

## Não feito

- Testar a tela logada e o embed do Instagram no domínio publicado.
- Abrir o vídeo de um Reels para a IA analisar. A exceção que baixa um Reels pelo link vale só para o vídeo
  explicativo (`scripts/criativos/reel.ts`).
