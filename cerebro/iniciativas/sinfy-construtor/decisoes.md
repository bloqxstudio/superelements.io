# Decisões · Sinfy

## 2026-11-05 · Uma Iara só, no chat do canvas

- **Decisão:** aposentar a IA de cada tela e deixar só a Iara, com Claude Code ou Codex à escolha.
- **Quem decidiu:** Igor.

## 2026-11-06 · Site Astro continua Astro

- **Decisão:** o site em código fica no repositório dele; não vira Elementor nem entra no canvas.
- **Quem decidiu:** Igor.

## 2026-11-07 · Reel do Instagram como referência, baixado pelo link

- **Decisão:** no vídeo explicativo, a pessoa cola o link de um reel e o conector baixa o vídeo (yt-dlp, no computador dela) para a IA ver 10 quadros do estilo. Exceção à regra de não raspar o Instagram, só para esse caso: um link por vez, sem login, sem cookies, sem guardar o vídeo nem automatizar nada em perfis.
- **Alternativa recusada:** só o caminho oficial (reels das contas conectadas pela API e arquivo baixado à mão).
- **Risco aceito:** os termos da Meta não permitem baixar mídia de terceiros por automação; pode afetar a conta ou o App Review.
- **Quem decidiu:** Igor.

## 2026-11-09 · Referências lidas do grupo do Instagram, com a conta pessoal, pelo Mac

- **Decisão:** um grupo de DM no Instagram por cliente. A equipe manda ali os posts de referência, e o Mac da equipe (`services/referencias`), logado na conta pessoal num Chrome próprio, lê o grupo na rotina ou quando alguém pede. Ele abre cada post, guarda a capa e alguns quadros no Cérebro da conta (apaga o vídeo), e a IA local classifica e cria a referência.
- **Por quê:** o usuário disse: "não temos hoje a API oficial e as referências estão no Instagram mesmo".
- **Alternativas apresentadas e recusadas:**
  - Um grupo de WhatsApp por cliente, lido pelo número da equipe que já está conectado. Era o caminho recomendado.
  - Encaminhar por DM ao Instagram da empresa e receber pela API oficial. Depende de o app da Meta ser publicado.
- **Riscos aceitos:**
  - Os termos da Meta proíbem automação com login. Há risco real de bloqueio ou suspensão da conta pessoal.
  - O leitor abre um grupo com mensagens de outras pessoas, mas só guarda os links de posts.
- **Cuidados:**
  - Só leitura.
  - Só os grupos cadastrados.
  - Até 12 posts por volta, com pausas de pessoa.
  - O login é feito pela própria pessoa (`npm run referencias -- entrar`). A senha não passa pelo sistema.
- **Quem decidiu:** Igor.

## 2026-11-09 — Referências do Behance pela extensão do Chrome, não por busca automática

- **Pedido:** "vamos fazer um motor para buscar referências do Behance para o projeto e organizar no app".
- **Contexto:** o Behance bloqueia robôs (403) e o ambiente do agente recusou abrir a busca automatizada.
- **Opções apresentadas:**
  - extensão que salva a página aberta (recomendada);
  - colar links para o Mac importar;
  - busca por termo com rotina.
- **Decisão:** a extensão ("pode ser a 3extensao", lido como a extensão). Só lê a página que a pessoa abriu e só
  salva com o clique dela.
- **Fica de fora:** a busca automática no Behance, que só volta com decisão explícita.
- **Quem decidiu:** Igor.

## 2026-11-09 — Extensão do Chrome das referências retirada

- **Decisão:** depois de testar, Igor disse "retire a feature, não ficou legal, não vamos usar". A extensão, a
  função `referencias-salvar` e as mudanças de banco foram retiradas (migração `20261109220000`).
- **Fica no app:** as 2 referências do Behance salvas no teste, como referências comuns.
- **Quem decidiu:** Igor.
