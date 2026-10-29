import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { listAccounts } from '@/features/crm/teams'
import { FIELD, Surface, whenLabel } from '@/features/crm/ui'
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
} from '@/features/crm/clientAccess'
import { formatPhone } from '@/features/crm/whatsapp'

/**
 * Números de clientes que podem escrever para o WhatsApp da Avence e ver os dados
 * da própria conta (CRM › WhatsApp, só na conta da Avence). Quem cadastra é o admin
 * da plataforma; os gestores da Avence veem a lista e as últimas perguntas.
 */

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

type Schedule = Pick<ClientContact, 'reportKind' | 'reportHour' | 'reportWeekday' | 'reportMonthday'>

/** Quando o relatório sai: todo dia, toda semana (dia) ou todo mês (dia), numa hora cheia de São Paulo */
const ReportSchedule: React.FC<{ value: Schedule; disabled?: boolean; onChange: (patch: Partial<Schedule>) => void }> = ({ value, disabled, onChange }) => (
  <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
    <select className={`${FIELD} h-8 w-auto`} value={value.reportKind} disabled={disabled} onChange={(e) => onChange({ reportKind: e.target.value as Schedule['reportKind'] })} aria-label="Frequência do relatório">
      {REPORT_KINDS.map((k) => (
        <option key={k.id} value={k.id}>
          {k.label}
        </option>
      ))}
    </select>
    {value.reportKind === 'semanal' && (
      <select className={`${FIELD} h-8 w-auto`} value={value.reportWeekday} disabled={disabled} onChange={(e) => onChange({ reportWeekday: Number(e.target.value) })} aria-label="Dia da semana">
        {WEEKDAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
    )}
    {value.reportKind === 'mensal' && (
      <select className={`${FIELD} h-8 w-auto`} value={value.reportMonthday} disabled={disabled} onChange={(e) => onChange({ reportMonthday: Number(e.target.value) })} aria-label="Dia do mês">
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            dia {d}
          </option>
        ))}
      </select>
    )}
    <span>às</span>
    <select className={`${FIELD} h-8 w-auto`} value={value.reportHour} disabled={disabled} onChange={(e) => onChange({ reportHour: Number(e.target.value) })} aria-label="Hora do relatório">
      {Array.from({ length: 24 }, (_, h) => h).map((h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, '0')}h
        </option>
      ))}
    </select>
  </span>
)

