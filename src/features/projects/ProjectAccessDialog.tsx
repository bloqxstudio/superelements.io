import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, Copy, Link2, LogOut, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { isLocalAppUrl } from '@/features/approval/shares'
import { when } from '@/features/approval/format'
import {
  cancelInvite,
  createInvite,
  inviteUrl,
  listInvites,
  listPeople,
  personName,
  removePerson,
  type ProjectInvite,
  type ProjectPerson,
} from './access'
import { announceRemoved, useLiveProject, type LivePerson } from './liveProject'
import { useProject, useProjectStore } from './projectStore'

const errorText = (error: unknown) => (error instanceof Error ? error.message : undefined)

// Fora do projeto aberto: o mesmo array sempre, para o seletor do store não mudar a cada leitura
const NOBODY: LivePerson[] = []

// Cor fixa por pessoa, para a mesma inicial não confundir quem é quem
const AVATAR_COLORS = ['bg-sky-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600']
const colorOf = (id: string) => AVATAR_COLORS[[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

const Avatar: React.FC<{ person: { userId: string; email: string }; size?: 'sm' | 'md'; className?: string }> = ({ person, size = 'md', className }) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-medium text-white',
      size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-xs',
      colorOf(person.userId),
      className
    )}
    aria-hidden
  >
    {(person.email.charAt(0) || '?').toUpperCase()}
  </span>
)

const copyText = async (text: string, success: string, description?: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(success, { description })
  } catch {
    toast.error('Não foi possível copiar', { description: text })
  }
}

type Busy = { kind: 'create' } | { kind: 'cancel' | 'remove'; id: string } | { kind: 'leave' } | null

interface ProjectAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

/**
 * Quem tem acesso ao projeto. O dono cria convites (um link por pessoa) e tira
 * quem quiser; quem entrou por convite vê a lista e pode sair.
 */
