import { useCrm } from '@/features/crm/crmStore'
import { reportStep, type IaraAction, type IaraDone } from './store'
import { followOn, goTo } from './follow'

/**
 * As ferramentas novas na Iara (2026-11-07, o usuário: "atualize a iara para dar suporte nas novas
 * ferramentas que criamos… quero usar ela para qualquer tela que estiver aberto, para criar coisas,
 * alterar dados, criar postagens, imagens, novas paginas, funils, analisar campanhas"). Quadros,
 * oportunidades do CRM, formulários, funis, campanhas da Meta, projetos do Space e imagens soltas.
 * Seguem a regra da Iara: rascunho e mudança de dado direto; o que é definitivo (fechar ou perder
 * uma venda, publicar) pede confirmação. Tudo da conta aberta (RLS por `team_id`).
 */

type IaraResult = { done: IaraDone[]; data?: unknown; images?: { name: string; data: string }[] }
export type ToolAction = IaraAction & { exec?: (args: Record<string, unknown>) => Promise<IaraResult> }

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
const clip = (s: string | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
const team = () => {
  const t = useCrm.getState().team
  if (!t) throw new Error('Esta aba não tem uma conta de empresa aberta: entre na conta nela (ou recarregue a página) e peça de novo.')
  return t
}
/** Acompanhar ligado: leva a pessoa à tela onde a mudança aparece. */
const show = (path: string) => {
  if (followOn() && !window.location.pathname.startsWith(path.split('?')[0])) goTo(path)
}

// ---------- quadros ----------

/**
 * Os agentes que aparecem montando no quadro: o do chat (Claude Code ou Codex), numerado quando são mais de um
 * ("Claude Code · 1", "· 2"). `agentes` = quantos montam juntos (1 a 3; padrão 2). É o mesmo agente dividindo
 * o trabalho: o nome nunca é de outro agente que não está trabalhando.
 */
const boardAgents = async (n: unknown) => {
  const { chatAgent } = await import('./actions')
  const { agentPointer } = await import('@/features/quadros/openBoard')
  const count = Math.max(1, Math.min(3, typeof n === 'number' ? Math.round(n) : 2))
  return Array.from({ length: count }, (_, i) => agentPointer(chatAgent(), count > 1 ? String(i + 1) : undefined))
}

const DRAFT_DOC = '"titulo"?:string,"subtitulo"?:string,"cartoes"?:[{"id"?,"titulo","texto"?,"icone"?,"cor"?,"tag"?}],"notas"?:[string|{"texto","cor"?,"icone"?}],"colunas"?:[{"nome","cor"?,"cartoes"?:[...],"notas"?:[...]}],"centro"?:string,"fluxo"?:true,"ligacoes"?:[{"de","para","texto"?}]'
const DRAFT_HELP = 'Prefira "cartoes" (cartão branco com ícone, título, texto curto e etiqueta: fica bem mais visual que nota) para planos, posts, etapas e ideias com detalhe; "notas" para frases curtas. "icone": nome do Lucide em inglês (camera, megaphone, target, users, calendar, clapperboard, image, message-circle, chart-line, rocket, lightbulb, check…) ou palavra em português. "tag": etiqueta curta (Reels, Carrossel, Urgente, R$ 300). "colunas" = frames lado a lado (um item por linha, nunca sobrepõe); "centro" = mapa com o tema no meio e cada item ligado a ele; "fluxo":true = cartões em sequência com setas; "ligacoes" = setas entre itens deste bloco (de/para = "id" que você deu, posição 1, 2… ou começo do título). Cores: amarelo, laranja, rosa, roxo, azul, verde, cinza. Texto do cartão: até ~200 caracteres; o detalhe longo vai num conteúdo, não no quadro.'

import { DOODLE_NAMES, SCENE_NAMES } from '@/features/quadros/sketch'

const BOARD_ACTIONS: ToolAction[] = [
  {
    name: 'quadro_ver',
    doc: '{"quadro":ID,"itens"?:[id]} — a imagem do quadro como está agora (PNG), para conferir o desenho depois de criar, organizar ou ligar: setas tortas ou soltas, itens encostados, texto cortado. "itens" limita a imagem a esses itens (e o que está no grupo deles).',
    run: async () => ({ label: 'Olhei o quadro.', ok: true }),
    exec: async (a) => {
      const id = String(a.quadro ?? '')
      if (!id) return { done: [{ label: 'Diga o quadro (id).', ok: false }] }
      const { boardImage } = await import('@/features/quadros/compose')
      const only = Array.isArray(a.itens) ? a.itens.map((x) => String(x).replace(/^#/, '')).slice(0, 80) : undefined
      const data = await boardImage(id, team().id, only)
      return { done: [], data: { quadro: id, imagem: 'quadro.png' }, images: [{ name: 'quadro.png', data }] }
    },
  },
  {
    name: 'quadros_listar',
    doc: '{} — os quadros (canvas livre estilo Miro) da conta: id, título e quando mudou.',
    run: async () => ({ label: 'Li os quadros.', ok: true }),
    exec: async () => {
      const { listBoards } = await import('@/features/quadros/data')
      const list = await listBoards(team().id)
      return { done: [], data: list.slice(0, 80).map((b) => ({ id: b.id, titulo: b.title, editado: new Date(b.updatedAt).toLocaleString('pt-BR'), abrir: `/quadros/${b.id}` })) }
    },
  },
  {
    name: 'quadro_ler',
    doc: '{"quadro":ID} — o que está num quadro: cada item com o id (#…), o tipo (nota, cartão), a cor, a coluna (frame), onde está (@x,y largura x altura) e o texto; e cada seta com o id, de onde para onde (ou "solta") e o rótulo. Use os ids em quadro_editar e quadro_ligar, e quadro_ver para conferir o desenho.',
    run: async () => ({ label: 'Li o quadro.', ok: true }),
    exec: async (a) => {
      const { boardOutline } = await import('@/features/quadros/outline')
      const { openBoard } = await import('@/features/quadros/openBoard')
      const id = String(a.quadro ?? '')
      const open = openBoard(id)
      if (open) return { done: [], data: { quadro: id, aberto: true, ...boardOutline(open.api.getSceneElements() as unknown[]) } }
      const { loadBoard } = await import('@/features/quadros/data')
      const board = await loadBoard(id)
      if (!board || board.teamId !== team().id) return { done: [{ label: 'Quadro não encontrado nesta conta.', ok: false }] }
      return { done: [], data: { quadro: id, titulo: board.title, ...boardOutline(board.scene.elements) } }
    },
  },
  {
    name: 'quadro_criar',
    doc: `{"titulo":string,"modelo"?:"brainstorm"|"kanban"|"calendario"|"jornada"|"funil"|"campanha"|"persona"|"retro",${DRAFT_DOC}} — cria um quadro novo na conta e abre. Com "modelo" nasce com o modelo pronto (cartões com ícone, colunas ou setas) e o conteúdo vem embaixo; sem conteúdo e sem modelo, em branco. ${DRAFT_HELP}`,
    label: (a) => `Criar quadro: ${String(a.titulo ?? '')}`,
    run: async (a) => {
      const { createBoardFrom, addDraftToBoard } = await import('@/features/quadros/compose')
      const { TEMPLATES } = await import('@/features/quadros/templates')
      const { readDraft, draftIsEmpty } = await import('@/features/quadros/layout')
      const title = str(a.titulo, 120) || 'Quadro sem título'
      const tpl = TEMPLATES.find((t) => t.id === a.modelo)
      const draft = readDraft(a)
      const hasContent = !draftIsEmpty({ ...draft, titulo: undefined, subtitulo: undefined })
      const first = tpl ? { ...tpl.draft(), titulo: title } : hasContent ? { ...draft, titulo: draft.titulo ?? title } : undefined
      const id = await createBoardFrom(team().id, title, first)
      if (tpl && hasContent) await addDraftToBoard(id, team().id, draft)
      show(`/quadros/${id}`)
      return { label: `Quadro criado: ${title}`, ok: true, to: `/quadros/${id}`, ref: id }
    },
  },
  {
    name: 'quadro_adicionar',
    doc: `{"quadro":ID,"agentes"?:1|2|3,${DRAFT_DOC}} — põe num quadro que já existe um bloco novo, embaixo do que já está lá, sem mexer no resto. Cada item é medido pelo texto, então nada fica sobreposto. Com o quadro aberto, os agentes montam à vista, peça por peça ("agentes": quantos montam juntos, padrão 2), e dá para desfazer. ${DRAFT_HELP}`,
    label: () => 'Adicionar ao quadro',
    run: async (a) => {
      const id = String(a.quadro ?? '')
      if (!id) return { label: 'Diga o quadro (id).', ok: false }
      const { addDraftToBoard } = await import('@/features/quadros/compose')
      const { readDraft, draftIsEmpty } = await import('@/features/quadros/layout')
      const draft = readDraft(a)
      if (draftIsEmpty(draft)) return { label: 'Mande "cartoes", "notas", "colunas", "centro" ou "titulo".', ok: false }
      const r = await addDraftToBoard(id, team().id, draft, await boardAgents(a.agentes))
      if (!r.live) show(`/quadros/${id}`)
      return { label: `Pus ${r.count} elemento(s) no quadro`, ok: true, to: `/quadros/${id}` }
    },
  },
  {
    name: 'quadro_desenhar',
    doc: `{"quadro":ID,"itens":[ITEM],"absoluto"?:boolean,"agentes"?:1|2|3} — desenha com o lápis no quadro, estilo sketchnote (bonecos de palito, ícones a traço, letra de mão), com os agentes desenhando à vista. Para ilustrar uma ideia, prefira os prontos: {"tipo":"comparacao","fundo"?:"escuro"|"claro","esquerda":LADO,"direita":LADO} (dois lados com divisória a lápis; LADO = {"marca"?:"x"|"certo"|"nenhuma","titulo","cena"?:CENA,"desenhos"?:[{"nome":DESENHO,"x","y","escala"?,"espelhar"?,"humor"?}],"itens":[frases curtas]}); {"tipo":"funil","etapas":[string],"titulo"?}; {"tipo":"cena","nome":CENA,"x","y","largura"?|"escala"?,"cor"?}; {"tipo":"desenho","nome":DESENHO,"x","y","largura"?|"escala"?,"cor"?,"espelhar"?,"humor"?:"feliz"|"triste"|"neutro"|"cansado"|"falando"}; {"tipo":"lista","x","y","itens":[string],"largura"?,"tamanho"?,"cor"?} (com travessão, quebra a linha sozinha); {"tipo":"texto","x","y","texto","tamanho"?,"cor"?,"centro"?}; {"tipo":"forma","forma":"retangulo"|"elipse"|"losango","x","y","largura","altura","cor"?,"preenchimento"?,"solido"?,"texto"?}; {"tipo":"traco","pontos":[[x,y],…],"fechado"?,"cor"?,"espessura"?}; {"tipo":"linha","pontos","seta"?}. CENA: ${SCENE_NAMES.join(', ')} (reunião = duas pessoas sentadas à mesa, uma cansada; live = pessoa dentro do notebook falando, ondas e plateia). DESENHO: ${DOODLE_NAMES.join(', ')} (tamanho na escala 1: pessoa 60×95, notebook 150×105, plateia 146×110, os ícones ~80). Coordenadas da ilustração (0,0 = canto de cima à esquerda); entra embaixo do que existe, ou nas coordenadas do quadro com "absoluto". Frases curtas e grandes se leem de longe; deixe espaço entre os desenhos. Depois confira com quadro_ver. Desfazível.`,
    label: () => 'Desenhar no quadro',
    run: async (a) => {
      const id = String(a.quadro ?? '')
      if (!id) return { label: 'Diga o quadro (id).', ok: false }
      const { readSketch } = await import('@/features/quadros/sketch')
      const items = readSketch(a.itens)
      if (!items.length) return { label: 'Mande "itens" (funil, traço, linha, forma ou texto).', ok: false }
      const { drawSketch } = await import('@/features/quadros/compose')
      const r = await drawSketch(id, team().id, items, { absoluto: a.absoluto === true }, await boardAgents(a.agentes))
      if (!r.live) show(`/quadros/${id}`)
      return { label: `Desenhei ${r.count} traço(s) e texto(s) no quadro`, ok: true, to: `/quadros/${id}` }
    },
  },
  {
    name: 'quadro_organizar',
    doc: '{"quadro":ID,"espaco"?:number,"linhas"?:boolean} — arruma o que já está no quadro: cada nota do tamanho do texto, os itens de cada coluna (frame) empilhados sem sobrepor (o frame cresce), colunas lado a lado sem encostar, cartões ligados por setas na mesma linha alinhados pelo meio e a 90 px um do outro (mais, se a seta tem rótulo), o que está solto e encostado desce até ficar livre, setas refeitas retas de borda a borda, setas presas a algo apagado e rótulos de setas apagadas removidos (textos presos a outra coisa ficam, soltos). Use quando a pessoa disser que está embolado, sobreposto, torto ou que as setas estão ruins; depois confira com quadro_ver. "linhas":false não mexe nas linhas de fluxo. Desfazível.',
    label: () => 'Organizar o quadro',
    run: async (a) => {
      const id = String(a.quadro ?? '')
      if (!id) return { label: 'Diga o quadro (id).', ok: false }
      const { organizeBoard } = await import('@/features/quadros/compose')
      const r = await organizeBoard(id, team().id, { espaco: typeof a.espaco === 'number' ? a.espaco : undefined, linhas: a.linhas === false ? false : undefined }, await boardAgents(a.agentes))
      if (!r.live) show(`/quadros/${id}`)
      return { label: r.changed ? `Organizei o quadro (${r.changed} elemento(s) no lugar)` : 'O quadro já estava organizado', ok: true, to: `/quadros/${id}` }
    },
  },
  {
    name: 'quadro_editar',
    doc: '{"quadro":ID,"itens":[{"id","texto"?,"titulo"?,"cor"?,"x"?,"y"?,"apagar"?:true}]} — muda itens que já estão no quadro (o id vem do quadro_ler): troca o texto (num cartão, "titulo" e "texto" separados) e a caixa cresce junto, muda a cor, move para x/y ou apaga (apaga também as setas dele e os rótulos delas). O id pode ser de uma seta: "apagar" tira só ela (com o rótulo) e "cor" muda o traço. Até 40 por vez. Desfazível com o quadro aberto.',
    label: (a) => `Mudar ${Array.isArray(a.itens) ? a.itens.length : 0} item(ns) no quadro`,
    run: async (a) => {
      const id = String(a.quadro ?? '')
      const itens = (Array.isArray(a.itens) ? a.itens : []).slice(0, 40)
        .map((i) => (i && typeof i === 'object' ? (i as Record<string, unknown>) : null))
        .filter((i): i is Record<string, unknown> => !!i && typeof i.id === 'string')
        .map((i) => ({ id: String(i.id).replace(/^#/, ''), texto: str(i.texto, 600), titulo: str(i.titulo, 160), cor: str(i.cor, 20), apagar: i.apagar === true, x: typeof i.x === 'number' ? i.x : undefined, y: typeof i.y === 'number' ? i.y : undefined }))
      if (!id || !itens.length) return { label: 'Diga o quadro e os itens (ids do quadro_ler).', ok: false }
      const { editBoardItems } = await import('@/features/quadros/compose')
      const r = await editBoardItems(id, team().id, itens, await boardAgents(a.agentes))
      if (!r.live) show(`/quadros/${id}`)
      return { label: `Mudei ${itens.length} item(ns) no quadro`, ok: true, to: `/quadros/${id}` }
    },
  },
  {
    name: 'quadro_ligar',
    doc: '{"quadro":ID,"ligacoes":[{"de":id,"para":id,"texto"?,"cor"?}]} — liga com setas itens que já estão no quadro (ids do quadro_ler). A seta acompanha quando os itens se movem. "texto" vai na seta (ex.: "depois", "gera"). Até 40.',
    label: (a) => `Ligar ${Array.isArray(a.ligacoes) ? a.ligacoes.length : 0} par(es) no quadro`,
    run: async (a) => {
      const id = String(a.quadro ?? '')
      const links = (Array.isArray(a.ligacoes) ? a.ligacoes : []).slice(0, 40)
        .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>) : null))
        .filter((l): l is Record<string, unknown> => !!l && !!l.de && !!l.para)
        .map((l) => ({ de: String(l.de).replace(/^#/, ''), para: String(l.para).replace(/^#/, ''), texto: str(l.texto, 60), cor: str(l.cor, 20) }))
      if (!id || !links.length) return { label: 'Diga o quadro e as ligações (de/para com os ids do quadro_ler).', ok: false }
      const { linkBoardItems } = await import('@/features/quadros/compose')
      const r = await linkBoardItems(id, team().id, links, await boardAgents(a.agentes))
      if (!r.live) show(`/quadros/${id}`)
      return { label: `Liguei ${links.length} par(es) no quadro`, ok: true, to: `/quadros/${id}` }
    },
  },
]

// ---------- oportunidades (CRM) ----------

const STAGE_IDS = ['novo', 'mapeado', 'selecionado', 'pagina', 'contatado', 'conversa', 'proposta', 'fechado', 'perdido']
const DAY = /^\d{4}-\d{2}-\d{2}$/

const CRM_ACTIONS: ToolAction[] = [
  {
    name: 'oportunidades_listar',
    doc: `{"etapa"?:${STAGE_IDS.map((s) => `"${s}"`).join('|')},"busca"?:string} — as oportunidades de venda do CRM: id, empresa, etapa, próximo passo e data, valor da oferta, origem (campanha/formulário), dias parada.`,
    run: async () => ({ label: 'Li as oportunidades.', ok: true }),
    exec: async (a) => {
      const { listOpportunities } = await import('@/features/crm/opportunities')
      const { STAGE_LABEL } = await import('@/features/prospects/funnel')
      const q = str(a.busca, 80)?.toLowerCase()
      const list = (await listOpportunities()).filter((o) => (!a.etapa || o.stage === a.etapa) && (!q || o.lead.name.toLowerCase().includes(q)))
      const now = Date.now()
      return {
        done: [],
        data: list.slice(0, 150).map((o) => ({
          id: o.id,
          empresa: o.lead.name,
          etapa: STAGE_LABEL[o.stage],
          etapa_id: o.stage,
          proximo_passo: o.nextStep,
          data: o.nextDate,
          valor: (o.offer as { price?: number } | undefined)?.price,
          origem: o.origin ? clip(JSON.stringify(o.origin), 160) : undefined,
          parada_ha_dias: Math.floor((now - Date.parse(o.history.at(-1)?.at ?? o.updatedAt)) / 86_400_000),
          abrir: `/crm?oportunidade=${o.id}`,
        })),
      }
    },
  },
  {
    name: 'oportunidade_editar',
    doc: `{"id":ID,"etapa"?:ETAPA_CRM,"proximo_passo"?:string,"data"?:"AAAA-MM-DD","notas"?:string} — muda uma oportunidade: move de etapa (${STAGE_IDS.join(', ')}), o próximo passo e a data dele, as notas. Mover para fechado ou perdido pede confirmação.`,
    risky: (a) => a.etapa === 'fechado' || a.etapa === 'perdido',
    label: (a) => `Mudar oportunidade${a.etapa ? ` para ${String(a.etapa)}` : ''}`,
    run: async (a) => {
      const { updateOpportunity } = await import('@/features/crm/opportunities')
      const patch: Record<string, unknown> = {}
      if (typeof a.etapa === 'string') {
        if (!STAGE_IDS.includes(a.etapa)) return { label: `Etapa desconhecida: ${a.etapa}`, ok: false }
        patch.stage = a.etapa
      }
      if (typeof a.proximo_passo === 'string') patch.nextStep = str(a.proximo_passo, 500)
      if (typeof a.data === 'string') patch.nextDate = DAY.test(a.data) ? a.data : undefined
      if (typeof a.notas === 'string') patch.notes = str(a.notas, 8000)
      const o = await updateOpportunity(String(a.id), patch as never)
      return { label: `Oportunidade atualizada: ${o.lead.name}`, ok: true, to: `/crm?oportunidade=${o.id}` }
    },
  },
  {
    name: 'oportunidade_criar',
    doc: '{"empresa":string,"site"?:string,"cidade"?:string,"segmento"?:string,"telefone"?:string,"email"?:string,"etapa"?:ETAPA_CRM,"proximo_passo"?:string,"notas"?:string} — cadastra a empresa como cliente e cria a oportunidade no CRM (etapa padrão "novo"). Só com dados que a pessoa deu ou que estão na tela; nunca invente contato.',
    label: (a) => `Criar oportunidade: ${String(a.empresa ?? '')}`,
    run: async (a) => {
      const name = str(a.empresa, 160)
      if (!name) return { label: 'Faltou o nome da empresa.', ok: false }
      const { createClient } = await import('@/features/crm/clients')
      const { createOpportunity, leadForClient, updateOpportunity } = await import('@/features/crm/opportunities')
      const client = await createClient({ name, website: str(a.site, 300), city: str(a.cidade, 120), segment: str(a.segmento, 120), phone: str(a.telefone, 40), email: str(a.email, 200), source: 'outro', status: 'lead' })
      const stage = typeof a.etapa === 'string' && STAGE_IDS.includes(a.etapa) ? a.etapa : 'novo'
      let o = await createOpportunity(client.id, { stage: stage as never, lead: leadForClient(client), region: str(a.cidade, 120) })
      if (a.proximo_passo || a.notas) o = await updateOpportunity(o.id, { nextStep: str(a.proximo_passo, 500), notes: str(a.notas, 8000) } as never)
      show('/crm')
      return { label: `Oportunidade criada: ${name}`, ok: true, to: `/crm?oportunidade=${o.id}`, ref: o.id }
    },
  },
]

// ---------- formulários e funis ----------

const FIELD_TYPES = ['short', 'long', 'email', 'phone', 'number', 'choice', 'multi', 'select', 'yesno', 'rating', 'product']

/** O formulário para a Iara ler: o catálogo de um campo de produto vira um resumo (são centenas de itens). */
const lightDefinition = (d: { steps: { fields: { type: string; catalog?: { items: { brand: string }[]; whatsapp?: string } }[] }[] }) => ({
  ...d,
  steps: d.steps.map((st) => ({ ...st, fields: st.fields.map((f) => (f.catalog ? { ...f, catalog: { produtos: f.catalog.items.length, marcas: [...new Set(f.catalog.items.map((i) => i.brand))], whatsapp: f.catalog.whatsapp } } : f)) })),
})

const FORM_ACTIONS: ToolAction[] = [
  {
    name: 'formularios_listar',
    doc: '{} — os formulários e quizzes da conta: id, nome, tipo, publicado ou rascunho, visitas, respostas e qualificados.',
    run: async () => ({ label: 'Li os formulários.', ok: true }),
    exec: async () => {
      const { listForms, submissionCounts } = await import('@/features/crm/forms')
      const t = team()
      const [forms, counts] = await Promise.all([listForms(t.id), submissionCounts(t.id).catch(() => ({} as Record<string, { total: number; qualified: number }>))])
      return { done: [], data: forms.map((f) => ({ id: f.id, nome: f.name, tipo: f.kind, status: f.status === 'published' ? 'publicado' : 'rascunho', visitas: f.views, respostas: counts[f.id]?.total ?? 0, qualificados: counts[f.id]?.qualified ?? 0, abrir: `/crm/formularios/${f.id}` })) }
    },
  },
  {
    name: 'formulario_ler',
    doc: '{"id":ID} — um formulário inteiro: etapas, perguntas, opções e pontos, resultados do quiz, e as últimas respostas resumidas.',
    run: async () => ({ label: 'Li o formulário.', ok: true }),
    exec: async (a) => {
      const { loadForm, listSubmissions } = await import('@/features/crm/forms')
      const f = await loadForm(String(a.id))
      if (!f || f.teamId !== team().id) return { done: [{ label: 'Formulário não encontrado nesta conta.', ok: false }] }
      const subs = await listSubmissions(f.id, 30).catch(() => [])
      return { done: [], data: { id: f.id, nome: f.name, status: f.status, visitas: f.views, definicao: lightDefinition(f.definition), ultimas_respostas: JSON.stringify(subs).slice(0, 5000) } }
    },
  },
  {
    name: 'formulario_criar',
    doc: `{"nome":string,"modelo"?:ID_MODELO,"tipo"?:"form"|"quiz","etapas"?:[{"titulo":string,"descricao"?:string,"campos":[{"tipo":${FIELD_TYPES.map((t) => `"${t}"`).join('|')},"rotulo":string,"obrigatorio"?:boolean,"opcoes"?:[string|{"texto","pontos"?}],"mapa"?:"name"|"email"|"phone"|"message"}]}]} — cria um formulário ou quiz em rascunho (não publica) e abre o editor. "modelo" usa um dos modelos prontos (ids: captacao-agenda, diagnostico, contato, site, qualificacao…); "etapas" monta as perguntas. Nome, e-mail e WhatsApp devem ter "mapa" para virar lead no CRM.`,
    label: (a) => `Criar formulário: ${String(a.nome ?? '')}`,
    run: async (a) => {
      const { createForm, TEMPLATES, blankDefinition, newId, THEME_DEFAULT, SETTINGS_DEFAULT } = await import('@/features/crm/forms')
      const t = team()
      const name = str(a.nome, 120) || 'Formulário'
      const tpl = typeof a.modelo === 'string' ? TEMPLATES.find((x) => x.id === a.modelo) : undefined
      let definition = tpl ? (tpl.build ? tpl.build().definition : tpl.definition()) : blankDefinition(a.tipo === 'quiz' ? 'quiz' : 'form')
      let settings = { ...SETTINGS_DEFAULT, ...(tpl?.build ? tpl.build().settings : tpl?.settings ?? {}) }
      if (tpl?.build) {
        const built = tpl.build()
        definition = built.definition
        settings = { ...SETTINGS_DEFAULT, ...built.settings }
      }
      const steps = Array.isArray(a.etapas) ? (a.etapas as Record<string, unknown>[]).slice(0, 20) : []
      if (steps.length) {
        definition = {
          ...definition,
          steps: steps.map((s) => ({
            id: newId('s'),
            title: str(s.titulo, 200),
            description: str(s.descricao, 600),
            fields: (Array.isArray(s.campos) ? (s.campos as Record<string, unknown>[]) : []).slice(0, 12).map((c) => {
              const type = FIELD_TYPES.includes(String(c.tipo)) ? String(c.tipo) : 'short'
              const opts = Array.isArray(c.opcoes) ? c.opcoes.map((o) => (typeof o === 'string' ? { id: newId('o'), label: o } : { id: newId('o'), label: str((o as Record<string, unknown>).texto, 200) ?? '', score: typeof (o as Record<string, unknown>).pontos === 'number' ? ((o as Record<string, unknown>).pontos as number) : undefined })) : undefined
              const map = ['name', 'email', 'phone', 'message'].includes(String(c.mapa)) ? String(c.mapa) : undefined
              return { id: newId('f'), type, label: str(c.rotulo, 200) ?? '', required: c.obrigatorio === true, ...(opts?.length ? { options: opts } : {}), ...(map ? { map } : {}) }
            }),
          })) as never,
        }
      }
      const f = await createForm(t.id, name, definition, tpl?.theme ?? THEME_DEFAULT, settings as never)
      show(`/crm/formularios/${f.id}`)
      return { label: `Formulário criado em rascunho: ${name}`, ok: true, to: `/crm/formularios/${f.id}`, ref: f.id }
    },
  },
  {
    name: 'formulario_produto',
    doc: '{"id":ID,"catalogo"?:string,"whatsapp"?:string,"etapa"?:number,"titulo"?:string,"descricao"?:string,"rotulo"?:string,"mensagem"?:string,"titulo_resultado"?:string,"botao"?:string,"logos"?:[{"marca","logo"}]} — põe (ou atualiza) num formulário em rascunho o localizador de produto: a marca por cartões com logo, o modelo e o ano em listas que dependem da escolha, e no fim o card do produto (foto, códigos, link) com o botão para o WhatsApp de vendas levando a escolha. Sem nome nem telefone: a busca fica nas respostas do formulário com uma referência que vai na mensagem. "catalogo" = CSV (colunas marca, modelo, ano, nome, imagem, link e uma coluna por código, ex. "código brilho") ou JSON; sem ele, mantém o que já há. "etapa" (1, 2…) troca os campos daquela etapa pelo localizador; sem ela, usa a etapa que já tem o localizador ou cria uma no começo. "mensagem" aceita {produto} {marca} {modelo} {ano} {codigos} {link} {ref}. Formulário publicado: mude no editor e publique de novo (aqui só rascunho).',
    label: () => 'Configurar o localizador de produto',
    run: async (a) => {
      const { loadForm, saveForm, newId, cleanCatalog, catalogBrands } = await import('@/features/crm/forms')
      const { parseCatalog } = await import('@/features/crm/catalogImport')
      const f = await loadForm(String(a.id ?? ''))
      if (!f || f.teamId !== team().id) return { label: 'Formulário não encontrado nesta conta.', ok: false }
      if (f.status === 'published') return { label: 'Este formulário está publicado: mude no editor e publique de novo.', ok: false, to: `/crm/formularios/${f.id}` }
      const steps = [...f.definition.steps]
      let at = typeof a.etapa === 'number' ? Math.round(a.etapa) - 1 : steps.findIndex((st) => st.fields.some((x) => x.type === 'product'))
      const old = at >= 0 ? steps[at]?.fields.find((x) => x.type === 'product') : undefined
      let catalog = old?.catalog ?? { items: [], brands: [] }
      if (typeof a.catalogo === 'string' && a.catalogo.trim()) {
        const got = parseCatalog(a.catalogo)
        if (!got.items.length) return { label: 'Não li nenhum produto do catálogo (precisa das colunas marca e modelo).', ok: false }
        catalog = { ...catalog, items: got.items, brands: got.brands }
      }
      const logos = new Map((Array.isArray(a.logos) ? a.logos : []).map((l) => [String((l as Record<string, unknown>).marca ?? '').toLowerCase(), str((l as Record<string, unknown>).logo, 500)]))
      if (logos.size) catalog = { ...catalog, brands: catalogBrands(catalog).map((b) => ({ ...b, logo: logos.get(b.name.toLowerCase()) ?? b.logo })) }
      const digits = typeof a.whatsapp === 'string' ? a.whatsapp.replace(/\D/g, '') : ''
      catalog = cleanCatalog({
        ...catalog,
        ...(digits ? { whatsapp: digits.length <= 11 ? `55${digits}` : digits } : {}),
        ...(str(a.mensagem, 800) ? { message: str(a.mensagem, 800) } : {}),
        ...(str(a.titulo_resultado, 120) ? { resultTitle: str(a.titulo_resultado, 120) } : {}),
        ...(str(a.botao, 40) ? { buttonLabel: str(a.botao, 40) } : {}),
      })
      const field = { id: old?.id ?? newId('f'), type: 'product' as const, label: str(a.rotulo, 200) ?? old?.label ?? 'Marca', required: true, catalog }
      if (at < 0 || at >= steps.length) { steps.unshift({ id: newId('s'), title: str(a.titulo, 200) ?? 'Qual é o seu modelo?', description: str(a.descricao, 600), fields: [field] }); at = 0 }
      else steps[at] = { ...steps[at], ...(str(a.titulo, 200) ? { title: str(a.titulo, 200) } : {}), ...(str(a.descricao, 600) ? { description: str(a.descricao, 600) } : {}), fields: [field] }
      await saveForm({ ...f, definition: { ...f.definition, steps } })
      show(`/crm/formularios/${f.id}`)
      const faltam = [!catalog.items.length && 'o catálogo', !catalog.whatsapp && 'o WhatsApp de vendas'].filter(Boolean)
      return { label: `Localizador na etapa ${at + 1}: ${catalog.items.length} produto(s) de ${catalogBrands(catalog).length} marca(s)${faltam.length ? `; falta ${faltam.join(' e ')}` : ''}`, ok: !faltam.length, to: `/crm/formularios/${f.id}` }
    },
  },
  {
    name: 'funis_listar',
    doc: '{} — os funis da conta (o de oportunidades do CRM vem sempre, id "pipeline"): id, nome, objetivo e etapas com a fonte de cada uma.',
    run: async () => ({ label: 'Li os funis.', ok: true }),
    exec: async () => {
      const { listFunnels, pipelineFunnel } = await import('@/features/funnels/funnels')
      const t = team()
      const list = [pipelineFunnel(t.id), ...(await listFunnels(t.id).catch(() => []))]
      return { done: [], data: list.map((f) => ({ id: f.id, nome: f.name, objetivo: f.objective, etapas: f.steps.map((s) => ({ nome: s.name, tipo: s.kind, fonte: s.source })), abrir: `/crm/funis/${f.id}` })) }
    },
  },
  {
    name: 'funil_ler',
    doc: '{"id":ID,"periodo"?:7|30|90} — os números de um funil agora, etapa por etapa (lidos das fontes reais: campanhas, site, formulários, CRM), com gasto e vendas quando houver. Use para dizer onde o funil mais perde.',
    run: async () => ({ label: 'Li o funil.', ok: true }),
    exec: async (a) => {
      const { loadFunnel, readFunnel } = await import('@/features/funnels/funnels')
      const t = team()
      const f = await loadFunnel(t.id, String(a.id ?? 'pipeline'))
      if (!f) return { done: [{ label: 'Funil não encontrado nesta conta.', ok: false }] }
      const period = ([7, 30, 90].includes(Number(a.periodo)) ? Number(a.periodo) : 30) as 7 | 30 | 90
      reportStep('Lendo as fontes do funil')
      const r = await readFunnel(t.id, f.steps, period)
      return { done: [], data: { funil: f.name, periodo: `${period} dias`, etapas: f.steps.map((s, i) => ({ etapa: s.name, tipo: s.kind, leitura: r.readings[i] })), oportunidades: r.cohort.length } }
    },
  },
  {
    name: 'funil_criar',
    doc: '{"nome":string,"objetivo"?:string,"etapas":[{"nome":string,"tipo":"campaign"|"page"|"event"|"form"|"opportunity"|"stage"|"manual","fonte"?:{"formIds"?:[ID],"stage"?:ETAPA_CRM,"cohort"?:"forms"|"created","path"?:string,"event"?:string,"trackerId"?:string,"accountId"?:string}}]} — cria um funil (até 12 etapas) e abre. Etapa sem fonte conhecida vai como "manual" e a pessoa liga a fonte na tela. Leia formularios_listar antes para pôr os ids reais.',
    label: (a) => `Criar funil: ${String(a.nome ?? '')}`,
    run: async (a) => {
      const { saveFunnel } = await import('@/features/funnels/funnels')
      const { cleanStep } = await import('@/features/funnels/rules')
      const steps = (Array.isArray(a.etapas) ? (a.etapas as Record<string, unknown>[]) : []).slice(0, 12).map((s) => cleanStep({ name: str(s.nome, 80) ?? '', kind: s.tipo, source: s.fonte }))
      const id = await saveFunnel({ teamId: team().id, name: str(a.nome, 120) ?? 'Funil', objective: str(a.objetivo, 400) ?? '', template: 'custom', steps })
      show(`/crm/funis/${id}`)
      return { label: `Funil criado: ${String(a.nome ?? '')}`, ok: true, to: `/crm/funis/${id}`, ref: id }
    },
  },
]

// ---------- campanhas (Meta) ----------

const ADS_ACTIONS: ToolAction[] = [
  {
    name: 'campanhas_analisar',
    doc: '{"periodo"?:"hoje"|7|30|90,"atualizar"?:boolean} — as campanhas da Meta de cada conta de anúncios ligada: gasto, impressões, cliques, CTR, CPC, contatos (leads + conversas), custo por contato, resultado e custo por resultado, status e orçamento; mais os anúncios com melhor e pior custo. "atualizar": true lê da Meta agora (senão usa o último relatório guardado). Use para dizer o que pausar, escalar ou testar.',
    label: () => 'Ler as campanhas na Meta',
    long: (a) => a.atualizar === true,
    run: async () => ({ label: 'Li as campanhas.', ok: true }),
    exec: async (a) => {
      const ads = await import('@/features/crm/ads')
      const t = team()
      const preset = (a.periodo === 'hoje' ? 'today' : Number(a.periodo) === 7 ? 'last_7d' : Number(a.periodo) === 90 ? 'last_90d' : 'last_30d') as 'today' | 'last_7d' | 'last_30d' | 'last_90d'
      const accounts = await ads.loadAdAccounts(t.id).catch(() => [])
      if (!accounts.length) return { done: [], data: 'A conta não tem conta de anúncios da Meta ligada (Anúncios › Conectar).' }
      const out = []
      for (const acc of accounts.slice(0, 4)) {
        reportStep(`Lendo ${acc.name}`)
        let report = a.atualizar === true ? null : await ads.loadAdReport(acc.id, preset).catch(() => null)
        if (!report) report = await ads.fetchAdReport(acc.id, preset).catch((e) => { out.push({ conta: acc.name, erro: e instanceof Error ? e.message : String(e) }); return null })
        if (!report) continue
        const row = (m: Parameters<typeof ads.contactsOf>[0]) => ({ gasto: +m.spend.toFixed(2), impressoes: m.impressions, cliques_link: m.linkClicks, ctr: ads.ctrOf(m), cpc: ads.cpcOf(m), contatos: ads.contactsOf(m), custo_contato: ads.costPerContact(m) })
        const adsList = report.ads.filter((x) => x.metrics.spend > 0).map((x) => ({ anuncio: x.name, campanha: x.campaignName, ...row(x.metrics), resultado: x.result ? `${x.result.value} ${ads.resultLabel(x.result.type)}` : undefined, custo_resultado: x.result?.cost }))
        const byCost = [...adsList].filter((x) => x.custo_contato).sort((p, q) => (p.custo_contato ?? 0) - (q.custo_contato ?? 0))
        out.push({
          conta: acc.name,
          moeda: report.currency,
          periodo: ads.presetLabel(preset),
          lido_em: new Date(report.fetchedAt).toLocaleString('pt-BR'),
          total: row(report.totals),
          campanhas: report.campaigns.map((c) => ({ id: c.id, campanha: c.name, objetivo: ads.OBJECTIVE_LABEL[c.objective ?? ''] ?? c.objective, status: ads.campaignStatus(c.status).label, orcamento_dia: c.dailyBudget, ...row(c.metrics), resultado: c.result ? `${c.result.value} ${ads.resultLabel(c.result.type)}` : undefined, custo_resultado: c.result?.cost })),
          melhores_anuncios: byCost.slice(0, 5),
          piores_anuncios: byCost.slice(-5).reverse(),
          plataformas: report.platforms.slice(0, 6).map((p) => ({ ...p, metrics: row(p.metrics) })),
        })
      }
      return { done: [], data: JSON.stringify(out).slice(0, 14000) }
    },
  },
]

// ---------- projetos (sites no Space) ----------

const PROJECT_ACTIONS: ToolAction[] = [
  {
    name: 'projetos_listar',
    doc: '{} — os projetos (sites de clientes no Space) da conta: id, nome, contexto e quando mudou. Páginas e seções se criam dentro do projeto: abra com abrir_tela {"endereco":"/projetos/<id>"} e a conversa passa a ser a do projeto, com o canvas.',
    run: async () => ({ label: 'Li os projetos.', ok: true }),
    exec: async () => {
      const { useProjectStore } = await import('@/features/projects/projectStore')
      const list = useProjectStore.getState().projects.filter((p) => !p.archivedAt)
      return { done: [], data: list.map((p) => ({ id: p.id, nome: p.name, contexto: clip(p.context, 300), secoes: p.summary?.sections, mudou: new Date(p.updatedAt).toLocaleDateString('pt-BR'), abrir: `/projetos/${p.id}` })) }
    },
  },
  {
    name: 'projeto_criar',
    doc: '{"nome":string,"contexto"?:string} — cria um projeto novo (um site no Space) na conta e abre o canvas dele; ali a conversa vira a do projeto e as páginas são criadas no canvas. "contexto": o negócio, o público e o objetivo do site.',
    label: (a) => `Criar projeto: ${String(a.nome ?? '')}`,
    run: async (a) => {
      const { useProjectStore } = await import('@/features/projects/projectStore')
      const p = await useProjectStore.getState().create({ name: str(a.nome, 120) ?? 'Projeto', context: str(a.contexto, 4000) })
      goTo(`/projetos/${p.id}`)
      return { label: `Projeto criado: ${p.name}`, ok: true, to: `/projetos/${p.id}`, ref: p.id }
    },
  },
]

// ---------- imagens ----------

const IMAGE_ACTIONS: ToolAction[] = [
  {
    name: 'gerar_imagem',
    doc: '{"pedido":string,"quantidade"?:1-4,"formato"?:"square"|"portrait"|"landscape","pasta"?:string,"recorte"?:boolean} — gera imagens soltas (foto de produto, cena, fundo, ilustração) pelo serviço de imagens deste computador, guarda no Cérebro da conta (pasta padrão "fotos/geradas") e mostra na tela. Sem texto nem logo na imagem. Para foto dentro de um post use os criativos (editar_criativo, tratar_imagem). Devolve as imagens para você conferir.',
    label: (a) => `Gerar imagem: ${clip(String(a.pedido ?? ''), 80)}`,
    long: true,
    run: async () => ({ label: 'Gerei as imagens.', ok: true }),
    exec: async (a) => {
      const pedido = str(a.pedido, 2000)
      if (!pedido) return { done: [{ label: 'Faltou o pedido da imagem.', ok: false }] }
      const { callAiQuiet, imageProviderChoice } = await import('@/features/criativos/link')
      const { uploadFiles, mediaUrl } = await import('@/features/cerebro/data')
      const { openViewer } = await import('@/components/MediaViewer')
      const t = team()
      const count = Math.min(4, Math.max(1, Number(a.quantidade) || 1))
      const ratio = a.formato === 'portrait' || a.formato === 'landscape' ? a.formato : 'square'
      const folder = (str(a.pasta, 80) || 'fotos/geradas').replace(/^\/+|\/+$/g, '').replace(/^plataforma\b.*/, 'fotos/geradas')
      const prompt = `${pedido}\n\nEmpresa: ${t.name}. Nunca escreva texto, letras, números nem logos na imagem.`
      const saved: { path: string; data: string }[] = []
      for (let i = 0; i < count; i++) {
        reportStep(`Criando ${i + 1} de ${count}`)
        const img = await callAiQuiet<{ data: string }>('image', { prompt: count > 1 ? `${prompt}\n\nVariação ${i + 1} de ${count}: mude o ângulo ou a composição.` : prompt, ratio, provider: a.recorte === true ? 'openai' : imageProviderChoice(), transparent: a.recorte === true })
        const blob = await (await fetch(img.data)).blob()
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
        const slug = pedido.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/-$/, '')
        const [path] = await uploadFiles(t.id, folder, [new File([blob], `${slug}-${Date.now().toString(36)}.${ext}`, { type: blob.type })])
        saved.push({ path, data: img.data })
      }
      ;(await import('@/features/cerebro/scope')).forgetBrain()
      openViewer(saved.map((s) => ({ name: s.path.split('/').pop()!, src: s.data, resolve: () => mediaUrl(s.path), kind: 'image' as const })))
      return {
        done: [{ label: `${saved.length} imagem(ns) guardada(s) no Cérebro em ${folder}`, ok: true, to: `/cerebro?midia=${encodeURIComponent(saved[0].path)}` }],
        data: saved.map((s) => s.path),
        images: saved.map((s, i) => ({ name: `imagem-${i + 1}`, data: s.data })),
      }
    },
  },
]

export const TOOL_ACTIONS: ToolAction[] = [...BOARD_ACTIONS, ...CRM_ACTIONS, ...FORM_ACTIONS, ...ADS_ACTIONS, ...PROJECT_ACTIONS, ...IMAGE_ACTIONS]
