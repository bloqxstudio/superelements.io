import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, CircleAlert, Copy, ExternalLink, Eye, Facebook, Info, Instagram as InstagramIcon, KeyRound, ListFilter, Loader2, Megaphone, Plus, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Chip } from '@/features/prospects/ui'
import { BarList, Sparkline, TrendChart, shortDay, type Point } from './InstagramCharts'
import { compact, percent } from './instagram'
import { nameOf, useTeamPeople } from './people'
import { FIELD, Surface, dayLabel, plural, whenLabel } from './ui'
import {
  ACCOUNT_STATUS,
  AD_PRESETS,
  AdsError,
  GENDER_LABEL,
  MISSING_LABEL,
  NoAdTablesError,
  OBJECTIVE_LABEL,
  PLATFORM_LABEL,
  PREVIEW_FORMATS,
  PRESET_LABEL,
  adsManagerAdUrl,
  adsManagerUrl,
  adsRedirectUri,
  adsStatus,
  campaignStatus,
  chooseAdAccounts,
  connectAdsWithToken,
  contactsOf,
  cpcOf,
  cpmOf,
  ctrOf,
  disconnectAdAccount,
  fetchAdPreview,
  fetchAdReport,
  loadAdAccounts,
  loadAdReport,
  money,
  resultCost,
  resultLabel,
  startAdsConnect,
  type AdAccount,
  type AdCampaign,
  type AdCreative,
  type AdPreset,
  type AdPreview,
  type AdReport,
  type AdResult,
  type Pending,
  type PreviewFormat,
} from './ads'
import {
  DEFAULT_TILES,
  METRIC,
  METRICS,
  METRIC_GROUPS,
  formatMetric,
  saveChart,
  saveTiles,
  savedChart,
  savedTiles,
  viewOf,
  type AdView,
  type Slice,
  type SubContext,
} from './adsMetrics'

/**
 * Aba Anúncios da tela do Instagram: as campanhas de Facebook e Instagram da
 * conta de anúncios ligada à equipe, pela API de anúncios da Meta. Seis
 * destaques com a métrica que cada pessoa escolhe (nomes do Gerenciador), o
 * gráfico por dia de qualquer métrica, o filtro de campanhas (vale para a aba
 * inteira), cada campanha com o resultado e o custo dele, plataformas, público
 * e os anúncios, que abrem a prévia nativa da Meta. Só leitura; mudar
 * campanha é no Gerenciador de Anúncios.
 */

const STALE = 30 * 60_000
const DAY = 86_400_000

