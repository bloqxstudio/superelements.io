# Registros de operação (texto original)

## Segundo cérebro (2026-11-06)

O usuário: "uma base de conhecimento da empresa, como um segundo cérebro… as pastas da iniciativa… todo
contexto do que estamos construindo, como estamos e o que vamos fazer no próximo passo… salvar logs de tudo
que está acontecendo na iniciativa, imagens, criativos". Fica em `cerebro/` (comece por `cerebro/README.md`
e `cerebro/AGORA.md`): uma pasta por iniciativa em `cerebro/iniciativas/` (`sinfy`, `sinfy-construtor`, `plataforma`) e uma por cliente em
`cerebro/clientes/` (`avence-studio`, `vizor-peliculas`; modelo `_modelos/cliente.md`, com a linha `**Conta:** <id da conta>`), com `README.md` (estado atual e próximos passos), `decisoes.md` (só acrescentar), `log/` e
`midia/`; o que atravessa tudo vai em `cerebro/geral/`. Ao terminar um trabalho que muda o estado de uma
iniciativa (entrega, decisão do usuário, publicação, criativos aprovados), crie um log com
`npm run cerebro:log -- <iniciativa> "título"`, ponha imagens e vídeos com `npm run cerebro:midia` (converte
para WebP ≤1600 px e MP4 ≤1280 px, recusa acima de 50 MB; o repositório não tem Git LFS) e atualize o
README da iniciativa e a linha dela no `AGORA.md`. Sem segredos e sem contatos de prospects ou clientes
finais. O detalhe técnico continua neste arquivo; o cérebro guarda o contexto de negócio e aponta para cá.

## Higiene do repositório (2026-10-28)

O usuário pediu separar testes, temporários e resíduos do Lovable para limpar o GitHub.
Use npm e `package-lock.json`; Lovable e seus taggers não fazem parte da ferramenta.
`npm test` executa os testes reproduzíveis em `scripts/tests/`; `npm run repo:check`
impede temporários, configuração local e mídia gerada no índice. Não remover testes
úteis para limpar resultados de testes. Capturas e renders em `artifacts/`, runtimes,
perfis de navegador, `.env` e `.codex/` ficam locais e ignorados; as fontes de produção
e os assets servidos por `public/` continuam no Git. O único arquivo histórico em
`public/lovable-uploads/` foi preservado por compatibilidade com projetos salvos.
As notas de importação de sites estão em `docs/site-imports/`, separadas das migrações
SQL em `supabase/migrations/`. O histórico SQL e o baseline foram preservados e o
plano remoto foi conferido sem novas pendências; não apagar nem reaplicar esse histórico.
A limpeza tirou arquivos apenas do índice, preservando as cópias locais. Não reescrever
o histórico Git para reduzir seu tamanho sem uma decisão específica sobre isso.

## Tráfego de saída do Supabase (2026-11-02)

A Supabase avisou que a organização passou da cota de egress do plano grátis (5 GB; Fair Use a partir de 2026-12-03).
Medido nos logs (24 h): mídia do WhatsApp ~174 MB/dia (link assinado novo a cada recarga), conteúdo dos projetos
do Space ~160 MB/dia (JSON de 6–45 MB baixado a cada abertura) e o serviço do WhatsApp com ~95 mil consultas/dia.
Correções: `useMediaUrl` (`whatsappChats.ts`) guarda o link de 7 dias no localStorage, então o navegador reaproveita o
arquivo (mídia com cache de 1 ano, fotos de perfil 7 dias); o conteúdo do projeto (`doc-….json`, nunca regravado) é
gravado em gzip (~3× menor; a leitura aceita JSON antigo e gzip pelos bytes `1f 8b`) e fica num cache IndexedDB
(`superelements-docs`, os 12 mais recentes) por caminho, inclusive o que a própria aba gravou; o serviço do WhatsApp
acorda pela Realtime (`crm_whatsapp_numbers`, mensagens `queued`) e só consulta a cada 20 s/15 s como reserva
(antes 2 s/1,5 s). Não voltar a gerar link assinado por montagem nem a encurtar esses intervalos.
