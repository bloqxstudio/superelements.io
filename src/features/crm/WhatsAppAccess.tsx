import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, Loader2, MessageCircleQuestion, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { listAccounts } from '@/features/crm/teams'
import { Avatar, FIELD, Surface, whenLabel } from '@/features/crm/ui'
import {
  ACCESS_TOPICS,
  NO_TABLE,
  REPORT_KINDS,
  WEEKDAYS,
  cleanPhone,
  listContacts,
  listQuestions,
  removeContact,
  saveContact,
  type AccessTopic,
  type ClientContact,
  type ClientQuestion,
  type ReportKind,
} from '@/features/crm/clientAccess'
import { formatPhone } from '@/features/crm/whatsapp'
import { cn } from '@/lib/utils'

/**
 * Clientes que podem escrever para o WhatsApp da Avence (CRM › WhatsApp, só na conta da casa):
 * quem é, o que pode ver da própria conta e quando recebe o relatório. Quem cadastra e muda é
 * o admin da plataforma; os gestores da Avence veem a lista e as últimas perguntas.
 */

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

const TOPIC_HINT: Record<AccessTopic, string> = {
  site: 'Visitas, contatos e origens',
  anuncios: 'Gasto e resultados',
  funil: 'Cards de venda por etapa',
  instagram: 'Seguidores e alcance',
  posts: 'Melhores posts do mês',
  caixa: 'Comentários e DMs em aberto',
  projetos: 'Andamento dos projetos',
}

const pad = (hour: number) => `${String(hour).padStart(2, '0')}h`

/** "Toda segunda, 09h" — o que a pessoa lê na lista e na prévia do modal */
const scheduleText = (c: Pick<ClientContact, 'reportKind' | 'reportHour' | 'reportWeekday' | 'reportMonthday'>) =>
  c.reportKind === 'diario' ? `Todo dia, ${pad(c.reportHour)}` : c.reportKind === 'semanal' ? `Toda ${WEEKDAYS[c.reportWeekday]}, ${pad(c.reportHour)}` : `Todo dia ${c.reportMonthday}, ${pad(c.reportHour)}`

const EMPTY: ClientContact = {
  phone: '',
  accountId: '',
  name: '',
  topics: ['site', 'anuncios'],
  enabled: true,
  reports: false,
  reportKind: 'semanal',
  reportHour: 9,
  reportWeekday: 1,
  reportMonthday: 1,
}

const Label: React.FC<{ children: React.ReactNode; hint?: string; htmlFor?: string }> = ({ children, hint, htmlFor }) => (
  <label htmlFor={htmlFor} className="grid gap-0.5">
    <span className="text-xs font-medium text-gray-800">{children}</span>
    {hint && <span className="text-[11px] leading-snug text-gray-500">{hint}</span>}
  </label>
)

const SectionTitle: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <div className="flex items-center gap-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white">{n}</span>
    <h3 className="text-sm font-semibold text-gray-900">{children}</h3>
  </div>
)

/** Um de vários: a frequência do relatório */
const Segmented: React.FC<{ value: ReportKind; onChange: (kind: ReportKind) => void }> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Frequência do relatório" className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
    {REPORT_KINDS.map((k) => (
      <button
        key={k.id}
        type="button"
        role="radio"
        aria-checked={value === k.id}
        onClick={() => onChange(k.id)}
        className={cn(
          'rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value === k.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
        )}
      >
        {k.label}
      </button>
    ))}
  </div>
)

