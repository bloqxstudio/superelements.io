import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fileName, metaOf, titleOf, type Vault, type VaultNote } from './vault'

/**
 * O padrão de design da conta, guardado no Cérebro (2026-11-07, o usuário: "um padrão de design via
 * cérebro… reaproveitar o design.md… mais padrões de posts, poder marcar como padrão e apagar os demais,
 * pra não errar mais na criação de novos"):
 *   - `marca/DESIGN.md`: a marca da conta (cores, fontes, logo, regras), o mesmo texto de
 *     `crm_account_context.brand_md` que os Criativos usam para montar posts;
 *   - `marca/padroes/<nome>.md`: um padrão de post por nota (`**Status:** padrão|alternativo`,
 *     `**Formato:** 4x5`, a imagem de exemplo e `## Regras`). Um padrão por formato.
 * `standardBlock` vira texto para a IA em toda criação e edição de criativo (`criativos/ai.ts`).
 */

const db = supabase as unknown as SupabaseClient

export const DESIGN_PATH = 'marca/DESIGN.md'
export const PATTERN_DIR = 'marca/padroes'
export const isPatternPath = (p: string) => p.startsWith(PATTERN_DIR + '/') && p.endsWith('.md') && fileName(p) !== 'README.md'

export const FORMAT_LABEL: Record<string, string> = { '4x5': 'Feed 4:5', '1x1': 'Quadrado 1:1', '9x16': 'Story 9:16', '16x9': 'Paisagem 16:9', link: 'Link 1.91:1', '2x3': 'Vertical 2:3' }

export interface Pattern { path: string; name: string; isDefault: boolean; format: string; rules: string[]; example?: string }

const normFormat = (v?: string) => {
  const s = (v ?? '').toLowerCase().replace(/\s/g, '').replace(':', 'x')
  return Object.keys(FORMAT_LABEL).find((k) => s.includes(k)) ?? ''
}

export function parsePattern(note: Pick<VaultNote, 'path' | 'content'>): Pattern {
  const meta = metaOf(note as VaultNote)
  const rulesBlock = note.content.split(/^##\s+Regras\s*$/m)[1]?.split(/^##\s/m)[0] ?? ''
  const rules = rulesBlock.split('\n').map((l) => l.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim()).filter((x): x is string => !!x && x !== PLACEHOLDER)
  return {
    path: note.path,
    name: titleOf(note as VaultNote),
    isDefault: /padr[ãa]o/i.test(meta['status'] ?? '') && !/alternativ/i.test(meta['status'] ?? ''),
    format: normFormat(meta['formato']),
    rules,
    example: note.content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1],
  }
}

export const patternsOf = (vault: Vault): Pattern[] => vault.notes.filter((n) => isPatternPath(n.path)).map(parsePattern)

/** Troca a linha `**Status:**` (ou põe uma logo depois do título). */
export function withStatus(content: string, isDefault: boolean): string {
  const line = `**Status:** ${isDefault ? 'padrão' : 'alternativo'}`
  if (/^\*\*Status:\*\*.*$/m.test(content)) return content.replace(/^\*\*Status:\*\*.*$/m, line)
  return content.replace(/^(#\s+.+\n)/, `$1\n${line}\n`)
}

const PLACEHOLDER = 'Descreva o que se repete em todo post deste padrão: grade, títulos, fotos, cores, ritmo dos slides.'

/** O post de onde o padrão saiu (a linha `**Exemplo:**`). */
export const sourceHref = (content: string) => content.match(/^\*\*Exemplo:\*\*\s*\[[^\]]*\]\(([^)\s]+)\)/m)?.[1]

/** Troca as seções `## Regras` e `## Quando usar` da nota, mantendo o resto. */
export function withRules(content: string, rules: string[], when: string[]): string {
  const section = (title: string, items: string[]) => `## ${title}\n\n${(items.length ? items : ['']).map((r) => `- ${r}`.trimEnd()).join('\n')}\n`
  const strip = (c: string, title: string) => c.replace(new RegExp(`^##\\s+${title}\\s*$[\\s\\S]*?(?=^##\\s|(?![\\s\\S]))`, 'm'), '')
  const base = strip(strip(content, 'Regras'), 'Quando usar').trimEnd()
  return `${base}\n\n${section('Regras', rules)}\n${section('Quando usar', when)}`
}

