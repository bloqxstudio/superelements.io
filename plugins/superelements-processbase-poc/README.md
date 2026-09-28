# Superelements · ProcessBase MCP POC

POC mínima para provar um chat conectado à base local da ProcessBase.

Ela oferece três ferramentas:

- `get_processbase_project`: apresenta página, marca e capacidades da POC.
- `search_processbase_knowledge`: busca trechos com fonte e linha em `DESIGN.md` e `COPY.md`.
- `create_processbase_page_draft`: grava um JSON Elementor nativo em `drafts/`.

Não há OAuth, Supabase, conexão real com WordPress ou publicação.

## Rodar

```powershell
npm.cmd install
npm.cmd start
```

Servidor MCP: `http://127.0.0.1:8787/mcp`

Teste automatizado:

```powershell
npm.cmd test
```

## Testar no ChatGPT

O ChatGPT não alcança `localhost` diretamente. Para um teste manual, exponha a porta 8787 por um túnel HTTPS e conecte a URL `https://SEU-ENDERECO/mcp` em ChatGPT → Settings → Security and login → Developer mode → Plugins.

Não use este servidor em produção: ele é anônimo e lê arquivos locais do checkout.

## Botão no Superelements

No frontend, o botão `ChatGPT` aparece no cabeçalho do projeto ProcessBase. Sem configuração ele copia o endpoint local acima. Para apontar o botão para um MCP publicado, defina antes do build:

```text
VITE_CHATGPT_MCP_URL=https://mcp.seudominio.com/mcp
```
