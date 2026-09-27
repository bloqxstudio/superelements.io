/** DESIGN.md de exemplo para começar e para comparar como a marca muda as seções. */

// Marcas reais; os arquivos em brands/ são a fonte. ProcessBase veio do Figma;
// ORYZO é um "Style Reference" do Refero, colado como está, e serve de teste do leitor.
import PROCESSBASE from '../../../../brands/processbase/DESIGN.md?raw'
import ORYZO from '../../../../brands/oryzo/DESIGN.md?raw'

const LINHA_NORTE = `---
name: Linha Norte
colors:
  background: "#F3F0E9"
  surface: "#FCFBF7"
  secondary: "#5E685D"
  primary: "#152017"
  accent: "#D9FF43"
fonts:
  heading: { family: Manrope, weight: 800 }
  body: { family: Manrope, weight: 400 }
---

# Linha Norte

Escritório brasileiro de arquitetura que cria espaços silenciosos, táteis e
ligados ao lugar. Precisão modernista com calor humano.

## Voz

- Clara, segura e sem superlativos vazios.
- Frases curtas, vocabulário concreto e sensorial.
- Fala de clima, matéria, permanência e vida cotidiana.
- Evita jargão técnico quando ele não ajuda o cliente a decidir.

## Cores

- O acento ácido (#D9FF43) é usado com parcimônia.

## Princípios de página

1. Começar com uma promessa específica e uma imagem que prove a atmosfera.
2. Alternar dobras densas e dobras de respiro.
3. Mostrar projetos antes de explicar demais o processo.
4. Usar números apenas quando sustentam confiança.
5. Encerrar com um próximo passo simples e de baixo atrito.
`

const BRASA = `---
name: Brasa
colors:
  background: "#FFF8F0"
  surface: "#FFFFFF"
  muted: "#7A5C4F"
  primary: "#2B1A12"
  accent: "#E4572E"
fonts:
  heading: { family: Fraunces, weight: 700 }
  body: { family: Inter, weight: 400 }
---

# Brasa

Restaurante de cozinha na brasa. Acolhedor, direto e com cheiro de fogo.

## Voz

- Fala como quem recebe em casa: próxima, sem formalidade.
- Descreve o prato pelo sabor e pelo preparo, não por adjetivos genéricos.
- Chamadas curtas; um convite por seção.
`

export const DESIGN_MD_EXAMPLES = [
  { id: 'linha-norte', label: 'Linha Norte', source: LINHA_NORTE },
  { id: 'brasa', label: 'Brasa', source: BRASA },
  { id: 'processbase', label: 'ProcessBase', source: PROCESSBASE },
  { id: 'oryzo', label: 'ORYZO', source: ORYZO },
]
