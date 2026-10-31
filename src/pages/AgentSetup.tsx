import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IdentityEditor } from '@/features/ia/IdentityEditor'
import { ProfilesEditor } from '@/features/ia/ProfilesEditor'
import { RoutinesPanel } from '@/features/ia/RoutinesPanel'
import { IaPorTarefa } from '@/features/operations/IaPorTarefa'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'identidade', label: 'Identidade do estúdio' },
  { id: 'perfis', label: 'Perfis dos agentes' },
  { id: 'rotinas', label: 'Rotinas' },
  { id: 'ia', label: 'IA de cada trabalho' },
] as const

/** Onde se configura a empresa de agentes: o que cada um faz e como, o que roda sozinho e qual IA usa. */
const AgentSetup: React.FC = () => {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get('aba'))?.id ?? 'identidade'
  return (
    <div className="min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <Link to="/agentes" className="text-xs text-gray-500 underline">
          ← Agentes
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">Configurar os agentes</h1>
        <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-0.5" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setParams({ aba: t.id })} className={cn('h-8 flex-1 rounded-md px-3 text-xs font-semibold', tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-6">{tab === 'identidade' ? <IdentityEditor /> : tab === 'perfis' ? <ProfilesEditor /> : tab === 'rotinas' ? <RoutinesPanel /> : <IaPorTarefa />}</div>
      </div>
    </div>
  )
}

export default AgentSetup
