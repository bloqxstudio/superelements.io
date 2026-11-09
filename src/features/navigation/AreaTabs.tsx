import React from 'react'
import { NavLink } from 'react-router-dom'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn, type ModuleId } from '@/features/crm/modules'
import { cn } from '@/lib/utils'

/**
 * Nova jornada de criação, Fase 0 (2026-11-09, o usuário: "Sites e projetos é a mesma coisa", "Pauta,
 * conteúdo e texto é meio que a mesma coisa", "cérebro deve vir primeiro"). O menu mostra um item por
 * área e as telas que eram itens separados viram abas no topo da área. As rotas continuam as mesmas.
 * Plano: cerebro/iniciativas/superelements/jornada-de-criacao.md.
 */
export type AreaId = 'cerebro' | 'pauta' | 'sites' | 'criativos'

interface Tab { to: string; label: string; module?: ModuleId; end?: boolean }

export const AREA_TABS: Record<AreaId, Tab[]> = {
  cerebro: [
    { to: '/cerebro', label: 'Notas e marca' },
    { to: '/plano', label: 'Plano da empresa', module: 'copy' },
  ],
  pauta: [
    { to: '/pauta', label: 'Calendário', module: 'copy' },
    { to: '/conteudos', label: 'Lista', module: 'copy' },
    { to: '/copy', label: 'Textos', module: 'copy' },
  ],
  sites: [
    { to: '/', label: 'No canvas', module: 'projetos', end: true },
    { to: '/sites', label: 'Em código', module: 'projetos' },
  ],
  criativos: [
    { to: '/criativos', label: 'Posts', module: 'criativos' },
    { to: '/motion', label: 'Motion e vídeo', module: 'criativos' },
  ],
}

/** As rotas de cada área (o item do menu fica ativo em qualquer uma delas). */
export const areaPaths = (area: AreaId) => AREA_TABS[area].map((t) => t.to)

export const AreaTabs: React.FC<{ area: AreaId; className?: string; compact?: boolean }> = ({ area, className, compact }) => {
  const team = useCrm((s) => s.team)
  const tabs = AREA_TABS[area].filter((t) => !t.module || moduleOn(team, t.module))
  if (tabs.length < 2) return null
  return (
    <nav aria-label="Telas desta área" className={cn('flex w-fit rounded-lg bg-gray-100 p-0.5', compact ? 'text-[13px]' : 'mb-5 text-sm', className)}>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => cn('rounded-md px-2.5 py-1 font-medium transition-colors', isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
