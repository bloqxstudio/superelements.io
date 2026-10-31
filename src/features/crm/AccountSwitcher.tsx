import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { useCrm } from './crmStore'

/**
 * O seletor de conta no topo do menu lateral: mostra a empresa aberta, troca de
 * ambiente com um clique e, para o admin da plataforma, adiciona uma conta nova
 * ou abre o painel Contas. Quem tem uma conta só vê o nome dela.
 */

const Initial: React.FC<{ name: string; paused?: boolean }> = ({ name, paused }) => (
  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white', paused ? 'bg-gray-400' : 'bg-gray-900')} aria-hidden>
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>
)

export const AccountSwitcher: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { status, teams, team, select } = useCrm()
  const platformAdmin = profile?.role === 'admin'

  if (status !== 'ready' || (!team && !platformAdmin)) return null

  // Sem nenhuma conta ainda (o admin da plataforma cria a primeira)
  if (!team) {
    return (
      <>
        <button type="button" onClick={() => navigate('/contas/nova')} className="flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Plus className="h-4 w-4" aria-hidden /> Criar a primeira conta
        </button>
      </>
    )
  }

  // Uma conta e sem poder criar outra: só o nome, sem menu
  if (teams.length < 2 && !platformAdmin) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
        <Initial name={team.name} paused={team.status === 'pausada'} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{team.name}</span>
      </div>
    )
  }

  return (
    <>
      {/* modal=false: o diálogo abre a partir de um item do menu; com os dois modais, o body ficava com pointer-events:none depois de fechar */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-gray-50"
            aria-label={`Conta aberta: ${team.name}. Trocar de conta`}
          >
            <Initial name={team.name} paused={team.status === 'pausada'} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight text-gray-900">{team.name}</span>
              <span className="block truncate text-[11px] leading-tight text-gray-500">{team.status === 'pausada' ? 'Conta pausada' : team.isHome ? 'Conta da casa' : 'Conta cliente'}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Contas</DropdownMenuLabel>
          {teams.map((t) => (
            <DropdownMenuItem key={t.id} onSelect={() => void select(t.id)} className="gap-2.5">
              <Initial name={t.name} paused={t.status === 'pausada'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.name}</span>
                {t.status === 'pausada' && <span className="block text-[11px] text-gray-500">Pausada</span>}
              </span>
              {t.id === team.id && <Check className="h-4 w-4 shrink-0 text-gray-700" aria-hidden />}
            </DropdownMenuItem>
          ))}
          {platformAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/contas/nova')} className="gap-2.5">
                <Plus className="h-4 w-4" aria-hidden /> Adicionar conta
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/contas')} className="gap-2.5">
                <Settings2 className="h-4 w-4" aria-hidden /> Gerenciar contas e módulos
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
