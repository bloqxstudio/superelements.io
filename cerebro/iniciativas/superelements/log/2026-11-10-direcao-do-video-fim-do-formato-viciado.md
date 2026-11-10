# Direção do vídeo: fim do formato viciado

**Data:** 2026-11-10 · **Iniciativa:** superelements · **Quem:** Claude Code, a pedido do usuário

## O que aconteceu

O usuário: "nossa ferramenta de vídeo tá viciada num modelo, sempre gerando o mesmo formato e não seguindo as regras
do que mandamos". O diagnóstico achou o estilo de comercial de agência e o vídeo "Copos" embutidos como regra em todo
pedido, um plano que só descrevia um formato, a referência com estrela escolhida sozinha, o 3D ligado por palavras
comuns e nenhuma conferência do resultado. O usuário mandou executar as sete mudanças propostas.

## O que entregamos

- Ordem de autoridade no pedido à IA: regras do usuário → decupagem → referência → estilo (`videoDirection.ts`).
- Estilos como pacotes opcionais (livre, comercial, objetos, 3D, editorial, texto cinético); contrato só técnico.
- Ficha da referência e decupagem cena a cena, editáveis no criador, e regras obrigatórias em texto livre.
- Conferência: a IA olha um quadro por cena e corrige o que foge das regras (até 2 voltas).
- A referência não é escolhida sozinha; sem referência, os últimos vídeos do conjunto entram como "não repita".
- Detalhes em `docs/agentes/criativos-motion.md`. Só no app local: sem commit e sem deploy.

- Depois (mesmo dia, "ainda vem viciado… não copia de fato o modelo"): modo agente. O Claude Code (Opus) ou o Codex
  trabalha numa pasta com o motor num Chrome escondido: estuda a referência quadro a quadro, escreve, renderiza, compara
  lado a lado no mesmo segundo e corrige em várias voltas (até ~15 min). Conector gerado de novo.

## O que aprendemos

O Claude era chamado sem ferramentas e sem ver o que desenhava: nenhuma regra resolve isso. Exemplo bom virando regra fixa no prompt faz todo vídeo sair igual. Estética fica em pacote escolhido, e o pedido
precisa ser conferido no resultado, não só se roda.

## Próximo passo

Testar logado: preencher com IA a partir de uma referência, gerar e ver a conferência agir; depois publicar.
