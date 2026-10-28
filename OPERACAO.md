# Operação do SuperElements neste Mac

Diretório principal: `/Users/igorpinheiro/ShipStudio/superelements-io`.
GitHub: `bloqxstudio/superelements.io`.
Supabase de produção: `nfmfcpcwyavutntnrxqq`.

## GitHub e SSH

A conta ativa do `gh` é `bloqxstudio`. O SSH usa a chave existente
`~/.ssh/id_ed25519_bloqxstudio`, tanto em `github.com` quanto no alias
`github-bloqxstudio`. O remote do projeto usa o alias. Chaves privadas não entram no Git.

Verificação: `gh auth status`, `ssh -T git@github.com` e `git ls-remote origin HEAD`.
O SSH do GitHub retorna status 1 mesmo quando a mensagem confirma autenticação.

## Supabase

O CLI oficial está em `/opt/homebrew/bin/supabase` (2.122.0 na configuração inicial).
O projeto está vinculado por `supabase link --project-ref nfmfcpcwyavutntnrxqq`.
O token `superelements-terminal` é restrito a este projeto e não expira, por autorização explícita do usuário. A credencial fica no Keychain do macOS, gerenciada por `supabase login`; não coloque
PAT, senha de banco ou chave de serviço no código, no AGENTS.md ou em VITE_*.
`supabase/.temp/` e `.branches/` são estado local ignorado pelo Git.

Execute os comandos a partir do diretório do projeto:

| Tarefa | Comando |
| --- | --- |
| Histórico e funções publicadas | `npm run db:status` |
| Revisar migrações pendentes, sem aplicá-las | `npm run db:plan` |
| Criar migração | `supabase migration new nome_da_mudanca` |
| Aplicar migrações após revisar o plano | `npm run db:migrate` |
| Consultar SQL | `npm run db:query -- "select current_user"` |
| Executar arquivo SQL | `npm run db:query -- --file caminho.sql` |
| Publicar funções específicas | `npm run functions:deploy -- instagram meta-ads` |

Os scripts fixam o destino SuperElements. A publicação usa `--use-api`, sem Docker.
A configuração `verify_jwt` vem de `supabase/config.toml`; não aplique
`--no-verify-jwt` globalmente. Informe os nomes das funções: o atalho não publica todas
nem remove funções remotas que não estejam no checkout.

## Rotina de mudança

1. Conferir `git status` e preservar mudanças de outras sessões.
2. Criar arquivos de migração versionados para alterações de esquema.
3. Conferir o histórico remoto e o plano. Migração já aplicada pelo editor SQL precisa
   de verificação do resultado antes de registrar `migration repair --status applied`.
   Nunca executar novamente nem marcar todo o histórico antigo como aplicado sem conferir.
4. Aplicar as migrações necessárias ao trabalho autorizado e verificar o resultado.
5. Publicar apenas as funções afetadas e conferir a versão remota.
6. Fazer os testes apropriados e informar o que realmente foi aplicado/publicado.

Commits e pushes não aplicam migrações, não publicam funções e não publicam o app.
A hospedagem do app é separada. Confirmado no painel em 2026-10-28: `app.avencestudio.com`
é um Web App Hostinger com deploys do GitHub `bloqxstudio/superelements.io`, branch `main`.
Confira o commit e o resultado em Deployments; um push só conta como publicação após
o deploy terminar e os arquivos serem verificados no domínio público. O upload para
`public_html` de `DEPLOY-HOSTINGER.md` é o fluxo antigo e não deve ser usado neste app.

## Conexão temporária do banco

Neste projeto o usuário temporário `cli_login_postgres` falha com erro 42501, mesmo após o reset oficial. Por isso os atalhos de banco usam diretamente a Management API oficial, autenticada pelo mesmo token no Keychain. Não precisam da senha permanente de Postgres nem de mudanças nas permissões de tabelas. O CLI continua sendo usado no deploy das funções. Consulte
[a orientação oficial do Supabase](https://supabase.com/kb/troubleshooting/permission-denied-when-deleting-the-cli_login_postgres-role).
A remoção desse papel deve usar a API oficial `/v1/projects/<ref>/cli/login-role`;
não alterar permissões de tabelas nem desligar RLS para contornar o problema.

O sandbox desta conversa ainda pode exigir autorização do executor para rede, Keychain
ou escrita fora do diretório da conversa. Isso é independente do login nos serviços.

## Baseline legado e migrações futuras

O banco mantém histórico antigo com timestamps diferentes dos arquivos locais e várias
mudanças posteriores foram aplicadas pelo editor SQL. `supabase/migration-baseline.json`
registra os hashes dos arquivos existentes em 2026-10-28 e adota o banco atual como baseline.
Isso **não certifica que cada arquivo legado rodou**; impede seu replay automático.
Não modifique esses arquivos. Escreva uma nova migração com data atual para toda mudança.

`db:plan` consulta o histórico pela API, verifica que os arquivos do baseline não mudaram
e mostra somente migrações novas. `db:migrate` executa cada migração numa transação com
lock e registra sua versão original em `supabase_migrations.schema_migrations`. Não use
`supabase db push --include-all` contra este histórico legado. Não inclua COMMIT/ROLLBACK
explícitos dentro de arquivos de migração; a transação pertence ao executor.

O cliente em `scripts/supabase-api.mjs` lê o token do Keychain via `/usr/bin/security`
e o transmite somente à API HTTPS oficial do projeto fixado. O token não aparece em
argumentos de processo, logs nem arquivos. Autorize esse acesso no Chaves uma vez;
“ Sempre Permitir ” evita uma nova janela a cada comando.
