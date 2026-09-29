import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CircleAlert, FilePlus2, Globe, Palette, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { when } from '@/features/approval/format'
import {
  acceptInvite,
  forgetInvite,
  getInvite,
  personName,
  rememberInvite,
  type AcceptError,
  type PublicInvite,
} from '@/features/projects/access'
import { useProjectStore } from '@/features/projects/projectStore'

/**
 * Convite para um projeto: quem abre o link entra (ou cria a conta) e passa a
 * editar o projeto junto com quem convidou. Fica fora do login para mostrar o
 * convite antes; o login volta para cá.
 */

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; invite: PublicInvite }

const ACCEPT_ERRORS: Record<AcceptError, string> = {
  convite_inativo: 'Este convite foi cancelado. Peça um novo para quem te enviou.',
  convite_usado: 'Este convite já foi usado por outra conta. Peça um novo para quem te enviou.',
  convite_expirado: 'Este convite expirou. Peça um novo para quem te enviou.',
  login_necessario: 'Entre na sua conta para aceitar o convite.',
  erro: 'Não foi possível entrar no projeto. Confira a internet e tente de novo.',
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
  { icon: FilePlus2, text: 'Criar e editar as páginas no canvas' },
  { icon: Palette, text: 'Mudar a marca e o conteúdo das seções' },
  { icon: Globe, text: 'Publicar no WordPress conectado ao projeto' },
]

const ProjectInvite: React.FC = () => {
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
      const invite = await getInvite(inviteId)
      setLoad(invite ? { state: 'ready', invite } : { state: 'missing' })
    } catch (error) {
      console.error('[convite] falha ao ler', error)
      setLoad({ state: 'error' })
    }
  }, [inviteId])

  // Relê ao trocar de conta: o mesmo convite pode já ser de quem entrou
  useEffect(() => {
    if (!authLoading) void read()
  }, [authLoading, user?.id, read])

  const openProject = useCallback(
    async (projectId: string) => {
      forgetInvite()
      // A lista precisa ter o projeto novo antes de abrir o canvas
      if (user) await useProjectStore.getState().load(user.id)
      navigate(`/projetos/${projectId}`, { replace: true })
    },
    [navigate, user]
  )

  // Já tem acesso (entrou antes, ou é o dono testando o link): vai direto
  useEffect(() => {
    if (load.state === 'ready' && load.invite.status === 'member' && load.invite.projectId) void openProject(load.invite.projectId)
  }, [load, openProject])

  // Link que não serve mais não deve voltar depois do login
  useEffect(() => {
    if (load.state === 'missing' || (load.state === 'ready' && (load.invite.status === 'used' || load.invite.status === 'expired'))) forgetInvite()
  }, [load])

  const join = async () => {
    setJoining(true)
    setJoinError(null)
    const result = await acceptInvite(inviteId)
    if ('error' in result) {
      setJoinError(ACCEPT_ERRORS[result.error])
      setJoining(false)
      if (result.error !== 'erro' && result.error !== 'login_necessario') forgetInvite()
      return
    }
    await openProject(result.projectId)
  }

  const signIn = () => {
    // O Google e a confirmação do e-mail voltam para a raiz: a lista traz de volta para cá
    rememberInvite(inviteId)
    navigate('/auth', { state: { from: location } })
  }

  const switchAccount = async () => {
    rememberInvite(inviteId)
    await signOut()
    navigate('/auth', { state: { from: location } })
  }

  if (load.state === 'loading' || authLoading) {
    return (
      <Centered>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 motion-reduce:animate-none" aria-label="Abrindo o convite" />
      </Centered>
    )
  }
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
  if (load.state === 'missing') {
    return <Notice title="Convite não encontrado" text="O link está incompleto ou o convite foi cancelado. Peça um novo para quem te enviou." />
  }

  const { invite } = load
  if (invite.status === 'member') {
    return (
      <Centered>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 motion-reduce:animate-none" aria-label="Abrindo o projeto" />
      </Centered>
    )
  }
  if (invite.status === 'used') {
    return <Notice title="Convite já usado" text={`Este convite para ${invite.projectName} já foi aceito por outra conta. Peça um novo para quem te enviou.`} />
  }
  if (invite.status === 'expired') {
    return <Notice title="Convite expirado" text={`O convite para ${invite.projectName} venceu em ${when(invite.expiresAt)}. Peça um novo para quem te enviou.`} />
  }

  const inviter = invite.invitedBy ? personName(invite.invitedBy) : 'Alguém'

  return (
    <Centered>
      <main className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-gray-600" aria-hidden>
          <Users className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">
          {inviter} convidou você para construir {invite.projectName}
        </h1>
        <p className="mt-2 text-sm text-gray-600">Entrando no projeto, vocês trabalham juntos no mesmo canvas. Você vai poder:</p>
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
              {joining ? 'Entrando…' : 'Entrar no projeto'}
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

export default ProjectInvite
