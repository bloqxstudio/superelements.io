import { parseSkillMarkdown, skillMarkdown, type ChatSkill, type SkillDraft } from '@/features/space/chat/skills'

/** Quem muda uma skill: a sua, sempre; a da equipe, só admin; a padrão, ninguém (duplica). */
export const canEditSkill = (skill: ChatSkill, isAdmin: boolean) => skill.source === 'personal' || (skill.source === 'global' && isAdmin)

/** Baixa a skill como SKILL.md, o formato das skills do Claude Code. */
export function downloadSkill(skill: Pick<ChatSkill, 'name' | 'hint' | 'instructions'>) {
  const url = URL.createObjectURL(new Blob([skillMarkdown(skill)], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'SKILL.md'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lê um arquivo .md escolhido e devolve os campos da skill. */
export async function readSkillFile(file: File): Promise<SkillDraft> {
  if (file.size > 400_000) throw new Error('O arquivo é grande demais para uma skill.')
  const draft = parseSkillMarkdown(await file.text())
  if (!draft.instructions.trim()) throw new Error('O arquivo não tem texto de instruções.')
  return draft
}
