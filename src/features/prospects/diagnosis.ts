import { nicheFor } from './niches.ts'
import { CURRENT, older, PHP_SUPPORTED, PLATFORM_LABEL, RECENT, scoreLead } from './score.ts'
import type { Business, Lead, SiteDiagnosis, SiteScan } from './types.ts'

/**
 * Diagnóstico de um site (`/crm/diagnostico`): a leitura do site
 * (`supabase/functions/_shared/siteScan.ts`) em pontos que quem vende lê de
 * relance, e a empresa montada para entrar no funil com a oferta de
 * atualização (`draftOffer`). Também vale para o motor (`leadFromSite`):
 * imports relativos com `.ts` e sintaxe que o Node apaga.
 */

const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/** O nome da empresa pelo título da página, sem o slogan ("Fulano Advogados – Direito de Família"). */
const nameFromTitle = (title?: string) =>
  title
    ?.replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .split(/\s[–—|-]\s/)[0]
    ?.trim() || undefined

/** A empresa de um site lido fora das buscas (id `site:<domínio>`, o mesmo do terminal), com a nota. */
export const leadFromScan = (scan: SiteScan, meta: { url: string; niche?: string; name?: string; region?: string }): Lead => {
  const host = hostOf(scan.url) || hostOf(meta.url)
  const business: Business = {
    id: `site:${host}`,
    source: 'manual',
    name: meta.name?.trim() || nameFromTitle(scan.title) || host,
    niche: meta.niche?.trim() ? nicheFor(meta.niche.trim()).label : '',
    city: meta.region?.split(',')[0]?.trim() || undefined,
    phone: scan.phones[0],
    email: scan.emails[0],
    website: meta.url,
  }
  const base = { ...business, domain: host || undefined, scan }
  return { ...base, ...scoreLead(base) }
}

/** `ok`: está bem; `atencao`: um ponto para a atualização resolver; `info`: só o fato. */
export type Tone = 'ok' | 'atencao' | 'info'

export interface DiagnosisItem {
  id: string
  label: string
  value: string
  tone: Tone
  hint?: string
}

export interface DiagnosisGroup {
  title: string
  items: DiagnosisItem[]
  /** Só para quem vende e faz: não entra nos pontos a melhorar nem na conversa com o dono. */
  team?: boolean
}

