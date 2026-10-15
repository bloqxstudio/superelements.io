import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Check, CircleAlert, Copy, Loader2, ScanSearch, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { addActivity, findClientByDomain } from '@/features/crm/clients'
import { addLeads, createOpportunity, findOpportunity, listClientOpportunities, updateOpportunity } from '@/features/crm/opportunities'
import type { Client } from '@/features/crm/types'
import { FIELD, Page, PageHeader, Surface } from '@/features/crm/ui'
import { DiagnosisUnavailable, canReadPhone, capturePhone, diagnoseSite, getFunnelSettings, readCopy } from '@/features/prospects/api'
import { demandQuestions, demandText, pitchOf, type CopyReading, type PhoneCapture } from '@/features/prospects/demand'
import { CopyFindings, CurrentScreen, PageStrip, PhoneFrame, QuestionList, RewriteScreen, ScreenNote, ScreenWaiting } from '@/features/prospects/DemandReport'
import { diagnosisGroups, diagnosisText, leadFromScan, verdictOf, type DiagnosisItem, type Tone } from '@/features/prospects/diagnosis'
import { DEFAULT_SETTINGS, OPEN_STAGES, STAGE_LABEL, money, valueOf, type FunnelSettings, type Opportunity, type Stage } from '@/features/prospects/funnel'
import { NICHES, nicheFor } from '@/features/prospects/niches'
import { draftOffer } from '@/features/prospects/offer'
import { adLibraryLinks } from '@/features/prospects/score'
import type { Platform, SiteDiagnosis } from '@/features/prospects/types'
import { PlatformBadge } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

// ---------- últimos diagnósticos (só deste navegador, para reabrir rápido)

interface Recent {
  url: string
  name: string
  platform: Platform
}

const RECENT_KEY = 'crm:diagnosticos'

const readRecent = (): Recent[] => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(list) ? list.slice(0, 8) : []
  } catch {
    return []
  }
}

const saveRecent = (item: Recent) => {
  const list = [item, ...readRecent().filter((r) => hostOf(r.url) !== hostOf(item.url))].slice(0, 8)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Navegador sem armazenamento: a lista some ao recarregar
  }
  return list
}

// ---------- peças

const ToneIcon: React.FC<{ tone: Tone }> = ({ tone }) =>
  tone === 'ok' ? (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-label="Está bem">
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  ) : tone === 'atencao' ? (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700" aria-label="Para melhorar">
      <TriangleAlert className="h-3 w-3" strokeWidth={2.5} />
    </span>
  ) : (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
    </span>
  )

const ItemRow: React.FC<{ item: DiagnosisItem }> = ({ item }) => (
  <li className="flex gap-3 py-2.5">
    <ToneIcon tone={item.tone} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm text-gray-600">{item.label}</span>
        <span className={cn('min-w-0 break-words text-right text-sm font-medium tabular-nums', item.tone === 'atencao' ? 'text-amber-900' : 'text-gray-900')}>{item.value}</span>
      </div>
      {item.hint && <p className="mt-0.5 text-xs leading-5 text-gray-500">{item.hint}</p>}
    </div>
  </li>
)

const VERDICT_TONE = {
  atualizacao: 'bg-emerald-50 text-emerald-950 ring-emerald-600/15',
  'site-novo': 'bg-sky-50 text-sky-950 ring-sky-600/15',
  conferir: 'bg-amber-50 text-amber-950 ring-amber-600/20',
} as const

/** A oportunidade que diz onde o cliente está: a aberta mais recente, senão a última. */
const currentOf = (list: Opportunity[]) => [...list].sort((a, b) => Number(OPEN_STAGES.includes(b.stage)) - Number(OPEN_STAGES.includes(a.stage)) || b.updatedAt.localeCompare(a.updatedAt))[0]

/** O nome que o WordPress dá ao site, quando não é só o domínio. */
const siteName = (d: SiteDiagnosis) => {
  const name = d.wordpress?.name
  return name && !/^[\w.-]+\.[a-z]{2,}$/i.test(name) ? name : undefined
}

interface Result {
  url: string
  diagnosis: SiteDiagnosis
}

