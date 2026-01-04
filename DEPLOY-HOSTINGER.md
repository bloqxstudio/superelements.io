# Deploy na Hostinger

## Instruções de Deploy

### 1. Build do Projeto
```bash
npm run build
```

### 2. Upload dos Arquivos
Faça upload de **todos os arquivos da pasta `dist/`** para o diretório `public_html` da sua hospedagem na Hostinger.

Estrutura no servidor:
```
public_html/
├── .htaccess          (importante!)
├── index.html
├── assets/
│   ├── index-*.css
│   ├── index-*.js
│   ├── react-vendor-*.js
│   └── ui-vendor-*.js
├── favicon.ico
├── robots.txt
└── outros arquivos...
```

### 3. Verificações Importantes

#### ✅ Arquivo .htaccess
O arquivo `.htaccess` já está configurado e será copiado automaticamente para a pasta `dist/` durante o build. Ele contém:
- Redirecionamento de rotas para React Router
- Redirecionamento HTTP para HTTPS
- Headers de segurança
- Compressão de arquivos
- Cache do navegador

#### ✅ Permissões
Certifique-se de que o arquivo `.htaccess` tem as permissões corretas (644).

### 4. Testando o Deploy

Após o upload, acesse:
- `https://seudominio.com` - deve carregar a aplicação
- `https://seudominio.com/qualquer-rota` - deve funcionar (React Router)

### 5. Troubleshooting

#### Erro: "Root element not found"
✅ **RESOLVIDO** - O arquivo `.htaccess` agora redireciona corretamente todas as rotas para `index.html`

#### Erro 404 em rotas
Verifique se:
1. O arquivo `.htaccess` foi enviado para o servidor
2. O módulo `mod_rewrite` está habilitado no Apache da Hostinger (geralmente está)

#### Cache antigo
Limpe o cache do navegador com `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac)

### 6. Atualizações Futuras

Para atualizar a aplicação:
1. Execute `npm run build`
2. Faça upload dos arquivos da pasta `dist/` substituindo os antigos
3. Limpe o cache do navegador

### 7. Variáveis de Ambiente

Se você usar variáveis de ambiente (`.env`), certifique-se de:
1. Prefixar com `VITE_` (ex: `VITE_API_URL`)
2. As variáveis são incorporadas no build, não são lidas no servidor

## Configurações Removidas

- ❌ `vercel.json` - Removido (específico da Vercel)
- ✅ `.htaccess` - Adicionado (para Hostinger/Apache)

## Suporte

Em caso de problemas, verifique:
1. Logs de erro do navegador (F12 > Console)
2. Painel de controle da Hostinger
3. Arquivo `.htaccess` está presente e com permissões corretas
