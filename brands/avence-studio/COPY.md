# Avence Studio — COPY.md

O nosso estúdio de sites. A Home nova do avencestudio.com foi montada no Space em Elementor nativo, para ser o site do studio depois da migração para WordPress. Em 2026-10-04 virou um portfólio: os cases no centro, posicionamento de estúdio com foco em velocidade e a identidade evoluída (página "Identidade" no Space). Fatos, interpretações e pendências ficam separados. **O Superelements nunca aparece aqui**: é só a ferramenta por trás (decisão do usuário, 2026-10-03).

## 1. Fatos (com fonte)

| Fato | Fonte |
|---|---|
| Nome "Avence Studio", escrito "avence studio" em minúsculas no logo | https://avencestudio.com/ (título e cabeçalho) |
| "Soluções digitais · São Leopoldo - RS" | cabeçalho do site atual |
| Botões "Falar com especialista →" e "Solicitar um orçamento →" | site atual |
| Formulário "Vamos conversar · Conta um pouco sobre o seu projeto": situação do site (Primeiro site / Tenho site ativo / Tive mas não tenho mais), principal ação do site (Gerar leads / Vender online / Presença institucional / Outro), prazo limite (Urgente, menos de 2 semanas / 1 mês / 2 a 3 meses / Sem pressa), nome e WhatsApp | site atual (modal `#modal-qualif`) |
| O formulário envia para `/send.php` e leva a `/obrigado.html` ("Recebemos! Em breve entraremos em contato com você.") | site atual |
| WhatsApp (51) 99179-8877 (`wa.me/5551991798877`) | https://avencestudio.com/obrigado.html |
| Fonte Space Grotesk; fundo `#111111`; verde-limão `#C6F135`; favicon com duas setas que se encontram | CSS e `faviconv3.svg` do site atual |
| Medição: Microsoft Clarity `xd7fh14td7` | `<head>` do site atual |
| Instagram @avencestudio | dado pelo usuário (não abre sem login; não foi lido) |
| O site atual não é WordPress: é uma página HTML com GSAP do cdnjs | código do site atual |
| O carrossel do site atual mostra 7 sites como trabalho do studio: Vizor Películas, Prexparts, Contplan, Flávia Neto, Zena Viagens, Infinity Day, Tankker CRM | site atual (imagens com `alt`) |

**O jeito de trabalhar** (dado pelo usuário): mostrar o site novo pronto antes do orçamento para quem já tem site; refazer no mesmo WordPress e endereço; manter a medição dos anúncios; textos dentro das regras de publicidade de profissões reguladas; situações que abrem o WhatsApp com o assunto; publicação com a versão anterior guardada; plano mensal opcional. Em 2026-10-04 o usuário pediu um "como funciona" com **processo aberto** (para qualquer projeto, não só a oferta da prévia) e o **posicionamento de estúdio com foco em velocidade**.

**A oferta**: site novo entregue pronto, cobrado uma vez, e um plano mensal opcional. O preço não vai no site.

## 2. Os cases (conferidos ao vivo em 2026-10-04)

Fotos de página inteira tiradas pelo Edge headless (1440px e 390px), convertidas para WebP em `public/brands/avence-studio/cases/`. O texto de cada case diz só o que se vê no site.

| Case | Endereço | Segmento e cidade (do próprio site) | Plataforma (do código) |
|---|---|---|---|
| **ProcessBase** (case 01, pedido do usuário em 2026-10-04) | https://processbase.com.br/ | consultoria que organiza cultura, processos, treinamentos e planejamento nas empresas ("Sistemas de crescimento operacional para empresas"); São Leopoldo, RS (rodapé do site) | WordPress 7.1 + Elementor 4.3 Pro (Hello); feito por nós (projeto ProcessBase no Space) |
| Vizor Películas | https://vizorpeliculas.com.br/ | películas protetoras para painéis de moto; São Leopoldo, RS | Astro |
| Flávia Neto | https://flavianeto.com.br/ | aulas de yoga; sul da Ilha de Florianópolis, SC | WordPress + Elementor |
| Zena Viagens | https://zenaviagens.com/ | viagens planejadas sob medida | WordPress + Elementor |
| Contplan | https://www.contplan.com.br/ | contabilidade; Porto Alegre, RS (links para bloqxstudio.com no código) | WordPress + Elementor |
| PrexParts | https://prexparts.com.br/ | peças e acessórios para motos | WordPress + Elementor (projeto PrexParts no Space, ligado ao WordPress) |

