import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { Banknote, FileText, Globe, Maximize2, Megaphone, MessageCircle, Minimize2, MousePointerClick, TrendingUp, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money as adMoney } from '@/features/crm/ads'
import { contactLabel, pathLabel, placeLabel, type SiteSession } from '@/features/crm/site'
import { Page } from '@/features/crm/ui'
import { money as brl, valueOf, STAGE_LABEL, type Opportunity, type Stage } from '@/features/prospects/funnel'
import { activityEvents, byRecent, spendByCurrency, windowOf, wonAt, type FeedEvent, type Window } from '@/features/home/derive'
import { ago, LIME, useNow } from '@/features/home/HomeParts'
import { useHome, type Days } from '@/features/home/useHome'

/**
 * Operação (CRM › Operação): o caminho do clique ao cliente como um painel de
 * cozinha (KDS), para deixar aberto numa tela. Cada coluna é uma etapa, com o
 * total do período e a passagem da etapa anterior; as bolinhas são o que está
 * acontecendo agora (quem está no site, os cartões parados em cada etapa, as
 * vendas do período) e andam de coluna quando o banco muda. Lê as mesmas fontes
 * da Início (`useHome`): nada é simulado e o que não está conectado mostra "—".
 */

const DAYS: { id: Days; label: string }[] = [
  { id: 1, label: 'Hoje' },
  { id: 7, label: '7 dias' },
  { id: 30, label: '30 dias' },
]

type ColId = 'anuncio' | 'visita' | 'contato' | 'conversa' | 'proposta' | 'venda'

const COLS: { id: ColId; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'anuncio', label: 'Anúncio', icon: Megaphone, hint: 'Cliques no link dos anúncios da Meta no período.' },
  { id: 'visita', label: 'Visita', icon: Globe, hint: 'Visitas ao site no período. As bolinhas são quem está no site agora.' },
  { id: 'contato', label: 'Contato', icon: MousePointerClick, hint: 'Visitas que chegaram a um contato (WhatsApp, telefone, e-mail, formulário). Sem o site conectado, os leads que entraram pelo webhook.' },
  { id: 'conversa', label: 'Conversa', icon: MessageCircle, hint: 'Oportunidades que chegaram a Em conversa no período.' },
  { id: 'proposta', label: 'Proposta', icon: FileText, hint: 'Oportunidades que chegaram a Proposta no período.' },
  { id: 'venda', label: 'Venda', icon: TrendingUp, hint: 'Oportunidades ganhas no período.' },
]

/** Até onde a oportunidade já chegou: Conversa conta quem passou por ela e seguiu. */
const REACHED: Partial<Record<ColId, Stage[]>> = {
  conversa: ['conversa', 'proposta', 'fechado'],
  proposta: ['proposta', 'fechado'],
}

/** Em que coluna o cartão está parado agora (Mapeado e Fila da página são prospecção, não operação). */
const COL_OF_STAGE: Partial<Record<Stage, ColId>> = {
  novo: 'contato',
  pagina: 'contato',
  contatado: 'contato',
  conversa: 'conversa',
  proposta: 'proposta',
}

interface Dot {
  key: string
  col: ColId
  letter: string
  title: string
  /** Desde quando está nesta coluna: o recente acende em lima */
  since: number
  href?: string
}

const within = (t: number, w: Window) => Number.isFinite(t) && t >= w.from && t < w.to

const initial = (name: string | undefined) => (name ?? '').trim().replace(/^(dr|dra|sr|sra)\.?\s+/i, '').charAt(0).toUpperCase() || '?'

const CHANNEL_LETTER: Record<string, string> = { 'Google Ads': 'G', 'Google (busca)': 'G', 'Meta Ads': 'M', Instagram: 'I', Facebook: 'F', Direto: 'D', IAs: 'A', Campanhas: 'C', Sites: 'S' }

