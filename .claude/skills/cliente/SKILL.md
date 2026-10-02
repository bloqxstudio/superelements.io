---
name: cliente
description: Trabalhar junto com o usuário na página de um cliente direto no canvas do Space (ProcessBase, MSA, Júnior Automáticos, Caramelo Pet, Inpel e qualquer outro projeto). Use sempre que ele citar um projeto ou cliente e pedir para analisar uma página, criar, mudar, tirar ou reordenar uma seção, montar uma página, ou falar de "essa seção" ou "esse título" que está selecionado no Space. A entrega é a mudança feita na página do projeto, no canvas, e não um modelo novo no código.
---

# Trabalhar na página do cliente, no canvas

**A entrega é a página do projeto mudada no canvas do Space.** O usuário vê a mudança na hora, o Ctrl+Z dele desfaz, e o Space salva na conta sozinho, com o login dele. Não é um modelo: para atender um pedido de página, não crie nem edite `src/features/space/*Template.ts`, rotas de preview ou previews soltos. Os builders do cliente (`src/features/<cliente>/elementor.ts`) servem só como biblioteca para montar a seção.

Tudo passa pela ponte `node scripts/space/space.mjs <comando>` (abreviado aqui como `space`). Ela fala com a aba do Space aberta no preview do Ship Studio (ou no navegador com `npm run dev`).

## O ciclo

Cada pedido segue os mesmos passos. Escreva no painel do Claude no canvas (`space say "…"`) ao entrar, antes de cada mudança e ao entregar: é por ali que o usuário acompanha o que está sendo feito.

1. **Entrar.** `space status` mostra o projeto aberto, as páginas, as seções e o que está selecionado (seção e camada). "Essa seção" ou "esse título" é o que está selecionado. Se o projeto pedido não está aberto: `space open <nome>`. Depois: `space say "Entrei no projeto X. Vou ler a página Y."`
2. **Ler.** `space pull --page "<página>"` grava uma seção por arquivo em `.space/<projeto>/<página>/`, mais `projeto.md` (o briefing do Space) e `marca.md`. Leia também a fonte de verdade do cliente que o status aponta (`brands/<cliente>/DESIGN.md` e `COPY.md`) e a seção do cliente no `AGENTS.md`. Veja como a página está com `space shot --page "<página>" --device all` e leia as fotos.
3. **Combinar, só quando a decisão for do usuário.** Se o pedido for claro, siga sem perguntar. Se houver escolha de verdade (texto que muda o posicionamento, tirar conteúdo, duas direções visuais), mande uma proposta curta no chat: o que muda, em que página e seção, e o que fica igual. Repita a pergunta no painel com `space say --kind question "…"`.
4. **Fazer, à vista.** Antes de mexer numa seção, marque onde está trabalhando: `space work "Reescrevendo o título" --section <seção>`. A seção fica levemente borrada, com uma varredura e o texto por cima, até o `push` dela, que a faz sair do borrado.
   - **Página nova, ou várias seções novas:** primeiro ponha o plano no canvas com `space plan "Abertura" "Serviços" "Contato" --new "<página>"`, ou com `--page <nome> --after <seção>` numa página que já existe. As seções aparecem em esqueleto borrado, e os arquivos delas já ficam na pasta. Depois construa **uma por vez**, com `work` e `push` em cada uma: quem olha vê a página ficar nítida seção por seção. Não junte tudo para gravar no fim.
   - **Mudar uma seção:** edite `elements` no arquivo dela (textos, settings, ordem dos widgets). Mantenha os ids dos elementos: os ajustes feitos à mão no Space (`data.pinned`) são guardados por id.
   - **Seção nova:** crie um arquivo na pasta da página, sem `id`, com `title`, `place` (`{ "after": "<seção>" }`, `"before"` ou `"index"`) e `elements`. O melhor ponto de partida é uma seção da própria página: mesmo padrão, mesma marca. Para montar com o builder do cliente, escreva `.space/<projeto>/build/<nome>.ts` com `export default { title, place, elements }` e rode `space build <arquivo.ts>`, que gera o `.json`.
   - **Gravar:** `space push <arquivos> --label "<o que mudou, em português simples>"`. Faça um push por mudança combinada: cada um vira um passo do Ctrl+Z e uma linha no painel, e as seções mexidas ficam marcadas "Claude mudou" ou "Claude criou".
   - **Tirar, mover ou criar página:** `space remove <seção> --label "…"`, `space move <seção> --after <seção> --label "…"`, `space page-add <nome>`.
