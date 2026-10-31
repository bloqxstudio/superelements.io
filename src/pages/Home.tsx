import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Bot, CalendarClock, CheckCircle2, CircleDashed, FileText, Globe, Instagram, KanbanSquare, Megaphone, MessageCircle, Phone, Sparkles, UserPlus, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { money as adMoney } from '@/features/crm/ads'
import { formatPhone } from '@/features/crm/whatsapp'
import { contactLabel, loadSessions, pathLabel, placeLabel, type SiteSession } from '@/features/crm/site'
import { nameOf, useTeamPeople } from '@/features/crm/people'
import { Page, plural } from '@/features/crm/ui'
import { STAGE_LABEL, type Opportunity } from '@/features/prospects/funnel'
import { money as brl } from '@/features/prospects/funnel'
import {
  activityEvents, attentionOf, byRecent, campaignChain, delta, freshnessOf, originChannel, shortDay, spendByCurrency, summarizeOpportunities, windowOf,
  type CampaignRow, type FeedEvent, type Window,
} from '@/features/home/derive'
import { Block, Condition, conditionOf, ago, clock, dayTime, Delta, Empty, LIME, Skeleton, Stat, useNow } from '@/features/home/HomeParts'
import { metaCampaigns, useHome, type Days } from '@/features/home/useHome'
import { PlanBlock } from '@/features/conteudos/PlanBlock'

/**
 * Início: a operação digital da conta numa tela só, da produção à oportunidade ganha.
 * Lê as mesmas fontes das telas de origem (site, anúncios, funil, Instagram, projetos)
 * e cada bloco leva de volta a elas. Não calcula atribuição que o sistema não prova:
 * o vínculo campanha → visita → lead sai do nome ou id da campanha no link (UTM) e do
 * webhook do formulário, e vem sempre rotulado assim.
 */

const ADS_FRESH = 6 * 3_600_000
const IG_FRESH = 12 * 3_600_000
const SITE_POLL_FRESH = 8 * 60_000
const PRODUCTION_FRESH = 5 * 60_000

const DAYS: { id: Days; label: string }[] = [
  { id: 7, label: '7 dias' },
  { id: 30, label: '30 dias' },
]

