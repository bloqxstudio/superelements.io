import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { GOOGLE_CALLBACK_PATH, finishGoogleConnect } from '@/features/crm/googleAgenda'

type Outcome = { kind: 'connected'; email: string } | { kind: 'denied' } | { kind: 'error'; message: string }

/**
 * Volta do login do Google com o código de uso único. Lido uma vez só (o StrictMode roda o efeito duas vezes)
 * e tirado da barra de endereço; a função `google-calendar` troca o código pelo token e guarda a conexão.
 */
let outcome: Promise<Outcome> | null = null

function handleReturn(): Promise<Outcome> {
  const params = new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', GOOGLE_CALLBACK_PATH)
  if (params.get('error')) return Promise.resolve({ kind: 'denied' })
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return Promise.resolve({ kind: 'error', message: 'O Google não devolveu o código do login. Conecte de novo pela tela Agenda.' })
  return finishGoogleConnect(code, state).then(
    (result): Outcome => ({ kind: 'connected', email: result.email }),
    (error): Outcome => ({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  )
}

const GoogleAgendaCallback: React.FC = () => {
  const navigate = useNavigate()
  const [result, setResult] = useState<Outcome | null>(null)

  useEffect(() => {
    let active = true
    outcome ??= handleReturn()
    outcome.then((next) => {
      if (!active) return
      setResult(next)
      if (next.kind === 'connected') {
        toast.success('Google Agenda conectado', { description: next.email || undefined })
        navigate('/crm/agenda', { replace: true })
      } else if (next.kind === 'denied') {
        toast.error('O acesso foi recusado na tela do Google')
        navigate('/crm/agenda', { replace: true })
      }
    })
    return () => {
      active = false
    }
  }, [navigate])

  const error = result?.kind === 'error'
  return (
    <main className="flex se-product se-app min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{error ? <CircleAlert className="h-5 w-5 text-destructive" aria-hidden /> : <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-hidden />}</span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900">{error ? 'Não foi possível conectar' : 'Conectando o Google Agenda…'}</h1>
            <p className="mt-1 text-sm text-gray-600">{result?.kind === 'error' ? result.message : 'Guardando o acesso. Leva alguns segundos.'}</p>
            {error && (
              <Link to="/crm/agenda" className="mt-4 inline-block text-sm font-medium text-gray-900 underline underline-offset-2">
                Voltar à Agenda
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default GoogleAgendaCallback
