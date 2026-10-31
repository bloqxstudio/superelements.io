import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowDown, ArrowUp, Check, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Surface, FIELD, plural } from '@/features/crm/ui'
import { SOURCES } from '@/features/crm/types'
import { STAGES } from '@/features/prospects/funnel'
import { cn } from '@/lib/utils'
import { loadSources, saveFunnel, type Funnel, type Loaded, type Sources } from './funnels'
import { KIND_HELP, KIND_LABEL, MAX_STEPS, STAGE_ORDER, TEMPLATES, isConnected, validateFunnel, type FunnelStep, type StepKind } from './rules'

/**
 * Configurar um funil em quatro passos: objetivo → fontes disponíveis → etapas → revisar e salvar.
 * Serve para criar e para editar. Só gestor chega aqui (a tela e o banco conferem).
 */

const STEPS = ['Objetivo', 'Fontes', 'Etapas', 'Revisar'] as const
const KINDS = Object.keys(KIND_LABEL) as StepKind[]
const EVENT_SUGGESTIONS = ['whatsapp', 'telefone', 'email', 'formulario']
const STAGE_CHOICES = STAGES.filter((s) => (STAGE_ORDER as readonly string[]).includes(s.id))

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

interface Row {
  key: string
  step: FunnelStep
}
let counter = 0
const rowOf = (step: FunnelStep): Row => ({ key: `r${++counter}`, step })

/** Liga sozinho o que só tem uma opção na conta (um site, uma conta de anúncios, um formulário). */
function autofill(steps: FunnelStep[], sources: Sources): FunnelStep[] {
  const only = <T,>(l: Loaded<T>) => (l.state === 'ok' && l.items.length === 1 ? l.items[0] : undefined)
  const tracker = only(sources.trackers)
  const ad = only(sources.ads)
  const form = only(sources.forms)
  const next = steps.map((s) => {
    const source = { ...s.source }
    if ((s.kind === 'page' || s.kind === 'event') && !source.trackerId && tracker) source.trackerId = tracker.id
    if (s.kind === 'campaign' && !source.accountId && ad) source.accountId = ad.account.id
    if (s.kind === 'form' && !source.formIds?.length && form) source.formIds = [form.id]
    return { ...s, source }
  })
  const formStep = next.find((s) => s.kind === 'form')
  return next.map((s) => (s.kind === 'opportunity' && s.source.cohort === 'forms' && !s.source.formIds?.length && formStep ? { ...s, source: { ...s.source, formIds: formStep.source.formIds ?? [] } } : s))
}

// Alvo de toque de 40px no celular, 32px no desktop
const ACTION = 'inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 md:h-8 md:w-8'

// `content-start self-start`: quando a coluna ao lado é mais alta, o campo não estica o espaço entre rótulo e controle
const Field: React.FC<{ label: string; hint?: string; htmlFor: string; children: React.ReactNode }> = ({ label, hint, htmlFor, children }) => (
  <div className="grid min-w-0 content-start gap-1 self-start">
    <label htmlFor={htmlFor} className="text-xs font-medium text-gray-700">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
)

const SourceCard: React.FC<{ title: string; to: string; toLabel: string; loaded: Loaded<unknown> | undefined; describe: (n: number) => string; onRetry: () => void }> = ({ title, to, toLabel, loaded, describe, onRetry }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    {!loaded ? (
      <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lendo…
      </p>
    ) : loaded.state === 'ok' && loaded.items.length > 0 ? (
      <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
        <Check className="h-4 w-4" aria-hidden /> {describe(loaded.items.length)}
      </p>
    ) : loaded.state === 'ok' ? (
      <>
        <p className="mt-2 text-sm text-amber-800">Nada conectado ainda. As etapas desta fonte ficam sem número.</p>
        <Link to={to} className="mt-2 inline-block text-sm font-medium text-violet-700 hover:underline">
          {toLabel}
        </Link>
      </>
    ) : (
      <>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800" role="status">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {loaded.reason}
        </p>
        {loaded.state === 'error' && (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
          </Button>
        )}
      </>
    )}
  </div>
)

