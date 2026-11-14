import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CalendarCheck, Check, ExternalLink, FileText, Globe, Loader2, MapPin, Megaphone, Monitor, Smartphone, Tablet, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { COLUMNS, isLive, placeLabel as formPlace, stepLabel, toVisit, useNow, type FormVisit } from '@/features/crm/formVisits'
import { loadForm, type CrmForm } from '@/features/crm/forms'
import { countryLabel, duration, loadSession, moneyText, type SiteSession } from '@/features/crm/site'
import { formWhere } from '@/features/crm/siteFunnel'
import { matchCampaign, type MetaView } from '@/features/crm/siteMeta'
import { plural, whenLabel } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * A janela de uma visita ao formulário (2026-11-14, o usuário, mostrando a janela da visita do site: "podemos ter
 * essa modal também para o formulário?… pode fazer a janela de visualização melhor"). O caminho da pessoa no
 * formulário etapa por etapa (até onde foi, onde parou ou onde está agora), de onde veio (canal, campanha, anúncio,
 * conjunto e o gasto da campanha quando a Meta está ligada), onde está, o aparelho, as outras visitas da mesma
 * pessoa aos formulários e os atalhos: a resposta, o formulário e a visita do site em que ela estava.
 * Nunca mostra as respostas aqui: o que a pessoa escreveu fica em Respostas.
 */

const db = supabase as unknown as SupabaseClient

const CLICK_LABEL: Record<string, string> = { gclid: 'clique de anúncio do Google', gbraid: 'clique de anúncio do Google', wbraid: 'clique de anúncio do Google', fbclid: 'link do Facebook ou Instagram', msclkid: 'anúncio da Microsoft', ttclid: 'anúncio do TikTok', li_fat_id: 'anúncio do LinkedIn' }

const DeviceIcon = (device?: string) => (device === 'Celular' || device === 'mobile' ? Smartphone : device === 'Tablet' || device === 'tablet' ? Tablet : Monitor)

const Fact: React.FC<{ label: string; icon?: React.ElementType; children: React.ReactNode }> = ({ label, icon: Icon, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="mt-0.5 flex items-start gap-1.5 text-sm text-gray-800">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />}
      <span className="min-w-0">{children}</span>
    </dd>
  </div>
)

const Sub: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <span className="block truncate text-xs text-gray-500" title={title}>
    {children}
  </span>
)

type StepState = 'done' | 'skipped' | 'here' | 'stopped' | 'todo'
interface PathStep {
  id: string
  label: string
  hint?: string
  state: StepState
}

