import type { ChatSkillRef } from '../space/chat/protocol.ts'
import type { Opportunity } from './funnel.ts'
import { displayName } from './offer.ts'
import { PLATFORM_LABEL } from './score.ts'

/**
 * A página de um prospecto, criada pelo botão ▶ da coluna "Fila da página"
 * (`FunnelBoard.tsx`, `usePageBuild.ts`): o briefing que vira o Contexto do
 * projeto novo e o jeito de trabalhar que a IA conectada recebe pelo chat do
 * Space. Vale para o Claude Code e o Codex, no repositório (`npm run dev`) ou
 * na pasta do conector, onde não há builders nem `AGENTS.md` do repo.
 */

const lines = (...text: Array<string | false | undefined | null>) => text.filter((t): t is string => typeof t === 'string').join('\n')

/** O que a busca achou da empresa, para o campo Contexto do projeto (o `brief` do agente). */
export const projectBriefing = (o: Opportunity) => {
  const lead = o.lead
  const scan = lead.scan
  const contacts = [
    lead.phone && `- Telefone: ${lead.phone}`,
    scan?.whatsapp && `- WhatsApp: ${scan.whatsapp}`,
    ...[...new Set([lead.email, ...(scan?.emails ?? [])].filter(Boolean))].map((email) => `- E-mail: ${email}`),
    scan?.instagram && `- Instagram: ${scan.instagram}`,
    scan?.facebook && `- Facebook: ${scan.facebook}`,
    scan?.linkedin && `- LinkedIn: ${scan.linkedin}`,
  ]
  const versions = [
    scan?.wpVersion && `WordPress ${scan.wpVersion}`,
    scan?.elementorVersion && `Elementor ${scan.elementorVersion}${scan.elementorPro ? ' Pro' : ''}`,
    scan?.theme && `tema ${scan.theme}`,
    scan?.builder && !/elementor/i.test(scan.builder) && scan.builder,
  ]
  return lines(
    `# ${displayName(lead.name)}`,
    '',
    'Prospecto do funil de prospecção, **não é cliente**. A página nova é a peça de venda do estúdio para oferecer um site novo. Nada sai da conta (publicar, link de aprovação, convite, WordPress, mensagem para a empresa) sem quem vende decidir.',
    '',
    '## Da busca',
    `- Nome no Google Maps: ${lead.name}`,
    `- Nicho: ${lead.niche}${lead.category ? ` (categoria no mapa: ${lead.category})` : ''}`,
    `- Região da busca: ${o.region}`,
    lead.address && `- Endereço: ${lead.address}`,
    lead.neighborhood && `- Bairro: ${lead.neighborhood}`,
    ...contacts,
    lead.rating && `- Google: nota ${lead.rating.toFixed(1).replace('.', ',')}${lead.reviews ? ` com ${lead.reviews} avaliações` : ''} (leitura da busca, a confirmar; nunca como depoimento)`,
    lead.mapsUrl && `- Mapa: ${lead.mapsUrl}`,
    '',
    '## Site atual',
    scan?.url && scan.platform !== 'sem-site' ? `- Endereço: ${scan.url}` : '- Sem site próprio na busca.',
    scan && `- Plataforma: ${PLATFORM_LABEL[scan.platform]}${versions.some(Boolean) ? ` (${versions.filter(Boolean).join(', ')})` : ''}`,
    scan?.title && `- Título da página inicial: ${scan.title}`,
    scan?.agency && `- Feito por: ${scan.agency.name}${scan.agency.url ? ` (${scan.agency.url})` : ''}`,
    scan?.copyrightYear && `- Ano no rodapé: ${scan.copyrightYear}`,
    scan?.ads?.length && `- Anúncio pago no site: ${scan.ads.join(', ')}. Ao publicar, a medição (tags e conversões) precisa continuar.`,
    scan?.sales?.length && `- Vende pelo site: ${scan.sales.join(', ')}`,
    '',
    '## Por que é oportunidade',
    ...lead.reasons.map((reason) => `- ${reason}`),
    o.offer?.service && '',
    o.offer?.service && '## O que vamos oferecer',
    o.offer?.service
  )
}

/** O pedido que aparece na conversa do projeto (as instruções vão na skill). */
export const requestText = (o: Opportunity) => `Crie a página inicial nova de ${displayName(o.lead.name)} para a prospecção, do começo ao fim, e devolva o cartão no funil.`

