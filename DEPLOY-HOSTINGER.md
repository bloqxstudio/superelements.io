# Publicação do SuperElements na Hostinger

O ambiente `app.avencestudio.com` é um Web App ligado ao GitHub `bloqxstudio/superelements.io`, branch `main`. Esse fluxo foi confirmado no painel em 28/10/2026.

## Antes do envio

```sh
npm ci
npm test
npm run repo:check
npm run build
```

Revise o diff, preserve alterações de outras sessões e envie somente os arquivos da mudança. Use npm e o `package-lock.json` do app; o serviço de WhatsApp tem dependências e execução próprias.

## Publicação

Um push para `main` dispara a publicação do app. No hPanel, abra Websites → app.avencestudio.com → Deployments, confira o commit e aguarde Completed/Current. Depois verifique o domínio e o recurso alterado. Se o deploy falhar, consulte os logs e mantenha a versão anterior até corrigir a causa.

Não faça upload manual para `public_html` nem use as instruções antigas de publicação pelo Lovable. O diretório `dist/` é resultado do build e fica fora do Git.

## Supabase e serviço local

Commit e deploy da interface não executam SQL nem publicam Edge Functions. Para isso, siga `OPERACAO.md`, revise `db:plan` e publique somente as funções afetadas. Atualizações de `services/whatsapp` também exigem atualizar o serviço no Mac; não iniciar uma segunda instância.

Variáveis `VITE_*` são públicas e incorporadas ao bundle. Não colocar nelas tokens de serviço ou senhas. Segredos do servidor são configurados no Supabase, e a credencial administrativa do terminal fica no Keychain.
