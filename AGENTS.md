# Project instructions

Este arquivo guarda só as regras que valem em todo trabalho. O detalhe de cada área (o que foi pedido,
como funciona, arquivos, migrações, o que foi testado) fica em `docs/agentes/`: leia o arquivo da área
antes de mexer nela e acrescente ali o que mudar, não aqui (limpeza de 2026-11-07, a pedido do usuário).

## Operação local do SuperElements (Mac dedicado, 2026-10-28)

O usuário pediu que este computador opere exclusivamente o SuperElements e que o agente
faça o trabalho de GitHub, SQL, migrações e Edge Functions pelo terminal, sem depender
do painel web a cada mudança. Use o checkout `/Users/igorpinheiro/ShipStudio/superelements-io`,
o GitHub `bloqxstudio/superelements.io` e o Supabase `nfmfcpcwyavutntnrxqq`.
Siga `OPERACAO.md`. Há atalhos `npm run db:status`, `db:plan`, `db:migrate`, `db:query`
e `functions:deploy -- <nomes>`. A credencial do CLI fica no Keychain; nunca copiar segredos
para arquivos versionados nem variáveis VITE_*. Preserve `verify_jwt` do config.
Dentro do trabalho autorizado, execute e verifique as migrações e os deploys necessários;
não deixe essas etapas manuais para o usuário só porque requerem publicação.
Git commit/push, banco, funções e hospedagem do app são etapas separadas: informe o estado
real de cada uma. Não reaplique migrações antigas sem comparar o histórico remoto.

## Segundo cérebro (2026-11-06)

Contexto de negócio das iniciativas em `cerebro/` (comece por `cerebro/README.md` e `cerebro/AGORA.md`):
uma pasta por iniciativa em `cerebro/iniciativas/` (`sinfy`, `superelements`, `plataforma`) e uma por cliente em
`cerebro/clientes/` (`avence-studio`, `vizor-peliculas`; modelo `_modelos/cliente.md`, com a linha
`**Conta:** <id da conta>`), cada uma com `README.md` (estado e próximos passos), `decisoes.md` (só acrescentar),
`log/` e `midia/`; o que atravessa tudo vai em `cerebro/geral/`. Ao terminar um trabalho que muda o estado de uma
iniciativa (entrega, decisão do usuário, publicação, criativos aprovados), crie um log com
`npm run cerebro:log -- <iniciativa> "título"`, ponha imagens e vídeos com `npm run cerebro:midia` (WebP ≤1600 px,
MP4 ≤1280 px, recusa acima de 50 MB; sem Git LFS) e atualize o README da iniciativa e a linha dela no `AGORA.md`.
Sem segredos e sem contatos de prospects ou clientes finais. O Cérebro **do app** (por conta, tela `/cerebro`)
é outra coisa: `docs/agentes/cerebro.md`.

## Regras permanentes

- **Página de cliente**: cada projeto do Space é um cliente; pedir para analisar ou mudar uma página ou seção
  significa fazer a mudança na página do projeto no canvas (por `scripts/space/space.mjs`), não um modelo novo.
  Siga `.claude/skills/cliente/SKILL.md`. Componentes: `docs/agentes/space-componentes.md`.
- **Marcas**: cada marca tem escopo próprio; não misture. Antes de mexer em arquivos de uma marca, leia
  `docs/agentes/marcas/<marca>.md` e o `brands/<marca>/DESIGN.md`. Aplicar a marca no Space deve mudar 0
  settings nas páginas dela: confira `applyBrand` antes de editar o front matter de um DESIGN.md.
- **Contas**: dados sempre separados por conta (RLS por `team_id`, módulos ligados por conta). Criativos de
  uma conta nunca usam a identidade da Avence nem de outra conta.
- **Avence × Superelements**: a Avence Studio vende serviço (site e plano mensal); Superelements nunca aparece
  ao cliente final, nem planos ou recursos do produto em ofertas e roteiros.
- **Prospects**: nada sai da conta (link, mensagem, publicação, WordPress) sem o usuário. Nunca inventar
  empresas, contatos, números, avaliações ou credenciais. Cópias de varredura (`data/prospeccao/`) não vão ao Git.
