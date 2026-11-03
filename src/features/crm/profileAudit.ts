import type { IgAccount, IgMedia } from './instagram'

/**
 * Análise de perfil do Instagram (CRM › Instagram › Análise), sem IA: lê o que a
 * função `instagram` já guardou (perfil, posts com números, totais de 30 dias) e
 * os destaques que a pessoa escreveu, e dá uma nota a cada parte com o que fazer.
 * A leitura da IA (foto, grid, tom da bio) vem por cima, em `profileAnalysis.ts`.
 *
 * Sem imports com `@/` e só tipos de fora: o Node lê este arquivo nos testes.
 */

export type Level = 'ok' | 'atencao' | 'critico' | 'info'

export interface Finding {
  id: string
  level: Level
  title: string
  detail?: string
  /** O que fazer, em uma frase. */
  action?: string
}

export type PillarId = 'bio' | 'foto' | 'destaques' | 'ritmo' | 'formatos' | 'legendas' | 'desempenho' | 'horarios'

export interface Pillar {
  id: PillarId
  label: string
  /** 0 a 100; null quando não há dado para dar nota. */
  score: number | null
  findings: Finding[]
}

export interface AuditFacts {
  posts30: number
  posts90: number
  lastPostDays: number | null
  medianReach: number | null
  medianEngagement: number | null
  bestFormat: string | null
  formatShare: Record<string, number>
  formatReach: Record<string, number>
  bestWeekday: string | null
  bestHour: string | null
}

export interface Audit {
  version: 1
  at: number
  score: number
  pillars: Pillar[]
  facts: AuditFacts
}

export type AuditProfile = Pick<IgAccount, 'username' | 'name' | 'biography' | 'website' | 'picture' | 'followers' | 'follows' | 'mediaCount' | 'totals'>

export const PILLAR_LABEL: Record<PillarId, string> = {
  bio: 'Bio e nome',
  foto: 'Foto do perfil',
  destaques: 'Destaques',
  ritmo: 'Ritmo de postagem',
  formatos: 'Formatos',
  legendas: 'Legendas',
  desempenho: 'Desempenho',
  horarios: 'Dias e horários',
}

/** Peso de cada parte na nota geral (horários só informa). */
const WEIGHT: Record<PillarId, number> = { bio: 20, foto: 10, destaques: 10, ritmo: 20, formatos: 15, legendas: 10, desempenho: 20, horarios: 0 }
const PENALTY: Record<Level, number> = { critico: 35, atencao: 15, info: 0, ok: 0 }

const DAY = 86_400_000
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const FORMAT_NAME: Record<string, string> = { reels: 'Reels', carrossel: 'Carrossel', foto: 'Foto' }

/** Mesma regra de `formatOf` em `instagram.ts`, repetida para não puxar imports do app. */
const formatOf = (m: Pick<IgMedia, 'type' | 'product'>) =>
  m.product === 'STORY' ? 'story' : m.product === 'REELS' || m.type === 'VIDEO' ? 'reels' : m.type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'foto'

const interactionsOf = (m: IgMedia) =>
  m.insights.total_interactions ?? (m.insights.likes ?? m.likes ?? 0) + (m.insights.comments ?? m.comments ?? 0) + (m.insights.shares ?? 0) + (m.insights.saved ?? 0)

const median = (values: number[]) => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const pct = (n: number) => `${Math.round(n * 100)}%`
const times = (n: number) => `${n.toFixed(1).replace('.', ',')}x`
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')

const scoreOf = (findings: Finding[]) => Math.max(0, Math.min(100, 100 - findings.reduce((s, f) => s + PENALTY[f.level], 0)))

// ---------- textos ----------

const CTA = /(chame|chama|fale|fala com|agende|agendar|agendamento|marque|pe[cç]a|or[cç]amento|whats|zap|direct|\bdm\b|link|clique|toque|compre|reserve|inscreva|baixe|garanta|saiba mais|👇|⬇|↓|➡|👉)/i
const UF = '(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)'
const PLACE = new RegExp(`(📍|\\b${UF}\\b|online|todo o brasil|brasil inteiro|delivery)`, 'i')
const EMOJI = /\p{Extended_Pictographic}/gu
const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu

const countMatches = (text: string, re: RegExp) => (text.match(re) ?? []).length
const firstLine = (caption: string) => caption.trim().split(/\n/)[0]?.trim() ?? ''

