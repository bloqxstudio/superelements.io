# Cerveira Braggio Advocacia — COPY.md

**Prospecto, não é cliente.** Este arquivo junta o que é público sobre o escritório (cada fato com a fonte), a análise do site atual pelas regras de publicidade da OAB e os textos da Home nova montada no Space para mostrar e vender o redesign. Nada aqui foi confirmado pelo escritório. Lido em 2026-10-03.

Regra: fato só entra na página se estiver aqui com fonte. Interpretação e proposta ficam marcadas como tal. O que falta está em §9.

## 1. Identificação

| Item | Valor | Fonte |
|---|---|---|
| Nome no site | Cerveira Braggio Advocacia ("Advocacia e Consultoria Jurídica" no título da página) | https://braggio-lawyer.com/ (`<title>`) |
| Nome no logo e no rodapé | Cerveira Braggio – Advogados Associados | logo `1692986104613-Photoroom.webp` e rodapé de https://braggio-lawyer.com/ |
| Nome no Facebook | Cerveira Braggio - Advogados Associados | https://www.facebook.com/p/Cerveira-Braggio-Advogados-Associados-100091973582357/ (link do site) |
| Razão social | CERVEIRA BRAGGIO - SOCIEDADE INDIVIDUAL DE ADVOCACIA | Receita Federal via https://brasilapi.com.br/api/cnpj/v1/48925125000159 |
| CNPJ | 48.925.125/0001-59 | idem |
| Natureza | Sociedade Unipessoal de Advocacia; titular: Andreza Cerveira Braggio | idem |
| Início da atividade | 19/12/2022 (situação: ativa) | idem |
| Endereço no mapa do site | Rua São Caetano, 410, sala 602, Centro, São Leopoldo (RS), CEP 93010-090 | consulta do widget `google_maps` da home (o endereço não aparece escrito na página) |
| Endereço na Receita | Rua São Caetano, 410, **sala 603**, Centro, São Leopoldo (RS), CEP 93010-090 | BrasilAPI (acima) |
| Outro nome no mesmo endereço | "Freitas & Cerveira Braggio - Advocacia Contemporânea", R. São Caetano, 410 | ficha do Waze (busca pública, 2026-10-03) |

O nome "Advogados Associados" não bate com o registro (sociedade individual, uma titular). Ver §7 e §9.

## 2. Contatos (todos do site atual)

- WhatsApp: (51) 99585-2531 (`wa.me/5551995852531`, também o telefone da Receita). Mensagem pronta do site atual: "Olá! Vi o seu anúncio no site e preciso de um especialista em direito imobiliário".
- Telefone: (51) 2160-4282.
- E-mail: andrezaadv@hotmail.com.
- Instagram: @cerveirabraggioadvocacia (sem login não mostra as fotos; o usuário decidiu seguir sem ele). A advogada tem também @andrezabraggio (não usado).
- Facebook: Cerveira Braggio - Advogados Associados (link acima).
- LinkedIn: https://www.linkedin.com/in/andreza-cerveira-braggio-40b703176 (pede login; não lido).
- Horário de atendimento: **não é público** no site.

## 3. A advogada

Tudo do bloco "Sobre mim" de https://braggio-lawyer.com/:

