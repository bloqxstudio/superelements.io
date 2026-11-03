import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCrm } from '@/features/crm/crmStore'
import { loadProjectDoc } from '@/features/projects/storage'
import { parseDesignMd } from '@/features/space/brand/designMd'
import { setBrandFrom } from '@/features/criativos/brand'
import { generatePosts } from '@/features/criativos/ai'
import { useCreativeLink } from '@/features/criativos/link'
import { listSets, loadSet } from '@/features/criativos/storage'
import { buildPost } from '@/features/criativos/templates'
import type { FormatKey, SlideSpec } from '@/features/criativos/plan'
import type { Post, SetBrand } from '@/features/criativos/types'
import { scriptParagraphs, type AccountContext, type Content } from './rules'

/**
 * O carrossel de um conteúdo: o roteiro vira uma sequência de slides (capa, um slide por ideia e
 * fechamento), na marca da conta. Com a IA conectada ela escolhe os modelos e enxuga os textos;
 * sem ela (ou se falhar) o roteiro é fatiado por regra, sempre com o texto do roteiro, sem inventar.
 */

const MAX_CONTENT_SLIDES = 8
const TITLE_MAX = 90
const BODY_MAX = 220

const clip = (text: string, max: number) => {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).replace(/[,;:\s]+$/, '')}…`
}

/** Destaque em serifa na última palavra com mais de 3 letras (uma palavra por título). */
const emphasize = (title: string) => {
  const words = title.split(' ')
  for (let i = words.length - 1; i >= 0; i--) {
    const bare = words[i].replace(/[?!.,;:…]+$/, '')
    if (bare.length > 3 && !bare.includes('*')) {
      words[i] = `*${bare}*${words[i].slice(bare.length)}`
      return words.join(' ')
    }
  }
  return title
}

const bulletOf = (line: string) => line.replace(/^\s*(?:[-–—•*]|\d+[.)])\s+/, '').trim()
const isBullet = (line: string) => /^\s*(?:[-–—•*]|\d+[.)])\s+\S/.test(line)

/** Primeira frase e o resto de um parágrafo. */
const splitSentence = (text: string): [string, string] => {
  const m = text.match(/^(.+?[.!?])(\s+|$)([\s\S]*)$/)
  const [first, rest] = m ? [m[1], m[3].trim()] : [text, '']
  if (first.length <= TITLE_MAX) return [first, rest]
  // Frase longa: o título vai até a vírgula mais próxima e o resto segue no corpo
  const comma = first.slice(0, TITLE_MAX).lastIndexOf(', ')
  return comma >= 25 ? [first.slice(0, comma).replace(/[,;:]+$/, ''), `${first.slice(comma + 2)} ${rest}`.trim()] : [first, rest]
}

export function slidesFromScript(content: Pick<Content, 'title' | 'goal' | 'script'>, brand: Pick<SetBrand, 'name'>): SlideSpec[] {
  const paragraphs = scriptParagraphs(content.script)
  const slides: SlideSpec[] = [{ template: 'manifesto', label: brand.name, title: emphasize(clip(content.title, TITLE_MAX)), body: clip(content.goal, BODY_MAX) || undefined, dark: true }]
  // O roteiro que repete o título na primeira linha não gera uma segunda capa
  const rest = paragraphs.filter((p, i) => !(i === 0 && p.replace(/\W+/g, '').toLowerCase() === content.title.replace(/\W+/g, '').toLowerCase()))
  // Passou do limite: junta os parágrafos finais no último slide
  const picked = rest.length > MAX_CONTENT_SLIDES ? [...rest.slice(0, MAX_CONTENT_SLIDES - 1), rest.slice(MAX_CONTENT_SLIDES - 1).join(' ')] : rest
  picked.forEach((p, i) => {
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean)
    const bullets = lines.filter(isBullet)
    const dark = i % 2 === 1
    const label = `${String(i + 1).padStart(2, '0')} / ${String(picked.length).padStart(2, '0')}`
    if (bullets.length >= 2 && bullets.length >= lines.length - 1) {
      const head = lines.filter((l) => !isBullet(l))[0]
      slides.push({ template: 'lista', label, title: emphasize(clip(head ?? content.title, TITLE_MAX)), items: bullets.slice(0, 4).map((b) => clip(bulletOf(b), 70)), dark })
      return
    }
    const flat = lines.join(' ')
    const [first, remainder] = splitSentence(flat)
    slides.push({ template: 'manifesto', label, title: emphasize(clip(first, TITLE_MAX)), body: clip(remainder, BODY_MAX) || undefined, dark })
  })
  slides.push({ template: 'cta', label: brand.name, title: emphasize('Vamos conversar sobre isso?'), cta: 'Fale com a gente', body: brand.name, dark: true })
  return slides
}

/**
 * A marca da conta quando o conteúdo não tem projeto. Primeiro o DESIGN.md de um projeto da
 * própria conta (a fonte da identidade); depois o conjunto mais recente da conta que já tem cores
 * ou logo. Nunca a marca de outra conta: sem nada disso, o chamador fica com a neutra.
 */
export async function accountBrand(): Promise<SetBrand | undefined> {
  const team = useCrm.getState().team
  // Conta de cliente: os projetos dela (a conta da casa guarda os projetos sem conta, de todos os clientes)
  if (team && !team.isHome) {
    try {
      const { data } = await supabase.from('space_projects').select('id, name').eq('team_id', team.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(3)
      for (const project of data ?? []) {
        const source = (await loadProjectDoc(project.id))?.doc?.brand?.source
        const parsed = source?.trim() ? parseDesignMd(source).brand : null
        if (parsed && (parsed.colors.length || parsed.logo)) return setBrandFrom(parsed, project.name)
      }
    } catch {
      // Sem acesso aos projetos: segue para a marca da conta
    }
    // Conta sem projeto (Sinfy): o DESIGN.md guardado na conta (`crm_account_context.brand_md`)
    try {
      const { data } = await (supabase as unknown as SupabaseClient).from('crm_account_context').select('brand_md').eq('team_id', team.id).maybeSingle()
      const source = (data as { brand_md?: string } | null)?.brand_md
      const parsed = source?.trim() ? parseDesignMd(source).brand : null
      if (parsed && (parsed.colors.length || parsed.logo)) return setBrandFrom(parsed, team.name)
    } catch {
      // Coluna ausente (migração não aplicada): segue para os conjuntos
    }
  }
  try {
    for (const summary of (await listSets()).slice(0, 8)) {
      if (!summary.colors.length) continue
      const set = await loadSet(summary.id, summary.projectId)
      if (set && (set.brand.colors.length || set.brand.logoOnDark || set.brand.logoOnLight)) return set.brand
    }
  } catch {
    // Sem acesso à pasta: segue com a marca neutra
  }
  return undefined
}

const AI_TIMEOUT = 120_000

/** O carrossel pela IA; `undefined` quando ela não está conectada ou não respondeu a tempo. */
export async function aiCarousel(content: Content, ctx: AccountContext | null, brand: SetBrand, format: FormatKey, brief: string, withPhotos = false): Promise<Post | undefined> {
  const link = useCreativeLink.getState()
  if (!link.connected || !link.ia) return undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT)
  const id = toast.loading('Montando o carrossel com a IA…')
  try {
    const posts = await generatePosts(
      {
        brief,
        script: content.script,
        company: { name: brand.name, offer: ctx?.offer ?? '', audience: ctx?.audience ?? '', tone: ctx?.tone ?? '', restrictions: ctx?.restrictions ?? '' },
        format,
        slides: Math.min(8, Math.max(4, scriptParagraphs(content.script).length + 2)),
        posts: 1,
        cases: [],
        photos: withPhotos,
      },
      brand,
      controller.signal
    )
    return posts[0] && posts[0].slides.length >= 2 ? posts[0] : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
    toast.dismiss(id)
  }
}

export const carouselPost = (content: Content, brand: SetBrand, format: FormatKey, caption?: string, withPhotos = false): Post => {
  const slides = slidesFromScript(content, brand)
  // Sem a IA para escrever a cena, a capa vira foto pedida pelo próprio título
  if (withPhotos) slides[0] = { ...slides[0], template: 'foto-manchete', prompt: `Editorial photograph that illustrates the idea: "${content.title}". Real workplace or object, natural light, no people's faces.` }
  return buildPost({ name: content.title, format, caption, slides }, brand)
}
