import * as IA from './_gerado/inteligencia.js'
import { asUser, type PlatformCaller, type PlatformDeps, type PlatformTool } from './plataforma.ts'

/**
 * O MCP como caminho principal (2026-11-12, o usuário: "vamos simplificar e focar somente no mcp como
 * principal e acesso a tudo que temos ali"; a Iara saiu das telas). O que antes só a Iara fazia, aqui
 * como a pessoa da chave (RLS, papéis e módulos da tela):
 *   - Cérebro da conta (`crm_knowledge_notes`): ler, buscar, escrever, registrar no log.
 *   - Quadros (`crm_boards`): listar, ler o que está escrito, criar e pôr um bloco. O servidor não monta
 *     elementos do Excalidraw: o bloco vai para `pending` e o editor desenha ao abrir (migração 20261112130000).
 *   - Referências (`crm_references`): listar, salvar e marcar.
 *   - Inteligência de Instagram (`features/instagram-ia`, empacotada em `_gerado/inteligencia.js`):
 *     fórmulas e nota de gancho, tempos do roteiro, revisor de legenda, humanizador, virais, o que
 *     funcionou, nota do perfil e leitura dos comentários sincronizados. Responder comentário fica na tela.
 *   - As skills de Instagram viram prompts (`skillPrompts`).
 */

type Args = Record<string, unknown>

const str = (v: unknown, max = 8000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const list = (v: unknown, max = 20, each = 600) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map((x) => str(x, each)).filter(Boolean).slice(0, max)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const slugOf = (s: string, n = 60) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, n)

// ---------- quadros: o mesmo rascunho da Iara ----------

const DRAFT_PROPS = {
  titulo: { type: 'string' },
  subtitulo: { type: 'string' },
  cartoes: { type: 'array', items: { type: 'object' }, description: '[{"id"?,"titulo","texto"?,"icone"?,"cor"?,"tag"?}]' },
  notas: { type: 'array', items: {}, description: '[string | {"texto","cor"?,"icone"?}]' },
  colunas: { type: 'array', items: { type: 'object' }, description: '[{"nome","cor"?,"cartoes"?:[...],"notas"?:[...]}]' },
  centro: { type: 'string', description: 'Mapa: o tema no meio e cada item ligado a ele.' },
  fluxo: { type: 'boolean', description: 'Cartões em sequência, com setas.' },
  ligacoes: { type: 'array', items: { type: 'object' }, description: '[{"de","para","texto"?}] (id que você deu, posição 1, 2… ou começo do título).' },
}
const DRAFT_HELP = 'Prefira "cartoes" (cartão branco com ícone, título, texto curto e etiqueta) para planos, posts, etapas e ideias com detalhe; "notas" para frases curtas. "icone": nome do Lucide em inglês (camera, megaphone, target, users, calendar, rocket, lightbulb, check…) ou palavra em português. "tag": etiqueta curta (Reels, Carrossel, Urgente, R$ 300). "colunas" = frames lado a lado; "centro" = mapa; "fluxo": true = sequência com setas. Cores: amarelo, laranja, rosa, roxo, azul, verde, cinza. Texto do cartão até ~200 caracteres.'

// ---------- Instagram: a conta conectada e os posts, no formato das telas ----------

const num = (n: unknown) => (typeof n === 'number' ? n : typeof n === 'string' && n.trim() !== '' && !Number.isNaN(Number(n)) ? Number(n) : undefined)

interface IgRow { id: string; username: string; name: string | null; biography: string | null; website: string | null; profile_picture_url: string | null; followers_count: number | null; follows_count: number | null; media_count: number | null; totals: unknown; account_type: string | null; sync_error: string | null }

const mediaOf = (m: Record<string, unknown>) => ({
  id: String(m.media_id),
  type: String(m.media_type ?? ''),
  product: (m.product_type as string | null) ?? undefined,
  caption: (m.caption as string | null) ?? undefined,
  permalink: (m.permalink as string | null) ?? undefined,
  thumbnail: (m.thumbnail_url as string | null) ?? undefined,
  mediaUrl: (m.media_url as string | null) ?? undefined,
  postedAt: Date.parse(String(m.posted_at)),
  likes: num(m.like_count),
  comments: num(m.comments_count),
  insights: (m.insights ?? {}) as Record<string, number>,
})

// ---------- skills como prompts ----------

