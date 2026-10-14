import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Copy, ExternalLink, Facebook, Instagram, Linkedin, Loader2, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/features/crm/crmStore'
import { personLabel } from '@/features/crm/people'
import {
  DAILY_LIMIT,
  NETWORK_LABEL,
  NETWORKS,
  stepLabel,
  buildQueue,
  dayStart,
  loadSocial,
  logTouch,
  planFor,
  profileLabel,
  profileUrl,
  profilesOf,
  saveProfile,
  scriptFor,
  searchUrl,
  undoTouch,
  usageToday,
  type Bucket,
  type EndId,
  type LeadPlan,
  type Network,
  type SocialData,
  type StepId,
  type Task,
} from '@/features/crm/social'
import { FIELD, Page, PageHeader, dayLabel, plural } from '@/features/crm/ui'
import { rescore } from '@/features/prospects/api'
import { STAGE_LABEL, type Opportunity } from '@/features/prospects/funnel'
import { Chip, SURFACE } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * Social: a fila do dia nas redes para as empresas do funil (seguir, comentar,
 * a primeira mensagem, retomar), com o texto pronto e o limite do dia. A
 * pessoa clica em seguir e enviar no perfil dela; aqui o toque fica anotado e
 * a sequência anda sozinha (`src/features/crm/social.ts`).
 */

const ICON: Record<Network, React.ElementType> = { instagram: Instagram, linkedin: Linkedin, facebook: Facebook }

const BUCKET_LABEL: Record<Bucket, string> = { seguir: 'Seguir', comentar: 'Comentar', mensagem: 'Mensagens' }

const AUTO_OPEN_KEY = 'superelements-social-abrir-proximo'

