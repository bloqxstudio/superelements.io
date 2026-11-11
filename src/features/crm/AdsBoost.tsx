import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Copy, ExternalLink, Facebook, Link2, Loader2, MapPin, MessageCircle, Pause, Play, RefreshCw, Rocket, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Chip } from '@/features/prospects/ui'
import { FIELD, Surface, dayLabel } from './ui'
import {
  BOOST_GOALS,
  BOOST_MAX_DAILY,
  BOOST_MAX_DAYS,
  BOOST_MIN_DAILY,
  BOOST_RETURN_KEY,
  AdsError,
  activateBoost,
  createAdsLink,
  adsManagerUrl,
  boostGeo,
  boostMedia,
  boostMetaLabel,
  boostSetup,
  createBoost,
  loadBoosts,
  money,
  pauseBoost,
  refreshBoosts,
  startBoostLogin,
  type AdAccount,
  type Boost,
  type BoostGoal,
  type BoostMedia,
  type BoostPage,
  type BoostPlace,
  type BoostSetup,
} from './ads'

/**
 * Turbinar post (2026-11-11; o usuário: "login com facebook, daria pra fazer isso? e deixar atrelado a
 * essa conta do cliente?"). Na conta de anúncios ligada a esta conta do app, cria o anúncio de um post do
 * Instagram dela (o Instagram conectado na aba Perfil), como o "Turbinar" do app do Instagram, sem
 * Gerenciador de Negócios. Tudo nasce pausado; só quem gerencia ativa, confirmando o valor.
 */

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const PERMISSION_LABEL: Record<string, string> = {
  ads_management: 'criar anúncios',
  pages_manage_ads: 'anunciar com a Página',
  pages_show_list: 'ver as Páginas',
  instagram_basic: 'ver os posts do Instagram',
}

/** Link para o cliente ligar a conta de anúncios pelo celular: vai pelo WhatsApp e ele só toca. */
export const AdsClientLink: React.FC<{ teamId: string; compact?: boolean }> = ({ teamId, compact }) => {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const make = async () => {
    setBusy(true)
    try {
      setLink(await createAdsLink(teamId))
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }
  const message = link
    ? `Oi! Para ligarmos a sua conta de anúncios do Instagram e Facebook, abra este link no celular, toque em "Continuar com o Facebook" e confirme (a senha fica só no Facebook): ${link.url}`
    : ''
  return (
    <div className={cn('rounded-lg border border-dashed border-gray-300 p-3', !compact && 'mt-5')}>
      <p className="text-sm font-medium text-gray-900">A conta de anúncios é do cliente?</p>
      <p className="mt-0.5 text-xs text-gray-600">
        Mande um link no WhatsApp: ele abre no celular, entra com o Facebook e pronto. Já libera ler as campanhas e turbinar posts. Vale 7 dias e uma vez só.
      </p>
      {link ? (
        <div className="mt-2 space-y-2">
          <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="h-9 w-full rounded-md border border-gray-200 bg-zinc-50 px-2 text-xs text-gray-800" aria-label="Link para o cliente" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild className="gap-1.5">
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> Mandar no WhatsApp
              </a>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success('Mensagem copiada'))}>
              <Copy className="h-4 w-4" /> Copiar com mensagem
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(link.url).then(() => toast.success('Link copiado'))}>
              Só o link
            </Button>
          </div>
          <p className="text-[11px] text-gray-500">
            Vence em {new Date(link.expiresAt).toLocaleDateString('pt-BR')}. Enquanto o app da Meta não passa pela revisão, o Facebook do cliente precisa ter uma função no app (testador).
          </p>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-2 gap-1.5" disabled={busy} onClick={() => void make()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Gerar link para o cliente
        </Button>
      )}
    </div>
  )
}

