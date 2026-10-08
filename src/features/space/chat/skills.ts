/**
 * Skills do chat: um jeito de trabalhar que a pessoa escolhe para o pedido
 * (Web designer, Copywriter, SEO…). As 7 padrão ficam aqui; as globais da
 * equipe e as pessoais de cada um ficam na conta (`space_skills`, tela
 * Skills). A aba mostra o nome e a linha de cada uma; o servidor do chat
 * (`scripts/space/chatPlugin.ts`) põe as instruções no pedido ao agente.
 * Lido pelos dois lados: só dados e texto, sem import.
 *
 * As instruções falam dos comandos da ponte (`node scripts/space/space.mjs
 * <comando>`) e do JSON nativo do Elementor, que é o que o agente edita.
 */

/** As padrão, que vêm no código. */
export type ChatSkillId = 'designer' | 'copy' | 'seo' | 'conversao' | 'celular' | 'acessibilidade' | 'referencia'

/** Padrão (no código), global (da equipe, na conta) ou pessoal (de quem criou). */
export type ChatSkillSource = 'builtin' | 'global' | 'personal'

export interface ChatSkill {
  /** O id da padrão (`designer`) ou o da linha na conta. */
  id: string
  source: ChatSkillSource
  name: string
  /** Uma linha no menu: o que ela faz. */
  hint: string
  /** A imagem anexada é o ponto de partida: sem ela, a caixa pede. */
  needsImage?: boolean
  /** Pedidos prontos para começar. */
  starters: string[]
  /** O que o agente recebe junto com o pedido. */
  instructions: string
  /** Quando mudou (as da conta): mudou no meio da conversa, o agente recebe as instruções de novo. */
  updatedAt?: number
  ownerId?: string
}

const lines = (...text: string[]) => text.join('\n')

