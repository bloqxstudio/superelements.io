# Vídeo explicativo: fala vira animação com legenda e efeitos

**Data:** 2026-11-07 · **Iniciativa:** superelements · **Quem:** Igor (pedido) e Claude Code

## O que aconteceu

O usuário pediu uma ferramenta para o formato que está viral: a pessoa grava um vídeo ou manda um áudio e sai uma animação explicando a fala, com texto cinético, objetos animando, fotos tratadas, legenda animada e efeitos de som nas transições. A entrada pode ser gravar, enviar áudio, enviar vídeo e um vídeo de referência. A ferramenta escreve o roteiro e cria o vídeo pronto para publicar.

## O que entregamos

- Estúdio `/motion/:setId/explica`, com a entrada no topo de `/motion`: gravar vídeo ou áudio no navegador (com teleprompter e a fala escrita pela IA) ou enviar arquivo; fotos e vídeo de referência são opcionais.
- Transcrição com o tempo de cada palavra, rodando no navegador (Whisper via transformers.js). A voz não sai do computador.
- Roteiro animado escrito pela IA (ou automático, sem IA) com 11 padrões de animação, 5 transições, 6 efeitos de som sintetizados, 4 estilos de legenda e 3 formatos (só animação, você + animação, você na tela).
- MP4 1080×1920 no navegador e publicação como reels, com capa no gancho e legenda escrita pela IA.
- Detalhes técnicos em `docs/agentes/criativos-motion.md`.

## O que aprendemos

- O Whisper base leva 14 a 18 s para transcrever uma fala de 22 s no Chrome. Ele erra uma palavra ou outra, por isso a aba Fala permite corrigir o texto mantendo os tempos.
- No Chrome novo, `scrollIntoView` devolve uma Promise. Um `useEffect` em seta curta passa essa Promise como limpeza e quebra o React.

## Próximo passo

Testar logado com uma fala real gravada pela câmera, gerar o roteiro pela IA do conector e publicar um reels. O código não foi commitado.
