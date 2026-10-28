# SuperElements

Aplicação da Avence Studio para projetos de sites, criação de conteúdo e CRM por conta de empresa. O app usa React, TypeScript e Vite, com autenticação, banco e funções no Supabase. O serviço local de WhatsApp fica separado da interface.

Produção: https://app.avencestudio.com

## Desenvolvimento

Use Node.js 22.18 ou mais recente e npm. O arquivo de dependências reproduzíveis do app é `package-lock.json`.

```sh
npm ci
cp .env.example .env
npm run dev
```

O servidor abre somente em `localhost` (porta padrão 8080). O login automático de desenvolvimento, quando configurado, usa `DEV_AUTH_EMAIL` e `DEV_AUTH_PASSWORD` em um arquivo local; essas credenciais nunca devem receber o prefixo `VITE_`.

A configuração pública do Supabase está em `.env.example` e no cliente do app. Chaves públicas não dão acesso administrativo: o banco aplica as políticas por usuário e empresa. Chaves de serviço, tokens, senhas e configurações pessoais ficam fora do Git. Consulte `OPERACAO.md` para a credencial do terminal no Keychain.

## Organização

| Pasta | Conteúdo versionado |
| --- | --- |
| `src/` | Interface e regras do app. |
| `public/` | Arquivos servidos pelo app: marcas, imagens, fontes, vídeos usados e páginas públicas. |
| `supabase/functions/` | Funções do servidor. |
| `supabase/migrations/` | Histórico SQL do banco; necessário para evolução e rastreabilidade. |
| `scripts/` | Ferramentas de desenvolvimento e operação. |
| `scripts/tests/` | Testes automatizados reproduzíveis, mantidos no Git. |
| `services/whatsapp/` | Serviço independente, com seu próprio `package-lock.json`. |
| `brands/` | Diretrizes e conteúdo de marcas e projetos. |
| `docs/site-imports/` | Notas históricas de importação de sites; não são migrações do banco. |
| `artifacts/` | Fontes de produções, scripts, HTML e textos; capturas e vídeos gerados ficam locais. |

A pasta `public/lovable-uploads/` contém um arquivo histórico que pode estar referenciado em projetos salvos. O caminho foi preservado por compatibilidade; não existe dependência nem integração ativa com o Lovable. O tagger e as instruções antigas de publicação pelo Lovable foram removidos.

## O que fica fora dos commits

O `.gitignore` separa configurações locais, builds, dependências baixadas, perfis de navegador, cache, relatórios de teste e mídia gerada em `artifacts/`. As cópias locais existentes foram preservadas. Para novos arquivos temporários, use `tmp/` ou `.tmp/`; para capturas e renders, use `artifacts/`.

Não ignore testes só por serem testes: mantenha o código e os fixtures necessários para reproduzir um problema. Ignore os resultados da execução. Arquivos em `public/` podem ser parte do produto e não devem ser removidos só por serem imagens ou vídeos.

## Verificação antes de publicar

```sh
npm test
npm run repo:check
npm run build
```

`repo:check` confere os arquivos do índice Git, inclusive os preparados para commit. O lint geral (`npm run lint`) e o typecheck do projeto ainda têm pendências anteriores à limpeza; não são apresentados como aprovados por esses três comandos.

## Banco e publicação

```sh
npm run db:plan
npm run db:migrate
npm run functions:deploy -- instagram
```

Consulte `OPERACAO.md` antes de executar alterações. O histórico antigo usa o baseline em `supabase/migration-baseline.json`; não apague nem altere migrações aplicadas, não execute `db push --include-all` contra ele e escreva uma nova migração para mudanças novas. Nenhum dado do banco é apagado por uma limpeza do Git.

O app publica na Hostinger a partir de pushes para `main` em `bloqxstudio/superelements.io`. Confirme o commit em Deployments e verifique o domínio depois do deploy. Migrações e funções do Supabase são publicações separadas. O estado da integração Meta está em `META-PRODUCAO.md`.

Leia `AGENTS.md` para as decisões e restrições de cada área do produto.