/** O slogan que o WordPress põe na instalação, em inglês e em português. */
const DEFAULT_TAGLINE = /^(just another wordpress site|my wordpress blog|apenas mais um site wordpress|mais um site wordpress|só mais um site wordpress)$/i

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const count = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`
const version = (text: string) => text.split('.').map(Number)

/** A versão e o tom: desatualizada pela régua do `score.ts`, ou só atrás da atual. */
const versionItem = (id: string, label: string, value: string | undefined, recent: number[], current: string): DiagnosisItem => {
  if (!value) return { id, label, value: 'versão escondida', tone: 'info', hint: 'O site não mostra a versão (comum com plugin de segurança ou cache).' }
  if (older(value, recent)) return { id, label, value, tone: 'atencao', hint: `Desatualizado: a atual é a ${current}.` }
  return { id, label, value, tone: 'ok', hint: older(value, version(current)) ? `A atual é a ${current}.` : undefined }
}

/**
 * Os pontos do diagnóstico. Os dois primeiros grupos falam do que o dono
 * sente (quem chega acha como chamar? o Google mostra a empresa direito?); o
 * técnico (versões, PHP, tema, plugins) fica em "Para a equipe": serve para
 * estimar a troca e não entra na conversa nem nos pontos a melhorar.
 */
export const diagnosisGroups = (d: SiteDiagnosis, now = new Date()): DiagnosisGroup[] => {
  const { scan, checks, wordpress } = d
  const opened = Boolean(scan.status && scan.status < 400)
  const onWordPress = scan.platform === 'wp-elementor' || scan.platform === 'wordpress'

  const contact: DiagnosisItem[] = []
  if (opened) {
    contact.push(
      scan.whatsapp
        ? { id: 'whatsapp', label: 'WhatsApp na página', value: scan.whatsapp, tone: 'ok' }
        : { id: 'whatsapp', label: 'WhatsApp na página', value: 'não tem', tone: 'atencao', hint: 'Quem chega pelo celular não fala com a empresa com um toque.' }
    )
    contact.push({ id: 'mobile', label: 'Celular', value: scan.viewport ? 'se adapta' : 'não se adapta', tone: scan.viewport ? 'ok' : 'atencao', hint: scan.viewport ? undefined : 'A página abre em miniatura no celular, de onde chega quase todo mundo.' })
    contact.push({ id: 'speed', label: 'Começa a abrir em', value: seconds(scan.ms), tone: scan.ms > 4000 ? 'atencao' : 'ok', hint: scan.ms > 4000 ? 'Mais de 4 s só para a página começar a chegar, antes das imagens.' : undefined })
    contact.push({
      id: 'https',
      label: 'Cadeado no navegador',
      value: scan.https ? 'sim' : 'não',
      tone: scan.https ? 'ok' : 'atencao',
      hint: scan.https ? undefined : scan.error?.startsWith('certificado') ? 'Certificado inválido: o navegador avisa antes de abrir.' : 'O navegador mostra "não seguro".',
    })
    contact.push(
      scan.ads?.length
        ? { id: 'ads', label: 'Anúncios', value: scan.ads.join(', '), tone: 'info', hint: 'Paga para trazer gente a esta página. A tag está no site; se o anúncio está no ar, confira nas bibliotecas de anúncios.' }
        : { id: 'ads', label: 'Anúncios', value: 'nenhum rastro na página', tone: 'info' }
    )
    if (scan.sales?.length) contact.push({ id: 'sales', label: 'Vende pelo site', value: scan.sales.join(', '), tone: 'info' })
    if (scan.phones.length) contact.push({ id: 'phone', label: 'Telefone', value: scan.phones.join(' · '), tone: 'info' })
    if (scan.emails.length) contact.push({ id: 'email', label: 'E-mail', value: scan.emails.slice(0, 2).join(' · '), tone: 'info' })
    if (scan.instagram) contact.push({ id: 'instagram', label: 'Instagram', value: scan.instagram, tone: 'info' })
  } else if (scan.error) {
    contact.push({ id: 'error', label: 'Ao abrir', value: scan.error, tone: 'atencao' })
  }

  const google: DiagnosisItem[] = []
  if (checks) {
    google.push({
      id: 'description',
      label: 'Descrição no Google',
      value: checks.description ? 'tem' : 'não tem',
      tone: checks.description ? 'ok' : 'atencao',
      hint: checks.description ? `"${checks.description.slice(0, 160)}${checks.description.length > 160 ? '…' : ''}"` : 'Sem ela, o Google mostra um trecho qualquer da página.',
    })
    google.push({
      id: 'h1',
      label: 'Título principal',
      value: checks.h1 === 0 ? 'nenhum' : String(checks.h1),
      tone: checks.h1 === 0 ? 'atencao' : checks.h1 === 1 ? 'ok' : 'info',
      hint: checks.h1 === 0 ? 'A página não diz, em destaque, qual é o assunto (o H1).' : checks.h1 > 1 ? 'Mais de um título principal (H1): o ideal é um.' : undefined,
    })
    if (wordpress?.tagline && DEFAULT_TAGLINE.test(wordpress.tagline)) {
      google.push({ id: 'tagline', label: 'Slogan do site', value: `o da instalação ("${wordpress.tagline}")`, tone: 'atencao', hint: 'Ficou o texto padrão do WordPress, que pode aparecer no Google e ao compartilhar.' })
    }
    google.push({ id: 'share', label: 'Foto ao compartilhar', value: checks.shareImage ? 'tem' : 'não tem', tone: checks.shareImage ? 'ok' : 'atencao', hint: checks.shareImage ? undefined : 'O link vai sem foto no WhatsApp e nas redes.' })
    google.push({ id: 'favicon', label: 'Ícone da aba', value: checks.favicon ? 'tem' : 'não tem', tone: checks.favicon ? 'ok' : 'atencao' })
    if (scan.copyrightYear) {
      const old = scan.copyrightYear <= now.getFullYear() - 2
      google.push({ id: 'year', label: 'Ano no rodapé', value: String(scan.copyrightYear), tone: old ? 'atencao' : 'ok', hint: old ? 'Passa a impressão de site parado.' : undefined })
    }
    if (checks.images) {
      const many = checks.imagesWithoutAlt > checks.images / 2
      google.push({
        id: 'alt',
        label: 'Imagens sem descrição',
        value: `${checks.imagesWithoutAlt} de ${checks.images}`,
        tone: checks.imagesWithoutAlt === 0 ? 'ok' : many ? 'atencao' : 'info',
        hint: checks.imagesWithoutAlt ? 'O texto alternativo serve a leitores de tela e ao Google Imagens.' : undefined,
      })
    }
  }

  const team: DiagnosisItem[] = [
    { id: 'platform', label: 'Plataforma', value: `${PLATFORM_LABEL[scan.platform]}${scan.builder && scan.platform !== 'wp-elementor' ? ` · ${scan.builder}` : ''}`, tone: 'info' },
  ]
  if (onWordPress) team.push(versionItem('wp', 'WordPress', scan.wpVersion, RECENT.wordpress, CURRENT.wordpress))
  if (scan.platform === 'wp-elementor') team.push(versionItem('elementor', scan.elementorPro ? 'Elementor (com o Pro)' : 'Elementor', scan.elementorVersion, RECENT.elementor, CURRENT.elementor))
  else if (scan.platform === 'wordpress') team.push({ id: 'builder', label: 'Construtor', value: scan.builder ?? 'não identificado', tone: 'info', hint: 'A versão nova entra no mesmo WordPress, em Elementor.' })
  if (scan.theme) team.push({ id: 'theme', label: 'Tema', value: scan.theme, tone: 'info' })
  if (checks?.php) {
    const old = older(checks.php, PHP_SUPPORTED)
    team.push({ id: 'php', label: 'PHP do servidor', value: checks.php, tone: old ? 'atencao' : 'ok', hint: old ? 'Sem correção de segurança: pedir à hospedagem para atualizar na troca.' : undefined })
  }
  if (wordpress?.pages !== undefined || wordpress?.posts !== undefined) {
    const parts = [wordpress.pages !== undefined ? count(wordpress.pages, 'página', 'páginas') : '', wordpress.posts !== undefined ? count(wordpress.posts, 'post', 'posts') : ''].filter(Boolean)
    team.push({ id: 'content', label: 'Conteúdo publicado', value: parts.join(' · '), tone: 'info', hint: 'Contado pela API pública do WordPress: dá o tamanho do trabalho.' })
  } else if (onWordPress && opened && wordpress && !wordpress.api) {
    team.push({ id: 'content', label: 'Conteúdo publicado', value: 'a API está fechada', tone: 'info', hint: 'O número de páginas fica para conferir com o cliente.' })
  }
  if (scan.agency) team.push({ id: 'agency', label: 'Quem fez o site', value: scan.agency.name, tone: 'info', hint: 'Abordar sem tirar a agência: é uma versão nova da página.' })

  return [
    { title: 'O caminho até o contato', items: contact },
    { title: 'O que o Google mostra', items: google },
    { title: 'Para a equipe', items: team, team: true },
  ].filter((group) => group.items.length)
}

/** Os pontos a melhorar que valem para o dono (o grupo da equipe não conta). */
export const attentionOf = (groups: DiagnosisGroup[]) => groups.filter((g) => !g.team).flatMap((g) => g.items).filter((item) => item.tone === 'atencao')

/** O que o diagnóstico diz sobre a oferta: atualização no mesmo WordPress, site novo ou conferir à mão. */
export const verdictOf = (d: SiteDiagnosis): { fit: 'atualizacao' | 'site-novo' | 'conferir'; title: string; text: string } => {
  const { scan } = d
  switch (scan.platform) {
    case 'wp-elementor':
      return {
        fit: 'atualizacao',
        title: `WordPress com Elementor${scan.elementorPro ? ' Pro' : ''}`,
        text: 'A página nova entra no mesmo WordPress e no mesmo endereço, sem trocar de sistema nem mexer no anúncio.',
      }
    case 'wordpress':
      return {
        fit: 'atualizacao',
        title: `WordPress${scan.builder ? ` com ${scan.builder}` : ''}, sem Elementor`,
        text: 'A versão nova entra no mesmo WordPress e no mesmo endereço, montada em Elementor.',
      }
    case 'construtor':
      return { fit: 'site-novo', title: `Site no ${scan.builder ?? 'construtor'}`, text: `Não é WordPress: a oferta é um site novo em WordPress no lugar do ${scan.builder ?? 'construtor'}.` }
    case 'outro':
      return { fit: 'site-novo', title: `Site próprio${scan.builder ? ` em ${scan.builder}` : ''}, fora do WordPress`, text: 'Não é WordPress: a oferta é um site novo em WordPress.' }
    case 'sem-site':
      return { fit: 'site-novo', title: scan.builder ? `Sem site próprio, só ${scan.builder}` : 'Sem site próprio', text: 'A oferta é um site novo em WordPress.' }
    case 'fora-do-ar':
      return { fit: 'conferir', title: 'O site está fora do ar', text: `${scan.error ? `${scan.error.charAt(0).toUpperCase()}${scan.error.slice(1)}. ` : ''}Confira o endereço; se estiver mesmo fora, a oferta é um site novo.` }
    default:
      return { fit: 'conferir', title: 'O site bloqueou a leitura', text: `${scan.error ? `${scan.error.charAt(0).toUpperCase()}${scan.error.slice(1)}. ` : ''}Abra o site no navegador para conferir a plataforma.` }
  }
}

/** O diagnóstico em texto, para colar numa nota ou mandar para alguém da equipe. */
export const diagnosisText = (d: SiteDiagnosis, name: string) => {
  const verdict = verdictOf(d)
  const groups = diagnosisGroups(d)
  const plugins = d.plugins.length ? `\n\nPlugins à vista: ${d.plugins.join(', ')}` : ''
  return [
    `Diagnóstico de ${name} (${d.scan.url})`,
    `${verdict.title}. ${verdict.text}`,
    ...groups.map((g) => `${g.title}\n${g.items.map((i) => `- ${i.label}: ${i.value}${i.tone === 'atencao' ? ' (melhorar)' : ''}${i.hint ? `. ${i.hint}` : ''}`).join('\n')}`),
  ].join('\n\n') + plugins
}
