import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Copy, ExternalLink, Facebook, KeyRound, Loader2, Megaphone, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Chip } from '@/features/prospects/ui'
import { BarList, Sparkline, Stat, TrendChart, type Point } from './InstagramCharts'
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
  PRESET_LABEL,
  adsManagerUrl,
  adsRedirectUri,
  adsStatus,
  campaignStatus,
  chooseAdAccounts,
  connectAdsWithToken,
  contactsOf,
  costPerContact,
  cpcOf,
  cpmOf,
  ctrOf,
  disconnectAdAccount,
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
  type AdReport,
  type AdResult,
  type AdSlice,
  type Pending,
} from './ads'

/**
 * Aba Anúncios da tela do Instagram: as campanhas de Facebook e Instagram da
 * conta de anúncios ligada à equipe, pela API de anúncios da Meta. Investimento,
 * contatos (leads e conversas), alcance, cliques, cada campanha com o resultado
 * e o custo dele, por dia, por plataforma, o público e os anúncios que mais
 * investiram. Só leitura; mudar campanha é no Gerenciador de Anúncios.
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

type CampaignFilter = 'gasto' | 'ativas' | 'todas'

const Campaigns: React.FC<{ report: AdReport; account: AdAccount }> = ({ report, account }) => {
  const [filter, setFilter] = useState<CampaignFilter>('gasto')
  const cur = report.currency
  const counts = {
    gasto: report.campaigns.filter((c) => c.metrics.spend > 0).length,
    ativas: report.campaigns.filter((c) => campaignStatus(c.status).live).length,
    todas: report.campaigns.length,
  }
  const list = report.campaigns.filter((c) => (filter === 'gasto' ? c.metrics.spend > 0 : filter === 'ativas' ? campaignStatus(c.status).live : true))
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
            ] as [CampaignFilter, string][]
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
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-medium">Campanha</th>
                <th className="px-3 pb-2 text-right font-medium">Investimento</th>
                <th className="px-3 pb-2 text-right font-medium">Resultado</th>
                <th className="px-3 pb-2 text-right font-medium">Custo por resultado</th>
                <th className="hidden px-3 pb-2 text-right font-medium md:table-cell">Cliques no link</th>
                <th className="pb-2 pl-3 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const status = campaignStatus(c.status)
                const budget = budgetLabel(c, cur)
                return (
                  <tr key={c.id} className="border-t border-gray-100 align-top">
                    <td className="min-w-[220px] py-2.5 pr-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', status.warn ? 'bg-amber-500' : status.live ? 'bg-emerald-500' : 'bg-gray-300')} aria-hidden />
                        <div className="min-w-0">
                          <a
                            href={adsManagerUrl(account.adAccountId, c.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="group inline-flex max-w-full items-center gap-1 text-sm text-gray-900 hover:underline"
                            title="Abrir no Gerenciador de Anúncios"
                          >
                            <span className="line-clamp-2">{c.name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                          </a>
                          <p className="text-xs text-gray-500">{[status.label, c.objective ? (OBJECTIVE_LABEL[c.objective] ?? c.objective) : undefined, budget].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-900">{money(c.metrics.spend, cur)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums">
                      <ResultCell result={c.result} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-gray-700">{resultCost(c.result, cur)}</td>
                    <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-gray-700 md:table-cell">{compact(c.metrics.linkClicks)}</td>
                    <td className="py-2.5 pl-3 text-right text-sm tabular-nums text-gray-700">{percent(ctrOf(c.metrics))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{filter === 'gasto' ? 'Nenhuma campanha investiu neste período.' : filter === 'ativas' ? 'Nenhuma campanha ativa agora.' : 'Nenhuma campanha nesta conta.'}</p>
      )}
    </Surface>
  )
}

const TopAds: React.FC<{ report: AdReport }> = ({ report }) => {
  const cur = report.currency
  return (
    <Surface title="Anúncios que mais investiram">
      {report.ads.length ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-medium">Anúncio</th>
                <th className="px-3 pb-2 text-right font-medium">Investimento</th>
                <th className="px-3 pb-2 text-right font-medium">Resultado</th>
                <th className="px-3 pb-2 text-right font-medium">Custo</th>
                <th className="pb-2 pl-3 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {report.ads.map((ad) => (
                <tr key={ad.id} className="border-t border-gray-100">
                  <td className="min-w-[220px] py-2 pr-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {ad.permalink ? (
                        <a href={ad.permalink} target="_blank" rel="noreferrer" title="Ver no Instagram" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <AdThumb ad={ad} className="h-11 w-11 rounded-md" />
                        </a>
                      ) : (
                        <AdThumb ad={ad} className="h-11 w-11 shrink-0 rounded-md" />
                      )}
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm text-gray-900">{ad.name}</span>
                        {ad.campaignName && <span className="line-clamp-1 text-xs text-gray-500">{ad.campaignName}</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-900">{money(ad.metrics.spend, cur)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                    <ResultCell result={ad.result} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-700">{resultCost(ad.result, cur)}</td>
                  <td className="py-2 pl-3 text-right text-sm tabular-nums text-gray-700">{percent(ctrOf(ad.metrics))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nenhum anúncio investiu neste período.</p>
      )}
    </Surface>
  )
}

type AudienceKey = 'ages' | 'genders' | 'regions'
const AUDIENCE_LABEL: Record<AudienceKey, string> = { ages: 'Idade', genders: 'Gênero', regions: 'Regiões' }

const sliceRows = (slices: AdSlice[], label: (key: string) => string) =>
  slices
    .filter((s) => s.metrics.spend > 0)
    .map((s) => {
      const contacts = contactsOf(s.metrics)
      return { label: label(s.key), value: s.metrics.spend, note: contacts ? plural(contacts, 'contato', 'contatos') : undefined }
    })

const Audience: React.FC<{ report: AdReport }> = ({ report }) => {
  const keys = (Object.keys(AUDIENCE_LABEL) as AudienceKey[]).filter((k) => report[k].some((s) => s.metrics.spend > 0))
  const [key, setKey] = useState<AudienceKey | undefined>(keys[0])
  const current = key && keys.includes(key) ? key : keys[0]
  if (!current) return <p className="text-sm text-gray-500">O público aparece quando a conta investe no período.</p>
  const rows = sliceRows(report[current], (k) => (current === 'genders' ? (GENDER_LABEL[k] ?? k) : k))
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <Chip key={k} active={k === current} onClick={() => setKey(k)} className="h-7 px-2.5 text-xs">
            {AUDIENCE_LABEL[k]}
          </Chip>
        ))}
      </div>
      <BarList rows={current === 'regions' ? rows.slice(0, 8) : rows} format={(n) => money(n, report.currency, true)} />
      <p className="mt-3 text-[11px] text-gray-400">Investimento em cada grupo no período; contatos ao lado.</p>
    </div>
  )
}

type DayMetric = 'spend' | 'contacts' | 'linkClicks' | 'reach'
const DAY_METRIC: Record<DayMetric, { label: string; unit: string; text: string }> = {
  spend: { label: 'Investimento', unit: '', text: 'Quanto a conta investiu em cada dia' },
  contacts: { label: 'Contatos', unit: 'contatos', text: 'Leads e conversas iniciadas em cada dia' },
  linkClicks: { label: 'Cliques no link', unit: 'cliques', text: 'Cliques que levaram ao site ou ao WhatsApp' },
  reach: { label: 'Alcance', unit: 'pessoas', text: 'Pessoas diferentes alcançadas em cada dia' },
}

const Overview: React.FC<{ report: AdReport; account: AdAccount }> = ({ report, account }) => {
  const [metric, setMetric] = useState<DayMetric>('spend')
  const cur = report.currency
  const t = report.totals
  const contacts = contactsOf(t)
  const dayCount = report.days.length || 1
  const points: Point[] = report.days.map((d) => ({ day: d.day, value: d[metric] }))
  const platforms = sliceRows(report.platforms, (k) => PLATFORM_LABEL[k] ?? k)

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat dark label="Investimento" value={money(t.spend, cur, true)} sub={`${money(t.spend / dayCount, cur)} por dia em média`}>
          {report.days.length > 1 && <Sparkline values={report.days.map((d) => d.spend)} color="#fafafa" className="mt-2 h-8 w-full" />}
        </Stat>
        <Stat
          label="Contatos"
          value={compact(contacts)}
          sub={contacts ? `${money(costPerContact(t), cur)} por contato · ${plural(t.leads, 'lead', 'leads')}, ${plural(t.conversations, 'conversa', 'conversas')}` : 'leads e conversas iniciadas'}
        />
        <Stat label="Alcance" value={compact(t.reach)} sub={t.frequency ? `${t.frequency.toFixed(1).replace('.', ',')} vezes por pessoa` : 'pessoas diferentes'} />
        <Stat label="Cliques no link" value={compact(t.linkClicks)} sub={`CTR ${percent(ctrOf(t))} · ${money(cpcOf(t), cur)} por clique`} />
        <Stat label="Impressões" value={compact(t.impressions)} sub={`${money(cpmOf(t), cur)} a cada mil`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl bg-zinc-900 p-4 text-white md:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{DAY_METRIC[metric].label} por dia</h2>
              <p className="text-xs text-zinc-400">{DAY_METRIC[metric].text}</p>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="O que mostrar">
              {(Object.keys(DAY_METRIC) as DayMetric[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={metric === k}
                  onClick={() => setMetric(k)}
                  className={cn('h-7 rounded-full px-2.5 text-xs font-medium transition-colors', metric === k ? 'bg-white text-zinc-900' : 'text-zinc-300 ring-1 ring-inset ring-white/15 hover:text-white')}
                >
                  {DAY_METRIC[k].label}
                </button>
              ))}
            </div>
          </div>
          {points.length ? (
            <TrendChart
              points={points}
              unit={DAY_METRIC[metric].unit}
              format={metric === 'spend' ? (n) => money(n, cur) : undefined}
              label={`${DAY_METRIC[metric].label} por dia`}
              tone="dark"
              height={260}
            />
          ) : (
            <p className="flex h-[260px] items-center justify-center text-sm text-zinc-400">Nenhum dia com anúncio rodando neste período.</p>
          )}
        </section>
        <Surface title="Onde os anúncios rodaram">
          {platforms.length ? (
            <>
              <BarList rows={platforms} format={(n) => money(n, cur, true)} />
              <p className="mt-3 text-[11px] text-gray-400">Investimento por plataforma; contatos ao lado.</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Sem investimento neste período.</p>
          )}
        </Surface>
      </div>

      <Campaigns report={report} account={account} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TopAds report={report} />
        <Surface title="Público">
          <Audience report={report} />
        </Surface>
      </div>
    </div>
  )
}

// ---------- a aba ----------

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
  const autoRefreshed = useRef(new Set<string>())

  const refresh = useCallback(
    async (quiet = false) => {
      setRefreshing(true)
      try {
        const next = await fetchAdReport(account.id, preset)
        setReport(next)
        await onReload()
        if (!quiet) toast.success('Anúncios atualizados', { description: next.missing.length ? `A Meta não devolveu ${next.missing.map((m) => MISSING_LABEL[m] ?? m).join(', ')}.` : undefined })
      } catch (error) {
        if (error instanceof AdsError && error.code === 'token') await onReload()
        if (!quiet || !(error instanceof AdsError && error.code === 'unavailable')) toast.error(errorText(error))
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
          <Button size="sm" className="mt-3 gap-1.5" onClick={() => void refresh()} disabled={broken}>
            <RefreshCw className="h-4 w-4" /> Ler agora
          </Button>
        </Surface>
      ) : (
        <div className={cn('transition-opacity', refreshing && 'opacity-70')}>
          <Overview report={report} account={account} />
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
