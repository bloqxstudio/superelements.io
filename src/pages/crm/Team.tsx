import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, History, Link2, Loader2, LogOut, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/features/crm/crmStore'
import { importLegacy } from '@/features/crm/importLegacy'
import {
  cancelInvite,
  createInvite,
  listInvites,
  listPeople,
  removePerson,
  renameTeam,
  setPersonRole,
  teamInviteUrl,
} from '@/features/crm/teams'
import { ROLE_HINT, ROLE_LABEL, canManage, type TeamInvite, type TeamPerson, type TeamRole } from '@/features/crm/types'
import { AutoField, FIELD, Page, PageHeader, Surface, dayLabel, plural } from '@/features/crm/ui'
import { personName } from '@/features/projects/access'
import { cn } from '@/lib/utils'

/**
 * A equipe do CRM e o acesso pela plataforma: quem gerencia convida pessoas
 * por um link (vale 7 dias, para uma pessoa, já com o papel), muda o papel e
 * tira quem saiu. Quem entra vê o CRM e a Prospecção da equipe.
 */

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copiar link' }) => {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1600)
    } catch {
      toast.error('Não deu para copiar', { description: text })
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void copy()}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copiado' : label}
    </Button>
  )
}

const InviteForm: React.FC<{ teamId: string; onCreated: (invite: TeamInvite) => void }> = ({ teamId, onCreated }) => {
  const [label, setLabel] = useState('')
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('seller')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const invite = await createInvite(teamId, label, role)
      onCreated(invite)
      setLabel('')
      try {
        await navigator.clipboard.writeText(teamInviteUrl(invite.id))
        toast.success('Convite criado e link copiado', { description: 'Mande para a pessoa pelo WhatsApp ou e-mail. Vale por 7 dias.' })
      } catch {
        toast.success('Convite criado', { description: 'Copie o link na lista de convites e mande para a pessoa.' })
      }
    } catch (error) {
      toast.error('Não foi possível criar o convite', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
      <label className="grid gap-1">
        <span className="text-xs font-medium text-gray-700">Para quem</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Nome ou e-mail, para você lembrar" className={cn(FIELD, 'h-9')} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-gray-700">Papel</span>
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={cn(FIELD, 'h-9')}>
          <option value="seller">{ROLE_LABEL.seller}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </select>
      </label>
      <Button type="submit" disabled={saving} className="h-9 gap-1.5 self-end">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" />}
        Criar convite
      </Button>
    </form>
  )
}

