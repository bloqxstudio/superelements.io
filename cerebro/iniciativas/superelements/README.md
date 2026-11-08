# SuperElements

> O construtor: páginas Elementor no canvas do Space, com agentes de IA, Criativos, Motion e sites em código.

**Estado:** em uso interno pelo estúdio; produto `builder` no app
**Atualizado em:** 2026-11-07

## O que já existe

- **Space**: canvas de páginas em Elementor nativo, componentes ligados, publicação no WordPress (Theme Builder), aprovação do cliente.
- **Iara**: assistente em qualquer tela, aberta na lateral por padrão, no chat do canvas (Claude Code ou Codex), com ações no produto (conteúdos, criativos, Cérebro, quadros, CRM, formulários, funis, campanhas, projetos, imagens), equipe rápida e orquestra de agentes.
- **Criativos**: posts, carrosséis e stories na marca, com fotos geradas, publicar no Instagram.
- **Motion**: estúdio com linha do tempo, keyframes, batidas, áudio, MP4 no navegador; cena em código (beta); vídeo explicativo no design system da marca, em dois modos (narração com cortes, ou briefing em que a IA cria o vídeo inteiro), com voz tratada, trilha e efeitos (2026-11-08, não commitado).
- **Sites em código (Astro)**: editar um site Astro do GitHub visualmente e publicar por commit/PR. Branch `sites-astro`, testado só localmente.

## Em andamento

- Sites em código: commits `5ffa40a` e `197edd9` na branch `sites-astro` (2026-11-06).

## Próximos passos

1. Testar logado a Iara com as ferramentas novas e o layout com ela aberta (2026-11-07, não commitado).
1. Testar logado o vídeo explicativo: gravar pela câmera, roteiro pela IA, publicar um reels (2026-11-07, não commitado).
1. Testar Sites em código com o repositório real de um cliente e um PR real.
2. Publicar cena em código no Instagram; IA do chat escrevendo keyframes.
3. Fotos de prato recortadas pela IA de imagens.

## Bloqueios e riscos

- Muito do que roda depende desta máquina ligada (conector, IA local).

## Links

- Detalhe técnico: [docs/agentes/](../../../docs/agentes/) (`space-componentes.md`, `criativos-motion.md`, `iara.md`, `sites-astro.md`)
- Marca: `brands/superelements/DESIGN.md`
- Decisões: [decisoes.md](decisoes.md) · Log: [log/](log)