// ---------- destaques ----------

/** Os grupos que um perfil de negócio costuma ter nos destaques, pelos nomes. */
const HIGHLIGHT_GROUPS: { id: string; label: string; re: RegExp }[] = [
  { id: 'sobre', label: 'quem é (Sobre, Comece aqui)', re: /(sobre|quem|conhe[cç]a|comece|in[ií]cio|n[oó]s|equipe|hist[oó]ria|bastidor)/i },
  { id: 'oferta', label: 'o que vende (Serviços, Produtos, Cardápio)', re: /(servi[cç]|produt|card[aá]pio|menu|plano|pre[cç]o|loja|cat[aá]logo|tratament|procediment|curso|cole[cç][aã]o|novidade|lan[cç]amento)/i },
  { id: 'prova', label: 'prova (Clientes, Trabalhos, Avaliações)', re: /(cliente|depoiment|resultado|antes|case|portf[oó]lio|avalia|feedback|trabalho|obra|projeto|entregas)/i },
  { id: 'como', label: 'como comprar (Como funciona, Dúvidas, Contato)', re: /(como|processo|agend|funciona|passo|pedido|frete|entrega|d[uú]vida|faq|pergunta|contato|whats|endere|onde|local|hor[aá]rio)/i },
]

/** Até onde o nome de um destaque aparece inteiro embaixo do círculo. */
export const HIGHLIGHT_MAX = 15

function auditHighlights(highlights: string[] | null): Pillar {
  const findings: Finding[] = []
  if (highlights === null) {
    findings.push({ id: 'destaques-sem-dado', level: 'info', title: 'Destaques não informados', detail: 'A API da Meta não entrega os destaques do perfil.', action: 'Escreva os nomes dos destaques como aparecem no perfil (ou marque que não há nenhum).' })
    return { id: 'destaques', label: PILLAR_LABEL.destaques, score: null, findings }
  }
  const names = highlights.map((h) => h.trim()).filter(Boolean)
  if (!names.length) {
    findings.push({ id: 'destaques-nenhum', level: 'critico', title: 'Nenhum destaque no perfil', detail: 'Os destaques são a vitrine fixa de quem chega pela primeira vez: sem eles, só o último story conta quem você é.', action: 'Crie de 4 a 6 destaques: quem é, o que vende, prova e como comprar.' })
    return { id: 'destaques', label: PILLAR_LABEL.destaques, score: scoreOf(findings), findings }
  }
  const long = names.filter((n) => [...n].length > HIGHLIGHT_MAX)
  if (long.length) findings.push({ id: 'destaques-cortados', level: 'atencao', title: `${long.length === 1 ? 'Um nome é cortado' : `${long.length} nomes são cortados`} embaixo do círculo`, detail: long.map((n) => `“${n}”`).join(', '), action: `Use nomes de até ${HIGHLIGHT_MAX} letras, de uma ou duas palavras.` })
  if (names.length > 10) findings.push({ id: 'destaques-muitos', level: 'info', title: `${names.length} destaques`, detail: 'No celular aparecem uns 4 ou 5 sem arrastar: os primeiros são os que contam.', action: 'Deixe na frente os que ajudam a decidir e junte ou arquive o resto.' })
  const missing = HIGHLIGHT_GROUPS.filter((g) => !names.some((n) => g.re.test(n)))
  if (missing.length) {
    findings.push({
      id: 'destaques-faltam',
      level: missing.length >= 2 ? 'atencao' : 'info',
      title: missing.length === 1 ? 'Falta um destaque essencial' : `Faltam ${missing.length} destaques essenciais`,
      detail: `Pelos nomes, não há: ${missing.map((m) => m.label).join('; ')}.`,
      action: 'Quem chega quer saber, nesta ordem, quem é você, o que vende, se funciona e como comprar.',
    })
  }
  if (!findings.length) findings.push({ id: 'destaques-ok', level: 'ok', title: `${names.length} destaques cobrindo o essencial` })
  return { id: 'destaques', label: PILLAR_LABEL.destaques, score: scoreOf(findings), findings }
}

// ---------- bio, nome e foto ----------

