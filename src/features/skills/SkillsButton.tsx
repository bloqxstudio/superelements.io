import React from 'react'
import { NavLink } from 'react-router-dom'
import { Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Atalho para a tela Skills no header: as skills que o agente segue no chat do canvas. */
export const SkillsButton: React.FC = () => (
  <NavLink
    to="/skills"
    title="Skills do agente"
    aria-label="Skills"
    className={({ isActive }) =>
      cn(
        'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
        isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )
    }
  >
    <Wand2 className="h-4 w-4" aria-hidden />
    <span className="hidden sm:inline">Skills</span>
  </NavLink>
)
