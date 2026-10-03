# Superelements — textos

Os textos da Home vêm da página-conceito do produto (`src/pages/SuperElementsLanding.tsx`, rota `/superelements`), reescritos para a página nova no Space em 2026-10-02. O que é fato do produto foi conferido no código do app (rótulos, etapas de publicar, comandos da ponte). O que ainda não é fato confirmado fica na lista de pendências, no fim.

## Linha central

- Manchete: **O site continua WordPress. O trabalho fica muito mais simples.**
- Fecho: **Crie aqui. Publique no WordPress.**
- Para quem: empresas que querem cuidar do próprio site sem aprender WordPress, e agências que operam vários clientes numa conta só.

## Home (projeto Superelements no Space › Home)

1. **Cabeçalho**: Produto, Como funciona, Para quem, Perguntas; Entrar; Criar projeto.
2. **Abertura**: rótulo "Feito para WordPress + Elementor"; manchete; apoio "Crie, organize e publique sites Elementor num espaço visual. O site da sua empresa ou todos os clientes da sua agência, cada um no seu projeto, com a marca, as páginas e o WordPress dele."; botões "Criar meu primeiro projeto" e "Ver a publicação"; provas "Conecta ao WordPress que você já tem · Páginas em Elementor nativo · Backup a cada publicação". A janela do Space mostra o Caramelo Pet (exemplo) e a legenda "o scroll publica a Home do Caramelo Pet, um projeto de exemplo".
3. **Faixa de provas**: Elementor nativo (na entrada e na saída) · Uma marca (em todas as seções) · Publicação direta (com backup e aviso de conflito) · Vários projetos (um por cliente, na mesma conta).
4. **Como funciona**: "Quatro momentos em que o WordPress deixa de pesar." O site que já existe entra no seu espaço · Uma marca passa a valer para a página inteira · O visual continua editável no Elementor · Publicar deixa de ser um pequeno projeto.
5. **Em camadas**: "Não é uma imagem do site. É o site, em camadas."
6. **Agente no canvas**: "Peça a página. Veja ela ficar pronta, seção por seção." Claude ou Codex montam o plano, constroem uma seção por vez, mandam o link para o cliente aprovar e só publicam quando você confirma. Os comandos mostrados são os reais da ponte (`scripts/space/space.mjs`).
7. **Para quem**: "O mesmo produto, dois jeitos de ganhar tempo." Empresa: "Um site. Muito menos painel." / "Sua empresa cuida do site sem precisar aprender WordPress." Agência: "Muitos clientes. Uma operação." / "Sua agência troca de projeto, não de ferramenta."
8. **Funcionalidades**: "As ferramentas que faltavam entre a ideia e o WordPress." Monte visualmente · Trabalhe com a marca · Edite de verdade · Conecte o WordPress · Entregue em equipe · Publique com segurança. Nota: "Publicar continua sendo uma decisão sua: nada vai para o site sem o seu sim."
9. **Perguntas**: hospedagem, WordPress, Elementor, site que já existe, agente publica sozinho, publicação errada.
10. **Chamada final**: "Seu próximo site pode começar mais organizado."
11. **Rodapé**: "Esta página foi montada no próprio Superelements, em Elementor nativo."

## Páginas do site (projeto Superelements no Space)

| Página | Endereço | Seções |
|---|---|---|
| Home | `/inicio` (definir como página inicial no WordPress) | cabeçalho, abertura com a publicação no scroll, provas, como funciona, em camadas, agente, para quem, funcionalidades, perguntas, chamada final, rodapé |
| Produto | `/produto` | abertura com o canvas, projetos, marca, Player e aprovação, publicar |
| Preços | `/precos` | planos, comparação, perguntas sobre os planos |
| Agências | `/agencias` | o fluxo com o cliente, a carteira, aprovação, agente, plano Agência |
| Contato | `/contato` | texto e formulário nativo (e-mail para contato@superelements.io) |

O menu liga as páginas por esses endereços, gravados em `space details` (título, slug e SEO de cada uma).

## Preços (decididos pelo usuário em 2026-10-02)

Os valores da página-conceito, confirmados para a página Preços ("pode ser seu valor"; o usuário também citou R$ 79,00, que fica como alternativa para o plano de entrada). Fonte única: `src/features/superelements/plans.ts`.

| Plano | Valor | Para quem |
|---|---|---|
| Produto | R$ 89/mês | empresa que já tem WordPress e hospedagem: 1 site, 1 colaborador |
| Completo | R$ 179/mês | Superelements com hospedagem gerenciada: 1 site, 3 colaboradores |
| Agência | R$ 349/mês | 5 sites, projetos e marcas ilimitados, equipe e aprovação; site a mais por R$ 39/mês |

## Dados de exemplo (nunca como fato)

- **Caramelo Pet** é o petshop fictício do projeto de exemplo; o domínio na tela é `caramelopet.exemplo`.
- **Café Aurora** e **Estúdio Norte**, na carteira da agência, são nomes inventados para a ilustração.
- Os horários e as mensagens do painel do Claude, as "6 imagens" e a "versão 3" do link são ilustrativos.

## Pendências

- **Preços**: os valores estão na página Preços; ainda faltam a política de cobrança, teste grátis e cancelamento (as perguntas da página não falam disso), e confirmar se a hospedagem gerenciada do plano Completo já existe como oferta.
- **Endereço do app**: os botões "Criar projeto" e "Entrar" apontam para `/auth` (caminho do próprio app). Trocar pelo endereço público do app quando a página for para outro domínio.
- **Contato**: `contato@superelements.io` veio da página-conceito; confirmar que a caixa existe.
- **Agente no canvas**: a ponte e o painel do Claude hoje rodam só com o app em desenvolvimento (`npm run dev`). Confirmar antes de publicar se o agente já é oferta para clientes, ou marcar a seção como "em breve".
- **"Sem cartão para testar"**, da página-conceito, ficou de fora até virar oferta.
- **Formulário de contato**: manda para contato@superelements.io pela ação de e-mail do Elementor Pro; conferir no WordPress se o envio chega.
- **Cliente fictício "Marina"** no link de aprovação da página Produto é ilustração.
