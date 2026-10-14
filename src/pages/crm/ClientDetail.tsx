import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CircleAlert, ExternalLink, Instagram, Loader2, MessageCircle, Pencil, Phone, Plus, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { addActivity, deleteActivity, deleteClient, deleteContact, getClient, listActivities, listContacts, saveContact, updateClient } from '@/features/crm/clients'
import { useCrm } from '@/features/crm/crmStore'
import { createOpportunity, leadForClient, listClientOpportunities, updateOpportunity } from '@/features/crm/opportunities'
import { nameOf, personLabel, useTeamPeople } from '@/features/crm/people'
import {
  NOTE_KINDS,
  SOURCES,
  STATUS_LABEL,
  STATUSES,
  canManage,
  type Activity,
  type Client,
  type ClientPatch,
  type Contact,
  type ContactDraft,
  type TeamPerson,
} from '@/features/crm/types'
import { AutoField, FIELD, Page, StatusBadge, Surface, dayLabel, instagramUrl, siteUrl, whatsappUrl, whenLabel } from '@/features/crm/ui'
import { DEFAULT_SETTINGS, STAGE_LABEL, STAGES, money, valueOf, type Opportunity, type Stage } from '@/features/prospects/funnel'
import { PlatformBadge, ScorePill } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; client: Client }

// ---------------------------------------------------------------- contatos

const EMPTY_CONTACT: ContactDraft = { name: '', role: '', phone: '', whatsapp: '', email: '', notes: '', primary: false }

const ContactForm: React.FC<{ initial?: Contact; onSave: (draft: ContactDraft) => Promise<void>; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [draft, setDraft] = useState<ContactDraft>(initial ? { ...EMPTY_CONTACT, ...initial } : EMPTY_CONTACT)
  const [saving, setSaving] = useState(false)
  const set = (key: keyof ContactDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 rounded-lg border border-gray-200 bg-zinc-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={draft.name} onChange={set('name')} placeholder="Nome" required autoFocus className={cn(FIELD, 'h-9')} aria-label="Nome do contato" />
        <input value={draft.role ?? ''} onChange={set('role')} placeholder="Cargo (sócia, secretária…)" className={cn(FIELD, 'h-9')} aria-label="Cargo" />
        <input value={draft.whatsapp ?? ''} onChange={set('whatsapp')} placeholder="WhatsApp" type="tel" className={cn(FIELD, 'h-9')} aria-label="WhatsApp" />
        <input value={draft.email ?? ''} onChange={set('email')} placeholder="E-mail" type="email" className={cn(FIELD, 'h-9')} aria-label="E-mail" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving || !draft.name.trim()}>
          {saving ? 'Salvando…' : 'Salvar contato'}
        </Button>
      </div>
    </form>
  )
}