Na ProcessBase as telas mostram **o efeito do site**, não a foto (pedido do usuário em 2026-10-04), e **o scroll da página rola o site**: um vídeo gravado do site ao vivo, do hero até o fim da história do Método Base (o logo se forma, gira em 3D e os quatro pilares acendem), avança e volta com o scroll, no computador e no celular. A capa da galeria foi tirada sem o GSAP (a página na composição final do CSS, com o logo já laranja). Na gravação e na capa, as duas imagens que o site publicado mostra quebradas (`curva-ciclos.svg` e `processbase-symbol-mono-white.svg`, que ficaram com endereço `localhost`) trocadas pelos arquivos originais. **Corrigir essas duas imagens no WordPress da ProcessBase**: quem abrir "Ver o site ao vivo" vê o gráfico quebrado em "O que muda".

**Ficaram de fora:**
- **Infinity Day** (imersão para psicólogas): infinityday.com.br não abriu daqui, e a busca mostra o domínio com outro evento (empreendedorismo, em Vitória). A tela do carrossel é de um evento com data passada e promete faturamento ("mais de 6 dígitos"), que não entraria na página.
- **Tankker CRM**: tankker.com é hoje uma página de domínio estacionado (`/lander`) e tankker.com.br não responde. O site não está no ar.

Os sites dos clientes mostram números, depoimentos e promessas deles (por exemplo, "200 modelos" na Vizor, os números da Contplan, os depoimentos da Zena). Eles aparecem só dentro das fotos das telas; a página do studio não repete nenhum.

## 3. Textos da Home (o que cada seção diz)

Voz: direta, calma, concreta; mostra o trabalho. A velocidade aparece no processo, não num prazo.

- **Abertura.** "Sites com *acabamento* de estúdio, sem demora." Um estúdio de sites com foco em velocidade: desenho, texto e publicação no WordPress, do primeiro contato ao site no ar, sem meses de espera. A galeria dos seis cases corre embaixo.
- **Cases.** "Sites que estão *no ar*." Cada case: nome, segmento, o que o site tem, plataforma, cidade (quando o site diz) e "Ver o site ao vivo".
- **Serviços.** Site novo, o seu site refeito (mesmo WordPress e endereço, anúncios medindo, versão anterior guardada), plano mensal (opcional, combinado no orçamento).
- **Como funciona.** Processo aberto: Conversa, Direção, Prévia num link, Ajustes, No ar. "Por que anda rápido": um link do começo ao fim; feito onde vai ficar (WordPress e Elementor); quem já tem site começa vendo a versão nova pronta.
- **Recebeu uma mensagem nossa?** A prévia foi feita a partir do site público, nada foi mexido, olhar não custa nem compromete.
- **Perguntas**, **Contato** (o formulário do site atual) e **Rodapé**.

## 4. Interpretações (nossas, não fatos)

- "Ver a prévia não tem custo nem compromisso" e "o site é seu, com ou sem plano" decorrem do jeito de trabalhar. Confirmar.
- "Sem meses de espera" e "sem demora" são o posicionamento pedido (velocidade), sem prazo. Se o studio tiver um prazo típico, ele pode entrar nas perguntas.
- "Feito onde vai ficar: desenho e montagem direto no WordPress e no Elementor" descreve como os sites saem (Elementor nativo). Vale para os sites em WordPress; a Vizor é em Astro.
- O case diz "Site e catálogo de…", "Site de…": descrevem o que a página tem, não o escopo exato do trabalho do studio em cada um.

## 5. Pendências

1. **Autorização dos cases**: confirmar com cada cliente (ProcessBase, Vizor, Flávia Neto, Zena, Contplan, PrexParts) que o site pode aparecer no portfólio, com nome e telas; e que o trabalho foi do studio (e qual parte: desenho, texto, desenvolvimento).
2. **Infinity Day e Tankker**: se tiverem outro endereço no ar, mandar; senão, ficam fora.
3. **Aprovar a identidade nova** antes de usar fora do site (redes, proposta, cartão): a assinatura "avence." com o ponto azul, a Inter Tight com a Instrument Serif nos destaques, o azul `#2B3CF0`. Os arquivos estão em `public/brands/avence-studio/logo/`; trocar a foto e o nome do Instagram e o favicon só depois do sim.
4. **WhatsApp oficial**: (51) 99179-8877 está na página de obrigado do site atual; confirmar.
5. **E-mail** do studio para o formulário (hoje vai para o administrador do WordPress) e a página `/obrigado/` no WordPress novo.
6. **Preço**: fora do site até o padrão do serviço ser decidido.
7. **O que entra no plano mensal**.
8. **Domínio e hospedagem para a migração** (WordPress novo do avencestudio.com, acesso ao DNS) e manter o Microsoft Clarity `xd7fh14td7`.
9. **CNPJ e razão social** para o rodapé; **política de privacidade** (o formulário coleta nome e WhatsApp).
10. **Prazo típico** (se o studio quiser dar um número na pergunta "Quanto tempo leva?").
11. **Quem atende**: o site não mostra pessoas; se o studio quiser, entra uma faixa curta com nome e foto.