const plainText = (value: string | undefined, max = 90) => {
  const t = (value ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

const Home: React.FC = () => {
  const [params, setParams] = useSearchParams()
  const days: Days = params.get('periodo') === '30' ? 30 : 7
  const now = useNow()
  const h = useHome(days)
  const { team, opps, site, ads, production, instagram, wa } = h
  const people = useTeamPeople(team?.id)
  const w = useMemo(() => windowOf(days), [days, Math.floor(now / 60_000)]) // eslint-disable-line react-hooks/exhaustive-deps
  const pipelineLoaded = useCrm((s) => s.status)

  const setDays = (d: Days) => setParams(d === 7 ? {} : { periodo: String(d) }, { replace: true })

  const summary = useMemo(() => (opps ? summarizeOpportunities(opps, w, h.settings) : undefined), [opps, w, h.settings])
  const adsData = ads.status === 'ready' ? ads.data : undefined
  const spend = useMemo(() => spendByCurrency((adsData?.reports ?? []).flatMap(({ report }) => (report ? [{ currency: report.currency, spend: report.totals.spend }] : []))), [adsData])
  const chain = useMemo(
    () => (opps || site.status === 'ready' || adsData ? campaignChain(metaCampaigns(adsData), site.status === 'ready' ? site.data.ads : [], opps ?? [], w) : []),
    [opps, site, adsData, w]
  )

  // ---- eventos: o que acabou de acontecer, com horário e origem ----
  const events = useMemo(() => {
    const out: FeedEvent[] = []
    if (opps && h.acts.status === 'ready') out.push(...activityEvents(h.acts.data, opps))
    if (site.status === 'ready') {
      for (const s of site.data.contacts) {
        const what = [...new Set(s.conversions.map(contactLabel))].join(', ') || 'contato'
        out.push({ id: `v:${s.id}`, at: s.lastAt, kind: 'contato', title: `Visita chegou a um contato: ${what}`, detail: [placeLabel(s), s.channel, pathLabel(s.landing)].filter(Boolean).join(' · '), href: '/crm/site?aba=visitas' })
      }
    }
    if (instagram.status === 'ready') {
      for (const m of instagram.data.media) out.push({ id: `m:${m.id}`, at: m.postedAt, kind: 'publicado', title: `Publicado no Instagram${m.product === 'REELS' ? ' (Reels)' : ''}`, detail: plainText(m.caption) || undefined, href: m.permalink })
      for (const s of instagram.data.stories) if (s.status === 'publicado' && s.publishedAt) out.push({ id: `s:${s.id}`, at: s.publishedAt, kind: 'publicado', title: `Story no ar: ${s.title}`, detail: s.pillar, href: '/crm/instagram?aba=stories' })
    }
    if (production.status === 'ready') {
      for (const s of production.data.shares) {
        if (s.state === 'aguardando') out.push({ id: `p:${s.id}`, at: s.sharedAt, kind: 'aprovacao', title: `Página aguardando aprovação do cliente: ${s.pageName}`, detail: s.projectName, href: `/projetos/${s.projectId}` })
        else if (s.respondedAt) out.push({ id: `r:${s.id}`, at: s.respondedAt, kind: 'aprovacao', title: s.state === 'aprovada' ? `Cliente aprovou a página ${s.pageName}` : `Cliente pediu ajustes em ${s.pageName}`, detail: s.projectName, href: `/projetos/${s.projectId}` })
      }
    }
    return out.filter((e) => e.at >= w.from && e.at <= now + 60_000).sort(byRecent).slice(0, 14)
  }, [opps, h.acts, site, instagram, production, w, now])

  // O que chegou depois que a tela abriu ganha uma marca "Novo"
  const seen = useRef<Set<string> | null>(null)
  const fresh = useMemo(() => {
    const ids = events.map((e) => e.id)
    if (!seen.current) {
      if (h.acts.status === 'ready' || site.status === 'ready') seen.current = new Set(ids)
      return new Set<string>()
    }
    return new Set(ids.filter((id) => !seen.current!.has(id)))
  }, [events, h.acts.status, site.status])

  if (pipelineLoaded === 'ready' && !team) {
    return (
      <Page>
        <Empty title="Esta conta ainda não está em uma equipe" text="O Início mostra a operação de uma conta de empresa. Peça um convite em Equipe ou peça à Avence para criar a conta." />
      </Page>
    )
  }

  const attention = buildAttention(h, now)
  const win = `${shortDay(w.from)} a hoje`
  const prevWin = `${shortDay(w.prevFrom)} a ${shortDay(w.prevTo - 1)}`

  return (
    <Page wide>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Início</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {team?.name ?? 'Sua conta'}: acompanhe a produção, os contatos e as próximas ações.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div role="radiogroup" aria-label="Período" className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {DAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={days === d.id}
                onClick={() => setDays(d.id)}
                className={cn('h-8 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]', days === d.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {win} · comparado a {prevWin}
          </p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5">
        <Reading h={h} w={w} summary={summary} spend={spend} now={now} days={days} />

        <PlanBlock />

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Operation h={h} events={events} fresh={fresh} now={now} />
          <Attention items={attention} />
        </div>

        <Campaigns h={h} rows={chain} w={w} now={now} days={days} />

        <Opportunities h={h} summary={summary} opps={opps} people={people} now={now} />

        <Production h={h} now={now} w={w} />

        {h.waOn && <Assistant h={h} />}

        <Sources h={h} now={now} />
      </div>
    </Page>
  )
}

export default Home

// ---------- 1. leitura do período ----------

type HomeData = ReturnType<typeof useHome>
type Summary = ReturnType<typeof summarizeOpportunities> | undefined

const Reading: React.FC<{ h: HomeData; w: Window; summary: Summary; spend: { currency: string; spend: number }[]; now: number; days: Days }> = ({ h, w, summary, spend, now, days }) => {
  const { site, ads } = h
  const siteData = site.status === 'ready' ? site.data : undefined
  const adReports = ads.status === 'ready' ? ads.data.reports.filter((r) => r.report) : []
  const adsWindow = adReports.length ? `${adReports[0].report!.since?.split('-').reverse().slice(0, 2).join('/') ?? '?'} a ${adReports[0].report!.until?.split('-').reverse().slice(0, 2).join('/') ?? '?'}` : undefined
  const oldest = adReports.length ? Math.min(...adReports.map((r) => r.report!.fetchedAt)) : undefined

  // A frase do período usa só o que foi lido; o que falta é dito, não preenchido
  const parts: string[] = []
  if (spend.length) parts.push(`Investimos ${spend.map((s) => adMoney(s.spend, s.currency)).join(' + ')} em anúncios da Meta`)
  if (siteData) parts.push(`o site recebeu ${siteData.totals.sessions.toLocaleString('pt-BR')} visitas e ${plural(siteData.totals.converted, 'chegou', 'chegaram')} a um contato`)
  if (summary) parts.push(`${plural(summary.created, 'oportunidade entrou', 'oportunidades entraram')} no funil e ${plural(summary.won, 'foi ganha', 'foram ganhas')}`)
  const sentence = parts.length ? `Nos últimos ${days} dias: ${parts.join('; ')}.` : undefined

  return (
    <Block id="leitura" title="Resumo do período" hint="Veja os resultados do período. Selecione um indicador para ver os detalhes.">
      {sentence ? <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-gray-800">{sentence}</p> : <Skeleton className="mb-4 h-5 w-2/3" />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Investido em anúncios"
          to="/crm/anuncios"
          muted={!spend.length}
          value={ads.status === 'loading' ? <Skeleton className="h-7 w-28" /> : spend.length ? spend.map((s) => adMoney(s.spend, s.currency, true)).join(' + ') : '—'}
          note={
            spend.length
              ? `Só Meta Ads${adsWindow ? `, ${adsWindow} (a Meta fecha o período no dia anterior)` : ''}. Gasto de outras plataformas não entra.`
              : ads.status === 'none'
                ? 'Nenhuma conta de anúncios conectada: o valor não é zero, é desconhecido.'
                : ads.status === 'off'
                  ? 'Módulo de anúncios desligado nesta conta.'
                  : ads.status === 'error'
                    ? 'Não foi possível ler os anúncios.'
                    : 'Ainda não há relatório deste período. Abra Anúncios para ler da Meta.'
          }
        >
          {oldest && <span className="text-xs text-gray-500">Lido {ago(oldest, now)}</span>}
        </Stat>

        <Stat
          label="Visitas ao site"
          to="/crm/site"
          muted={!siteData}
          value={site.status === 'loading' ? <Skeleton className="h-7 w-20" /> : siteData ? siteData.totals.sessions.toLocaleString('pt-BR') : '—'}
          note={
            siteData
              ? `${siteData.totals.converted.toLocaleString('pt-BR')} chegaram a um contato: clique em WhatsApp, telefone ou e-mail, ou formulário enviado. Clique no WhatsApp não é conversa iniciada.`
              : site.status === 'none'
                ? 'Nenhum site conectado a esta conta.'
                : site.status === 'off'
                  ? 'Módulo do site desligado nesta conta.'
                  : site.status === 'error'
                    ? 'Não foi possível ler o site.'
                    : undefined
          }
        >
          {siteData && <Delta {...delta(siteData.totals.sessions, siteData.previous.sessions)!} />}
        </Stat>

        <Stat
          label="Oportunidades novas"
          to="/crm"
          muted={!summary}
          value={summary ? summary.created.toLocaleString('pt-BR') : h.oppsError ? '—' : <Skeleton className="h-7 w-14" />}
          note={summary ? `${summary.inbound} por formulário ou webhook do site · ${summary.prospected} da prospecção ou cadastro da equipe.` : h.oppsError ? 'Não foi possível ler o funil.' : undefined}
        >
          {summary && <Delta {...delta(summary.created, summary.createdBefore)!} />}
        </Stat>

        <Stat
          label="Ganhas"
          to="/crm"
          muted={!summary}
          value={summary ? summary.won.toLocaleString('pt-BR') : h.oppsError ? '—' : <Skeleton className="h-7 w-10" />}
          note={summary ? (summary.won ? `Valor das ofertas: ${brl(summary.wonOfferValue)}. É a previsão do funil, não receita recebida nem retorno de campanha.` : 'Nenhuma oportunidade passou a Fechado neste período.') : undefined}
        >
          {summary && <Delta {...delta(summary.won, summary.wonBefore)!} />}
        </Stat>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Variações comparam períodos do mesmo tamanho ({days} dias). O gasto não é comparado: a Meta não entrega o período anterior no mesmo formato.
      </p>
    </Block>
  )
}

// ---------- 2. operação acontecendo ----------

const KIND_ICON: Record<FeedEvent['kind'], React.ElementType> = { contato: Phone, lead: UserPlus, etapa: KanbanSquare, publicado: Instagram, aprovacao: FileText }

const Operation: React.FC<{ h: HomeData; events: FeedEvent[]; fresh: Set<string>; now: number }> = ({ h, events, fresh, now }) => {
  const { site } = h
  const live = site.status === 'ready' ? site.data.live : []
  const cond = conditionOf(site, now, { freshMs: SITE_POLL_FRESH, realtime: h.siteRealtime })
  return (
    <Block id="operacao" title="Operação acontecendo" hint="Separado em quem está online agora e o que aconteceu há pouco.">
      <div className="rounded-lg border border-gray-200 p-3.5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe aria-hidden className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">No site agora</h3>
          </div>
          {h.siteOn && <Condition {...cond} title="Quem teve atividade nos últimos 5 minutos" />}
        </div>
        {site.status === 'ready' ? (
          live.length ? (
            <>
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-800">
                <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                <strong className="tabular-nums">{live.length}</strong> {live.length === 1 ? 'pessoa com atividade' : 'pessoas com atividade'} nos últimos 5 minutos
              </p>
              <ul className="mt-2 divide-y divide-gray-100 text-xs text-gray-600">
                {live.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-2 py-1.5">
                    <span className="font-medium text-gray-800">{placeLabel(s) || 'Local não identificado'}</span>
                    <span>{s.channel}</span>
                    <span className="min-w-0 truncate">{pathLabel(s.exit ?? s.landing)}</span>
                    <span className="ml-auto text-gray-400">{ago(s.lastAt, now)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Ninguém com atividade nos últimos 5 minutos.</p>
          )
        ) : site.status === 'loading' ? (
          <Skeleton className="mt-2 h-5 w-48" />
        ) : (
          <p className="mt-2 text-sm text-gray-500">{site.status === 'none' ? site.reason : site.status === 'off' ? 'Módulo do site desligado.' : 'Não foi possível ler o site agora.'}</p>
        )}
      </div>

      <h3 className="mb-1 mt-4 text-sm font-medium text-gray-900">Atividade recente</h3>
      <p className="mb-2 text-xs text-gray-500">Histórico do período, do mais novo ao mais antigo. Nada aqui é ao vivo: é o que já aconteceu.</p>
      {events.length ? (
        <ul className="divide-y divide-gray-100">
          {events.map((e) => (
            <EventRow key={e.id} e={e} isNew={fresh.has(e.id)} now={now} />
          ))}
        </ul>
      ) : h.acts.status === 'loading' || site.status === 'loading' ? (
        <div className="grid gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <Empty title="Nada registrado neste período" text="Visitas com contato, novas oportunidades, mudanças de etapa, publicações e aprovações aparecem aqui assim que acontecem." />
      )}
    </Block>
  )
}

const EventRow: React.FC<{ e: FeedEvent; isNew: boolean; now: number }> = ({ e, isNew, now }) => {
  const Icon = KIND_ICON[e.kind]
  const inner = (
    <>
      <span aria-hidden className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', isNew ? 'text-gray-900' : 'bg-gray-100 text-gray-600')} style={isNew ? { background: LIME } : undefined}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-gray-900">
          {e.title}
          {isNew && <span className="ml-2 rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-gray-900" style={{ background: LIME }}>Novo</span>}
        </span>
        {e.detail && <span className="block truncate text-xs text-gray-500">{e.detail}</span>}
      </span>
      <time dateTime={new Date(e.at).toISOString()} className="shrink-0 text-xs tabular-nums text-gray-500" title={ago(e.at, now)}>
        {dayTime(e.at, now)}
      </time>
    </>
  )
  const cls = 'flex items-start gap-3 py-2.5 transition-colors'
  if (!e.href) return <li className={cls}>{inner}</li>
  const external = /^https?:/.test(e.href)
  return (
    <li>
      {external ? (
        <a href={e.href} target="_blank" rel="noreferrer" className={cn(cls, 'rounded-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
          {inner}
        </a>
      ) : (
        <Link to={e.href} className={cn(cls, 'rounded-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
          {inner}
        </Link>
      )}
    </li>
  )
}

// ---------- 6. pontos de atenção ----------

interface Alert {
  id: string
  title: string
  reason: string
  to: string
  action: string
  weight: number
}

function buildAttention(h: HomeData, now: number): Alert[] {
  const out: Alert[] = []
  // Integrações: desconectadas, com erro ou sem dado recente
  if (h.site.status === 'ready') {
    const t = h.site.data
    if (!t.lastEventAt) out.push({ id: 'site-sem-evento', title: 'O código do site ainda não mandou nenhum evento', reason: 'Sem o código instalado no WordPress, visitas e contatos não são contados.', to: '/crm/site?aba=instalacao', action: 'Ver instalação', weight: 0 })
    else if (now - t.lastEventAt > 24 * 3_600_000) out.push({ id: 'site-parado', title: `O site não envia eventos ${ago(t.lastEventAt, now).replace('há ', 'há ')}`, reason: 'Pode ser um site sem visitas ou o código removido. Os números do período podem estar incompletos.', to: '/crm/site?aba=instalacao', action: 'Conferir instalação', weight: 1 })
  }
  if (h.ads.status === 'ready') {
    for (const { account, report } of h.ads.data.reports) {
      if (account.syncError) out.push({ id: `ads-erro-${account.id}`, title: `Anúncios: ${account.name} precisa ser reconectada`, reason: `A última leitura da Meta falhou (${account.syncError}). Os números mostrados podem estar atrasados.`, to: '/crm/anuncios', action: 'Reconectar', weight: 0 })
      else if (account.tokenExpiresAt && account.tokenExpiresAt - now < 10 * 86_400_000) out.push({ id: `ads-token-${account.id}`, title: `Acesso à conta ${account.name} vence ${account.tokenExpiresAt < now ? 'e já venceu' : 'em breve'}`, reason: 'Depois disso a Meta deixa de ser lida.', to: '/crm/anuncios', action: 'Renovar acesso', weight: 1 })
      else if (!report) out.push({ id: `ads-sem-${account.id}`, title: `${account.name}: sem relatório deste período`, reason: 'A Home mostra o último relatório guardado. Abra Anúncios para ler da Meta.', to: '/crm/anuncios', action: 'Atualizar anúncios', weight: 2 })
      else if (freshnessOf(report.fetchedAt, ADS_FRESH, now) === 'atrasado') out.push({ id: `ads-velho-${account.id}`, title: `Anúncios de ${account.name} lidos ${ago(report.fetchedAt, now)}`, reason: 'O relatório só atualiza quando alguém abre Anúncios. O gasto mostrado pode ter mudado.', to: '/crm/anuncios', action: 'Atualizar anúncios', weight: 2 })
    }
  }
  if (h.instagram.status === 'ready') {
    for (const a of h.instagram.data.accounts) if (a.syncError === 'token') out.push({ id: `ig-${a.id}`, title: `Instagram @${a.username} desconectado`, reason: 'A conexão caiu: posts e números não são atualizados até reconectar.', to: '/crm/instagram', action: 'Reconectar', weight: 0 })
    const review = h.instagram.data.stories.filter((s) => s.status === 'criativo')
    if (review.length) out.push({ id: 'stories-aprovar', title: `${plural(review.length, 'story aguarda', 'stories aguardam')} aprovação`, reason: 'Nada vai ao ar sem uma pessoa da equipe aprovar.', to: '/crm/instagram?aba=stories', action: 'Aprovar stories', weight: 2 })
    const failed = h.instagram.data.stories.filter((s) => s.status === 'falhou')
    if (failed.length) out.push({ id: 'stories-falhou', title: `${plural(failed.length, 'story não saiu', 'stories não saíram')}`, reason: failed[0].error ?? 'A publicação falhou.', to: '/crm/instagram?aba=stories', action: 'Ver stories', weight: 1 })
  }
  if (h.wa.status === 'ready' && h.wa.data?.wanted && h.wa.data.status !== 'connected') out.push({ id: 'wa', title: 'WhatsApp da conta desconectado', reason: 'O número foi ligado mas não está conectado. O assistente não responde enquanto isso.', to: '/crm/whatsapp', action: 'Conectar', weight: 0 })
  if (h.production.status === 'ready') {
    for (const s of h.production.data.shares) {
      if (s.state === 'ajustes') out.push({ id: `ajustes-${s.id}`, title: `Cliente pediu ajustes em ${s.pageName}`, reason: `Projeto ${s.projectName}.`, to: `/projetos/${s.projectId}`, action: 'Abrir projeto', weight: 2 })
      else if (s.state === 'aguardando' && now - s.sharedAt > 3 * 86_400_000) out.push({ id: `espera-${s.id}`, title: `${s.pageName} espera o cliente há ${Math.floor((now - s.sharedAt) / 86_400_000)} dias`, reason: `Projeto ${s.projectName}: o link de aprovação foi enviado e ainda não houve resposta.`, to: `/projetos/${s.projectId}`, action: 'Abrir projeto', weight: 3 })
    }
  }
  // Funil: critérios fixos (ver "Critérios" abaixo)
  if (h.opps) {
    for (const a of attentionOf(h.opps, now)) out.push({ id: a.id, title: a.kind === 'lead' ? `Lead sem responsável: ${a.name}` : a.kind === 'parado' ? `Novo lead parado: ${a.name}` : a.kind === 'atrasado' ? `Próximo passo atrasado: ${a.name}` : `Sem próximo passo: ${a.name}`, reason: a.reason, to: `/crm?oportunidade=${a.oppId}`, action: 'Abrir cartão', weight: a.kind === 'lead' ? 1 : a.kind === 'atrasado' ? 2 : a.kind === 'parado' ? 2 : 4 })
  }
  return out.sort((a, b) => a.weight - b.weight)
}

const Attention: React.FC<{ items: Alert[] }> = ({ items }) => {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 6)
  return (
    <Block id="atencao" title="Pontos de atenção" hint="Só o que pede ação e tem critério definido.">
      {items.length ? (
        <>
          <ul className="grid gap-2">
            {shown.map((a) => (
              <li key={a.id} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{a.reason}</p>
                <Link to={a.to} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-gray-900 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {a.action} <ArrowUpRight aria-hidden className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
          {items.length > 6 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-gray-700 underline underline-offset-2">
              {all ? 'Mostrar menos' : `Mostrar os outros ${items.length - 6}`}
            </button>
          )}
        </>
      ) : (
        <Empty title="Nada pedindo ação agora" text="Com os critérios abaixo, nenhuma integração, lead ou aprovação está parada." />
      )}
      <details className="mt-3 text-xs text-gray-500">
        <summary className="cursor-pointer font-medium text-gray-700">Critérios usados</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed">
          <li>Integração com erro de leitura, acesso vencendo em 10 dias, código do site sem evento ou relatório de anúncios com mais de 6 h.</li>
          <li>Novo lead sem responsável, ou sem mudança há mais de 24 h.</li>
          <li>Oportunidade em Página pronta, Contatado, Em conversa ou Proposta sem próximo passo, ou com a data dele vencida.</li>
          <li>Story aguardando aprovação; página enviada ao cliente sem resposta há mais de 3 dias, ou com ajustes pedidos.</li>
        </ul>
      </details>
    </Block>
  )
}

// ---------- 3. campanhas → oportunidades ----------

const Campaigns: React.FC<{ h: HomeData; rows: CampaignRow[]; w: Window; now: number; days: Days }> = ({ h, rows, w, now, days }) => {
  const [open, setOpen] = useState<string>()
  const adsCond = conditionOf(h.ads, now, { freshMs: ADS_FRESH })
  const loading = (h.ads.status === 'loading' || h.site.status === 'loading') && !rows.length
  return (
    <Block
      id="campanhas"
      title="Campanhas e o caminho até a oportunidade"
      hint="Investimento e resultados lado a lado. Abra uma campanha para ver o que o sistema consegue ligar a ela."
      status={h.adsOn ? <Condition {...adsCond} title="Anúncios são o último relatório guardado da Meta, não tempo real" /> : undefined}
    >
      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : rows.length ? (
        <>
          <div className="hidden grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] gap-3 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 md:grid">
            <span>Campanha</span>
            <span className="text-right">Investido</span>
            <span className="text-right">Resultado da Meta</span>
            <span className="text-right">Visitas</span>
            <span className="text-right">Contatos</span>
            <span className="text-right">Oportunidades</span>
          </div>
          <ul className="grid gap-2">
            {rows.map((r) => (
              <CampaignItem key={r.key} r={r} expanded={open === r.key} onToggle={() => setOpen(open === r.key ? undefined : r.key)} h={h} w={w} days={days} />
            ))}
          </ul>
        </>
      ) : (
        <Empty
          title="Nenhuma campanha com dados neste período"
          text={
            h.ads.status === 'none' && h.site.status === 'none'
              ? 'Conecte uma conta de anúncios e o site para ver quanto cada campanha gastou e o que ela trouxe.'
              : 'Quando houver gasto na Meta, visitas com campanha no link (UTM) ou leads com origem, elas aparecem aqui.'
          }
          to="/crm/anuncios"
          action="Abrir Anúncios"
        />
      )}
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        O gasto de uma campanha no período não é o custo de um lead: por isso nenhum custo por lead é calculado aqui. Vínculos pelo nome da campanha no link (UTM) valem enquanto o nome for o mesmo na Meta, no link e no formulário.
      </p>
      <Journey h={h} />
    </Block>
  )
}

const CampaignItem: React.FC<{ r: CampaignRow; expanded: boolean; onToggle: () => void; h: HomeData; w: Window; days: Days }> = ({ r, expanded, onToggle, h, w, days }) => {
  const cell = 'flex items-baseline justify-between gap-2 md:block md:text-right'
  const lab = 'text-[11px] text-gray-400 md:hidden'
  const id = `camp-${r.key.replace(/[^a-z0-9]/gi, '-')}`
  return (
    <li className="rounded-lg border border-gray-200">
      <button type="button" aria-expanded={expanded} aria-controls={id} onClick={onToggle} className="grid w-full gap-1.5 rounded-lg px-3 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] md:items-center md:gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
            <span>{r.channel}</span>
            {r.from.meta && <span className="rounded bg-gray-100 px-1">gasto da Meta</span>}
            {!r.from.meta && <span className="rounded bg-amber-50 px-1 text-amber-800">só por UTM{r.channel === 'Google Ads' ? ', Google Ads não informa gasto' : ', sem gasto'}</span>}
          </span>
        </span>
        <span className={cell}>
          <span className={lab}>Investido</span>
          <span className="text-sm tabular-nums text-gray-900">{r.spend !== undefined ? adMoney(r.spend, r.currency, true) : <span className="text-gray-400" title="Sem gasto disponível para esta plataforma">—</span>}</span>
        </span>
        <span className={cell}>
          <span className={lab}>Resultado da Meta</span>
          <span className="text-sm tabular-nums text-gray-900">{r.metaResult ? `${r.metaResult.value.toLocaleString('pt-BR')} ${r.metaResult.label.replace(/^\d+\s*/, '')}` : '—'}</span>
        </span>
        <span className={cell}>
          <span className={lab}>Visitas</span>
          <span className="text-sm tabular-nums text-gray-900">{r.from.site ? r.sessions.toLocaleString('pt-BR') : '—'}</span>
        </span>
        <span className={cell}>
          <span className={lab}>Contatos</span>
          <span className="text-sm tabular-nums text-gray-900">{r.from.site ? r.contacts.toLocaleString('pt-BR') : '—'}</span>
        </span>
        <span className={cell}>
          <span className={lab}>Oportunidades</span>
          <span className="text-sm tabular-nums text-gray-900">
            {r.leads.length.toLocaleString('pt-BR')}
            {r.won > 0 && <span className="ml-1 text-xs text-emerald-700">({r.won} ganha{r.won > 1 ? 's' : ''})</span>}
          </span>
        </span>
      </button>
      {expanded && <CampaignDetail id={id} r={r} h={h} w={w} days={days} />}
    </li>
  )
}

/** O percurso de uma campanha, com a origem de cada elo e a fonte para investigar. */
const CampaignDetail: React.FC<{ id: string; r: CampaignRow; h: HomeData; w: Window; days: Days }> = ({ id, r, h, w, days }) => {
  const trackers = h.site.status === 'ready' ? h.site.data.trackers : []
  const [pages, setPages] = useState<{ path: string; sessions: number }[] | null>(null)
  useEffect(() => {
    // As páginas de entrada saem das visitas que trouxeram o nome desta campanha no link
    if (!r.from.site || !trackers.length) return void setPages([])
    let alive = true
    Promise.all(trackers.map((t) => loadSessions(t.id, { period: days, campaign: r.name })))
      .then((lists) => {
        if (!alive) return
        const count = new Map<string, number>()
        for (const s of lists.flatMap((l) => l.sessions)) count.set(pathLabel(s.landing), (count.get(pathLabel(s.landing)) ?? 0) + 1)
        setPages([...count].map(([path, sessions]) => ({ path, sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, 5))
      })
      .catch(() => alive && setPages([]))
    return () => void (alive = false)
  }, [r.name, r.from.site, days]) // eslint-disable-line react-hooks/exhaustive-deps

  const steps: { label: string; value: string; source: string; ok: boolean }[] = [
    { label: 'Investimento', value: r.spend !== undefined ? adMoney(r.spend, r.currency) : 'sem gasto disponível', source: r.from.meta ? 'Relatório da Meta' : 'Esta plataforma não informa gasto ao produto', ok: r.spend !== undefined },
    { label: 'Página de entrada', value: pages === null ? 'lendo…' : pages.length ? pages[0].path : r.from.site ? 'não identificada' : '—', source: 'Visitas com este nome no link (UTM)', ok: !!pages?.length },
    { label: 'Contatos pelo site', value: r.from.site ? `${r.contacts} de ${r.sessions} visitas` : '—', source: 'Cliques em WhatsApp, telefone e e-mail, e formulários', ok: r.from.site },
    { label: 'Oportunidades', value: r.from.funnel ? plural(r.leads.length, 'lead', 'leads') : 'nenhuma com origem', source: 'Formulário via webhook, com a campanha na origem', ok: r.from.funnel },
    { label: 'Ganhas', value: r.from.funnel ? `${r.won}` : '—', source: 'Etapa Fechado no funil. Receita não é rastreada.', ok: r.from.funnel && r.won > 0 },
  ]
  return (
    <div id={id} className="border-t border-gray-100 px-3 pb-3 pt-3">
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label} className="rounded-md bg-gray-50 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
              <span aria-hidden className="text-gray-300">{i + 1}</span>
              {s.label}
            </p>
            <p className={cn('mt-0.5 text-sm tabular-nums', s.ok ? 'text-gray-900' : 'text-gray-400')}>{s.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{s.source}</p>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-gray-500">
        {r.from.meta && r.from.site ? `Vínculo Meta ↔ site feito ${r.matchedBy === 'id' ? 'pelo id da campanha' : 'pelo nome da campanha no link (UTM)'}.` : r.from.meta ? 'Esta campanha tem gasto na Meta, mas nenhuma visita chegou com o nome dela no link: confira os parâmetros UTM do anúncio.' : 'Só o nome no link (UTM) liga esta campanha ao que aconteceu depois.'}
      </p>
      {pages && pages.length > 1 && (
        <p className="mt-1 text-xs text-gray-500">
          Outras páginas de entrada: {pages.slice(1).map((p) => `${p.path} (${p.sessions})`).join(', ')}.
        </p>
      )}
      {r.leads.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-100">
          {r.leads.slice(0, 5).map((o) => (
            <li key={o.id}>
              <Link to={`/crm?oportunidade=${o.id}`} className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{o.lead.name}</span>
                <span className="text-gray-500">{STAGE_LABEL[o.stage]}</span>
                <span className="tabular-nums text-gray-400">{shortDay(Date.parse(o.createdAt))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
        <Link to="/crm/anuncios" className="inline-flex items-center gap-1 text-gray-900 underline underline-offset-2">
          Investigar em Anúncios <ArrowUpRight aria-hidden className="h-3 w-3" />
        </Link>
        <Link to="/crm/site?aba=visitas" className="inline-flex items-center gap-1 text-gray-900 underline underline-offset-2">
          Ver visitas no Site <ArrowUpRight aria-hidden className="h-3 w-3" />
        </Link>
        <Link to="/crm" className="inline-flex items-center gap-1 text-gray-900 underline underline-offset-2">
          Ver no funil <ArrowUpRight aria-hidden className="h-3 w-3" />
        </Link>
      </div>
      <span className="sr-only">Período de {w.days} dias</span>
    </div>
  )
}

/** O que o produto já liga e o que ainda não: a cadeia da produção ao fechamento, sem presumir os elos que faltam. */
const Journey: React.FC<{ h: HomeData }> = ({ h }) => {
  const links: { from: string; to: string; state: 'ok' | 'parcial' | 'falta'; how: string }[] = [
    { from: 'Criativo', to: 'Campanha', state: 'falta', how: 'Os criativos produzidos aqui não têm vínculo registrado com o anúncio da Meta. A Meta mostra o anúncio, mas não a peça de origem.' },
    { from: 'Campanha', to: 'Página', state: 'parcial', how: 'Pelo nome da campanha no link (UTM) e pela página de entrada da visita.' },
    { from: 'Página', to: 'Evento', state: 'ok', how: 'O código do site registra visitas, cliques e formulários por página.' },
    { from: 'Evento', to: 'Lead', state: 'parcial', how: 'Formulário via webhook vira lead com origem. Clique no WhatsApp, telefone e e-mail contam como contato, sem identificar a pessoa.' },
    { from: 'Lead', to: 'Oportunidade', state: 'ok', how: 'O webhook abre o cartão em Novo lead com a origem e o aviso à equipe.' },
    { from: 'Oportunidade', to: 'Fechamento', state: 'ok', how: 'A etapa Fechado do funil.' },
    { from: 'Fechamento', to: 'Receita', state: 'falta', how: 'Só existe o valor da oferta. Receita recebida e retorno da campanha ainda não são medidos.' },
  ]
  return (
    <details className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
      <summary className="cursor-pointer text-xs font-medium text-gray-800">Estado do percurso: o que está ligado hoje</summary>
      <ul className="mt-2 grid gap-1.5">
        {links.map((l) => (
          <li key={l.from} className="flex items-start gap-2">
            {l.state === 'ok' ? <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <CircleDashed aria-hidden className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', l.state === 'parcial' ? 'text-amber-600' : 'text-gray-400')} />}
            <span>
              <strong className="font-medium text-gray-800">
                {l.from} → {l.to}
              </strong>{' '}
              <span className="text-gray-500">({l.state === 'ok' ? 'ligado' : l.state === 'parcial' ? 'parcial' : 'ainda não ligado'})</span>. {l.how}
            </span>
          </li>
        ))}
      </ul>
      {h.ads.status === 'none' && <p className="mt-2 text-gray-500">Sem conta de anúncios conectada, o primeiro elo fica sem gasto.</p>}
    </details>
  )
}

// ---------- 4. oportunidades ----------

const Opportunities: React.FC<{ h: HomeData; summary: Summary; opps: Opportunity[] | null; people: ReturnType<typeof useTeamPeople>; now: number }> = ({ h, summary, opps, people, now }) => {
  const recent = useMemo(() => (opps ? [...opps].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 6) : []), [opps])
  const max = Math.max(1, ...(summary?.byStage.map((s) => s.count) ?? [1]))
  const status = h.oppsError ? <Condition kind="indisponivel" label="Indisponível" /> : h.oppsAt ? (h.realtime ? <Condition kind="tempo-real" label="Tempo real" title="O funil muda para a equipe na hora" /> : <Condition kind="atualizado" label={`Lido às ${clock(h.oppsAt)} · mudanças chegam na hora`} />) : <Condition kind="lendo" label="Lendo…" />
  return (
    <Block id="oportunidades" title="Oportunidades chegando e avançando" hint="As etapas são as do funil da conta. Abrir um cartão leva ao tratamento completo." status={h.crmOn ? status : undefined}>
      {!h.crmOn ? (
        <Empty title="O CRM está desligado nesta conta" />
      ) : h.oppsError ? (
        <Empty title="Não foi possível ler o funil" text={h.oppsError} to="/crm" action="Abrir Oportunidades" />
      ) : !summary ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div>
            <ol aria-label="Cartões por etapa" className="mb-4 grid gap-1.5">
              {summary.byStage.map((s) => (
                <li key={s.id}>
                  <Link to="/crm" className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 rounded text-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[9rem_1fr_2rem]">
                    <span className="truncate text-gray-700">{s.label}</span>
                    <span className="h-2 rounded-full bg-gray-100">
                      <span className="block h-2 rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: s.id === 'perdido' ? '#d4d4d8' : s.id === 'fechado' ? '#10b981' : '#18181b', minWidth: s.count ? 4 : 0 }} />
                    </span>
                    <span className="text-right tabular-nums text-gray-900">{s.count}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <h3 className="mb-1 text-sm font-medium text-gray-900">Entradas mais recentes</h3>
            {recent.length ? (
              <ul className="divide-y divide-gray-100">
                {recent.map((o) => (
                  <OppRow key={o.id} o={o} owner={nameOf(people, o.ownerId)} now={now} />
                ))}
              </ul>
            ) : (
              <Empty title="O funil ainda não tem oportunidades" to="/crm" action="Abrir Oportunidades" />
            )}
            <Link to="/crm" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-900 underline underline-offset-2">
              Ver o funil completo <ArrowUpRight aria-hidden className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid content-start gap-4">
            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">De onde vieram as novas</h3>
              <p className="mb-2 text-xs text-gray-500">Entradas do período, pelo canal registrado no cartão.</p>
              {summary.byOrigin.length ? (
                <ul className="grid gap-1.5 text-xs">
                  {summary.byOrigin.map((o) => (
                    <li key={o.label} className="flex items-center justify-between gap-3">
                      <span className="truncate text-gray-700">{o.label}</span>
                      <span className="tabular-nums text-gray-900">{o.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Nenhuma entrada neste período.</p>
              )}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">Em aberto</h3>
              <p className="text-sm tabular-nums text-gray-900">{summary.open} oportunidades</p>
              <p className="text-xs text-gray-500">Valor das ofertas em aberto: {brl(summary.openOfferValue)} (previsão do funil).</p>
            </div>
          </div>
        </div>
      )}
    </Block>
  )
}

const OppRow: React.FC<{ o: Opportunity; owner?: string; now: number }> = ({ o, owner, now }) => {
  const entered = Date.parse(o.createdAt)
  const origin = o.origin ? [originChannel(o), o.origin.campaign?.name ?? o.origin.utm?.utm_campaign].filter(Boolean).join(' · ') : 'Prospecção ou cadastro da equipe'
  const where = o.origin ? o.origin.form || (o.origin.page ? pathLabel(o.origin.page) : undefined) : undefined
  return (
    <li>
      <Link to={`/crm?oportunidade=${o.id}`} className="grid gap-x-3 gap-y-0.5 rounded-md py-2.5 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto]">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{o.lead.name}</span>
          <span className="block truncate text-xs text-gray-500">
            {origin}
            {where ? ` · ${where}` : ''}
          </span>
          <span className="block truncate text-xs text-gray-500">
            {owner ? `Responsável: ${owner}` : 'Sem responsável'} · {o.nextStep ? `Próximo passo: ${o.nextStep}` : 'Sem próximo passo'}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs sm:flex-col sm:items-end sm:gap-0.5">
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">{STAGE_LABEL[o.stage]}</span>
          <time dateTime={o.createdAt} className="tabular-nums text-gray-500" title={ago(entered, now)}>
            entrou {dayTime(entered, now)}
          </time>
        </span>
      </Link>
    </li>
  )
}

// ---------- 5. produção e publicação ----------

const Production: React.FC<{ h: HomeData; now: number; w: Window }> = ({ h, now, w }) => {
  const { production, instagram } = h
  const projects = production.status === 'ready' ? production.data.projects : []
  const shares = production.status === 'ready' ? production.data.shares : []
  const waiting = shares.filter((s) => s.state === 'aguardando')
  const changes = shares.filter((s) => s.state === 'ajustes')
  const updated = projects.filter((p) => p.updatedAt >= w.from)
  const stories = instagram.status === 'ready' ? instagram.data.stories : []
  const toApprove = stories.filter((s) => s.status === 'criativo')
  const scheduled = stories.filter((s) => s.status === 'agendado' && s.publishAt > now).sort((a, b) => a.publishAt - b.publishAt)
  const live = stories.filter((s) => s.status === 'publicado' && (s.publishedAt ?? 0) >= w.from)
  const media = instagram.status === 'ready' ? instagram.data.media.filter((m) => m.postedAt >= w.from) : []
  if (!h.projOn && !h.adsOn) return null
  return (
    <Block id="producao" title="Produção e publicação" hint="O trabalho que alimenta as campanhas e o site. Cada cartão leva à área para continuar.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {h.projOn && (
          <Tile icon={Sparkles} title="Páginas e projetos" to="/" status={conditionOf(production, now, { freshMs: PRODUCTION_FRESH })}>
            {production.status === 'ready' ? (
              <>
                <Big n={updated.length} text={`${updated.length === 1 ? 'projeto atualizado' : 'projetos atualizados'} no período`} />
                <ul className="mt-2 grid gap-1 text-xs">
                  {projects.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link to={`/projetos/${p.id}`} className="flex justify-between gap-2 rounded text-gray-700 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 text-gray-400">{ago(p.updatedAt, now)}</span>
                      </Link>
                    </li>
                  ))}
                  {!projects.length && <li className="text-gray-500">Nenhum projeto nesta conta.</li>}
                </ul>
              </>
            ) : (
              <SourceNote s={production} />
            )}
          </Tile>
        )}
        {h.projOn && (
          <Tile icon={FileText} title="Aguardando aprovação" to="/" status={conditionOf(production, now, { freshMs: PRODUCTION_FRESH })}>
            {production.status === 'ready' ? (
              <>
                <Big n={waiting.length + changes.length} text="páginas com o cliente" />
                <ul className="mt-2 grid gap-1 text-xs text-gray-600">
                  {[...changes, ...waiting].slice(0, 4).map((s) => (
                    <li key={s.id}>
                      <Link to={`/projetos/${s.projectId}`} className="flex justify-between gap-2 hover:text-gray-900">
                        <span className="truncate">{s.pageName}</span>
                        <span className={cn('shrink-0', s.state === 'ajustes' ? 'text-amber-700' : 'text-gray-400')}>{s.state === 'ajustes' ? 'pediu ajustes' : ago(s.sharedAt, now)}</span>
                      </Link>
                    </li>
                  ))}
                  {!waiting.length && !changes.length && <li className="text-gray-500">Nada esperando o cliente.</li>}
                </ul>
              </>
            ) : (
              <SourceNote s={production} />
            )}
          </Tile>
        )}
        {h.adsOn && (
          <Tile icon={Instagram} title="Stories" to="/crm/instagram?aba=stories" status={conditionOf(instagram, now, { freshMs: IG_FRESH, realtime: instagram.status === 'ready' })}>
            {instagram.status === 'ready' ? (
              <>
                <Big n={toApprove.length} text={toApprove.length === 1 ? 'story para aprovar' : 'stories para aprovar'} />
                <p className="mt-2 text-xs text-gray-600">
                  {scheduled.length ? `Próximo: ${dayTime(scheduled[0].publishAt, now)} (${plural(scheduled.length, 'agendado', 'agendados')}).` : 'Nenhum story agendado.'}
                </p>
                <p className="text-xs text-gray-500">{plural(live.length, 'story no ar', 'stories no ar')} no período.</p>
              </>
            ) : (
              <SourceNote s={instagram} />
            )}
          </Tile>
        )}
        {h.adsOn && (
          <Tile icon={Instagram} title="Publicações no Instagram" to="/crm/instagram" status={conditionOf(instagram, now, { freshMs: IG_FRESH })}>
            {instagram.status === 'ready' ? (
              <>
                <Big n={media.length} text={`${media.length === 1 ? 'post publicado' : 'posts publicados'} no período`} />
                <ul className="mt-2 grid gap-1 text-xs text-gray-600">
                  {media.slice(0, 3).map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span className="truncate">{plainText(m.caption, 40) || 'Sem legenda'}</span>
                      <span className="shrink-0 text-gray-400">{dayTime(m.postedAt, now)}</span>
                    </li>
                  ))}
                  {!media.length && <li className="text-gray-500">Nenhuma publicação no período.</li>}
                </ul>
                <p className="mt-1.5 text-[11px] text-gray-400">Última leitura da conta {instagram.data.accounts[0]?.syncedAt ? ago(instagram.data.accounts[0].syncedAt, now) : 'ainda não feita'}.</p>
              </>
            ) : (
              <SourceNote s={instagram} />
            )}
          </Tile>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Copy e Criativos ainda não guardam um estado (rascunho, em aprovação, aprovado) que a Início possa ler, então não aparecem aqui. Quando um criativo ou página tiver vínculo registrado com uma campanha, ele entra no percurso acima.
      </p>
    </Block>
  )
}

const Tile: React.FC<{ icon: React.ElementType; title: string; to: string; status: { kind: React.ComponentProps<typeof Condition>['kind']; label: string }; children: React.ReactNode }> = ({ icon: Icon, title, to, status, children }) => (
  <div className="flex min-h-[10.5rem] flex-col rounded-lg border border-gray-200 p-3.5">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
        <Icon aria-hidden className="h-4 w-4 text-gray-500" />
        {title}
      </h3>
      <Link to={to} aria-label={`Abrir ${title}`} className="rounded text-gray-400 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
    <div className="flex-1">{children}</div>
    <div className="mt-2">
      <Condition {...status} />
    </div>
  </div>
)

const Big: React.FC<{ n: number; text: string }> = ({ n, text }) => (
  <p className="text-sm text-gray-700">
    <span className="mr-1 text-2xl font-semibold tabular-nums text-gray-900">{n}</span>
    {text}
  </p>
)

const SourceNote: React.FC<{ s: { status: string; reason?: string; message?: string } }> = ({ s }) =>
  s.status === 'loading' ? <Skeleton className="h-16" /> : <p className="text-xs text-gray-500">{s.status === 'none' ? s.reason : s.status === 'off' ? 'Módulo desligado nesta conta.' : 'Não foi possível ler agora.'}</p>

// ---------- 7. assistente ----------

const QUESTIONS = ['Quanto investimos nesta semana?', 'De onde vieram os novos contatos?', 'Quais oportunidades foram ganhas?']

const Assistant: React.FC<{ h: HomeData }> = ({ h }) => {
  const { wa } = h
  const number = wa.status === 'ready' ? wa.data : undefined
  const phone = number?.status === 'connected' ? number.phone : undefined
  return (
    <Block id="assistente" title="Assistente no WhatsApp" hint="Pergunte por mensagem; ele lê os mesmos dados que esta tela, com as mesmas definições, e só responde a números cadastrados.">
      {phone ? (
        <>
          <p className="mb-2 flex items-center gap-2 text-sm text-gray-800">
            <MessageCircle aria-hidden className="h-4 w-4 text-gray-500" />
            Conectado em <strong className="tabular-nums">{formatPhone(phone)}</strong>
          </p>
          <ul className="flex flex-wrap gap-2">
            {QUESTIONS.map((q) => (
              <li key={q}>
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                >
                  {q} <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-gray-400" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">Abre o WhatsApp com a pergunta pronta. Se o seu número não estiver cadastrado, o assistente não responde. Quem gerencia cadastra em WhatsApp › Acessos.</p>
        </>
      ) : wa.status === 'loading' ? (
        <Skeleton className="h-16" />
      ) : (
        <Empty
          title={wa.status === 'ready' && number?.wanted ? 'O WhatsApp da conta está desconectado' : 'Nenhum número do WhatsApp conectado'}
          text="O assistente responde por um número conectado da conta. Sem ele, não há como perguntar por aqui."
          to="/crm/whatsapp"
          action="Abrir WhatsApp"
        />
      )}
    </Block>
  )
}

// ---------- fontes ----------

const Sources: React.FC<{ h: HomeData; now: number }> = ({ h, now }) => {
  const rows: { name: string; how: string; cond?: { kind: React.ComponentProps<typeof Condition>['kind']; label: string }; to: string; icon: React.ElementType }[] = [
    h.crmOn && { name: 'Oportunidades', how: 'Tempo real (a equipe vê cada mudança na hora).', cond: h.oppsError ? { kind: 'indisponivel', label: 'Indisponível' } : h.oppsAt ? { kind: h.realtime ? 'tempo-real' : 'atualizado', label: h.realtime ? 'Tempo real' : `Lido às ${clock(h.oppsAt)}` } : { kind: 'lendo', label: 'Lendo…' }, to: '/crm', icon: KanbanSquare },
    h.siteOn && { name: 'Site (visitas e eventos)', how: 'Tempo real quando disponível; relido a cada 5 min com a aba aberta.', cond: conditionOf(h.site, now, { freshMs: SITE_POLL_FRESH, realtime: h.siteRealtime }), to: '/crm/site', icon: Globe },
    h.adsOn && { name: 'Anúncios da Meta', how: 'Último relatório guardado. Atualiza quando alguém abre Anúncios, não em tempo real.', cond: conditionOf(h.ads, now, { freshMs: ADS_FRESH }), to: '/crm/anuncios', icon: Megaphone },
    h.adsOn && { name: 'Instagram e stories', how: 'Sincronizado pela função da Meta; os stories mudam na hora.', cond: conditionOf(h.instagram, now, { freshMs: IG_FRESH }), to: '/crm/instagram', icon: Instagram },
    h.projOn && { name: 'Projetos e aprovações', how: 'Relido a cada 2 min com a aba aberta.', cond: conditionOf(h.production, now, { freshMs: PRODUCTION_FRESH }), to: '/', icon: Workflow },
    h.waOn && { name: 'WhatsApp', how: 'Tempo real (o estado da conexão chega na hora).', cond: h.wa.status === 'ready' ? (h.wa.data?.status === 'connected' ? { kind: 'tempo-real', label: 'Conectado' } : { kind: 'desconectado', label: 'Desconectado' }) : conditionOf(h.wa, now, { freshMs: 60_000 }), to: '/crm/whatsapp', icon: Bot },
  ].filter(Boolean) as never
  return (
    <details className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] md:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
        De onde vem cada dado e quando foi atualizado
        <span className="ml-2 text-xs font-normal text-gray-500">
          <CalendarClock aria-hidden className="mr-1 inline h-3 w-3" />
          {clock(now)}
        </span>
      </summary>
      <ul className="mt-3 divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
            <r.icon aria-hidden className="h-4 w-4 text-gray-400" />
            <Link to={r.to} className="w-44 font-medium text-gray-900 underline-offset-2 hover:underline">
              {r.name}
            </Link>
            <span className="min-w-0 flex-1 text-gray-500">{r.how}</span>
            {r.cond && <Condition {...r.cond} />}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">Plataformas de anúncios além da Meta (como Google Ads) ainda não informam gasto ao produto. Aparecem nas visitas pelo nome da campanha no link.</p>
    </details>
  )
}

