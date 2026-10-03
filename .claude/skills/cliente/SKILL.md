---
name: cliente
description: Levar o projeto de um cliente do zero ao site publicado direto no canvas do Space (ProcessBase, MSA, Júnior Automáticos, Caramelo Pet, Inpel e qualquer outro projeto), tudo por comando, para um agente fazer o ciclo inteiro. Use sempre que o usuário citar um projeto ou cliente e pedir para criar um projeto, montar uma página, analisar, criar, mudar, tirar ou reordenar uma seção, mandar para o cliente aprovar, aplicar o ajuste que o cliente pediu, fechar a versão final com animação, conectar o WordPress ou publicar, ou falar de "essa seção" ou "esse título" que está selecionado no Space. A entrega é a página do projeto no canvas (e, quando combinado, no site), e não um modelo novo no código.
---

# Do projeto novo ao site publicado, no canvas

**A entrega é a página do projeto no canvas do Space.** O usuário vê a mudança na hora, o Ctrl+Z dele desfaz, e o Space salva na conta sozinho, com o login dele. Não é um modelo: para atender um pedido de página, não crie nem edite `src/features/space/*Template.ts`, rotas de preview ou previews soltos. Os builders do cliente (`src/features/<cliente>/elementor.ts`) servem só como biblioteca para montar a seção.

Tudo passa pela ponte `node scripts/space/space.mjs <comando>` (abreviado aqui como `space`). Ela fala com a aba do Space aberta no preview do Ship Studio (ou no navegador com `npm run dev`) e usa o login dela. Cada botão do Space tem um comando, para um agente levar o projeto do começo ao fim: criar, montar, iterar com o cliente, fechar a versão final e publicar.

Há dois tipos de passo. **No canvas** (`plan`, `push`, `remove`, `move`, `details`…), o Ctrl+Z do usuário desfaz. **Para fora do canvas** (link de aprovação, convite, conexão e publicação no WordPress), o Ctrl+Z não alcança: cada um é um passo combinado, anunciado no chat e no painel antes de rodar.

## O ciclo

Escreva no painel do Claude no canvas (`space say "…"`) ao entrar, antes de cada mudança e ao entregar: é por ali que o usuário acompanha o que está sendo feito. Um pedido pequeno usa só os passos 2 a 6; um projeto novo passa por todos.

1. **Criar ou entrar.**
   - **Projeto que já existe:** `space status` mostra o projeto aberto, as páginas, as seções e o que está selecionado (seção e camada). "Essa seção" ou "esse título" é o que está selecionado. Se o projeto pedido não está aberto: `space open <nome>`.
   - **Projeto novo:** escreva o briefing num arquivo (quem é o cliente, o que vende e para quem, tom de voz, ofertas, diferenciais, links, restrições e o que ainda falta confirmar) e rode `space new "<nome>" --context-file <arquivo>`. A aba abre o projeto vazio. O briefing fica no campo Contexto do projeto: `space brief` mostra, `space brief --file <arquivo>` troca.
   - **Cliente novo no repo:** a fonte de verdade fica em `brands/<cliente>/DESIGN.md` (marca) e `COPY.md` (textos, fontes e pendências), as regras visuais numa seção do cliente no `AGENTS.md` e os builders em `src/features/<cliente>/elementor.ts`. Acrescente o cliente em `CLIENTS`, no começo de `scripts/space/space.mjs`, para o `status` e o `pull` apontarem para esses arquivos.
   - Depois: `space say "Entrei no projeto X. Vou ler a página Y."`
