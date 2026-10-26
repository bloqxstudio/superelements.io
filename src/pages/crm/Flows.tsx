import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Loader2, MessageCircle, Pause, Play, Plus, RefreshCw, SkipForward, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { listClients } from '@/features/crm/clients'
import { useCrm } from '@/features/crm/crmStore'
import { listOpportunities } from '@/features/crm/opportunities'
import { personLabel } from '@/features/crm/people'
import { callPath } from '@/features/crm/call'
import { canManage, type Client } from '@/features/crm/types'
import { FIELD, Page, PageHeader, Surface, plural } from '@/features/crm/ui'
import { loadChats, type WaChat } from '@/features/crm/whatsappChats'
import {
  DAILY_LIMIT,
  FlowError,
  KIND_LABEL,
  KIND_STAGES,
  PRESETS,
  VARIABLES,
  advanceRun,
  clientPhone,
  deleteFlow,
  isDue,
  listFlows,
  listRuns,
  newStepId,
  removeRun,
  renderText,
  repliedSince,
  saveFlow,
  sendStep,
  sentToday,
  setRunStatus,
  startRuns,
  type Flow,
  type FlowKind,
  type FlowRun,
  type FlowStep,
} from '@/features/crm/flows'
import type { Opportunity } from '@/features/prospects/funnel'
import { STAGES } from '@/features/prospects/funnel'
import { cn } from '@/lib/utils'

/**
 * Fluxos (CRM › Fluxos): a rotina comercial em sequências de mensagens de
 * WhatsApp. "Rotina de hoje" lista quem está na vez de cada fluxo, com o texto
 * pronto para conferir e enviar; "Fluxos" é onde a equipe monta as sequências
 * e põe clientes do funil nelas. Quem envia é sempre a pessoa, um clique por
 * mensagem, com limite por dia.
 */

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id

interface Data {
  flows: Flow[]
  runs: FlowRun[]
  clients: Map<string, Client>
  opportunities: Map<string, Opportunity>
  chats: WaChat[]
  sent: number
}