5. **Conferir.** `space shot --section <seção> --device all` (desktop e celular). Leia as fotos e corrija antes de entregar. As fotos saem sem animação, de propósito: o movimento se confere no Player do Space.
6. **Entregar.** `space say --kind done "<resumo>"`. No chat, diga o que mudou e onde (página › seção), o que você conferiu nas fotos e o que ficou pendente (fato sem prova, foto sem direito de uso, texto a confirmar com o cliente). Lembre que o Ctrl+Z desfaz.

## Regras

- **Sempre faça um `pull` antes de mexer.** O usuário edita no canvas também. Se o `push` recusar porque a seção mudou depois da leitura, faça `pull` de novo e refaça a mudança sobre a versão nova. Só use `--force` se o usuário pedir para passar por cima.
- **Publicar no WordPress e mandar link de aprovação são decisões do usuário**, pelos botões do Space. A ponte não faz nenhuma das duas.
- **Não invente fatos.** Prova, número, prêmio e depoimento só entram se estiverem no `COPY.md`. As regras visuais estão na seção do cliente no `AGENTS.md` e no `DESIGN.md`, e valem dentro do escopo daquele cliente.
- **Seção marcada `[do site]`** veio do WordPress do cliente: ela não recebe a marca do Space e volta para o site como está. Mexa só no que foi pedido.
- **Decisão do usuário sobre a linguagem visual ou o texto do cliente** vai para a seção dele no `AGENTS.md`, e o texto vai para o `COPY.md`, como já se faz hoje. A mudança da página fica na conta, e não no repositório.
- **`.space/` é só uma cópia de trabalho**, ignorada pelo git. O que vale é o que está na conta.
- **Transformar uma página em modelo reutilizável**, em `*Template.ts`, só se o usuário pedir.

## Comandos

| Comando | Para quê |
| --- | --- |
| `status` | Projeto aberto, páginas, seções (com id curto), seleção e a pasta da marca no repo |
| `projects` / `open <nome>` | Ver os projetos da conta e abrir um na aba do Space |
| `pull [--page <nome>]` | Baixar páginas para `.space/<projeto>/` (sem `--page`, todas) |
| `push <arquivo\|pasta>… --label "…"` | Gravar as seções alteradas e as novas (só as que mudaram desde a leitura) |
| `remove`, `move`, `page-add`, `page-remove` | Tirar uma seção, mudar a ordem, criar ou tirar uma página |
| `plan "<seção>"… --new <página>` | Pôr o plano no canvas em esqueleto borrado (ou `--page <nome> --after <seção>`) |
| `work "…" --section <seção>` / `work --done` | Mostrar onde o agente está mexendo; `say --kind done` também limpa |
| `build <arquivo.ts>` | Gerar a seção com os builders do repo (alias `@` para `src`) |
| `say "…" [--kind note\|question\|done] [--section <seção>]` | Escrever no painel do Claude no canvas |
| `focus <seção>` / `focus --page <nome>` | Levar o canvas do usuário até a seção ou a página |
| `shot [--page <nome>] [--section <seção>]… [--device desktop\|tablet\|mobile\|all]` | Tirar fotos como o Player mostra; ficam em `.space/<projeto>/fotos/` |

Uma `<seção>` pode ser o id (ou o começo dele), o número na página (`3`, junto com `--page`) ou parte do título.

## Quando algo falha

- **"A ponte não está no ar":** o servidor de dev não está rodando, ou não recarregou o `vite.config.ts`. Com o preview aberto, `touch vite.config.ts` faz ele reiniciar.
- **"Nenhuma aba do Space conectada":** o preview está fechado. Peça para o usuário abrir o app.
- **"ainda abrindo":** o projeto está carregando da conta. Espere uns segundos e rode de novo.
- **Mais de uma aba aberta:** a ponte usa a última que foi usada. Para escolher, `status` lista as abas e `--tab <id>` fixa uma.
- **Login:** a ponte usa o login da aba. Se o preview cair na tela de login, quem entra é o usuário.

## Claude e Codex

Os dois usam este mesmo processo e a mesma ponte. O Codex chega aqui por `.agents/skills/cliente/SKILL.md`, que só aponta para este arquivo e lista o que muda no sandbox dele. O painel e as marcas nas seções mostram quem mexeu: Claude, Codex, ou o nome que estiver em `SPACE_AGENT`. Se os dois trabalharem no mesmo projeto, a proteção do `push` vale entre eles também: quem gravar depois da leitura do outro precisa fazer `pull` de novo.