/** Cadastro e edição de um cliente, na mesma janela */
const ClientDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  /** undefined: cliente novo */
  editing?: ClientContact
  accounts: { id: string; name: string }[]
  teamId: string
  onSaved: () => Promise<void>
}> = ({ open, onOpenChange, editing, accounts, teamId, onSaved }) => {
  const [form, setForm] = useState<ClientContact>(EMPTY)
  const [phoneText, setPhoneText] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editing ?? { ...EMPTY, accountId: accounts.length === 1 ? accounts[0].id : '' })
    setPhoneText(editing ? formatPhone(editing.phone) : '')
  }, [open, editing, accounts])

  const patch = (next: Partial<ClientContact>) => setForm((f) => ({ ...f, ...next }))
  const toggleTopic = (id: AccessTopic) => patch({ topics: form.topics.includes(id) ? form.topics.filter((t) => t !== id) : [...form.topics, id] })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const phone = editing ? editing.phone : cleanPhone(phoneText)
    if (!phone) return toast.error('Telefone inválido', { description: 'Use DDD e número, por exemplo (51) 99999-0000.' })
    if (!form.accountId) return toast.error('Escolha a conta do cliente')
    if (!form.topics.length) return toast.error('Libere pelo menos um assunto')
    setSaving(true)
    try {
      await saveContact(teamId, { ...form, phone })
      await onSaved()
      toast.success(editing ? 'Cliente atualizado' : 'Cliente cadastrado')
      onOpenChange(false)
    } catch (error) {
      toast.error('Não foi possível salvar', { description: message(error) })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    setRemoving(true)
    try {
      await removeContact(teamId, editing.phone)
      await onSaved()
      toast.success('Cliente removido')
      onOpenChange(false)
    } catch (error) {
      toast.error('Não foi possível remover', { description: message(error) })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-gray-100 px-6 pb-4 pt-6 text-left">
          <DialogTitle>{editing ? 'Editar cliente do WhatsApp' : 'Novo cliente do WhatsApp'}</DialogTitle>
          <DialogDescription>Quem pode escrever para o número da Avence, o que vê da própria conta e quando recebe o relatório.</DialogDescription>
        </DialogHeader>

        <form id="cliente-whatsapp" onSubmit={(e) => void submit(e)} className="grid gap-7 px-6 py-6">
          <section className="grid gap-3">
            <SectionTitle n={1}>Quem é</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cw-phone" hint={editing ? 'O número não muda: remova e cadastre outro.' : 'Com DDD, sem o +55.'}>
                  WhatsApp
                </Label>
                <input
                  id="cw-phone"
                  className={cn(FIELD, 'h-10')}
                  inputMode="tel"
                  autoComplete="off"
                  autoFocus={!editing}
                  placeholder="(51) 99999-0000"
                  value={phoneText}
                  disabled={!!editing}
                  onChange={(e) => setPhoneText(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cw-name" hint="Como a IA chama a pessoa.">
                  Nome
                </Label>
                <input id="cw-name" className={cn(FIELD, 'h-10')} maxLength={80} placeholder="Ex.: Ana" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cw-account" hint="Só os dados desta conta aparecem para o número.">
                Conta do cliente
              </Label>
              <select id="cw-account" className={cn(FIELD, 'h-10')} value={form.accountId} onChange={(e) => patch({ accountId: e.target.value })}>
                <option value="">Escolha a conta…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="grid gap-3">
            <SectionTitle n={2}>O que pode ver</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Assuntos liberados">
              {ACCESS_TOPICS.map((t) => {
                const on = form.topics.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTopic(t.id)}
                    className={cn(
                      'group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'border-emerald-300 bg-emerald-50/70' : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <span
                      className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors', on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white')}
                      aria-hidden
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{t.label}</span>
                      <span className="block text-[11px] leading-snug text-gray-500">{TOPIC_HINT[t.id]}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="grid gap-3">
            <SectionTitle n={3}>Relatório automático</SectionTitle>
            <div className="rounded-xl border border-gray-200">
              <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">Enviar o relatório da conta</span>
                  <span className="block text-[11px] leading-snug text-gray-500">Texto curto com os números do período e um gráfico.</span>
                </span>
                <Switch checked={form.reports} onCheckedChange={(reports) => patch({ reports })} aria-label="Enviar relatório automático" />
              </label>
              {form.reports && (
                <div className="grid gap-3 border-t border-gray-100 bg-zinc-50/70 px-4 py-4">
                  <Segmented value={form.reportKind} onChange={(reportKind) => patch({ reportKind })} />
                  <div className="grid grid-cols-2 gap-3">
                    {form.reportKind !== 'diario' && (
                      <div className="grid gap-1.5">
                        <Label htmlFor="cw-day">{form.reportKind === 'semanal' ? 'Dia da semana' : 'Dia do mês'}</Label>
                        {form.reportKind === 'semanal' ? (
                          <select id="cw-day" className={cn(FIELD, 'h-10 capitalize')} value={form.reportWeekday} onChange={(e) => patch({ reportWeekday: Number(e.target.value) })}>
                            {WEEKDAYS.map((d, i) => (
                              <option key={d} value={i}>
                                {d}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select id="cw-day" className={cn(FIELD, 'h-10')} value={form.reportMonthday} onChange={(e) => patch({ reportMonthday: Number(e.target.value) })}>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>
                                Dia {d}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    <div className={cn('grid gap-1.5', form.reportKind === 'diario' && 'col-span-2')}>
                      <Label htmlFor="cw-hour">Horário</Label>
                      <select id="cw-hour" className={cn(FIELD, 'h-10')} value={form.reportHour} onChange={(e) => patch({ reportHour: Number(e.target.value) })}>
                        {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                          <option key={h} value={h}>
                            {pad(h)} (São Paulo)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="flex items-start gap-2 text-[11px] leading-snug text-gray-500">
                    <CalendarClock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-medium text-gray-700">{scheduleText(form)}.</strong> Só chega se o cliente já tiver escrito para o número uma vez: o relatório nunca puxa a conversa.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </section>
        </form>

        <DialogFooter className="items-center gap-2 border-t border-gray-100 bg-zinc-50/70 px-6 py-4 sm:justify-between sm:space-x-0">
          {editing ? (
            <Button type="button" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => void remove()} disabled={removing || saving}>
              {removing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Remover
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="cliente-whatsapp" disabled={saving || removing} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {editing ? 'Salvar' : 'Cadastrar cliente'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const WhatsAppAccess: React.FC<{ teamId: string }> = ({ teamId }) => {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const [contacts, setContacts] = useState<ClientContact[]>()
  const [questions, setQuestions] = useState<ClientQuestion[]>([])
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [missing, setMissing] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; editing?: ClientContact }>({ open: false })

  const load = useCallback(async () => {
    try {
      const [list, log] = await Promise.all([listContacts(teamId), listQuestions(teamId)])
      setContacts(list)
      setQuestions(log)
      setMissing(false)
    } catch (error) {
      if (message(error) === NO_TABLE) setMissing(true)
      else toast.error('Não deu para ler os clientes do WhatsApp', { description: message(error) })
      setContacts([])
    }
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    listAccounts()
      .then((all) => setAccounts(all.map((a) => ({ id: a.id, name: a.isHome ? `${a.name} (conta da casa)` : a.name }))))
      .catch(() => undefined)
  }, [])

  const accountName = useMemo(() => (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Conta', [accounts])

  const toggle = async (contact: ClientContact, enabled: boolean) => {
    try {
      await saveContact(teamId, { ...contact, enabled })
      await load()
    } catch (error) {
      toast.error('Não foi possível mudar', { description: message(error) })
    }
  }

  if (missing) {
    return (
      <Surface title="Clientes no WhatsApp">
        <p className="text-sm text-gray-600">
          Aplique a migração <code className="text-xs">20261028110000_crm_whatsapp_client_contacts.sql</code> no Supabase.
        </p>
      </Surface>
    )
  }

  return (
    <Surface
      title="Clientes no WhatsApp"
      action={
        admin && (
          <Button size="sm" className="gap-1.5" onClick={() => setDialog({ open: true })}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo cliente
          </Button>
        )
      }
    >
      <p className="flex items-start gap-2 text-[13px] leading-snug text-gray-600">
        <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <span>Cada número só vê os dados da própria conta, nos assuntos liberados. O serviço nunca puxa conversa: responde a quem escreve primeiro.</span>
      </p>

      {contacts === undefined ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Lendo…
        </p>
      ) : contacts.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhum cliente cadastrado</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">Cadastre o número de quem vai conversar com a Avence pelo WhatsApp e receber os relatórios da conta.</p>
          {admin && (
            <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setDialog({ open: true })}>
              <Plus className="h-4 w-4" aria-hidden />
              Cadastrar o primeiro
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {contacts.map((c) => {
            const topics = ACCESS_TOPICS.filter((t) => c.topics.includes(t.id))
            return (
              <li key={c.phone} className={cn('flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors', !c.enabled && 'bg-gray-50')}>
                <Avatar id={c.accountId} name={c.name || accountName(c.accountId)} size="md" className="h-10 w-10 text-xs" />
                <div className={cn('min-w-0 flex-1', !c.enabled && 'opacity-60')}>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="truncate font-medium text-gray-900">{c.name || formatPhone(c.phone)}</span>
                    <span className="truncate text-xs text-gray-500">{accountName(c.accountId)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs tabular-nums text-gray-500">{formatPhone(c.phone)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {topics.map((t) => (
                      <span key={t.id} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
                        {t.label}
                      </span>
                    ))}
                    <span className={cn('ml-1 inline-flex items-center gap-1 text-[11px]', c.reports ? 'text-gray-700' : 'text-gray-400')}>
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {c.reports ? scheduleText(c) : 'Sem relatório'}
                    </span>
                  </div>
                </div>
                {admin ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Switch checked={c.enabled} onCheckedChange={(enabled) => void toggle(c, enabled)} aria-label={`Atendimento de ${c.name || c.phone} ligado`} />
                    <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, editing: c })} aria-label={`Editar ${c.name || c.phone}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                ) : (
                  <span className={cn('shrink-0 text-[11px] font-medium', c.enabled ? 'text-emerald-700' : 'text-gray-400')}>{c.enabled ? 'Ligado' : 'Desligado'}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {questions.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
            Últimas perguntas
          </p>
          <ul className="mt-2 divide-y divide-gray-100">
            {questions.map((q) => (
              <li key={q.id} className="grid gap-0.5 py-2 sm:grid-cols-[9rem_1fr] sm:gap-3">
                <span className="text-[11px] text-gray-500">
                  {whenLabel(q.at)} · {contacts?.find((c) => c.phone.slice(-8) === q.phone.slice(-8))?.name || formatPhone(q.phone)}
                </span>
                <span className="min-w-0 truncate text-xs text-gray-700">“{q.question}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ClientDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} editing={dialog.editing} accounts={accounts} teamId={teamId} onSaved={load} />
    </Surface>
  )
}
