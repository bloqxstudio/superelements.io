# Jornada de criação: diagnóstico e plano de melhoria

**Data:** 2026-11-09 · **Estado:** aprovada pelo usuário em 2026-11-09. Fases 0 a 3 feitas no código local (não commitadas; o app não foi publicado; a função sinfy-mcp foi publicada).
**Quadro:** "Nova jornada de criação", na conta Avence Studio (`/quadros/53cc4de6-7e90-4d27-9c25-ab65d4ee7f06`).

## O pedido

O usuário disse que o produto está confuso na jornada de criação, principalmente no menu lateral:

- "Sites" e "Projetos" são a mesma coisa.
- O Cérebro deveria vir antes de tudo, porque é o contexto básico.
- Pauta, Conteúdo e Texto parecem a mesma coisa.

## Diagnóstico (lido no código)

### Menu

O menu está em `src/components/AppSidebar.tsx`.

- **Há três menus diferentes**, um por produto: Completo, Sinfy (`ResultsNav`) e SuperElements (`BuilderNav`). A ordem e os nomes mudam de um para outro.
- **A seção "Produção" do Completo tem 12 itens:** Projetos, Sites em código, Plano da empresa, Cérebro, Quadros, Pauta, Conteúdos, Agentes de IA, Textos, Criativos, Motion e Instruções de IA.
  - O contexto (Plano, Cérebro) aparece depois de Projetos e de Sites em código.
- **Uma mesma tela tem nomes diferentes conforme o produto:**
  - Início / Visão geral
  - Oportunidades / Leads
  - WhatsApp / Conversas
- **"Sites" tem três sentidos:**
  - "Site" é a contagem de visitas no CRM (`/crm/site`).
  - "Sites" é o título de uma seção.
  - "Sites em código" é o editor Astro (`/sites`).
- **Projetos** (`/`, canvas do Space) já é o construtor de sites.

### Pauta, Conteúdos e Textos

- **Pauta e Conteúdos são duas telas sobre a mesma tabela** (`crm_contents`).
  - Cada uma tem seu vocabulário de status (`STATUS_LABEL` e `stageOf`).
  - Cada uma tem seu próprio lugar para aprovar.
- **Textos** (`/copy`) é um editor à parte, gravado no storage.
  - O roteiro de um conteúdo existe em dois lugares: em `crm_contents.script` e no documento do Textos.
  - Os dois são sincronizados por hash (`src/features/conteudos/forward.ts`); quando divergem, aparece só um aviso.
- **O Brief do Textos copia o Plano uma vez**, quando o documento é criado, e não se atualiza depois.

### Cérebro

- **Só a Iara lê o Cérebro inteiro** (`brainContext`, em `src/features/iara/engine.ts`).
- **Os outros recursos leem só uma parte:**
  - Criativos e vídeo explicativo: a marca e os padrões de post (`standardBlock`, `accountBrand`).
  - Pauta e Conteúdos: só o Plano (`briefOf`).
  - Textos: só o Plano. Fora isso, usa `AVENCE_VOICE`, fixo em `src/features/copy/knowledge.ts`.
  - Space e Sites em código: não leem o Cérebro.
- **A identidade de um cliente fica em cerca de 8 lugares, sem sincronia entre eles:**
  - `brands/<marca>/DESIGN.md`
  - `docs/agentes/marcas/`
  - `crm_account_context.brand_md`
  - o README de marca do Cérebro
  - o DESIGN.md de cada projeto
  - `SetBrand` de cada conjunto de criativos
  - a marca de cada vídeo
  - `AVENCE_VOICE`
- **"Quem é o cliente" aparece três vezes:** no Plano, no README do Cérebro e na voz do DESIGN.md.

### Primeiro uso

- Não existe checklist nem "por onde começar".
- Quem é novo cai em Projetos.
- O Cérebro e o Plano ficam escondidos até a pessoa ter equipe.

## A nova jornada

**Entender → Planejar → Criar → Aprovar → Publicar e medir.** O que funcionou volta para o Cérebro.

Haverá um menu único para os três produtos. Os módulos da conta só escondem itens; nunca mudam a ordem nem os nomes.

| Seção | Itens | Junta |
|---|---|---|
| — | Início, com checklist da jornada | Início / Visão geral |
| 1 · Entender | **Cérebro**, com abas Negócio, Marca, Notas e arquivos, Padrões | Plano da empresa + Cérebro + marca |
| 2 · Planejar | **Pauta**, com visões Calendário, Lista e Quadro · **Quadros** | Pauta + Conteúdos |
| 3 · Criar | **Sites** (Canvas ou Código) · **Criativos** (Motion e vídeo como modos) | Projetos + Sites em código · Criativos + Motion |
| 4 · Vender | Leads, Conversas, Automações, Formulários, Funis, Clientes, Redes, Prospecção, Diagnóstico | Clientes e vendas |
| 5 · Resultados | Instagram, Anúncios, Visitas do site, Operação | "Site" renomeado |
| Rodapé | Agentes de IA, Instruções de IA, Equipe, Contas | — |

O bloco de criação passa de 12 itens para 5: Cérebro, Pauta, Quadros, Sites e Criativos.

**Textos deixa de ser item de menu.**

- O texto passa a ser a aba "Texto" de cada Conteúdo.
- Textos avulsos, como a copy de uma landing page ou um e-mail, ficam no Site correspondente ou viram um Conteúdo de formato "Texto".
- A rota `/copy` continua abrindo, para não quebrar links antigos.

**Regra de ouro:** tudo o que se cria lê o Cérebro.