const BoostLogin: React.FC<{ teamId: string; missing: string[] }> = ({ teamId, missing }) => {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await startBoostLogin(teamId)
    } catch (error) {
      toast.error(errorText(error))
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-3 text-sm text-gray-700">
      <p>
        Para turbinar daqui, quem tem a conta de anúncios do cliente (a mesma que o perfil usa para turbinar no Instagram) entra com o Facebook e aceita as permissões de criar
        anúncios. Não precisa de Gerenciador de Negócios.
      </p>
      {!!missing.length && <p className="text-xs text-gray-500">Falta aceitar: {missing.map((m) => PERMISSION_LABEL[m] ?? m).join(', ')}.</p>}
      <p className="text-xs text-gray-500">
        Na volta, marque a mesma conta de anúncios. O Instagram precisa estar ligado a uma Página do Facebook (Central de Contas ou configurações da Página).
      </p>
      <div>
        <Button onClick={() => void go()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />} Entrar com o Facebook
        </Button>
      </div>
      <AdsClientLink teamId={teamId} compact />
    </div>
  )
}

const MediaGrid: React.FC<{
  media: BoostMedia[]
  selected?: string
  onSelect: (m: BoostMedia) => void
}> = ({ media, selected, onSelect }) => (
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
    {media.map((m) => {
      const blocked = m.eligible === false
      return (
        <button
          key={m.id}
          type="button"
          disabled={blocked}
          onClick={() => onSelect(m)}
          title={blocked ? 'A Meta não deixa turbinar este post (música com direitos, conteúdo de marca ou formato).' : m.caption || undefined}
          className={cn(
            'relative aspect-square overflow-hidden rounded-lg bg-zinc-100 ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-gray-900',
            selected === m.id && 'ring-gray-900',
            blocked && 'cursor-not-allowed opacity-40',
          )}
        >
          {m.thumbnail ? (
            <img src={m.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-gray-500">{m.type}</span>
          )}
          {m.type === 'REELS' && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">Reels</span>}
          {selected === m.id && (
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white">
              <Check className="h-3 w-3" />
            </span>
          )}
        </button>
      )
    })}
  </div>
)

const PlacePicker: React.FC<{
  accountId: string
  places: BoostPlace[]
  onChange: (p: BoostPlace[]) => void
}> = ({ accountId, places, onChange }) => {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<BoostPlace[]>([])
  const [busy, setBusy] = useState(false)
  const timer = useRef<number>()

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (q.trim().length < 2) return setFound([])
    timer.current = window.setTimeout(() => {
      setBusy(true)
      boostGeo(accountId, q)
        .then((r) => setFound(r.places))
        .catch((e) => toast.error(errorText(e)))
        .finally(() => setBusy(false))
    }, 350)
    return () => window.clearTimeout(timer.current)
  }, [q, accountId])

  const add = (p: BoostPlace) => {
    if (!places.some((x) => x.key === p.key)) onChange([...places, p.type === 'city' ? { ...p, radius: 17 } : p].slice(0, 10))
    setQ('')
    setFound([])
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cidade ou estado (vazio: Brasil inteiro)"
          className={cn(FIELD, 'h-9 pl-9')}
          aria-label="Buscar cidade ou estado"
        />
        {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
        {!!found.length && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {found.map((p) => (
              <li key={p.key}>
                <button type="button" onClick={() => add(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" /> {p.name} <span className="ml-auto text-xs text-gray-400">{p.type === 'city' ? 'cidade' : 'estado'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!!places.length && (
        <div className="flex flex-wrap gap-1.5">
          {places.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-xs text-gray-800">
              {p.name}
              {p.type === 'city' && (
                <select
                  value={p.radius ?? 17}
                  onChange={(e) => onChange(places.map((x) => (x.key === p.key ? { ...x, radius: Number(e.target.value) } : x)))}
                  className="rounded bg-white px-1 py-0.5 text-xs ring-1 ring-inset ring-gray-200"
                  aria-label={`Raio em volta de ${p.name}`}
                >
                  {[10, 17, 25, 40, 80].map((r) => (
                    <option key={r} value={r}>
                      +{r} km
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={() => onChange(places.filter((x) => x.key !== p.key))} className="rounded-full p-0.5 hover:bg-gray-200" aria-label={`Tirar ${p.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Ativar gasta dinheiro do cliente: mostra o valor e pede para marcar a confirmação. */
const ActivateConfirm: React.FC<{
  account: AdAccount
  boost: Pick<Boost, 'id' | 'dailyBudget' | 'currency' | 'startAt' | 'endAt'>
  onDone: () => void
  onCancel?: () => void
}> = ({ account, boost, onDone, onCancel }) => {
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const days = Math.max(1, Math.round((boost.endAt - Math.max(boost.startAt, Date.now())) / 86_400_000))
  const go = async () => {
    setBusy(true)
    try {
      await activateBoost(account.id, boost.id, boost.dailyBudget)
      toast.success('Anúncio ativado', {
        description: 'A Meta analisa antes de começar a rodar (costuma levar minutos).',
      })
      onDone()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-inset ring-amber-600/20">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5" />
        <span>
          Confirmo gastar até <strong>{money(boost.dailyBudget, boost.currency)} por dia</strong> por cerca de {days} {days === 1 ? 'dia' : 'dias'} (até{' '}
          <strong>{money(boost.dailyBudget * days, boost.currency)}</strong>), cobrados na forma de pagamento da conta de anúncios {account.name}.
        </span>
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void go()} disabled={!sure || busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Ativar
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Agora não
          </Button>
        )}
      </div>
    </div>
  )
}

type Created = {
  id: string
  dailyBudget: number
  startAt: number
  endAt: number
}

export const BoostDialog: React.FC<{
  account: AdAccount
  manager: boolean
  onClose: () => void
  onCreated: () => void
}> = ({ account, manager, onClose, onCreated }) => {
  const [setup, setSetup] = useState<BoostSetup | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [page, setPage] = useState<BoostPage | null>(null)
  const [media, setMedia] = useState<BoostMedia[] | null>(null)
  const [post, setPost] = useState<BoostMedia | null>(null)
  const [goal, setGoal] = useState<BoostGoal>('engajamento')
  const [link, setLink] = useState('')
  const [daily, setDaily] = useState('20')
  const [days, setDays] = useState('7')
  const [ageMin, setAgeMin] = useState('18')
  const [ageMax, setAgeMax] = useState('65')
  const [genders, setGenders] = useState<'todos' | 'mulheres' | 'homens'>('todos')
  const [places, setPlaces] = useState<BoostPlace[]>([])
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  useEffect(() => {
    boostSetup(account.id)
      .then((s) => {
        setSetup(s)
        if (s.pages.length === 1) setPage(s.pages[0])
      })
      .catch((e) => setSetupError(errorText(e)))
  }, [account.id])

  useEffect(() => {
    if (!page?.ig) return
    setMedia(null)
    setPost(null)
    boostMedia(account.id, page.id, page.ig.id)
      .then((r) => setMedia(r.media))
      .catch((e) => {
        toast.error(errorText(e))
        setMedia([])
      })
  }, [account.id, page])

  const dailyN = Number(daily.replace(',', '.'))
  const daysN = Math.round(Number(days))
  const valid =
    !!page?.ig &&
    !!post &&
    dailyN >= BOOST_MIN_DAILY &&
    dailyN <= BOOST_MAX_DAILY &&
    daysN >= 1 &&
    daysN <= BOOST_MAX_DAYS &&
    (goal !== 'site' || /^https?:\/\/\S+\.\S+/.test(link.trim()))

  const create = async () => {
    if (!valid || !page?.ig || !post) return
    setBusy(true)
    try {
      const r = await createBoost(account.id, {
        pageId: page.id,
        igUserId: page.ig.id,
        mediaId: post.id,
        goal,
        link: goal === 'site' ? link.trim() : undefined,
        dailyBudget: dailyN,
        days: daysN,
        ageMin: Number(ageMin),
        ageMax: Number(ageMax),
        genders,
        places,
      })
      const start = Date.now() + 10 * 60_000
      setCreated({
        id: r.id,
        dailyBudget: Math.round(dailyN * 100) / 100,
        startAt: start,
        endAt: start + daysN * 86_400_000,
      })
      onCreated()
      toast.success('Anúncio criado pausado na conta de anúncios')
    } catch (error) {
      if (error instanceof AdsError && error.code === 'boost_login') setSetup((s) => (s ? { ...s, ready: false } : s))
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  const currency = account.currency
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Turbinar post
          </DialogTitle>
          <DialogDescription>
            Na conta de anúncios {account.name}. O anúncio é criado pausado
            {manager ? '' : ' e quem gerencia a conta ativa'}.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="grid gap-4 text-sm">
            <p className="flex items-center gap-2 text-gray-800">
              <Check className="h-4 w-4 text-emerald-600" /> Campanha, conjunto e anúncio criados, pausados.
            </p>
            {manager ? (
              <ActivateConfirm account={account} boost={{ ...created, currency }} onDone={onClose} onCancel={onClose} />
            ) : (
              <p className="text-gray-600">Quem gerencia a conta vê o anúncio na lista "Posts turbinados" e ativa quando aprovar o valor.</p>
            )}
          </div>
        ) : setupError ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{setupError}</p>
        ) : !setup ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Conferindo o acesso e o Instagram da conta…
          </p>
        ) : !setup.ready ? (
          <BoostLogin teamId={account.teamId} missing={setup.missing} />
        ) : !setup.pages.length ? (
          <div className="grid gap-3 text-sm text-gray-700">
            <p className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              {setup.instagram.length
                ? `O Instagram @${setup.instagram.join(', @')} não aparece ligado a uma Página do Facebook que esse acesso administra.`
                : 'Esse acesso não enxerga nenhuma Página do Facebook com Instagram ligado.'}
            </p>
            <p className="text-xs text-gray-500">
              A Meta exige uma Página para anunciar pela API (pode ser uma Página sem posts). Ligue o Instagram a ela no Instagram › Central de Contas, ou nas configurações da
              Página › Contas vinculadas, e entre com o Facebook de novo com quem administra a Página.
            </p>
            <div>
              <BoostLogin teamId={account.teamId} missing={[]} />
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {setup.pages.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Perfil">
                {setup.pages.map((p) => (
                  <Chip key={p.id} active={page?.id === p.id} onClick={() => setPage(p)}>
                    @{p.ig?.username} <span className="text-xs opacity-60">· {p.name}</span>
                  </Chip>
                ))}
              </div>
            )}

            {page?.ig && (
              <section className="grid gap-2">
                <h3 className="text-sm font-medium text-gray-900">Post de @{page.ig.username}</h3>
                {media === null ? (
                  <p className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Lendo os posts…
                  </p>
                ) : media.length ? (
                  <div className="max-h-72 overflow-y-auto pr-1">
                    <MediaGrid media={media} selected={post?.id} onSelect={setPost} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum post encontrado.</p>
                )}
              </section>
            )}

            {post && (
              <>
                <section className="grid gap-2">
                  <h3 className="text-sm font-medium text-gray-900">Objetivo</h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {BOOST_GOALS.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        aria-pressed={goal === g.key}
                        onClick={() => setGoal(g.key)}
                        className={cn(
                          'rounded-lg p-3 text-left ring-1 ring-inset transition',
                          goal === g.key ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white ring-gray-200 hover:bg-gray-50',
                        )}
                      >
                        <span className="block text-sm font-medium">{g.label}</span>
                        <span className={cn('mt-0.5 block text-xs', goal === g.key ? 'text-white/70' : 'text-gray-500')}>{g.hint}</span>
                      </button>
                    ))}
                  </div>
                  {goal === 'site' && (
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={cn(FIELD, 'h-9')} aria-label="Endereço do site" />
                  )}
                </section>

                <section className="grid gap-2">
                  <h3 className="text-sm font-medium text-gray-900">Público</h3>
                  <PlacePicker accountId={account.id} places={places} onChange={setPlaces} />
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span>Idade</span>
                    <input type="number" min={18} max={65} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={cn(FIELD, 'h-8 w-16')} aria-label="Idade mínima" />
                    <span>a</span>
                    <input type="number" min={18} max={65} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={cn(FIELD, 'h-8 w-16')} aria-label="Idade máxima" />
                    <span className="ml-2 flex gap-1" role="group" aria-label="Gênero">
                      {(['todos', 'mulheres', 'homens'] as const).map((g) => (
                        <Chip key={g} active={genders === g} onClick={() => setGenders(g)} className="h-7 px-2.5 text-xs capitalize">
                          {g}
                        </Chip>
                      ))}
                    </span>
                  </div>
                </section>

                <section className="grid gap-2">
                  <h3 className="text-sm font-medium text-gray-900">Orçamento</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} className={cn(FIELD, 'h-9 w-24')} aria-label="Valor por dia" />
                    <span>por dia, durante</span>
                    <input type="number" min={1} max={BOOST_MAX_DAYS} value={days} onChange={(e) => setDays(e.target.value)} className={cn(FIELD, 'h-9 w-20')} aria-label="Dias" />
                    <span>dias</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {Number.isFinite(dailyN) && daysN > 0 ? `Até ${money(dailyN * daysN, currency)} no total. ` : ''}
                    De {money(BOOST_MIN_DAILY, currency)} a {money(BOOST_MAX_DAILY, currency)} por dia; até {BOOST_MAX_DAYS} dias. Só no Instagram (feed, stories, reels e
                    explorar).
                  </p>
                </section>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
                  <Button onClick={() => void create()} disabled={!valid || busy} className="gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Criar anúncio pausado
                  </Button>
                  <span className="text-xs text-gray-500">Nada é gasto até alguém que gerencia a conta ativar.</span>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const TONE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  wait: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  bad: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  off: 'bg-gray-100 text-gray-700 ring-gray-500/20',
}

const GOAL_LABEL = Object.fromEntries(BOOST_GOALS.map((g) => [g.key, g.label])) as Record<BoostGoal, string>

/** "Posts turbinados" na aba Anúncios: os criados por aqui, a situação na Meta, ativar e pausar. */
export const BoostList: React.FC<{
  account: AdAccount
  manager: boolean
  version: number
}> = ({ account, manager, version }) => {
  const [boosts, setBoosts] = useState<Boost[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    () =>
      loadBoosts(account.id)
        .then(setBoosts)
        .catch((e) => toast.error(errorText(e))),
    [account.id],
  )

  const check = useCallback(
    async (quiet = false) => {
      setChecking(true)
      try {
        await refreshBoosts(account.id)
        await load()
      } catch (error) {
        if (!quiet) toast.error(errorText(error))
      } finally {
        setChecking(false)
      }
    },
    [account.id, load],
  )

  useEffect(() => {
    void load().then(() => void check(true))
  }, [load, check, version])

  const pause = async (b: Boost) => {
    setBusy(b.id)
    try {
      await pauseBoost(account.id, b.id)
      toast.success('Anúncio pausado')
      await load()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  if (!boosts?.length) return null
  return (
    <Surface
      title="Posts turbinados"
      action={
        <Button size="sm" variant="ghost" onClick={() => void check()} disabled={checking} className="gap-1.5">
          <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} /> Situação
        </Button>
      }
    >
      <ul className="grid gap-3">
        {boosts.map((b) => {
          const meta = b.status === 'encerrado' ? { label: 'Encerrado', tone: 'off' as const } : boostMetaLabel(b.metaStatus)
          return (
            <li key={b.id} className="grid gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                  {b.thumbnail && <img src={b.thumbnail} alt="" className="h-full w-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{b.caption || `Post de @${b.igUsername ?? ''}`}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {GOAL_LABEL[b.goal]} · {money(b.dailyBudget, b.currency)}
                    /dia · {dayLabel(b.startAt)} a {dayLabel(b.endAt)}
                  </p>
                  {b.metaFeedback && <p className="mt-1 text-xs text-rose-700">{b.metaFeedback}</p>}
                </div>
                {meta && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[meta.tone])}>{meta.label}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-[68px]">
                {b.status === 'pausado' && manager && confirming !== b.id && (
                  <Button size="sm" variant="outline" onClick={() => setConfirming(b.id)} className="h-7 gap-1.5 text-xs">
                    <Play className="h-3.5 w-3.5" /> Ativar
                  </Button>
                )}
                {b.status === 'pausado' && !manager && <span className="text-xs text-gray-500">Esperando quem gerencia a conta ativar</span>}
                {b.status === 'ativo' && (
                  <Button size="sm" variant="outline" onClick={() => void pause(b)} disabled={busy === b.id} className="h-7 gap-1.5 text-xs">
                    <Pause className="h-3.5 w-3.5" /> Pausar
                  </Button>
                )}
                {b.permalink && (
                  <a href={b.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900">
                    <ExternalLink className="h-3.5 w-3.5" /> Post
                  </a>
                )}
                <a
                  href={adsManagerUrl(account.adAccountId, b.campaignId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Gerenciador
                </a>
              </div>
              {confirming === b.id && (
                <div className="pl-[68px]">
                  <ActivateConfirm
                    account={account}
                    boost={b}
                    onDone={() => {
                      setConfirming(null)
                      void load()
                    }}
                    onCancel={() => setConfirming(null)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Surface>
  )
}