/** Retomar uma criação que parou (erro, limite do plano, alguém parou). */
export const resumeText = (o: Opportunity) => `Continue a criar a página inicial de ${displayName(o.lead.name)} de onde parou: confira o que já está no canvas antes de mexer, termine as seções que faltam e devolva o cartão no funil.`

/** Mudou o jeito de trabalhar: a versão nova manda as instruções inteiras de novo numa conversa que já existe. */
const VERSION = '2026-10-12'

const INSTRUCTIONS = lines(
  'Você está criando, sozinho e do começo ao fim, a página inicial nova de uma empresa que ainda NÃO é cliente: um prospecto do funil de prospecção. A página é a peça de venda do estúdio: a empresa vai ver o site dela refeito e pronto antes de qualquer orçamento. Quem pediu apertou um botão e foi fazer outra coisa: trabalhe até o fim sem perguntar e deixe as dúvidas como pendências na resposta.',
  '',
  'Regras que não mudam',
  '- Nada sai da conta: não publique, não mande link de aprovação, não convide, não conecte WordPress e não fale com a empresa.',
  '- Só fatos públicos, de fonte que você leu: o briefing do projeto (a busca) e o site atual da empresa. Nunca invente nome, número, registro profissional, preço, prazo, prêmio, depoimento, avaliação, horário, cliente atendido ou foto. Faltou um dado? Escreva sem ele e anote como pendência.',
  '- Profissão com regra de publicidade (advocacia: Código de Ética e Provimento 205/2021 da OAB; saúde: CFM, CFO, CRP, CFN, COFFITO; veterinária: CFMV): texto informativo e discreto, sem promessa de resultado, depoimento, antes e depois, preço, "consulta grátis", superlativo ou "especialista" sem título comprovado; o nome e o registro profissional (OAB, CRM, CRP…) na página, quando o site mostrar.',
  '- O estúdio e as ferramentas não aparecem na página: nada de Avence Studio, Superelements, Space, IA ou agente.',
  '- Texto longo do site da empresa não vai para a resposta (já derrubou agentes no filtro de conteúdo): grave os fatos num arquivo e responda só o resumo.',
  '- Trabalhe só dentro de `.space/` (cópia de trabalho, fora do git). Nada em `src/`, `brands/`, `public/` ou no `AGENTS.md`: o repositório é publicado e os contatos da empresa ficam fora dele.',
  '',
  'O caminho (comandos da ponte: `node scripts/space/space.mjs <comando>`)',
  '1. Ler. `prospect <id>` mostra a oportunidade (contato, site, plataforma, anúncio, o roteiro de venda atual) e `brief` mostra o briefing do projeto. `status` mostra a página Home (vazia: o projeto acabou de nascer) e a pasta do projeto em `.space/`.',
  '2. Ler o site atual, se houver: a página inicial e até quatro páginas internas que importam (quem somos, serviços ou áreas, equipe, contato). Peça os textos e também os endereços das imagens (logo, fotos reais da equipe, do lugar, dos trabalhos). Grave em `.space/<pasta do projeto>/fatos.md` cada fato com o endereço de onde veio: como a empresa se apresenta, o que faz e para quem, serviços, pessoas e registros, endereço, telefones, WhatsApp, e-mail, redes, horário, anos de atuação. Anote as tags de anúncio que achar (Google Ads `AW-…`, Tag Manager `GTM-…`, Pixel da Meta): ao publicar, a medição precisa continuar. Site fora do ar ou sem site: trabalhe com o briefing e diga isso nas pendências.',
  '3. Conceito. Uma ideia que vem da própria empresa (o logo, o nome, o ofício, o lugar), não de um modelo genérico; a abertura e as seções seguem essa ideia. Se `.space/prospectos-conceitos.md` existir, leia e acrescente uma linha com o seu (empresa · conceito · cores · fontes), para a próxima página não sair parecida.',
  '4. Marca. Escreva `.space/<pasta>/DESIGN.md` e grave com `brand .space/<pasta>/DESIGN.md`. O cabeçalho (entre as linhas `---`) tem só: `name`, `description`, `colors` (nomes como primary, on-primary, accent, background, surface, text-body, muted, border, com hex entre aspas, tirados do logo e do site, com contraste de pelo menos 4,5:1 no texto), `fonts` (`heading: { family: … }` e `body: { family: … }`, duas famílias do Google Fonts), `radius: { button: …px }` e `logo` (`on-light`, `on-dark` e `alt`, com o endereço público do logo). Nada de label, divider, card, sombra ou movimento: essas chaves reescrevem a página.',
  '5. Plano. `plan "Cabeçalho" "Abertura" … --page Home` põe as seções em esqueleto no canvas e cria os arquivos delas. Sete a dez seções, na ordem de quem chega pelo celular ou por um anúncio: cabeçalho (logo, menu curto e o contato principal), abertura (o que a empresa faz e onde, em uma frase, e o botão de contato), o que ela resolve (serviços ou áreas escritos como a situação de quem procura), como é o primeiro contato, quem atende (pessoas e registro, se o site mostra), onde fica (endereço e o mapa `google_maps`), perguntas (`nested-accordion`), chamada final e rodapé (nome, registro, endereço, contatos). Sem depoimentos, números ou clientes que não estejam no site.',
  '6. Montar uma seção por vez, à vista: `work "<o que está fazendo>" --section <id>`, escreva `elements` no arquivo da seção e grave com `push <arquivo> --label "<seção>"`. Não junte tudo para gravar no fim.',
  '   - JSON nativo do Elementor: um container raiz por seção (`"elType": "container"`, `content_width`, `flex_direction`, `flex_gap`, `padding`, `background_background` + `background_color`) e widgets nativos (`heading`, `text-editor`, `button`, `image`, `icon-list`, `icon-box`, `nested-accordion`, `google_maps`, `form`). Cada elemento com um `id` próprio de 7 letras e números e `elements: []` nos widgets. Nenhum widget HTML, script ou animação nesta etapa.',
  '   - Conteúdo com largura máxima por volta de 1200px, respiro de seção generoso, e as medidas de tablet e celular (`_tablet`, `_mobile`). Cores e fontes só as da marca. Títulos acima de 16px na fonte de títulos e textos pequenos (rótulos, menu, botões) na fonte de texto; imagem do logo sempre com largura explícita. Assim a marca, ligada, não muda o desenho.',
  '   - Botões de contato vão para o WhatsApp (`https://wa.me/55…?text=` com a mensagem dizendo o assunto) ou o telefone (`tel:`), com os números do briefing ou do site.',
  '   - Imagens: só as reais da empresa, pelo endereço público delas (`"image": { "url": "https://…", "id": "" }`). Nada de banco de imagens nem foto inventada; sem foto boa, a seção é tipográfica.',
  '   - Com o repositório por perto (pasta `src/`), as seções de outros projetos em `.space/*/home/*.json` mostram o formato aceito. Não copie o desenho delas.',
  '7. Conferir. `shot --page Home --device all` e leia as fotos (desktop e celular): corrija o que estiver quebrado, apertado, ilegível, cortado ou fora da marca. Se a marca ligada mudou o desenho, `brand --off`.',
  '8. Detalhes. `details --page Home --title "<empresa>" --slug inicio --seo-title "…" --description "…"`.',
  '9. Devolver o cartão. Escreva `.space/<pasta>/roteiro.json` com os campos `what`, `how`, `best`, `points` e `objections` (português, uma ideia por linha), partindo do roteiro atual (`prospect <id>`) e do que você achou no site. Quem vende é o estúdio, como agência: a mensagem assina "Aqui é [seu nome], da Avence Studio" e oferece o site novo entregue pronto e, opcional, um plano mensal para cuidar dele; nunca os planos ou recursos do Superelements e nunca um valor (o valor fica na oferta do funil). A primeira mensagem é curta, cita um problema real do site atual (ou o anúncio que eles já pagam) e pede licença para mandar o link. Depois: `prospect <id> --stage pagina --brief-file .space/<pasta>/roteiro.json --next "Mandar a primeira mensagem" --note "<conceito em uma frase e as pendências>"`.',
  '10. Responder, curto: o conceito, as seções, de onde vieram os fatos e as pendências para confirmar com a empresa (dado sem fonte, foto sem direito de uso, nome ou registro a confirmar). Por último, `work --done`.',
  '',
  'Se não der para terminar (site bloqueado, limite do plano, erro da ponte), deixe no canvas o que já ficou bom, não mova o cartão e diga na resposta o que falta.'
)

/** Vai como skill da conversa: o servidor do chat põe as instruções inteiras no primeiro pedido e um lembrete nos seguintes. */
export const PAGE_SKILL: ChatSkillRef = {
  id: 'prospeccao-pagina',
  name: 'Página de prospecção',
  instructions: INSTRUCTIONS,
  version: VERSION,
}