- Haverá uma função única de contexto da conta, que junta Plano, `brand_md`, notas principais e padrões.
- Pauta, Textos, Criativos, vídeo e Sites passam a usá-la.

## De → Para

| Hoje | Depois |
|---|---|
| Plano da empresa + Cérebro | Cérebro, com abas Negócio, Marca, Notas e Padrões |
| Pauta + Conteúdos | Pauta, com visões Calendário, Lista e Quadro |
| Textos (menu próprio) | Aba "Texto" dentro do Conteúdo (a rota antiga continua) |
| Projetos + Sites em código | Sites, do tipo Canvas ou Código |
| Criativos + Motion | Criativos; Motion e vídeo explicativo como modos |
| "Site" no CRM | Visitas do site, em Resultados |
| Oportunidades/Leads · WhatsApp/Conversas | Um nome só em todos os produtos: Leads, Conversas |
| 3 menus | 1 menu; os módulos só escondem itens |

## Entrega em fases

### Fase 0 · Menu (só navegação, sem mudar dados)

- Montar um único array ordenado, filtrado por `moduleOn`.
- Unir Projetos e Sites em código como abas de "Sites".
- Juntar Pauta e Conteúdos numa só tela, com troca de visão.
- Abrir o Plano como aba do Cérebro.
- Tirar Motion do menu.
- Renomear "Site" para "Visitas do site".
- Manter as rotas antigas funcionando.
- Arquivos: `AppSidebar.tsx`, `src/features/navigation/workspace.ts`, `src/features/crm/modules.ts`, `src/features/iara/screens.ts`.

### Fase 1 · Cérebro como fonte única

- Criar a função de contexto da conta e usá-la em Pauta, Textos, Criativos, vídeo e Sites.
- `AVENCE_VOICE` deixa de valer para as outras contas.
- A marca passa a ser resolvida sempre pelo `brand_md` primeiro.
- O Cérebro fica visível desde o primeiro acesso.

### Fase 2 · Conteúdo como unidade

- `ContentDetail` ganha as abas Texto, Criativo, Vídeo e Aprovação.
- Um status só, do gestor ao cliente.
- Acaba o roteiro duplicado.

### Fase 3 · Primeiro uso guiado

- Checklist no Início:
  1. Cérebro
  2. Marca
  3. Primeira pauta
  4. Primeiro criativo
  5. Mandar para aprovação
- As telas vazias apontam o passo anterior.

## Fase 0 feita (2026-11-09)

Decisões usadas: seção "Vender"; o Sinfy usa o mesmo menu (os módulos escondem o que não tem); Quadros em Planejar.

- `src/components/AppSidebar.tsx`: `JourneyNav`, um menu só para os três produtos. Saíram `ResultsNav`, `BuilderNav` e `ExtraItems`.
  - Seções: 1 · Entender, 2 · Planejar, 3 · Criar, 4 · Vender, 5 · Resultados, IA e equipe.
  - O item da área fica ativo em todas as rotas dela.
- `src/features/navigation/AreaTabs.tsx`: as abas no topo de cada área.
  - Cérebro: Notas e marca, Plano da empresa.
  - Pauta: Calendário, Lista, Textos.
  - Sites: No canvas, Em código.
  - Criativos: Posts, Motion e vídeo.
- `workspace.ts`: os títulos da barra e a busca do menu. Os nomes antigos (Projetos, Plano, Conteúdos, Motion, Oportunidades, WhatsApp) continuam encontrando a área.
- Nomes unificados: Leads, Conversas, Visitas do site. Também mudaram os títulos dessas telas e os nomes em `src/features/iara/screens.ts`.
- Quem não tem conta de empresa e tem o módulo copy vê "Textos" em Planejar, porque a Pauta exige equipe.
- As rotas não mudaram.

## Fase 1 feita (2026-11-09)

- Contexto único da conta: `src/features/cerebro/accountContext.ts`. Ele junta o README do Cérebro, o Plano e a marca com os padrões.
- Quem passou a ler esse contexto: Textos, Criativos (geração), o roteiro da Pauta e o vídeo explicativo.
- A voz da Avence só vale na conta da Avence.
- O MCP da Sinfy (`sinfy_conta`) devolve o Cérebro. A função foi publicada.
- O menu: o grupo "Criação" não tem linha entre os itens. O usuário pediu; só o Cérebro vem antes, o resto não é passo a passo.
- Ficou de fora: mostrar o Cérebro para quem ainda não tem conta de empresa, porque os dados são por conta.
- Detalhe técnico: `docs/agentes/cerebro.md`.

## Fases 2 e 3 feitas (2026-11-09)

- **Tela do conteúdo em abas:** Texto, Criativo e vídeo, Aprovação.
- **Um vocabulário de status só, o da Pauta.**
- **O roteiro do conteúdo é o texto oficial.** O documento de Textos recebe o roteiro sozinho quando ninguém o editou depois do último envio.
- **"Radar da operação" no Início:** fica sempre à vista, por decisão do usuário. Mostra o que está em dia e o que falta em cada etapa, com números.
  - Na Avence, em 2026-11-09: Cérebro e Marca em dia; 7 conteúdos com data vencida; 58 em andamento sem criativo; 9 esperando o gestor.
- **Telas vazias** de Pauta, Conteúdos e Criativos apontam para o Cérebro.
- **Ficou de fora:**
  - Mover os textos avulsos (copy de landing page, e-mail) para dentro do Site.
  - Unificar as cópias da marca em projetos e conjuntos.
- **Detalhes:** `docs/agentes/pauta.md`.
