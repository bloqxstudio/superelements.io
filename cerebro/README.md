# Segundo cérebro

A base de conhecimento da empresa: o que estamos construindo, em que pé está e qual é o próximo passo,
por iniciativa. Tudo em Markdown, versionado no Git, legível no GitHub e no Obsidian (abra a pasta
`cerebro/` como cofre).

No app: menu Plataforma › **Cérebro** (`/cerebro`, só o admin). No `npm run dev` a tela lê e edita estes
arquivos ao vivo; o app publicado mostra a última cópia enviada pelo botão "Enviar ao app publicado".

Comece por **[AGORA.md](AGORA.md)**: o painel de uma página com o estado de cada frente.

## Mapa

| Pasta | O que guarda |
| --- | --- |
| [AGORA.md](AGORA.md) | O que está em andamento e o próximo passo de cada iniciativa. Sempre atual. |
| [geral/](geral/README.md) | O que atravessa tudo: a empresa, as marcas, quem é quem, decisões gerais. |
| [iniciativas/sinfy](iniciativas/sinfy/README.md) | Sinfy, o produto de resultados (anúncios, site, leads, conteúdo). |
| [iniciativas/superelements](iniciativas/superelements/README.md) | SuperElements, o construtor (Space, Elementor, Criativos, Motion, Sites em código). |
| [iniciativas/plataforma](iniciativas/plataforma/README.md) | A base comum: contas, CRM, WhatsApp, Instagram, Iara, Supabase, Meta. |
| [clientes/](clientes) | Uma pasta por cliente. Cada conta só enxerga a sua. |
| [_modelos/](_modelos) | Modelos de nota: iniciativa, cliente, log e decisão. |

## Clientes

Cada cliente tem a sua pasta em `clientes/<nome>/`: README (quem é, o que fazemos, estado, números), marca, conteúdo,
site e números, decisões, log e mídia. **A empresa ativa dita tudo:** na tela do app e na Iara, uma conta de cliente só vê a pasta dela;
a conta da casa vê o cérebro da empresa e a própria pasta, nunca a de outro cliente. Para ver outro, troque de conta.
O README de cada cliente liga a pasta à conta pela linha `**Conta:** <id>`.
Modelo: [_modelos/cliente.md](_modelos/cliente.md).

## Como cada iniciativa se organiza

```
iniciativas/<nome>/
  README.md     o que é, por que existe, estado atual, próximos passos, links
  decisoes.md   as decisões tomadas, com data e o porquê (só acrescentar)
  log/          um arquivo por acontecimento: AAAA-MM-DD-titulo.md
  midia/        imagens, criativos, capturas e vídeos, por mês (AAAA-MM/)
```

- **README** é o retrato de hoje: reescreva quando o estado mudar.
- **decisoes.md** é histórico: nunca apague uma decisão; quando mudar, escreva a nova e diga qual substitui.
- **log/** é o diário: o que aconteceu, o que entregamos, o que aprendemos, com imagens. Um log não se reescreve depois.

## Comandos

```bash
# novo log a partir do modelo (iniciativa ou "geral")
npm run cerebro:log -- sinfy "Série de lançamento aprovada pelos sócios"

# imagens, criativos, vídeos e PDFs, já leves para o Git; mostra o Markdown para colar
npm run cerebro:midia -- sinfy ~/Downloads/capa.png ~/Downloads/reels.mov --nome serie-lancamento
```

`cerebro:midia` converte imagem para WebP de até 1600 px e vídeo para MP4 H.264 de até 1280 px, e recusa
arquivo acima de 50 MB (limite prático do GitHub). Vídeo longo ou material bruto: guarde no Drive e ponha o
link na nota.

## Regras

- **Fato, opinião e hipótese separados.** Escreva "medido", "decidido", "achamos" ou "a confirmar".
- **Sem segredos**: nada de tokens, senhas, chaves, chaves de serviço ou `.env`.
- **Sem dados pessoais de terceiros**: contatos de prospects, telefones e e-mails de clientes finais ficam
  no CRM, não aqui. Nomes de empresas clientes e o que entregamos podem ficar.
- **Datas absolutas** (2026-11-06), nunca "ontem" ou "semana que vem".
- **Links para o código** quando houver: `src/features/...`, migrações, PRs.
- O detalhe técnico de cada funcionalidade continua no `AGENTS.md` da raiz; aqui fica o contexto de negócio,
  o estado e o próximo passo, com link para lá quando precisar.