/** As ações da Iara citadas nas skills, trocadas pelas ferramentas deste servidor. */
const RENAME: Array<[RegExp, string]> = [
  [/`ig_responder`/g, 'a tela CRM › Instagram (pelo MCP a resposta não é publicada: entregue o texto pronto para a pessoa responder lá)'],
  [/`ig_([a-z_]+)`/g, '`sinfy_ig_$1`'],
  [/`cerebro_(ler|escrever|buscar|log)`/g, '`sinfy_cerebro_$1`'],
  [/`ler_dados`/g, '`sinfy_instagram`'],
  [/`(produzir_criativo|orquestrar_criativo)`/g, '`sinfy_criativo_criar`'],
  [/`ver_criativo`/g, '`sinfy_criativo_ver`'],
  [/`criar_ideias`/g, '`sinfy_conteudo_criar`'],
  [/`listar_conteudos`/g, '`sinfy_conteudos`'],
  [/`criar_video_explicativo`/g, 'o estúdio de vídeo dos Criativos (fora do MCP: diga à pessoa)'],
  [/`abrir_tela`/g, 'o link da tela'],
]
const adapt = (text: string) => RENAME.reduce((t, [re, to]) => t.replace(re, to), text)

export interface SkillPrompt {
  name: string
  title: string
  description: string
  arguments: { name: string; description: string; required: boolean }[]
  text: (args: Record<string, string>) => string
}

export function skillPrompts(): SkillPrompt[] {
  return (IA.INSTAGRAM_SKILLS as Array<{ id: string; name: string; hint: string; starters: string[]; instructions: string }>).map((s) => ({
    name: s.id,
    title: s.name,
    description: s.hint,
    arguments: [{ name: 'pedido', description: `O que você quer (ex.: ${s.starters[0]}).`, required: false }],
    text: (args) =>
      `Skill "${s.name}" da Sinfy. Siga as instruções abaixo usando as ferramentas sinfy_* desta conta.\n\n${adapt(s.instructions)}\n\n---\nPedido: ${args.pedido?.trim() || '(pergunte à pessoa o que ela quer, com um exemplo: ' + s.starters.join(' · ') + ')'}`,
  }))
}

// ---------- ferramentas ----------

