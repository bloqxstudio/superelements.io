# Vídeo explicativo: marca, dois modos, cortes e som

**Data:** 2026-11-08 · **Iniciativa:** superelements · **Quem:** Igor (pedido) e Claude Code

## O que aconteceu

O usuário achou o vídeo amador. Pediu o design system da marca em vez de um visual aleatório, voz e efeitos melhores, a IA criando o roteiro e o vídeo inteiro (com a fala ou o texto só como briefing) e cortes no áudio.

## O que entregamos

- **Marca:** o motor de animação só usa o design system da marca (o DESIGN.md da conta ou a marca do conjunto): cores pelos papéis, fontes de título, texto e destaque, canto do botão e logo. Os emojis foram trocados por ícones de traço e a tipografia é revelada no ritmo da fala.
- **Dois modos:** narração (a voz é o áudio do vídeo) e briefing (a IA escreve o roteiro e monta o vídeo sem a voz).
- **Cortes na fala:** pausas e vícios saem automáticos, a IA sugere cortes de repetições e dá para clicar na palavra para cortar ou devolver. No vídeo da pessoa, vira corte seco.
- **Som:** voz tratada e nivelada, ruído abaixado nas pausas, trilha de fundo que abaixa sob a fala e efeitos refeitos.
- Detalhes técnicos em `docs/agentes/criativos-motion.md`.

## O que aprendemos

- O visual "amador" vinha de três escolhas genéricas: fonte fixa, emoji e bolhas no fundo. Com as fontes, as cores e o logo da marca, o mesmo roteiro já parece peça de agência.
- O modo briefing precisa de trilha, porque sem narração é ela que carrega o ritmo.

## Próximo passo

Testar logado o roteiro e o briefing pela IA e ouvir o áudio. Avaliar a narração por IA, que precisa de uma chave de voz. Não commitado.

## Depois: narração por voz de IA

O usuário perguntou se dava para conectar uma voz e escolheu a OpenAI. A IA escreve a fala de cada cena e a voz (10 opções e 4 jeitos de falar, com amostra) lê o roteiro. O vídeo sincroniza com ela e ganha legenda. A chave é a mesma das imagens e fica só no computador, pelo conector. Falta testar com uma chave real.
