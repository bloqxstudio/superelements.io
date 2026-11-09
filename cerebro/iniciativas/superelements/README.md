# SuperElements

> O construtor: páginas Elementor no canvas do Space, com agentes de IA, Criativos, Motion e sites em código.

**Estado:** em uso interno pelo estúdio; produto `builder` no app
**Atualizado em:** 2026-11-09

## O que já existe

- **Space**: canvas de páginas em Elementor nativo, componentes ligados, publicação no WordPress (Theme Builder), aprovação do cliente.
- **Iara**: assistente em qualquer tela, aberta na lateral por padrão, no chat do canvas (Claude Code ou Codex), com ações no produto (conteúdos, criativos, Cérebro, quadros, CRM, formulários, funis, campanhas, projetos, imagens), equipe rápida e orquestra de agentes.
- **Criativos**: posts, carrosséis e stories na marca, com fotos geradas, publicar no Instagram.
- **Motion**: estúdio com linha do tempo, keyframes, batidas, áudio, MP4 no navegador; cena em código (beta); vídeo explicativo no design system da marca, em dois modos (narração com cortes, ou briefing em que a IA cria o vídeo inteiro), com voz tratada, trilha e efeitos (2026-11-08, não commitado).
- **Sites em código (Astro)**: editar um site Astro do GitHub visualmente e publicar por commit/PR. Branch `sites-astro`, testado só localmente.

## Em andamento

- Efeitos com recorte no vídeo (2026-11-09, PR #26, no ar): 9 efeitos, entre eles carrossel, órbita de cartões, tela dividida e gráfico, vindos das skills de vídeo do usuário (`docs/agentes/skills-video/`). Falta um vídeo real com a IA escolhendo os efeitos; as skills de vídeo da plataforma ficam para depois.
- Motor 3D nas cenas (`lib.d3`, 2026-11-09, no ar): vídeos 3D com tudo conectado à marca pela IA e pela Iara; o vídeo da Avence refeito em 3D. Falta testar a IA gerando um vídeo 3D numa conta de cliente.
- Nova jornada de criação (2026-11-09): Fases 0 a 3 no ar (PR #16); Fase 4 (Cérebro conectado em tudo: marca única, aprendizados do mês, testes de garantia) feita. Plano em [jornada-de-criacao.md](jornada-de-criacao.md).
- Comercial animado no vídeo explicativo (2026-11-08, no ar): falta criar o vídeo na conta da Avence, narrar e revisar.

- 2026-11-08: Motion ganhou composição visual de vídeo, animação e legenda, com caixas arrastáveis e medidas por vídeo (app local, sem deploy).
- 2026-11-08: marca e Cérebro inicial da Ready Seguros importados para a conta, com logos originais e pendências explícitas; sem alteração de páginas ou campanhas.
- Sites em código: commits `5ffa40a` e `197edd9` na branch `sites-astro` (2026-11-06).

## Próximos passos

1. Ver logado: o Radar, a marca da conta no Space e nos Criativos, e um texto gerado numa conta de cliente.
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