const ago = (at: number | undefined) => {
  if (!at) return 'nunca'
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`
  return whenLabel(at)
}

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado'),
    () => toast.error('Não consegui copiar')
  )

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// ---------- conectar ----------

const AdsSetupGuide: React.FC<{ reason?: string }> = ({ reason }) => (
  <div className="mt-5 rounded-lg bg-zinc-50 p-4 text-sm text-gray-700">
    <p className="font-medium text-gray-900">Para ligar a API de anúncios (uma vez só)</p>
    {reason && <p className="mt-1 text-xs text-gray-500">{reason}</p>}
    <ol className="mt-3 grid list-decimal gap-2 pl-5 marker:text-gray-400">
      <li>
        No app da Meta (o mesmo do Instagram), o caso de uso de medir o desempenho dos anúncios com a Marketing API precisa estar adicionado, com a permissão <code className="text-xs">ads_read</code>.
      </li>
      <li>
        Em Login do Facebook para empresas › Configurações, cadastre este endereço de volta:
        <span className="mt-1 flex items-center gap-2">
          <code className="min-w-0 truncate rounded bg-white px-2 py-1 text-xs ring-1 ring-inset ring-gray-200">{adsRedirectUri()}</code>
          <button type="button" onClick={() => void copy(adsRedirectUri())} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-gray-900" aria-label="Copiar o endereço">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </span>
      </li>
      <li>
        Opcional: em Login do Facebook para empresas › Configurações de login, crie uma com token de <em>usuário do sistema</em>, ativo <em>contas de anúncios</em> e permissão <code className="text-xs">ads_read</code>. Com ela o acesso não expira; sem ela, vale 60 dias.
      </li>
      <li>
        No Supabase: aplique a migração <code className="text-xs">20261025120000_crm_meta_ads.sql</code>, guarde os segredos <code className="text-xs">META_APP_ID</code> e <code className="text-xs">META_APP_SECRET</code> (Configurações do app › Informação básica) e, se criou a configuração, <code className="text-xs">META_LOGIN_CONFIG_ID</code>; publique a função <code className="text-xs">meta-ads</code>.
      </li>
      <li>
        Com o app em desenvolvimento, só entra quem tem uma função no app da Meta. O gestor de tráfego pode compartilhar a conta de anúncios com quem já é do app, ou ser adicionado em Funções do app e entrar ele mesmo (convidado para a equipe em Equipe).
      </li>
    </ol>
  </div>
)

/** As contas de anúncios que o login enxerga: só as marcadas ficam ligadas à equipe. */
export const AccountPicker: React.FC<{ pending: Pending; onDone: (ids: string[]) => void; onCancel?: () => void }> = ({ pending, onDone, onCancel }) => {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(pending.accounts.length === 1 ? [pending.accounts[0].id] : []))
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const list = pending.accounts.filter((a) => !query.trim() || `${a.name} ${a.business ?? ''} ${a.id}`.toLowerCase().includes(query.trim().toLowerCase()))

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    setBusy(true)
    try {
      const result = await chooseAdAccounts(pending.pendingId, [...chosen])
      toast.success(result.accounts.length === 1 ? `${result.accounts[0].name} ligada` : `${result.accounts.length} contas de anúncios ligadas`)
      onDone(result.accounts.map((a) => a.id))
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-600">
        {pending.who ? (
          <>
            Entrou como <span className="font-medium text-gray-900">{pending.who}</span>.{' '}
          </>
        ) : null}
        Marque só as contas de anúncios desta equipe: as outras que esse acesso enxerga não são lidas.
      </p>
      {pending.accounts.length > 8 && <input className={cn(FIELD, 'mt-3 h-9')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome, negócio ou número" aria-label="Buscar conta" />}
      <ul className="mt-3 grid max-h-[50vh] grid-cols-1 gap-1.5 overflow-y-auto">
        {list.map((a) => {
          const problem = a.status !== undefined && a.status !== 1 ? ACCOUNT_STATUS[a.status] : undefined
          return (
            <li key={a.id}>
              <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset transition-colors', chosen.has(a.id) ? 'bg-zinc-50 ring-gray-900' : 'ring-gray-200 hover:bg-zinc-50')}>
                <input type="checkbox" checked={chosen.has(a.id)} onChange={() => toggle(a.id)} className="mt-0.5 h-4 w-4 accent-gray-900" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{a.name}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {[a.business, a.currency, `conta ${a.id}`].filter(Boolean).join(' · ')}
                    {problem ? ` · ${problem}` : ''}
                  </span>
                </span>
                {a.connected && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">já ligada</span>}
              </label>
            </li>
          )
        })}
        {!list.length && <li className="px-3 py-4 text-sm text-gray-500">Nenhuma conta com esse nome.</li>}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={!chosen.size || busy} className="gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {chosen.size > 1 ? `Ligar ${chosen.size} contas` : 'Ligar a conta'}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
        {pending.kind === 'system' ? (
          <span className="text-xs text-gray-500">Acesso de usuário do sistema: não expira.</span>
        ) : pending.expiresAt ? (
          <span className="text-xs text-gray-500">Acesso válido até {dayLabel(pending.expiresAt)}.</span>
        ) : null}
      </div>
    </div>
  )
}

const AdsTokenForm: React.FC<{ teamId: string; onPending: (p: Pending) => void }> = ({ teamId, onPending }) => {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setBusy(true)
    try {
      onPending(await connectAdsWithToken(teamId, token.trim()))
      setToken('')
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 grid gap-2">
      <label className="block">
        <span className="text-xs font-medium text-gray-700">Token com a permissão ads_read</span>
        <input className={cn(FIELD, 'mt-1 h-9 font-mono text-xs')} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAA…" autoComplete="off" spellCheck={false} />
      </label>
      <p className="text-xs text-gray-500">
        O melhor é o de um usuário do sistema (Configurações do negócio › Usuários do sistema › Gerar token, com a conta de anúncios atribuída), que não expira. O token vai direto para o servidor e não fica no navegador.
      </p>
      <div>
        <Button type="submit" size="sm" disabled={busy || token.trim().length < 20}>
          {busy ? 'Conferindo…' : 'Ver as contas desse token'}
        </Button>
      </div>
    </form>
  )
}

const AdsConnectCard: React.FC<{ teamId: string; again?: boolean; onDone: (ids: string[]) => void }> = ({ teamId, again, onDone }) => {
  const [status, setStatus] = useState<{ configured: boolean; systemLogin: boolean } | { unavailable: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [withToken, setWithToken] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    adsStatus()
      .then((s) => setStatus({ configured: s.configured, systemLogin: s.systemLogin }))
      .catch((e) => setStatus({ unavailable: errorText(e) }))
  }, [])

  const connect = async () => {
    setBusy(true)
    try {
      await startAdsConnect(teamId)
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }

  const ready = !!status && 'configured' in status && status.configured
  const deployed = !!status && 'configured' in status

  return (
    <Surface className="mx-auto max-w-2xl">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-gray-700" aria-hidden>
        <Megaphone className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-gray-900">{again ? 'Ligar outra conta de anúncios' : 'Ligar a conta de anúncios'}</h2>
      <p className="mt-1 text-sm text-gray-600">
        As campanhas de Facebook e Instagram pela API oficial da Meta: investimento, contatos, alcance, cliques e o custo de cada resultado, por campanha, por dia e por público. Só leitura: nada aqui muda campanha ou orçamento.
      </p>

      {pending ? (
        <div className="mt-5">
          <AccountPicker pending={pending} onDone={onDone} onCancel={() => setPending(null)} />
        </div>
      ) : !status ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Conferindo a ligação com a Meta…
        </p>
      ) : (
        <>
          <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-gray-600">
            Quem entra é quem tem acesso à conta de anúncios, como o gestor de tráfego. Ele escolhe só as contas desta equipe, e todos daqui passam a ver os números.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => void connect()} disabled={!ready || busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
              Entrar com o Facebook
            </Button>
            {deployed && (
              <Button variant="outline" onClick={() => setWithToken((v) => !v)} className="gap-2">
                <KeyRound className="h-4 w-4" /> Colar um token
              </Button>
            )}
          </div>
          {withToken && <AdsTokenForm teamId={teamId} onPending={setPending} />}
          {!ready && (
            <AdsSetupGuide
              reason={
                'unavailable' in status
                  ? `${status.unavailable} Enquanto isso, nada aqui funciona.`
                  : 'A função está publicada, mas faltam os segredos do app da Meta. Dá para ligar colando um token com a permissão ads_read.'
              }
            />
          )}
        </>
      )}
    </Surface>
  )
}

// ---------- números ----------

const AdThumb: React.FC<{ ad: AdCreative; className?: string }> = ({ ad, className }) => {
  const [broken, setBroken] = useState(false)
  return (
    <div className={cn('flex items-center justify-center overflow-hidden bg-zinc-100 text-gray-400', className)}>
      {ad.thumbnail && !broken ? (
        <img src={ad.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <Megaphone className="h-4 w-4" aria-hidden />
      )}
    </div>
  )
}

const ResultCell: React.FC<{ result?: AdResult }> = ({ result }) =>
  result ? (
    <>
      <span className="font-medium text-gray-900">{compact(result.value)}</span> <span className="text-xs text-gray-500">{resultLabel(result.type, result.value)}</span>
    </>
  ) : (
    <span className="text-gray-400">—</span>
  )

const budgetLabel = (c: AdCampaign, currency: string) =>
  c.dailyBudget !== undefined ? `${money(c.dailyBudget, currency)}/dia` : c.lifetimeBudget !== undefined ? `${money(c.lifetimeBudget, currency)} no total` : undefined

/** A lista de métricas da Meta, por grupo, para escolher uma. */
const MetricMenuItems: React.FC<{ value: string; onChange: (key: string) => void }> = ({ value, onChange }) => (
  <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
    {METRIC_GROUPS.map((g, i) => (
      <DropdownMenuGroup key={g}>
        {i > 0 && <DropdownMenuSeparator />}
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{g}</DropdownMenuLabel>
        {METRICS.filter((m) => m.group === g).map((m) => (
          <DropdownMenuRadioItem key={m.key} value={m.key} className="text-[13px]">
            {m.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuGroup>
    ))}
  </DropdownMenuRadioGroup>
)

const MENU = 'max-h-[min(70vh,560px)] w-72 overflow-y-auto'

/** Um destaque: o nome da métrica abre a lista para trocar (como os cartões do Google Ads). */
const MetricTile: React.FC<{ metric: string; view: AdView; ctx: SubContext; dark?: boolean; onChange: (key: string) => void; onReset: () => void }> = ({ metric, view, ctx, dark, onChange, onReset }) => {
  const def = METRIC[metric] ?? METRIC.spend
  const value = def.get(view.totals)
  const series = view.days.map((d) => def.get(d.bag)).filter((v): v is number => v !== undefined && Number.isFinite(v))
  return (
    <div className={cn('flex min-h-[132px] min-w-0 flex-col rounded-xl p-4', dark ? 'bg-zinc-900 text-white' : 'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]')}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          className={cn(
            '-mx-1 inline-flex max-w-full items-center gap-1 self-start rounded-md px-1 py-0.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dark ? 'text-zinc-300 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          )}
          title={`${def.label}: trocar a métrica`}
        >
          <span className="truncate">{def.short ?? def.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={MENU}>
          <MetricMenuItems value={def.key} onChange={onChange} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onReset} className="text-[13px] text-gray-600">
            Voltar os destaques ao padrão
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className={cn('mt-1 truncate text-[26px] font-semibold leading-tight tracking-tight tabular-nums', dark ? 'text-white' : 'text-gray-900')}>{formatMetric(def, value, ctx.currency, true)}</p>
      {def.sub && <p className={cn('mt-auto pt-2 text-xs leading-snug', dark ? 'text-zinc-400' : 'text-gray-500')}>{def.sub(view.totals, ctx)}</p>}
      {series.length > 1 && <Sparkline values={series} color={dark ? '#7CF0C4' : '#2D83EE'} className="mt-2 h-7 w-full" />}
    </div>
  )
}

const Tiles: React.FC<{ view: AdView; ctx: SubContext }> = ({ view, ctx }) => {
  const [tiles, setTiles] = useState<string[]>(savedTiles)
  const change = (index: number, key: string) =>
    setTiles((current) => {
      const next = current.map((k, i) => (i === index ? key : k))
      saveTiles(next)
      return next
    })
  const reset = () => {
    saveTiles(DEFAULT_TILES)
    setTiles(DEFAULT_TILES)
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((key, i) => (
        <MetricTile key={i} metric={key} view={view} ctx={ctx} dark={i === 0} onChange={(k) => change(i, k)} onReset={reset} />
      ))}
    </div>
  )
}

/** O gráfico por dia, com a métrica escolhida na lista da Meta. */
const DayChart: React.FC<{ view: AdView; currency: string }> = ({ view, currency }) => {
  const [metric, setMetric] = useState(savedChart)
  const def = METRIC[metric] ?? METRIC.spend
  const percentKind = def.kind === 'percent'
  const points: Point[] = view.days.flatMap((d) => {
    const v = def.get(d.bag)
    return v === undefined || !Number.isFinite(v) ? [] : [{ day: d.day, value: percentKind ? v * 100 : v }]
  })
  const choose = (key: string) => {
    setMetric(key)
    saveChart(key)
  }
  return (
    <section className="min-w-0 rounded-xl bg-zinc-900 p-4 text-white md:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{def.label} por dia</h2>
          <p className="text-xs text-zinc-400">
            {!view.days.length
              ? 'Sem dias no período'
              : view.days.length < view.periodDays
                ? `Desde ${shortDay(view.days[0].day)}, o primeiro dia com anúncio`
                : `${view.days.length} dias do período`}
          </p>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <span className="truncate">{def.short ?? def.label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU}>
            <MetricMenuItems value={def.key} onChange={choose} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {points.length ? (
        <TrendChart
          points={points}
          unit=""
          format={(n) => (percentKind ? `${n.toFixed(2).replace('.', ',')}%` : formatMetric(def, n, currency))}
          label={`${def.label} por dia`}
          tone="dark"
          height={260}
        />
      ) : (
        <p className="flex h-[260px] items-center justify-center text-sm text-zinc-400">Nenhum dia com esse número neste período.</p>
      )}
    </section>
  )
}

/** Escolher as campanhas que a aba inteira mostra (destaques, gráfico, cortes e anúncios). */
const CampaignFilter: React.FC<{ campaigns: AdCampaign[]; selected: string[] | null; onChange: (ids: string[] | null) => void; currency: string }> = ({ campaigns, selected, onChange, currency }) => {
  const [query, setQuery] = useState('')
  const chosen = new Set(selected ?? [])
  const names = campaigns.filter((c) => chosen.has(c.id)).map((c) => c.name)
  const label = !selected ? 'Todas as campanhas' : selected.length === 1 ? (names[0] ?? '1 campanha') : `${selected.length} campanhas`
  const list = campaigns.filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next.size ? [...next] : null)
  }
  const only = (ids: string[]) => onChange(ids.length ? ids : null)
  return (
    <div className="flex min-w-0 items-center gap-1">
      <DropdownMenu modal={false} onOpenChange={(open) => !open && setQuery('')}>
        <DropdownMenuTrigger
          className={cn(
            'inline-flex h-9 min-w-0 max-w-[280px] items-center gap-2 rounded-full px-3.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-700 ring-gray-200 hover:text-gray-900'
          )}
        >
          <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-0">
          <div className="border-b border-gray-100 p-2">
            <label className="flex items-center gap-2 rounded-md bg-zinc-50 px-2">
              <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Buscar campanha"
                aria-label="Buscar campanha"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </label>
          </div>
          <div className="p-1">
            <DropdownMenuItem onSelect={() => onChange(null)} className="text-[13px]">
              Todas as campanhas
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => only(campaigns.filter((c) => campaignStatus(c.status).live).map((c) => c.id))} className="text-[13px]">
              Só as ativas
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => only(campaigns.filter((c) => c.metrics.spend > 0).map((c) => c.id))} className="text-[13px]">
              Só as que investiram no período
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="my-0" />
          <div className="max-h-[min(50vh,360px)] overflow-y-auto p-1">
            {list.map((c) => {
              const status = campaignStatus(c.status)
              return (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={chosen.has(c.id)}
                  onSelect={(e) => {
                    e.preventDefault()
                    toggle(c.id)
                  }}
                  className="items-start py-2 text-[13px]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-gray-900">{c.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                      <span className={cn('h-1.5 w-1.5 rounded-full', status.warn ? 'bg-amber-500' : status.live ? 'bg-emerald-500' : 'bg-gray-300')} aria-hidden />
                      {status.label}
                      {c.metrics.spend > 0 ? ` · ${money(c.metrics.spend, currency)}` : ''}
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>
              )
            })}
            {!list.length && <p className="px-2 py-3 text-sm text-gray-500">Nenhuma campanha com esse nome.</p>}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {selected && (
        <button type="button" onClick={() => onChange(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Mostrar todas as campanhas" title="Mostrar todas as campanhas">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

type CampaignListFilter = 'gasto' | 'ativas' | 'todas'

const Campaigns: React.FC<{ view: AdView; account: AdAccount; currency: string; filtered: boolean; onOnly: (id: string) => void }> = ({ view, account, currency, filtered, onOnly }) => {
  const [filter, setFilter] = useState<CampaignListFilter>('gasto')
  const counts = {
    gasto: view.campaigns.filter((c) => c.metrics.spend > 0).length,
    ativas: view.campaigns.filter((c) => campaignStatus(c.status).live).length,
    todas: view.campaigns.length,
  }
  const list = view.campaigns.filter((c) => (filter === 'gasto' ? c.metrics.spend > 0 : filter === 'ativas' ? campaignStatus(c.status).live : true))
  return (
    <Surface
      title="Campanhas"
      action={
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['gasto', 'Com investimento'],
              ['ativas', 'Ativas'],
              ['todas', 'Todas'],
            ] as [CampaignListFilter, string][]
          ).map(([key, label]) => (
            <Chip key={key} active={filter === key} onClick={() => setFilter(key)} className="h-7 px-2.5 text-xs">
              {label} <span className="tabular-nums opacity-60">{counts[key]}</span>
            </Chip>
          ))}
        </div>
      }
    >
      {list.length ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-medium">Campanha</th>
                <th className="px-3 pb-2 text-right font-medium">Valor usado</th>
                <th className="px-3 pb-2 text-right font-medium">Resultados</th>
                <th className="px-3 pb-2 text-right font-medium">Custo por resultado</th>
                <th className="hidden px-3 pb-2 text-right font-medium md:table-cell">Cliques no link</th>
                <th className="px-3 pb-2 text-right font-medium">CTR</th>
                <th className="w-8 pb-2 pl-1" aria-label="Gerenciador" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const status = campaignStatus(c.status)
                const budget = budgetLabel(c, currency)
                return (
                  <tr key={c.id} className="border-t border-gray-100 align-top">
                    <td className="min-w-[220px] py-2.5 pr-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', status.warn ? 'bg-amber-500' : status.live ? 'bg-emerald-500' : 'bg-gray-300')} aria-hidden />
                        <div className="min-w-0">
                          {filtered && view.campaigns.length === 1 ? (
                            <span className="line-clamp-2 text-sm text-gray-900">{c.name}</span>
                          ) : (
                            <button type="button" onClick={() => onOnly(c.id)} className="line-clamp-2 text-left text-sm text-gray-900 hover:underline" title="Ver só esta campanha">
                              {c.name}
                            </button>
                          )}
                          <p className="text-xs text-gray-500">{[status.label, c.objective ? (OBJECTIVE_LABEL[c.objective] ?? c.objective) : undefined, budget].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-900">{money(c.metrics.spend, currency)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums">
                      <ResultCell result={c.result} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-gray-700">{resultCost(c.result, currency)}</td>
                    <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-gray-700 md:table-cell">{compact(c.metrics.linkClicks)}</td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-700">{percent(ctrOf(c.metrics))}</td>
                    <td className="py-2 pl-1 text-right">
                      <a
                        href={adsManagerUrl(account.adAccountId, c.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                        aria-label={`Abrir ${c.name} no Gerenciador de Anúncios`}
                        title="Abrir no Gerenciador de Anúncios"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{filter === 'gasto' ? 'Nenhuma campanha investiu neste período.' : filter === 'ativas' ? 'Nenhuma campanha ativa agora.' : 'Nenhuma campanha.'}</p>
      )}
      {!filtered && list.length > 1 && <p className="mt-3 text-[11px] text-gray-400">Clique no nome de uma campanha para ver a aba só com ela.</p>}
    </Surface>
  )
}

const PreviewMetric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg bg-zinc-50 px-3 py-2">
    <p className="text-[11px] text-gray-500">{label}</p>
    <p className="text-sm font-semibold tabular-nums text-gray-900">{value}</p>
  </div>
)

type PreviewState = { status: 'loading' } | { status: 'ok'; preview: AdPreview } | { status: 'error'; message: string }

/** O anúncio aberto: a prévia nativa da Meta em cada formato, os números e os atalhos. */
const AdPreviewDialog: React.FC<{ ad: AdCreative; account: AdAccount; currency: string; onClose: () => void }> = ({ ad, account, currency, onClose }) => {
  const [format, setFormat] = useState<PreviewFormat>('INSTAGRAM_STANDARD')
  const [states, setStates] = useState<Partial<Record<PreviewFormat, PreviewState>>>({})
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)

  useEffect(() => {
    if (states[format]) return
    setStates((s) => ({ ...s, [format]: { status: 'loading' } }))
    fetchAdPreview(account.id, ad.id, format).then(
      (preview) => setStates((s) => ({ ...s, [format]: { status: 'ok', preview } })),
      (error) => setStates((s) => ({ ...s, [format]: { status: 'error', message: errorText(error) } }))
    )
  }, [format, states, account.id, ad.id])

  useEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const state = states[format]
  const frameW = state?.status === 'ok' ? (state.preview.width ?? 540) : 540
  const frameH = state?.status === 'ok' ? (state.preview.height ?? 690) : 690
  const scale = Math.min(1, width / frameW)
  const m = ad.metrics

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <div className="grid md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="min-w-0 bg-zinc-100 p-4">
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Formato da prévia">
              {PREVIEW_FORMATS.map((f) => (
                <Chip key={f.key} active={format === f.key} onClick={() => setFormat(f.key)} className="h-7 px-2.5 text-xs">
                  {f.label}
                </Chip>
              ))}
            </div>
            <div ref={box} className="w-full">
              {!state || state.status === 'loading' ? (
                <p className="flex h-80 items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando a prévia na Meta…
                </p>
              ) : state.status === 'error' ? (
                <div className="flex h-80 flex-col items-center justify-center gap-3 px-4 text-center">
                  <AdThumb ad={ad} className="h-24 w-24 rounded-lg" />
                  <p className="text-sm text-gray-600">{state.message}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg bg-white" style={{ height: frameH * scale }}>
                  <iframe
                    key={state.preview.src}
                    src={state.preview.src}
                    title={`Prévia de ${ad.name}`}
                    width={frameW}
                    height={frameH}
                    scrolling="no"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    className="origin-top-left border-0"
                    style={{ transform: `scale(${scale})` }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 p-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base">{ad.name}</DialogTitle>
              <DialogDescription className="text-xs">{[ad.campaignName, ad.adsetName].filter(Boolean).join(' · ')}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <PreviewMetric label="Valor usado" value={money(m.spend, currency)} />
              <PreviewMetric label="Resultados" value={ad.result ? `${compact(ad.result.value)} ${resultLabel(ad.result.type, ad.result.value)}` : '—'} />
              <PreviewMetric label="Custo por resultado" value={resultCost(ad.result, currency)} />
              <PreviewMetric label="Impressões" value={compact(m.impressions)} />
              <PreviewMetric label="Alcance" value={compact(m.reach)} />
              <PreviewMetric label="Cliques no link" value={compact(m.linkClicks)} />
              <PreviewMetric label="CTR (link)" value={percent(ctrOf(m), 2)} />
              <PreviewMetric label="CPC (link)" value={money(cpcOf(m), currency)} />
              <PreviewMetric label="CPM" value={money(cpmOf(m), currency)} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {ad.previewLink && (
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={ad.previewLink} target="_blank" rel="noreferrer">
                    <Eye className="h-4 w-4" /> Prévia na Meta
                  </a>
                </Button>
              )}
              {ad.permalink && (
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={ad.permalink} target="_blank" rel="noreferrer">
                    <InstagramIcon className="h-4 w-4" /> Post no Instagram
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={adsManagerAdUrl(account.adAccountId, ad.id)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir no Gerenciador
                </a>
              </Button>
            </div>
            <p className="mt-4 text-[11px] text-gray-400">A prévia é a da própria Meta; alguns formatos não valem para todo anúncio (um vídeo vertical não tem feed do Facebook, por exemplo).</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Ads: React.FC<{ view: AdView; account: AdAccount; currency: string }> = ({ view, account, currency }) => {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<AdCreative | null>(null)
  const list = all ? view.ads : view.ads.slice(0, 8)
  return (
    <Surface title="Anúncios" action={<span className="text-xs text-gray-400">Clique para ver o criativo</span>}>
      {view.ads.length ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-medium">Anúncio</th>
                <th className="px-3 pb-2 text-right font-medium">Valor usado</th>
                <th className="px-3 pb-2 text-right font-medium">Resultados</th>
                <th className="px-3 pb-2 text-right font-medium">Custo</th>
                <th className="pb-2 pl-3 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {list.map((ad) => (
                <tr key={ad.id} className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-zinc-50" onClick={() => setOpen(ad)}>
                  <td className="min-w-[220px] py-2 pr-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpen(ad)
                      }}
                      className="group flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="relative shrink-0">
                        <AdThumb ad={ad} className="h-11 w-11 rounded-md" />
                        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                          <Eye className="h-4 w-4" />
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm text-gray-900">{ad.name}</span>
                        {ad.campaignName && <span className="line-clamp-1 text-xs text-gray-500">{ad.campaignName}</span>}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-900">{money(ad.metrics.spend, currency)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    <ResultCell result={ad.result} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-700">{resultCost(ad.result, currency)}</td>
                  <td className="py-2 pl-3 text-right text-sm tabular-nums text-gray-700">{percent(ctrOf(ad.metrics))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {view.ads.length > 8 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-medium text-gray-700 hover:underline">
              {all ? 'Mostrar menos' : `Ver todos os ${view.ads.length} anúncios`}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{view.campaigns.length < 2 && view.ads.length === 0 && view.totals.spend > 0 ? 'Nenhum anúncio desta campanha está entre os 40 que mais investiram.' : 'Nenhum anúncio investiu neste período.'}</p>
      )}
      {open && <AdPreviewDialog ad={open} account={account} currency={currency} onClose={() => setOpen(null)} />}
    </Surface>
  )
}

type AudienceKey = 'ages' | 'genders' | 'regions'
const AUDIENCE_LABEL: Record<AudienceKey, string> = { ages: 'Idade', genders: 'Gênero', regions: 'Regiões' }

const sliceRows = (slices: Slice[], label: (key: string) => string) =>
  slices
    .filter((s) => s.metrics.spend > 0)
    .map((s) => {
      const contacts = contactsOf(s.metrics)
      return { label: label(s.key), value: s.metrics.spend, note: contacts ? plural(contacts, 'contato', 'contatos') : undefined }
    })

const Audience: React.FC<{ view: AdView; currency: string }> = ({ view, currency }) => {
  const keys = (Object.keys(AUDIENCE_LABEL) as AudienceKey[]).filter((k) => view[k].some((s) => s.metrics.spend > 0))
  const [key, setKey] = useState<AudienceKey | undefined>(keys[0])
  const current = key && keys.includes(key) ? key : keys[0]
  if (!current) return <p className="text-sm text-gray-500">O público aparece quando a conta investe no período.</p>
  const rows = sliceRows(view[current], (k) => (current === 'genders' ? (GENDER_LABEL[k] ?? k) : k))
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <Chip key={k} active={k === current} onClick={() => setKey(k)} className="h-7 px-2.5 text-xs">
            {AUDIENCE_LABEL[k]}
          </Chip>
        ))}
      </div>
      <BarList rows={current === 'regions' ? rows.slice(0, 8) : rows} format={(n) => money(n, currency, true)} />
      <p className="mt-3 text-[11px] text-gray-400">Valor usado em cada grupo no período; contatos ao lado.</p>
    </div>
  )
}

/** Quando os anúncios não rodaram o período todo: em quantos dias, o primeiro e o último. */
const RanDays: React.FC<{ view: AdView }> = ({ view }) => {
  const ran = view.ranDays
  if (!ran.length || ran.length >= view.periodDays) return null
  const first = shortDay(ran[0])
  const last = shortDay(ran[ran.length - 1])
  return (
    <p className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-xs leading-relaxed text-gray-600 ring-1 ring-inset ring-gray-200">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      <span>
        {ran.length === 1 ? (
          <>
            Os anúncios rodaram em só 1 dos {view.periodDays} dias do período, <strong className="font-semibold text-gray-900">{first}</strong>.
          </>
        ) : (
          <>
            Os anúncios rodaram em <strong className="font-semibold text-gray-900">{ran.length} dos {view.periodDays} dias</strong> do período: o primeiro foi {first} e o último {last}. A média por
            dia conta só esses dias e o gráfico começa no primeiro.
          </>
        )}
      </span>
    </p>
  )
}

const Overview: React.FC<{ report: AdReport; account: AdAccount; selected: string[] | null; onSelect: (ids: string[] | null) => void }> = ({ report, account, selected, onSelect }) => {
  const cur = report.currency
  const view = useMemo(() => viewOf(report, selected), [report, selected])
  const ctx: SubContext = { currency: cur, ranDays: view.ranDays.length, periodDays: view.periodDays, approximateReach: view.approximateReach }
  const platforms = sliceRows(view.platforms, (k) => PLATFORM_LABEL[k] ?? k)

  if (selected && !view.campaigns.length)
    return (
      <Surface>
        <p className="text-sm text-gray-600">As campanhas escolhidas não aparecem neste período.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => onSelect(null)}>
          Mostrar todas as campanhas
        </Button>
      </Surface>
    )

  return (
    <div className="grid grid-cols-1 gap-4">
      <RanDays view={view} />
      <Tiles view={view} ctx={ctx} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DayChart view={view} currency={cur} />
        <Surface title="Onde os anúncios rodaram">
          {platforms.length ? (
            <>
              <BarList rows={platforms} format={(n) => money(n, cur, true)} />
              <p className="mt-3 text-[11px] text-gray-400">Valor usado por plataforma; contatos ao lado.</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Sem investimento neste período.</p>
          )}
        </Surface>
      </div>

      <Campaigns view={view} account={account} currency={cur} filtered={!!selected} onOnly={(id) => onSelect([id])} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Ads view={view} account={account} currency={cur} />
        <Surface title="Público">
          <Audience view={view} currency={cur} />
        </Surface>
      </div>
    </div>
  )
}

// ---------- a aba ----------

/** Uma falha ao desenhar os números fica dentro da aba (o resto do app segue de pé) e oferece ler de novo. */
class AdsGuard extends React.Component<{ children: React.ReactNode; onRetry: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[anúncios] falha ao mostrar o relatório', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Surface>
        <p className="text-sm text-gray-700">Não consegui mostrar este relatório.</p>
        <p className="mt-1 text-xs text-gray-500">{this.state.error.message}</p>
        <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={this.props.onRetry}>
          <RefreshCw className="h-4 w-4" /> Ler de novo
        </Button>
      </Surface>
    )
  }
}

const AccountArea: React.FC<{
  account: AdAccount
  accounts: AdAccount[]
  manager: boolean
  onSelect: (id: string) => void
  onReload: () => Promise<void>
}> = ({ account, accounts, manager, onSelect, onReload }) => {
  const people = useTeamPeople(account.teamId)
  const [preset, setPreset] = useState<AdPreset>('last_30d')
  const [report, setReport] = useState<AdReport | null | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const autoRefreshed = useRef(new Set<string>())

  useEffect(() => setSelected(null), [account.id])
  useEffect(() => setFailure(null), [account.id, preset])

  const refresh = useCallback(
    async (quiet = false) => {
      setRefreshing(true)
      try {
        const next = await fetchAdReport(account.id, preset)
        setReport(next)
        setFailure(null)
        await onReload()
        if (!quiet) toast.success('Anúncios atualizados', { description: next.missing.length ? `A Meta não devolveu ${next.missing.map((m) => MISSING_LABEL[m] ?? m).join(', ')}.` : undefined })
      } catch (error) {
        if (error instanceof AdsError && error.code === 'token') await onReload()
        if (!quiet || !(error instanceof AdsError && error.code === 'unavailable')) toast.error(errorText(error))
        setFailure(errorText(error))
        setReport((r) => (r === undefined ? null : r))
      } finally {
        setRefreshing(false)
      }
    },
    [account.id, preset, onReload]
  )

  // O relatório guardado aparece na hora; se tem mais de 30 minutos (ou não há), pede um novo
  useEffect(() => {
    let active = true
    setReport(undefined)
    loadAdReport(account.id, preset)
      .then((saved) => {
        if (!active) return
        setReport(saved)
        const key = `${account.id}:${preset}`
        if (account.syncError === 'token' || autoRefreshed.current.has(key)) return
        if (saved && Date.now() - saved.fetchedAt < STALE) return
        autoRefreshed.current.add(key)
        void refresh(true)
      })
      .catch((e) => {
        if (active) setReport(null)
        toast.error(errorText(e))
      })
    return () => {
      active = false
    }
    // Só ao trocar de conta ou período
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, preset])

  const disconnect = async () => {
    try {
      await disconnectAdAccount(account.id)
      toast.success(`${account.name} desligada`)
      await onReload()
    } catch (error) {
      toast.error(errorText(error))
    }
  }

  const reconnect = () => void startAdsConnect(account.teamId).catch((e) => toast.error(errorText(e)))
  const broken = account.syncError === 'token'
  const daysLeft = account.tokenKind !== 'system' && account.tokenExpiresAt ? Math.ceil((account.tokenExpiresAt - Date.now()) / DAY) : undefined
  const accountProblem = report?.accountStatus && report.accountStatus !== 1 ? ACCOUNT_STATUS[report.accountStatus] : undefined
  const who = account.connectedName ?? (account.connectedBy ? nameOf(people, account.connectedBy) : undefined)

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white" aria-hidden>
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Anúncios</h1>
            {accounts.length > 1 && (
              <select value={account.id} onChange={(e) => onSelect(e.target.value)} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')} aria-label="Conta de anúncios">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            {accounts.length > 1 ? '' : `${account.name} · `}
            {account.businessName ? `${account.businessName} · ` : ''}atualizado {ago(report?.fetchedAt)}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing || broken} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /> {refreshing ? 'Atualizando…' : 'Atualizar'}
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a href={adsManagerUrl(account.adAccountId)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Gerenciador
            </a>
          </Button>
        </div>
      </div>

      {broken ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">A conexão com a conta de anúncios caiu (expirou ou o acesso foi tirado). Os números abaixo são da última leitura.</p>
          <Button size="sm" variant="outline" onClick={reconnect}>
            Conectar de novo
          </Button>
        </div>
      ) : daysLeft !== undefined && daysLeft <= 10 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">
            O acesso {daysLeft <= 0 ? 'vence hoje' : `vence em ${plural(daysLeft, 'dia', 'dias')}`}. {who ? `Peça para ${who} entrar de novo` : 'Entre com o Facebook de novo'} para continuar lendo.
          </p>
          <Button size="sm" variant="outline" onClick={reconnect}>
            Conectar de novo
          </Button>
        </div>
      ) : null}

      {accountProblem && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/20">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p>A conta de anúncios {accountProblem}: os anúncios podem não estar rodando. Confira no Gerenciador de Anúncios.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200" role="group" aria-label="Período">
          {AD_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => setPreset(p)}
              className={cn('h-7 rounded-full px-3 text-xs font-medium transition-colors', preset === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900')}
            >
              {PRESET_LABEL[p]}
            </button>
          ))}
        </div>
        {report && <CampaignFilter campaigns={report.campaigns} selected={selected} onChange={setSelected} currency={report.currency} />}
        {report?.since && report.until && (
          <p className="text-xs text-gray-500">
            {dayLabel(`${report.since}T12:00:00`)} a {dayLabel(`${report.until}T12:00:00`)}
          </p>
        )}
      </div>

      {report === undefined || (report === null && refreshing) ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo as campanhas…
        </p>
      ) : report === null ? (
        <Surface>
          <p className="text-sm text-gray-600">Ainda não há leitura deste período.</p>
          {failure && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{failure}</p>}
          <Button size="sm" className="mt-3 gap-1.5" onClick={() => void refresh()} disabled={broken}>
            <RefreshCw className="h-4 w-4" /> Ler agora
          </Button>
        </Surface>
      ) : (
        <div className={cn('transition-opacity', refreshing && 'opacity-70')}>
          <AdsGuard key={`${report.fetchedAt}:${preset}`} onRetry={() => void refresh()}>
            <Overview report={report} account={account} selected={selected} onSelect={setSelected} />
          </AdsGuard>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <span>
          Conta {account.adAccountId} ligada {who ? `por ${who} ` : ''}em {dayLabel(account.connectedAt)}
        </span>
        {account.tokenKind === 'system' ? (
          <span>Acesso de usuário do sistema, sem prazo</span>
        ) : account.tokenExpiresAt ? (
          <span>Acesso válido até {dayLabel(account.tokenExpiresAt)}</span>
        ) : null}
        {!!report?.missing.length && <span title={report.missing.map((m) => MISSING_LABEL[m] ?? m).join(', ')}>A Meta não devolveu {plural(report.missing.length, 'parte', 'partes')} na última leitura</span>}
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            <Plus className="h-3.5 w-3.5" /> Outra conta
          </button>
          {manager &&
            (confirmOff ? (
              <>
                <span>Desligar {account.name}? Os relatórios guardados saem junto.</span>
                <button type="button" onClick={() => void disconnect()} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700">
                  Desligar
                </button>
                <button type="button" onClick={() => setConfirmOff(false)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">
                  Não
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmOff(true)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-rose-50 hover:text-rose-700">
                Desligar
              </button>
            ))}
        </span>
      </div>

      {adding && <AdsConnectCard teamId={account.teamId} again onDone={() => void onReload().then(() => setAdding(false))} />}
    </div>
  )
}

/** A aba inteira: carrega as contas ligadas à equipe e mostra a escolhida (ou o convite para ligar). */
export const AdsArea: React.FC<{ teamId: string; manager: boolean; initialAccount?: string }> = ({ teamId, manager, initialAccount }) => {
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null)
  const [error, setError] = useState<'sem-tabelas' | string | null>(null)
  const [selected, setSelected] = useState<string | undefined>(initialAccount)

  const reload = useCallback(async () => {
    try {
      setAccounts(await loadAdAccounts(teamId))
      setError(null)
    } catch (e) {
      setError(e instanceof NoAdTablesError ? 'sem-tabelas' : errorText(e))
      setAccounts([])
    }
  }, [teamId])

  useEffect(() => {
    setAccounts(null)
    void reload()
  }, [reload])

  const account = useMemo(() => accounts?.find((a) => a.id === selected) ?? accounts?.[0], [accounts, selected])

  if (accounts === null)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Abrindo os anúncios da equipe…
      </p>
    )
  if (error === 'sem-tabelas')
    return (
      <Surface className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-gray-900">Falta preparar o banco</h1>
        <p className="mt-1 text-sm text-gray-600">
          As tabelas de anúncios ainda não existem. Aplique a migração <code className="text-xs">supabase/migrations/20261025120000_crm_meta_ads.sql</code> no Supabase e abra esta aba de novo.
        </p>
        <AdsSetupGuide />
      </Surface>
    )
  if (error)
    return (
      <Surface className="mx-auto max-w-2xl">
        <p className="text-sm text-rose-700">{error}</p>
      </Surface>
    )
  if (account) return <AccountArea account={account} accounts={accounts} manager={manager} onSelect={setSelected} onReload={reload} />
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Anúncios</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Acompanhe as campanhas de Facebook e Instagram da equipe sem abrir o Gerenciador de Anúncios.</p>
      </div>
      <AdsConnectCard
        teamId={teamId}
        onDone={(ids?: string[]) => {
          if (ids?.[0]) setSelected(ids[0])
          void reload()
        }}
      />
    </>
  )
}