/** Cada parte demorada do diagnóstico: a foto do celular e a leitura do texto. */
type Step<T> = {
  status: 'idle' | 'loading' | 'done' | 'error' | 'off'
  data?: T
  error?: string
}

const stateOf = (step: Step<unknown>) => (step.status === 'loading' || step.status === 'idle' ? 'loading' : step.status === 'done' ? 'done' : 'off')

/**
 * Diagnóstico de site: cola o endereço, a leitura diz se é WordPress com
 * Elementor (e em que versões), o que o Google e o celular veem, os plugins,
 * os anúncios e o contato, e monta a oferta de atualização. Um botão põe o
 * site no funil, com o diagnóstico na linha do tempo do cliente.
 */
const Diagnosis: React.FC = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [url, setUrl] = useState(() => params.get('site') ?? '')
  const [niche, setNiche] = useState('')
  // O nicho na hora de ler o texto (as regras do conselho entram na reescrita)
  const nicheRef = useRef(niche)
  nicheRef.current = niche
  const [region, setRegion] = useState('')
  const [name, setName] = useState('')
  const [running, setRunning] = useState<AbortController | null>(null)
  const runningRef = useRef<AbortController | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<{
    message: string
    unavailable: boolean
  } | null>(null)
  // undefined: conferindo o CRM; null: o site não está no CRM
  const [crm, setCrm] = useState<{ client: Client; opportunity?: Opportunity } | null | undefined>(undefined)
  const [settings, setSettings] = useState<FunnelSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState<Stage | null>(null)
  const [recent, setRecent] = useState<Recent[]>(readRecent)
  const [phone, setPhone] = useState<Step<PhoneCapture>>({ status: 'idle' })
  const [reading, setReading] = useState<Step<CopyReading>>({ status: 'idle' })
  const deepRef = useRef<AbortController | null>(null)

  useEffect(() => {
    getFunnelSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  const lookup = useCallback(async (domain: string) => {
    setCrm(undefined)
    try {
      const client = domain ? await findClientByDomain(domain) : undefined
      if (!client) return setCrm(null)
      setCrm({
        client,
        opportunity: currentOf(await listClientOpportunities(client.id)),
      })
    } catch (e) {
      console.error('[diagnóstico] falha ao conferir o CRM', e)
      setCrm(null)
    }
  }, [])

  /** A leitura do texto da primeira tela pelo Claude Code da máquina (com a foto). */
  const readText = useCallback(async (site: string, capture: PhoneCapture, diagnosis: SiteDiagnosis, company: { name: string; niche?: string }, signal: AbortSignal) => {
    setReading({ status: 'loading' })
    try {
      const data = await readCopy(
        {
          url: site,
          name: company.name,
          niche: company.niche,
          description: diagnosis.checks?.description,
          firstScreenText: capture.firstScreenText,
          headings: capture.headings,
          pageText: capture.pageText,
          image: capture.firstScreen,
        },
        signal
      )
      if (!signal.aborted) setReading({ status: 'done', data })
    } catch (e) {
      if (!signal.aborted)
        setReading({
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        })
    }
  }, [])

  /** A parte demorada, depois da leitura rápida: a foto do celular e, com ela, a leitura do texto. */
  const deep = useCallback(
    async (site: string, diagnosis: SiteDiagnosis, company: { name: string; niche?: string }) => {
      deepRef.current?.abort()
      const controller = new AbortController()
      deepRef.current = controller
      const opened = Boolean(diagnosis.scan.status && diagnosis.scan.status < 400)
      if (!canReadPhone || !opened) {
        setPhone({ status: 'off' })
        setReading({ status: 'off' })
        return
      }
      setPhone({ status: 'loading' })
      setReading({ status: 'idle' })
      let capture: PhoneCapture
      try {
        capture = await capturePhone(site, controller.signal)
      } catch (e) {
        if (controller.signal.aborted) return
        setPhone({
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        })
        setReading({ status: 'off' })
        return
      }
      if (controller.signal.aborted) return
      setPhone({ status: 'done', data: capture })
      await readText(site, capture, diagnosis, company, controller.signal)
    },
    [readText]
  )

  const run = useCallback(
    async (target: string) => {
      const site = target.trim()
      if (!site) return
      runningRef.current?.abort()
      deepRef.current?.abort()
      const controller = new AbortController()
      runningRef.current = controller
      setRunning(controller)
      setError(null)
      setResult(null)
      setCrm(undefined)
      setPhone({ status: 'idle' })
      setReading({ status: 'idle' })
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('site', site)
          return next
        },
        { replace: true }
      )
      try {
        const diagnosis = await diagnoseSite(site, controller.signal)
        if (controller.signal.aborted) return
        const lead = leadFromScan(diagnosis.scan, {
          url: site,
          name: siteName(diagnosis),
        })
        setResult({ url: site, diagnosis })
        setName(lead.name)
        setRecent(
          saveRecent({
            url: site,
            name: lead.name,
            platform: diagnosis.scan.platform,
          })
        )
        void lookup(lead.domain ?? hostOf(site))
        void deep(site, diagnosis, {
          name: lead.name,
          niche: nicheRef.current ? nicheFor(nicheRef.current).label : undefined,
        })
      } catch (e) {
        if (controller.signal.aborted) return
        setError({
          message: e instanceof Error ? e.message : String(e),
          unavailable: e instanceof DiagnosisUnavailable,
        })
      } finally {
        if (runningRef.current === controller) {
          runningRef.current = null
          setRunning(null)
        }
      }
    },
    [deep, lookup, setParams]
  )

  // Aberto com ?site= (um link de outra tela): já diagnostica, uma vez
  const linked = useRef(params.get('site'))
  useEffect(() => {
    const site = linked.current
    linked.current = null
    if (site) void run(site)
  }, [run])
  useEffect(
    () => () => {
      runningRef.current?.abort()
      deepRef.current?.abort()
    },
    []
  )

  const lead = useMemo(
    () =>
      result
        ? leadFromScan(result.diagnosis.scan, {
            url: result.url,
            niche,
            region,
            name: name.trim() || siteName(result.diagnosis),
          })
        : null,
    [result, niche, region, name]
  )
  const groups = useMemo(() => (result ? diagnosisGroups(result.diagnosis) : []), [result])
  const questions = useMemo(
    () =>
      result
        ? demandQuestions(result.diagnosis, phone.data, reading.data, {
            phone: stateOf(phone),
            copy: stateOf(reading),
          })
        : [],
    [result, phone, reading]
  )
  const toFix = questions.filter((q) => q.answer === 'nao').length
  // A primeira mensagem abre com o pior ponto que o diagnóstico achou
  const observation = pitchOf(questions)
  const verdict = result ? verdictOf(result.diagnosis) : null
  const draft = lead ? draftOffer(lead, { observation }) : null
  const company = () => ({
    name: lead?.name ?? '',
    niche: niche ? nicheFor(niche).label : undefined,
  })

  const retryPhone = () => {
    if (result) void deep(result.url, result.diagnosis, company())
  }
  const rereadText = () => {
    if (!result || !phone.data) return
    deepRef.current?.abort()
    const controller = new AbortController()
    deepRef.current = controller
    void readText(result.url, phone.data, result.diagnosis, company(), controller.signal)
  }
  const fullText = () => (result && lead ? `${diagnosisText(result.diagnosis, lead.name)}\n\n${demandText(questions, reading.data)}` : '')
  const value = draft ? valueOf({ offer: draft.offer }, settings) : null
  const firstMessage = draft ? /"([^"]+)"\s*$/.exec(draft.brief.how)?.[1] : undefined
  const ads = lead ? adLibraryLinks(lead) : null

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(done)
    } catch {
      toast.error('Não deu para copiar', {
        description: 'O navegador bloqueou a área de transferência.',
      })
    }
  }

  const add = async (stage: Stage) => {
    if (!lead || !result) return
    setSaving(stage)
    try {
      const where = region.trim() || lead.city || '—'
      let opportunity: Opportunity | undefined
      if (crm?.client) {
        opportunity = await createOpportunity(crm.client.id, {
          lead,
          stage,
          region: where,
        })
      } else {
        await addLeads([lead], { region: where, stage })
        opportunity = await findOpportunity(lead.id)
      }
      if (opportunity) {
        // O roteiro gravado abre com o ponto que o diagnóstico de captação achou
        if (observation && draft) await updateOpportunity(opportunity.id, { brief: draft.brief }).catch((e) => console.error('[diagnóstico] roteiro não atualizado', e))
        await addActivity(opportunity.clientId, 'note', fullText()).catch((e) => console.error('[diagnóstico] nota não gravada', e))
      }
      await lookup(lead.domain ?? hostOf(result.url))
      toast.success(stage === 'selecionado' ? `${lead.name} na fila da página` : `${lead.name} no funil`, {
        description: stage === 'selecionado' ? 'O ▶ do cartão nas Oportunidades cria a página nova com a IA conectada.' : 'Com a oferta, o roteiro e o diagnóstico na linha do tempo.',
        action: opportunity
          ? {
              label: 'Abrir',
              onClick: () => navigate(`/crm?oportunidade=${opportunity!.id}`),
            }
          : undefined,
      })
    } catch (e) {
      toast.error('Não deu para pôr no funil', {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setSaving(null)
    }
  }

  const openOpportunity = crm?.opportunity && OPEN_STAGES.includes(crm.opportunity.stage) ? crm.opportunity : undefined

  return (
    <Page>
      <PageHeader
        title="Diagnóstico de site"
        text="Cole o endereço do site. A leitura mostra se quem chega acha como chamar a empresa, o que o Google mostra e se é WordPress com Elementor, e monta a oferta."
      />

      <form
        className="mt-6 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] md:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          void run(url)
        }}
      >
        <label htmlFor="diagnostico-site" className="text-xs font-medium text-gray-700">
          Endereço do site
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="diagnostico-site"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="exemplo.com.br"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!params.get('site')}
            className={cn(FIELD, 'h-11 text-base sm:text-sm')}
          />
          {running ? (
            <Button type="button" variant="outline" className="h-11 shrink-0 gap-1.5" onClick={() => running.abort()}>
              <X className="h-4 w-4" /> Parar
            </Button>
          ) : (
            <Button type="submit" className="h-11 shrink-0 gap-1.5" disabled={!url.trim()}>
              <ScanSearch className="h-4 w-4" /> Diagnosticar
            </Button>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Nicho (opcional)</span>
            <select value={niche} onChange={(e) => setNiche(e.target.value)} className={cn(FIELD, 'mt-1 h-9')}>
              <option value="">Sem nicho</option>
              {NICHES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Cidade (opcional)</span>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="São Leopoldo, RS" className={cn(FIELD, 'mt-1 h-9')} />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">O nicho põe as regras de publicidade do conselho (OAB, CFM…) no roteiro de venda.</p>
      </form>

      {!result && !running && !error && recent.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500">Últimos diagnósticos neste navegador</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r.url}
                type="button"
                onClick={() => {
                  setUrl(r.url)
                  void run(r.url)
                }}
                className="inline-flex h-8 items-center gap-2 rounded-full bg-white px-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-200 transition-colors hover:bg-gray-50 hover:text-gray-900 active:scale-[0.96]"
              >
                <span className="max-w-[16rem] truncate">{r.name}</span>
                <PlatformBadge platform={r.platform} />
              </button>
            ))}
          </div>
        </div>
      )}

      {running && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-sm text-gray-600" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" aria-hidden />
          <span>Abrindo {hostOf(url) || 'o site'}: a página inicial e, se for WordPress, a API pública. Leva até 20 segundos.</span>
        </div>
      )}

      {error && (
        <div
          className={cn(
            'mt-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
            error.unavailable ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-rose-200 bg-rose-50 text-rose-900'
          )}
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p>{error.message}</p>
            {error.unavailable && (
              <p className="mt-1 text-amber-900/80">
                No app publicado, o diagnóstico roda na função <code className="rounded bg-amber-100 px-1">site-diagnostico</code> do Supabase. Até ela ser publicada, use o app local (servidor de
                dev), que já diagnostica.
              </p>
            )}
          </div>
        </div>
      )}

      {result && lead && verdict && draft && value && (
        <section className="mt-6" aria-label="Resultado do diagnóstico">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-gray-900">{lead.name}</h2>
                <PlatformBadge platform={result.diagnosis.scan.platform} />
              </div>
              <a
                href={result.diagnosis.scan.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
              >
                {hostOf(result.diagnosis.scan.url) || result.diagnosis.scan.url}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy(fullText(), 'Diagnóstico copiado')}>
                <Copy className="h-3.5 w-3.5" /> Copiar diagnóstico
              </Button>
              <Button variant="ghost" size="sm" onClick={() => run(result.url)}>
                Ler de novo
              </Button>
            </div>
          </div>

          <div className={cn('mt-4 rounded-xl px-4 py-3 ring-1 ring-inset', VERDICT_TONE[verdict.fit])}>
            <p className="text-sm font-semibold">{verdict.title}</p>
            <p className="mt-0.5 text-sm opacity-80">{verdict.text}</p>
          </div>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Surface
                title="Como quem chega pelo celular vê"
                action={
                  phone.status === 'loading' ? (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Abrindo num celular com 4G lento
                    </span>
                  ) : reading.status === 'loading' ? (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> O Claude está lendo a primeira tela
                    </span>
                  ) : undefined
                }
              >
                {phone.status === 'off' && !canReadPhone ? (
                  <p className="text-sm leading-6 text-gray-600">
                    A foto do celular e a leitura do texto rodam no app local (servidor de dev), com o Edge e o Claude Code desta máquina. Abra o diagnóstico por lá.
                  </p>
                ) : phone.status === 'off' ? (
                  <p className="text-sm leading-6 text-gray-600">O site não abriu, então não há o que fotografar.</p>
                ) : (
                  <div className="flex flex-wrap items-start justify-center gap-6">
                    <PhoneFrame label="Hoje">
                      {phone.data ? (
                        <CurrentScreen phone={phone.data} questions={questions} />
                      ) : phone.status === 'error' ? (
                        <ScreenNote text={phone.error ?? 'Não deu para abrir o site num celular.'} onRetry={retryPhone} />
                      ) : (
                        <ScreenWaiting text="Abrindo o site num celular com 4G lento, como quem chega do anúncio. Leva até 40 segundos." />
                      )}
                    </PhoneFrame>
                    <PhoneFrame label="Como a primeira tela poderia ser">
                      {reading.data ? (
                        <RewriteScreen copy={reading.data} name={lead.name} />
                      ) : reading.status === 'error' ? (
                        <ScreenNote text={reading.error ?? 'A leitura do texto não respondeu.'} onRetry={rereadText} />
                      ) : reading.status === 'off' ? (
                        <ScreenNote text="Sem a foto do celular, não há leitura do texto." />
                      ) : (
                        <ScreenWaiting text={phone.data ? 'O Claude está lendo a primeira tela e reescrevendo só com o que o site já diz.' : 'Espera a foto do celular.'} />
                      )}
                    </PhoneFrame>
                    {phone.data?.strip && <PageStrip phone={phone.data} />}
                  </div>
                )}
              </Surface>

              <Surface title="As 7 perguntas" action={toFix > 0 ? <span className="text-xs font-medium text-rose-700">{toFix} com resposta "não"</span> : undefined}>
                <QuestionList questions={questions} />
              </Surface>

              {reading.data && (
                <Surface
                  title="O que o texto diz"
                  action={
                    <button type="button" onClick={rereadText} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
                      Ler de novo
                    </button>
                  }
                >
                  <CopyFindings copy={reading.data} />
                </Surface>
              )}

              <details className="group rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 md:px-5 [&::-webkit-details-marker]:hidden">
                  Detalhes da leitura
                  <span className="text-xs font-normal text-gray-500 group-open:hidden">contato, Google, plataforma e plugins</span>
                </summary>
                <div className="space-y-4 border-t border-gray-100 p-4 md:p-5">
                  {groups.map((group) => (
                    <Surface
                      key={group.title}
                      title={group.title}
                      action={group.team ? <span className="text-xs text-gray-500">não entra na conversa com o dono</span> : undefined}
                      className={group.team ? 'bg-gray-50/60' : undefined}
                    >
                      <ul className="-my-2.5 divide-y divide-gray-100">
                        {group.items.map((item) => (
                          <ItemRow key={item.id} item={item} />
                        ))}
                      </ul>
                      {group.items.some((item) => item.id === 'ads') && ads && (
                        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                          Conferir se há anúncio no ar:{' '}
                          {ads.google && (
                            <a href={ads.google} target="_blank" rel="noreferrer" className="font-medium text-gray-900 underline-offset-2 hover:underline">
                              Google
                            </a>
                          )}
                          {ads.google && ' · '}
                          <a href={ads.meta} target="_blank" rel="noreferrer" className="font-medium text-gray-900 underline-offset-2 hover:underline">
                            Meta
                          </a>
                        </p>
                      )}
                    </Surface>
                  ))}
                  {result.diagnosis.plugins.length > 0 && (
                    <Surface title={`Plugins à vista (${result.diagnosis.plugins.length})`}>
                      <div className="flex flex-wrap gap-1.5">
                        {result.diagnosis.plugins.map((plugin) => (
                          <span key={plugin} className="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-inset ring-gray-200">
                            {plugin}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-gray-500">Os que aparecem na página inicial e na API do WordPress; pode haver outros.</p>
                    </Surface>
                  )}
                </div>
              </details>
            </div>

            <div className="space-y-4 lg:sticky lg:top-4">
              <Surface title="Oferta">
                <p className="text-sm leading-6 text-gray-900">{draft.offer.service}</p>
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <span className="font-semibold tabular-nums text-gray-900">{money(value.price)}</span> uma vez
                  {value.monthly > 0 ? ` + ${money(value.monthly)}/mês opcional` : ', sem plano mensal'}. Valor padrão do funil: ajuste no cartão.
                </p>
                <h3 className="mt-4 text-xs font-medium text-gray-700">O que entregamos</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {draft.brief.what
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => (
                      <li key={line} className="flex gap-2 text-sm leading-5 text-gray-700">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" aria-hidden />
                        {line.replace(/^-\s*/, '')}
                      </li>
                    ))}
                </ul>
                {firstMessage && (
                  <>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <h3 className="text-xs font-medium text-gray-700">Primeira mensagem</h3>
                      <button type="button" onClick={() => copy(firstMessage, 'Mensagem copiada')} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
                        <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
                      </button>
                    </div>
                    <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-800">{firstMessage}</p>
                  </>
                )}
              </Surface>

              <Surface title="No CRM">
                {crm === undefined ? (
                  <p className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Conferindo se o site já está no CRM
                  </p>
                ) : openOpportunity ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700">
                      <Link to={`/crm/clientes/${crm!.client.id}`} className="font-medium text-gray-900 underline-offset-2 hover:underline">
                        {crm!.client.name}
                      </Link>{' '}
                      já está no funil, em <span className="font-medium text-gray-900">{STAGE_LABEL[openOpportunity.stage]}</span>.
                    </p>
                    <Button className="w-full" onClick={() => navigate(`/crm?oportunidade=${openOpportunity.id}`)}>
                      Abrir o cartão
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {crm?.client && (
                      <p className="text-sm text-gray-700">
                        <Link to={`/crm/clientes/${crm.client.id}`} className="font-medium text-gray-900 underline-offset-2 hover:underline">
                          {crm.client.name}
                        </Link>{' '}
                        já é cadastro
                        {crm.opportunity ? `, com a última oportunidade em ${STAGE_LABEL[crm.opportunity.stage]}` : ''}. A nova oportunidade fica nele.
                      </p>
                    )}
                    {!crm?.client && (
                      <label className="block">
                        <span className="text-xs font-medium text-gray-700">Nome no CRM</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} className={cn(FIELD, 'mt-1 h-9')} />
                      </label>
                    )}
                    <Button className="w-full" disabled={Boolean(saving)} onClick={() => add('selecionado')}>
                      {saving === 'selecionado' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      Pôr na fila da página
                    </Button>
                    <Button variant="outline" className="w-full" disabled={Boolean(saving)} onClick={() => add('mapeado')}>
                      {saving === 'mapeado' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      Só pôr no funil
                    </Button>
                    <p className="text-xs leading-5 text-gray-500">
                      Vira um cliente com a oferta e o roteiro de venda no cartão, e o diagnóstico na linha do tempo. Na fila da página, o ▶ do cartão cria a página nova com a IA conectada.
                    </p>
                  </div>
                )}
              </Surface>
            </div>
          </div>
        </section>
      )}
    </Page>
  )
}

export default Diagnosis