- **Redes sociais de terceiros**: nada automatizado em perfis de outras pessoas (seguir, comentar, primeira
  mensagem); WhatsApp nunca envia sozinho a clientes. Nunca raspar o Instagram; única exceção (decisão do usuário,
  2026-11-07): baixar pelo link, no conector, um reel que a pessoa colou como referência do vídeo explicativo
  (`scripts/criativos/reel.ts`), sem login nem cookies e sem guardar o vídeo.
- **Meta**: manter todos os pedidos do App Review (decisão do usuário, 2026-10-28). Não afirmar que DMs ou
  webhooks funcionam antes de uma mensagem real chegar. Estado em `META-PRODUCAO.md` e `docs/agentes/instagram.md`.
- **Egress do Supabase** (2026-11-02): não voltar a gerar link assinado a cada montagem (links de 7 dias ficam
  no localStorage), não encurtar os intervalos de reserva do serviço do WhatsApp (20 s/15 s; ele acorda pela
  Realtime) e manter o conteúdo dos projetos em gzip com cache IndexedDB (`superelements-docs`).
- **Voz no WhatsApp**: não remover `-avoid_negative_ts make_zero` de `services/whatsapp/src/voz.ts`; falha na
  conversão marca o envio como falho, sem mandar o original.
- **Higiene do repositório** (2026-10-28): npm e `package-lock.json` (Lovable fora). `npm test` roda
  `scripts/tests/`; `npm run repo:check` barra temporários, configuração local e mídia gerada no índice.
  `artifacts/`, runtimes, perfis de navegador, `.env` e `.codex/` ficam locais. Não remover testes úteis, não
  apagar nem reaplicar o histórico SQL e o baseline, não reescrever o histórico Git sem decisão específica.
  `public/lovable-uploads/` fica por compatibilidade.
- **Conector**: mudar o chat, a ponte, `space.mjs` ou scripts da Iara/Criativos exige `npm run conector`, e
  quem usa precisa baixar de novo.

## Onde está cada área (`docs/agentes/`)

| Área | Arquivo |
| --- | --- |
| Produção × CRM, contas e módulos, Oportunidades, Social, Instagram da equipe, Anúncios, Stories programados, Site (visitas, mapa, Shopify), WhatsApp (serviço, inbox, fluxos, comandos, IA local, relatórios), leads por webhook | `crm.md` |
| Instagram: link para o cliente conectar, análise de perfil, Meta em produção, DMs por webhook | `instagram.md` |
| Produtos (Completo, Sinfy, SuperElements), conta Sinfy, criativos na marca da conta, MCP da Sinfy, piloto Vizor | `produtos-sinfy.md` |
| Motion nos Criativos (estúdio, publicar, keyframes, cena em código) | `criativos-motion.md` |
| Iara, a assistente (chat único, ações, troca de bastão, equipe, imagens) | `iara.md` |
| Cérebro da conta no app (`/cerebro`, padrões de design, criar imagem, visualizador) | `cerebro.md` |
| Quadros (`/quadros`, canvas livre estilo Miro/FigJam, notas adesivas, ao vivo) | `quadros.md` |
| Pauta e aprovação do cliente | `pauta.md` |
| Formulários (capa, agenda, pixel, publicar, ao vivo e funil) | `formularios.md` |
| Página de cliente e componentes do Space | `space-componentes.md` |
| Sites em código (Astro) | `sites-astro.md` |
| Prospecção, funil, diagnóstico de site | `prospeccao.md` |
| Dia específico nas métricas | `metricas-dia.md` |
| Meu perfil | `perfil.md` |
| Marcas e modelos: MSA, Superelements, Menuzito, UGLYCASH, Zelo, ProcessBase, Inpel, Caramelo Pet, Júnior Automáticos, Leo Scherer, Evermind, Skiper UI, Rodas, Baldez & Moreira, Fonseca & Lorenço, Macarthy Scherer, Cerveira Braggio, Emmanuel Reche Becker, DACM, Stemmer, Ferreira & Bordinhão, Katia Paixão, Avence Studio, Planta & Obra | `marcas/<nome>.md` |

Outros documentos: `docs/agentes/operacao-historico.md` (texto original do cérebro, higiene e egress), `OPERACAO.md` (terminal, banco, deploy), `META-PRODUCAO.md`, `docs/site-imports/`,
`brands/<marca>/` (DESIGN.md e COPY.md de cada marca).
