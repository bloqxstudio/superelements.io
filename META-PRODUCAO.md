# Meta em produção — estado em 28/10/2026

App Meta: `3199354486942505` (superelements). Instagram App: `1116154637674071`.
Portfólio: `1191219215514629`. Responsável informado pelo usuário: IP TECNOLOGIA LTDA,
CNPJ público localizado `65.450.502/0001-60`, São Leopoldo/RS, sócio Igor Pinheiro do
Nascimento. Suporte e privacidade informado pelo usuário: `contatoigorpinheiro@gmail.com`.
Fonte do cadastro: https://casadosdados.com.br/solucao/cnpj/ip-tecnologia-ltda-65450502000160.
Confirmar dados com os documentos aceitos pela Meta antes de concluir a verificação.

## Estado real

- App da Meta não publicado. O botão Publish está desabilitado.
- Cadastro básico salvo na Meta: ícone oficial 1024×1024, categoria Serviços e produtividade, e-mail de suporte e URLs de privacidade e exclusão. As duas páginas estão públicas e foram verificadas sem login.
- Empresa ainda não verificada. Fluxo iniciado no Centro de Segurança, Brasil → Empresa privada → CNPJ/nome → endereço → telefone/site. A Meta interrompeu com “Ajuda-nos a confirmar que és tu”; aguarda validação do usuário. Nada foi enviado como verificação concluída.
- Verificação como provedor de tecnologia (Access verification), exigida no painel para dados de outras empresas, depende da verificação empresarial.
- Solicitar somente os acessos avançados necessários no App Review, demonstrando cada recurso por vídeo com conta de teste e instruções reproduzíveis. Não remover casos de uso existentes sem conferir dependências.
- `avencestudio` e `igorpinheiro.cc` constam como Instagram Testers, convites aceitos. Token atual tem `instagram_business_manage_messages`.
- Teste: DM visível no Instagram nativo; API oficial ainda retorna zero conversas. Isso **não** prova a causa nem que produção por si só resolverá. Conferir ferramentas conectadas, validações do Integration Helper, aprovação e teste real após publicação. Não reconectar repetidamente, nem copiar mensagens pelo navegador para fingir sincronização.

## Mudanças técnicas desta rodada

Função `instagram` publicada v11, ACTIVE, no projeto `nfmfcpcwyavutntnrxqq`, mantendo a configuração JWT existente e validação de usuário dentro da função.

- Conversas usam ID da conta, paginação por cursores (inclusive página vazia com próxima), deduplicação, limite de quatro páginas e indicação explícita de leitura parcial. Nunca buscar a URL `paging.next` com credenciais; apenas extrair `after` e reutilizar o endpoint fixo.
- Permissão ausente, resposta vazia e falha da API voltam como estados distintos. Tokens manuais antigos com lista de permissões desconhecida ainda são consultados.
- `accountOf` verifica módulo antes de operar com o token do servidor.
- Login usa retorno HTTPS permitido pelo servidor: padrão `https://app.avencestudio.com/instagram/retorno`. Outros retornos exigem configuração explícita `INSTAGRAM_REDIRECT_URIS` (separados por vírgula) e cadastro correspondente na Meta. Não liberar domínios arbitrários ou localhost na função de produção.
- Interface: seletor de perfil na Caixa, componentes reiniciados ao mudar de conta/conversa, prevenção de leituras sobrepostas, erros de atualização em segundo plano visíveis e seleção do perfil recém-conectado após OAuth.
- Conversas longas exibem as 300 mensagens mais recentes em ordem cronológica, em vez das primeiras 300.

Interface publicada na Hostinger pelo commit `97f8760492851a8fb7c9da0de5239397de6b79cc` na `main`. Deploy marcado Completed/Current; verificada a seleção de conta e os novos estados da Caixa em `https://app.avencestudio.com/crm/instagram?aba=caixa`. Hostinger está conectado ao GitHub e publica os pushes; não usar upload para `public_html`.

Sem migração nova nesta rodada; `db:status` não indicou novas pendências. Textos de privacidade e exclusão aprovados explicitamente pelo usuário em 28/10/2026, publicados em `/privacidade.html` e `/exclusao-de-dados.html` e cadastrados no app Meta. Não há termos de serviço publicados neste trabalho.

## Validação

- `node --test scripts/tests/instagram-paging.test.mjs`: 3 testes passaram (página vazia, cursor repetido, limite de trabalho).
- `npx eslint` nos cinco arquivos de interface alterados: passou.
- `npx --yes --package=deno -- deno check --node-modules-dir=none --no-lock supabase/functions/instagram/index.ts`: passou.
- `npm run build`: passou (aviso preexistente de tamanho dos bundles).
- `npx tsc -p tsconfig.app.json --noEmit`: falha em erros preexistentes fora dos arquivos desta mudança (`space/bridge/client.ts`, `leoschererTemplate.ts`, `superelements/modelo/elementor.ts`). Não declarar que o typecheck completo passou.

## Critério para liberar contas de clientes

Uma conta profissional de outra empresa, sem papel de testador, precisa conseguir autorizar via OAuth, escolher o perfil correto no seu ambiente, carregar métricas e conteúdo autorizados, receber uma DM real e permitir uma resposta dentro da janela de 24h. Verificar que um usuário de outra conta não consegue ler nem operar seus dados, que revogação pede reconexão e que desconexão atua somente no perfil selecionado. Não anunciar “qualquer conta” ou DMs funcionando antes desse teste e das aprovações da Meta. Contas pessoais não são suportadas por esta integração oficial.

## App Review e pendências atuais

A submissão `3199354583609162` está em Not submitted. Há pedidos antigos de recursos
que o código não usa (arrecadação, catálogos, WhatsApp oficial, Messenger/Páginas,
criação de anúncios/MCP, branded content e Instagram Login antigo). Foi preparado
o fluxo para retirar somente do rascunho da revisão; o aviso da Meta diz que isso
não remove permissões do app e permite re-adicionar pelo caso de uso. A revisão
automática bloqueou a confirmação por falta de autorização específica; foi pedida
a aprovação ao usuário. Nenhum desses pedidos deve ser removido antes da resposta.

Permissões efetivamente pedidas no código: Instagram Login moderno (basic,
manage_insights, content_publish, manage_comments, manage_messages); anúncios
`ads_read` (não usa business_management, nem escreve campanhas). No rascunho atual
ainda faltam os três pedidos Instagram de insights, publicação e comentários.
Preparar os pedidos corretos e evidência real por recurso; não enviar submissão
com demonstração de DMs vazias como se a função estivesse operando.

O Centro de Segurança foi recarregado e retomado uma vez. A empresa já aparece
como IP TECNOLOGIA LTDA, Envio pendente, mas o fluxo volta ao desafio vazio
“Ajuda-nos a confirmar que és tu”. Não houve confirmação de identidade nem envio
final da verificação empresarial. `Publish` continua desabilitado; Access
verification ainda depende da empresa verificada.