/** Quando entrou na etapa em que está (a última entrada do histórico com essa etapa). */
function enteredAt(o: Opportunity): number {
  const entry = [...o.history].reverse().find((h) => h.stage === o.stage)
  const at = Date.parse(entry?.at ?? o.updatedAt)
  return Number.isFinite(at) ? at : Date.now()
}

/** Um número pseudoaleatório fixo por id, para cada bolinha ter o seu lugar e não pular a cada leitura. */
function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString('pt-BR'))

const OperacaoPage: React.FC = () => {
  const [params, setParams] = useSearchParams()
  const days: Days = params.get('periodo') === '30' ? 30 : params.get('periodo') === '7' ? 7 : 1
  const setDays = (d: Days) => setParams(d === 1 ? {} : { periodo: String(d) }, { replace: true })
  const now = useNow(15_000)
  const h = useHome(days)
  const { opps, site, ads } = h
  const w = useMemo(() => windowOf(days), [days, Math.floor(now / 60_000)]) // eslint-disable-line react-hooks/exhaustive-deps

  const siteData = site.status === 'ready' ? site.data : undefined
  const adsData = ads.status === 'ready' ? ads.data : undefined

  // ---- os totais de cada coluna ----
  const totals = useMemo(() => {
    const t: Partial<Record<ColId, number>> = {}
    if (adsData) t.anuncio = adsData.reports.reduce((sum, r) => sum + (r.report?.totals.linkClicks ?? 0), 0)
    if (siteData) {
      t.visita = siteData.totals.sessions
      t.contato = siteData.totals.converted
    }
    if (opps) {
      if (!siteData) t.contato = opps.filter((o) => o.origin && within(Date.parse(o.createdAt), w)).length
      for (const col of ['conversa', 'proposta'] as const) {
        const stages = REACHED[col]!
        t[col] = opps.filter((o) => o.history.some((x) => stages.includes(x.stage) && within(Date.parse(x.at), w))).length
      }
      t.venda = opps.filter((o) => { const at = wonAt(o); return at !== undefined && within(at, w) }).length
    }
    return t
  }, [adsData, siteData, opps, w])

  // ---- dinheiro: investido, custo por lead e por venda, retorno ----
  const money = useMemo(() => {
    const spends = adsData ? spendByCurrency(adsData.reports.filter((r) => r.report).map((r) => ({ currency: r.report!.currency, spend: r.report!.totals.spend }))) : []
    const single = spends.length === 1 ? spends[0] : undefined
    const won = opps?.filter((o) => { const at = wonAt(o); return at !== undefined && within(at, w) }) ?? []
    const wonValue = opps ? won.reduce((sum, o) => sum + valueOf(o, h.settings).total, 0) : undefined
    const spend = single?.spend
    const currency = single?.currency ?? 'BRL'
    const per = (n: number | undefined) => (spend !== undefined && n ? spend / n : undefined)
    return {
      spend,
      currency,
      mixed: spends.length > 1,
      perLead: per(totals.contato),
      perSale: per(totals.venda),
      wonValue,
      roi: spend && wonValue !== undefined && currency === 'BRL' ? wonValue / spend : undefined,
    }
  }, [adsData, opps, w, h.settings, totals.contato, totals.venda])

  // ---- as bolinhas: o que está acontecendo agora ----
  const dots = useMemo(() => {
    const out: Dot[] = []
    for (const s of siteData?.live ?? []) {
      out.push({
        key: `v:${s.id}`,
        col: s.converted ? 'contato' : 'visita',
        letter: CHANNEL_LETTER[s.channel] ?? initial(s.city ?? s.channel),
        title: visitTitle(s),
        since: s.converted ? s.lastAt : s.startedAt,
        href: '/crm/site?aba=visitas',
      })
    }
    for (const o of opps ?? []) {
      const href = `/crm?oportunidade=${o.id}`
      const col = COL_OF_STAGE[o.stage]
      if (col) out.push({ key: `o:${o.id}`, col, letter: initial(o.lead.name), title: `${o.lead.name} · ${STAGE_LABEL[o.stage]}`, since: enteredAt(o), href })
      const won = wonAt(o)
      if (won !== undefined && within(won, w)) out.push({ key: `o:${o.id}`, col: 'venda', letter: initial(o.lead.name), title: `${o.lead.name} · ganha`, since: won, href })
    }
    // Novo leads de prospecção (sem origem) parados há muito tempo não são operação: só os últimos 30 dias
    return out.filter((d) => d.col === 'visita' || d.col === 'venda' || now - d.since < 30 * 86_400_000).sort((a, b) => b.since - a.since)
  }, [siteData, opps, w, now])

  // ---- notificações ----
  const events = useMemo(() => {
    const out: FeedEvent[] = []
    if (opps && h.acts.status === 'ready') out.push(...activityEvents(h.acts.data, opps))
    for (const s of siteData?.contacts ?? []) {
      const what = [...new Set(s.conversions.map(contactLabel))].join(', ') || 'contato'
      out.push({ id: `c:${s.id}`, at: s.lastAt, kind: 'contato', title: `Contato pelo site · ${what}`, detail: [s.campaign || s.channel, placeLabel(s)].filter(Boolean).join(' · '), href: '/crm/site?aba=visitas' })
    }
    return out.filter((e) => e.at >= w.from && e.at <= now + 60_000).sort(byRecent).slice(0, 20)
  }, [opps, h.acts, siteData, w, now])

  // O que chegou com a tela aberta ganha destaque
  const seen = useRef<Set<string> | null>(null)
  const fresh = useMemo(() => {
    const ids = events.map((e) => e.id)
    if (!seen.current) {
      if (events.length || h.acts.status === 'ready') seen.current = new Set(ids)
      return new Set<string>()
    }
    return new Set(ids.filter((id) => !seen.current!.has(id)))
  }, [events, h.acts.status])

  // ---- tela cheia, para deixar numa TV ----
  const board = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === board.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void board.current?.requestFullscreen?.().catch(() => undefined)
  }

  const liveCount = siteData?.live.length ?? 0
  const loading = (!opps && h.crmOn) || site.status === 'loading' || ads.status === 'loading'

  return (
    <Page wide>
      <div ref={board} className={cn('flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm', full && 'h-screen rounded-none border-0')}>
        {/* topo */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: LIME }}>
              <TrendingUp className="h-4 w-4 text-gray-900" aria-hidden />
            </span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight text-gray-900">Operação</h1>
              <p className="text-xs text-gray-500">Do clique ao cliente · {loading ? 'lendo…' : 'ao vivo'}</p>
            </div>
          </div>
          <div className="mx-auto flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label="Período">
            {DAYS.map((d) => (
              <button key={d.id} type="button" onClick={() => setDays(d.id)} aria-pressed={days === d.id} className={cn('h-7 rounded-md px-3 text-xs font-medium transition-colors', days === d.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900')}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {h.siteOn && (
              <span className="flex items-center gap-1.5 text-xs text-gray-600" title="Quem teve atividade no site nos últimos 5 minutos">
                <span aria-hidden className={cn('h-2 w-2 rounded-full', liveCount ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-gray-300')} />
                {liveCount} no site
              </span>
            )}
            <button type="button" onClick={toggleFull} className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50" title={full ? 'Sair da tela cheia' : 'Tela cheia, para deixar numa TV'}>
              {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {full ? 'Sair' : 'Tela cheia'}
            </button>
          </div>
        </header>

        <div className={cn('grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]', full && 'overflow-hidden')}>
          <div className="flex min-w-0 flex-col overflow-x-auto">
            <div className="flex min-w-[720px] flex-1 flex-col">
              {/* cabeçalho das colunas */}
              <div className="grid grid-cols-6 border-b border-gray-200">
                {COLS.map((c, i) => {
                  const value = totals[c.id]
                  const prev = i > 0 ? totals[COLS[i - 1].id] : undefined
                  const pct = value !== undefined && prev ? Math.round((value / prev) * 100) : undefined
                  const Icon = c.icon
                  return (
                    <div key={c.id} title={c.hint} className={cn('relative px-4 pb-3 pt-3', i > 0 && 'border-l border-gray-200', i === 0 && 'bg-[#EEF3E6]', c.id === 'venda' && (value ?? 0) > 0 && 'bg-[#F6FBE3]')}>
                      <div className="flex items-start justify-between">
                        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', c.id === 'venda' && (value ?? 0) > 0 ? 'text-gray-900' : 'bg-gray-100 text-gray-700')} style={c.id === 'venda' && (value ?? 0) > 0 ? { background: LIME } : undefined}>
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        {pct !== undefined && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600" title={`Da etapa anterior: ${COLS[i - 1].label}`}>{pct}%</span>}
                      </div>
                      <p className="mt-3 text-xs font-medium text-gray-600">{c.label}</p>
                      <p className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{fmt(value)}</p>
                    </div>
                  )
                })}
              </div>

              {/* raias com as bolinhas */}
              <Lanes dots={dots} now={now} tall={full} />

              {/* dinheiro */}
              <div className="grid grid-cols-5 border-t border-gray-200">
                <Money label="Investido" value={money.mixed ? 'Moedas diferentes' : money.spend !== undefined ? adMoney(money.spend, money.currency, true) : '—'} hint="Valor usado nos anúncios da Meta no período." />
                <Money label="Custo por lead" value={money.perLead !== undefined ? adMoney(money.perLead, money.currency) : '—'} hint="Investido ÷ contatos." />
                <Money label="Custo por venda" value={money.perSale !== undefined ? adMoney(money.perSale, money.currency) : '—'} hint="Investido ÷ vendas." />
                <Money label="Vendas" value={money.wonValue !== undefined ? brl(money.wonValue) : '—'} hint="Valor da oferta das oportunidades ganhas no período (previsão do funil, não receita recebida)." />
                <Money label="Retorno" value={money.roi !== undefined ? `${money.roi.toLocaleString('pt-BR', { maximumFractionDigits: money.roi < 10 ? 1 : 0 })}×` : '—'} hint="Vendas ÷ investido." highlight={money.roi !== undefined} />
              </div>
            </div>
          </div>

          {/* notificações */}
          <aside className="flex min-h-0 flex-col border-t border-gray-200 lg:border-l lg:border-t-0">
            <p className="px-4 pb-2 pt-4 text-xs font-medium text-gray-500">Notificações</p>
            <div className={cn('min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4', !full && 'max-h-[460px]')}>
              <AnimatePresence initial={false}>
                {events.map((e) => (
                  <motion.div key={e.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    <EventCard event={e} now={now} fresh={fresh.has(e.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {!events.length && <p className="px-1 py-6 text-center text-xs leading-relaxed text-gray-500">{loading ? 'Lendo a operação…' : 'Nada aconteceu no período ainda. Leads, contatos pelo site e mudanças de etapa aparecem aqui na hora.'}</p>}
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 px-5 py-2.5 text-[11px] text-gray-500">
          <Source label="Anúncios" state={ads.status} at={adsData ? Math.max(0, ...adsData.reports.map((r) => r.report?.fetchedAt ?? 0)) : undefined} now={now} to="/crm/anuncios" />
          <Source label="Site" state={site.status} live={h.siteRealtime} to="/crm/site" now={now} />
          <Source label="Funil" state={!h.crmOn ? 'off' : opps ? 'ready' : h.oppsError ? 'error' : 'loading'} live={h.realtime || !!opps} to="/crm" now={now} />
          <span className="ml-auto">Bolinha lima: entrou na etapa na última hora. Clique para abrir.</span>
        </footer>
      </div>
    </Page>
  )
}

function visitTitle(s: SiteSession) {
  return [s.converted ? `Contato: ${[...new Set(s.conversions.map(contactLabel))].join(', ')}` : 'No site agora', s.campaign || s.channel, placeLabel(s), pathLabel(s.exit ?? s.landing)].filter(Boolean).join(' · ')
}

const SLOT = 36
const PAD = 14

const Lanes: React.FC<{ dots: Dot[]; now: number; tall: boolean }> = ({ dots, now, tall }) => {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(240)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const max = Math.max(1, Math.floor((height - PAD * 2) / SLOT))

  return (
    <LayoutGroup>
      <div ref={box} className={cn('grid flex-1 grid-cols-6 bg-[#F6F7F9]', tall ? 'min-h-[260px]' : 'min-h-[240px]')}>
        {COLS.map((c, i) => {
          const list = dots.filter((d) => d.col === c.id)
          const shown = list.length > max ? list.slice(0, max - 1) : list
          const rest = list.length - shown.length
          return (
            <div key={c.id} className={cn('relative', i > 0 && 'border-l border-dashed border-gray-300')} aria-label={`${c.label}: ${list.length} agora`}>
              {shown.map((d, slot) => {
                const offset = (hash(d.key) - 0.5) * 56
                const recent = now - d.since < 3_600_000
                const tone = recent ? LIME : now - d.since < 86_400_000 ? '#CFE0B4' : '#E3EBD6'
                return (
                  <motion.button
                    key={d.key}
                    layoutId={d.key}
                    type="button"
                    title={`${d.title} · ${ago(d.since, now)}`}
                    onClick={() => d.href && navigate(d.href)}
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:z-10 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30"
                    style={{ top: PAD + slot * SLOT, left: `calc(50% - 16px + ${offset}px)`, background: tone }}
                  >
                    {d.letter}
                  </motion.button>
                )
              })}
              {rest > 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 shadow-sm" style={{ top: PAD + (max - 1) * SLOT + 6 }}>
                  +{rest}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

const Money: React.FC<{ label: string; value: string; hint: string; highlight?: boolean }> = ({ label, value, hint, highlight }) => (
  <div title={hint} className={cn('border-l border-gray-200 px-4 py-3 first:border-l-0', highlight && 'bg-[#EEF3E6]')}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className={cn('mt-0.5 truncate text-lg font-semibold tabular-nums tracking-tight', highlight ? 'text-[#3F5A1E]' : 'text-gray-900')}>{value}</p>
  </div>
)

const KIND_ICON: Record<FeedEvent['kind'], React.ElementType> = { lead: UserPlus, contato: MousePointerClick, etapa: TrendingUp, publicado: Megaphone, aprovacao: FileText }

const EventCard: React.FC<{ event: FeedEvent; now: number; fresh: boolean }> = ({ event, now, fresh }) => {
  const Icon = event.title.includes('foi ganha') ? Banknote : KIND_ICON[event.kind]
  const body = (
    <div className={cn('flex gap-3 rounded-xl p-3 transition-colors', fresh ? 'bg-[#F4F9E4]' : 'bg-gray-50 hover:bg-gray-100')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold leading-snug text-gray-900">{event.title}</span>
          <span className="shrink-0 text-[11px] text-gray-500">{now - event.at < 120_000 ? 'agora' : ago(event.at, now).replace('há ', '')}</span>
        </span>
        {event.detail && <span className="mt-0.5 block text-xs leading-snug text-gray-500">{event.detail}</span>}
      </span>
    </div>
  )
  return event.href?.startsWith('/') ? <Link to={event.href} className="block">{body}</Link> : body
}

const Source: React.FC<{ label: string; state: string; at?: number; live?: boolean; now: number; to: string }> = ({ label, state, at, live, now, to }) => {
  const text = state === 'off' ? 'desligado' : state === 'none' ? 'não conectado' : state === 'error' ? 'falhou' : state === 'loading' ? 'lendo' : live ? 'ao vivo' : at ? `lido ${ago(at, now)}` : 'lido'
  const color = state === 'ready' ? (live ? 'bg-emerald-500' : 'bg-gray-400') : state === 'error' ? 'bg-red-500' : 'bg-gray-300'
  return (
    <Link to={to} className="flex items-center gap-1.5 hover:text-gray-900">
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', color)} />
      {label}: {text}
    </Link>
  )
}

export default OperacaoPage
