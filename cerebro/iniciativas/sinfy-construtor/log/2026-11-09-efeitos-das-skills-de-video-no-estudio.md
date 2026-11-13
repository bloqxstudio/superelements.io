# Efeitos das skills de vídeo no estúdio

**Data:** 2026-11-09 · **Iniciativa:** sinfy-construtor · **Quem:** o usuário com Claude Code

## O que aconteceu

O usuário mandou cinco skills de vídeo em Remotion (`effects-title`, `-orbit`, `-carousel`, `-split`, `-chart`) e perguntou se dava para instalá-las para gerar os vídeos. Escolheu levá-las para o estúdio de vídeo, e não rodá-las fora do app. Também disse que gosta da ideia de ter skills de vídeo dentro da plataforma, para mais tarde.

## O que entregamos

- O estilo "Efeitos com recorte" (recorte da pessoa no navegador) foi publicado com 9 efeitos: os 5 do reel de referência mais carrossel, órbita de cartões, tela dividida e gráfico, na marca da conta, com as fotos do vídeo como cartões.
- A IA do roteiro escolhe o efeito de cada momento.
- As skills ficaram guardadas como especificação em `docs/agentes/skills-video/`.
- PR #26.

## O que aprendemos

As skills pediam Python, torch e um projeto Remotion por vídeo. No app, o mesmo efeito sai do motor que já existe, com a marca e a legenda da conta e com o Publicar reels.

## Próximo passo

Gravar um vídeo real com o estilo de recorte e deixar a IA escolher os efeitos. Depois, desenhar as skills de vídeo da plataforma a partir destas especificações.