export default function CrmFlows() {
  const team = useCrm((s) => s.team)
  const { user } = useAuth()
  const [tab, setTab] = useState<'rotina' | 'fluxos'>('rotina')
  const [data, setData] = useState<Data>()
  const [failure, setFailure] = useState<FlowError>()

  const load = useCallback(async () => {
    if (!team || !user) return
    try {
      const [flows, runs] = await Promise.all([listFlows(team.id), listRuns(team.id)])
      const [clients, opportunities, chats, sent] = await Promise.all([
        listClients(),
        listOpportunities(),
        loadChats(team.id).catch(() => [] as WaChat[]),
        sentToday(team.id, user.id),
      ])
      setData({
        flows,
        runs,
        clients: new Map(clients.map((c) => [c.id, c])),
        opportunities: new Map(opportunities.map((o) => [o.id, o])),
        chats,
        sent,
      })
      setFailure(undefined)
    } catch (error) {
      setFailure(error instanceof FlowError ? error : new FlowError(errorText(error)))
    }
  }, [team, user])

  useEffect(() => {
    setData(undefined)
    void load()
  }, [load])

  if (!team || !user) return null

  return (
    <Page wide>
      <PageHeader title="Fluxos" text="Sequências de mensagens de WhatsApp para a prospecção e o atendimento. A rotina do dia mostra quem está na vez, com o texto pronto: você confere e envia." />
      <div className="mt-5 flex gap-1 border-b border-gray-200" role="tablist">
        {(['rotina', 'fluxos'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800')}
          >
            {id === 'rotina' ? 'Rotina de hoje' : 'Fluxos'}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {failure ? (
          <Surface title={failure.code === 'no_tables' ? 'Falta preparar os fluxos' : 'Não deu para ler os fluxos'}>
            <p className="text-sm text-gray-600">{failure.message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar de novo
            </Button>
          </Surface>
        ) : !data ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Lendo os fluxos…
          </p>
        ) : tab === 'rotina' ? (
          <Routine data={data} teamId={team.id} seller={personLabel(user.email)} reload={load} goFlows={() => setTab('fluxos')} />
        ) : (
          <Flows data={data} teamId={team.id} userId={user.id} manager={canManage(team.role)} reload={load} />
        )}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------- rotina

const Routine: React.FC<{ data: Data; teamId: string; seller: string; reload: () => Promise<void>; goFlows: () => void }> = ({ data, teamId, seller, reload, goFlows }) => {
  const { flows, runs, clients, opportunities, chats, sent } = data
  const flowOf = (run: FlowRun) => flows.find((f) => f.id === run.flowId)
  const now = Date.now()

  // Quem respondeu depois do último envio sai da fila e vira "Responderam"
  const replied = useMemo(
    () => runs.filter((r) => r.status === 'replied' || (r.status === 'running' && repliedSince(r, clientPhone(clients.get(r.clientId) ?? ({} as Client)), chats))),
    [runs, clients, chats]
  )
  useEffect(() => {
    const fresh = replied.filter((r) => r.status === 'running')
    if (!fresh.length) return
    void Promise.all(fresh.map((r) => setRunStatus(r.id, 'replied')))
      .then(reload)
      .catch((error) => console.error('[fluxos] não marcou a resposta', error))
  }, [replied, reload])

  const repliedIds = new Set(replied.map((r) => r.id))
  const due = runs.filter((r) => isDue(r, now) && !repliedIds.has(r.id) && flowOf(r)?.active && clients.has(r.clientId))
  const waiting = runs.filter((r) => r.status === 'running' && !isDue(r, now) && !repliedIds.has(r.id))
  const left = Math.max(0, DAILY_LIMIT - sent)

  return (
    <div className="max-w-3xl space-y-8">
      <p className="text-sm text-gray-600">
        Hoje você já enviou <strong className="tabular-nums">{sent}</strong> de {DAILY_LIMIT} mensagens (o limite protege o número da equipe).{' '}
        {due.length > 0 ? `${plural(due.length, 'cliente está', 'clientes estão')} na vez.` : 'Ninguém está na vez agora.'}
        {waiting.length > 0 && ` ${plural(waiting.length, 'aguarda o prazo', 'aguardam o prazo')}.`}
      </p>

      {!flows.length && (
        <Surface title="Nenhum fluxo ainda">
          <p className="text-sm text-gray-600">Crie um fluxo (há modelos prontos de prospecção e de atendimento), ponha clientes do funil nele e a rotina aparece aqui.</p>
          <Button size="sm" className="mt-4" onClick={goFlows}>
            Montar o primeiro fluxo
          </Button>
        </Surface>
      )}

      {due.length > 0 && (
        <section aria-label="Na vez">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Na vez</h2>
          <ul className="space-y-3">
            {due.map((run) => (
              <DueCard
                key={run.id}
                run={run}
                flow={flowOf(run)!}
                client={clients.get(run.clientId)!}
                stage={run.opportunityId ? opportunities.get(run.opportunityId)?.stage : undefined}
                teamId={teamId}
                seller={seller}
                blocked={left === 0}
                reload={reload}
              />
            ))}
          </ul>
        </section>
      )}

      {replied.length > 0 && (
        <section aria-label="Responderam">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Responderam</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {replied.map((run) => {
              const client = clients.get(run.clientId)
              if (!client) return null
              return (
                <li key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/crm/clientes/${client.id}`} className="truncate text-sm font-medium text-gray-900 hover:underline">
                      {client.name}
                    </Link>
                    <p className="text-xs text-gray-500">{flowOf(run)?.name} · respondeu, o fluxo parou</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={callPath({ phone: client.whatsapp ?? client.phone, name: client.name, clientId: client.id, opportunityId: run.opportunityId })}>
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Abrir a conversa
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void removeRun(run.id).then(reload)}>
                    Concluir
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {runs.some((r) => r.status === 'paused') && (
        <section aria-label="Pausados">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Pausados</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {runs
              .filter((r) => r.status === 'paused' && clients.has(r.clientId))
              .map((run) => (
                <li key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-gray-900">{clients.get(run.clientId)!.name}</span>
                  <span className="hidden text-xs text-gray-500 sm:inline">{flowOf(run)?.name}</span>
                  <Button size="sm" variant="outline" onClick={() => void setRunStatus(run.id, 'running').then(reload)}>
                    Retomar
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section aria-label="Aguardando">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Aguardando o prazo</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {waiting.map((run) => {
              const client = clients.get(run.clientId)
              const flow = flowOf(run)
              if (!client || !flow) return null
              const days = Math.max(1, Math.ceil((run.nextAt - now) / 86_400_000))
              return (
                <li key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-gray-900">{client.name}</span>
                  <span className="hidden text-xs text-gray-500 sm:inline">{flow.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    passo {run.step + 1} de {flow.steps.length} em {plural(days, 'dia', 'dias')}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

const DueCard: React.FC<{
  run: FlowRun
  flow: Flow
  client: Client
  stage?: string
  teamId: string
  seller: string
  blocked: boolean
  reload: () => Promise<void>
}> = ({ run, flow, client, stage, teamId, seller, blocked, reload }) => {
  const step = flow.steps[run.step]
  const [text, setText] = useState(() => renderText(step?.text ?? '', { company: client.name, city: client.city, seller }))
  const [busy, setBusy] = useState(false)
  const phone = clientPhone(client)

  const act = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    try {
      await fn()
      if (done) toast.success(done)
      await reload()
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }

  if (!step) return null
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Link to={`/crm/clientes/${client.id}`} className="text-sm font-semibold text-gray-900 hover:underline">
          {client.name}
        </Link>
        <span className="text-xs text-gray-500">
          {flow.name} · passo {run.step + 1} de {flow.steps.length}
          {stage && ` · ${stageLabel(stage)}`}
        </span>
      </div>
      {phone ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={cn(FIELD, 'mt-3 resize-y py-2')} aria-label={`Mensagem para ${client.name}`} />
      ) : (
        <p className="mt-3 text-sm text-amber-800">Sem WhatsApp nem telefone no cadastro. Complete a ficha para enviar.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || blocked || !phone || !text.trim()} onClick={() => void act(() => sendStep(teamId, run, flow, client, text.trim(), stage as never), `Mensagem enviada para ${client.name}`)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          Enviar
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => advanceRun(run, flow, false))}>
          <SkipForward className="h-4 w-4" aria-hidden />
          Pular
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => setRunStatus(run.id, 'paused'))}>
          <Pause className="h-4 w-4" aria-hidden />
          Pausar
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => removeRun(run.id))}>
          Tirar do fluxo
        </Button>
        {blocked && <span className="text-xs text-amber-800">Limite de hoje atingido. Volte amanhã.</span>}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------- fluxos

const emptyFlow = (): Omit<Flow, 'id'> => ({ name: '', kind: 'prospeccao', active: true, steps: [{ id: newStepId(), wait: 0, text: '' }] })

const Flows: React.FC<{ data: Data; teamId: string; userId: string; manager: boolean; reload: () => Promise<void> }> = ({ data, teamId, userId, manager, reload }) => {
  const [editing, setEditing] = useState<{ id?: string; draft: Omit<Flow, 'id'> }>()
  const [adding, setAdding] = useState<Flow>()
  const counts = (flow: Flow) => data.runs.filter((r) => r.flowId === flow.id && r.status === 'running').length

  return (
    <div className="max-w-3xl space-y-4">
      {editing ? (
        <FlowEditor
          initial={editing.draft}
          id={editing.id}
          teamId={teamId}
          manager={manager}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined)
            await reload()
          }}
        />
      ) : adding ? (
        <AddClients flow={adding} data={data} teamId={teamId} userId={userId} onClose={() => setAdding(undefined)} onDone={reload} />
      ) : (
        <>
          {manager ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setEditing({ draft: emptyFlow() })}>
                <Plus className="h-4 w-4" aria-hidden />
                Novo fluxo
              </Button>
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing({ draft: { name: preset.name, kind: preset.kind, active: true, steps: preset.steps.map((s) => ({ ...s, id: newStepId() })) } })}
                >
                  Modelo: {KIND_LABEL[preset.kind]}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Quem gerencia a equipe monta os fluxos. Você pode pôr clientes neles.</p>
          )}
          {!data.flows.length && <p className="text-sm text-gray-500">Nenhum fluxo ainda.</p>}
          <ul className="space-y-3">
            {data.flows.map((flow) => (
              <li key={flow.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{flow.name}</p>
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700">{KIND_LABEL[flow.kind]}</span>
                  {!flow.active && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Pausado</span>}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {plural(flow.steps.length, 'passo', 'passos')} · {plural(counts(flow), 'cliente rodando', 'clientes rodando')}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" disabled={!flow.active} onClick={() => setAdding(flow)}>
                    Pôr clientes
                  </Button>
                  {manager && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: flow.id, draft: { name: flow.name, kind: flow.kind, active: flow.active, steps: flow.steps } })}>
                      Editar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const FlowEditor: React.FC<{
  initial: Omit<Flow, 'id'>
  id?: string
  teamId: string
  manager: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}> = ({ initial, id, teamId, manager, onClose, onSaved }) => {
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const setStep = (index: number, patch: Partial<FlowStep>) => setDraft((d) => ({ ...d, steps: d.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }))
  const move = (index: number, by: number) =>
    setDraft((d) => {
      const steps = [...d.steps]
      ;[steps[index], steps[index + by]] = [steps[index + by], steps[index]]
      return { ...d, steps }
    })

  const save = async () => {
    const steps = draft.steps.filter((s) => s.text.trim()).map((s, i) => ({ ...s, text: s.text.trim(), wait: i === 0 ? Math.max(0, s.wait) : Math.max(0, s.wait) }))
    if (!draft.name.trim()) return toast.error('Dê um nome ao fluxo.')
    if (!steps.length) return toast.error('Escreva ao menos uma mensagem.')
    setBusy(true)
    try {
      await saveFlow(teamId, { ...draft, steps }, id)
      await onSaved()
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!id) return
    setBusy(true)
    try {
      await deleteFlow(id)
      await onSaved()
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }

  return (
    <Surface title={id ? 'Editar o fluxo' : 'Novo fluxo'} action={<Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" aria-hidden /></Button>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="text-sm text-gray-700">
          Nome
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={cn(FIELD, 'mt-1 h-9')} placeholder="Prospecção de clínicas" />
        </label>
        <label className="text-sm text-gray-700">
          Tipo
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as FlowKind })} className={cn(FIELD, 'mt-1 h-9')}>
            {(Object.keys(KIND_LABEL) as FlowKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Variáveis: {VARIABLES.map((v) => `${v.name} (${v.hint})`).join(' · ')}. Fale de contatos e do WhatsApp, sem prometer resultado.
      </p>
      <ol className="mt-4 space-y-3">
        {draft.steps.map((step, index) => (
          <li key={step.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">Passo {index + 1}</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                {index === 0 ? 'Começa' : 'Depois de'}
                <input
                  type="number"
                  min={0}
                  value={step.wait}
                  onChange={(e) => setStep(index, { wait: Number(e.target.value) || 0 })}
                  className={cn(FIELD, 'h-8 w-16')}
                />
                {index === 0 ? 'dias (0 = na hora)' : 'dias'}
              </label>
              <span className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" aria-hidden /></Button>
                <Button variant="ghost" size="sm" disabled={index === draft.steps.length - 1} onClick={() => move(index, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" aria-hidden /></Button>
                <Button variant="ghost" size="sm" disabled={draft.steps.length === 1} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })} aria-label="Tirar o passo"><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </span>
            </div>
            <textarea value={step.text} onChange={(e) => setStep(index, { text: e.target.value })} rows={3} className={cn(FIELD, 'mt-2 resize-y py-2')} placeholder="Olá, {nome}! Aqui é {vendedor}, da Avence Studio…" />
          </li>
        ))}
      </ol>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { id: newStepId(), wait: 2, text: '' }] })}>
        <Plus className="h-4 w-4" aria-hidden />
        Adicionar passo
      </Button>
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
        Fluxo ativo (pausado, não entra na rotina)
      </label>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void save()} disabled={busy || !manager}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        {id && (
          <Button size="sm" variant="ghost" className="ml-auto text-red-700" onClick={() => void remove()} disabled={busy}>
            Apagar o fluxo
          </Button>
        )}
      </div>
    </Surface>
  )
}

const AddClients: React.FC<{ flow: Flow; data: Data; teamId: string; userId: string; onClose: () => void; onDone: () => Promise<void> }> = ({ flow, data, teamId, userId, onClose, onDone }) => {
  const navigate = useNavigate()
  const running = new Set(data.runs.filter((r) => r.flowId === flow.id && r.status === 'running').map((r) => r.clientId))
  const stages = KIND_STAGES[flow.kind]
  const candidates = useMemo(
    () =>
      [...data.opportunities.values()].filter((o) => stages.includes(o.stage) && !running.has(o.clientId) && data.clients.has(o.clientId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, flow]
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const start = async () => {
    setBusy(true)
    try {
      const targets = candidates.filter((o) => picked.has(o.id)).map((o) => ({ clientId: o.clientId, opportunityId: o.id }))
      const { started } = await startRuns(teamId, flow, targets, userId)
      toast.success(`${plural(started, 'cliente entrou', 'clientes entraram')} no fluxo`)
      await onDone()
      navigate('/crm/fluxos')
      onClose()
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }

  return (
    <Surface title={`Pôr clientes em “${flow.name}”`} action={<Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" aria-hidden /></Button>}>
      <p className="text-sm text-gray-600">
        Do funil, nas etapas {stages.map(stageLabel).join(', ')}. Sem WhatsApp ou telefone no cadastro, o cliente não entra na vez.
      </p>
      {candidates.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Ninguém nessas etapas fora do fluxo.</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2 text-xs">
            <button className="text-gray-700 underline" onClick={() => setPicked(new Set(candidates.filter((o) => clientPhone(data.clients.get(o.clientId)!)).map((o) => o.id)))}>
              Marcar todos com telefone
            </button>
            <button className="text-gray-700 underline" onClick={() => setPicked(new Set())}>
              Limpar
            </button>
          </div>
          <ul className="mt-2 max-h-96 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {candidates.map((o) => {
              const client = data.clients.get(o.clientId)!
              const phone = clientPhone(client)
              return (
                <li key={o.id}>
                  <label className={cn('flex items-center gap-3 px-3 py-2 text-sm', !phone && 'opacity-50')}>
                    <input type="checkbox" checked={picked.has(o.id)} disabled={!phone} onChange={() => toggle(o.id)} />
                    <span className="min-w-0 flex-1 truncate text-gray-900">{client.name}</span>
                    <span className="shrink-0 text-xs text-gray-500">{phone ? stageLabel(o.stage) : 'sem telefone'}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <div className="mt-4 flex gap-2">
        <Button size="sm" disabled={busy || picked.size === 0} onClick={() => void start()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Pôr {picked.size ? plural(picked.size, 'cliente', 'clientes') : 'clientes'} no fluxo
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Surface>
  )
}
