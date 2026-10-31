import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { announce, CALLBACK_PATH, completeConnection, takePending, type PendingConnection } from '@/features/wordpress/connect'

type Outcome =
  | { kind: 'connected'; pending: PendingConnection; siteName: string }
  | { kind: 'rejected'; pending: PendingConnection }
  | { kind: 'error'; pending?: PendingConnection; message: string }

/**
 * O WordPress devolve usuário e senha na URL. Lidos uma vez só (o StrictMode
 * roda o efeito duas vezes) e tirados da barra de endereço e do histórico.
 */
let outcome: Promise<Outcome> | null = null

function handleReturn(): Promise<Outcome> {
  const params = new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', CALLBACK_PATH)

  const pending = takePending(params.get('state') ?? '')
  if (!pending) {
    return Promise.resolve({
      kind: 'error',
      message: 'Este retorno do WordPress expirou ou veio de outro navegador. Abra o projeto e conecte de novo.',
    })
  }
  // Volta sem senha também é recusa: nada foi aprovado
  if (params.get('success') === 'false' || !params.get('password')) {
    announce({ type: 'rejected', projectId: pending.projectId })
    return Promise.resolve({ kind: 'rejected', pending })
  }

  return completeConnection(pending.projectId, pending.site, params.get('user_login') ?? '', params.get('password') ?? '').then(
    (connection): Outcome => ({ kind: 'connected', pending, siteName: connection.site.name }),
    (error): Outcome => {
      const message = error instanceof Error ? error.message : String(error)
      announce({ type: 'failed', projectId: pending.projectId, error: message })
      return { kind: 'error', pending, message }
    }
  )
}

/** Volta da tela de aprovação do WordPress: confere a senha, guarda e fecha a janela. */
const WordPressCallback: React.FC = () => {
  const navigate = useNavigate()
  const [result, setResult] = useState<Outcome | null>(null)
  const [stayedOpen, setStayedOpen] = useState(false)

  useEffect(() => {
    let active = true
    outcome ??= handleReturn()
    outcome.then((next) => {
      if (!active) return
      setResult(next)
      if (next.kind === 'error' || !next.pending) return

      if (next.pending.mode === 'popup') {
        // Aberta pelo projeto, a janela pode se fechar; se o navegador não deixar, o texto pede
        setTimeout(() => {
          window.close()
          setTimeout(() => setStayedOpen(true), 300)
        }, 900)
      } else {
        if (next.kind === 'connected') toast.success('WordPress conectado', { description: next.siteName })
        else toast.error('O acesso foi recusado na tela do WordPress')
        navigate(`/projetos/${next.pending.projectId}`, { replace: true })
      }
    })
    return () => {
      active = false
    }
  }, [navigate])

  let icon: React.ReactNode
  let title: string
  let text: string
  if (!result) {
    icon = <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-hidden />
    title = 'Conferindo o acesso ao WordPress…'
    text = 'Isso leva só alguns segundos.'
  } else if (result.kind === 'connected') {
    icon = <CircleCheck className="h-5 w-5 text-emerald-600" aria-hidden />
    title = `${result.siteName} conectado`
    text = stayedOpen ? 'Pode fechar esta janela e voltar ao projeto.' : 'Esta janela fecha sozinha.'
  } else if (result.kind === 'rejected') {
    icon = <CircleAlert className="h-5 w-5 text-gray-500" aria-hidden />
    title = 'Acesso recusado'
    text = stayedOpen ? 'Nada foi conectado. Pode fechar esta janela.' : 'Nada foi conectado. Esta janela fecha sozinha.'
  } else {
    icon = <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
    title = 'Não foi possível conectar'
    text = result.message
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">{text}</p>
            {result?.kind === 'error' && result.pending?.mode === 'popup' && (
              // O projeto já está aberto na outra janela, com o mesmo aviso
              <button
                type="button"
                onClick={() => window.close()}
                className="mt-4 inline-block rounded text-sm font-medium text-gray-900 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Fechar janela
              </button>
            )}
            {result?.kind === 'error' && result.pending?.mode !== 'popup' && (
              <Link
                to={result.pending ? `/projetos/${result.pending.projectId}` : '/'}
                className="mt-4 inline-block text-sm font-medium text-gray-900 underline underline-offset-2"
              >
                Voltar ao projeto
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default WordPressCallback