export const CHAT_SKILLS: Array<ChatSkill & { id: ChatSkillId }> = [
  {
    id: 'designer',
    source: 'builtin',
    name: 'Web designer',
    hint: 'Hierarquia, espaço, tipografia e ritmo, na marca do projeto',
    starters: ['Revise o visual desta seção e ajuste o que estiver fora do padrão', 'Deixe esta seção mais elegante, com mais respiro', 'Alinhe esta seção ao estilo das outras da página'],
    instructions: lines(
      'Você é um web designer sênior olhando a página como diretor de arte.',
      '1. Veja antes de mexer: `shot --section <id> --device all` (ou `shot --page <nome>` sem seleção) e leia as fotos. Leia a marca (`marca.md` do pull) e as outras seções da página: o padrão delas é a referência.',
      '2. Procure, nesta ordem: hierarquia (um foco por seção, título bem maior que o texto, no máximo três tamanhos de letra por seção); espaço (respiro igual entre blocos irmãos, nada colado na borda, alinhamentos numa grade); tipografia (linhas de texto de 45 a 75 caracteres, entrelinha 1,1–1,2 nos títulos e 1,5–1,7 no texto, famílias e pesos só da marca); cor (só a paleta da marca, um destaque por tela, texto com contraste de pelo menos 4,5:1); consistência (botões, cantos, sombras e ícones iguais aos das outras seções).',
      '3. Mude pouco e com motivo: ajuste as settings que já existem (tamanho, espaço, alinhamento, cor da paleta) antes de mexer na estrutura. Nada de efeito que a marca não tem (gradiente, sombra, vidro, animação). Mantenha os ids e os textos.',
      '4. Se a pessoa anexou uma imagem, ela é a referência: leve a composição, o ritmo e o contraste dela para a marca do projeto, sem trazer cores e fontes de fora.',
      '5. Confira de novo com `shot` no desktop e no celular e responda com cada ajuste e o porquê, uma linha cada.'
    ),
  },
  {
    id: 'copy',
    source: 'builtin',
    name: 'Copywriter',
    hint: 'Textos claros que vendem, no tom da marca, sem inventar fatos',
    starters: ['Reescreva os textos desta seção para vender melhor', 'Sugira três títulos para esta seção, sem gravar ainda', 'Deixe os botões desta página mais claros'],
    instructions: lines(
      'Você escreve para a web como um redator de conversão.',
      '1. Leia o briefing (`projeto.md` do pull) e a página inteira antes de escrever: quem é o cliente, para quem fala, o que oferece e o tom.',
      '2. Título diz o benefício ou a situação de quem lê, em até 10 palavras; o texto de apoio explica em uma ou duas frases curtas; o botão diz a ação e o que vem depois ("Agendar uma visita", não "Saiba mais").',
      '3. Português do Brasil, voz ativa, frases curtas, palavras do dia a dia. Corte adjetivo vazio ("incrível", "de qualidade", "soluções completas").',
      '4. Não invente fato: número, prazo, preço, prêmio, depoimento, garantia ou nome só se já estiverem na página ou no briefing. Faltou um dado? Escreva sem ele e diga o que falta. Clientes com regras de publicidade (advocacia, saúde) seguem as regras deles no AGENTS.md.',
      '5. Mantenha o tamanho perto do original, para não quebrar o layout, e as quebras de linha (`<br>`) dos títulos.',
      '6. Pedido de opções: mostre duas ou três versões no chat antes de gravar. Ao gravar, responda com o antes e o depois de cada texto.'
    ),
  },
  {
    id: 'seo',
    source: 'builtin',
    name: 'SEO',
    hint: 'Títulos, headings, textos alternativos e o SEO da página',
    starters: ['Revise o SEO desta página e corrija o que puder', 'Escreva o título e a descrição de SEO desta página', 'Confira os headings e os textos alternativos das imagens'],
    instructions: lines(
      'Você revisa a página como especialista em SEO on-page.',
      '1. Leia a página inteira (`pull --page <id>`) e o que já está gravado em `details --page <nome>`.',
      '2. Headings: um só H1 na página (o título principal da abertura), H2 no título de cada seção, H3 dentro delas, sem pular nível. O nível é o `header_size`; o tamanho visual fica na tipografia, então trocar o nível não muda o desenho. Rótulo pequeno ou texto decorativo não é heading (`p`, `span` ou `div`).',
      '3. Imagens: cada imagem com conteúdo ganha `alt` curto e descritivo em português (o que mostra, sem "imagem de"); imagem decorativa fica com `alt` vazio.',
      '4. Links e botões: texto que diz o destino ("Ver os serviços de banho e tosa"), não "clique aqui".',
      '5. Detalhes da página: título de SEO com até 60 caracteres (serviço e cidade, quando houver), descrição de 140 a 160 caracteres com o benefício e uma chamada, endereço curto em minúsculas com hífens e uma palavra-chave principal. Grave com `details --page <nome> --seo-title "…" --description "…" --slug … --keyword "…"`.',
      '6. Não encha de palavra-chave nem mude o posicionamento dos textos visíveis sem perguntar. Responda com o que mudou e o que fica como sugestão.'
    ),
  },
  {
    id: 'conversao',
    source: 'builtin',
    name: 'Conversão',
    hint: 'Chamadas, prova, objeções e o caminho até o contato',
    starters: ['O que impede esta página de converter? Liste os três ajustes mais fortes', 'Melhore a primeira tela para quem chega por anúncio', 'Deixe o contato desta página mais fácil'],
    instructions: lines(
      'Você olha a página como quem chega por um anúncio e decide em segundos (CRO).',
      '1. Leia a página inteira e veja a primeira tela no desktop e no celular (`shot --page <nome> --device all`).',
      '2. Confira, nesta ordem: a primeira tela diz o que é, para quem e onde, com uma ação clara; uma ação principal na página inteira (o mesmo botão, com o mesmo texto, nos pontos de decisão), as outras como secundárias; cada objeção comum (preço, confiança, prazo, como funciona) tem resposta perto do botão; contato sem atrito (WhatsApp com mensagem pronta, formulário curto, telefone clicável); prova só se for real (o que já está na página ou no briefing).',
      '3. Mudança de estrutura (tirar, juntar ou mover seções) é proposta: liste os três ajustes de maior impacto com o motivo e espere. Ajuste pequeno (texto de botão, link de WhatsApp, ordem dentro de uma seção) pode fazer direto.',
      '4. Nada de depoimento inventado, número sem fonte, urgência ou escassez falsa. Mantenha a marca.'
    ),
  },
  {
    id: 'celular',
    source: 'builtin',
    name: 'Celular',
    hint: 'Tamanhos, espaços e ordem no tablet e no celular',
    starters: ['Deixe esta seção perfeita no celular', 'Confira a página no celular e corrija o que quebrar', 'Os títulos estão grandes demais no celular: ajuste'],
    instructions: lines(
      'Você deixa a página impecável no tablet (768 px) e no celular (375 px), sem mudar o desktop.',
      '1. Veja antes: `shot --section <id> --device all` (ou a página) e leia as fotos do tablet e do celular.',
      '2. Mude só as settings responsivas, com os sufixos `_tablet` e `_mobile` (`typography_font_size_mobile`, `padding_mobile`, `flex_direction_mobile`, `grid_columns_grid_mobile`, `width_mobile`…). A setting sem sufixo é o desktop: não mexa nela.',
      '3. Regras: nada de rolagem para o lado; o título principal com 28 a 40 px no celular e os de seção com 22 a 30 px; texto com pelo menos 16 px; espaço das seções em cerca de 60 a 70% do desktop; colunas viram uma coluna na ordem de leitura; botões e links com área de toque de 44 px, e o botão principal com a largura toda quando ajudar; imagens sem cortar rosto nem produto.',
      '4. Confira de novo com `shot --device mobile` e `--device tablet` e responda com o que mudou em cada tela.'
    ),
  },
  {
    id: 'acessibilidade',
    source: 'builtin',
    name: 'Acessibilidade',
    hint: 'Contraste, textos alternativos, headings e toque',
    starters: ['Revise a acessibilidade desta página', 'Confira o contraste dos textos desta seção', 'Escreva os textos alternativos das imagens'],
    instructions: lines(
      'Você revisa a página pelas WCAG 2.2, nível AA.',
      '1. Leia a página e veja as fotos (`shot`).',
      '2. Confira: contraste do texto com as cores das settings (4,5:1; 3:1 para texto grande, ícones e bordas de campo); `alt` em toda imagem com conteúdo e vazio nas decorativas; headings na ordem, sem pular nível; links e botões com texto que faz sentido sozinho; áreas de toque de pelo menos 44 px; nada que dependa só da cor; campos de formulário com rótulo; animação atrás de `prefers-reduced-motion`.',
      '3. Corrija com settings o que der (cor da paleta da marca que passa no contraste, `alt`, `header_size`, tamanho). Se a correção mudar a marca (uma cor dela que não passa), proponha antes.',
      '4. Responda com a lista: o problema, onde está e o que foi feito ou fica como sugestão.'
    ),
  },
  {
    id: 'referencia',
    source: 'builtin',
    name: 'Recriar referência',
    hint: 'Monta ou ajusta a seção a partir de uma imagem, na marca do projeto',
    needsImage: true,
    starters: ['Recrie esta referência como uma seção nova abaixo da selecionada', 'Ajuste a seção selecionada para ficar com a estrutura da imagem', 'Use esta foto na seção selecionada'],
    instructions: lines(
      'A pessoa mandou uma imagem: a referência de um layout (um site, um print) ou uma foto para usar.',
      '1. Abra e estude a imagem: estrutura (colunas, grade, alinhamentos), hierarquia (o que se lê primeiro), proporções, espaços e elementos (cards, listas, selos, botões, imagens). Antes de mexer, diga em três a cinco linhas o que vai levar dela.',
      '2. Monte com o Elementor nativo, como as outras seções da página: containers flex ou grid e widgets de título, texto, imagem, botão e ícone. Nunca um widget HTML com o layout dentro.',
      '3. Leve a estrutura e o ritmo, não a marca de outro: cores, fontes, cantos e botões vêm da marca do projeto (`marca.md`) e das outras seções. Os textos vêm da página ou do briefing; o texto da referência não é do cliente (diga o que falta).',
      '4. Foto para usar na página (e não referência): ponha o caminho do arquivo no `url` da imagem.',
      '5. Seção nova: arquivo sem `id`, com `place` perto da seleção. Seção selecionada: mude ela e mantenha os ids que ficarem.',
      '6. Confira com `shot --section <id> --device all` comparando com a imagem, ajuste o que ficou longe e responda com o que foi levado e o que foi adaptado à marca.'
    ),
  },
]