export function areaTools(deps: PlatformDeps): PlatformTool[] {
  const { appUrl, fail } = deps
  const moduleOn = (c: PlatformCaller, key: string) => c.team.status !== 'pausada' && (c.team.modules ?? {})[key] !== false
  const needInstagram = (c: PlatformCaller) => {
    if (!moduleOn(c, 'instagram')) fail('O módulo Instagram está desligado nesta conta.')
  }

  const notePath = (v: unknown) => {
    const p = str(v, 300).replace(/^\/+/, '').replace(/^cerebro\//, '').replace(/\/{2,}/g, '/')
    return p
  }
  const checkWritable = (p: string) => {
    if (!p.endsWith('.md') || p.split('/').some((s) => !s || s === '..' || s.startsWith('.'))) fail('Caminho de nota inválido: use pastas e um nome .md (ex.: "produtos/linha-x.md").')
    if (!/^[A-Za-z0-9À-ÿ _().,&+-]+(\/[A-Za-z0-9À-ÿ _().,&+-]+)*\.md$/.test(p)) fail('O nome da nota só aceita letras, números, espaço e _().,&+-.')
    if (p === 'plataforma' || p.startsWith('plataforma/')) fail('A pasta "plataforma/" é montada pela Sinfy: mude na tela de origem.')
    if (p === 'marca/DESIGN.md') fail('A marca (marca/DESIGN.md) se muda na tela da marca da conta, não pelo Cérebro.')
  }
  const saveNote = (c: PlatformCaller, path: string, content: string, create: boolean) =>
    asUser(c, async (tx) => {
      if (create) {
        const [hit] = await tx`select 1 from crm_knowledge_notes where team_id = ${c.team.id} and path = ${path}`
        if (hit) fail('Já existe uma nota com esse nome: leia com sinfy_cerebro_ler e grave sem "nova".')
      }
      await tx`insert into crm_knowledge_notes (team_id, path, content) values (${c.team.id}, ${path}, ${content})
        on conflict (team_id, path) do update set content = excluded.content`
    })

  const igAccount = async (c: PlatformCaller) => {
    needInstagram(c)
    const [acc] = await asUser(c, (tx) => tx`select id, username, name, biography, website, profile_picture_url, followers_count, follows_count, media_count, totals, account_type, sync_error from crm_instagram_accounts where team_id = ${c.team.id} order by connected_at limit 1`)
    if (!acc) fail('A conta não tem Instagram conectado. Conecte em CRM › Instagram (ou mande o link de conexão ao cliente).')
    const a = acc as unknown as IgRow
    if (a.sync_error === 'token') fail(`A conexão do @${a.username} caiu: reconecte em CRM › Instagram.`)
    return a
  }
  const igMedia = async (c: PlatformCaller, accountId: string, limit: number) =>
    (await asUser(c, (tx) => tx`select media_id, media_type, product_type, caption, permalink, thumbnail_url, media_url, posted_at, like_count, comments_count, insights from crm_instagram_media where account_id = ${accountId}::uuid order by posted_at desc limit ${limit}`)).map((m) => mediaOf(m as Record<string, unknown>))

  const boardOf = async (c: PlatformCaller, id: unknown) => {
    const bid = str(id, 60)
    if (!/^[0-9a-f-]{36}$/i.test(bid)) fail('Diga o quadro pelo id (veja em sinfy_quadros).')
    const [row] = await asUser(c, (tx) => tx`select id, title, scene, jsonb_array_length(pending) as pendentes, updated_at from crm_boards where id = ${bid}::uuid and team_id = ${c.team.id}`)
    if (!row) fail('Quadro não encontrado nesta conta.')
    return row as { id: string; title: string; scene: { elements?: unknown[] }; pendentes: number; updated_at: string }
  }
  const draftOf = (a: Args) => {
    const draft = IA.readDraft(a)
    return { draft, empty: IA.draftIsEmpty(draft) as boolean }
  }
  const boardUrl = (id: string) => `${appUrl}/quadros/${id}`
  const PENDING_NOTE = 'O bloco entra no quadro quando alguém da equipe abrir (ou voltar à aba do quadro): o editor mede cada texto e desenha embaixo do que já existe. Passe o link à pessoa.'

  return [
    // ---------- Cérebro ----------
    {
      name: 'sinfy_cerebro_ler',
      title: 'Ler o Cérebro',
      description: 'O Cérebro (base de conhecimento) da conta: sem "nota", a lista das notas (caminho, data) e a visão geral (README.md); com "nota" (ex.: "produtos/README.md", "instagram/voz.md"), o texto inteiro. Quem é a empresa, produtos, padrões de post (marca/padroes/), voz do Instagram, decisões e logs. A marca (cores e fontes) vem em sinfy_conta.',
      inputSchema: { type: 'object', properties: { nota: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const path = notePath(a.nota)
        if (path) {
          const rows = await asUser(c, (tx) => tx`select path, content, updated_at from crm_knowledge_notes where team_id = ${c.team.id} and path in (${path}, ${path.replace(/\/$/, '') + '/README.md'}) order by length(path) limit 1`)
          if (!rows.length) return `Nota não encontrada: ${path}. Veja a lista com sinfy_cerebro_ler sem "nota".`
          return { nota: rows[0].path, atualizada: rows[0].updated_at, texto: String(rows[0].content).slice(0, 40000), link: `${appUrl}/cerebro?nota=${encodeURIComponent(rows[0].path)}` }
        }
        const rows = await asUser(c, (tx) => tx`select path, updated_at, length(content) as tamanho, case when path = 'README.md' then left(content, 6000) end as texto from crm_knowledge_notes where team_id = ${c.team.id} order by path limit 500`)
        const readme = rows.find((r) => r.path === 'README.md')
        return {
          notas: rows.map((r) => ({ nota: r.path, atualizada: String(r.updated_at).slice(0, 10), caracteres: r.tamanho })),
          visao_geral: readme ? readme.texto : '(sem README.md: crie a visão geral da empresa com sinfy_cerebro_escrever)',
        }
      },
    },
    {
      name: 'sinfy_cerebro_buscar',
      title: 'Buscar no Cérebro',
      description: 'Busca uma palavra ou frase nas notas do Cérebro da conta; devolve as notas que falam disso, com um trecho.',
      inputSchema: { type: 'object', required: ['texto'], properties: { texto: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const q = str(a.texto, 120)
        if (q.length < 2) fail('Mande pelo menos 2 letras em "texto".')
        const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`
        const rows = await asUser(c, (tx) => tx`select path, content from crm_knowledge_notes where team_id = ${c.team.id} and (content ilike ${like} or path ilike ${like}) order by updated_at desc limit 15`)
        const low = q.toLowerCase()
        return rows.map((r) => {
          const text = String(r.content)
          const at = Math.max(0, text.toLowerCase().indexOf(low) - 120)
          return { nota: r.path, trecho: text.slice(at, at + 320).replace(/\s+/g, ' ').trim() }
        })
      },
    },
    {
      name: 'sinfy_cerebro_escrever',
      title: 'Escrever no Cérebro',
      description: 'Grava uma nota .md no Cérebro da conta (o texto inteiro em Markdown substitui o anterior: leia antes com sinfy_cerebro_ler e mantenha o que não muda). "nova": true para criar sem sobrescrever. Pastas livres (ex.: "produtos/linha-x.md", "instagram/voz.md"); "plataforma/" e a marca não se mudam por aqui.',
      inputSchema: { type: 'object', required: ['nota', 'texto'], properties: { nota: { type: 'string' }, texto: { type: 'string' }, nova: { type: 'boolean' } }, additionalProperties: false },
      run: async (c, a) => {
        const path = notePath(a.nota)
        checkWritable(path)
        const text = typeof a.texto === 'string' ? a.texto : ''
        if (!text.trim()) fail('Faltou o "texto" da nota.')
        if (text.length > 400000) fail('Nota grande demais (até 400 mil caracteres).')
        await saveNote(c, path, text.endsWith('\n') ? text : text + '\n', a.nova === true)
        return { ok: true, nota: path, link: `${appUrl}/cerebro?nota=${encodeURIComponent(path)}` }
      },
    },
    {
      name: 'sinfy_cerebro_log',
      title: 'Registrar no log do Cérebro',
      description: 'Registra no log do Cérebro da conta o que aconteceu hoje (entrega, decisão, aprovação, resultado). "texto" em Markdown com O que aconteceu, O que entregamos, O que aprendemos e Próximo passo.',
      inputSchema: { type: 'object', required: ['titulo', 'texto'], properties: { titulo: { type: 'string' }, texto: { type: 'string' } }, additionalProperties: false },
      run: async (c, a) => {
        const title = str(a.titulo, 120)
        if (!title) fail('Faltou o "titulo".')
        const day = today()
        let path = `log/${day}-${slugOf(title) || 'log'}.md`
        const [hit] = await asUser(c, (tx) => tx`select 1 from crm_knowledge_notes where team_id = ${c.team.id} and path = ${path}`)
        if (hit) path = path.replace(/\.md$/, `-${Date.now().toString(36).slice(-4)}.md`)
        await saveNote(c, path, `# ${title}\n\n**Data:** ${day} · **Quem:** IA conectada (MCP)\n\n${str(a.texto, 60000)}\n`, true)
        return { ok: true, nota: path, link: `${appUrl}/cerebro?nota=${encodeURIComponent(path)}` }
      },
    },

    // ---------- Quadros ----------
    {
      name: 'sinfy_quadros',
      title: 'Quadros',
      description: 'Os quadros da conta (canvas livre, estilo Miro/FigJam): id, título, última mudança e link.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c) => {
        const rows = await asUser(c, (tx) => tx`select id, title, updated_at, jsonb_array_length(pending) as pendentes from crm_boards where team_id = ${c.team.id} order by updated_at desc limit 100`)
        return rows.map((r) => ({ quadro: r.id, titulo: r.title, atualizado: String(r.updated_at).slice(0, 16), blocos_esperando: r.pendentes || undefined, link: boardUrl(r.id) }))
      },
    },
    {
      name: 'sinfy_quadro_ler',
      title: 'Ler um quadro',
      description: 'O que está escrito num quadro: cada nota, cartão e texto (com a cor e a coluna em que está) e as setas entre eles.',
      inputSchema: { type: 'object', required: ['quadro'], properties: { quadro: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const b = await boardOf(c, a.quadro)
        const out = IA.boardOutline(b.scene?.elements ?? []) as { count: number; lines: string[] }
        return { quadro: b.id, titulo: b.title, elementos: out.count, conteudo: out.lines.slice(0, 300), blocos_esperando: b.pendentes || undefined, link: boardUrl(b.id) }
      },
    },
    {
      name: 'sinfy_quadro_criar',
      title: 'Criar quadro',
      description: `Cria um quadro na conta, já com um bloco desenhado (opcional). ${DRAFT_HELP} ${PENDING_NOTE}`,
      inputSchema: { type: 'object', required: ['titulo'], properties: DRAFT_PROPS, additionalProperties: false },
      run: async (c, a) => {
        const title = str(a.titulo, 120) || 'Quadro sem título'
        const { draft, empty } = draftOf({ ...a, titulo: undefined })
        const pending = empty ? [] : [draft]
        const [row] = await asUser(c, (tx) => tx`insert into crm_boards (team_id, title, pending) values (${c.team.id}, ${title}, ${JSON.stringify(pending)}::jsonb) returning id`)
        return { ok: true, quadro: row.id, link: boardUrl(row.id), aviso: pending.length ? PENDING_NOTE : undefined }
      },
    },
    {
      name: 'sinfy_quadro_adicionar',
      title: 'Pôr um bloco no quadro',
      description: `Põe num quadro que já existe um bloco novo, embaixo do que já está lá, sem mexer no resto. ${DRAFT_HELP} ${PENDING_NOTE}`,
      inputSchema: { type: 'object', required: ['quadro'], properties: { quadro: { type: 'string' }, ...DRAFT_PROPS }, additionalProperties: false },
      run: async (c, a) => {
        const b = await boardOf(c, a.quadro)
        const { draft, empty } = draftOf(a)
        if (empty) fail('Mande "cartoes", "notas", "colunas", "centro" ou "titulo".')
        if (b.pendentes >= 20) fail('Já há 20 blocos esperando: peça para alguém abrir o quadro antes de mandar mais.')
        await asUser(c, (tx) => tx`update crm_boards set pending = pending || ${JSON.stringify([draft])}::jsonb where id = ${b.id}::uuid and team_id = ${c.team.id}`)
        return { ok: true, quadro: b.id, link: boardUrl(b.id), aviso: PENDING_NOTE }
      },
    },

    // ---------- Referências ----------
    {
      name: 'sinfy_referencias',
      title: 'Referências',
      description: 'As referências visuais da conta (posts, reels, sites que a equipe guardou): link, plataforma, tipo, título, notas, etiquetas, estrela, autor, legenda e números. Filtre por "busca", "estrela", "tipo" (estatico, carrossel, video, motion, reels, story) ou "etiqueta".',
      inputSchema: {
        type: 'object',
        properties: { busca: { type: 'string' }, estrela: { type: 'boolean' }, tipo: { type: 'string' }, etiqueta: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const q = str(a.busca, 120)
        const like = q ? `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%` : null
        const tipo = str(a.tipo, 20) || null
        const tag = str(a.etiqueta, 40) || null
        const star = typeof a.estrela === 'boolean' ? a.estrela : null
        const limit = Math.min(100, Math.max(1, Number(a.limite) || 40))
        const rows = await asUser(c, (tx) => tx`
          select id, url, platform, kind, title, notes, tags, starred, author, left(caption, 600) as caption, likes, comments, views, created_at
          from crm_references
          where team_id = ${c.team.id}
            and (${like}::text is null or title ilike ${like} or notes ilike ${like} or caption ilike ${like} or author ilike ${like})
            and (${tipo}::text is null or kind = ${tipo})
            and (${tag}::text is null or ${tag} = any(tags))
            and (${star}::boolean is null or starred = ${star})
          order by starred desc, created_at desc limit ${limit}`)
        return { referencias: rows, link: `${appUrl}/referencias` }
      },
    },
    {
      name: 'sinfy_referencia_salvar',
      title: 'Salvar referência',
      description: 'Guarda um link como referência visual da conta, ou muda uma que existe ("id"): título, notas (o que copiar dela), etiquetas, tipo e estrela. Nunca raspe o Instagram: o link é o que a pessoa mandou.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string' },
          titulo: { type: 'string' },
          notas: { type: 'string' },
          etiquetas: { type: 'array', items: { type: 'string' } },
          tipo: { type: 'string', enum: ['estatico', 'carrossel', 'video', 'motion', 'reels', 'story'] },
          estrela: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      run: async (c, a) => {
        const title = typeof a.titulo === 'string' ? str(a.titulo, 160) : null
        const notes = typeof a.notas === 'string' ? str(a.notas, 2000) : null
        const tags = Array.isArray(a.etiquetas) ? list(a.etiquetas, 12, 40) : null
        const kind = typeof a.tipo === 'string' ? a.tipo : null
        const star = typeof a.estrela === 'boolean' ? a.estrela : null
        if (a.id) {
          const id = str(a.id, 60)
          const rows = await asUser(c, (tx) => tx`update crm_references set
              title = coalesce(${title}, title), notes = coalesce(${notes}, notes), tags = coalesce(${tags}::text[], tags),
              kind = coalesce(${kind}, kind), starred = coalesce(${star}, starred)
            where id = ${id}::uuid and team_id = ${c.team.id} returning id`)
          if (!rows.length) fail('Referência não encontrada nesta conta.')
          return { ok: true, referencia: id }
        }
        const url = str(a.url, 600)
        if (!/^https?:\/\//.test(url)) fail('Mande o "url" da referência (https://…).')
        const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } })()
        const platform = /instagram\.com$/.test(host) ? 'instagram' : /tiktok\.com$/.test(host) ? 'tiktok' : /(youtube\.com|youtu\.be)$/.test(host) ? 'youtube' : /pinterest\./.test(host) ? 'pinterest' : /behance\.net$/.test(host) ? 'behance' : host ? 'site' : 'outro'
        const [row] = await asUser(c, (tx) => tx`insert into crm_references (team_id, url, platform, kind, title, notes, tags, starred)
          values (${c.team.id}, ${url}, ${platform}, ${kind ?? (platform === 'instagram' && /\/reels?\//.test(url) ? 'reels' : 'estatico')}, ${title ?? ''}, ${notes ?? ''}, ${tags ?? []}::text[], ${star ?? false}) returning id`)
        return { ok: true, referencia: row.id, link: `${appUrl}/referencias` }
      },
    },

    // ---------- Inteligência de Instagram ----------
    {
      name: 'sinfy_ig_formulas',
      title: 'Instagram · fórmulas de gancho',
      description: 'As 26 fórmulas de gancho de Reels (nome, modelo, exemplo, texto da tela, para que serve, armadilha) e as regras do gancho. Leia antes de escrever ganchos, roteiro, pauta ou repurpose.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async () => ({ regras: IA.HOOK_RULES, formulas: IA.hooksForPrompt() }),
    },
    {
      name: 'sinfy_ig_ganchos',
      title: 'Instagram · nota dos ganchos',
      description: 'Dá nota de 0 a 100 a cada gancho (a frase falada) em 5 propriedades (tamanho, concreto, tensão, o forte na frente, fala com alguém), aponta problemas graves (saudação, "pare de rolar", "neste vídeo", emoji, hashtag), diz a fórmula e ordena. Passe 3 ganchos de fórmulas diferentes. Abaixo de 50 no primeiro: ainda não tem gancho.',
      inputSchema: { type: 'object', required: ['ganchos'], properties: { ganchos: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (_c, a) => {
        const hooks = list(a.ganchos, 12)
        if (!hooks.length) fail('Mande "ganchos": uma lista de frases.')
        const ranked = IA.rankHooks(hooks) as Array<{ nota: number; veredito: string }>
        return { ganchos: ranked, leitura: ranked[0].nota < 50 ? 'Nenhum desses é o gancho ainda: o melhor ficou abaixo de 50.' : `Grave o primeiro (${ranked[0].nota}, ${ranked[0].veredito}).` }
      },
    },
    {
      name: 'sinfy_ig_tempos',
      title: 'Instagram · tempos do roteiro',
      description: 'Transforma o roteiro (uma fala por linha) em minutagem (160 palavras por minuto, ou "ppm"): marca gancho, meio e chamada, e aponta gancho passando de 3 s, batida acima de 4 s, três batidas sem nada concreto, falta de loop e a diferença para o "alvo" em segundos. Corrija e rode de novo antes de entregar.',
      inputSchema: { type: 'object', required: ['roteiro'], properties: { roteiro: { type: 'string' }, alvo: { type: 'number' }, ppm: { type: 'number' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (_c, a) => {
        const roteiro = str(a.roteiro, 12000)
        if (!roteiro) fail('Mande o "roteiro".')
        return IA.beatSheet(roteiro, { alvo: Number(a.alvo) || undefined, ppm: Number(a.ppm) || undefined }) ?? 'Roteiro sem falas.'
      },
    },
    {
      name: 'sinfy_ig_legenda_revisar',
      title: 'Instagram · revisar legenda',
      description: 'Revisa uma legenda: o que o feed mostra antes do "mais" (~125 caracteres), primeira linha, gancho concreto, hashtags (máximo 5, nada de #viral), links mortos, UMA chamada, emoji e os termos de busca ("palavras"), mais a nota de "cara de IA". Corrija cada CORRIGIR e decida cada ATENCAO.',
      inputSchema: { type: 'object', required: ['texto'], properties: { texto: { type: 'string' }, palavras: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (_c, a) => {
        const texto = str(a.texto, 4000)
        if (!texto) fail('Mande o "texto" da legenda.')
        return { ...IA.lintCaption(texto, { palavras: list(a.palavras, 6) }), cara_de_ia: IA.detect(texto) }
      },
    },
    {
      name: 'sinfy_ig_humanizar',
      title: 'Instagram · humanizar texto',
      description: 'Tira a marca de máquina de qualquer texto (legenda, roteiro, comentário, direct, bio): caracteres invisíveis, travessão, aspas curvas e clichês de IA em português. Devolve o texto limpo, cada troca, as estruturas para reescrever à mão ("não é só X, é Y", trio, "O resultado?") e a nota antes e depois (passa com 70 e nenhuma abaixo de 55). Use antes de mostrar qualquer texto de Instagram; é heurística, não prometa "indetectável".',
      inputSchema: { type: 'object', required: ['texto'], properties: { texto: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (_c, a) => {
        const texto = str(a.texto, 12000)
        if (!texto) fail('Mande o "texto".')
        return IA.humanizeReport(texto)
      },
    },
    {
      name: 'sinfy_ig_virais',
      title: 'Instagram · arquivo de virais',
      description: 'Ordena reels de outros perfis pelo múltiplo sobre a MEDIANA do próprio perfil (não por views brutas; acima de 3x é sinal), dá a fórmula e a nota de cada gancho, mostra o que o terço de cima tem que o de baixo não tem e diz quanto confiar. Números aceitam "12 mil", "1,2 mi". "salvar": grava em instagram/virais.md no Cérebro, que as outras skills leem. Os reels vêm do que a pessoa colou ou das Referências; nunca raspe o Instagram.',
      inputSchema: {
        type: 'object',
        required: ['reels'],
        properties: {
          reels: { type: 'array', items: { type: 'object', description: '{"perfil":"@x","seguidores"?,"mediana"?,"views","gancho","tela"?,"segundos"?,"chamada"?,"link"?}' } },
          salvar: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      run: async (c, a) => {
        const rows = IA.normalizeSwipe((Array.isArray(a.reels) ? a.reels : []).slice(0, 200) as Array<Record<string, unknown>>) as unknown[]
        if (!rows.length) fail('Mande "reels" com pelo menos views e gancho.')
        const swipe = IA.rankSwipe(rows)
        if (a.salvar === true) await saveNote(c, 'instagram/virais.md', IA.swipeMarkdown(swipe), false)
        return a.salvar === true ? { ...swipe, salvo: 'instagram/virais.md' } : swipe
      },
    },
    {
      name: 'sinfy_ig_o_que_funcionou',
      title: 'Instagram · o que funcionou',
      description: 'Auditoria dos posts reais do Instagram conectado (padrão 90 dias): ordena pelo múltiplo sobre a mediana da conta (do mesmo formato quando dá), com envios, salvos e seguidores a cada mil de alcance e tempo assistido dos reels; os 5 de cima e os 5 de baixo; por formato; pela fórmula da primeira linha; achados com a confiança; o que parar e o que fazer mais.',
      inputSchema: { type: 'object', properties: { dias: { type: 'integer', enum: [30, 60, 90, 180] } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const acc = await igAccount(c)
        const dias = [30, 60, 90, 180].includes(Number(a.dias)) ? Number(a.dias) : 90
        const audit = IA.auditPosts(await igMedia(c, acc.id, 300), { dias })
        if (!audit) return `Sem posts com números nos últimos ${dias} dias em @${acc.username}. Abra CRM › Instagram para sincronizar.`
        return { perfil: `@${acc.username}`, seguidores: acc.followers_count, dias, ...audit }
      },
    },
    {
      name: 'sinfy_ig_perfil',
      title: 'Instagram · nota do perfil',
      description: 'O perfil do Instagram conectado com a nota do app (bio, foto, destaques, ritmo, formatos, legendas, desempenho, horários; 0 a 100 por parte) e a rubrica de 12 itens / 100 pontos. Dê nota honesta a cada item, reescreva na ordem do que perdeu mais pontos (3 opções de Nome com até 30 caracteres; bio até 150), humanize e diga a nota de novo. Nada é mudado no Instagram.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c) => {
        const acc = await igAccount(c)
        const [media, saved] = await Promise.all([
          igMedia(c, acc.id, 120),
          asUser(c, (tx) => tx`select highlights from crm_instagram_analyses where account_id = ${acc.id}::uuid order by created_at desc limit 1`),
        ])
        const highlights = (saved[0]?.highlights as string[] | null | undefined) ?? null
        const profile = { username: acc.username, name: acc.name ?? undefined, biography: acc.biography ?? undefined, website: acc.website ?? undefined, picture: acc.profile_picture_url ?? undefined, followers: num(acc.followers_count), follows: num(acc.follows_count), mediaCount: num(acc.media_count), totals: (acc.totals ?? {}) as Record<string, unknown> }
        const report = IA.auditProfile({ profile, media, highlights }) as { score: number; pillars: Array<{ label: string; score: number; findings: Array<{ level: string; title: string; action?: string }> }> }
        return {
          perfil: { usuario: `@${acc.username}`, nome: acc.name ?? '', bio: acc.biography ?? '', link: acc.website ?? '', seguidores: acc.followers_count, posts: acc.media_count, tipo: acc.account_type },
          destaques: highlights ?? 'não informados (a Meta não entrega os destaques: pergunte à pessoa ou peça para marcar em CRM › Instagram › Análise)',
          nota_do_app: report.score,
          partes: report.pillars.map((p) => ({ parte: p.label, nota: p.score, achados: p.findings.map((f) => `${f.level}: ${f.title}${f.action ? ` → ${f.action}` : ''}`) })),
          rubrica: { nota: IA.RUBRIC_NOTE, itens: IA.PROFILE_RUBRIC },
          ultimos_posts: media.slice(0, 9).map((m) => ({ legenda_1a_linha: (m.caption ?? '').split('\n')[0].slice(0, 120), tipo: m.product ?? m.type, link: m.permalink })),
          falta_ver: 'Fixados, capas do grid, categoria e botões de contato não vêm pela API: peça um print do topo do perfil se precisar dar nota a eles.',
        }
      },
    },
    {
      name: 'sinfy_ig_comentarios',
      title: 'Instagram · comentários',
      description: 'Os comentários dos posts do Instagram conectado, como a Sinfy sincronizou: de um "post" (id ou link) ou dos últimos "posts" com comentário (padrão 5, máximo 10), com quem comentou, texto, curtidas, se é nosso, se já foi respondido ou resolvido. Separe em PALAVRA-CHAVE, LEAD, SUBSTÂNCIA, PERGUNTA, APOIO e RUÍDO e escreva as respostas. Só lê: a resposta sai pela tela CRM › Instagram.',
      inputSchema: { type: 'object', properties: { post: { type: 'string' }, posts: { type: 'integer', minimum: 1, maximum: 10 } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const acc = await igAccount(c)
        const media = await igMedia(c, acc.id, 60)
        const want = str(a.post, 300)
        const code = want.replace(/\/$/, '').split('/').pop() ?? ''
        const picked = want
          ? media.filter((m) => m.id === want || (!!code && !!m.permalink && m.permalink.replace(/\/$/, '').endsWith('/' + code)))
          : media.filter((m) => m.product !== 'STORY' && (m.comments ?? 0) > 0).slice(0, Math.min(10, Math.max(1, Number(a.posts) || 5)))
        if (!picked.length) return want ? `Não achei esse post em @${acc.username} (só os 60 mais recentes).` : `Nenhum post recente de @${acc.username} tem comentário.`
        const ids = picked.map((m) => m.id)
        const rows = await asUser(c, (tx) => tx`select comment_id, media_id, parent_id, username, body, ts, like_count, hidden, own, replied, handled from crm_instagram_comments where account_id = ${acc.id}::uuid and media_id = any(${ids}::text[]) order by ts limit 600`)
        return {
          perfil: `@${acc.username}`,
          posts: picked.map((m) => ({
            post: m.id,
            link: m.permalink,
            data: new Date(m.postedAt).toISOString().slice(0, 10),
            legenda: (m.caption ?? '').slice(0, 300),
            comentarios: rows.filter((r) => r.media_id === m.id).slice(0, 80).map((r) => ({ id: r.comment_id, resposta_a: r.parent_id ?? undefined, de: r.username ? `@${r.username}` : '?', texto: r.body, curtidas: r.like_count ?? 0, nosso: r.own || undefined, oculto: r.hidden || undefined, respondido: r.replied || undefined, resolvido: r.handled || undefined, quando: r.ts })),
          })),
          responder: `${appUrl}/crm/instagram`,
        }
      },
    },
  ]
}
