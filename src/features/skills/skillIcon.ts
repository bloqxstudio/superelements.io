import type React from 'react'
import { Accessibility, BarChart3, BookMarked, CalendarDays, Clapperboard, Eraser, FileText, Globe, Images, Instagram, Layers, MessageCircle, MessageSquareReply, Mic, Palette, Recycle, Send, Smartphone, Target, TrendingUp, Type, UserCircle, Users } from 'lucide-react'
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
  'pagina-copy': FileText,
  'ig-reel': Clapperboard,
  'ig-viral': TrendingUp,
  'ig-legenda': Type,
  'ig-carrossel': Layers,
  'ig-stories': Instagram,
  'ig-perfil': UserCircle,
  'ig-semana': CalendarDays,
  'ig-humanizar': Eraser,
  'ig-comentar': MessageCircle,
  'ig-responder': MessageSquareReply,
  'ig-direct': Send,
  'ig-repurpose': Recycle,
  'ig-auditoria': BarChart3,
  'ig-voz': Mic,
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
