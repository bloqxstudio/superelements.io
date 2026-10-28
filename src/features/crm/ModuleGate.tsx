import React from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from './crmStore'
import { MODULES, firstOpenPath, moduleOn, type ModuleId } from './modules'

/**
 * Guarda de uma rota por módulo: se a conta aberta tem o módulo desligado (ou está
 * pausada) a tela não abre, mesmo por link direto. Sem conta aberta, ou se as
 * tabelas das contas ainda não existem, nada é restrito.
 */

export const ModuleGate: React.FC<{ module: ModuleId; children: React.ReactNode }> = ({ module, children }) => {
  const { profile } = useAuth()
  const { status, team } = useCrm()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Abrindo
      </div>
    )
  }
  if (status === 'error' || !team || moduleOn(team, module)) return <>{children}</>

  const info = MODULES.find((m) => m.id === module)
  const paused = team.status === 'pausada'
  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:px-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-gray-600" aria-hidden>
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-gray-900">{paused ? `A conta ${team.name} está pausada` : `${info?.label ?? 'Este módulo'} não está ligado`}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {paused ? 'A Avence pausou o acesso a esta conta. Fale com a equipe para reativar.' : `Este módulo está desligado para a conta ${team.name}. Fale com a Avence para ligar.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {profile?.role === 'admin' && (
            <Button asChild>
              <Link to="/contas">Ligar em Contas</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={firstOpenPath(team)}>Voltar ao que está ligado</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