function auditBio(p: AuditProfile): Pillar {
  const findings: Finding[] = []
  const bio = (p.biography ?? '').trim()
  const name = (p.name ?? '').trim()
  if (!bio) findings.push({ id: 'bio-vazia', level: 'critico', title: 'Bio vazia', detail: 'É a primeira coisa lida por quem visita o perfil.', action: 'Escreva em até 150 caracteres: o que faz, para quem, onde, e o que a pessoa deve fazer agora.' })
  else {
    const length = [...bio].length
    if (length < 50) findings.push({ id: 'bio-curta', level: 'atencao', title: `Bio curta (${length} caracteres)`, detail: 'Cabe até 150: sobra espaço para dizer o que você faz e para quem.', action: 'Uma linha com o que faz, uma com o diferencial ou a região, uma com a chamada.' })
    if (!CTA.test(bio)) findings.push({ id: 'bio-sem-chamada', level: 'atencao', title: 'Bio sem chamada para ação', detail: 'Nada diz o que fazer depois de ler (chamar no WhatsApp, agendar, tocar no link).', action: 'Termine a bio com o próximo passo, por exemplo “Agende pelo link 👇”.' })
    if (!PLACE.test(bio)) findings.push({ id: 'bio-sem-lugar', level: 'info', title: 'A bio não diz onde atende', action: 'Se atende numa região, diga qual (📍 Cidade/UF); se é online, diga que atende todo o Brasil.' })
    const tags = countMatches(bio, HASHTAG)
    if (tags > 2) findings.push({ id: 'bio-hashtags', level: 'info', title: `${tags} hashtags na bio`, detail: 'Hashtag na bio vira link para fora do seu perfil.', action: 'Deixe no máximo uma, a da marca.' })
    const emojis = countMatches(bio, EMOJI)
    if (emojis > 6) findings.push({ id: 'bio-emojis', level: 'info', title: `${emojis} emojis na bio`, action: 'Use emoji só para marcar linhas ou apontar o link: o texto lê melhor.' })
  }
  if (!name) findings.push({ id: 'nome-vazio', level: 'atencao', title: 'Campo Nome vazio', detail: 'O Nome entra na busca do Instagram, junto com o @.', action: 'Ponha a marca e o que faz, por exemplo “Marca · Sites para clínicas”.' })
  else if (!/[·|•\-–—,]/.test(name) && name.split(/\s+/).length <= 2) findings.push({ id: 'nome-so-marca', level: 'info', title: 'O Nome tem só a marca', detail: `“${name}”: quem busca pelo serviço não acha o perfil por ele.`, action: 'Junte uma palavra do que você faz (busca do Instagram lê o Nome).' })
  if (!p.website) findings.push({ id: 'sem-link', level: 'atencao', title: 'Sem link no perfil', detail: 'É o único link clicável fora dos stories.', action: 'Ponha o WhatsApp, a página de agendamento ou o site.' })
  else if (/(wa\.me|whatsapp|api\.whatsapp)/i.test(p.website)) findings.push({ id: 'link-whatsapp', level: 'ok', title: 'Link leva direto ao WhatsApp' })
  if (!findings.some((f) => f.level !== 'ok' && f.level !== 'info')) findings.unshift({ id: 'bio-ok', level: 'ok', title: 'Bio completa: diz o que faz, tem chamada e link' })
  // Sem bio, o resto da parte não salva a nota
  return { id: 'bio', label: PILLAR_LABEL.bio, score: bio ? scoreOf(findings) : Math.min(20, scoreOf(findings)), findings }
}

function auditPhoto(p: AuditProfile): Pillar {
  if (!p.picture) return { id: 'foto', label: PILLAR_LABEL.foto, score: 0, findings: [{ id: 'foto-vazia', level: 'critico', title: 'Perfil sem foto', action: 'Use o logo ou o rosto de quem atende, centralizado e legível num círculo pequeno.' }] }
  return { id: 'foto', label: PILLAR_LABEL.foto, score: null, findings: [{ id: 'foto-ok', level: 'info', title: 'Foto presente', detail: 'Se ela lê bem num círculo pequeno, a leitura da IA diz.' }] }
}

// ---------- posts ----------

const within = (media: IgMedia[], now: number, days: number) => media.filter((m) => now - m.postedAt <= days * DAY)

