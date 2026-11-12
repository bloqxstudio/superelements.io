import * as IA from './_gerado/inteligencia.js'
import { asUser, fetchFile, type PlatformCaller, type PlatformDeps, type PlatformTool } from './plataforma.ts'

/** O tipo da imagem pelos primeiros bytes. */
export const sniffMime = (b: Uint8Array) =>
  b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif' : b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 ? 'image/webp' : undefined

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

const STAGES = ['novo', 'mapeado', 'selecionado', 'pagina', 'contatado', 'conversa', 'proposta', 'fechado', 'perdido']

const DRAFT_PROPS = {
  titulo: { type: 'string' },
  subtitulo: { type: 'string' },
  cartoes: { type: 'array', items: { type: 'object' } },
  notas: { type: 'array', items: {} },
  colunas: { type: 'array', items: { type: 'object' } },
  centro: { type: 'string' },
  fluxo: { type: 'boolean' },
  ligacoes: { type: 'array', items: { type: 'object' } },
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



// ---------- arquivos do Cérebro (Storage `space-projects`, `crm/<conta>/cerebro/…`, igual à tela) ----------

export const BRAIN_BUCKET = 'space-projects'
export const brainRoot = (teamId: string) => `crm/${teamId}/cerebro`
export const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
export const safeBase = (name: string) => name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imagem'
export const cleanFolder = (v: unknown, fallback: string) => {
  const f = (typeof v === 'string' ? v : '').trim().replace(/^\/+|\/+$/g, '').replace(/^cerebro\//, '').replace(/\/{2,}/g, '/')
  if (!f) return fallback
  if (f.split('/').some((x) => !x || x === '..' || x.startsWith('.')) || /^plataforma(\/|$)/.test(f) || !/^[A-Za-z0-9À-ÿ _().,&+-]+(\/[A-Za-z0-9À-ÿ _().,&+-]+)*$/.test(f)) return null
  return f.slice(0, 200)
}

/** Grava uma imagem no Cérebro da conta; devolve o caminho dentro do Cérebro. */
export async function saveBrainImage(admin: PlatformDeps['admin'], teamId: string, folder: string, name: string, bytes: Uint8Array, mime: string): Promise<string> {
  const ext = IMAGE_EXT[mime]
  if (!ext) throw new Error('Só imagens JPEG, PNG, WebP ou GIF.')
  const path = `${folder}/${safeBase(name)}-${Date.now().toString(36).slice(-5)}.${ext}`
  const { error } = await admin.storage.from(BRAIN_BUCKET).upload(`${brainRoot(teamId)}/${path}`, bytes, { contentType: mime, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** Os arquivos do Cérebro (o Storage não lista em profundidade: percorre as pastas). */
async function listBrainFiles(admin: PlatformDeps['admin'], teamId: string, folder: string) {
  const out: { path: string; size: number; at: string }[] = []
  const walk = async (rel: string, depth: number) => {
    if (depth > 5 || out.length > 600) return
    const { data } = await admin.storage.from(BRAIN_BUCKET).list(rel ? `${brainRoot(teamId)}/${rel}` : brainRoot(teamId), { limit: 1000 })
    await Promise.all((data ?? []).map(async (it: { name: string; id: string | null; updated_at?: string | null; metadata?: { size?: number } | null }) => {
      const path = rel ? `${rel}/${it.name}` : it.name
      if (it.id === null) return walk(path, depth + 1)
      if (it.name === '.emptyFolderPlaceholder') return
      out.push({ path, size: it.metadata?.size ?? 0, at: it.updated_at ?? '' })
    }))
  }
  await walk(folder, 0)
  return out.sort((a, b) => (a.at < b.at ? 1 : -1))
}

// ---------- ajuda: como a plataforma funciona ----------

export const GUIDE: Record<string, string> = {
  geral: [
    'A Sinfy é a plataforma da empresa: Plano (quem somos, oferta, público, tom), Pauta (conteúdos com data), Criativos (posts na marca), Instagram (perfil, posts, comentários, stories), Anúncios da Meta, Site (visitas), CRM (clientes e oportunidades), WhatsApp, Formulários e funis, Quadros, Cérebro e Referências.',
    'Você age como a pessoa da chave: só vê e muda o que ela pode na tela. Comece por sinfy_conta. Antes de agir, diga em uma linha o que vai fazer; depois, mostre o resultado (imagens, link).',
    'Regras: nunca invente números, preços, depoimentos ou resultados. Publicar, mandar mensagem a cliente e apagar pedem o "pode" explícito da pessoa na conversa. Aprovar um conteúdo é sempre de uma pessoa, na tela (ou do cliente, pelo link de aprovação).',
    'Tópicos: post, modelos, editar_criativo, pauta, crm, quadros, bloco_quadro, formulario, cerebro, instagram, dados.',
  ].join('\n'),
  post: [
    'Fazer um post do começo ao fim:',
    '1. sinfy_conta (marca, Plano). Se houver um conteúdo na Pauta, sinfy_conteudos e use o id dele.',
    '2. sinfy_criativo_criar com o roteiro (conteudo_id quando houver). A resposta traz as imagens: mostre.',
    '3. Ajustes: SEMPRE sinfy_criativo_editar no mesmo conjunto (trocar texto, legenda, refazer slide, apagar ou mover). Nunca crie outro conjunto para corrigir.',
    '4. Fotos: a foto anexada no chat NÃO chega aqui. Gere um link com sinfy_link_envio, a pessoa manda por ele (vai para o Cérebro), confira com sinfy_cerebro_arquivos e use sinfy_criativo_foto com "arquivo". Também vale "url" pública. Ou peça "prompt" no slide e gere a foto no editor pelo link.',
    '5. Legenda: escreva, passe por sinfy_ig_legenda_revisar e sinfy_ig_humanizar.',
    '6. Publicar ou agendar: sinfy_publicar. Primeiro sem "confirmar" (mostra o que vai sair); depois de a pessoa dizer que pode, com "confirmar": true. Agendar = "quando" (data e hora de Brasília).',
    'Conteúdo de cliente que precisa de aprovação: mande para "revisao" (sinfy_conteudo_atualizar) e a equipe envia ao cliente pela Pauta.',
  ].join('\n'),
  pauta: [
    'A Pauta é a lista de conteúdos (cartões) com status ideia → producao → revisao → aprovado, data editorial, horário, canal e etiquetas.',
    'Ler: sinfy_conteudos. Criar: sinfy_conteudo_criar. Mudar título, roteiro, data, horário, canal, etiquetas ou status: sinfy_conteudo_atualizar (aprovado só na tela).',
    'Comentários dos cartões: tabela crm_content_comments (sinfy_dados_ler / sinfy_dados_gravar).',
  ].join('\n'),
  crm: [
    'CRM: clientes (crm_clients), contatos, oportunidades (cartões do funil) e a linha do tempo (crm_activities).',
    'Oportunidades: sinfy_oportunidades para ler e sinfy_oportunidade_salvar para criar ou mudar etapa, valor, próximo passo e responsável. Fechado ou perdido: confirme com a pessoa antes.',
    'Outros dados: sinfy_dados_tabelas, sinfy_dados_ler, sinfy_dados_gravar (até 25 linhas por vez).',
  ].join('\n'),
  quadros: [
    'Quadros são canvas livres (estilo Miro). sinfy_quadros, sinfy_quadro_ler (cada item com o id #…), sinfy_quadro_criar e sinfy_quadro_adicionar (bloco novo), sinfy_quadro_editar (texto, cor, posição ou apagar itens pelo id), sinfy_quadro_ligar (setas) e sinfy_quadro_organizar.',
    'O servidor não desenha: o pedido entra na fila e o quadro aplica quando alguém abre ou volta à aba dele. Passe o link à pessoa.',
  ].join('\n'),
  cerebro: 'O Cérebro guarda o que a empresa sabe (produtos, voz, padrões de post, decisões, logs) e as imagens (sinfy_cerebro_arquivos, sinfy_cerebro_imagem_salvar, sinfy_link_envio para a pessoa mandar fotos; as fotos usadas nos criativos também ficam em fotos/criativos/). sinfy_cerebro_ler / _buscar antes de escrever; sinfy_cerebro_escrever para guardar o que a pessoa ensinar; sinfy_cerebro_log ao fim de uma entrega.',
  instagram: 'Números: sinfy_instagram. O que funcionou: sinfy_ig_o_que_funcionou. Perfil: sinfy_ig_perfil. Ganchos, roteiro e legenda: sinfy_ig_formulas, sinfy_ig_ganchos, sinfy_ig_tempos, sinfy_ig_legenda_revisar, sinfy_ig_humanizar. Comentários: sinfy_ig_comentarios (responder é na tela). As skills de Instagram estão nos prompts da Sinfy.',
  bloco_quadro: `Bloco de quadro (sinfy_quadro_criar e sinfy_quadro_adicionar): "titulo", "subtitulo", "cartoes": [{"id"?,"titulo","texto"?,"icone"?,"cor"?,"tag"?}], "notas": [texto ou {"texto","cor"?,"icone"?}], "colunas": [{"nome","cor"?,"cartoes"?,"notas"?}], "centro" (mapa), "fluxo": true, "ligacoes": [{"de","para","texto"?}]. ${DRAFT_HELP}`,
  dados: 'Qualquer tabela da lista: sinfy_dados_tabelas mostra as colunas; sinfy_dados_ler filtra e conta; sinfy_dados_gravar insere, atualiza ou apaga (apagar só com "confirmar"). Use as ferramentas próprias quando existirem (conteúdos, criativos, oportunidades, quadros).',
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
    {
      name: 'sinfy_ajuda',
      title: 'Como usar a Sinfy',
      description: 'Como fazer cada coisa na Sinfy e qual ferramenta usar. Tópicos: geral, post, modelos, editar_criativo, pauta, crm, quadros, bloco_quadro, formulario, cerebro, instagram, dados.',
      inputSchema: { type: 'object', properties: { topico: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (_c, a) => GUIDE[str(a.topico, 20)] ?? GUIDE.geral,
    },
    // ---------- Cérebro ----------
    {
      name: 'sinfy_cerebro_ler',
      title: 'Ler o Cérebro',
      description: 'O Cérebro da conta: sem "nota", a lista (use "pasta" para filtrar); com "nota", o texto inteiro.',
      inputSchema: { type: 'object', properties: { nota: { type: 'string' }, pasta: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        const path = notePath(a.nota)
        if (path) {
          const rows = await asUser(c, (tx) => tx`select path, content, updated_at from crm_knowledge_notes where team_id = ${c.team.id} and path in (${path}, ${path.replace(/\/$/, '') + '/README.md'}) order by length(path) limit 1`)
          if (!rows.length) return `Nota não encontrada: ${path}. Veja a lista com sinfy_cerebro_ler sem "nota".`
          return { nota: rows[0].path, atualizada: rows[0].updated_at, texto: String(rows[0].content).slice(0, 40000), link: `${appUrl}/cerebro?nota=${encodeURIComponent(rows[0].path)}` }
        }
        const pasta = str(a.pasta, 200).replace(/^\/+|\/+$/g, '')
        const prefix = pasta ? `${pasta.replace(/[\\%_]/g, (m) => '\\' + m)}/%` : '%'
        const rows = await asUser(c, (tx) => tx`select path, updated_at, length(content) as tamanho, case when path = 'README.md' then left(content, 3000) end as texto from crm_knowledge_notes where team_id = ${c.team.id} and path like ${prefix} order by path limit 150`)
        const readme = rows.find((r) => r.path === 'README.md')
        return {
          notas: rows.map((r) => ({ nota: r.path, atualizada: String(r.updated_at).slice(0, 10) })),
          mais: rows.length === 150 ? 'há mais notas: filtre por "pasta"' : undefined,
          visao_geral: readme ? readme.texto : '(sem README.md: crie a visão geral da empresa com sinfy_cerebro_escrever)',
        }
      },
    },
    {
      name: 'sinfy_cerebro_buscar',
      title: 'Buscar no Cérebro',
      description: 'Busca nas notas do Cérebro; devolve nota e trecho.',
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
      description: 'Grava uma nota .md do Cérebro (substitui o texto: leia antes). "nova": true para criar.',
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
      description: 'Registra no log do Cérebro o que aconteceu hoje (entrega, decisão, resultado).',
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

    {
      name: 'sinfy_link_envio',
      title: 'Link para mandar fotos',
      description: 'Gera um link (vale 2 horas, até 20 fotos) para a pessoa mandar fotos do celular ou do computador direto para o Cérebro da conta. Use sempre que ela quiser usar uma foto que anexou no chat: a imagem do chat não chega a este servidor. Depois, sinfy_cerebro_arquivos mostra o que chegou e sinfy_criativo_foto usa pelo "arquivo".',
      inputSchema: { type: 'object', properties: { pasta: { type: 'string', description: 'Pasta do Cérebro (padrão fotos/enviadas).' } }, additionalProperties: false },
      run: async (c, a) => {
        const folder = cleanFolder(a.pasta, 'fotos/enviadas')
        if (!folder) fail('Pasta inválida (e "plataforma/" é só leitura).')
        const bytes = crypto.getRandomValues(new Uint8Array(24))
        const token = 'env_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map((b) => b.toString(16).padStart(2, '0')).join('')
        const { error } = await deps.admin.from('crm_mcp_uploads').insert({ token_hash: hash, team_id: c.team.id, user_id: c.userId, key_id: c.keyId, folder })
        if (error) fail('Não consegui gerar o link agora.')
        return { link: `${appUrl}/enviar/${token}`, pasta: folder, vale: '2 horas, até 20 fotos', proximo_passo: 'Passe o link à pessoa. Quando ela disser que mandou, veja com sinfy_cerebro_arquivos (pasta acima).' }
      },
    },
    {
      name: 'sinfy_cerebro_arquivos',
      title: 'Arquivos do Cérebro',
      description: 'Lista as imagens e arquivos do Cérebro da conta (mais recentes primeiro), por pasta. Com "ver": caminho de uma imagem, mostra a imagem.',
      inputSchema: { type: 'object', properties: { pasta: { type: 'string' }, ver: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        if (typeof a.ver === 'string' && a.ver) {
          const path = notePath(a.ver)
          if (path.includes('..')) fail('Caminho inválido.')
          const { data } = await deps.admin.storage.from(BRAIN_BUCKET).download(`${brainRoot(c.team.id)}/${path}`)
          if (!data) return fail('Arquivo não encontrado no Cérebro.')
          const mime = data.type || 'image/jpeg'
          if (!mime.startsWith('image/')) return { arquivo: path, tipo: mime }
          const bytes = new Uint8Array(await data.arrayBuffer())
          if (bytes.length > 4 * 1024 * 1024) return { arquivo: path, aviso: 'Imagem grande demais para mostrar aqui; use pelo caminho.' }
          return { __imagens: [{ data: btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')), mimeType: mime }], arquivo: path }
        }
        const folder = a.pasta ? cleanFolder(a.pasta, '') : ''
        if (folder === null) fail('Pasta inválida.')
        const files = await listBrainFiles(deps.admin, c.team.id, folder ?? '')
        const limit = Math.min(100, Number(a.limite) || 30)
        return { arquivos: files.slice(0, limit).map((f) => ({ arquivo: f.path, kb: Math.round(f.size / 1024), em: f.at.slice(0, 16) })), mais: files.length > limit ? files.length - limit : undefined, link: `${appUrl}/cerebro` }
      },
    },
    {
      name: 'sinfy_cerebro_imagem_salvar',
      title: 'Guardar imagem no Cérebro',
      description: 'Guarda uma imagem (url https pública ou base64) no Cérebro da conta, na pasta pedida (padrão fotos). Para fotos que a pessoa anexou no chat, use sinfy_link_envio.',
      inputSchema: { type: 'object', properties: { url: { type: 'string' }, base64: { type: 'string' }, nome_arquivo: { type: 'string' }, pasta: { type: 'string' } }, additionalProperties: false },
      run: async (c, a) => {
        const folder = cleanFolder(a.pasta, 'fotos')
        if (!folder) fail('Pasta inválida.')
        const file = await fetchFile(deps, a, 15 * 1024 * 1024)
        const mime = sniffMime(file.bytes)
        if (!mime) fail('Não é uma imagem JPEG, PNG, WebP ou GIF.')
        const path = await saveBrainImage(deps.admin, c.team.id, folder!, file.name, file.bytes, mime!).catch((e) => fail(`Não guardei: ${e.message}`))
        return { ok: true, arquivo: path, link: `${appUrl}/cerebro` }
      },
    },
    // ---------- Quadros ----------
    {
      name: 'sinfy_quadros',
      title: 'Quadros',
      description: 'Os quadros da conta (canvas livre), com id e link.',
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
      description: 'O que está escrito num quadro: cada item com id (#…), cor, coluna e setas.',
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
      description: 'Cria um quadro, com um bloco opcional (cartões, notas, colunas, mapa ou fluxo; formato em sinfy_ajuda("bloco_quadro")). O bloco aparece quando alguém abrir o quadro.',
      inputSchema: { type: 'object', required: ['titulo'], properties: DRAFT_PROPS, additionalProperties: false },
      run: async (c, a) => {
        const title = str(a.titulo, 120) || 'Quadro sem título'
        const { draft, empty } = draftOf({ ...a, titulo: undefined })
        const pending = empty ? [] : [draft]
        const [row] = await asUser(c, (tx) => tx`insert into crm_boards (team_id, title, pending) values (${c.team.id}, ${title}, ${JSON.stringify(pending)}::text::jsonb) returning id`)
        return { ok: true, quadro: row.id, link: boardUrl(row.id), aviso: pending.length ? PENDING_NOTE : undefined }
      },
    },
    {
      name: 'sinfy_quadro_adicionar',
      title: 'Pôr um bloco no quadro',
      description: 'Põe um bloco novo num quadro, embaixo do que existe (formato em sinfy_ajuda("bloco_quadro")). Aparece quando alguém abrir o quadro.',
      inputSchema: { type: 'object', required: ['quadro'], properties: { quadro: { type: 'string' }, ...DRAFT_PROPS }, additionalProperties: false },
      run: async (c, a) => {
        const b = await boardOf(c, a.quadro)
        const { draft, empty } = draftOf(a)
        if (empty) fail('Mande "cartoes", "notas", "colunas", "centro" ou "titulo".')
        if (b.pendentes >= 20) fail('Já há 20 blocos esperando: peça para alguém abrir o quadro antes de mandar mais.')
        await asUser(c, (tx) => tx`update crm_boards set pending = pending || ${JSON.stringify([draft])}::text::jsonb where id = ${b.id}::uuid and team_id = ${c.team.id}`)
        return { ok: true, quadro: b.id, link: boardUrl(b.id), aviso: PENDING_NOTE }
      },
    },

    {
      name: 'sinfy_quadro_editar',
      title: 'Editar itens do quadro',
      description: 'Muda itens de um quadro pelo id (texto, título, cor, x/y, apagar), liga itens com setas ou organiza. Aplicado quando alguém abrir o quadro.',
      inputSchema: {
        type: 'object',
        required: ['quadro'],
        properties: {
          quadro: { type: 'string' },
          itens: { type: 'array', maxItems: 40, items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, texto: { type: 'string' }, titulo: { type: 'string' }, cor: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, apagar: { type: 'boolean' } } } },
          ligacoes: { type: 'array', maxItems: 40, items: { type: 'object', required: ['de', 'para'], properties: { de: { type: 'string' }, para: { type: 'string' }, texto: { type: 'string' }, cor: { type: 'string' } } } },
          organizar: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      run: async (c, a) => {
        const b = await boardOf(c, a.quadro)
        const id = (v: unknown) => str(v, 80).replace(/^#/, '')
        const ops: Record<string, unknown>[] = []
        const itens = (Array.isArray(a.itens) ? a.itens : []).slice(0, 40).map((x) => {
          const o = (x ?? {}) as Args
          return { id: id(o.id), texto: typeof o.texto === 'string' ? o.texto.slice(0, 600) : undefined, titulo: typeof o.titulo === 'string' ? o.titulo.slice(0, 160) : undefined, cor: typeof o.cor === 'string' ? o.cor.slice(0, 20) : undefined, x: typeof o.x === 'number' ? o.x : undefined, y: typeof o.y === 'number' ? o.y : undefined, apagar: o.apagar === true || undefined }
        }).filter((x) => x.id)
        if (itens.length) ops.push({ op: 'editar', itens })
        const ligacoes = (Array.isArray(a.ligacoes) ? a.ligacoes : []).slice(0, 40).map((x) => {
          const o = (x ?? {}) as Args
          return { de: id(o.de), para: id(o.para), texto: typeof o.texto === 'string' ? o.texto.slice(0, 60) : undefined, cor: typeof o.cor === 'string' ? o.cor.slice(0, 20) : undefined }
        }).filter((x) => x.de && x.para)
        if (ligacoes.length) ops.push({ op: 'ligar', ligacoes })
        if (a.organizar === true) ops.push({ op: 'organizar' })
        if (!ops.length) fail('Mande "itens", "ligacoes" ou "organizar": true.')
        if (b.pendentes + ops.length > 20) fail('Há muitos pedidos esperando: peça para alguém abrir o quadro antes de mandar mais.')
        await asUser(c, (tx) => tx`update crm_boards set pending = pending || ${JSON.stringify(ops)}::text::jsonb where id = ${b.id}::uuid and team_id = ${c.team.id}`)
        return { ok: true, quadro: b.id, link: boardUrl(b.id), aviso: PENDING_NOTE }
      },
    },

    // ---------- Oportunidades (CRM) ----------
    {
      name: 'sinfy_oportunidades',
      title: 'Oportunidades do CRM',
      description: 'Os cartões do funil de vendas (cliente, etapa, oferta, próximo passo). Filtre por etapa ou busca.',
      inputSchema: { type: 'object', properties: { etapa: { type: 'string' }, busca: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async (c, a) => {
        if (!moduleOn(c, 'crm')) fail('O módulo Oportunidades está desligado nesta conta.')
        const etapa = str(a.etapa, 40) || null
        const q = str(a.busca, 80)
        const like = q ? `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%` : null
        const rows = await asUser(c, (tx) => tx`
          select o.id, o.stage, o.offer, o.next_step, o.next_date, o.notes, o.updated_at, o.closed_at, cl.id as client_id, cl.name as cliente, cl.city, cl.website, p.name as funil, u.full_name as responsavel
          from crm_opportunities o
          join crm_clients cl on cl.id = o.client_id
          join crm_pipelines p on p.id = o.pipeline_id
          left join profiles u on u.id = o.owner_id
          where o.team_id = ${c.team.id}::uuid and (${etapa}::text is null or o.stage = ${etapa}) and (${like}::text is null or cl.name ilike ${like})
          order by o.updated_at desc limit ${Math.min(100, Number(a.limite) || 40)}`).catch(async () =>
          asUser(c, (tx) => tx`select o.id, o.stage, o.offer, o.next_step, o.next_date, o.notes, o.updated_at, cl.id as client_id, cl.name as cliente from crm_opportunities o join crm_clients cl on cl.id = o.client_id where o.team_id = ${c.team.id}::uuid and (${etapa}::text is null or o.stage = ${etapa}) order by o.updated_at desc limit 40`))
        return { oportunidades: rows, link: `${appUrl}/crm` }
      },
    },
    {
      name: 'sinfy_oportunidade_salvar',
      title: 'Criar ou editar oportunidade',
      description: 'Cria um cartão no funil (com "cliente" novo ou "cliente_id") ou muda um ("id"): etapa, próximo passo, data, notas, oferta. Fechado ou perdido só com "confirmar": true.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          cliente_id: { type: 'string' },
          cliente: { type: 'object', properties: { nome: { type: 'string' }, site: { type: 'string' }, cidade: { type: 'string' }, segmento: { type: 'string' }, telefone: { type: 'string' }, email: { type: 'string' }, instagram: { type: 'string' } } },
          etapa: { type: 'string', enum: STAGES },
          proximo_passo: { type: 'string' },
          data: { type: 'string' },
          notas: { type: 'string' },
          oferta: { type: 'object' },
          confirmar: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      run: async (c, a) => {
        if (!moduleOn(c, 'crm')) fail('O módulo Oportunidades está desligado nesta conta.')
        const etapa = typeof a.etapa === 'string' ? a.etapa : undefined
        if (etapa && !STAGES.includes(etapa)) fail(`Etapa inválida. Use: ${STAGES.join(', ')}.`)
        if ((etapa === 'fechado' || etapa === 'perdido') && a.confirmar !== true) fail(`Marcar como ${etapa} pede o "pode" da pessoa: confirme com ela e chame de novo com "confirmar": true.`)
        const date = typeof a.data === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(a.data) ? a.data : a.data === '' ? null : fail('Data em AAAA-MM-DD.')) : undefined
        const next = typeof a.proximo_passo === 'string' ? a.proximo_passo.slice(0, 300) : undefined
        const notes = typeof a.notas === 'string' ? a.notas.slice(0, 4000) : undefined
        const offer = a.oferta && typeof a.oferta === 'object' ? JSON.stringify(a.oferta) : null
        if (a.id) {
          const rows = await asUser(c, (tx) => tx`update crm_opportunities set
              stage = coalesce(${etapa ?? null}, stage),
              next_step = case when ${next !== undefined} then ${next ?? null} else next_step end,
              next_date = case when ${date !== undefined} then ${date ?? null}::date else next_date end,
              notes = case when ${notes !== undefined} then ${notes ?? null} else notes end,
              offer = case when ${offer}::text::jsonb is null then offer else coalesce(offer, '{}'::jsonb) || ${offer}::text::jsonb end
            where id = ${str(a.id, 60)}::uuid and team_id = ${c.team.id}::uuid returning id, stage, next_step, next_date`)
          if (!rows.length) fail('Oportunidade não encontrada nesta conta (veja em sinfy_oportunidades).')
          return { ok: true, oportunidade: rows[0], link: `${appUrl}/crm` }
        }
        return asUser(c, async (tx) => {
          let clientId = str(a.cliente_id, 60)
          if (!clientId) {
            const cl = (a.cliente ?? {}) as Args
            const name = str(cl.nome, 160)
            if (!name) fail('Para criar, mande "cliente" com pelo menos "nome", ou "cliente_id".')
            const [row] = await tx`insert into crm_clients (team_id, name, website, city, segment, phone, email, instagram, source, status)
              values (${c.team.id}::uuid, ${name}, ${str(cl.site, 300) || null}, ${str(cl.cidade, 120) || null}, ${str(cl.segmento, 120) || null}, ${str(cl.telefone, 40) || null}, ${str(cl.email, 200) || null}, ${str(cl.instagram, 120) || null}, 'outro', 'lead') returning id`
            clientId = row.id
          }
          const [pipe] = await tx`select id from crm_pipelines where team_id = ${c.team.id}::uuid order by position, created_at limit 1`
          if (!pipe) fail('A conta ainda não tem funil: abra o CRM uma vez para criar.')
          const [opp] = await tx`insert into crm_opportunities (pipeline_id, client_id, stage, next_step, next_date, notes, offer)
            values (${pipe.id}::uuid, ${clientId}::uuid, ${etapa ?? 'novo'}, ${next ?? null}, ${date ?? null}::date, ${notes ?? null}, coalesce(${offer}::text::jsonb, '{}'::jsonb)) returning id, stage`
          return { ok: true, oportunidade: opp, cliente_id: clientId, link: `${appUrl}/crm` }
        })
      },
    },

    // ---------- Referências ----------
    {
      name: 'sinfy_referencias',
      title: 'Referências',
      description: 'As referências visuais da conta; filtre por busca, estrela, tipo ou etiqueta.',
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
      description: 'Guarda um link como referência, ou muda uma ("id"): título, notas, etiquetas, tipo, estrela.',
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
      description: 'As 26 fórmulas de gancho de Reels e as regras do gancho.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      run: async () => ({ regras: IA.HOOK_RULES, formulas: IA.hooksForPrompt() }),
    },
    {
      name: 'sinfy_ig_ganchos',
      title: 'Instagram · nota dos ganchos',
      description: 'Nota de 0 a 100 para cada gancho, com a fórmula e os problemas. Mande 3 de fórmulas diferentes.',
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
      description: 'Minutagem do roteiro (uma fala por linha) com os alertas de ritmo, gancho e loop.',
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
      description: 'Revisa uma legenda (primeira linha, hashtags, chamada, termos de busca) e dá a nota de "cara de IA".',
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
      description: 'Tira a cara de IA de um texto e diz o que reescrever à mão, com a nota antes e depois.',
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
      description: 'Ordena reels de outros perfis pelo múltiplo sobre a mediana e mostra o que os melhores têm em comum. "salvar" grava no Cérebro.',
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
      description: 'Auditoria dos posts do Instagram conectado (padrão 90 dias): os melhores e piores, por formato e por gancho, e o que fazer mais. "detalhe": true traz todas as linhas.',
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
      description: 'Nota do perfil do Instagram conectado (bio, foto, ritmo, formatos, desempenho) e a rubrica de 12 itens.',
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
      description: 'Os comentários dos posts recentes (ou de um "post"). Só lê: responder é na tela.',
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
            comentarios: rows.filter((r) => r.media_id === m.id).slice(0, 30).map((r) => ({ id: r.comment_id, resposta_a: r.parent_id ?? undefined, de: r.username ? `@${r.username}` : '?', texto: r.body, curtidas: r.like_count ?? 0, nosso: r.own || undefined, oculto: r.hidden || undefined, respondido: r.replied || undefined, resolvido: r.handled || undefined, quando: r.ts })),
          })),
          responder: `${appUrl}/crm/instagram`,
        }
      },
    },
  ]
}