export const CHAT_SKILL_IDS = CHAT_SKILLS.map((s) => s.id)

/** Uma das padrão, pelo id. */
export const skillById = (id: string | undefined | null) => CHAT_SKILLS.find((s) => s.id === id)

// ---------- SKILL.md ----------

const MAX_HINT = 200
/** Instruções de uma skill cadastrada, em caracteres (o mesmo limite do banco). */
export const MAX_SKILL_TEXT = 30000

/** Um valor do cabeçalho YAML: na mesma linha (com ou sem aspas) ou em bloco (`>` ou `|`). */
function yamlValue(header: string, key: string): string {
  const lines = header.split(/\r?\n/)
  const at = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (at < 0) return ''
  const inline = lines[at].slice(key.length + 1).trim()
  if (inline.startsWith('"')) {
    try {
      return String(JSON.parse(inline)).trim()
    } catch {
      return inline.replace(/^"|"$/g, '').trim()
    }
  }
  if (inline.startsWith("'")) return inline.replace(/^'|'$/g, '').replace(/''/g, "'").trim()
  if (!/^[>|][+-]?$/.test(inline)) return inline
  const block: string[] = []
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && !/^\s/.test(line)) break
    block.push(line.trim())
  }
  return (inline.startsWith('|') ? block.join('\n') : block.join(' ')).trim()
}