function auditRhythm(feed: IgMedia[], stories: IgMedia[], now: number): { pillar: Pillar; posts30: number; posts90: number; lastPostDays: number | null } {
  const findings: Finding[] = []
  const posts30 = within(feed, now, 30).length
  const posts90 = within(feed, now, 90).length
  const last = feed[0]?.postedAt
  const lastPostDays = last ? Math.floor((now - last) / DAY) : null
  if (!feed.length) {
    findings.push({ id: 'ritmo-sem-posts', level: 'critico', title: 'Nenhum post no feed', action: 'Comece com 3 posts fixados: quem é, o que vende, um trabalho feito.' })
    return { pillar: { id: 'ritmo', label: PILLAR_LABEL.ritmo, score: 0, findings }, posts30, posts90, lastPostDays }
  }
  if (posts30 === 0) findings.push({ id: 'ritmo-parado', level: 'critico', title: 'Nenhum post nos últimos 30 dias', detail: `O último foi há ${lastPostDays} dias. Perfil parado passa a impressão de negócio fechado.`, action: 'Volte com pelo menos 2 posts por semana, num dia fixo.' })
  else {
    const perWeek = posts30 / (30 / 7)
    if (posts30 < 4) findings.push({ id: 'ritmo-baixo', level: 'atencao', title: `${posts30} ${posts30 === 1 ? 'post' : 'posts'} em 30 dias`, detail: 'Menos de um por semana: o alcance de cada post não tem continuidade.', action: 'Mire em 2 ou 3 por semana, sempre nos mesmos dias.' })
    else findings.push({ id: 'ritmo-ok', level: 'ok', title: `${posts30} posts em 30 dias (${perWeek.toFixed(1).replace('.', ',')} por semana)` })
    if (lastPostDays !== null && lastPostDays > 7) findings.push({ id: 'ritmo-ultimo', level: 'atencao', title: `Último post há ${lastPostDays} dias`, action: 'Publique esta semana para não quebrar o ritmo.' })
  }
  // Maior intervalo sem post nos últimos 90 dias (contando até hoje)
  const recent = within(feed, now, 90).map((m) => m.postedAt).sort((a, b) => b - a)
  if (recent.length >= 1) {
    let gap = (now - recent[0]) / DAY
    for (let i = 1; i < recent.length; i++) gap = Math.max(gap, (recent[i - 1] - recent[i]) / DAY)
    if (gap > 21) findings.push({ id: 'ritmo-buraco', level: 'atencao', title: `Ficou ${Math.round(gap)} dias seguidos sem postar nos últimos 3 meses`, action: 'Deixe 2 ou 3 posts prontos de reserva para semanas cheias.' })
  }
  const st = within(stories, now, 30).length
  findings.push({ id: 'ritmo-stories', level: 'info', title: st ? `${st} stories guardados em 30 dias` : 'Nenhum story guardado em 30 dias', detail: 'A Meta só mostra os stories enquanto estão no ar: contam os que estavam no ar numa leitura, então o número real pode ser maior.' })
  return { pillar: { id: 'ritmo', label: PILLAR_LABEL.ritmo, score: scoreOf(findings), findings }, posts30, posts90, lastPostDays }
}

