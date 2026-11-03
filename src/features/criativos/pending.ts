import { useCrm } from '@/features/crm/crmStore'
import { loadProjectDoc } from '@/features/projects/storage'
import { parseDesignMd } from '@/features/space/brand/designMd'
import { linkContent } from '@/features/conteudos/api'
import { accountBrand } from '@/features/conteudos/carousel'
import { hashOf } from '@/features/conteudos/rules'
import { setBrandFrom } from './brand'
import { EMPHASIS_FONT, loadFont } from './render'
import { saveSet } from './storage'
import { buildPost } from './templates'
import type { CreativeSet, SetBrand } from './types'

/**
 * Criativos pedidos por uma IA de fora (o MCP da Sinfy, `supabase/functions/sinfy-mcp`): a função
 * grava o conjunto com o roteiro de cada post em `pending` (modelo e textos de cada slide), sem
 * desenhar nada, porque medir texto e caber na marca precisa do canvas do navegador. Ao abrir, o
 * Criativos monta os posts aqui, na marca da conta (DESIGN.md do projeto; senão o conjunto mais
 * recente da conta; senão neutra com o nome da conta), grava e liga ao conteúdo do Plano.
 */

export const hasPending = (set: CreativeSet) => !!set.pending?.length

async function resolveBrand(set: CreativeSet): Promise<SetBrand> {
  const fallback = set.projectName ?? useCrm.getState().team?.name ?? set.brand.name ?? 'Marca'
  if (set.projectId) {
    try {
      const source = (await loadProjectDoc(set.projectId))?.doc?.brand?.source
      const parsed = source?.trim() ? parseDesignMd(source).brand : null
      if (parsed && (parsed.colors.length || parsed.logo)) return setBrandFrom(parsed, set.projectName ?? fallback)
    } catch {
      // Projeto sem acesso: segue para a marca da conta
    }
  }
  return (await accountBrand()) ?? setBrandFrom(null, fallback)
}

export async function materializePending(set: CreativeSet): Promise<CreativeSet> {
  if (!set.pending?.length) return set
  const brand = set.pendingBrand ? await resolveBrand(set) : set.brand
  // A medida dos textos depende da fonte carregada
  await Promise.all([brand.headingFont, brand.bodyFont, brand.emphasisFont ?? EMPHASIS_FONT].map((f) => loadFont(f).catch(() => undefined)))
  const posts = set.pending.map((plan) => buildPost({ name: plan.name, format: plan.format, caption: plan.caption, slides: plan.slides }, brand))
  const { pending: _pending, pendingBrand: _flag, ...rest } = set
  const next: CreativeSet = { ...rest, brand, posts: [...set.posts, ...posts], updatedAt: Date.now() }
  await saveSet(next)
  if (next.source?.contentId) {
    try {
      await linkContent(next.source.contentId, 'criativos', next.id, next.shared ? next.projectId : undefined, await hashOf({ posts: next.posts }))
    } catch {
      // O vínculo é um aviso de mudança; o conjunto já está salvo
    }
  }
  return next
}
