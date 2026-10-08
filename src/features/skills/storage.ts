import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { MAX_SKILL_TEXT, type ChatSkill, type SkillDraft } from '@/features/space/chat/skills'

/**
 * As skills cadastradas na conta (`space_skills`): as globais da equipe e as
 * pessoais de quem está logado. O banco decide quem grava o quê: pessoal,
 * a própria pessoa; global, só admin.
 */

type Row = Database['public']['Tables']['space_skills']['Row']

export type SkillScope = 'global' | 'personal'

/** A migração ainda não foi aplicada no Supabase: a tela avisa e o chat fica só com as padrão. */
export class SkillsTableMissing extends Error {
  constructor() {
    super('A tabela das skills ainda não existe no banco.')
  }
}

const missingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? ''))

/** O erro do banco em português, com o caso de quem não pode mexer naquela skill. */
const failure = (error: { code?: string; message?: string }) => {
  if (missingTable(error)) return new SkillsTableMissing()
  if (error.code === 'PGRST116' || error.code === '42501' || /row-level security/i.test(error.message ?? '')) {
    return new Error('Você não pode mudar esta skill: as globais só admin muda.')
  }
  return new Error(error.message || 'O banco recusou a skill.')
}

const toSkill = (row: Row): ChatSkill => ({
  id: row.id,
  source: row.scope === 'global' ? 'global' : 'personal',
  name: row.name,
  hint: row.hint,
  instructions: row.instructions,
  starters: row.starters ?? [],
  needsImage: row.needs_image,
  updatedAt: Date.parse(row.updated_at),
  ownerId: row.owner_id,
})

const fields = (draft: SkillDraft, scope: SkillScope) => ({
  scope,
  name: draft.name.trim().slice(0, 60),
  hint: draft.hint.trim().slice(0, 200),
  instructions: draft.instructions.trim().slice(0, MAX_SKILL_TEXT),
  starters: draft.starters.map((s) => s.trim()).filter(Boolean).slice(0, 6),
  needs_image: draft.needsImage,
})

export async function listSkills(): Promise<ChatSkill[]> {
  const { data, error } = await supabase.from('space_skills').select('*').order('updated_at', { ascending: false })
  if (error) throw failure(error)
  return data.map(toSkill)
}

export async function createSkill(draft: SkillDraft, scope: SkillScope): Promise<ChatSkill> {
  const { data, error } = await supabase.from('space_skills').insert(fields(draft, scope)).select().single()
  if (error) throw failure(error)
  return toSkill(data)
}

export async function updateSkill(id: string, draft: SkillDraft, scope: SkillScope): Promise<ChatSkill> {
  const { data, error } = await supabase.from('space_skills').update(fields(draft, scope)).eq('id', id).select().single()
  if (error) throw failure(error)
  return toSkill(data)
}

export async function deleteSkill(id: string) {
  const { data, error } = await supabase.from('space_skills').delete().eq('id', id).select('id')
  if (error) throw failure(error)
  if (!data.length) throw new Error('Você não pode apagar esta skill: as globais só admin apaga.')
}
