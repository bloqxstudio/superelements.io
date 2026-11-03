import React, { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from './crmStore'
import { ModuleGate } from './ModuleGate'
import { firstOpenPath, moduleOfPath, moduleOn } from './modules'

/**
 * A tela da rota, atrás da guarda do módulo dela: com o módulo desligado na conta
 * aberta (ou a conta pausada) a tela não abre, nem por link direto. Também lê as
 * contas de quem entrou, porque dentro de um projeto o menu lateral não existe.
 */
export const GuardedOutlet: React.FC = () => {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const load = useCrm((s) => s.load)
  const team = useCrm((s) => s.team)
  const teamId = team?.id
  useEffect(() => {
    if (user) void load(user.id)
  }, [user, load])

  const module = moduleOfPath(pathname)
  // A raiz é a lista de projetos: numa conta sem projetos (a Sinfy) ela leva à primeira tela ligada
  if (pathname === '/' && team && team.status !== 'pausada' && !moduleOn(team, 'projetos')) return <Navigate to={firstOpenPath(team)} replace />
  // A tela remonta ao trocar de conta: nada do ambiente anterior fica na tela
  // Exceto o assistente de conta nova: ele mesmo troca de conta no meio e não pode recomeçar
  const keepAcrossAccounts = pathname === '/contas/nova'
  const screen = (
    <React.Fragment key={keepAcrossAccounts ? 'assistente' : (teamId ?? 'sem-conta')}>
      <Outlet />
    </React.Fragment>
  )
  return module ? <ModuleGate module={module}>{screen}</ModuleGate> : screen
}