2. **Marca.** `space brand <DESIGN.md>` grava e liga a marca do projeto, que vale para todas as seções e para o card do projeto. Ela não entra no Ctrl+Z (a anterior fica em `.space/<projeto>/marca-anterior.md`). A marca reescreve as seções da biblioteca: antes de gravar, compare `applyBrand` com as seções cruas de todas as páginas, e o esperado é quase nada mudar. Chaves como `label`, `divider`, `button-secondary`, `card` e `motion.hover` costumam reescrever a página inteira.
3. **Ler.** `space pull --page "<página>"` grava uma seção por arquivo em `.space/<projeto>/<página>/`, mais `projeto.md` (o briefing) e `marca.md`. Leia também o `DESIGN.md`, o `COPY.md` e a seção do cliente no `AGENTS.md`. Veja como a página está com `space shot --page "<página>" --device all` e leia as fotos.
4. **Combinar, só quando a decisão for do usuário.** Se o pedido for claro, siga sem perguntar. Se houver escolha de verdade (texto que muda o posicionamento, tirar conteúdo, duas direções visuais), mande uma proposta curta no chat: o que muda, em que página e seção, e o que fica igual. Repita a pergunta no painel com `space say --kind question "…"`.
5. **Fazer, à vista.** Antes de mexer numa seção, marque onde está trabalhando: `space work "Reescrevendo o título" --section <seção>`. A seção fica levemente borrada, com uma varredura e o texto por cima, até o `push` dela, que a faz sair do borrado.
   - **Página nova, ou várias seções novas:** primeiro ponha o plano no canvas com `space plan "Abertura" "Serviços" "Contato" --new "<página>"`, ou com `--page <nome> --after <seção>` numa página que já existe. As seções aparecem em esqueleto borrado, e os arquivos delas já ficam na pasta. Depois construa **uma por vez**, com `work` e `push` em cada uma: quem olha vê a página ficar nítida seção por seção. Não junte tudo para gravar no fim.
   - **Mudar uma seção:** edite `elements` no arquivo dela (textos, settings, ordem dos widgets). Mantenha os ids dos elementos: os ajustes feitos à mão no Space (`data.pinned`) são guardados por id.
   - **Seção nova:** crie um arquivo na pasta da página, sem `id`, com `title`, `place` (`{ "after": "<seção>" }`, `"before"` ou `"index"`) e `elements`. O melhor ponto de partida é uma seção da própria página: mesmo padrão, mesma marca. Para montar com o builder do cliente, escreva `.space/<projeto>/build/<nome>.ts` com `export default { title, place, elements }` e rode `space build <arquivo.ts>`, que gera o `.json`.
   - **Gravar:** `space push <arquivos> --label "<o que mudou, em português simples>"`. Faça um push por mudança combinada: cada um vira um passo do Ctrl+Z e uma linha no painel, e as seções mexidas ficam marcadas "Claude mudou" ou "Claude criou".
   - **Tirar, mover ou criar página:** `space remove <seção> --label "…"`, `space move <seção> --after <seção> --label "…"`, `space page-add <nome>`.
   - **Página que já está no site do cliente:** `space wp pages` lista o site e `space wp import <id>` traz a página para o canvas. As seções chegam marcadas `[do site]`.
6. **Conferir.** `space shot --section <seção> --device all` (desktop e celular). Leia as fotos e corrija antes de seguir. As fotos saem sem animação, de propósito: o movimento se confere no vídeo (passo 8).
7. **Iterar com o cliente.**
   - `space approval send --page "<página>"` cria o link de aprovação (ou troca a foto do mesmo link pela página de agora) e mostra o endereço. O cliente abre sem login, vê a página com as animações e responde Aprovar ou Pedir ajuste. Passe o link ao usuário no chat; a ponte não manda mensagem para ninguém.
   - `space approval --page "<página>" --wait 60` espera a resposta da versão que está no link (confere a cada 20 s; sai com código 2 se o tempo acabar). `space approval` sem `--wait` mostra o estado de todas as páginas, as respostas e se a página mudou depois da última foto.
   - Cada "ajuste pedido" vira mudança na página: `pull`, editar, `push` com um `--label` que cite o pedido, e `approval send` de novo. O mesmo link passa a mostrar a versão nova, e as respostas recomeçam.
   - Para o cliente editar junto, com a conta dele: `space invite create --label "<para quem>"` (vale para uma pessoa, por 7 dias). `space invite` lista quem está no projeto e os convites abertos; `space invite cancel <id>` cancela.
   - Com o app em localhost, os links só abrem neste computador. O comando avisa; para o cliente abrir de fora, o app precisa estar publicado.
