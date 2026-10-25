import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Copy, Instagram as InstagramIcon, KeyRound, Loader2, Plus, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { BarList, Sparkline, TrendChart, shortDay } from '@/features/crm/InstagramCharts'
import { PostPanel } from '@/features/crm/InstagramPost'
import { PublishDialog } from '@/features/crm/InstagramPublish'
import { FORMAT_ICON, MediaThumb } from '@/features/crm/InstagramThumb'
import {
  FORMAT_LABEL,
  InstagramError,
  NoTablesError,
  compact,
  connectWithToken,
  dayKey,
  disconnectAccount,
  engagementOf,
  formatOf,
  instagramStatus,
  interactionsOf,
  loadAccounts,
  loadDays,
  loadMedia,
  percent,
  redirectUri,
  startConnect,
  syncAccount,
  type AudienceKey,
  type IgAccount,
  type IgDay,
  type IgFormat,
  type IgMedia,
} from '@/features/crm/instagram'
import { nameOf, useTeamPeople } from '@/features/crm/people'
import { FIELD, Page, Surface, dayLabel, plural, whenLabel } from '@/features/crm/ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * Instagram (CRM › Instagram): a conta da equipe pela API oficial da Meta.
 * Visão geral com seguidores, alcance, contas engajadas, alcance por dia, os
 * melhores posts, o alcance por formato e o público; a grade de posts com os
 * números de cada um e os comentários; e publicar sem abrir o app. Os números
 * vêm das tabelas que a função `instagram` grava; a tela pede uma leitura nova
 * quando a última tem mais de 30 minutos.
 */

type Period = 7 | 30
type Tab = 'geral' | 'posts'
type SortKey = 'recentes' | 'alcance' | 'interacoes' | 'salvos' | 'taxa'

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

// ---------- conectar ----------

const SetupGuide: React.FC<{ reason?: string }> = ({ reason }) => (
  <div className="mt-5 rounded-lg bg-zinc-50 p-4 text-sm text-gray-700">
    <p className="font-medium text-gray-900">Para ligar a API da Meta (uma vez só)</p>
    {reason && <p className="mt-1 text-xs text-gray-500">{reason}</p>}
    <ol className="mt-3 grid list-decimal gap-2 pl-5 marker:text-gray-400">
      <li>
        A conta do Instagram precisa ser profissional (Empresa ou Criador de conteúdo). No app: Configurações › Tipo de conta e ferramentas.
      </li>
      <li>
        Em{' '}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="font-medium text-gray-900 underline underline-offset-2">
          developers.facebook.com/apps
        </a>
        , crie um app (tipo Empresa) com o caso de uso de gerenciar mensagens e conteúdo no Instagram, na opção de login pelo Instagram (sem página do Facebook).
      </li>
      <li>
        Em Configuração da API com login pelo Instagram: copie o ID e a chave secreta do app do Instagram e cadastre este endereço de volta:
        <span className="mt-1 flex items-center gap-2">
          <code className="min-w-0 truncate rounded bg-white px-2 py-1 text-xs ring-1 ring-inset ring-gray-200">{redirectUri()}</code>
          <button type="button" onClick={() => void copy(redirectUri())} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-gray-900" aria-label="Copiar o endereço">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </span>
      </li>
      <li>Em Funções do app, adicione a conta do Instagram como testadora e aceite o convite no Instagram (Configurações › Apps e sites). Com o app em desenvolvimento, só as contas da equipe funcionam, e é o que basta aqui.</li>
      <li>
        No Supabase: aplique a migração <code className="text-xs">20261024120000_crm_instagram.sql</code>, guarde os segredos <code className="text-xs">INSTAGRAM_APP_ID</code> e <code className="text-xs">INSTAGRAM_APP_SECRET</code> em Edge Functions › Secrets e publique a função <code className="text-xs">instagram</code>.
      </li>
    </ol>
  </div>
)

