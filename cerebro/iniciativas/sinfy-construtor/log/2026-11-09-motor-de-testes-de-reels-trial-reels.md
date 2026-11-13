# Motor de testes de reels (trial reels)

**Data:** 2026-11-09 · **Iniciativa:** sinfy-construtor · **Quem:** agente, a pedido do usuário

## O que aconteceu

O usuário pediu um motor para postar trial reels pela plataforma e validar os vídeos antes de levar aos seguidores.

## O que entregamos

- "Publicar como teste" ao publicar reels (CRM › Instagram, Motion, cena em código, vídeo explicativo), pela API oficial (`trial_params`).
- Aba CRM › Instagram › Testes: números relidos de hora em hora, retratos de 24 h e 72 h e o veredito (levar, esperar, refazer).
- Banco (`crm_instagram_trials`) aplicado e função `instagram` v21 publicada. App: código local, sem commit nem deploy.
- Detalhes em `docs/agentes/instagram.md`.

## O que aprendemos

A Meta não permite levar o teste aos seguidores pela API nem informa se já foi levado: com "Eu decido", isso é feito no app do Instagram e registrado na tela.

## Próximo passo

Publicar o app e fazer o primeiro teste real numa conta elegível; ajustar os pesos do motor com os primeiros resultados.