8. **Versão final, com movimento.** As regras de movimento de cada cliente ficam na seção dele no `AGENTS.md`: GSAP e ScrollTrigger por jsDelivr num widget HTML que só tem comportamento, todo o conteúdo em widgets nativos, tudo atrás de `prefers-reduced-motion`, e o CSS sozinho já é a composição final. Grave e assista: `space video --page "<página>" --device all` rola a página do topo ao fim com as animações. Corrija o que travar, piscar ou esconder conteúdo, e mande a versão final no link (`approval send`).
9. **Detalhes da página.** `space details --page "<página>" --title "…" --slug "…" --seo-title "…" --description "…" --keyword "…"` grava o título, o endereço e o SEO que vão junto ao publicar (`--slug=` volta ao padrão). Sem opções, mostra o que está gravado.
10. **Conectar o WordPress.** `space wp` mostra a conexão do projeto e as páginas já ligadas ao site. Para conectar: `space wp connect <site>` devolve o link de aprovação no WordPress. Quem administra o site abre o link logado, aprova, e o WordPress mostra uma senha de aplicação. Com o usuário e a senha que essa pessoa passar: `space wp connect <site> --user <login> --password "<senha>"`. Nunca invente nem reutilize credenciais. Se o `wp` avisar que o usuário não tem HTML sem filtro, o WordPress tira os scripts dos widgets HTML ao gravar e o GSAP não roda no site: avise antes de publicar.
11. **Publicar.** `space publish --page "<página>"` sem `--yes` não publica: mostra para onde vai (site, página nova ou atualização, rascunho ou publicada, layout) e o estado da aprovação. Rode com `--yes` só depois de uma destas duas coisas: o cliente aprovou no link a versão atual (APROVADA, e a página não mudou depois), ou o usuário disse nesta conversa para publicar aquela página. Página nova vai como rascunho; `--live` (publicada para todo mundo) só quando o usuário pedir para pôr no ar. `--overwrite` só quando o usuário decidir passar por cima de uma mudança feita no site; senão, traga a mudança com `wp import`. `--layout tema` usa o cabeçalho e o rodapé do tema; o padrão é `canvas`. No resultado, confira as imagens que não subiram e se o cache de CSS limpou.
12. **Saída de emergência.** Se a página publicada saiu errada: `space restore --page "<página>" --yes`, depois de combinar com o usuário, devolve ao site o conteúdo que a página tinha antes da última publicação feita daqui (ficam até 5 versões guardadas).
13. **Entregar.** `space say --kind done "<resumo>"`. No chat, diga o que mudou e onde (página › seção), o que você conferiu nas fotos e no vídeo, o link de aprovação e a resposta do cliente, o endereço no site se publicou, e o que ficou pendente (fato sem prova, foto sem direito de uso, texto a confirmar com o cliente). Lembre que o Ctrl+Z desfaz o que foi feito no canvas, e o `restore` o que foi publicado.

## Regras

- **Sempre faça um `pull` antes de mexer.** O usuário edita no canvas também. Se o `push` recusar porque a seção mudou depois da leitura, faça `pull` de novo e refaça a mudança sobre a versão nova. Só use `--force` se o usuário pedir para passar por cima.
- **Passo para fora do canvas é passo combinado.** Antes de `approval send`, `invite create`, `wp connect` ou `wp import`, diga no chat e no painel o que vai acontecer. Publicar (`publish --yes`) e voltar a versão do site (`restore --yes`) só depois da aprovação do cliente na versão atual ou de um pedido explícito do usuário para aquela página; `--live` e `--overwrite` só com pedido explícito. A permissão de uma página não vale para outra, nem para outra publicação depois.
- **Não invente fatos.** Prova, número, prêmio e depoimento só entram se estiverem no `COPY.md`. Antes de publicar, liste ao usuário as pendências abertas do `COPY.md` (dado de exemplo, foto sem direito de uso, texto a confirmar). As regras visuais estão na seção do cliente no `AGENTS.md` e no `DESIGN.md`, e valem dentro do escopo daquele cliente.
- **Seção marcada `[do site]`** veio do WordPress do cliente: ela não recebe a marca do Space e volta para o site como está. Mexa só no que foi pedido.
- **Decisão do usuário ou do cliente sobre a linguagem visual ou o texto** vai para a seção dele no `AGENTS.md`, e o texto vai para o `COPY.md`, como já se faz hoje. O ajuste pedido no link de aprovação também conta. A mudança da página fica na conta, e não no repositório.
- **`.space/` é só uma cópia de trabalho**, ignorada pelo git. O que vale é o que está na conta.
- **Transformar uma página em modelo reutilizável**, em `*Template.ts`, só se o usuário pedir.

## Comandos

