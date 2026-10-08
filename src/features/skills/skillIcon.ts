import type React from 'react'
import { Accessibility, BookMarked, Globe, Images, Palette, Smartphone, Target, Type, Users } from 'lucide-react'
import type { ChatSkill, ChatSkillId } from '@/features/space/chat/skills'

type Icon = React.ComponentType<{ className?: string }>

const BUILTIN: Record<ChatSkillId, Icon> = {
  designer: Palette,
  copy: Type,
  seo: Globe,
  conversao: Target,
  celular: Smartphone,
  acessibilidade: Accessibility,
  referencia: Images,
}

/** O ícone da padrão; as cadastradas: livro (sua) ou pessoas (da equipe). */
export const skillIcon = (skill: Pick<ChatSkill, 'id' | 'source'>): Icon =>
  BUILTIN[skill.id as ChatSkillId] ?? (skill.source === 'global' ? Users : BookMarked)

/** O que diz de onde a skill vem, nos cartões e no menu. */
export const SOURCE_LABEL: Record<ChatSkill['source'], string> = {
  builtin: 'Padrão',
  global: 'Da equipe',
  personal: 'Sua',
}