const TokenForm: React.FC<{ teamId: string; onDone: () => void }> = ({ teamId, onDone }) => {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setBusy(true)
    try {
      const result = await connectWithToken(teamId, token.trim())
      toast.success(`@${result.username} conectado`)
      setToken('')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 grid gap-2">
      <label className="block">
        <span className="text-xs font-medium text-gray-700">Token de acesso gerado no painel da Meta</span>
        <input className={cn(FIELD, 'mt-1 h-9 font-mono text-xs')} value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAA…" autoComplete="off" spellCheck={false} />
      </label>
      <p className="text-xs text-gray-500">Em Configuração da API com login pelo Instagram › Gerar tokens de acesso. O token vai direto para o servidor e não fica no navegador.</p>
      <div>
        <Button type="submit" size="sm" disabled={busy || token.trim().length < 20}>
          {busy ? 'Conectando…' : 'Conectar com o token'}
        </Button>
      </div>
    </form>
  )
}

const ConnectCard: React.FC<{ teamId: string; manager: boolean; again?: boolean; onDone: () => void }> = ({ teamId, manager, again, onDone }) => {
  const [status, setStatus] = useState<{ configured: boolean } | { unavailable: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [withToken, setWithToken] = useState(false)

  useEffect(() => {
    instagramStatus()
      .then((s) => setStatus({ configured: s.configured }))
      .catch((e) => setStatus({ unavailable: e instanceof Error ? e.message : String(e) }))
  }, [])

  const connect = async () => {
    setBusy(true)
    try {
      await startConnect(teamId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }

  const ready = !!status && 'configured' in status && status.configured
  const deployed = !!status && 'configured' in status

  return (
    <Surface className="mx-auto max-w-2xl">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-gray-700" aria-hidden>
        <InstagramIcon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-gray-900">{again ? 'Conectar outra conta do Instagram' : 'Conectar o Instagram da equipe'}</h2>
      <p className="mt-1 text-sm text-gray-600">
        Pela API oficial da Meta: seguidores, alcance, os números de cada post e do público, publicar no feed, stories e reels e responder comentários, tudo daqui. A senha do Instagram nunca passa pela plataforma.
      </p>

      {!status ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Conferindo a ligação com a Meta…
        </p>
      ) : !manager ? (
        <p className="mt-5 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-gray-600">Quem gerencia a equipe conecta a conta. Depois disso, todos da equipe veem os números, publicam e respondem.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={() => void connect()} disabled={!ready || busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <InstagramIcon className="h-4 w-4" />}
              Entrar com o Instagram
            </Button>
            {deployed && (
              <Button variant="outline" onClick={() => setWithToken((v) => !v)} className="gap-2">
                <KeyRound className="h-4 w-4" /> Colar um token
              </Button>
            )}
          </div>
          {withToken && <TokenForm teamId={teamId} onDone={onDone} />}
          {!ready && (
            <SetupGuide
              reason={
                'unavailable' in status
                  ? `${status.unavailable} Enquanto isso, nada aqui funciona.`
                  : 'A função está publicada, mas faltam os segredos do app da Meta. Dá para conectar colando um token gerado no painel da Meta.'
              }
            />
          )}
        </>
      )}
    </Surface>
  )
}

// ---------- números ----------

const Stat: React.FC<{ label: string; value: string; sub?: React.ReactNode; dark?: boolean; children?: React.ReactNode }> = ({ label, value, sub, dark, children }) => (
  <div className={cn('flex min-h-[124px] flex-col rounded-xl p-4', dark ? 'bg-zinc-900 text-white' : 'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]')}>
    <p className={cn('text-xs font-medium', dark ? 'text-zinc-300' : 'text-gray-500')}>{label}</p>
    <p className={cn('mt-1 text-[28px] font-semibold leading-tight tracking-tight', dark ? 'text-white' : 'text-gray-900')}>{value}</p>
    {sub && <p className={cn('mt-auto pt-2 text-xs', dark ? 'text-zinc-400' : 'text-gray-500')}>{sub}</p>}
    {children}
  </div>
)

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('pt-BR')}`

const AUDIENCE_LABEL: Record<AudienceKey, string> = { age: 'Idade', gender: 'Gênero', city: 'Cidades', country: 'Países' }
const GENDER: Record<string, string> = { F: 'Mulheres', M: 'Homens', U: 'Não informado' }

const Audience: React.FC<{ account: IgAccount }> = ({ account }) => {
  const keys = (Object.keys(AUDIENCE_LABEL) as AudienceKey[]).filter((k) => account.audience[k] && Object.keys(account.audience[k]!).length)
  const [key, setKey] = useState<AudienceKey | undefined>(keys[0])
  const current = key && keys.includes(key) ? key : keys[0]
  if (!current)
    return (
      <p className="text-sm text-gray-500">
        {(account.followers ?? 0) < 100 ? 'A Meta só mostra o público de contas com 100 seguidores ou mais.' : 'O público aparece depois da próxima atualização.'}
      </p>
    )
  const values = account.audience[current]!
  const total = Object.values(values).reduce((a, b) => a + b, 0) || 1
  const rows = Object.entries(values)
    .map(([label, value]) => ({ label: current === 'gender' ? (GENDER[label] ?? label) : label.split(',')[0], value }))
    .sort((a, b) => (current === 'age' ? a.label.localeCompare(b.label) : b.value - a.value))
    .slice(0, 7)
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <Chip key={k} active={k === current} onClick={() => setKey(k)} className="h-7 px-2.5 text-xs">
            {AUDIENCE_LABEL[k]}
          </Chip>
        ))}
      </div>
      <BarList rows={rows} format={(n) => percent(n / total, 0)} />
      <p className="mt-3 text-[11px] text-gray-400">Seguidores neste mês. A Meta mostra só os 45 maiores grupos.</p>
    </div>
  )
}

const PostRow: React.FC<{ media: IgMedia; onOpen: () => void }> = ({ media, onOpen }) => (
  <tr className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-zinc-50" onClick={onOpen}>
    <td className="py-2 pr-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MediaThumb media={media} className="h-11 w-11 shrink-0 rounded-md" />
        <span className="min-w-0">
          <span className="line-clamp-1 text-sm text-gray-900">{media.caption?.trim() || 'Sem legenda'}</span>
          <span className="block text-xs text-gray-500">
            {FORMAT_LABEL[formatOf(media)]} · {dayLabel(media.postedAt)}
          </span>
        </span>
      </button>
    </td>
    <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-900">{compact(media.insights.reach)}</td>
    <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-700">{compact(interactionsOf(media))}</td>
    <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-gray-700 sm:table-cell">{compact(media.insights.saved)}</td>
    <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-gray-700 sm:table-cell">{compact(media.insights.shares)}</td>
    <td className="py-2 pl-3 text-right text-sm tabular-nums text-gray-700">{percent(engagementOf(media))}</td>
  </tr>
)

const Overview: React.FC<{ account: IgAccount; days: IgDay[]; media: IgMedia[]; period: Period; onOpen: (m: IgMedia) => void }> = ({ account, days, media, period, onOpen }) => {
  const totals = account.totals[String(period) as '7' | '30'] ?? {}
  const since = dayKey(period)
  const reach = days.filter((d) => d.day >= since && d.reach !== undefined).map((d) => ({ day: d.day, value: d.reach! }))
  const followers = days.filter((d) => d.followers !== undefined).map((d) => ({ day: d.day, value: d.followers! }))
  // Ganho de seguidores: pelos dias guardados quando cobrem o período; senão, quem seguiu menos quem deixou (Meta)
  const startFollowers = followers.find((d) => d.day >= since)
  const covered = !!startFollowers && startFollowers.day <= dayKey(period - 1)
  const net = totals.follows !== undefined && totals.unfollows !== undefined ? totals.follows - totals.unfollows : undefined
  const fromHistory = startFollowers && account.followers !== undefined && startFollowers.day < dayKey(0) ? account.followers - startFollowers.value : undefined
  const followersSub =
    covered && fromHistory !== undefined
      ? `${signed(fromHistory)} em ${period} dias`
      : net !== undefined
        ? `${signed(net)} em ${period} dias · ${totals.follows} seguiram, ${totals.unfollows} saíram`
        : fromHistory !== undefined && startFollowers
          ? `${signed(fromHistory)} desde ${shortDay(startFollowers.day)}`
          : `Seguindo ${compact(account.follows)}`

  const cutoff = Date.now() - period * DAY
  const feed = media.filter((m) => formatOf(m) !== 'story')
  const recent = feed.filter((m) => m.postedAt >= cutoff)
  const top = (recent.length ? recent : feed).slice().sort((a, b) => (b.insights.reach ?? -1) - (a.insights.reach ?? -1)).slice(0, 6)

  const byFormat = useMemo(() => {
    const since90 = Date.now() - 90 * DAY
    const groups = new Map<IgFormat, number[]>()
    for (const m of media) {
      if (m.postedAt < since90 || m.insights.reach === undefined) continue
      const f = formatOf(m)
      groups.set(f, [...(groups.get(f) ?? []), m.insights.reach])
    }
    return [...groups.entries()]
      .map(([f, list]) => ({ label: FORMAT_LABEL[f], note: plural(list.length, 'post', 'posts'), value: Math.round(list.reduce((a, b) => a + b, 0) / list.length) }))
      .sort((a, b) => b.value - a.value)
  }, [media])

  const outside = totals.reach && totals.reach_non_followers !== undefined ? totals.reach_non_followers / totals.reach : undefined

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          dark
          label="Seguidores"
          value={compact(account.followers)}
          sub={followersSub}
        >
          {followers.length > 1 && <Sparkline values={followers.slice(-30).map((f) => f.value)} color="#fafafa" className="mt-2 h-8 w-full" />}
        </Stat>
        <Stat label={`Alcance (${period} dias)`} value={compact(totals.reach)} sub={outside !== undefined ? `${percent(outside, 0)} fora dos seguidores` : 'contas alcançadas'} />
        <Stat label="Contas engajadas" value={compact(totals.accounts_engaged)} sub={totals.total_interactions !== undefined ? `${compact(totals.total_interactions)} interações` : undefined} />
        <Stat label="Visualizações" value={compact(totals.views)} sub="posts, stories e reels" />
        <Stat label="Toques nos links do perfil" value={compact(totals.profile_links_taps)} sub="site, WhatsApp, e-mail, ligar" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl bg-zinc-900 p-4 text-white md:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Alcance por dia</h2>
              <p className="text-xs text-zinc-400">Contas diferentes que viram algo da conta em cada dia</p>
            </div>
            {reach.length > 0 && <p className="text-xs tabular-nums text-zinc-400">pico {compact(Math.max(...reach.map((r) => r.value)))}</p>}
          </div>
          {reach.length ? (
            <TrendChart points={reach} unit="contas" label={`Alcance por dia nos últimos ${period} dias`} tone="dark" height={260} />
          ) : (
            <p className="flex h-[260px] items-center justify-center text-sm text-zinc-400">O alcance de cada dia aparece depois da primeira atualização.</p>
          )}
        </section>
        <Surface title="Alcance médio por formato">
          {byFormat.length ? (
            <>
              <BarList rows={byFormat} />
              <p className="mt-3 text-[11px] text-gray-400">Posts dos últimos 90 dias.</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Sem posts com números nos últimos 90 dias.</p>
          )}
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Surface title={recent.length ? `Melhores posts dos últimos ${period} dias` : 'Melhores posts recentes'}>
          {top.length ? (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-3 font-medium">Post</th>
                    <th className="px-3 pb-2 text-right font-medium">Alcance</th>
                    <th className="px-3 pb-2 text-right font-medium">Interações</th>
                    <th className="hidden px-3 pb-2 text-right font-medium sm:table-cell">Salvos</th>
                    <th className="hidden px-3 pb-2 text-right font-medium sm:table-cell">Compart.</th>
                    <th className="pb-2 pl-3 text-right font-medium">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((m) => (
                    <PostRow key={m.id} media={m} onOpen={() => onOpen(m)} />
                  ))}
                </tbody>
              </table>
              {!recent.length && <p className="mt-3 text-xs text-gray-500">Nenhum post nos últimos {period} dias: estes são os de maior alcance entre os mais recentes.</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhum post lido ainda.</p>
          )}
        </Surface>
        <Surface title="Público">
          <Audience account={account} />
        </Surface>
      </div>
    </div>
  )
}

const SORT_LABEL: Record<SortKey, string> = { recentes: 'Mais recentes', alcance: 'Mais alcance', interacoes: 'Mais interações', salvos: 'Mais salvos', taxa: 'Maior taxa de engajamento' }

const PostsGrid: React.FC<{ media: IgMedia[]; onOpen: (m: IgMedia) => void }> = ({ media, onOpen }) => {
  const [format, setFormat] = useState<IgFormat | 'todos'>('todos')
  const [sort, setSort] = useState<SortKey>('recentes')
  const formats = (['reels', 'carrossel', 'foto', 'story'] as IgFormat[]).filter((f) => media.some((m) => formatOf(m) === f))
  const list = media
    .filter((m) => format === 'todos' || formatOf(m) === format)
    .slice()
    .sort((a, b) => {
      if (sort === 'alcance') return (b.insights.reach ?? -1) - (a.insights.reach ?? -1)
      if (sort === 'interacoes') return interactionsOf(b) - interactionsOf(a)
      if (sort === 'salvos') return (b.insights.saved ?? -1) - (a.insights.saved ?? -1)
      if (sort === 'taxa') return (engagementOf(b) ?? -1) - (engagementOf(a) ?? -1)
      return b.postedAt - a.postedAt
    })
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={format === 'todos'} onClick={() => setFormat('todos')}>
          Todos <span className="tabular-nums opacity-60">{media.length}</span>
        </Chip>
        {formats.map((f) => {
          const Icon = FORMAT_ICON[f]
          return (
            <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
              <Icon className="h-3.5 w-3.5" /> {FORMAT_LABEL[f]}
            </Chip>
          )
        })}
        <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          Ordem
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')}>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m)}
                className="group block w-full overflow-hidden rounded-xl bg-white text-left shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_6px_16px_-8px_rgb(0_0_0/0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MediaThumb media={m} badge className="aspect-[4/5] w-full" />
                <div className="p-2.5">
                  <p className="text-[11px] text-gray-500">{dayLabel(m.postedAt)}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900">
                    {compact(m.insights.reach)} <span className="text-[11px] font-normal text-gray-500">de alcance</span>
                  </p>
                  <p className="truncate text-[11px] tabular-nums text-gray-500">
                    {compact(interactionsOf(m))} interações · {percent(engagementOf(m))}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">Nenhum post deste tipo.</p>
      )}
      <p className="mt-4 text-xs text-gray-500">Cada atualização lê os 50 posts mais recentes e os stories no ar; os mais antigos ficam com os últimos números lidos. Stories somem da API em 24 horas, então ficam aqui com os números da última leitura.</p>
    </div>
  )
}

// ---------- a conta ----------

const Avatar: React.FC<{ account: IgAccount; className?: string }> = ({ account, className }) => {
  const [broken, setBroken] = useState(false)
  return account.picture && !broken ? (
    <img src={account.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn('rounded-full object-cover', className)} />
  ) : (
    <span className={cn('flex items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white', className)} aria-hidden>
      {account.username.charAt(0).toUpperCase()}
    </span>
  )
}

const Dashboard: React.FC<{ account: IgAccount; accounts: IgAccount[]; manager: boolean; onSelect: (id: string) => void; onReload: () => Promise<void> }> = ({ account, accounts, manager, onSelect, onReload }) => {
  const { team } = useCrm()
  const people = useTeamPeople(team?.id)
  const [days, setDays] = useState<IgDay[]>([])
  const [media, setMedia] = useState<IgMedia[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [period, setPeriod] = useState<Period>(30)
  const [tab, setTab] = useState<Tab>('geral')
  const [open, setOpen] = useState<IgMedia | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [adding, setAdding] = useState(false)
  const autoSynced = useRef<string | null>(null)

  const loadData = useCallback(async () => {
    const [d, m] = await Promise.all([loadDays(account.id, dayKey(400)), loadMedia(account.id)])
    setDays(d)
    setMedia(m)
    setLoaded(true)
  }, [account.id])

  useEffect(() => {
    setLoaded(false)
    loadData().catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
  }, [loadData])

  const sync = useCallback(
    async (quiet = false) => {
      setSyncing(true)
      try {
        const result = await syncAccount(account.id)
        await Promise.all([onReload(), loadData()])
        if (!quiet) toast.success('Instagram atualizado', { description: result.missing.length ? `A Meta não devolveu: ${result.missing.join(', ')}.` : `${plural(result.posts, 'post lido', 'posts lidos')}.` })
      } catch (error) {
        if (error instanceof InstagramError && error.code === 'token') await onReload()
        if (!quiet || !(error instanceof InstagramError && error.code === 'unavailable')) toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        setSyncing(false)
      }
    },
    [account.id, loadData, onReload]
  )

  // Leitura nova ao abrir, se a última tem mais de 30 minutos
  useEffect(() => {
    if (autoSynced.current === account.id || account.syncError === 'token') return
    if (account.syncedAt && Date.now() - account.syncedAt < STALE) return
    autoSynced.current = account.id
    void sync(true)
  }, [account.id, account.syncedAt, account.syncError, sync])

  const disconnect = async () => {
    try {
      await disconnectAccount(account.id)
      toast.success(`@${account.username} desconectado`)
      await onReload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const broken = account.syncError === 'token'

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar account={account} className="h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Instagram</h1>
            {accounts.length > 1 && (
              <select value={account.id} onChange={(e) => onSelect(e.target.value)} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')} aria-label="Conta">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            <a href={`https://instagram.com/${account.username}`} target="_blank" rel="noreferrer" className="font-medium text-gray-700 hover:underline">
              @{account.username}
            </a>
            {account.name ? ` · ${account.name}` : ''} · {compact(account.mediaCount)} posts · atualizado {ago(account.syncedAt)}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => void sync()} disabled={syncing || broken} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} /> {syncing ? 'Atualizando…' : 'Atualizar'}
          </Button>
          <Button size="sm" onClick={() => setPublishing(true)} disabled={broken} className="gap-1.5">
            <Send className="h-4 w-4" /> Publicar
          </Button>
        </div>
      </div>

      {broken && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">A conexão com o Instagram caiu (expirou ou o acesso foi tirado). Os números abaixo são da última leitura.</p>
          {manager ? (
            <Button size="sm" variant="outline" onClick={() => void startConnect(account.teamId).catch((e) => toast.error(e instanceof Error ? e.message : String(e)))}>
              Conectar de novo
            </Button>
          ) : (
            <span className="text-xs">Peça a quem gerencia a equipe para conectar de novo.</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={tab === 'geral'} onClick={() => setTab('geral')}>
          Visão geral
        </Chip>
        <Chip active={tab === 'posts'} onClick={() => setTab('posts')}>
          Posts <span className="tabular-nums opacity-60">{media.length}</span>
        </Chip>
        {tab === 'geral' && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200" role="group" aria-label="Período">
            {([7, 30] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={cn('h-7 rounded-full px-3 text-xs font-medium transition-colors', period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900')}
              >
                {p} dias
              </button>
            ))}
          </div>
        )}
      </div>

      {!loaded ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo os números…
        </p>
      ) : (
        <div className={cn('transition-opacity', syncing && 'opacity-70')}>
          {tab === 'geral' ? <Overview account={account} days={days} media={media} period={period} onOpen={setOpen} /> : <PostsGrid media={media} onOpen={setOpen} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <span>
          Conectado {account.connectedBy ? `por ${nameOf(people, account.connectedBy) ?? 'alguém da equipe'} ` : ''}em {dayLabel(account.connectedAt)}
        </span>
        {account.tokenExpiresAt && <span>Acesso válido até {dayLabel(account.tokenExpiresAt)} (renova sozinho a cada leitura)</span>}
        {account.quota && <span>Publicados pela API em 24 h: {account.quota.used} de {account.quota.total}</span>}
        {account.missing.length > 0 && <span title={account.missing.join(', ')}>A Meta não devolveu {plural(account.missing.length, 'métrica', 'métricas')} na última leitura</span>}
        {manager && (
          <span className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              <Plus className="h-3.5 w-3.5" /> Outra conta
            </button>
            {confirmOff ? (
              <>
                <span>Desconectar @{account.username}? Os números guardados saem junto.</span>
                <button type="button" onClick={() => void disconnect()} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700">
                  Desconectar
                </button>
                <button type="button" onClick={() => setConfirmOff(false)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">
                  Não
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmOff(true)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-rose-50 hover:text-rose-700">
                Desconectar
              </button>
            )}
          </span>
        )}
      </div>

      {adding && <ConnectCard teamId={account.teamId} manager={manager} again onDone={() => void onReload().then(() => setAdding(false))} />}

      {open && (
        <PostPanel media={open} accountId={account.id} username={account.username} publisher={open.publishedBy ? nameOf(people, open.publishedBy) ?? 'alguém da equipe' : undefined} onClose={() => setOpen(null)} />
      )}
      {publishing && <PublishDialog account={account} onClose={() => setPublishing(false)} onPublished={() => void loadData()} />}
    </div>
  )
}

// ---------- tela ----------

const InstagramPage: React.FC = () => {
  const { team } = useCrm()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [accounts, setAccounts] = useState<IgAccount[] | null>(null)
  const [error, setError] = useState<'sem-tabelas' | string | null>(null)
  const [selected, setSelected] = useState<string>()

  const reload = useCallback(async () => {
    if (!team) return
    try {
      const list = await loadAccounts(team.id)
      setAccounts(list)
      setError(null)
    } catch (e) {
      setError(e instanceof NoTablesError ? 'sem-tabelas' : e instanceof Error ? e.message : String(e))
      setAccounts([])
    }
  }, [team])

  useEffect(() => {
    setAccounts(null)
    void reload()
  }, [reload])

  const account = accounts?.find((a) => a.id === selected) ?? accounts?.[0]

  return (
    <Page wide>
      {!team || accounts === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo o Instagram da equipe…
        </p>
      ) : error === 'sem-tabelas' ? (
        <Surface className="mx-auto max-w-2xl">
          <h1 className="text-lg font-semibold text-gray-900">Falta preparar o banco</h1>
          <p className="mt-1 text-sm text-gray-600">
            As tabelas do Instagram ainda não existem. Aplique a migração <code className="text-xs">supabase/migrations/20261024120000_crm_instagram.sql</code> no Supabase e abra esta tela de novo.
          </p>
          <SetupGuide />
        </Surface>
      ) : error ? (
        <Surface className="mx-auto max-w-2xl">
          <p className="text-sm text-rose-700">{error}</p>
        </Surface>
      ) : account ? (
        <Dashboard account={account} accounts={accounts} manager={manager} onSelect={setSelected} onReload={reload} />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Instagram</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Acompanhe e cuide do Instagram da equipe sem abrir o app.</p>
          </div>
          <ConnectCard teamId={team.id} manager={manager} onDone={() => void reload()} />
          <p className="mx-auto mt-4 max-w-2xl text-xs text-gray-500">
            Diferente do Social, que anota os toques feitos à mão nos perfis de outras empresas: aqui é a conta da própria equipe, pela API oficial.
          </p>
        </>
      )}
    </Page>
  )
}

export default InstagramPage