const Contacts: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [list, setList] = useState<Contact[] | null>(null)
  const [editing, setEditing] = useState<string | 'novo' | null>(null)

  useEffect(() => {
    listContacts(clientId).then(setList).catch(() => setList([]))
  }, [clientId])

  const save = async (draft: ContactDraft, id?: string) => {
    try {
      const saved = await saveContact(clientId, draft, id)
      setList((prev) => (id ? (prev ?? []).map((c) => (c.id === id ? saved : c)) : [...(prev ?? []), saved]))
      setEditing(null)
    } catch (error) {
      toast.error('Não foi possível salvar o contato', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const togglePrimary = async (contact: Contact) => {
    const draft = { ...contact, primary: !contact.primary }
    await save(draft, contact.id)
  }

  const remove = async (contact: Contact) => {
    try {
      await deleteContact(contact.id)
      setList((prev) => (prev ?? []).filter((c) => c.id !== contact.id))
    } catch (error) {
      toast.error('Não foi possível tirar o contato', { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <Surface
      title="Contatos"
      action={
        editing !== 'novo' && (
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setEditing('novo')}>
            <Plus className="h-3.5 w-3.5" /> Contato
          </Button>
        )
      }
    >
      {list === null ? (
        <p className="text-xs text-gray-500">Abrindo…</p>
      ) : (
        <ul className="grid gap-2">
          {!list.length && editing !== 'novo' && <li className="text-xs text-gray-500">Ninguém cadastrado. Quem atende, quem decide?</li>}
          {list.map((c) =>
            editing === c.id ? (
              <li key={c.id}>
                <ContactForm initial={c} onSave={(d) => save(d, c.id)} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={c.id} className="group flex items-start gap-2 rounded-lg px-1 py-1.5">
                <button
                  type="button"
                  onClick={() => void togglePrimary(c)}
                  aria-label={c.primary ? `${c.name} é o contato principal` : `Marcar ${c.name} como contato principal`}
                  title={c.primary ? 'Contato principal' : 'Marcar como principal'}
                  className={cn('mt-0.5 rounded p-0.5', c.primary ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500')}
                >
                  <Star className="h-3.5 w-3.5" fill={c.primary ? 'currentColor' : 'none'} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {c.name}
                    {c.role && <span className="font-normal text-gray-500"> · {c.role}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-600">
                    {(c.whatsapp || c.phone) && (
                      <a href={whatsappUrl(c.whatsapp ?? c.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        <MessageCircle className="h-3 w-3" aria-hidden /> {c.whatsapp ?? c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="truncate hover:underline">
                        {c.email}
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" onClick={() => setEditing(c.id)} aria-label={`Editar ${c.name}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => void remove(c)} aria-label={`Tirar ${c.name}`} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          )}
          {editing === 'novo' && (
            <li>
              <ContactForm onSave={(d) => save(d)} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
      )}
    </Surface>
  )
}

// ---------------------------------------------------------------- oportunidades

const Opportunities: React.FC<{ client: Client; list: Opportunity[]; people?: TeamPerson[]; onChange: (list: Opportunity[]) => void; onActivity: () => void }> = ({
  client,
  list,
  people,
  onChange,
  onActivity,
}) => {
  const pipeline = useCrm((s) => s.pipeline)
  const settings = { ...DEFAULT_SETTINGS, ...pipeline?.settings }
  const [creating, setCreating] = useState(false)

  const move = async (o: Opportunity, stage: Stage) => {
    onChange(list.map((x) => (x.id === o.id ? { ...x, stage } : x)))
    try {
      const saved = await updateOpportunity(o.id, { stage })
      onChange(list.map((x) => (x.id === o.id ? saved : x)))
      onActivity()
    } catch (error) {
      onChange(list)
      toast.error('Não foi possível mudar a etapa', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const assign = async (o: Opportunity, ownerId: string | undefined) => {
    onChange(list.map((x) => (x.id === o.id ? { ...x, ownerId } : x)))
    try {
      const saved = await updateOpportunity(o.id, { ownerId })
      onChange(list.map((x) => (x.id === o.id ? saved : x)))
    } catch (error) {
      onChange(list)
      toast.error('Não foi possível trocar o responsável', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const create = async () => {
    setCreating(true)
    try {
      const o = await createOpportunity(client.id, { stage: 'contatado', lead: leadForClient(client), region: client.city })
      onChange([o, ...list])
      onActivity()
    } catch (error) {
      toast.error('Não foi possível criar a oportunidade', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Surface
      title="Oportunidades"
      action={
        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => void create()} disabled={creating}>
          <Plus className="h-3.5 w-3.5" /> Oportunidade
        </Button>
      }
    >
      {!list.length ? (
        <p className="text-xs text-gray-500">Fora do funil. Crie uma oportunidade quando houver conversa.</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((o) => {
            const projectId = o.projectId ?? o.build?.projectId
            return (
              <li key={o.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Etapa" value={o.stage} onChange={(e) => void move(o, e.target.value as Stage)} className={cn(FIELD, 'h-8 w-auto')}>
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-semibold tabular-nums text-gray-900">{money(valueOf(o, settings).total)}</span>
                  <select aria-label="Responsável" value={o.ownerId ?? ''} onChange={(e) => void assign(o, e.target.value || undefined)} disabled={!people} className={cn(FIELD, 'h-8 w-auto max-w-[11rem]')}>
                    <option value="">Sem responsável</option>
                    {people?.map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {personLabel(p.email)}
                      </option>
                    ))}
                    {o.ownerId && people && !nameOf(people, o.ownerId) && <option value={o.ownerId}>Fora da equipe</option>}
                  </select>
                  <Link to={`/crm?oportunidade=${o.id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:underline">
                    Abrir no funil <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
                {o.offer?.service && <p className="mt-2 text-xs text-gray-600">{o.offer.service}</p>}
                {o.nextStep && (
                  <p className="mt-1.5 text-xs text-gray-700">
                    <span className="font-medium">Próximo passo:</span> {o.nextStep}
                    {o.nextDate && <span className="text-gray-500"> · {dayLabel(`${o.nextDate}T12:00:00`)}</span>}
                  </p>
                )}
                {projectId && (
                  <Link to={`/projetos/${projectId}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                    {o.projectName ?? 'Projeto'} no Space <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Surface>
  )
}

// ---------------------------------------------------------------- linha do tempo

const KIND_LABEL: Record<Activity['kind'], string> = { note: 'Nota', call: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', meeting: 'Reunião', social: 'Redes sociais', stage: 'Etapa', created: 'No funil' }

const Timeline: React.FC<{ clientId: string; version: number; people?: TeamPerson[] }> = ({ clientId, version, people }) => {
  const { user } = useAuth()
  const team = useCrm((s) => s.team)
  const [list, setList] = useState<Activity[] | null>(null)
  const [kind, setKind] = useState<(typeof NOTE_KINDS)[number]['id']>('note')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listActivities(clientId).then(setList).catch(() => setList([]))
  }, [clientId, version])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    try {
      const saved = await addActivity(clientId, kind, body)
      setList((prev) => [saved, ...(prev ?? [])])
      setBody('')
    } catch (error) {
      toast.error('Não foi possível registrar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (a: Activity) => {
    try {
      await deleteActivity(a.id)
      setList((prev) => (prev ?? []).filter((x) => x.id !== a.id))
    } catch (error) {
      toast.error('Não foi possível apagar', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const describe = (a: Activity) => {
    if (a.kind === 'stage') return `${STAGE_LABEL[a.data.from as Stage] ?? a.data.from} → ${STAGE_LABEL[a.data.to as Stage] ?? a.data.to}`
    if (a.kind === 'created') return `Entrou no funil em ${STAGE_LABEL[a.data.to as Stage] ?? a.data.to}`
    return a.body
  }

  return (
    <Surface title="Linha do tempo">
      <form onSubmit={(e) => void add(e)} className="grid gap-2">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Tipo de registro">
          {NOTE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cn('h-7 rounded-full px-2.5 text-xs transition-colors', kind === k.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')}
            >
              {k.label}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={8000}
          placeholder="O que aconteceu? Ex.: falei com a Dra. Ana pelo WhatsApp, pediu a proposta até sexta."
          className={cn(FIELD, 'py-2 leading-relaxed')}
          aria-label="Registro"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>
            {saving ? 'Registrando…' : 'Registrar'}
          </Button>
        </div>
      </form>

      {list === null ? (
        <p className="mt-4 text-xs text-gray-500">Abrindo…</p>
      ) : (
        <ol className="mt-4 grid gap-3 border-t border-gray-100 pt-4">
          {!list.length && <li className="text-xs text-gray-500">Nada registrado ainda.</li>}
          {list.map((a) => {
            const auto = a.kind === 'stage' || a.kind === 'created'
            const mine = a.createdBy === user?.id
            return (
              <li key={a.id} className="group flex gap-3">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', auto ? 'bg-gray-300' : 'bg-gray-900')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500">
                    {/* As notas presas a uma oportunidade são os comentários do cartão no funil */}
                    <span className="font-medium text-gray-700">{a.kind === 'note' && a.opportunityId ? 'Comentário no cartão' : KIND_LABEL[a.kind]}</span>
                    {' · '}
                    {whenLabel(a.createdAt)}
                    {nameOf(people, a.createdBy) && ` · ${nameOf(people, a.createdBy)}`}
                  </p>
                  <p className={cn('mt-0.5 whitespace-pre-wrap text-sm', auto ? 'text-gray-600' : 'text-gray-900')}>{describe(a)}</p>
                </div>
                {!auto && (mine || canManage(team?.role)) && (
                  <button
                    type="button"
                    onClick={() => void remove(a)}
                    aria-label="Apagar o registro"
                    className="h-6 w-6 shrink-0 rounded text-gray-300 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="mx-auto h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Surface>
  )
}

// ---------------------------------------------------------------- ficha

const ClientDetail: React.FC = () => {
  const { clientId = '' } = useParams()
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const people = useTeamPeople(team?.id)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [version, setVersion] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const read = useCallback(async () => {
    setLoad({ state: 'loading' })
    try {
      const [client, opps] = await Promise.all([getClient(clientId), listClientOpportunities(clientId)])
      if (!client) return setLoad({ state: 'missing' })
      setOpportunities(opps)
      setLoad({ state: 'ready', client })
    } catch (error) {
      console.error('[crm] falha ao abrir o cliente', error)
      setLoad({ state: 'error' })
    }
  }, [clientId])

  useEffect(() => {
    void read()
  }, [read])

  const client = load.state === 'ready' ? load.client : undefined

  const patch = async (change: ClientPatch) => {
    if (!client) return
    setLoad({ state: 'ready', client: { ...client, ...change } })
    try {
      const saved = await updateClient(client.id, change)
      setLoad({ state: 'ready', client: saved })
    } catch (error) {
      setLoad({ state: 'ready', client })
      toast.error('Não foi possível salvar', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const remove = async () => {
    if (!client) return
    setConfirmDelete(false)
    try {
      await deleteClient(client.id)
      toast.success(`${client.name} apagado`)
      navigate('/crm/clientes', { replace: true })
    } catch (error) {
      toast.error('Não foi possível apagar', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const scan = client?.lead?.scan
  const links = useMemo(() => {
    if (!client) return []
    return [
      (client.whatsapp || client.phone) && { href: whatsappUrl(client.whatsapp ?? client.phone), icon: MessageCircle, label: 'WhatsApp' },
      client.phone && { href: `tel:${client.phone.replace(/[^\d+]/g, '')}`, icon: Phone, label: 'Ligar' },
      client.website && { href: siteUrl(client.website), icon: ExternalLink, label: client.domain ?? 'Site' },
      client.instagram && { href: instagramUrl(client.instagram), icon: Instagram, label: 'Instagram' },
    ].filter(Boolean) as { href?: string; icon: React.ElementType; label: string }[]
  }, [client])

  if (load.state === 'loading') {
    return (
      <Page>
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo a ficha
        </p>
      </Page>
    )
  }
  if (load.state !== 'ready' || !client) {
    return (
      <Page>
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center" role="alert">
          <CircleAlert className="h-5 w-5 text-gray-500" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-gray-900">{load.state === 'missing' ? 'Cliente não encontrado' : 'Não foi possível abrir a ficha'}</h2>
          <p className="mt-1 text-sm text-gray-500">{load.state === 'missing' ? 'Ele pode ter sido apagado, ou é de outra equipe.' : 'Confira a internet e tente de novo.'}</p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/crm/clientes">Voltar para os clientes</Link>
          </Button>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <Link to="/crm/clientes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{client.name}</h1>
            <StatusBadge status={client.status} label={STATUS_LABEL[client.status]} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{[client.segment, client.city].filter(Boolean).join(' · ') || 'Sem segmento e cidade'}</p>
          {links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {links.map(({ href, icon: Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </a>
              ))}
            </div>
          )}
        </div>
        {canManage(team?.role) && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-rose-700" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Apagar cliente
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-4">
          <Surface title="Dados">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AutoField label="Nome" value={client.name} onSave={(v) => v.trim() && void patch({ name: v })} />
              </div>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Situação</span>
                <select value={client.status} onChange={(e) => void patch({ status: e.target.value as Client['status'] })} className={cn(FIELD, 'mt-1 h-9')}>
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Como chegou</span>
                <select value={client.source} onChange={(e) => void patch({ source: e.target.value as Client['source'] })} className={cn(FIELD, 'mt-1 h-9')}>
                  {SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <AutoField label="Segmento" value={client.segment} onSave={(v) => void patch({ segment: v })} />
              <AutoField label="CNPJ ou CPF" value={client.document} onSave={(v) => void patch({ document: v })} />
              <AutoField label="WhatsApp" type="tel" value={client.whatsapp} onSave={(v) => void patch({ whatsapp: v })} />
              <AutoField label="Telefone" type="tel" value={client.phone} onSave={(v) => void patch({ phone: v })} />
              <AutoField label="E-mail" type="email" value={client.email} onSave={(v) => void patch({ email: v })} />
              <AutoField label="Site" value={client.website} placeholder="exemplo.com.br" onSave={(v) => void patch({ website: v })} />
              <AutoField label="Instagram" value={client.instagram} placeholder="@perfil" onSave={(v) => void patch({ instagram: v })} />
              <AutoField label="Cidade" value={client.city} onSave={(v) => void patch({ city: v })} />
              <div className="sm:col-span-2">
                <AutoField label="Endereço" value={client.address} onSave={(v) => void patch({ address: v })} />
              </div>
              <div className="sm:col-span-2">
                <AutoField label="Observações" type="area" rows={3} value={client.notes} placeholder="O que vale saber sobre este cliente" onSave={(v) => void patch({ notes: v })} />
              </div>
            </div>
          </Surface>

          <Contacts clientId={client.id} />

          {client.lead && (
            <Surface title="O site, pela Prospecção">
              <div className="flex items-start gap-3">
                {scan && <ScorePill score={client.lead.score} temperature={client.lead.temperature} />}
                <div className="min-w-0 space-y-1.5">
                  <PlatformBadge platform={scan?.platform ?? 'sem-site'} />
                  {client.lead.reasons.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-gray-600">
                      {client.lead.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {scan?.agency && <p className="text-xs text-gray-500">Site feito por {scan.agency.name}</p>}
                </div>
              </div>
            </Surface>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Opportunities client={client} list={opportunities} people={people} onChange={setOpportunities} onActivity={() => setVersion((n) => n + 1)} />
          <Timeline clientId={client.id} version={version} people={people} />
          <p className="text-xs text-gray-400">
            No CRM desde {dayLabel(client.createdAt)}
            {client.prospectKey?.startsWith('google:') && ' · veio da Prospecção'}
          </p>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apagar {client.name}?</DialogTitle>
            <DialogDescription>Saem junto os contatos, as oportunidades no funil e a linha do tempo. Não dá para desfazer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Manter
            </Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => void remove()}>
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

export default ClientDetail