const readAutoOpen = () => {
  try {
    return localStorage.getItem(AUTO_OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

const keyOf = (task: Task) => `${task.opportunity.id}:${task.network}:${task.step}`

const prepare = (o: Opportunity): Opportunity => ({ ...o, lead: rescore(o.lead) })

const openProfile = (task: Task) => window.open(profileUrl(task.network, task.profile), '_blank')

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const dueLabel = (due: number) => {
  const days = Math.round((due - dayStart(Date.now())) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return new Date(due).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

const advertises = (o: Opportunity) => (o.lead.scan?.ads ?? []).some((ad) => ad !== 'Tag Manager')

type Tab = 'hoje' | 'proximos' | 'pagina' | 'sem-perfil' | 'feitos'

// ---------------------------------------------------------------- peças

const NetworkIcon: React.FC<{ network: Network; className?: string }> = ({ network, className }) => {
  const Icon = ICON[network]
  return <Icon className={cn('h-4 w-4 shrink-0', className)} aria-label={NETWORK_LABEL[network]} />
}

const LeadLine: React.FC<{ o: Opportunity }> = ({ o }) => (
  <p className="truncate text-xs text-gray-500">
    {[o.lead.niche, o.lead.city ?? o.region.split(',')[0], STAGE_LABEL[o.stage]].filter(Boolean).join(' · ')}
    {advertises(o) && <span className="ml-1.5 rounded bg-gray-900 px-1 py-px text-[10px] font-medium text-white">Anuncia</span>}
  </p>
)

/** Os três perfis de um cliente, gravados no cadastro ao sair do campo. */
const ProfileEditor: React.FC<{
  plan: LeadPlan
  disabled: Network[]
  onSaved: (network: Network, value: string | undefined) => void
}> = ({ plan, disabled, onSaved }) => {
  const o = plan.opportunity
  const placeholder: Record<Network, string> = { instagram: '@perfil', linkedin: 'linkedin.com/in/… ou /company/…', facebook: 'facebook.com/…' }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {NETWORKS.map(({ id, label }) => (
        <ProfileField
          key={`${o.clientId}:${id}`}
          network={id}
          label={label}
          value={plan.profiles[id]}
          placeholder={placeholder[id]}
          search={searchUrl(id, o)}
          disabled={disabled.includes(id)}
          onSave={async (value) => {
            try {
              onSaved(id, await saveProfile(o.clientId, id, value))
            } catch (error) {
              toast.error(`Não foi possível gravar o ${label}`, { description: error instanceof Error ? error.message : undefined })
            }
          }}
        />
      ))}
    </div>
  )
}

const ProfileField: React.FC<{
  network: Network
  label: string
  value?: string
  placeholder: string
  search: string
  disabled?: boolean
  onSave: (value: string) => void
}> = ({ network, label, value, placeholder, search, disabled, onSave }) => {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <label className="block min-w-0">
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-gray-700">
        <span className="flex items-center gap-1.5">
          <NetworkIcon network={network} className="h-3.5 w-3.5 text-gray-500" />
          {label}
        </span>
        <a href={search} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-normal text-gray-500 hover:text-gray-900">
          <Search className="h-3 w-3" aria-hidden /> Procurar
        </a>
      </span>
      <input
        className={cn(FIELD, 'mt-1 h-9')}
        value={draft}
        placeholder={disabled ? 'Falta a migração' : placeholder}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== (value ?? '').trim() && onSave(draft)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}

/** O toque em foco: o que fazer, o texto, o perfil e as ações. */
const TaskCard: React.FC<{
  task: Task
  plan: LeadPlan
  sender: string
  busy: boolean
  locked: boolean
  migrationMissing: Network[]
  onDone: (task: Task, text?: string) => void
  onEnd: (task: Task, end: EndId) => void
  onSkip: (task: Task) => void
  onProfile: (plan: LeadPlan, network: Network, value: string | undefined) => void
}> = ({ task, plan, sender, busy, locked, migrationMissing, onDone, onEnd, onSkip, onProfile }) => {
  const o = task.opportunity
  const script = useMemo(() => scriptFor(task, sender), [task, sender])
  const [text, setText] = useState(script.text ?? '')
  const [editing, setEditing] = useState(false)
  useEffect(() => setText(script.text ?? ''), [script.text])

  const open = () => {
    openProfile(task)
    if (text.trim()) void copy(text).then((ok) => ok && toast.success('Texto copiado: é só colar'))
  }

  return (
    <article className={cn(SURFACE, 'p-4 md:p-5')} aria-label={`${o.lead.name}: ${stepLabel(task)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/crm/clientes/${o.clientId}`} className="block truncate text-base font-semibold text-gray-900 hover:underline">
            {o.lead.name}
          </Link>
          <LeadLine o={o} />
        </div>
        <a
          href={profileUrl(task.network, task.profile)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          <NetworkIcon network={task.network} className="h-3.5 w-3.5" />
          <span className="truncate">{profileLabel(task.network, task.profile)}</span>
        </a>
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-gray-900">{stepLabel(task)}</p>
        <p className="mt-0.5 text-sm text-gray-600">{script.hint}</p>
        {script.text !== undefined && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={task.step === 'mensagem' ? 5 : 3}
              className={cn(FIELD, 'mt-3 py-2 leading-relaxed')}
              aria-label="Texto para copiar"
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-500">
              <span className={cn('tabular-nums', task.network === 'linkedin' && task.step === 'seguir' && text.length > 200 && 'font-medium text-rose-700')}>
                {text.length} caracteres
              </span>
              <button type="button" onClick={() => void copy(text).then((ok) => ok && toast.success('Copiado'))} className="inline-flex items-center gap-1 hover:text-gray-900">
                <Copy className="h-3 w-3" aria-hidden /> Copiar
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={open} className="gap-1.5">
          <ExternalLink className="h-4 w-4" /> Abrir {NETWORK_LABEL[task.network]}
          {text.trim() ? ' e copiar' : ''}
        </Button>
        <Button onClick={() => onDone(task, script.text !== undefined ? text : undefined)} disabled={busy || locked}>
          {busy ? 'Anotando…' : 'Feito'}
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => onEnd(task, 'resposta')} disabled={busy || locked} title="Responderam: a empresa vai para Em conversa">
          Responderam
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onSkip(task)} disabled={busy}>
          Pular hoje
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEnd(task, 'pausa')} disabled={busy || locked} className="text-gray-500" title="Tira a empresa da fila das redes">
          Tirar da fila
        </Button>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3">
        {editing ? (
          <ProfileEditor plan={plan} disabled={migrationMissing} onSaved={(network, value) => onProfile(plan, network, value)} />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-gray-900">
            Perfis: {NETWORKS.filter((n) => plan.profiles[n.id]).map((n) => n.label).join(', ') || 'nenhum'} · Editar
          </button>
        )}
      </div>
    </article>
  )
}

/** Linha de um toque fora do foco (na fila, para os próximos dias, esperando a página). */
const TaskRow: React.FC<{ task: Task; meta?: React.ReactNode; action?: React.ReactNode; onClick?: () => void }> = ({ task, meta, action, onClick }) => (
  <li className="flex items-center gap-3 px-4 py-3">
    <NetworkIcon network={task.network} className="text-gray-500" />
    <div className="min-w-0 flex-1">
      {onClick ? (
        <button type="button" onClick={onClick} className="block max-w-full truncate text-left text-sm font-medium text-gray-900 hover:underline">
          {task.opportunity.lead.name}
        </button>
      ) : (
        <Link to={`/crm/clientes/${task.opportunity.clientId}`} className="block truncate text-sm font-medium text-gray-900 hover:underline">
          {task.opportunity.lead.name}
        </Link>
      )}
      <p className="truncate text-xs text-gray-500">
        {stepLabel(task)}
        {meta && <> · {meta}</>}
      </p>
    </div>
    {action}
  </li>
)

const List: React.FC<{ children: React.ReactNode; empty: string; count: number }> = ({ children, empty, count }) =>
  count ? <ul className={cn(SURFACE, 'divide-y divide-gray-100')}>{children}</ul> : <p className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">{empty}</p>

// ---------------------------------------------------------------- tela

const Social: React.FC = () => {
  const { user, profile } = useAuth()
  const team = useCrm((s) => s.team)
  const pipeline = useCrm((s) => s.pipeline)
  const [data, setData] = useState<SocialData | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>('hoje')
  const [current, setCurrent] = useState<string>()
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  const [forced, setForced] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState<string>()
  const [autoOpen, setAutoOpen] = useState(readAutoOpen)
  const loadedAt = useRef(0)

  const sender = personLabel(profile?.email ?? user?.email ?? undefined).split(' ')[0] || '[seu nome]'

  const read = useCallback(() => {
    if (!pipeline) return
    setFailed(false)
    loadedAt.current = Date.now()
    loadSocial()
      .then((d) => setData({ ...d, opportunities: d.opportunities.map(prepare) }))
      .catch((error) => {
        console.error('[social] falha ao ler a fila', error)
        setFailed(true)
      })
  }, [pipeline])

  useEffect(read, [read])

  // Voltando da aba da rede depois de um tempo: relê (alguém da equipe pode ter mexido)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > 5 * 60_000) read()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [read])

  const plans = useMemo(
    () => (data ? data.opportunities.map((o) => planFor(o, profilesOf(o, data.saved.get(o.clientId)), data.touches)) : []),
    [data]
  )
  const planOf = useMemo(() => new Map(plans.map((p) => [p.opportunity.id, p])), [plans])
  const usage = useMemo(() => usageToday(data?.touches ?? [], user?.id), [data, user])
  const queue = useMemo(() => buildQueue(plans.filter((p) => p.state === 'ativo'), usage, forced), [plans, usage, forced])
  const today = useMemo(() => queue.today.filter((t) => !skipped.has(keyOf(t))), [queue, skipped])
  const noProfile = useMemo(() => plans.filter((p) => p.state === 'sem-perfil').sort((a, b) => b.opportunity.lead.score - a.opportunity.lead.score), [plans])
  const finished = useMemo(() => plans.filter((p) => p.state === 'feito').sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0)), [plans])

  const focused = today.find((t) => keyOf(t) === current) ?? today[0]
  /** O toque que vem depois deste na lista de hoje (no fim, volta ao começo). */
  const after = (task: Task): Task | undefined => {
    const at = today.findIndex((t) => keyOf(t) === keyOf(task))
    const rest = today.filter((t) => keyOf(t) !== keyOf(task))
    return rest[Math.max(0, at)] ?? rest[0]
  }

  const migrationMissing: Network[] = data?.needsMigration ? ['linkedin', 'facebook'] : []

  const setOpportunity = (o: Opportunity | undefined) =>
    o && setData((d) => (d ? { ...d, opportunities: d.opportunities.map((x) => (x.id === o.id ? prepare(o) : x)) } : d))

  const record = async (task: Task, step: StepId | EndId, network: Network | undefined, text?: string) => {
    const key = keyOf(task)
    setBusy(key)
    try {
      const logged = await logTouch(task.opportunity, step, network, text)
      setData((d) => (d ? { ...d, touches: [...d.touches, logged.touch] } : d))
      setOpportunity(logged.opportunity)
      const name = task.opportunity.lead.name
      const title = step === 'resposta' ? `${name} foi para Em conversa` : step === 'pausa' ? `${name} saiu da fila` : `Anotado: ${name}`
      toast.success(title, {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void undoTouch(logged)
              .then((restored) => {
                setData((d) => (d ? { ...d, touches: d.touches.filter((t) => t.id !== logged.touch.id) } : d))
                setOpportunity(restored)
                setCurrent(key)
              })
              .catch((error) => toast.error('Não foi possível desfazer', { description: error instanceof Error ? error.message : undefined })),
        },
      })
      return true
    } catch (error) {
      toast.error('Não foi possível anotar', { description: error instanceof Error ? error.message : undefined })
      return false
    } finally {
      setBusy(undefined)
    }
  }

  const done = async (task: Task, text?: string) => {
    const next = after(task)
    // Abre já, ainda no clique (depois de esperar o banco, o navegador bloquearia a aba nova)
    if (autoOpen && next) openProfile(next)
    if (await record(task, task.step, task.network, text)) setCurrent(next ? keyOf(next) : undefined)
  }

  const end = async (task: Task, step: EndId) => {
    const next = after(task)
    if (await record(task, step, step === 'resposta' ? task.network : undefined)) setCurrent(next ? keyOf(next) : undefined)
  }

  const skip = (task: Task) => {
    const next = after(task)
    setSkipped((s) => new Set(s).add(keyOf(task)))
    setCurrent(next ? keyOf(next) : undefined)
  }

  const onProfile = (plan: LeadPlan, network: Network, value: string | undefined) =>
    setData((d) => {
      if (!d) return d
      const saved = new Map(d.saved)
      saved.set(plan.opportunity.clientId, { ...saved.get(plan.opportunity.clientId), [network]: value })
      return { ...d, saved }
    })

  const toggleAutoOpen = (on: boolean) => {
    setAutoOpen(on)
    try {
      localStorage.setItem(AUTO_OPEN_KEY, on ? '1' : '0')
    } catch {
      // Sem armazenamento: vale só nesta visita
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'hoje', label: 'Hoje', count: today.length },
    { id: 'proximos', label: 'Próximos dias', count: queue.upcoming.length + queue.overflow.length },
    { id: 'pagina', label: 'Esperando a página', count: queue.waitingPage.length },
    { id: 'sem-perfil', label: 'Sem perfil', count: noProfile.length },
    { id: 'feitos', label: 'Sequência feita', count: finished.length },
  ]

  return (
    <Page>
      <PageHeader
        title="Social"
        text={
          <>
            A fila do dia nas redes para as empresas do funil {pipeline?.name ?? ''}: seguir, comentar e a primeira mensagem, com o texto pronto. Você segue e envia no seu
            perfil; aqui o toque fica anotado e a sequência anda sozinha.
          </>
        }
      >
        <Button variant="outline" onClick={read} className="gap-1.5" aria-label="Atualizar a fila">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </PageHeader>

      {data?.needsMigration && (
        <div className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar a migração <code className="font-mono text-xs">20261014120000_crm_social.sql</code> no Supabase. Até lá dá para ver a fila e abrir os perfis, mas não para
            anotar os toques nem gravar LinkedIn e Facebook.
          </p>
        </div>
      )}

      {failed ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center" role="alert">
          <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-gray-900">Não foi possível ler a fila</h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">Confira a internet e tente de novo.</p>
          <Button onClick={read} className="mt-5">
            Tentar de novo
          </Button>
        </div>
      ) : data === null ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Montando a fila de {team?.name ?? 'equipe'}
        </p>
      ) : (
        <>
          {/* O que você já fez hoje em cada rede, contra o limite do dia */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {NETWORKS.map(({ id, label }) => (
              <div key={id} className={cn(SURFACE, 'px-4 py-3')}>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                  <NetworkIcon network={id} className="h-3.5 w-3.5 text-gray-500" /> {label} hoje
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(BUCKET_LABEL) as Bucket[])
                    .filter((b) => !(b === 'comentar' && id !== 'instagram'))
                    .map((b) => (
                      <div key={b}>
                        <dt className="text-[11px] text-gray-500">{BUCKET_LABEL[b]}</dt>
                        <dd className="text-sm font-semibold tabular-nums text-gray-900">
                          {usage[id][b]}
                          <span className="font-normal text-gray-400">/{DAILY_LIMIT[id][b]}</span>
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Instagram: seguir, comentar 2 dias depois, a mensagem 2 dias depois e retomar 4 dias depois. A conversa fica numa rede só; nas outras, só o primeiro toque. Os
            limites são por pessoa, bem abaixo do que bloqueia uma conta.
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Fila">
            {tabs.map((t) => (
              <Chip key={t.id} role="tab" aria-selected={tab === t.id} aria-pressed={undefined} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
                <span className={cn('tabular-nums', tab === t.id ? 'text-white/70' : 'text-gray-400')}>{t.count}</span>
              </Chip>
            ))}
          </div>

          <div className="mt-4" role="tabpanel">
            {tab === 'hoje' &&
              (focused ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">
                    <TaskCard
                      key={keyOf(focused)}
                      task={focused}
                      plan={planOf.get(focused.opportunity.id)!}
                      sender={sender}
                      busy={busy === keyOf(focused)}
                      locked={Boolean(data.needsMigration)}
                      migrationMissing={migrationMissing}
                      onDone={(t, text) => void done(t, text)}
                      onEnd={(t, step) => void end(t, step)}
                      onSkip={skip}
                      onProfile={onProfile}
                    />
                    <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={autoOpen} onChange={(e) => toggleAutoOpen(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
                      Abrir o próximo perfil ao marcar Feito (feche a aba da rede com Ctrl+W e volte aqui)
                    </label>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs font-medium text-gray-500">{plural(today.length, 'toque hoje', 'toques hoje')}</p>
                    <ul className={cn(SURFACE, 'max-h-[560px] divide-y divide-gray-100 overflow-y-auto')}>
                      {today.map((t) => (
                        <li key={keyOf(t)}>
                          <button
                            type="button"
                            onClick={() => setCurrent(keyOf(t))}
                            aria-current={keyOf(t) === keyOf(focused) || undefined}
                            className={cn('flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50', keyOf(t) === keyOf(focused) && 'bg-gray-100')}
                          >
                            <NetworkIcon network={t.network} className="h-3.5 w-3.5 text-gray-500" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-gray-900">{t.opportunity.lead.name}</span>
                              <span className="block truncate text-[11px] text-gray-500">{stepLabel(t)}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">
                  {queue.today.length ? 'Os toques que sobraram foram pulados hoje.' : 'Nada para hoje.'}{' '}
                  {queue.upcoming.length + queue.overflow.length > 0 && <>Os próximos estão em "Próximos dias".</>}
                  {noProfile.length > 0 && <> {plural(noProfile.length, 'empresa ainda não tem', 'empresas ainda não têm')} perfil: veja em "Sem perfil".</>}
                </p>
              ))}

            {tab === 'proximos' && (
              <div className="grid gap-4">
                {queue.overflow.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-gray-500">O limite de hoje acabou para estes: ficam para amanhã.</p>
                    <List count={queue.overflow.length} empty="">
                      {queue.overflow.map((t) => (
                        <TaskRow key={keyOf(t)} task={t} meta="amanhã" />
                      ))}
                    </List>
                  </div>
                )}
                <List count={queue.upcoming.length} empty="Nenhum toque marcado para os próximos dias.">
                  {queue.upcoming.map((t) => (
                    <TaskRow key={keyOf(t)} task={t} meta={dueLabel(t.due)} />
                  ))}
                </List>
              </div>
            )}

            {tab === 'pagina' && (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  A primeira mensagem oferece a página nova pronta, o que converte mais. Estas empresas ainda estão em Mapeado ou Fila da página.
                </p>
                <List count={queue.waitingPage.length} empty="Nenhuma mensagem esperando página.">
                  {queue.waitingPage.map((t) => (
                    <TaskRow
                      key={keyOf(t)}
                      task={t}
                      meta={STAGE_LABEL[t.opportunity.stage]}
                      action={
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/crm?oportunidade=${t.opportunity.id}`}>No funil</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setForced((s) => new Set(s).add(t.opportunity.id))
                              setCurrent(keyOf(t))
                              setTab('hoje')
                            }}
                          >
                            Mandar sem a prévia
                          </Button>
                        </div>
                      }
                    />
                  ))}
                </List>
              </>
            )}

            {tab === 'sem-perfil' && (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  A leitura do site não achou rede social destas empresas. Procure, confira se é o perfil certo e cole aqui: a empresa entra na fila na hora.
                </p>
                {noProfile.length ? (
                  <ul className="grid gap-3">
                    {noProfile.slice(0, 60).map((plan) => (
                      <li key={plan.opportunity.id} className={cn(SURFACE, 'p-4')}>
                        <Link to={`/crm/clientes/${plan.opportunity.clientId}`} className="block truncate text-sm font-semibold text-gray-900 hover:underline">
                          {plan.opportunity.lead.name}
                        </Link>
                        <LeadLine o={plan.opportunity} />
                        <div className="mt-3">
                          <ProfileEditor plan={plan} disabled={migrationMissing} onSaved={(network, value) => onProfile(plan, network, value)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">Todas as empresas da fila têm algum perfil.</p>
                )}
                {noProfile.length > 60 && <p className="mt-3 text-xs text-gray-500">Mostrando 60 de {noProfile.length}, as de nota mais alta primeiro.</p>}
              </>
            )}

            {tab === 'feitos' && (
              <>
                <p className="mb-3 text-sm text-gray-600">Passaram pela sequência inteira. Se responderem, marque aqui; se não, marque como Perdido no funil, com o motivo.</p>
                <List count={finished.length} empty="Nenhuma empresa terminou a sequência ainda.">
                  {finished.map((plan) => {
                    const last = plan.touches.at(-1)
                    const task: Task = { opportunity: plan.opportunity, network: last?.network ?? plan.primary ?? 'instagram', profile: '', step: 'retomar', due: 0 }
                    return (
                      <li key={plan.opportunity.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <Link to={`/crm/clientes/${plan.opportunity.clientId}`} className="block truncate text-sm font-medium text-gray-900 hover:underline">
                            {plan.opportunity.lead.name}
                          </Link>
                          <p className="truncate text-xs text-gray-500">
                            {STAGE_LABEL[plan.opportunity.stage]}
                            {plan.lastAt && <> · último toque {dayLabel(plan.lastAt)}</>}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/crm?oportunidade=${plan.opportunity.id}`}>No funil</Link>
                        </Button>
                        <Button variant="outline" size="sm" disabled={Boolean(busy) || data.needsMigration} onClick={() => void end(task, 'resposta')}>
                          Responderam
                        </Button>
                      </li>
                    )
                  })}
                </List>
              </>
            )}
          </div>
        </>
      )}
    </Page>
  )
}

export default Social
