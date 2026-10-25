import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CALLBACK_PATH, finishConnect, type Connected } from '@/features/crm/instagram'

type Outcome = { kind: 'connected'; result: Connected } | { kind: 'denied' } | { kind: 'error'; message: string }

/**
 * Volta do login do Instagram com o código de uso único. Lido uma vez só (o
 * StrictMode roda o efeito duas vezes) e tirado da barra de endereço; a
 * função `instagram` troca o código pelo token e guarda a conta.
 */
let outcome: Promise<Outcome> | null = null

function handleReturn(): Promise<Outcome> {
  const params = new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', CALLBACK_PATH)
  if (params.get('error')) return Promise.resolve({ kind: 'denied' })
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return Promise.resolve({ kind: 'error', message: 'O Instagram não devolveu o código do login. Conecte de novo pela tela do Instagram.' })
  return finishConnect(code, state).then(
    (result): Outcome => ({ kind: 'connected', result }),
    (error): Outcome => ({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  )
}

const InstagramCallback: React.FC = () => {
  const navigate = useNavigate()
  const [result, setResult] = useState<Outcome | null>(null)

  useEffect(() => {
    let active = true
    outcome ??= handleReturn()
    outcome.then((next) => {
      if (!active) return
      setResult(next)
      if (next.kind === 'connected') {
        const failed = 'error' in next.result.sync
        toast.success(`@${next.result.username} conectado`, { description: failed ? 'A primeira leitura falhou; tente Atualizar na tela.' : 'Os números já estão na tela.' })
        navigate('/crm/instagram', { replace: true })
      } else if (next.kind === 'denied') {
        toast.error('O acesso foi recusado na tela do Instagram')
        navigate('/crm/instagram', { replace: true })
      }
    })
    return () => {
      active = false
    }
  }, [navigate])

  const error = result?.kind === 'error'
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{error ? <CircleAlert className="h-5 w-5 text-destructive" aria-hidden /> : <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-hidden />}</span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900">{error ? 'Não foi possível conectar' : 'Conectando o Instagram…'}</h1>
            <p className="mt-1 text-sm text-gray-600">{result?.kind === 'error' ? result.message : 'Guardando o acesso e lendo os primeiros números. Leva alguns segundos.'}</p>
            {error && (
              <Link to="/crm/instagram" className="mt-4 inline-block text-sm font-medium text-gray-900 underline underline-offset-2">
                Voltar ao Instagram
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default InstagramCallback