/** O caminho do formulário (capa → etapas → enviou → agenda → agendou) com o estado de cada passo para esta visita */
function pathOf(form: CrmForm | null, v: FormVisit, live: boolean): PathStep[] {
  const definition = form?.live?.definition ?? form?.definition
  const settings = form?.live?.settings ?? form?.settings
  const steps: PathStep[] = []
  const ended = v.submitted || v.scheduled
  if (definition?.welcome?.enabled) steps.push({ id: 'welcome', label: 'Capa', hint: v.started || v.stepsSeen.length || ended ? 'clicou em começar' : undefined, state: v.started || v.stepsSeen.length || ended ? 'done' : 'todo' })
  const defSteps = definition?.steps ?? []
  // Visita antiga ou etapa que não existe mais: as etapas vistas vêm na ordem em que a pessoa passou
  const ids = defSteps.length ? defSteps.map((s) => s.id) : v.stepsSeen
  const lastSeen = Math.max(-1, ...ids.map((id, i) => (v.stepsSeen.includes(id) ? i : -1)))
  ids.forEach((id, i) => {
    const seen = v.stepsSeen.includes(id)
    const label = definition ? stepLabel(definition, id) : undefined
    steps.push({ id: `step:${id}`, label: `Etapa ${i + 1}`, hint: label, state: seen ? 'done' : i < lastSeen || (ended && !seen) ? 'skipped' : 'todo' })
  })
  steps.push({ id: 'submit', label: 'Enviou', hint: v.qualified === true ? 'qualificado' : v.qualified === false ? 'não passou no filtro' : undefined, state: ended ? 'done' : 'todo' })
  const booking = settings?.booking?.enabled || v.scheduleView || v.scheduled
  if (booking) {
    steps.push({ id: 'schedule_view', label: 'Viu a agenda', state: v.scheduleView || v.scheduled ? 'done' : 'todo' })
    steps.push({ id: 'scheduled', label: 'Agendou a reunião', state: v.scheduled ? 'done' : 'todo' })
  }
  // Onde está agora (ao vivo) ou onde parou: o passo depois do último feito, ou o próprio passo atual
  const currentId = v.screen === 'welcome' ? 'welcome' : v.screen === 'steps' && v.stepId ? `step:${v.stepId}` : v.screen === 'booking' ? 'scheduled' : undefined
  // A etapa atual já está nas vistas: a marca fica nela (onde a pessoa está ou parou), não na seguinte
  const at = currentId ? steps.findIndex((s) => s.id === currentId) : -1
  const finished = v.scheduled || (ended && (!booking || v.qualified === false))
  const mark = at >= 0 ? at : steps.findIndex((s) => s.state === 'todo')
  if (mark >= 0 && !finished) steps[mark] = { ...steps[mark], state: live ? 'here' : 'stopped' }
  return steps
}

const STEP_STYLE: Record<StepState, { dot: string; text: string; note?: string }> = {
  done: { dot: 'bg-emerald-600 text-white', text: 'text-gray-900' },
  skipped: { dot: 'bg-zinc-100 text-gray-400', text: 'text-gray-400', note: 'pulada pela lógica' },
  here: { dot: 'bg-emerald-500 text-white ring-4 ring-emerald-100', text: 'font-semibold text-emerald-800', note: 'está aqui agora' },
  stopped: { dot: 'bg-rose-500 text-white ring-4 ring-rose-100', text: 'font-semibold text-rose-800', note: 'parou aqui' },
  todo: { dot: 'bg-zinc-100 text-gray-400', text: 'text-gray-400' },
}

const Status: React.FC<{ v: FormVisit; live: boolean }> = ({ v, live }) => {
  const [label, tone] = v.scheduled
    ? ['Agendou', 'bg-emerald-50 text-emerald-800 ring-emerald-600/20']
    : v.submitted
      ? ['Enviou', 'bg-violet-50 text-violet-800 ring-violet-600/20']
      : live
        ? ['No formulário agora', 'bg-emerald-50 text-emerald-800 ring-emerald-600/20']
        : ['Não enviou', 'bg-zinc-100 text-gray-600 ring-zinc-500/10']
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', tone)}>
      {live && !v.submitted && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />}
      {label}
    </span>
  )
}

