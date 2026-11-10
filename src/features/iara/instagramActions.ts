import { useCrm } from '@/features/crm/crmStore'
import type { IaraAction, IaraDone } from './store'

/**
 * A inteligência de Instagram na Iara (2026-11-09, o usuário, com o link do instagram-agent-skill:
 * "quero que traga todas as skills e encaixar nas nossas, mas ter essa inteligência completa… e
 * conseguimos fazer ler e comentar?"). As ferramentas que rodam de verdade (`features/instagram-ia`:
 * nota do gancho, tempos do roteiro, revisor de legenda, humanizador, virais, o que funcionou,
 * rubrica do perfil) e os comentários da conta conectada pela API oficial.
 *
 * Regras: tudo é rascunho até a pessoa aprovar. Responder comentário no próprio perfil pede
 * confirmação (cartão). Nada em perfil de terceiros: a API da Meta não comenta em post de outra
 * conta, e a regra do projeto proíbe automação ali; para eles a Iara só escreve o texto.
 */

type IaraResult = { done: IaraDone[]; data?: unknown }
type Action = IaraAction & { exec?: (args: Record<string, unknown>) => Promise<IaraResult> }

const str = (v: unknown, max = 8000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const list = (v: unknown, max = 20) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map((x) => str(x, 600)).filter(Boolean).slice(0, max)
const team = () => {
  const t = useCrm.getState().team
  if (!t) throw new Error('Esta aba não tem uma conta de empresa aberta: entre na conta nela (ou recarregue a página) e peça de novo.')
  return t
}

/** O Instagram conectado da conta (CRM › Instagram), ou um erro que diz o que fazer. */
async function account() {
  const { loadAccounts } = await import('@/features/crm/instagram')
  const accounts = await loadAccounts(team().id)
  const a = accounts[0]
  if (!a) throw new Error('A conta não tem Instagram conectado. Conecte em CRM › Instagram (ou mande o link de conexão ao cliente).')
  if (a.syncError === 'token') throw new Error(`A conexão do @${a.username} caiu: reconecte em CRM › Instagram.`)
  return a
}

const ok = (data: unknown): IaraResult => ({ done: [], data })

export const INSTAGRAM_ACTIONS: Action[] = [
  {
    name: 'ig_formulas',
    doc: '{} — as 26 fórmulas de gancho de Reels (nome, modelo, exemplo, texto da tela, para que serve, armadilha) e as regras do gancho. Leia antes de escrever ganchos, roteiro, pauta ou repurpose.',
    run: async () => ({ label: 'Li as fórmulas de gancho.', ok: true }),
    exec: async () => {
      const { hooksForPrompt, HOOK_RULES } = await import('@/features/instagram-ia/ganchos')
      return ok({ regras: HOOK_RULES, formulas: hooksForPrompt() })
    },
  },
  {
    name: 'ig_ganchos',
    doc: '{"ganchos":[string]} — dá nota de 0 a 100 a cada gancho (a frase falada) em 5 propriedades (tamanho, concreto, tensão, o forte na frente, fala com alguém), aponta problemas graves (saudação, "pare de rolar", "neste vídeo", emoji, hashtag), diz a fórmula e ordena. Escreva 3 ganchos de fórmulas diferentes e passe os 3. Abaixo de 50 no primeiro: ainda não tem gancho. A nota descarta os fracos; não escolhe o vencedor entre dois bons.',
    run: async () => ({ label: 'Dei nota aos ganchos.', ok: true }),
    exec: async (a) => {
      const hooks = list(a.ganchos ?? a.gancho, 12)
      if (!hooks.length) return { done: [{ label: 'Mande "ganchos": uma lista de frases.', ok: false }] }
      const { rankHooks } = await import('@/features/instagram-ia/ganchos')
      const ranked = rankHooks(hooks)
      return ok({ ganchos: ranked, leitura: ranked[0].nota < 50 ? 'Nenhum desses é o gancho ainda: o melhor ficou abaixo de 50.' : `Grave o primeiro (${ranked[0].nota}, ${ranked[0].veredito}).` })
    },
  },
  {
    name: 'ig_tempos',
    doc: '{"roteiro":string,"alvo"?:number,"ppm"?:number} — transforma o roteiro (uma fala por linha) em minutagem: quanto leva cada batida (160 palavras por minuto, ou "ppm"), marca gancho, meio e chamada, e aponta gancho passando de 3 s, batida acima de 4 s, três batidas sem nada concreto, falta de loop (o fim repetir uma palavra do gancho) e a diferença para o "alvo" em segundos. Corrija tudo e rode de novo antes de entregar.',
    run: async () => ({ label: 'Cronometrei o roteiro.', ok: true }),
    exec: async (a) => {
      const roteiro = str(a.roteiro, 12000)
      if (!roteiro) return { done: [{ label: 'Mande o "roteiro".', ok: false }] }
      const { beatSheet } = await import('@/features/instagram-ia/tempos')
      return ok(beatSheet(roteiro, { alvo: Number(a.alvo) || undefined, ppm: Number(a.ppm) || undefined }))
    },
  },
  {
    name: 'ig_legenda_revisar',
    doc: '{"texto":string,"palavras"?:[string]} — revisa uma legenda do Instagram: mostra o que o feed exibe antes do "mais" (~125 caracteres), confere primeira linha, gancho concreto, hashtags (máximo 5 desde dez/2025, nada de #viral), lugar das hashtags, links mortos, UMA chamada, emoji e os termos de busca ("palavras": o que a pessoa quer que achem). Inclui a nota de "cara de IA" do texto. Corrija cada CORRIGIR e decida cada ATENCAO em voz alta.',
    run: async () => ({ label: 'Revisei a legenda.', ok: true }),
    exec: async (a) => {
      const texto = str(a.texto, 4000)
      if (!texto) return { done: [{ label: 'Mande o "texto" da legenda.', ok: false }] }
      const { lintCaption } = await import('@/features/instagram-ia/legenda')
      const { detect } = await import('@/features/instagram-ia/humanizar')
      return ok({ ...lintCaption(texto, { palavras: list(a.palavras, 6) }), cara_de_ia: detect(texto) })
    },
  },
  {
    name: 'ig_humanizar',
    doc: '{"texto":string} — tira a marca de máquina de qualquer texto (legenda, roteiro, comentário, resposta, direct, bio): apaga caracteres invisíveis, troca travessão por vírgula e aspas curvas por retas, troca ou apaga os clichês de IA em português ("no mundo acelerado de hoje", "alavancar", "jornada transformadora", "marque alguém que precisa ver isso"). Devolve o texto limpo, cada troca, as estruturas que você precisa reescrever à mão ("não é só X, é Y", trio, "O resultado?") e a nota de 5 checagens antes e depois (passa com 70 e nenhuma abaixo de 55). Use antes de mostrar qualquer texto de Instagram; reescreva as estruturas e rode de novo. Mostre o texto e a nota, nunca a nota sozinha. É heurística local: não prometa "indetectável".',
    run: async () => ({ label: 'Humanizei o texto.', ok: true }),
    exec: async (a) => {
      const texto = str(a.texto, 12000)
      if (!texto) return { done: [{ label: 'Mande o "texto".', ok: false }] }
      const { humanizeReport } = await import('@/features/instagram-ia/humanizar')
      return ok(humanizeReport(texto))
    },
  },
  {
    name: 'ig_virais',
    doc: '{"reels":[{"perfil":"@x","seguidores"?:number|string,"mediana"?:number|string,"views":number|string,"gancho":string,"tela"?:string,"segundos"?:number,"chamada"?:string,"link"?:string}],"salvar"?:boolean} — arquivo de virais: ordena reels de outros perfis pelo múltiplo sobre a MEDIANA do próprio perfil (não por views brutas; acima de 3x é sinal), dá a fórmula e a nota de cada gancho, mostra o que o terço de cima tem que o de baixo não tem e diz quanto confiar (40 reels de 6 perfis sustenta; 12 não). Números aceitam "12 mil", "1,2 mi". "salvar": grava em instagram/virais.md no Cérebro da conta, que as outras skills leem. Os reels vêm do que a pessoa colou, da tela Referências ou do que ela leu no próprio navegador; nunca raspe o Instagram.',
    run: async () => ({ label: 'Montei o arquivo de virais.', ok: true }),
    exec: async (a) => {
      const { normalizeSwipe, rankSwipe, swipeMarkdown } = await import('@/features/instagram-ia/virais')
      const rows = normalizeSwipe((Array.isArray(a.reels) ? a.reels : []).slice(0, 200) as Array<Record<string, unknown>>)
      if (!rows.length) return { done: [{ label: 'Mande "reels" com pelo menos views e gancho.', ok: false }] }
      const swipe = rankSwipe(rows)
      const done: IaraDone[] = []
      if (a.salvar === true) {
        const { saveNote } = await import('@/features/cerebro/data')
        await saveNote(team().id, 'instagram/virais.md', swipeMarkdown(swipe))
        ;(await import('@/features/cerebro/scope')).forgetBrain()
        done.push({ label: 'Guardei o arquivo de virais no Cérebro (instagram/virais.md).', ok: true, to: '/cerebro' })
      }
      return { done, data: swipe }
    },
  },
  {
    name: 'ig_o_que_funcionou',
    doc: '{"dias"?:30|60|90|180} — auditoria dos posts reais do Instagram conectado (padrão 90 dias): ordena pelo múltiplo sobre a mediana da conta (do mesmo formato quando dá), com envios, salvos e seguidores a cada mil de alcance e tempo assistido dos reels; os 5 de cima e os 5 de baixo; por formato; pela fórmula da primeira linha da legenda; achados com a confiança; o que parar e o que fazer mais. Views sem seguidor = problema de perfil (rode ig_perfil), sem views = problema de gancho.',
    run: async () => ({ label: 'Li o que funcionou no Instagram.', ok: true }),
    exec: async (a) => {
      const acc = await account()
      const { loadMedia } = await import('@/features/crm/instagram')
      const { auditPosts } = await import('@/features/instagram-ia/auditoria')
      const dias = [30, 60, 90, 180].includes(Number(a.dias)) ? Number(a.dias) : 90
      const audit = auditPosts(await loadMedia(acc.id, 300), { dias })
      if (!audit) return ok(`Sem posts com números nos últimos ${dias} dias em @${acc.username}. Abra CRM › Instagram para sincronizar.`)
      return ok({ perfil: `@${acc.username}`, seguidores: acc.followers, dias, ...audit })
    },
  },
  {
    name: 'ig_perfil',
    doc: '{} — o perfil do Instagram conectado com a nota sem IA do app (bio, foto, destaques, ritmo, formatos, legendas, desempenho, horários; 0 a 100 por parte) e a rubrica de 12 itens / 100 pontos (campo Nome pesquisável, primeira linha da bio, fixados, link, destaques, grid, foto, @, categoria, atividade, stories). Dê nota honesta a cada item da rubrica (a maioria fica entre 30 e 49 na primeira vez), reescreva na ordem do que perdeu mais pontos (3 opções de Nome com até 30 caracteres; bio até 150), humanize e diga a nota de novo. Nada é mudado no Instagram: a pessoa edita cada campo.',
    run: async () => ({ label: 'Li o perfil.', ok: true }),
    exec: async () => {
      const acc = await account()
      const { loadMedia } = await import('@/features/crm/instagram')
      const { auditProfile } = await import('@/features/crm/profileAudit')
      const { loadAnalyses } = await import('@/features/crm/profileAnalysis')
      const { PROFILE_RUBRIC, RUBRIC_NOTE } = await import('@/features/instagram-ia/perfil')
      const [media, saved] = await Promise.all([loadMedia(acc.id, 120), loadAnalyses(acc.id).catch(() => null)])
      const highlights = saved?.[0]?.highlights ?? null
      const report = auditProfile({ profile: acc, media, highlights })
      return ok({
        perfil: { usuario: `@${acc.username}`, nome: acc.name ?? '', bio: acc.biography ?? '', link: acc.website ?? '', seguidores: acc.followers, posts: acc.mediaCount, tipo: acc.accountType },
        destaques: highlights ?? 'não informados (a Meta não entrega os destaques: pergunte à pessoa ou peça para marcar em CRM › Instagram › Análise)',
        nota_do_app: report.score,
        partes: report.pillars.map((p) => ({ parte: p.label, nota: p.score, achados: p.findings.map((f) => `${f.level}: ${f.title}${f.action ? ` → ${f.action}` : ''}`) })),
        rubrica: { nota: RUBRIC_NOTE, itens: PROFILE_RUBRIC },
        ultimos_posts: media.slice(0, 9).map((m) => ({ legenda_1a_linha: (m.caption ?? '').split('\n')[0].slice(0, 120), tipo: m.product ?? m.type, link: m.permalink })),
        falta_ver: 'Fixados, capas do grid em miniatura, categoria e botões de contato não vêm pela API: peça um print do topo do perfil se precisar dar nota a eles.',
      })
    },
  },
  {
    name: 'ig_comentarios',
    doc: '{"post"?:string,"posts"?:number} — lê os comentários dos posts do Instagram conectado (a conta da empresa, API oficial): de um "post" (id ou link) ou dos últimos "posts" (padrão 5, máximo 10), com quem comentou, texto, curtidas, se está oculto, as respostas e o id de cada comentário. Separe em PALAVRA-CHAVE, LEAD, SUBSTÂNCIA, PERGUNTA, APOIO e RUÍDO e escreva as respostas nessa ordem (skill Instagram · Responder comentários). Só lê: responder é ig_responder, com confirmação.',
    run: async () => ({ label: 'Li os comentários.', ok: true }),
    exec: async (a) => {
      const acc = await account()
      const { loadMedia, listComments } = await import('@/features/crm/instagram')
      const media = await loadMedia(acc.id, 60)
      const want = str(a.post, 300)
      const picked = want ? media.filter((m) => m.id === want || (m.permalink && want.includes(m.permalink.replace(/\/$/, '').split('/').pop() ?? '\u0000'))) : media.filter((m) => m.product !== 'STORY' && (m.comments ?? 0) > 0).slice(0, Math.min(10, Math.max(1, Number(a.posts) || 5)))
      if (!picked.length) return ok(want ? `Não achei esse post em @${acc.username} (só os 60 mais recentes).` : `Nenhum post recente de @${acc.username} tem comentário.`)
      const posts = []
      for (const m of picked) {
        const comments = await listComments(acc.id, m.id).catch((e: unknown) => ({ erro: e instanceof Error ? e.message : String(e) }))
        posts.push({
          post: m.id,
          link: m.permalink,
          data: new Date(m.postedAt).toLocaleDateString('pt-BR'),
          legenda: (m.caption ?? '').slice(0, 300),
          comentarios: Array.isArray(comments)
            ? comments.slice(0, 60).map((c) => ({ id: c.id, de: c.username ? `@${c.username}` : '?', texto: c.text, curtidas: c.like_count ?? 0, oculto: c.hidden || undefined, quando: c.timestamp, respostas: (c.replies?.data ?? []).map((r) => ({ de: r.username ? `@${r.username}` : '?', texto: r.text, minha: r.username === acc.username || undefined })) }))
            : comments,
        })
      }
      return ok({ perfil: `@${acc.username}`, posts })
    },
  },
  {
    name: 'ig_responder',
    doc: '{"respostas":[{"comentario":ID,"texto":string,"de"?:string}]} — publica respostas a comentários nos posts do Instagram conectado (a conta da própria empresa, API oficial). Pede confirmação: a pessoa vê cada resposta antes de sair. Humanize antes; uma resposta por comentário; nunca responda hater (oculte, se for ofensivo, na tela de Posts). Nunca use para perfis de terceiros.',
    risky: true,
    label: (a) => {
      const r = Array.isArray(a.respostas) ? (a.respostas as Array<Record<string, unknown>>) : []
      return `Responder ${r.length} comentário(s) no Instagram: ${r.slice(0, 3).map((x) => `${x.de ? `${String(x.de)}: ` : ''}"${String(x.texto ?? '').slice(0, 80)}"`).join(' · ')}${r.length > 3 ? ' …' : ''}`
    },
    run: async (a) => {
      const acc = await account()
      const { replyComment } = await import('@/features/crm/instagram')
      const items = (Array.isArray(a.respostas) ? (a.respostas as Array<Record<string, unknown>>) : []).slice(0, 30)
      if (!items.length) return { label: 'Mande "respostas".', ok: false }
      const done: IaraDone[] = []
      for (const r of items) {
        const id = str(r.comentario, 80)
        const texto = str(r.texto, 2200)
        if (!id || !texto) {
          done.push({ label: 'Resposta sem comentário ou sem texto: pulei.', ok: false })
          continue
        }
        try {
          await replyComment(acc.id, id, texto)
          done.push({ label: `Respondi${r.de ? ` ${String(r.de)}` : ''}: "${texto.slice(0, 60)}"`, ok: true, to: '/crm/instagram' })
        } catch (e) {
          done.push({ label: `Não respondi${r.de ? ` ${String(r.de)}` : ''}: ${e instanceof Error ? e.message : String(e)}`, ok: false })
        }
      }
      return done
    },
  },
]
