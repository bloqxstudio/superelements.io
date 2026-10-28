# SuperElements — instruções para Claude Code

@AGENTS.md
@OPERACAO.md

## Acesso ao Supabase neste Mac

Use os comandos do projeto, a partir deste diretório:

- `npm run db:query -- "select current_user, current_database()"`
- `npm run db:plan`
- `npm run db:migrate`
- `npm run functions:deploy -- <nome-da-funcao>`

Os atalhos de banco usam a Management API oficial e a credencial `superelements-terminal`
do Keychain do macOS. Não exigem autenticar o conector MCP do claude.ai. A conexão MCP
`claude.ai Supabase` pode aparecer como `Needs authentication` sem impedir estes comandos.
O comando nativo `supabase db query --linked` falha neste projeto por um problema no
papel temporário `cli_login_postgres`; use `npm run db:query` em vez dele.

Aplique e verifique as migrações e funções necessárias ao trabalho autorizado. Não peça
que o usuário copie SQL no painel quando estes comandos estiverem funcionando. Não leia
nem imprima o token. Não altere o baseline para esconder uma migração pendente.

Em 2026-10-28 foram aplicadas e registradas as migrações `20261028100000` e `20261028110000`.
Os arquivos de configuração e operação criados nesta sessão ainda não foram commitados.
