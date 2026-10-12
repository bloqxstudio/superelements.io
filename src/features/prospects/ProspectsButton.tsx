import React from 'react'
import { NavLink } from 'react-router-dom'
import { Radar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

/** A prospecção guarda contatos comerciais e fica restrita aos admins. */
export const ProspectsButton: React.FC = () => {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return null
  return (
    <NavLink
      to="/prospeccao"
      title="Prospecção"
      aria-label="Prospecção"
      className={({ isActive }) =>
        cn(
          'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
          isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )
      }
    >
      <Radar className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Prospecção</span>
    </NavLink>
  )
}