/** O `name` do Claude Code é um identificador ("web-design-pro"). */
const isSlug = (name: string) => /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(name)

/** "web-design-pro" vira "Web design pro"; nome com espaço fica como está. */
const prettyName = (name: string) => (isSlug(name) ? name.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) : name)

/** O que a pessoa edita numa skill. */
export interface SkillDraft {
  name: string
  hint: string
  instructions: string
  starters: string[]
  needsImage: boolean
}

/**
 * Uma skill do Claude Code (`SKILL.md`: cabeçalho com `name` e `description`,
 * e o texto) vira os campos daqui. Sem cabeçalho, o primeiro título é o nome
 * e o arquivo inteiro são as instruções.
 */
export function parseSkillMarkdown(text: string): SkillDraft {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(clean)
  const header = match?.[1] ?? ''
  const body = (match ? match[2] : clean).trim()
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? ''
  // A primeira frase da descrição: as do Claude Code costumam ser longas ("Use quando…")
  const sentence = yamlValue(header, 'description').split(/(?<=[.!?])\s/)[0] ?? ''
  const id = yamlValue(header, 'name')
  // O título do texto (com acento e espaço) é melhor nome que o identificador, se for curto
  const name = id && !isSlug(id) ? id : heading && heading.length <= 40 ? heading : id || heading || 'Skill importada'
  return {
    name: prettyName(name).slice(0, 60),
    hint: sentence.length > MAX_HINT ? `${sentence.slice(0, MAX_HINT - 1).trimEnd()}…` : sentence,
    instructions: body.slice(0, MAX_SKILL_TEXT),
    starters: [],
    needsImage: false,
  }
}

/** A skill como `SKILL.md`, para levar ao Claude Code ou a outra conta. */
export function skillMarkdown(skill: Pick<ChatSkill, 'name' | 'hint' | 'instructions'>) {
  const slug =
    skill.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  return `---\nname: ${slug}\ndescription: ${JSON.stringify(skill.hint || skill.name)}\n---\n\n# ${skill.name}\n\n${skill.instructions.trim()}\n`
}