function auditFormats(feed: IgMedia[], now: number) {
  const findings: Finding[] = []
  const recent = within(feed, now, 90)
  const share: Record<string, number> = {}
  const reachBy: Record<string, number> = {}
  if (recent.length < 6) {
    findings.push({ id: 'formatos-pouco', level: 'info', title: 'Poucos posts para comparar formatos', detail: `${recent.length} nos últimos 90 dias; a comparação precisa de pelo menos 6.` })
    return { pillar: { id: 'formatos' as const, label: PILLAR_LABEL.formatos, score: null, findings }, share, reachBy, best: null as string | null }
  }
  const groups = new Map<string, IgMedia[]>()
  for (const m of recent) groups.set(formatOf(m), [...(groups.get(formatOf(m)) ?? []), m])
  for (const [f, list] of groups) {
    share[f] = list.length / recent.length
    const r = avg(list.map((m) => m.insights.reach).filter((v): v is number => typeof v === 'number'))
    if (r !== null && list.length >= 2) reachBy[f] = r
  }
  const ranked = Object.entries(reachBy).sort((a, b) => b[1] - a[1])
  const best = ranked[0]?.[0] ?? null
  if (groups.size === 1) findings.push({ id: 'formatos-um', level: 'atencao', title: `Só ${FORMAT_NAME[[...groups.keys()][0]] ?? [...groups.keys()][0]} nos últimos 90 dias`, action: 'Teste os outros formatos por um mês e compare o alcance aqui.' })
  if (!groups.has('reels')) findings.push({ id: 'formatos-sem-reels', level: 'atencao', title: 'Nenhum Reels nos últimos 90 dias', detail: 'Vídeo curto costuma ser o formato que mais chega a quem ainda não segue.', action: 'Grave um Reels por semana: bastidor, antes e depois, ou uma dúvida respondida em 20 segundos.' })
  if (!groups.has('carrossel')) findings.push({ id: 'formatos-sem-carrossel', level: 'info', title: 'Nenhum carrossel nos últimos 90 dias', detail: 'Carrossel é o que mais se salva: bom para explicar e ensinar.' })
  if (ranked.length >= 2 && best) {
    const [, top] = ranked[0]
    const [lowF, low] = ranked[ranked.length - 1]
    const ratio = low > 0 ? top / low : 0
    if (ratio >= 1.5 && share[best] < 0.35) findings.push({ id: 'formatos-melhor-pouco', level: 'atencao', title: `${FORMAT_NAME[best]} alcança ${times(ratio)} mais que ${FORMAT_NAME[lowF]}, mas é só ${pct(share[best])} dos posts`, action: `Faça mais ${FORMAT_NAME[best]}: pelo menos metade dos posts no próximo mês.` })
    else findings.push({ id: 'formatos-melhor', level: 'ok', title: `${FORMAT_NAME[best]} é o formato que mais alcança (${int(top)} em média)` })
  }
  return { pillar: { id: 'formatos' as const, label: PILLAR_LABEL.formatos, score: scoreOf(findings), findings }, share, reachBy, best }
}

function auditCaptions(feed: IgMedia[], now: number): Pillar {
  const findings: Finding[] = []
  const recent = within(feed, now, 90)
  if (recent.length < 4) return { id: 'legendas', label: PILLAR_LABEL.legendas, score: null, findings: [{ id: 'legendas-pouco', level: 'info', title: 'Poucos posts para ler as legendas' }] }
  const caps = recent.map((m) => (m.caption ?? '').trim())
  const empty = caps.filter((c) => c.length < 10).length / caps.length
  if (empty > 0.3) findings.push({ id: 'legendas-vazias', level: 'atencao', title: `${pct(empty)} dos posts quase sem legenda`, detail: 'A legenda é onde se explica e se chama para a ação.', action: 'Cada post com pelo menos uma frase de contexto e uma chamada.' })
  const withText = caps.filter((c) => c.length >= 10)
  if (withText.length) {
    const cta = withText.filter((c) => CTA.test(c)).length / withText.length
    if (cta < 0.3) findings.push({ id: 'legendas-sem-chamada', level: 'atencao', title: `Só ${pct(cta)} das legendas chamam para uma ação`, action: 'Feche as legendas com o próximo passo: “chame no Direct”, “salve para depois”, “agende pelo link”.' })
    const longFirst = withText.filter((c) => [...firstLine(c)].length > 125).length / withText.length
    if (longFirst > 0.5) findings.push({ id: 'legendas-primeira-linha', level: 'info', title: 'A primeira linha costuma ser longa', detail: 'O feed mostra só o começo antes do “mais”.', action: 'Comece com uma frase curta que dê vontade de abrir.' })
    const tags = avg(withText.map((c) => countMatches(c, HASHTAG))) ?? 0
    if (tags > 10) findings.push({ id: 'legendas-hashtags', level: 'atencao', title: `${Math.round(tags)} hashtags por post em média`, detail: 'Muitas hashtags deixam a legenda com cara de spam e pouco ajudam hoje.', action: 'Use de 3 a 5, específicas do assunto e da região.' })
    const size = median(withText.map((c) => [...c].length)) ?? 0
    if (!findings.length) findings.push({ id: 'legendas-ok', level: 'ok', title: `Legendas com chamada e contexto (${int(size)} caracteres no meio)` })
  }
  return { id: 'legendas', label: PILLAR_LABEL.legendas, score: scoreOf(findings), findings }
}