const Team: React.FC = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const rename = useCrm((s) => s.rename)
  const load = useCrm((s) => s.load)
  const [people, setPeople] = useState<TeamPerson[] | null>(null)
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [importing, setImporting] = useState(false)
  const manager = canManage(team?.role)

  const read = useCallback(async () => {
    if (!team) return
    try {
      const [list, pending] = await Promise.all([listPeople(team.id), canManage(team.role) ? listInvites(team.id) : Promise.resolve([])])
      setPeople(list)
      setInvites(pending)
    } catch (error) {
      console.error('[crm] falha ao ler a equipe', error)
      toast.error('Não foi possível ler a equipe')
      setPeople([])
    }
  }, [team])

  useEffect(() => {
    void read()
  }, [read])

  if (!team) return null

  const saveName = async (name: string) => {
    if (!name.trim()) return
    try {
      await renameTeam(team.id, name)
      rename(name.trim())
    } catch (error) {
      toast.error('Não foi possível renomear', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const changeRole = async (person: TeamPerson, role: Exclude<TeamRole, 'owner'>) => {
    try {
      await setPersonRole(team.id, person.userId, role)
      setPeople((prev) => (prev ?? []).map((p) => (p.userId === person.userId ? { ...p, role } : p)))
    } catch (error) {
      toast.error('Não foi possível mudar o papel', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const remove = async (person: TeamPerson) => {
    const self = person.userId === user?.id
    try {
      await removePerson(team.id, person.userId)
      if (self) {
        toast.success(`Você saiu da equipe ${team.name}`)
        if (user) await load(user.id, true)
        navigate('/', { replace: true })
        return
      }
      setPeople((prev) => (prev ?? []).filter((p) => p.userId !== person.userId))
      toast.success(`${personName(person.email)} saiu da equipe`)
    } catch (error) {
      toast.error('Não foi possível tirar da equipe', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const cancel = async (invite: TeamInvite) => {
    try {
      await cancelInvite(invite.id)
      setInvites((prev) => prev.filter((i) => i.id !== invite.id))
    } catch (error) {
      toast.error('Não foi possível cancelar o convite', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const bringLegacy = async () => {
    setImporting(true)
    try {
      const r = await importLegacy(team.id)
      const total = r.clients + r.opportunities + r.searches + r.notes
      toast.success(total ? 'Dados de antes do CRM trazidos' : 'Nada novo para trazer', {
        description: total
          ? `${plural(r.clients, 'cliente', 'clientes')}, ${plural(r.opportunities, 'oportunidade', 'oportunidades')}, ${plural(r.searches, 'busca', 'buscas')} e ${plural(r.notes, 'anotação', 'anotações')}.`
          : 'Tudo o que existia já está na equipe.',
      })
    } catch (error) {
      toast.error('Não foi possível trazer os dados', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Page>
      <PageHeader title="Equipe" text="Quem vende com você. Cada pessoa entra por um convite e vê o CRM e a Prospecção da equipe." />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Surface title="Empresa">
            <AutoField label="Nome da equipe" value={team.name} disabled={!manager} onSave={(v) => void saveName(v)} />
          </Surface>

          <Surface title={people ? `Pessoas (${people.length})` : 'Pessoas'}>
            {people === null ? (
              <p className="text-xs text-gray-500">Abrindo…</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {people.map((person) => {
                  const self = person.userId === user?.id
                  const owner = person.role === 'owner'
                  return (
                    <li key={person.userId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-gray-700" aria-hidden>
                        {person.email.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {personName(person.email)}
                          {self && <span className="font-normal text-gray-500"> (você)</span>}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {person.email} · desde {dayLabel(person.joinedAt)}
                        </p>
                      </div>
                      {manager && !owner && !self ? (
                        <select
                          aria-label={`Papel de ${personName(person.email)}`}
                          value={person.role}
                          onChange={(e) => void changeRole(person, e.target.value as Exclude<TeamRole, 'owner'>)}
                          className={cn(FIELD, 'h-8 w-auto text-xs')}
                        >
                          <option value="seller">{ROLE_LABEL.seller}</option>
                          <option value="admin">{ROLE_LABEL.admin}</option>
                        </select>
                      ) : (
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-gray-700">{ROLE_LABEL[person.role]}</span>
                      )}
                      {!owner && (self || manager) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-gray-500 hover:text-rose-700"
                          onClick={() => void remove(person)}
                          aria-label={self ? 'Sair da equipe' : `Tirar ${personName(person.email)} da equipe`}
                        >
                          {self ? <LogOut className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {self ? 'Sair' : 'Tirar'}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Surface>

          {manager && (
            <Surface title="Convidar pessoa">
              <p className="mb-3 text-xs text-gray-500">
                O convite é um link para uma pessoa só, que vale 7 dias. Ela abre, entra com a conta dela (ou cria uma) e já entra na equipe com o papel escolhido.
              </p>
              <InviteForm teamId={team.id} onCreated={(invite) => setInvites((prev) => [invite, ...prev])} />
              {invites.length > 0 && (
                <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                  {invites.map((invite) => {
                    const expired = invite.expiresAt < Date.now()
                    return (
                      <li key={invite.id} className="flex flex-wrap items-center gap-2 py-3">
                        <Link2 className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-gray-900">{invite.label || 'Convite sem nome'}</p>
                          <p className="text-xs text-gray-500">
                            {ROLE_LABEL[invite.role]} · {expired ? <span className="text-rose-700">venceu em {dayLabel(invite.expiresAt)}</span> : `vale até ${dayLabel(invite.expiresAt)}`}
                          </p>
                        </div>
                        {!expired && <CopyButton text={teamInviteUrl(invite.id)} />}
                        <Button variant="ghost" size="sm" className="h-8 text-gray-500 hover:text-rose-700" onClick={() => void cancel(invite)}>
                          Cancelar
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Surface>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Surface title="Papéis">
            <dl className="grid gap-3">
              {(['owner', 'admin', 'seller'] as const).map((role) => (
                <div key={role}>
                  <dt className="text-sm font-medium text-gray-900">{ROLE_LABEL[role]}</dt>
                  <dd className="text-xs text-gray-500">{ROLE_HINT[role]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              Os projetos no Space continuam com quem os criou: para outra pessoa editar uma página, convide-a pelo projeto.
            </p>
          </Surface>

          {manager && profile?.role === 'admin' && (
            <Surface title="Dados de antes do CRM">
              <p className="text-xs text-gray-500">
                Traz o funil da Prospecção, as buscas salvas e o Comercial antigo para esta equipe. O que já entrou é reconhecido e não se repete.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" disabled={importing} onClick={() => void bringLegacy()}>
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <History className="h-3.5 w-3.5" />}
                {importing ? 'Trazendo…' : 'Trazer dados de antes do CRM'}
              </Button>
            </Surface>
          )}
        </div>
      </div>
    </Page>
  )
}

export default Team
