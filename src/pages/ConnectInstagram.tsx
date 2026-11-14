import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, CircleAlert, Instagram, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CALLBACK_PATH, LINK_KEY, connectLinkInfo, finishLinkConnect, startLinkConnect, type LinkInfo } from '@/features/crm/instagram'

/**
 * Página pública do link de conexão: o cliente abre, sem login, e autoriza o
 * Instagram dele na tela oficial do Instagram. A senha nunca passa por aqui.
 */

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="se-product se-app flex min-h-[100dvh] items-center justify-center bg-zinc-50 px-4 py-10">
    <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm sm:p-8">{children}</div>
  </main>
)

const Problem: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <Shell>
    <CircleAlert className="h-6 w-6 text-amber-600" aria-hidden />
    <h1 className="mt-3 text-lg font-semibold text-gray-900">{title}</h1>
    <p className="mt-1 text-sm text-gray-600">{text}</p>
  </Shell>
)

const Done: React.FC<{ username: string; team?: string }> = ({ username, team }) => (
  <Shell>
    <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
    <h1 className="mt-3 text-lg font-semibold text-gray-900">@{username} conectado</h1>
    <p className="mt-1 text-sm text-gray-600">Pronto{team ? `: a conta já está com a equipe de ${team}` : ''}. Pode fechar esta página.</p>
    <p className="mt-4 text-xs text-gray-500">Para tirar o acesso quando quiser: no Instagram, Configurações › Apps e sites.</p>
  </Shell>
)

export const ConnectInstagram: React.FC = () => {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    connectLinkInfo(token).then(setInfo, (e) => setError(e instanceof Error ? e.message : String(e)))
  }, [token])

  if (error) return <Problem title="Link inválido" text={error} />
  if (!info)
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</p>
      </Shell>
    )
  if (info.state === 'used') return info.username ? <Done username={info.username} team={info.team} /> : <Problem title="Link já usado" text="Este link já foi usado. Peça um novo a quem enviou." />
  if (info.state !== 'ok') return <Problem title={info.state === 'expired' ? 'Link vencido' : 'Link cancelado'} text="Peça um novo link a quem enviou." />

  const connect = async () => {
    setBusy(true)
    try {
      await startLinkConnect(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white" aria-hidden>
        <Instagram className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">Conectar o seu Instagram</h1>
      <p className="mt-1 text-sm text-gray-600">{info.team ? `${info.team} pediu acesso ao Instagram da sua empresa` : 'Pediram acesso ao Instagram da sua empresa'} para acompanhar os números, publicar e responder comentários pela API oficial da Meta.</p>

      <ol className="mt-5 space-y-2 text-sm text-gray-700">
        <li className="flex gap-2"><span className="font-semibold text-gray-900">1.</span> A conta precisa ser profissional (Empresa ou Criador de conteúdo).</li>
        <li className="flex gap-2"><span className="font-semibold text-gray-900">2.</span> Clique abaixo, entre no Instagram e toque em Permitir.</li>
        <li className="flex gap-2"><span className="font-semibold text-gray-900">3.</span> Você volta para cá com a conta conectada.</li>
      </ol>

      <Button className="mt-6 h-11 w-full gap-2 text-base" disabled={busy} onClick={() => void connect()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />} Conectar o Instagram
      </Button>
      <p className="mt-4 flex items-start gap-2 text-xs text-gray-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> A senha é digitada só no Instagram e nunca passa por aqui. O link vale até {new Date(info.expiresAt).toLocaleDateString('pt-BR')} e uma vez só.</p>
    </Shell>
  )
}

/** A volta do Instagram de quem veio pelo link (sem login). Lida uma vez só. */
let linkOutcome: Promise<{ username: string; team: string }> | null = null

export const ConnectInstagramReturn: React.FC = () => {
  const [result, setResult] = useState<{ username: string; team: string } | { error: string } | null>(null)
  useEffect(() => {
    if (!linkOutcome) {
      const params = new URLSearchParams(window.location.search)
      window.history.replaceState(null, '', CALLBACK_PATH)
      let token = ''
      try {
        token = sessionStorage.getItem(LINK_KEY) ?? ''
        sessionStorage.removeItem(LINK_KEY)
      } catch {
        // sem armazenamento
      }
      const code = params.get('code')
      const state = params.get('state')
      linkOutcome = params.get('error')
        ? Promise.reject(new Error('O acesso foi recusado na tela do Instagram. Abra o link de novo para tentar outra vez.'))
        : !token || !code || !state
          ? Promise.reject(new Error('O Instagram não devolveu o login. Abra o link de novo.'))
          : finishLinkConnect(token, code, state)
    }
    linkOutcome.then(setResult, (e) => setResult({ error: e instanceof Error ? e.message : String(e) }))
  }, [])
  if (!result)
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Conectando o Instagram… leva alguns segundos.</p>
      </Shell>
    )
  if ('error' in result) return <Problem title="Não foi possível conectar" text={result.error} />
  return <Done username={result.username} team={result.team} />
}