/** O modelo de uma nota de padrão. */
export function patternNote(o: { name: string; format: string; isDefault: boolean; rules: string[]; when?: string[]; example?: string; source?: { label: string; href: string } }): string {
  return `# ${o.name}

**Status:** ${o.isDefault ? 'padrão' : 'alternativo'}
**Formato:** ${o.format || '4x5'}
${o.source ? `**Exemplo:** [${o.source.label}](${o.source.href})\n` : ''}
${o.example ? `![${o.name}](${o.example})\n` : ''}
## Regras

${(o.rules.length ? o.rules : [PLACEHOLDER]).map((r) => `- ${r}`).join('\n')}

## Quando usar

${(o.when?.length ? o.when : ['']).map((r) => `- ${r}`.trimEnd()).join('\n')}
`
}

// ———————————————————————————————————— leitura para a criação de criativos

let cache: { team: string; at: number; brand: string; patterns: Pattern[] } | null = null
export const forgetStandard = () => { cache = null }

export async function loadStandard(teamId: string): Promise<{ brand: string; patterns: Pattern[] }> {
  if (cache && cache.team === teamId && Date.now() - cache.at < 60_000) return cache
  const [ctx, notes] = await Promise.all([
    db.from('crm_account_context').select('brand_md').eq('team_id', teamId).maybeSingle()
      .then(({ data }) => ((data as { brand_md?: string } | null)?.brand_md ?? '').trim(), () => ''),
    db.from('crm_knowledge_notes').select('path, content').eq('team_id', teamId).like('path', `${PATTERN_DIR}/%`)
      .then(({ data }) => (data ?? []) as { path: string; content: string }[], () => []),
  ])
  cache = { team: teamId, at: Date.now(), brand: ctx, patterns: notes.filter((n) => isPatternPath(n.path)).map(parsePattern) }
  return cache
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

/**
 * O padrão da conta como instrução para a IA: os padrões marcados (o do formato pedido primeiro) e as
 * regras escritas do DESIGN.md. Cores, fontes e logo já vão pela marca do conjunto.
 */
export async function standardBlock(teamId: string | undefined, format?: string): Promise<string> {
  if (!teamId) return ''
  try {
    const { brand, patterns } = await loadStandard(teamId)
    const defaults = patterns.filter((p) => p.isDefault && p.rules.length)
    const chosen = format ? defaults.filter((p) => !p.format || p.format === format) : defaults
    const list = (chosen.length ? chosen : defaults).slice(0, 3)
    // Do DESIGN.md só entram as seções sobre posts e voz (o resto costuma ser do site)
    const body = brand.replace(/^---\n[\s\S]*?\n---\n?/, '').split(/^(?=##\s)/m)
      .filter((sec) => /^##\s+.*(post|criativ|social|instagram|conte[úu]do|voz|tom|feed|stor)/im.test(sec)).join('\n').trim()
    const parts: string[] = []
    if (list.length) {
      parts.push(`Padrão de post da conta (marcado no Cérebro; siga sempre, a menos que o pedido diga o contrário):\n${list.map((p) => `${p.name}${p.format ? ` (${FORMAT_LABEL[p.format] ?? p.format})` : ''}:\n${p.rules.map((r) => `- ${r}`).join('\n')}`).join('\n\n')}`)
    }
    if (body) parts.push(`Regras de posts da marca (DESIGN.md do Cérebro):\n${clip(body, 2500)}`)
    return parts.join('\n\n')
  } catch {
    return ''
  }
}

export async function saveBrand(teamId: string, md: string): Promise<void> {
  const { error } = await db.rpc('crm_brand_save', { p_team: teamId, p_md: md })
  if (error) throw new Error(/42501|gestor/i.test(error.message) ? 'Só gestor da conta grava a marca.' : error.message)
  forgetStandard()
}