function auditPerformance(p: AuditProfile, feed: IgMedia[], now: number) {
  const findings: Finding[] = []
  const recent = within(feed, now, 90).filter((m) => typeof m.insights.reach === 'number' && m.insights.reach > 0)
  const medianReach = median(recent.map((m) => m.insights.reach!))
  const medianEngagement = median(recent.map((m) => interactionsOf(m) / m.insights.reach!))
  if (recent.length < 3) {
    findings.push({ id: 'desempenho-pouco', level: 'info', title: 'Poucos posts com números para avaliar', detail: 'A Meta guarda os números dos posts a partir da conexão com conta profissional.' })
    return { pillar: { id: 'desempenho' as const, label: PILLAR_LABEL.desempenho, score: null, findings }, medianReach, medianEngagement }
  }
  if (medianEngagement !== null) {
    if (medianEngagement < 0.01) findings.push({ id: 'desempenho-engajamento', level: 'critico', title: `Taxa de interação de ${pct(medianEngagement)} por alcance`, detail: 'Num post típico, menos de 1 em cada 100 pessoas que viram reagiu.', action: 'Puxe conversa: pergunte algo na legenda, responda todo comentário na primeira hora.' })
    else if (medianEngagement < 0.03) findings.push({ id: 'desempenho-engajamento', level: 'atencao', title: `Taxa de interação de ${(medianEngagement * 100).toFixed(1).replace('.', ',')}% por alcance`, detail: 'A referência usada aqui é 3% ou mais.', action: 'Mais posts que pedem resposta ou valem salvar (dicas, listas, antes e depois).' })
    else findings.push({ id: 'desempenho-engajamento', level: 'ok', title: `Taxa de interação de ${(medianEngagement * 100).toFixed(1).replace('.', ',')}% por alcance` })
  }
  if (medianReach !== null && p.followers && p.followers >= 100) {
    const ratio = medianReach / p.followers
    if (ratio < 0.1) findings.push({ id: 'desempenho-alcance', level: 'atencao', title: `Um post típico alcança ${pct(ratio)} dos seguidores`, detail: `${int(medianReach)} de ${int(p.followers)}.`, action: 'Teste outros formatos e horários; seguidores que não veem há meses podem ser contas paradas.' })
    else findings.push({ id: 'desempenho-alcance', level: 'ok', title: `Um post típico alcança ${int(medianReach)} pessoas (${pct(ratio)} dos seguidores)` })
  }
  const saves = recent.reduce((s, m) => s + (m.insights.saved ?? 0) + (m.insights.shares ?? 0), 0)
  const all = recent.reduce((s, m) => s + interactionsOf(m), 0)
  if (all > 0 && saves / all < 0.05) findings.push({ id: 'desempenho-salvos', level: 'info', title: `Salvamentos e compartilhamentos são ${pct(saves / all)} das interações`, detail: 'São os sinais de que o post tem valor além da curtida.', action: 'Inclua posts que valem guardar ou mandar para alguém.' })
  const t = p.totals?.['30']
  if (t?.reach && typeof t.reach_non_followers === 'number') {
    const share = t.reach_non_followers / t.reach
    if (share < 0.2) findings.push({ id: 'desempenho-novos', level: 'atencao', title: `Só ${pct(share)} do alcance de 30 dias foi de quem não segue`, detail: 'O perfil está falando quase só com quem já conhece.', action: 'Reels e colaborações (post em conjunto com parceiros) levam o perfil a gente nova.' })
    else findings.push({ id: 'desempenho-novos', level: 'ok', title: `${pct(share)} do alcance de 30 dias foi de quem não segue` })
  }
  if (t && typeof t.follows === 'number' && typeof t.unfollows === 'number' && t.unfollows > t.follows) findings.push({ id: 'desempenho-saldo', level: 'atencao', title: `Perdeu mais seguidores do que ganhou em 30 dias (${int(t.follows)} entraram, ${int(t.unfollows)} saíram)`, action: 'Veja nos posts da época o que destoou do que as pessoas seguiram para ver.' })
  return { pillar: { id: 'desempenho' as const, label: PILLAR_LABEL.desempenho, score: scoreOf(findings), findings }, medianReach, medianEngagement }
}

/** Dia da semana e hora em São Paulo. */
const spParts = (at: number) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(at))
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '')
  return { weekday: wd, hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0) }
}
const BANDS: { label: string; from: number; to: number }[] = [
  { label: 'de manhã (6h às 12h)', from: 6, to: 12 },
  { label: 'à tarde (12h às 18h)', from: 12, to: 18 },
  { label: 'à noite (18h à meia-noite)', from: 18, to: 24 },
  { label: 'de madrugada', from: 0, to: 6 },
]