export const FormVisitPanel: React.FC<{
  visit: FormVisit
  /** O formulário, quando a tela já tem; senão a janela lê */
  form?: CrmForm
  manager: boolean
  meta?: MetaView
  onOpen: (visit: FormVisit) => void
  onClose: () => void
  onRemoved?: () => void
  /** Abre a visita do site em que o formulário estava (a tela que tem a janela do site) */
  onOpenSiteSession?: (session: SiteSession) => void
}> = ({ visit: v, form: given, manager, meta, onOpen, onClose, onRemoved, onOpenSiteSession }) => {
  const [form, setForm] = useState<CrmForm | null>(given ?? null)
  const [formRead, setFormRead] = useState(!!given)
  const [others, setOthers] = useState<FormVisit[] | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [confirm, setConfirm] = useState(false)
  const [openingSite, setOpeningSite] = useState(false)
  const now = useNow(5000)
  const live = isLive(v, now)

  useEffect(() => {
    if (given && given.id === v.formId) {
      setForm(given)
      return setFormRead(true)
    }
    let alive = true
    setFormRead(false)
    loadForm(v.formId)
      .then((f) => alive && setForm(f))
      .catch(() => alive && setForm(null))
      .finally(() => alive && setFormRead(true))
    return () => {
      alive = false
    }
  }, [v.formId, given])

  // As outras visitas da mesma pessoa aos formulários (o mesmo navegador)
  useEffect(() => {
    setConfirm(false)
    if (!v.visitor) return setOthers([])
    let alive = true
    void (async () => {
      const { data } = await db.from('crm_form_visits').select(COLUMNS).eq('visitor', v.visitor).order('started_at', { ascending: false }).limit(12)
      if (!alive) return
      const list = (data ?? []).map((r) => toVisit(r as Record<string, unknown>))
      setOthers(list)
      const ids = [...new Set(list.map((o) => o.formId))]
      const { data: forms } = await db.from('crm_forms').select('id, name').in('id', ids)
      if (alive) setNames(new Map(((forms ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name])))
    })()
    return () => {
      alive = false
    }
  }, [v.id, v.visitor])

  const path = useMemo(() => pathOf(form, v, live), [form, v, live])
  const name = form?.live?.name || form?.name || 'Formulário'
  const campaign = meta && v.campaign ? matchCampaign(meta, { campaign: v.campaign, ad: v.content }) : undefined
  const Device = DeviceIcon(v.device)
  const place = [v.city, v.regionName || v.region].filter(Boolean).join(', ')
  const rest = (others ?? []).filter((o) => o.id !== v.id)
  const nth = others ? others.filter((o) => o.startedAt <= v.startedAt).length : 0

  const remove = async () => {
    const { error } = await db.from('crm_form_visits').delete().eq('id', v.id)
    if (error) return toast.error(error.message)
    toast.success('Visita apagada')
    onRemoved?.()
    onClose()
  }

  const openSite = async () => {
    if (!v.siteSessionId || !onOpenSiteSession) return
    setOpeningSite(true)
    try {
      const session = await loadSession(v.siteSessionId)
      if (session) onOpenSiteSession(session)
      else toast.error('A visita do site não existe mais.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setOpeningSite(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-base">
            <FileText className="h-4 w-4 text-violet-600" aria-hidden />
            {name}
            <Status v={v} live={live} />
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-1.5">
            <span>Visita de {whenLabel(v.startedAt)}</span>
            <span>· {duration(v.activeMs)} em uso</span>
            <span>· {formWhere(v)}</span>
            {nth > 1 && <span>· {nth}ª visita desta pessoa</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <section aria-label="Caminho no formulário" className="rounded-xl bg-zinc-50 p-3">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Caminho no formulário</h3>
            {!formRead ? (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Lendo o formulário…
              </p>
            ) : (
              <ol className="relative grid gap-0.5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-gray-200">
                {path.map((step) => {
                  const style = STEP_STYLE[step.state]
                  return (
                    <li key={step.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] items-start gap-x-2.5 py-1">
                      <span className={cn('relative z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold', style.dot)}>
                        {step.state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden /> : step.id === 'scheduled' ? <CalendarCheck className="h-3 w-3" aria-hidden /> : '·'}
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className={cn('block text-sm', style.text)}>
                          {step.label}
                          {style.note && <span className="ml-1.5 text-[11px] font-medium">({style.note})</span>}
                        </span>
                        {step.hint && <span className={cn('block truncate text-xs', step.state === 'todo' || step.state === 'skipped' ? 'text-gray-400' : 'text-gray-500')}>{step.hint}</span>}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            {form && !live && !v.submitted && (
              <p className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500">
                Última tela: {formPlace(form.live?.definition ?? form.definition, v).toLowerCase()} · saiu {whenLabel(v.leftAt ?? v.lastAt)}
              </p>
            )}
          </section>

          <dl className="grid content-start gap-3 rounded-xl bg-zinc-50 p-3 sm:grid-cols-2">
            <Fact label="De onde veio" icon={v.campaign ? Megaphone : Globe}>
              {v.channel || 'Direto'}
              {v.source && v.source !== v.channel && <span className="text-gray-500"> · {v.source}</span>}
              {v.referrerHost && <Sub>{v.referrerHost}</Sub>}
              {v.clickId && <Sub>Pelo {CLICK_LABEL[v.clickId] ?? v.clickId}</Sub>}
              {v.medium && <Sub>meio {v.medium}</Sub>}
            </Fact>
            <Fact label="Onde" icon={MapPin}>
              {place || (v.country ? countryLabel(v.country) : 'Não identificado')}
              {place && v.country && v.country !== 'BR' && <Sub>{countryLabel(v.country)}</Sub>}
              {place && <Sub>pelo IP</Sub>}
            </Fact>
            {(v.campaign || v.content || v.term) && (
              <div className="sm:col-span-2">
                <Fact label="Anúncio" icon={Megaphone}>
                  <span className="block truncate" title={campaign?.name ?? v.campaign}>{campaign?.name ?? v.campaign ?? 'Sem nome de campanha no link'}</span>
                  {v.term && <Sub title={v.term}>Conjunto: {v.term}</Sub>}
                  {v.content && <Sub title={v.content}>Anúncio: {v.content}</Sub>}
                  {campaign && (
                    <Sub>
                      Campanha no período: {moneyText(campaign.metrics.spend, campaign.currency)} · {campaign.metrics.linkClicks.toLocaleString('pt-BR')} cliques no link
                    </Sub>
                  )}
                </Fact>
              </div>
            )}
            <Fact label="Aparelho" icon={Device}>
              {[v.device, v.os].filter(Boolean).join(' · ') || 'Não identificado'}
              {v.browser && <Sub>{v.browser}</Sub>}
            </Fact>
            <Fact label="Abriu em" icon={v.embed === 'site' ? Globe : FileText}>
              {v.embed === 'site' ? 'Dentro do site' : 'Link do formulário'}
              {v.page && <Sub title={v.page}>{v.page.replace(/^https?:\/\//, '')}</Sub>}
              <Sub>última atividade {whenLabel(v.lastAt)}</Sub>
            </Fact>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          {v.submissionId && (
            <Button asChild size="sm" className="gap-1.5">
              <Link to={`/crm/formularios/${v.formId}?aba=respostas`}>
                Ver a resposta <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          )}
          {v.siteSessionId && onOpenSiteSession && (
            <Button size="sm" variant="outline" onClick={() => void openSite()} disabled={openingSite} className="gap-1.5">
              {openingSite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" aria-hidden />} Ver a visita do site
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to={`/crm/formularios/${v.formId}?aba=aovivo`}>
              Abrir o formulário <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>

        {rest.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Outras visitas desta pessoa aos formulários</h3>
            <ul className="grid gap-1">
              {rest.slice(0, 8).map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => onOpen(o)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50">
                    <span className="tabular-nums text-gray-900">{whenLabel(o.startedAt)}</span>
                    <span className="min-w-0 truncate text-gray-700">{names.get(o.formId) ?? 'Formulário'}</span>
                    <span className="text-gray-500">{[o.channel || 'Direto', o.campaign].filter(Boolean).join(' · ')}</span>
                    <span className={cn('text-xs font-medium', o.scheduled ? 'text-emerald-700' : o.submitted ? 'text-violet-700' : 'text-gray-400')}>
                      {o.scheduled ? 'agendou' : o.submitted ? 'enviou' : plural(o.stepsSeen.length, 'etapa', 'etapas')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {manager && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {confirm ? (
              <>
                <span>Apagar esta visita? Serve para tirar testes da equipe; a resposta enviada continua em Respostas.</span>
                <Button size="sm" variant="destructive" onClick={() => void remove()}>
                  Apagar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirm(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar visita
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