- Andreza Cerveira Braggio, advogada inscrita na **OAB/RS 129.181**.
- **Pós-graduação em Direito Imobiliário** (o site diz "com especialização em Direito Imobiliário"). A instituição e o ano não aparecem.
- Atua como **perita judicial nomeada pelo Tribunal de Justiça do RS** (o site não diz em que comarca nem desde quando).
- "Mais de 10 anos de prática jurídica" (afirmação do próprio site; sem data de início).
- Atende locadores, compradores e administradoras de imóveis (texto do site).
- O site antigo dela no Wix (https://andrezaadv0.wixsite.com/website, de 2018) mostra outro endereço, em Estância Velha, e o título "Gestora Jurídica Imobiliária": está desatualizado e não é usado.

Fotos públicas (do site atual): o retrato recortado de camisa rosé e a foto trabalhando no notebook no escritório (painel de madeira e um biombo vazado preto ao fundo). Direito de uso: pendência.

## 4. O que o escritório faz (site atual)

Público, nas palavras do título do site: **locadores, locatários, compradores e condomínios**. "Atendimento em todo o Brasil".

Áreas, com o que o site lista em cada uma:

| Área (site) | O que o site lista |
|---|---|
| Contratos imobiliários | Elaboração e revisão de contratos de locação, compra e venda, comodato, entre outros |
| Conflitos condominiais | Barulho, obras irregulares, inadimplência, assembleias |
| Ações locatícias | Despejo, cobrança de aluguéis, revisional e renovatória |
| Regularização imobiliária | Usucapião, registro de imóveis, averbações, documentação |
| Consultoria preventiva para investidores | Segurança jurídica para aquisições, locações e imóveis de leilão |

Também diz: atuação preventiva e contenciosa; atendimentos online e presenciais; flexibilidade de agenda; "atendimento humanizado e direto com a advogada".

## 5. Identidade visual

- **Logo** (arquivos do site, fundo transparente): monograma "CB" em dourado com uma coluna no meio do B, e o letreiro "CERVEIRA BRAGGIO" em capitulares romanas, com "ADVOGADOS ASSOCIADOS" entre dois filetes. Gradiente dourado. Cópias em `public/brands/cerveira-braggio/logo/`:
  - `cerveira-braggio-logo-dourado.png` (619 × 290, de `wp-content/uploads/2025/07/1692986104613-Photoroom.webp`): logo completo. Não vai para a Home nova porque traz "Advogados Associados" (§7).
  - `cerveira-braggio-monograma-dourado.png` (512 × 512, de `wp-content/uploads/2025/07/cropped-1692986104613-Photoroom-1.webp`, o ícone do site): só o monograma.
- **Cores do site** (`wp-content/uploads/elementor/css/post-7.css`): dourado `#CFA354` (o mais usado), grafites `#2E2E2E`, `#0E0E0E`, `#131313`, `#424242`, branco e cinzas claros; botões em degradê verde do WhatsApp (`#009F16` → `#4ABE5A`). O kit global do Elementor (`post-6.css`) ficou no padrão (azul `#6EC1E4`, Roboto): ninguém configurou as cores globais.
- **Fontes do site**: Poppins (quase tudo) e Plus Jakarta Sans.
- **Fotos** em `public/brands/cerveira-braggio/fotos/`:
  - `andreza-retrato.webp` (860 × 1280, recorte sem fundo; de `wp-content/uploads/2025/07/IMG_7740-Photoroom.webp`).
  - `andreza-escritorio.webp` (1456 × 986; de `wp-content/uploads/2025/07/IMG_7657-1.webp`).
  - As duas fotos de prédios do site (`8262.webp`, `2149661456-e1751493014790.webp`) são de banco de imagem e não foram copiadas.

## 6. O site atual

- WordPress 6.8.10, Elementor 4.1.4, tema Hello Elementor, modelo "Canvas"; cache LiteSpeed; Google Tag Manager; plugin Joinchat (botão do WhatsApp). Rápido (0,3 s).
- Uma página só (a home, `page-id-7`, slug `direito-imobiliario`, de 2025-07-04) e o post padrão "Olá, mundo". Formato de página de anúncio: o rodapé diz que o site "não faz parte do Google LLC nem do Facebook Inc." e que não oferece serviço oficial do governo.
- Ordem: abertura escura com foto de banco de um condomínio, logo, título em caixa alta e o retrato recortado; "Por que contar com uma advogada imobiliária?" (quatro ícones); "Serviços jurídicos especializados" (cinco cartões); "Sobre mim"; "Soluções sob medida" sobre outra foto de banco; "Fale conosco agora" com contatos e o mapa; rodapé.
- **O que tem de melhor**: a advogada aparece (retrato bom, foto real no escritório), o número da OAB está escrito, as áreas são claras e concretas (despejo, revisional, usucapião, leilão) e o público está dito no título.
- **O que falta**: o endereço não está escrito (só no mapa), não há horário, as perguntas comuns não têm resposta, seis botões iguais ("Quero falar com um advogado", no masculino, para uma advogada), fotos de banco, títulos em caixa alta que pesam no celular, o kit global do Elementor sem as cores da marca.

## 7. Regras de publicidade da OAB (Código de Ética arts. 39–47 e Provimento 205/2021) no site atual

Ponto a ponto, para o texto novo evitar e, na conversa, ser dito como cuidado, nunca como acusação:

1. **"Advogados Associados" para uma sociedade individual.** O registro na Receita é "Cerveira Braggio - Sociedade Individual de Advocacia", com uma titular. O nome usado na publicidade deve ser o da sociedade registrada; "associados" sugere mais de um advogado. É o ponto mais sensível. A Home nova usa "Cerveira Braggio Advocacia" (o nome do próprio site) e mostra a razão social no rodapé; o escritório confirma.
2. **"Advogados altamente capacitados para te atender"** (rodapé): autoelogio e plural para uma advogada só.
3. **"Evite prejuízos, reduza riscos e tome decisões seguras"** e **"Resolução ágil de conflitos"**: soam como promessa de resultado e de prazo.
4. **"Vasta experiência", "carreira sólida", "soluções jurídicas eficazes", "defesa estratégica"**: adjetivos de autopromoção; o Provimento pede informação objetiva.
5. **"O atendimento é imediato"**: promessa de prazo com tom de chamada comercial.
6. **"Especialista em Direito Imobiliário"**: permitido com título de especialização; o site diz que há pós-graduação. A Home nova escreve "pós-graduada em Direito Imobiliário" e deixa "especialista" para o escritório confirmar com o certificado.
7. **"Mais de 10 anos de prática jurídica"**: informação de tempo de atuação, aceitável se verdadeira; fica como pendência e não vai para o título.
8. **Aviso de página de anúncio** no rodapé ("não faz parte do Google LLC…"): não é proibido, mas destoa de um escritório; a Home nova não o repete.
9. O que está certo: OAB visível, sem preço, sem depoimento, sem caso concreto, sem "consulta grátis".

## 8. Textos da Home nova (Space, projeto "Cerveira Braggio", página Home)

Tudo informativo. Situações escritas como a pessoa pensaria; o nome técnico vem embaixo. Etapas, lista de documentos e respostas das dúvidas são **propostas** para o escritório confirmar.

- **Abertura.** Rótulo: "Direito imobiliário · São Leopoldo, RS". Título: "Cada imóvel tem a sua planta. / Cada caso, também." Texto: "Contratos, locações, condomínios e regularização de imóveis, para quem aluga, mora de aluguel, compra, administra ou investe. O atendimento é direto com a advogada, no Centro de São Leopoldo ou online." Ações: "Conversar pelo WhatsApp" e "Ver as situações". Legenda: "Presencial em São Leopoldo · Online em todo o Brasil · Direto com a advogada" (as três vêm do site atual). Na prancha: "Folha 01" e "OAB/RS 129.181"; cota sob o retrato: "Andreza Cerveira Braggio · advogada".
- **Situações** ("Em que lado do imóvel você está?"): seis cômodos de uma planta, cada um com a situação na primeira pessoa, o que o escritório faz (as listas do site atual, §4) e "Conversar sobre isso" no WhatsApp com o assunto: 01 Quem aluga um imóvel ("Meu inquilino parou de pagar o aluguel."), 02 Quem mora de aluguel ("Quero rever o aluguel ou renovar o contrato do meu ponto."), 03 Quem vai comprar ("Vou comprar um imóvel e quero conferir tudo antes de assinar."), 04 Quem vive em condomínio ("Tenho um problema de barulho, obra ou inadimplência no condomínio."), 05 Quem precisa regularizar ("Moro no imóvel há anos, mas ele não está no meu nome."), 06 Quem investe ("Quero investir em imóveis ou arrematar um em leilão."). Embaixo: "Não encontrou a sua situação? Conte em uma mensagem curta: a advogada diz se é um assunto que o escritório atende."
- **A advogada.** Título "Andreza Cerveira Braggio"; texto: inscrita na OAB do RS, pós-graduada em Direito Imobiliário, atende proprietários, inquilinos, compradores, condomínios, administradoras e investidores; atendimento direto com ela, presencial ou online. O carimbo ("Cerveira Braggio Advocacia · Folha 02"): Advogada, Inscrição OAB/RS 129.181, Formação "Pós-graduação em Direito Imobiliário", Perícia "Perita judicial nomeada pelo TJRS", Atendimento "Presencial e online, com agenda flexível" (do "flexibilidade de agenda" do site).
- **Primeiro contato** ("Como começa a conversa."): sigilo profissional dito com todas as letras; três passos na cadeia de cotas (Uma mensagem · A conversa · O caminho, com honorários explicados antes de qualquer decisão) e "O que separar para a conversa" (contrato, matrícula atualizada, IPTU, notificações e mensagens, convenção e atas). **Proposta.**
- **Onde fica** ("No Centro de São Leopoldo. E online, para todo o Brasil."): Rua São Caetano, 410, sala 602 (602 ou 603: pendência), Centro, CEP 93010-090; mapa nativo; WhatsApp, telefone, e-mail; "Agenda flexível: combine o melhor horário pelo WhatsApp ou por telefone."
- **Dúvidas** ("Perguntas de quem tem um imóvel."): primeiro atendimento, sigilo (Estatuto e Código de Ética), inquilino que não paga (Lei 8.245/1991, despejo com cobrança), revisional (três anos de contrato ou do último acordo) e renovatória (imóvel comercial, entre um ano e seis meses antes do fim do contrato), usucapião em cartório (extrajudicial, com advogado), leilão (edital, matrícula, dívidas, ocupação), atendimento online, honorários (depois da primeira conversa). **Respostas gerais, para a advogada revisar.**
- **Chamada final.** "Antes de assinar, converse." + WhatsApp e "Ligar (51) 2160-4282".
- **Rodapé.** Nome, "Advocacia · Direito imobiliário", endereço, contatos, redes; "Cerveira Braggio – Sociedade Individual de Advocacia · CNPJ 48.925.125/0001-59 · Advogada responsável: Andreza Cerveira Braggio, OAB/RS 129.181" e "Conteúdo informativo, conforme o Código de Ética e Disciplina da OAB e o Provimento 205/2021."

## 9. Pendências (confirmar com o escritório)

1. Nome a usar: "Cerveira Braggio Advocacia" (site) ou "Advogados Associados" (logo, Facebook, rodapé) diante do registro de sociedade individual. E a relação com "Freitas & Cerveira Braggio - Advocacia Contemporânea" (Waze, mesmo endereço).
2. Sala 602 (mapa do site) ou 603 (Receita).
3. Horário de atendimento (não é público).
4. Pós-graduação em Direito Imobiliário: instituição e ano, e se pode aparecer "especialista".
5. Perita judicial nomeada pelo TJRS: comarca e se deve aparecer no site.
6. "Mais de 10 anos de prática jurídica": data de referência (fora da Home nova até confirmar).
7. Direito de uso das duas fotos e, se houver, fotos novas do escritório (sala, prédio, equipe).
8. Arquivo oficial do logo (vetor) e uma versão sem "Advogados Associados", se o nome mudar.
9. Etapas do primeiro contato, lista de documentos e respostas das dúvidas: propostas, para a advogada ajustar.
10. Nota do Google: não lida (o escritório pode informar; entra só como fato discreto).
11. Atendimento online "em todo o Brasil": manter a frase do site?
