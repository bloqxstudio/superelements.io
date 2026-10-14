import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Building2, CircleAlert, KanbanSquare, Radar, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { when } from '@/features/approval/format'
import { useCrm } from '@/features/crm/crmStore'
import {
  acceptTeamInvite,
  forgetTeamInvite,
  getTeamInvite,
  rememberTeamInvite,
  type PublicTeamInvite,
  type TeamAcceptError,
} from '@/features/crm/teams'
import { ROLE_LABEL } from '@/features/crm/types'
import { personName } from '@/features/projects/access'

/**
 * Convite para a equipe do CRM: quem abre o link entra (ou cria a conta) e
 * passa a ver o CRM e a Prospecção da equipe. Fica fora do login para mostrar
 * o convite antes; o login volta para cá.
 */

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; invite: PublicTeamInvite }

const ACCEPT_ERRORS: Record<TeamAcceptError, string> = {
  convite_inativo: 'Este convite foi cancelado. Peça um novo para quem te enviou.',
  convite_usado: 'Este convite já foi usado por outra conta. Peça um novo para quem te enviou.',
  convite_expirado: 'Este convite expirou. Peça um novo para quem te enviou.',
  login_necessario: 'Entre na sua conta para aceitar o convite.',
  erro: 'Não foi possível entrar na equipe. Confira a internet e tente de novo.',
}

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-100 px-4 py-10">
    <Logo />
    {children}
  </div>
)

const Notice: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <Centered>
    <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-600">{text}</p>
          {action}
        </div>
      </div>
    </div>
  </Centered>
)

const CAN_DO = [
  { icon: KanbanSquare, text: 'Trabalhar as oportunidades no funil da equipe' },
  { icon: Building2, text: 'Cadastrar clientes, contatos e o que foi conversado' },
  { icon: Radar, text: 'Ver as buscas da Prospecção e pôr empresas no funil' },
]

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <Centered>
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 motion-reduce:animate-none" aria-label={label} />
  </Centered>
)

const TeamInvite: React.FC = () => {
  const { inviteId = '' } = useParams()
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const read = useCallback(async () => {
    setLoad({ state: 'loading' })
    try {
      const invite = await getTeamInvite(inviteId)
      setLoad(invite ? { state: 'ready', invite } : { state: 'missing' })
    } catch (error) {
      console.error('[convite da equipe] falha ao ler', error)
      setLoad({ state: 'error' })
    }
  }, [inviteId])

  // Relê ao trocar de conta: o mesmo convite pode já ser de quem entrou
  useEffect(() => {
    if (!authLoading) void read()
  }, [authLoading, user?.id, read])

  const openCrm = useCallback(
    async (teamId: string) => {
      forgetTeamInvite()
      if (user) {
        await useCrm.getState().load(user.id, true)
        await useCrm.getState().select(teamId)
      }
      navigate('/crm', { replace: true })
    },
    [navigate, user]
  )

  // Já é da equipe (entrou antes, ou quem convidou testando o link): vai direto
  useEffect(() => {
    if (load.state === 'ready' && load.invite.status === 'member' && load.invite.teamId) void openCrm(load.invite.teamId)
  }, [load, openCrm])

  // Link que não serve mais não deve voltar depois do login
  useEffect(() => {
    if (load.state === 'missing' || (load.state === 'ready' && (load.invite.status === 'used' || load.invite.status === 'expired'))) forgetTeamInvite()
  }, [load])

  const join = async () => {
    setJoining(true)
    setJoinError(null)
    const result = await acceptTeamInvite(inviteId)
    if ('error' in result) {
      setJoinError(ACCEPT_ERRORS[result.error])
      setJoining(false)
      if (result.error !== 'erro' && result.error !== 'login_necessario') forgetTeamInvite()
      return
    }
    await openCrm(result.teamId)
  }

  const signIn = () => {
    // O Google e a confirmação do e-mail voltam para a raiz: a lista de projetos traz de volta para cá
    rememberTeamInvite(inviteId)
    navigate('/auth', { state: { from: location } })
  }

  const switchAccount = async () => {
    rememberTeamInvite(inviteId)
    await signOut()
    navigate('/auth', { state: { from: location } })
  }

  if (load.state === 'loading' || authLoading) return <Spinner label="Abrindo o convite" />
  if (load.state === 'error') {
    return (
      <Notice
        title="Não foi possível abrir o convite"
        text="Confira a internet e tente de novo."
        action={
          <Button size="sm" className="mt-4" onClick={() => void read()}>
            Tentar de novo
          </Button>
        }
      />
    )
  }
  if (load.state === 'missing') return <Notice title="Convite não encontrado" text="O link está incompleto ou o convite foi cancelado. Peça um novo para quem te enviou." />

  const { invite } = load
  if (invite.status === 'member') return <Spinner label="Abrindo o CRM" />
  if (invite.status === 'used') return <Notice title="Convite já usado" text={`Este convite para a equipe ${invite.teamName} já foi aceito por outra conta. Peça um novo para quem te enviou.`} />
  if (invite.status === 'expired') return <Notice title="Convite expirado" text={`O convite para a equipe ${invite.teamName} venceu em ${when(invite.expiresAt)}. Peça um novo para quem te enviou.`} />

  const inviter = invite.invitedBy ? personName(invite.invitedBy) : 'Alguém'

  return (
    <Centered>
      <main className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-gray-600" aria-hidden>
          <Users className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">
          {inviter} convidou você para a equipe {invite.teamName}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Você entra como <span className="font-medium text-gray-900">{ROLE_LABEL[invite.role].toLowerCase()}</span> e vai poder:
        </p>
        <ul className="mt-4 grid gap-2.5">
          {CAN_DO.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm text-gray-800">
              <Icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              {text}
            </li>
          ))}
        </ul>

        {user ? (
          <div className="mt-6 grid gap-3">
            <Button className="h-11 w-full active:scale-[0.96]" onClick={() => void join()} disabled={joining}>
              {joining ? 'Entrando…' : 'Entrar na equipe'}
            </Button>
            <p className="text-center text-xs text-gray-500">
              Você vai entrar como <span className="font-medium text-gray-700">{user.email}</span>.{' '}
              <button
                type="button"
                onClick={() => void switchAccount()}
                className="rounded underline underline-offset-2 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Usar outra conta
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <Button className="h-11 w-full active:scale-[0.96]" onClick={signIn}>
              Entrar ou criar conta
            </Button>
            <p className="text-center text-xs text-gray-500">Depois de entrar, você volta para este convite. Ele vale até {when(invite.expiresAt)}.</p>
          </div>
        )}

        {joinError && (
          <p className="mt-4 flex items-start gap-2 text-sm text-destructive" role="alert">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {joinError}
          </p>
        )}
      </main>
    </Centered>
  )
}

export default TeamInvite