export const WhatsAppAccess: React.FC<{ teamId: string }> = ({ teamId }) => {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const [contacts, setContacts] = useState<ClientContact[]>()
  const [questions, setQuestions] = useState<ClientQuestion[]>([])
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [missing, setMissing] = useState(false)
  const [draft, setDraft] = useState({ phone: '', name: '', accountId: '', topics: ['site', 'anuncios'] as AccessTopic[], reports: false, reportKind: 'semanal' as ClientContact['reportKind'], reportHour: 9, reportWeekday: 1, reportMonthday: 1 })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, log] = await Promise.all([listContacts(teamId), listQuestions(teamId)])
      setContacts(list)
      setQuestions(log)
      setMissing(false)
    } catch (error) {
      if (message(error) === NO_TABLE) setMissing(true)
      else toast.error('Não deu para ler os números de clientes', { description: message(error) })
      setContacts([])
    }
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!admin) return
    listAccounts()
      .then((all) => setAccounts(all.map((a) => ({ id: a.id, name: a.isHome ? `${a.name} (conta da casa)` : a.name }))))
      .catch(() => undefined)
  }, [admin])

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Conta'

  const add = async () => {
    const phone = cleanPhone(draft.phone)
    if (!phone) return toast.error('Telefone inválido', { description: 'Use DDD e número, por exemplo (51) 99999-0000.' })
    if (!draft.accountId) return toast.error('Escolha a conta do cliente')
    if (!draft.topics.length) return toast.error('Libere pelo menos um assunto')
    setBusy(true)
    try {
      await saveContact(teamId, { phone, accountId: draft.accountId, name: draft.name, topics: draft.topics, enabled: true, reports: draft.reports, reportKind: draft.reportKind, reportHour: draft.reportHour, reportWeekday: draft.reportWeekday, reportMonthday: draft.reportMonthday })
      setDraft({ ...draft, phone: '', name: '' })
      await load()
    } catch (error) {
      toast.error('Não foi possível cadastrar', { description: message(error) })
    } finally {
      setBusy(false)
    }
  }

  const change = async (contact: ClientContact, patch: Partial<ClientContact>) => {
    try {
      await saveContact(teamId, { ...contact, ...patch })
      await load()
    } catch (error) {
      toast.error('Não foi possível mudar', { description: message(error) })
    }
  }

  const remove = async (contact: ClientContact) => {
    try {
      await removeContact(teamId, contact.phone)
      await load()
    } catch (error) {
      toast.error('Não foi possível remover', { description: message(error) })
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
    <Surface title="Clientes no WhatsApp">
      <p className="text-sm text-gray-600">
        Quem estiver aqui pode escrever para este número e ver os dados da própria conta, inclusive a conta da casa (só leitura), e, se marcado, receber o relatório agendado. Quem não está não recebe resposta. O serviço nunca puxa conversa: só responde a quem escreve primeiro, e o relatório só chega a quem já escreveu uma vez.
      </p>
      {contacts === undefined ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Lendo…
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {contacts.length === 0 && <li className="py-2 text-sm text-gray-500">Nenhum número cadastrado.</li>}
          {contacts.map((c) => (
            <li key={c.phone} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {c.name || formatPhone(c.phone)} <span className="font-normal text-gray-500">· {accountName(c.accountId)}</span>
                </p>
                <p className="truncate text-xs text-gray-500">{formatPhone(c.phone)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ACCESS_TOPICS.map((t) => {
                    const on = c.topics.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!admin || (on && c.topics.length === 1)}
                        aria-pressed={on}
                        onClick={() => void change(c, { topics: on ? c.topics.filter((x) => x !== t.id) : [...c.topics, t.id] })}
                        className={`rounded-full border px-2 py-0.5 text-xs transition-colors disabled:cursor-default ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-400 line-through'}`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={c.reports} disabled={!admin} onChange={(e) => void change(c, { reports: e.target.checked })} />
                Recebe relatório
              </label>
              {c.reports && <ReportSchedule value={c} disabled={!admin} onChange={(patch) => void change(c, patch)} />}
              <Switch checked={c.enabled} disabled={!admin} onCheckedChange={(enabled) => void change(c, { enabled })} aria-label={`Número de ${c.name || c.phone} ligado`} />
              {admin && (
                <Button variant="ghost" size="icon" onClick={() => void remove(c)} aria-label="Remover número">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {admin && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input className={`${FIELD} h-9`} placeholder="Telefone com DDD" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <input className={`${FIELD} h-9`} placeholder="Nome da pessoa" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className={`${FIELD} h-9`} value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })} aria-label="Conta do cliente">
            <option value="">Conta do cliente…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
            {ACCESS_TOPICS.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.topics.includes(t.id)}
                  onChange={(e) => setDraft({ ...draft, topics: e.target.checked ? [...draft.topics, t.id] : draft.topics.filter((x) => x !== t.id) })}
                />
                {t.label}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" checked={draft.reports} onChange={(e) => setDraft({ ...draft, reports: e.target.checked })} />
            Recebe o relatório agendado (texto curto e gráfico) com os dados da conta
          </label>
          {draft.reports && (
            <div className="sm:col-span-2">
              <ReportSchedule value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
            </div>
          )}
          <Button className="sm:col-span-2 sm:justify-self-start" size="sm" onClick={() => void add()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Cadastrar número
          </Button>
        </div>
      )}
      {questions.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Últimas perguntas</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {questions.map((q) => (
              <li key={q.id} className="truncate">
                {whenLabel(q.at)} · {contacts?.find((c) => c.phone.slice(-8) === q.phone.slice(-8))?.name || formatPhone(q.phone)} ({accountName(q.accountId)}): “{q.question}”{q.answered ? '' : ' · sem assunto'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}