export const ProjectAccessDialog: React.FC<ProjectAccessDialogProps> = ({ open, onOpenChange, projectId }) => {
  const project = useProject(projectId)
  const leaveProject = useProjectStore((s) => s.leave)
  const userId = useAuth().user?.id
  const online = useLiveProject((s) => (s.projectId === projectId ? s.people : NOBODY))
  const navigate = useNavigate()
  const owner = project?.role !== 'editor'

  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [invites, setInvites] = useState<ProjectInvite[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [label, setLabel] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextPeople, nextInvites] = await Promise.all([listPeople(projectId), owner ? listInvites(projectId) : Promise.resolve([])])
      setPeople(nextPeople)
      setInvites(nextInvites)
      setStatus('ready')
    } catch (error) {
      console.error('[acesso] falha ao ler', error)
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [projectId, owner])

  useEffect(() => {
    if (!open) return
    setStatus('loading')
    setCreated(null)
    setConfirm(null)
    void load()
  }, [open, load])

  if (!project) return null
  const isOnline = (id: string) => online.some((p) => p.userId === id)

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy({ kind: 'create' })
    try {
      const invite = await createInvite(projectId, label)
      setInvites((list) => [invite, ...list])
      setCreated(invite.id)
      setLabel('')
      await copyText(inviteUrl(invite.id), 'Convite criado e copiado', 'Mande o link para o cliente. Ele entra com a conta dele.')
    } catch (error) {
      console.error('[acesso] falha ao convidar', error)
      toast.error('Não foi possível criar o convite', { description: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const cancel = async (invite: ProjectInvite) => {
    setBusy({ kind: 'cancel', id: invite.id })
    try {
      await cancelInvite(invite.id)
      setInvites((list) => list.filter((i) => i.id !== invite.id))
      if (created === invite.id) setCreated(null)
    } catch (error) {
      toast.error('Não foi possível cancelar o convite', { description: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (person: ProjectPerson) => {
    setBusy({ kind: 'remove', id: person.userId })
    try {
      await removePerson(projectId, person.userId)
      announceRemoved(projectId, person.userId)
      setPeople((list) => list.filter((p) => p.userId !== person.userId))
      setConfirm(null)
      toast.success(`${personName(person.email)} não tem mais acesso`)
    } catch (error) {
      toast.error('Não foi possível tirar o acesso', { description: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const leave = async () => {
    setBusy({ kind: 'leave' })
    try {
      await leaveProject(projectId)
      onOpenChange(false)
      toast.success(`Você saiu de ${project.name}`)
      navigate('/', { replace: true })
    } catch (error) {
      toast.error('Não foi possível sair do projeto', { description: errorText(error) })
      setBusy(null)
    }
  }

  const now = Date.now()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{owner ? `Compartilhar ${project.name}` : `Pessoas em ${project.name}`}</DialogTitle>
          <DialogDescription>
            {owner
              ? 'Quem entrar pelo convite, com a própria conta, cria e edita as páginas, muda a marca e publica no WordPress conectado a este projeto. Só você exclui o projeto e convida pessoas.'
              : 'Você entrou por convite: cria e edita as páginas, muda a marca e publica no WordPress conectado. Excluir o projeto e convidar pessoas fica com o dono.'}
          </DialogDescription>
        </DialogHeader>

        {owner && (
          <form onSubmit={create} className="grid gap-2">
            <Label htmlFor="invite-label">Convidar alguém</Label>
            <div className="flex gap-2">
              <Input
                id="invite-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={120}
                placeholder="Para quem (opcional): nome ou e-mail"
                className="h-9"
              />
              <Button type="submit" className="h-9 shrink-0 gap-1.5 active:scale-[0.96]" disabled={busy !== null}>
                <UserPlus className="h-4 w-4" />
                {busy?.kind === 'create' ? 'Criando…' : 'Criar convite'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Cada link vale para uma pessoa, por 7 dias.</p>
            {isLocalAppUrl() && (
              <p className="text-xs text-amber-700">
                Este endereço só abre neste computador. Para o cliente entrar, o app precisa estar publicado (e o endereço dele em{' '}
                <code className="font-mono">VITE_PUBLIC_APP_URL</code>).
              </p>
            )}
          </form>
        )}

        {status === 'error' ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-3 text-sm" role="alert">
            <p className="flex items-center gap-2 text-gray-700">
              <CircleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              Não foi possível ler quem tem acesso.
            </p>
            <Button size="sm" variant="outline" className="h-8" onClick={() => void load()}>
              Tentar de novo
            </Button>
          </div>
        ) : status === 'loading' ? (
          <div className="grid gap-2" aria-busy="true" aria-label="Lendo quem tem acesso">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          <>
            {owner && invites.length > 0 && (
              <section aria-labelledby="invites-title" className="grid gap-2">
                <h3 id="invites-title" className="text-sm font-medium text-gray-900">
                  Convites abertos
                </h3>
                <ul className="divide-y rounded-lg border">
                  {invites.map((invite) => {
                    const expired = invite.expiresAt < now
                    const url = inviteUrl(invite.id)
                    return (
                      <li key={invite.id} className="grid gap-2 px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-gray-500" aria-hidden>
                            <Link2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">{invite.label || 'Convite sem nome'}</p>
                            <p className={cn('text-xs', expired ? 'text-amber-700' : 'text-gray-500')}>
                              {expired ? 'Expirou' : `Vale até ${when(invite.expiresAt)}`} · ainda não usado
                            </p>
                          </div>
                          {!expired && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs active:scale-[0.96]"
                              onClick={() => void copyText(url, 'Link do convite copiado')}
                            >
                              <Copy className="h-3.5 w-3.5" /> Copiar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-gray-600"
                            onClick={() => void cancel(invite)}
                            disabled={busy !== null}
                          >
                            {busy?.kind === 'cancel' && busy.id === invite.id ? 'Cancelando…' : expired ? 'Apagar' : 'Cancelar'}
                          </Button>
                        </div>
                        {created === invite.id && (
                          <input
                            readOnly
                            value={url}
                            aria-label="Endereço do convite"
                            onFocus={(e) => e.currentTarget.select()}
                            className="h-8 w-full rounded-md border bg-muted/40 px-2.5 font-mono text-[11px] text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section aria-labelledby="people-title" className="grid gap-2">
              <h3 id="people-title" className="text-sm font-medium text-gray-900">
                Pessoas com acesso
              </h3>
              <ul className="divide-y rounded-lg border">
                {people.map((person) => {
                  const me = person.userId === userId
                  return (
                    <li key={person.userId} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="relative">
                        <Avatar person={person} />
                        {isOnline(person.userId) && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-900">
                          {person.email || 'Conta sem e-mail'}
                          {me && <span className="text-gray-500"> (você)</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {person.role === 'owner' ? 'Dono' : `Edita e publica · entrou em ${when(person.joinedAt)}`}
                          {isOnline(person.userId) && ' · no projeto agora'}
                        </p>
                      </div>
                      {owner && person.role === 'editor' &&
                        (confirm === person.userId ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 text-xs"
                              onClick={() => void remove(person)}
                              disabled={busy !== null}
                            >
                              {busy?.kind === 'remove' ? 'Tirando…' : 'Tirar acesso'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirm(null)} disabled={busy !== null}>
                              Voltar
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-600" onClick={() => setConfirm(person.userId)}>
                            Remover
                          </Button>
                        ))}
                    </li>
                  )
                })}
              </ul>
              {owner && people.length <= 1 && invites.length === 0 && (
                <p className="text-xs text-gray-500">Só você por enquanto. Crie um convite e mande o link para o cliente.</p>
              )}
            </section>

            {!owner && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                {confirm === 'leave' ? (
                  <>
                    <p className="text-sm text-gray-700">Você deixa de ver o projeto. Para voltar, precisa de outro convite.</p>
                    <span className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => void leave()} disabled={busy !== null}>
                        {busy?.kind === 'leave' ? 'Saindo…' : 'Sair do projeto'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirm(null)} disabled={busy !== null}>
                        Voltar
                      </Button>
                    </span>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-gray-600" onClick={() => setConfirm('leave')}>
                    <LogOut className="h-3.5 w-3.5" />
                    Sair do projeto
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
