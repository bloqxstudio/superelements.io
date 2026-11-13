# Limpeza e revisão completa do produto

**Data:** 2026-11-13 · **Iniciativa:** plataforma · **Quem:** usuário + agente

## O que aconteceu

O usuário pediu limpeza e qualidade ("está bem complexo e tem muito código lixo") e uma revisão completa por área.
Cinco revisões só de leitura (Space; Criativos e MCP; CRM, Instagram e WhatsApp; núcleo e Iara; banco e funções).
Depois, "sim pra tudo": apagar funções legadas, corrigir o WhatsApp e os bugs mais graves.

## O que entregamos

- Primeira tela do app de 5,5 MB para 995 KB (telas sob demanda); tipos do banco em dia; código morto fora.
- Segurança: 21 funções legadas apagadas (uma lia senhas de WordPress, outra era proxy aberto da OpenAI), senhas
  antigas apagadas, propostas e custos antigos fechados ao público, dono da conta protegido.
- WhatsApp reconhece números por DDD + final (antes, só os 8 últimos dígitos).
- Criativos da IA conectada na marca do próprio projeto; desfazer do Space não duplica página no WordPress;
  troca de conta relê os projetos; Criativos não perde edição entre Editor e Motion.
- Lista de trabalho com o resto: `docs/agentes/revisao-2026-11-13.md`.

## O que aprendemos

- Muito do "código lixo" é código de cliente (builders de marca) usado pelos builds locais em `.space/`, não morto.
- O deploy do Hostinger está parado por cota de disco (erro -122 no `npm install`) desde 13/11.

## Próximo passo

Liberar disco no Hostinger para o app publicar; seguir a lista da revisão (Realtime, Auth, egress da Home e Pauta).