function auditTimes(feed: IgMedia[], now: number) {
  const recent = within(feed, now, 180).filter((m) => typeof m.insights.reach === 'number')
  if (recent.length < 10) return { pillar: { id: 'horarios' as const, label: PILLAR_LABEL.horarios, score: null, findings: [{ id: 'horarios-pouco', level: 'info' as Level, title: 'Poucos posts para achar o melhor dia e horário', detail: 'Com 10 ou mais posts com números nos últimos 6 meses a comparação aparece.' }] }, bestWeekday: null, bestHour: null }
  const overall = avg(recent.map((m) => m.insights.reach!))!
  const by = <K>(key: (m: IgMedia) => K) => {
    const map = new Map<K, number[]>()
    for (const m of recent) map.set(key(m), [...(map.get(key(m)) ?? []), m.insights.reach!])
    return [...map].filter(([, v]) => v.length >= 2).map(([k, v]) => [k, avg(v)!, v.length] as const).sort((a, b) => b[1] - a[1])
  }
  const days = by((m) => spParts(m.postedAt).weekday)
  const bands = by((m) => BANDS.findIndex((b) => spParts(m.postedAt).hour >= b.from && spParts(m.postedAt).hour < b.to))
  const findings: Finding[] = []
  const bestWeekday = days[0] ? WEEKDAYS[days[0][0]] : null
  const bestHour = bands[0] ? BANDS[bands[0][0]].label : null
  if (days[0] && overall > 0) findings.push({ id: 'horarios-dia', level: 'info', title: `Posts de ${WEEKDAYS[days[0][0]]} alcançam ${times(days[0][1] / overall)} a média`, detail: `${days[0][2]} posts nesse dia. ${days.length > 1 ? `O mais fraco é ${WEEKDAYS[days[days.length - 1][0]]}.` : ''}`.trim(), action: 'Ponha os posts mais importantes nesse dia.' })
  if (bands[0] && overall > 0) findings.push({ id: 'horarios-hora', level: 'info', title: `Os posts ${BANDS[bands[0][0]].label} alcançam ${times(bands[0][1] / overall)} a média`, detail: `${bands[0][2]} posts nessa faixa.` })
  return { pillar: { id: 'horarios' as const, label: PILLAR_LABEL.horarios, score: null, findings }, bestWeekday, bestHour }
}

// ---------- tudo junto ----------

export function auditProfile(input: { profile: AuditProfile; media: IgMedia[]; highlights: string[] | null; now?: number }): Audit {
  const now = input.now ?? Date.now()
  const sorted = [...input.media].sort((a, b) => b.postedAt - a.postedAt)
  const feed = sorted.filter((m) => m.product !== 'STORY')
  const stories = sorted.filter((m) => m.product === 'STORY')
  const rhythm = auditRhythm(feed, stories, now)
  const formats = auditFormats(feed, now)
  const perf = auditPerformance(input.profile, feed, now)
  const tms = auditTimes(feed, now)
  const pillars: Pillar[] = [auditBio(input.profile), auditPhoto(input.profile), auditHighlights(input.highlights), rhythm.pillar, formats.pillar, auditCaptions(feed, now), perf.pillar, tms.pillar]
  const scored = pillars.filter((p) => p.score !== null && WEIGHT[p.id] > 0)
  const weight = scored.reduce((s, p) => s + WEIGHT[p.id], 0)
  const score = weight ? Math.round(scored.reduce((s, p) => s + p.score! * WEIGHT[p.id], 0) / weight) : 0
  return {
    version: 1,
    at: now,
    score,
    pillars,
    facts: {
      posts30: rhythm.posts30,
      posts90: rhythm.posts90,
      lastPostDays: rhythm.lastPostDays,
      medianReach: perf.medianReach,
      medianEngagement: perf.medianEngagement,
      bestFormat: formats.best,
      formatShare: formats.share,
      formatReach: formats.reachBy,
      bestWeekday: tms.bestWeekday,
      bestHour: tms.bestHour,
    },
  }
}

/** Nota em palavras, para o selo. */
export const scoreLabel = (score: number) => (score >= 80 ? 'Forte' : score >= 60 ? 'Bom, com ajustes' : score >= 40 ? 'Precisa de atenção' : 'Precisa de cuidado')