| Comando | Para quê |
| --- | --- |
| `status` | Projeto aberto, páginas, seções (com id curto), seleção e a pasta da marca no repo |
| `projects` / `open <nome>` | Ver os projetos da conta e abrir um na aba do Space |
| `new <nome> [--context "…" \| --context-file <arquivo>]` | Criar um projeto na conta, com o briefing, e abrir na aba |
| `brief [--set "…" \| --file <arquivo>]` | Ver ou trocar o briefing do projeto (o campo Contexto) |
| `brand [<DESIGN.md>] [--on\|--off]` | Ver, gravar (e ligar) ou ligar/desligar a marca do projeto; a anterior fica em `.space/<projeto>/marca-anterior.md` |
| `pull [--page <nome>]` | Baixar páginas para `.space/<projeto>/` (sem `--page`, todas) |
| `push <arquivo\|pasta>… --label "…"` | Gravar as seções alteradas e as novas (só as que mudaram desde a leitura) |
| `remove`, `move`, `page-add`, `page-remove` | Tirar uma seção, mudar a ordem, criar ou tirar uma página |
| `plan "<seção>"… --new <página>` | Pôr o plano no canvas em esqueleto borrado (ou `--page <nome> --after <seção>`) |
| `work "…" --section <seção>` / `work --done` | Mostrar onde o agente está mexendo; `say --kind done` também limpa |
| `build <arquivo.ts>` | Gerar a seção com os builders do repo (alias `@` para `src`) |
| `say "…" [--kind note\|question\|done] [--section <seção>]` | Escrever no painel do Claude no canvas |
| `focus <seção>` / `focus --page <nome>` | Levar o canvas do usuário até a seção ou a página |
| `shot [--page <nome>] [--section <seção>]… [--device desktop\|tablet\|mobile\|all]` | Tirar fotos como o Player mostra; ficam em `.space/<projeto>/fotos/` |
| `video [--page <nome>] [--device desktop\|mobile\|all]` | Gravar a página rolando do topo ao fim, com as animações (relógio virtual e ffmpeg); fica em `.space/<projeto>/videos/` |
| `approval [--page <nome>] [--wait <min>]` | Links de aprovação, respostas e notas do cliente; `--wait` espera a resposta da versão atual |
| `approval send --page <nome>` / `approval revoke --page <nome>` | Mandar a página de agora para o cliente (o mesmo link, versão nova) / desativar o link |
| `invite` / `invite create [--label "…"]` / `invite cancel <id>` | Pessoas e convites do projeto / convidar alguém para editar junto / cancelar |
| `wp` / `wp connect <site> [--user … --password "…"]` | Conexão com o WordPress e páginas ligadas / conectar (link de aprovação, depois a senha) |
| `wp pages` / `wp import <id>…` | Páginas do site / trazer páginas do site para o canvas |
| `details --page <nome> [--title --slug --seo-title --description --keyword]` | Título, endereço e SEO que vão junto ao publicar |
| `publish --page <nome> [--live] [--layout canvas\|tema] [--overwrite] --yes` | Publicar no WordPress; sem `--yes` só mostra o que faria |
| `restore --page <nome> --yes` | Voltar a página do site para a versão de antes da última publicação daqui |

Uma `<seção>` pode ser o id (ou o começo dele), o número na página (`3`, junto com `--page`) ou parte do título. `--json` mostra a resposta crua de qualquer comando.

## Quando algo falha

- **"A ponte não está no ar":** o servidor de dev não está rodando, ou não recarregou o `vite.config.ts`. Com o preview aberto, `touch vite.config.ts` faz ele reiniciar.
- **"Nenhuma aba do Space conectada":** o preview está fechado. Peça para o usuário abrir o app.
- **"ainda abrindo":** o projeto está carregando da conta. Espere uns segundos e rode de novo.
- **Mais de uma aba aberta:** a ponte usa a última que foi usada. Para escolher, `status` lista as abas e `--tab <id>` fixa uma.
- **Login:** a ponte usa o login da aba. Se o preview cair na tela de login, quem entra é o usuário.
- **"A página foi editada no WordPress":** alguém mudou a página no site depois da última sincronização. Traga a mudança com `wp import <id>` e refaça por cima, ou, se o usuário decidir, publique com `--overwrite` (fica um backup).
- **"não pode publicar páginas":** o usuário conectado só edita. Publique como rascunho (sem `--live`) e avise quem administra o site.
- **"O Space não respondeu":** publicar e importar esperam até 280 s, porque as imagens sobem uma a uma. Veja no WordPress se a página chegou antes de rodar de novo.

## Claude e Codex

Os dois usam este mesmo processo e a mesma ponte. O Codex chega aqui por `.agents/skills/cliente/SKILL.md`, que só aponta para este arquivo e lista o que muda no sandbox dele. O painel e as marcas nas seções mostram quem mexeu: Claude, Codex, ou o nome que estiver em `SPACE_AGENT`. Se os dois trabalharem no mesmo projeto, a proteção do `push` vale entre eles também: quem gravar depois da leitura do outro precisa fazer `pull` de novo.