const LEAVE_MESSAGE = 'Há alterações neste funil que ainda não foram salvas. Sair e descartar?'

/**
 * Avisa antes de perder o rascunho: fechar ou recarregar a aba e clicar em qualquer link do app.
 * (O app usa BrowserRouter, sem `useBlocker`; o botão Voltar do navegador não pode ser interceptado aqui.)
 */
function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.origin !== window.location.origin || link.getAttribute('href')?.startsWith('#')) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])
}

export const FunnelWizard: React.FC<{ teamId: string; initial?: Funnel; onSaved: (id: string) => void; onDirtyChange?: (dirty: boolean) => void }> = ({ teamId, initial, onSaved, onDirtyChange }) => {
  const [stage, setStage] = useState(0)
  const [name, setName] = useState(initial?.name ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [template, setTemplate] = useState<Funnel['template']>(initial?.template ?? 'captacao')
  const [rows, setRowsRaw] = useState<Row[]>(() => (initial ? initial.steps.map(rowOf) : TEMPLATES[0].steps.map((s) => rowOf(structuredClone(s)))))
  const [sources, setSources] = useState<Sources>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  // Cada leitura de fontes tem um número; só a mais recente, da conta atual e ainda montada, vale
  const sourcesGen = useRef(0)
  const alive = useRef(true)
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      sourcesGen.current++
    }
  }, [])

  const readSources = useCallback(() => {
    const gen = ++sourcesGen.current
    setSources(undefined)
    void loadSources(teamId).then((s) => {
      if (gen !== sourcesGen.current) return
      setSources(s)
      // Num funil novo, liga o que só tem uma opção
      if (!initial) setRowsRaw((list) => autofill(list.map((r) => r.step), s).map((step, i) => ({ key: list[i].key, step })))
    })
  }, [teamId, initial])
  useEffect(readSources, [readSources])

  const steps = useMemo(() => rows.map((r) => r.step), [rows])
  const validation = useMemo(() => validateFunnel(name, steps), [name, steps])

  // Rascunho alterado em relação ao ponto de partida (o funil salvo, ou o modelo de um funil novo)
  const snapshot = (n: string, o: string, s: FunnelStep[]) => JSON.stringify([n.trim(), o.trim(), s.map((x) => [x.name.trim(), x.kind, x.source])])
  const baseline = useRef<string>()
  if (baseline.current === undefined) baseline.current = snapshot(initial?.name ?? '', initial?.objective ?? '', initial ? initial.steps : [])
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(false)
  // Mudanças feitas pela pessoa (o preenchimento automático das fontes usa `setRowsRaw` e não conta)
  const setRows: typeof setRowsRaw = (next) => {
    setTouched(true)
    setRowsRaw(next)
  }
  const dirty = !saved && (initial ? snapshot(name, objective, steps) !== baseline.current : touched || name.trim() !== '' || objective.trim() !== '')
  useUnsavedGuard(dirty)
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const pickTemplate = (id: 'captacao' | 'prospeccao' | 'custom') => {
    const t = TEMPLATES.find((x) => x.id === id)
    const base = t ? t.steps : [TEMPLATES[1].steps[0], TEMPLATES[1].steps[5]]
    const next = structuredClone(base)
    setTemplate(id)
    if (t && !objective.trim()) setObjective(t.objective)
    setRows((sources ? autofill(next, sources) : next).map(rowOf))
  }

  const update = (key: string, patch: (s: FunnelStep) => FunnelStep) =>
    setRows((list) => {
      const changed = list.map((r) => (r.key === key ? { ...r, step: patch(r.step) } : r))
      // O formulário da oportunidade acompanha o da etapa de envio enquanto forem o mesmo
      const before = list.find((r) => r.key === key)?.step
      const after = changed.find((r) => r.key === key)?.step
      if (before?.kind === 'form' && after?.kind === 'form') {
        return changed.map((r) =>
          r.step.kind === 'opportunity' && r.step.source.cohort === 'forms' && (r.step.source.formIds ?? []).join('|') === (before.source.formIds ?? []).join('|')
            ? { ...r, step: { ...r.step, source: { ...r.step.source, formIds: after.source.formIds ?? [] } } }
            : r
        )
      }
      return changed
    })

  const move = (index: number, by: -1 | 1) =>
    setRows((list) => {
      const to = index + by
      if (to < 0 || to >= list.length) return list
      const copy = [...list]
      ;[copy[index], copy[to]] = [copy[to], copy[index]]
      return copy
    })

  const addStep = (kind: StepKind) => {
    const defaults: Record<StepKind, FunnelStep['source']> = { campaign: { campaigns: [] }, page: {}, event: {}, form: { formIds: [] }, opportunity: { cohort: 'created' }, stage: {}, manual: {} }
    const fresh = autofill([{ name: KIND_LABEL[kind], kind, source: defaults[kind] }], sources ?? { trackers: { state: 'ok', items: [] }, forms: { state: 'ok', items: [] }, ads: { state: 'ok', items: [] } })
    setRows((list) => [...list, rowOf(fresh[0])])
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(undefined)
    try {
      const id = await saveFunnel({ id: initial?.id, teamId, name, objective, template: initial?.template ?? template, steps })
      // Resposta de um contexto que já saiu da tela (outra conta ou outro funil): sem aviso nem navegação
      if (!alive.current) return
      setSaved(true)
      toast.success(initial ? 'Funil salvo.' : 'Funil criado.')
      onSaved(id)
    } catch (e) {
      if (!alive.current) return
      setError(errorText(e))
      setSaving(false)
    }
  }

  // Foco no aviso quando a revisão tem erros ou o salvamento falha, para quem usa teclado ou leitor de tela
  const [alertTick, setAlertTick] = useState(0)
  useEffect(() => {
    if (alertTick) alertRef.current?.focus()
  }, [alertTick])
  useEffect(() => {
    if (error) setAlertTick((n) => n + 1)
  }, [error])

  // Enter nos campos avança; só na revisão grava
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (stage < STEPS.length - 1) {
      setStage((s) => s + 1)
      return
    }
    if (validation.errors.length > 0) {
      setAlertTick((n) => n + 1)
      return
    }
    void save()
  }

  const trackers = sources?.trackers.state === 'ok' ? sources.trackers.items : []
  const forms = sources?.forms.state === 'ok' ? sources.forms.items : []
  const ads = sources?.ads.state === 'ok' ? sources.ads.items : []
  const hasCampaignChoice = steps.some((s) => s.kind === 'campaign' && s.source.campaigns?.length)

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate aria-busy={saving}>
      <nav aria-label="Passos da configuração">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setStage(i)}
                aria-current={stage === i ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  stage === i ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:text-gray-900'
                )}
              >
                <span className="tabular-nums">{i + 1}</span> {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Enquanto grava, nenhum campo muda: o que foi enviado é o que está na tela */}
      <fieldset disabled={saving} className="m-0 grid min-w-0 gap-5 border-0 p-0">
      {stage === 0 && (
        <Surface title="Qual é o objetivo deste funil?">
          <div className="grid max-w-2xl gap-4">
            <Field label="Nome do funil" htmlFor="fn-name">
              <input id="fn-name" className={cn(FIELD, 'h-10')} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Captação do site novo" />
            </Field>
            <Field label="Objetivo" hint="Uma frase do que este funil precisa provar." htmlFor="fn-objective">
              <textarea id="fn-objective" className={cn(FIELD, 'min-h-[72px] py-2')} value={objective} maxLength={500} onChange={(e) => setObjective(e.target.value)} />
            </Field>
            {!initial && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-xs font-medium text-gray-700">Começar por um modelo</legend>
                {[...TEMPLATES, { id: 'custom' as const, name: 'Em branco', text: 'Oportunidade criada → venda. Você monta o resto.' }].map((t) => (
                  <label key={t.id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', template === t.id ? 'border-violet-500 bg-violet-50/50' : 'border-gray-200 bg-white hover:border-gray-300')}>
                    <input type="radio" name="fn-template" className="mt-1" checked={template === t.id} onChange={() => pickTemplate(t.id)} />
                    <span>
                      <span className="block font-medium text-gray-900">{t.name}</span>
                      <span className="block text-xs text-gray-500">{t.text}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        </Surface>
      )}

      {stage === 1 && (
        <Surface title="O que esta conta já tem conectado">
          <p className="mb-4 max-w-2xl text-sm text-gray-600">As etapas só medem o que existe de verdade. O que não está conectado aparece como lacuna no acompanhamento, nunca como zero. O CRM está sempre disponível.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <SourceCard title="Site (visitas e eventos)" to="/crm/site" toLabel="Instalar o código do site" loaded={sources?.trackers} describe={(n) => `${plural(n, 'site conectado', 'sites conectados')}`} onRetry={readSources} />
            <SourceCard title="Formulários" to="/crm/formularios" toLabel="Criar um formulário" loaded={sources?.forms} describe={(n) => plural(n, 'formulário', 'formulários')} onRetry={readSources} />
            <SourceCard title="Anúncios da Meta" to="/crm/anuncios" toLabel="Conectar a conta de anúncios" loaded={sources?.ads} describe={(n) => plural(n, 'conta de anúncios', 'contas de anúncios')} onRetry={readSources} />
          </div>
        </Surface>
      )}

      {stage === 2 && (
        <Surface title="Etapas do funil" action={<span className="text-xs text-gray-500">{rows.length} de {MAX_STEPS}</span>}>
          <ol className="grid gap-3">
            {rows.map((row, i) => {
              const { step } = row
              const id = (suffix: string) => `${row.key}-${suffix}`
              return (
                <li key={row.key} className="rounded-xl border border-gray-200 bg-white p-4">
                  {/* Celular: número e ações na primeira linha, campos na largura toda embaixo. Desktop: tudo numa linha. */}
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:items-start">
                    <span className="col-start-1 row-start-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white md:mt-2" aria-hidden>
                      {i + 1}
                    </span>
                    <div className="col-span-3 row-start-2 grid min-w-0 gap-3 md:col-span-1 md:col-start-2 md:row-start-1 md:grid-cols-2">
                      <Field label="Nome da etapa" htmlFor={id('name')}>
                        <input id={id('name')} className={cn(FIELD, 'h-9')} value={step.name} maxLength={80} onChange={(e) => update(row.key, (s) => ({ ...s, name: e.target.value }))} />
                      </Field>
                      <Field label="O que mede" hint={KIND_HELP[step.kind]} htmlFor={id('kind')}>
                        <select id={id('kind')} className={cn(FIELD, 'h-9')} value={step.kind} onChange={(e) => update(row.key, (s) => ({ ...s, kind: e.target.value as StepKind, source: {} }))}>
                          {KINDS.map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {step.kind === 'campaign' && (
                        <>
                          <Field label="Conta de anúncios" htmlFor={id('acc')}>
                            <select id={id('acc')} className={cn(FIELD, 'h-9')} value={step.source.accountId ?? ''} onChange={(e) => update(row.key, (s) => ({ ...s, source: { accountId: e.target.value || undefined, campaigns: [] } }))}>
                              <option value="">Escolha…</option>
                              {ads.map((a) => (
                                <option key={a.account.id} value={a.account.id}>
                                  {a.account.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {step.source.accountId && (
                            <fieldset className="grid gap-1">
                              <legend className="text-xs font-medium text-gray-700">Campanhas</legend>
                              <p className="text-xs text-gray-500">Sem nenhuma marcada, conta a conta inteira.</p>
                              <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 p-2">
                                {(ads.find((a) => a.account.id === step.source.accountId)?.campaigns ?? []).map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={!!step.source.campaigns?.some((x) => x.id === c.id)}
                                      onChange={(e) =>
                                        update(row.key, (s) => ({
                                          ...s,
                                          source: { ...s.source, campaigns: e.target.checked ? [...(s.source.campaigns ?? []), { id: c.id, name: c.name }] : (s.source.campaigns ?? []).filter((x) => x.id !== c.id) },
                                        }))
                                      }
                                    />
                                    <span className="truncate">{c.name}</span>
                                  </label>
                                ))}
                                {!(ads.find((a) => a.account.id === step.source.accountId)?.campaigns.length) && <p className="text-xs text-gray-500">Nenhum relatório guardado com campanhas. Abra Anúncios e leia a Meta.</p>}
                              </div>
                            </fieldset>
                          )}
                        </>
                      )}

                      {(step.kind === 'page' || step.kind === 'event') && (
                        <Field label="Site" htmlFor={id('trk')}>
                          <select id={id('trk')} className={cn(FIELD, 'h-9')} value={step.source.trackerId ?? ''} onChange={(e) => update(row.key, (s) => ({ ...s, source: { ...s.source, trackerId: e.target.value || undefined } }))}>
                            <option value="">Escolha…</option>
                            {trackers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {step.kind === 'page' && (
                        <Field label="Caminho da página" hint="Como aparece no endereço, depois do domínio. Ex.: /proposta" htmlFor={id('path')}>
                          <input id={id('path')} className={cn(FIELD, 'h-9')} value={step.source.path ?? ''} onChange={(e) => update(row.key, (s) => ({ ...s, source: { ...s.source, path: e.target.value || undefined } }))} placeholder="/proposta" />
                        </Field>
                      )}
                      {step.kind === 'event' && (
                        <Field label="Evento" hint="Cliques no WhatsApp mostram intenção, não conversa nem venda." htmlFor={id('evt')}>
                          <input id={id('evt')} list={id('evts')} className={cn(FIELD, 'h-9')} value={step.source.event ?? ''} onChange={(e) => update(row.key, (s) => ({ ...s, source: { ...s.source, event: e.target.value || undefined } }))} placeholder="whatsapp" />
                          <datalist id={id('evts')}>
                            {EVENT_SUGGESTIONS.map((e) => (
                              <option key={e} value={e} />
                            ))}
                          </datalist>
                        </Field>
                      )}

                      {(step.kind === 'form' || (step.kind === 'opportunity' && step.source.cohort === 'forms')) && (
                        <fieldset className="grid gap-1">
                          <legend className="text-xs font-medium text-gray-700">Formulários</legend>
                          <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 p-2">
                            {forms.map((f) => (
                              <label key={f.id} className="flex items-center gap-2 py-1 text-sm">
                                <input
                                  type="checkbox"
                                  checked={!!step.source.formIds?.includes(f.id)}
                                  onChange={(e) => update(row.key, (s) => ({ ...s, source: { ...s.source, formIds: e.target.checked ? [...(s.source.formIds ?? []), f.id] : (s.source.formIds ?? []).filter((x) => x !== f.id) } }))}
                                />
                                <span className="truncate">{f.name}</span>
                              </label>
                            ))}
                            {!forms.length && <p className="text-xs text-gray-500">Nenhum formulário disponível.</p>}
                          </div>
                        </fieldset>
                      )}

                      {step.kind === 'opportunity' && (
                        <>
                          <Field label="Quais oportunidades acompanhar" htmlFor={id('cohort')}>
                            <select
                              id={id('cohort')}
                              className={cn(FIELD, 'h-9')}
                              value={step.source.cohort ?? ''}
                              onChange={(e) => {
                                const cohort = e.target.value as 'forms' | 'created'
                                const sendStep = steps.find((s) => s.kind === 'form')
                                update(row.key, (s) => ({ ...s, source: { ...s.source, cohort, formIds: cohort === 'forms' ? (sendStep?.source.formIds ?? []) : [] } }))
                              }}
                            >
                              <option value="">Escolha…</option>
                              <option value="forms">As que vieram dos formulários escolhidos</option>
                              <option value="created">Todas as criadas no período</option>
                            </select>
                          </Field>
                          {step.source.cohort === 'created' && (
                            <Field label="Origem do cliente" htmlFor={id('src')}>
                              <select id={id('src')} className={cn(FIELD, 'h-9')} value={step.source.clientSource ?? ''} onChange={(e) => update(row.key, (s) => ({ ...s, source: { ...s.source, clientSource: e.target.value || undefined } }))}>
                                <option value="">Qualquer origem</option>
                                {SOURCES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          )}
                          <label className={cn('flex items-start gap-2 text-sm', !hasCampaignChoice && 'text-gray-400')}>
                            <input type="checkbox" className="mt-1" disabled={!hasCampaignChoice} checked={!!step.source.byCampaign} onChange={(e) => update(row.key, (s) => ({ ...s, source: { ...s.source, byCampaign: e.target.checked } }))} />
                            <span>
                              Só leads vindos das campanhas escolhidas
                              <span className="block text-xs text-gray-500">{hasCampaignChoice ? 'Liga o investimento às oportunidades pela origem do lead.' : 'Marque campanhas na etapa de campanha para habilitar.'}</span>
                            </span>
                          </label>
                        </>
                      )}

                      {step.kind === 'stage' && (
                        <Field label="Estado do CRM" hint="Conta as oportunidades que chegaram a este estado ou além." htmlFor={id('stg')}>
                          <select id={id('stg')} className={cn(FIELD, 'h-9')} value={step.source.stage ?? ''} onChange={(e) => update(row.key, (s) => ({ ...s, source: { stage: e.target.value || undefined } }))}>
                            <option value="">Escolha…</option>
                            {STAGE_CHOICES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>

                    <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-1 justify-self-end md:self-start">
                      <button type="button" className={ACTION} aria-label={`Subir a etapa ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" className={ACTION} aria-label={`Descer a etapa ${i + 1}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" className={cn(ACTION, 'hover:text-rose-600')} aria-label={`Remover a etapa ${i + 1}`} onClick={() => setRows((l) => l.filter((r) => r.key !== row.key))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className={cn('mt-2 pl-9 text-xs', isConnected(step) ? 'text-emerald-700' : 'text-gray-500')}>{isConnected(step) ? 'Fonte conectada.' : 'Sem fonte conectada: aparece sem número.'}</p>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="fn-add" className="sr-only">
              Adicionar etapa
            </label>
            <select id="fn-add" className={cn(FIELD, 'h-9 w-auto')} value="" disabled={rows.length >= MAX_STEPS} onChange={(e) => e.target.value && addStep(e.target.value as StepKind)}>
              <option value="">+ Adicionar etapa…</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <Plus className="h-4 w-4 text-gray-400" aria-hidden />
          </div>
        </Surface>
      )}

      {stage === 3 && (
        <Surface title="Revisar">
          <div className="grid max-w-2xl gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{name.trim() || 'Sem nome'}</p>
              {objective.trim() && <p className="text-sm text-gray-600">{objective}</p>}
            </div>
            <ol className="grid gap-1.5">
              {steps.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="min-w-0 break-words font-medium text-gray-900 [overflow-wrap:anywhere]">{s.name || '(sem nome)'}</span>
                  <span className="min-w-0 text-gray-500">· {KIND_LABEL[s.kind]}</span>
                  <span className={cn('ml-auto shrink-0 text-xs', isConnected(s) ? 'text-emerald-700' : 'text-amber-700')}>{isConnected(s) ? 'conectada' : 'sem fonte'}</span>
                </li>
              ))}
            </ol>
            {validation.errors.length > 0 && (
              <div role="alert" ref={alertRef} tabIndex={-1} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                <p className="font-medium">Corrija antes de salvar:</p>
                <ul className="mt-1 list-disc pl-5">
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ul className="list-disc pl-5">
                  {validation.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-rose-700">
                Não foi possível salvar: {error}
              </p>
            )}
          </div>
        </Surface>
      )}

      </fieldset>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" disabled={stage === 0 || saving} onClick={() => setStage((s) => s - 1)}>
          Voltar
        </Button>
        {stage < STEPS.length - 1 ? (
          <Button type="submit">Continuar</Button>
        ) : (
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {saving ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar funil'}
          </Button>
        )}
      </div>
    </form>
  )
}
