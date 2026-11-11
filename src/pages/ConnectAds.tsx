import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, CircleAlert, Facebook, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ADS_CALLBACK_PATH, ADS_LINK_KEY, adsLinkInfo, chooseAdsLinkAccounts, finishAdsLinkConnect, startAdsLinkConnect, type AdsLinkInfo, type AdsLinkResult } from '@/features/crm/ads'
import { AccountPicker } from '@/features/crm/InstagramAds'

/**
 * Página pública do link de anúncios (2026-11-11): o cliente abre no celular, sem login, toca em
 * "Continuar com o Facebook" e confirma na tela oficial da Meta. A conta de anúncios dele entra na conta
 * do app de quem mandou o link, com as permissões de ler e turbinar. A senha nunca passa por aqui.
 */

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="se-product se-app flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
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

const Done: React.FC<{ accounts: string[]; team?: string }> = ({ accounts, team }) => (
  <Shell>
    <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
    <h1 className="mt-3 text-lg font-semibold text-gray-900">{accounts.length > 1 ? 'Contas de anúncios ligadas' : 'Conta de anúncios ligada'}</h1>
    <p className="mt-1 text-sm text-gray-600">
      {accounts.length ? `${accounts.join(', ')} ` : ''}
      {team ? `já está com a equipe de ${team}` : 'já está ligada'}. Pode fechar esta página.
    </p>
    <p className="mt-4 text-xs text-gray-500">Para tirar o acesso quando quiser: no Facebook, Configurações › Integrações comerciais.</p>
  </Shell>
)

export const ConnectAds: React.FC = () => {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<AdsLinkInfo | null>(null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adsLinkInfo(token).then(setInfo, (e) => setError(e instanceof Error ? e.message : String(e)))
  }, [token])

  if (error) return <Problem title="Não deu para abrir" text={error} />
  if (!info)
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
        </p>
      </Shell>
    )
  if (info.state === 'used')
    return info.accounts.length ? <Done accounts={info.accounts} team={info.team} /> : <Problem title="Link já usado" text="Este link já foi usado. Peça um novo a quem enviou." />
  if (info.state !== 'ok') return <Problem title={info.state === 'expired' ? 'Link vencido' : 'Link cancelado'} text="Peça um novo link a quem enviou." />

  const connect = async () => {
    setBusy(true)
    try {
      await startAdsLinkConnect(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1877F2] text-white" aria-hidden>
        <Facebook className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">Ligar a sua conta de anúncios</h1>
      <p className="mt-1 text-sm text-gray-600">
        {info.team ? `${info.team} pediu acesso` : 'Pediram acesso'} à conta de anúncios que o seu Instagram usa para turbinar posts, para acompanhar os resultados e turbinar posts por você.
        Nenhum anúncio é ativado sem a aprovação do valor.
      </p>

      <ol className="mt-5 space-y-2 text-sm text-gray-700">
        <li className="flex gap-2">
          <span className="font-semibold text-gray-900">1.</span> Toque no botão abaixo e entre no Facebook ligado ao seu Instagram.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-gray-900">2.</span> Confirme as permissões e, se aparecer, marque a Página e o Instagram da empresa.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-gray-900">3.</span> Você volta para cá com a conta ligada.
        </li>
      </ol>

      <Button className="mt-6 h-12 w-full gap-2 bg-[#1877F2] text-base hover:bg-[#166FE5]" disabled={busy} onClick={() => void connect()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />} Continuar com o Facebook
      </Button>
      <p className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> A senha é digitada só no Facebook e nunca passa por aqui. O link vale até{' '}
        {new Date(info.expiresAt).toLocaleDateString('pt-BR')} e uma vez só.
      </p>
    </Shell>
  )
}

/** A volta do Facebook de quem veio pelo link (sem login). Lida uma vez só (o StrictMode roda o efeito duas vezes). */
let linkOutcome: Promise<{ token: string; result: AdsLinkResult }> | null = null

export const ConnectAdsReturn: React.FC = () => {
  const [state, setState] = useState<{ token: string; result: AdsLinkResult } | { error: string } | { done: string[]; team: string } | null>(null)

  useEffect(() => {
    if (!linkOutcome) {
      const params = new URLSearchParams(window.location.search)
      window.history.replaceState(null, '', ADS_CALLBACK_PATH)
      let token = ''
      try {
        token = sessionStorage.getItem(ADS_LINK_KEY) ?? ''
        sessionStorage.removeItem(ADS_LINK_KEY)
      } catch {
        // sem armazenamento
      }
      const code = params.get('code')
      const loginState = params.get('state')
      linkOutcome = params.get('error')
        ? Promise.reject(new Error('O acesso foi recusado na tela do Facebook. Abra o link de novo para tentar outra vez.'))
        : !token || !code || !loginState
          ? Promise.reject(new Error('O Facebook não devolveu o login. Abra o link de novo.'))
          : finishAdsLinkConnect(token, code, loginState).then((result) => ({ token, result }))
    }
    linkOutcome.then(setState, (e) => setState({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  if (!state)
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Ligando a conta de anúncios… leva alguns segundos.
        </p>
      </Shell>
    )
  if ('error' in state) return <Problem title="Não foi possível ligar" text={state.error} />
  if ('done' in state) return <Done accounts={state.done} team={state.team} />
  const { token } = state
  if (state.result.done) return <Done accounts={state.result.accounts as string[]} team={state.result.team} />
  const result = state.result as Extract<AdsLinkResult, { done: false }>

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-gray-900">Qual é a conta de anúncios da empresa?</h1>
      <div className="mt-3">
        <AccountPicker
          pending={{ pendingId: result.pendingId, accounts: result.accounts, who: result.who, kind: null, expiresAt: null }}
          intro={<p className="text-sm text-gray-600">Esse Facebook tem mais de uma conta de anúncios. Marque só a que o Instagram da empresa usa.</p>}
          choose={async (ids) => {
            const r = await chooseAdsLinkAccounts(token, result.pendingId, ids)
            return { accounts: r.accounts.map((name) => ({ id: name, name })) }
          }}
          onDone={(names) => setState({ done: names, team: result.team })}
        />
      </div>
    </Shell>
  )
}
