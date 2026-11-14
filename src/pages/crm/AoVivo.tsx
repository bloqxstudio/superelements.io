import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Globe, Loader2, Radio, Send } from 'lucide-react'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { isLive as isFormLive, useNow, type FormVisit } from '@/features/crm/formVisits'
import { liveReport } from '@/features/crm/OperacaoAoVivo'
import { LiveNow, useTeamFormVisits } from '@/features/crm/SiteForms'
import { FormVisitPanel } from '@/features/crm/FormVisitPanel'
import { SiteMap } from '@/features/crm/SiteMap'
import { FormsMap } from '@/features/crm/FormsMap'
import { VisitPanel } from '@/features/crm/SiteVisits'
import { isLiveSession, loadLiveOfTeam, loadTrackers, useTeamSiteFeed, type SiteSession, type SiteTracker } from '@/features/crm/site'
import { countsAsVisit } from '@/features/crm/siteFunnel'
import { Page, Surface, plural } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * Ao vivo (Resultados › Ao vivo, 2026-11-14, o usuário: "vamos medir sempre se alguém está passando por esses
 * ativos, indicando no painel que temos alguém online, indo para o painel ao vivo — deve ser uma tela e todo
 * link deve levar pra essa tela"). Quem está agora no site (atividade nos últimos 5 min) e nos formulários
 * (sinal no último minuto) da conta, numa lista só, com o mapa, as origens e o que já aconteceu hoje. O
 * indicador do menu, o botão da tela Visitas e a Operação trazem para cá.
 */

const POLL_MS = 15_000

const Tile: React.FC<{ icon: React.ElementType; label: string; value: number; sub?: string; live?: boolean; dark?: boolean }> = ({ icon: Icon, label, value, sub, live, dark }) => (
  <div className={cn('rounded-xl p-4', dark ? 'bg-zinc-900 text-white' : 'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]')}>
    <span className={cn('flex items-center gap-2 text-xs font-medium', dark ? 'text-zinc-300' : 'text-gray-500')}>
      {live ? (
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          {value > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', value > 0 ? 'bg-emerald-500' : 'bg-gray-400')} />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </span>
    <p className={cn('mt-2 text-[28px] font-semibold leading-tight tabular-nums tracking-tight', dark ? 'text-white' : 'text-gray-900')}>{value.toLocaleString('pt-BR')}</p>
    {sub && <p className={cn('mt-0.5 text-xs', dark ? 'text-zinc-400' : 'text-gray-500')}>{sub}</p>}
  </div>
)

const LiveScreen: React.FC<{ teamId: string; manager: boolean; siteOn: boolean }> = ({ teamId, manager, siteOn }) => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SiteSession[] | null>(siteOn ? null : [])
  const [trackers, setTrackers] = useState<SiteTracker[]>([])
  const [opened, setOpened] = useState<SiteSession | null>(null)
  const [openedForm, setOpenedForm] = useState<FormVisit | null>(null)
  const forms = useTeamFormVisits(teamId, 'hoje')
  const now = useNow(5000)

  useEffect(() => {
    if (!siteOn) return
    let stop = false
    loadTrackers(teamId).then((t) => !stop && setTrackers(t)).catch(() => undefined)
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      loadLiveOfTeam(teamId)
        .then((list) => !stop && setSessions(list))
        .catch(() => !stop && setSessions((s) => s ?? []))
    }
    poll()
    const timer = window.setInterval(poll, POLL_MS)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [teamId, siteOn])

  useTeamSiteFeed(siteOn ? teamId : undefined, (session) => {
    setOpened((current) => (current?.id === session.id ? session : current))
    setSessions((list) => {
      const current = list ?? []
      return current.some((s) => s.id === session.id) ? current.map((s) => (s.id === session.id ? session : s)) : [session, ...current]
    })
  })

  // `now` faz quem parou de dar sinal sair da lista sem nova leitura
  const siteLive = useMemo(() => (sessions ?? []).filter(isLiveSession), [sessions, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const formLive = useMemo(() => forms.all.filter((v) => isFormLive(v, now)), [forms.all, now])
  const formLink = formLive.filter(countsAsVisit).length
  const total = siteLive.length + formLink
  const filling = formLive.filter((v) => v.started || v.screen === 'steps' || v.screen === 'booking').length

  const origins = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of siteLive) map.set(s.channel || 'Direto', (map.get(s.channel || 'Direto') ?? 0) + 1)
    for (const v of formLive) if (countsAsVisit(v)) map.set(v.channel || 'Direto', (map.get(v.channel || 'Direto') ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [siteLive, formLive])

  const today = forms.current
  const todaySent = today.filter((v) => v.submitted).length
  const todayBooked = today.filter((v) => v.scheduled).length
  const mapReport = useMemo(() => liveReport(siteLive), [siteLive])

  if (sessions === null || !forms.ready)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Vendo quem está agora…
      </p>
    )

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Radio} label="Ao vivo agora" value={total} sub={total ? plural(origins.length, 'origem', 'origens') : 'Ninguém agora'} live dark />
        <Tile icon={Globe} label="No site" value={siteLive.length} sub="atividade nos últimos 5 min" />
        <Tile
          icon={FileText}
          label="No formulário"
          value={formLive.length}
          sub={formLive.length > formLink ? `${formLive.length - formLink} dentro do site (já contam no site)` : `${filling} preenchendo agora`}
        />
        <Tile icon={Send} label="Hoje nos formulários" value={today.length} sub={`${todaySent} enviaram · ${todayBooked} agendaram`} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LiveNow site={siteLive} forms={formLive} formsById={forms.forms} onOpenSession={setOpened} onOpenForm={setOpenedForm} />
        <Surface title="Agora, por origem">
          {origins.length ? (
            <ul className="grid gap-2">
              {origins.map(([channel, n]) => (
                <li key={channel} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-gray-700">{channel}</span>
                  <span className="shrink-0 font-medium tabular-nums text-gray-900">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Ninguém agora.</p>
          )}
          <p className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
            Quem está no formulário dentro de um site com o código de visitas conta uma vez só, pelo site.
          </p>
          <Link to="/crm/site" className="mt-2 inline-block text-xs font-medium text-gray-600 hover:text-gray-900">
            Ver os relatórios em Visitas
          </Link>
        </Surface>
      </div>

      {siteOn && trackers.length > 0 && (
        <SiteMap title="Onde estão agora (site)" report={mapReport} live={siteLive} onVisits={() => navigate('/crm/site?aba=lista')} onOpenSession={setOpened} />
      )}

      {formLive.length > 0 && <FormsMap title="Onde estão agora (formulários)" visits={today} live={formLive} formName={(id) => forms.forms.get(id)?.live?.name || forms.forms.get(id)?.name || 'Formulário'} />}

      {openedForm && (
        <FormVisitPanel
          // Ao vivo: a linha mais nova da visita (etapa, sinal) vem da lista
          visit={forms.all.find((v) => v.id === openedForm.id) ?? openedForm}
          form={forms.forms.get(openedForm.formId)}
          manager={manager}
          onOpen={setOpenedForm}
          onClose={() => setOpenedForm(null)}
          onOpenSiteSession={(session) => {
            setOpenedForm(null)
            setOpened(session)
          }}
        />
      )}

      {opened && (
        <VisitPanel
          siteId={opened.siteId ?? trackers[0]?.id ?? ''}
          session={opened}
          manager={manager}
          onOpen={setOpened}
          onClose={() => setOpened(null)}
          onRemoved={() => setOpened(null)}
        />
      )}
    </div>
  )
}

const AoVivoPage: React.FC = () => {
  const { team } = useCrm()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  return (
    <Page wide>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Radio className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Ao vivo</h1>
          <p className="mt-0.5 text-sm text-gray-500">Quem está agora nos ativos da empresa: site e formulários. Atualiza sozinho.</p>
        </div>
      </div>
      {team ? (
        <LiveScreen key={team.id} teamId={team.id} manager={manager} siteOn={moduleOn(team, 'site')} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
        </p>
      )}
    </Page>
  )
}

export default AoVivoPage
