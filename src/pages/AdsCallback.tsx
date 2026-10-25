import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ADS_CALLBACK_PATH, finishAdsConnect, type Pending } from '@/features/crm/ads'
import { AccountPicker } from '@/features/crm/InstagramAds'

type Outcome = { kind: 'pending'; pending: Pending } | { kind: 'denied' } | { kind: 'error'; message: string }

/**
 * Volta do login do Facebook com o código de uso único. Lido uma vez só (o
 * StrictMode roda o efeito duas vezes) e tirado da barra de endereço; a
 * função `meta-ads` troca o código pelo acesso e devolve as contas de
 * anúncios que ele enxerga, para a pessoa marcar só as desta equipe.
 */
let outcome: Promise<Outcome> | null = null

function handleReturn(): Promise<Outcome> {
  const params = new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', ADS_CALLBACK_PATH)
  if (params.get('error')) return Promise.resolve({ kind: 'denied' })
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return Promise.resolve({ kind: 'error', message: 'O Facebook não devolveu o código do login. Conecte de novo pela aba Anúncios.' })
  return finishAdsConnect(code, state).then(
    (pending): Outcome => ({ kind: 'pending', pending }),
    (error): Outcome => ({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  )
}

const BACK = '/crm/instagram?aba=anuncios'

const AdsCallback: React.FC = () => {
  const navigate = useNavigate()
  const [result, setResult] = useState<Outcome | null>(null)

  useEffect(() => {
    let active = true
    outcome ??= handleReturn()
    outcome.then((next) => {
      if (!active) return
      setResult(next)
      if (next.kind === 'denied') {
        toast.error('O acesso foi recusado na tela do Facebook')
        navigate(BACK, { replace: true })
      }
    })
    return () => {
      active = false
    }
  }, [navigate])

  const done = (ids: string[]) => {
    outcome = null
    navigate(ids[0] ? `${BACK}&conta=${ids[0]}` : BACK, { replace: true })
  }

  const error = result?.kind === 'error'
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className={`w-full rounded-xl border bg-white p-6 shadow-sm ${result?.kind === 'pending' ? 'max-w-lg' : 'max-w-sm'}`} aria-live="polite">
        {result?.kind === 'pending' ? (
          <>
            <h1 className="text-base font-semibold text-gray-900">Quais contas de anúncios são desta equipe?</h1>
            <div className="mt-3">
              <AccountPicker pending={result.pending} onDone={done} onCancel={() => navigate(BACK, { replace: true })} />
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{error ? <CircleAlert className="h-5 w-5 text-destructive" aria-hidden /> : <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-hidden />}</span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">{error ? 'Não foi possível conectar' : 'Conectando a conta de anúncios…'}</h2>
              <p className="mt-1 text-sm text-gray-600">{result?.kind === 'error' ? result.message : 'Conferindo o acesso e buscando as contas de anúncios. Leva alguns segundos.'}</p>
              {error && (
                <Link to={BACK} className="mt-4 inline-block text-sm font-medium text-gray-900 underline underline-offset-2">
                  Voltar aos anúncios
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default AdsCallback
