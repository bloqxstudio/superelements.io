import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AreaTabs } from '@/features/navigation/AreaTabs'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Ban, CalendarRange, Check, ChevronLeft, ChevronRight, CircleAlert, Copy, Lightbulb, Link2, Loader2, MessageSquare, Plus, Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { FIELD, Page, PageHeader } from '@/features/crm/ui'
import type { Content } from '@/features/conteudos/rules'
import { deleteContent, transitionContent } from '@/features/conteudos/api'
import { useIara, useIaraScreen } from '@/features/iara/store'
import { approvalUrl, listApprovalLinks, loadCovers, loadPauta, revokeApprovalLink, scheduleContent, type ApprovalLink, type CoverInfo, type PautaData } from '@/features/pauta/api'
import { CHANNELS, STAGES, STAGE_LABEL, STAGE_TONE, addDays, byTime, isoOf, monthGrid, monthTitle, rangeLabel, sameMonth, stageOf, weekDays, weekStart, type Stage } from '@/features/pauta/rules'
import { PautaPanel } from '@/features/pauta/PautaPanel'
import { SendDialog } from '@/features/pauta/SendDialog'
import { ratioOf, timeLabel } from '@/features/pauta/ui'
import { TagChip, tagTone, tagsOf } from '@/features/pauta/tags'
import type { ContentTag } from '@/features/pauta/api'

/**
 * Pauta (/pauta): o calendário editorial da conta, no estilo da Pautta. Cada conteúdo é um card no
 * seu dia (arrastar muda o dia), com a capa do criativo, o horário, o canal e a etapa: da produção
 * ao gestor, do gestor ao cliente. O gestor envia um lote ao cliente por link; o cliente aprova ou
 * pede ajuste e comenta; as respostas chegam aqui ao vivo.
 */

const WEEK = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const today = () => isoOf(new Date())

const PautaCard: React.FC<{ c: Content; tags: ContentTag[]; cover?: CoverInfo; open: number; compact?: boolean; selected: boolean; onOpen: () => void }> = ({ c, tags, cover, open, compact, selected, onOpen }) => {
  const stage = stageOf(c)
  const mine = tagsOf(c.tagIds, tags)
  const first = cover?.posts.find((p) => p.cover && cover.urls[p.cover])
  const img = first ? cover!.urls[first.cover!] : undefined
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/pauta', c.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      aria-label={`${c.title}, ${STAGE_LABEL[stage]}${mine.length ? `, ${mine.map((t) => t.name).join(', ')}` : ''}${c.scheduledTime ? `, às ${c.scheduledTime}` : ''}`}
      className={cn(
        'group relative flex w-full items-stretch gap-2 overflow-hidden rounded-md border bg-white text-left transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-gray-900 shadow-sm' : 'border-gray-200 hover:border-gray-300',
        compact ? 'p-1' : 'p-1.5'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', STAGE_TONE[stage].bar)} aria-hidden />
      {img ? (
        <img src={img} alt="" className={cn('ml-1 shrink-0 rounded-sm bg-gray-100 object-cover', compact ? 'h-8 w-8' : 'h-14 w-[46px]')} style={compact ? undefined : { aspectRatio: String(ratioOf(first!.format)) }} loading="lazy" />
      ) : (
        <span className="ml-1" />
      )}
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {c.scheduledTime && <span className="tabular-nums text-gray-800">{c.scheduledTime}</span>}
          {c.channel && <span>{CHANNELS.find((x) => x.id === c.channel)?.short}</span>}
          {open > 0 && (
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1 text-[9px] font-semibold text-white">
              <MessageSquare className="h-2.5 w-2.5" aria-hidden />
              {open}
            </span>
          )}
        </span>
        <span className={cn('block text-xs font-medium leading-snug text-gray-900', compact ? 'truncate' : 'line-clamp-2')}>{c.title}</span>
        {mine.length > 0 && (
          <span className="mt-0.5 flex min-w-0 flex-wrap gap-0.5" aria-hidden>
            {mine.slice(0, compact ? 2 : 5).map((t) => (
              <TagChip key={t.id} tag={t} size="xs" className="max-w-[88px]" />
            ))}
            {compact && mine.length > 2 && <span className="text-[9px] font-medium leading-4 text-gray-500">+{mine.length - 2}</span>}
          </span>
        )}
        {!compact && <span className="mt-0.5 block truncate text-[11px] text-gray-500">{STAGE_LABEL[stage]}</span>}
      </span>
    </button>
  )
}

const DayCell: React.FC<{ day: string; children: React.ReactNode; onDrop: (id: string, day: string) => void; className?: string; label: string }> = ({ day, children, onDrop, className, label }) => {
  const [over, setOver] = useState(false)
  return (
    <div
      role="group"
      aria-label={label}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('text/pauta')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('text/pauta')
        if (id) onDrop(id, day)
      }}
      className={cn('transition-colors', over && 'bg-violet-50 ring-2 ring-inset ring-violet-400', className)}
    >
      {children}
    </div>
  )
}

const LinksDialog: React.FC<{ open: boolean; links: ApprovalLink[] | null; titles: Record<string, string>; manager: boolean; onClose: () => void; onRevoke: (id: string) => void }> = ({ open, links, titles, manager, onClose, onRevoke }) => {
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não consegui copiar.')
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Envios ao cliente</DialogTitle>
          <DialogDescription>Cada envio é um link. Um link revogado deixa de abrir na hora.</DialogDescription>
        </DialogHeader>
        {links === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lendo
          </p>
        ) : links.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum envio ainda.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto">
            {links.map((l) => {
              const ok = l.items.filter((i) => i.decision === 'aprovado').length
              const fix = l.items.filter((i) => i.decision === 'ajuste').length
              const wait = l.items.length - ok - fix
              const dead = !!l.revokedAt || l.expiresAt < Date.now()
              return (
                <li key={l.id} className={cn('py-3', dead && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{l.title}</p>
                    {!dead && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => void copy(approvalUrl(l.id))}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Copiar link
                        </Button>
                        {manager && (
                          <Button size="sm" variant="ghost" onClick={() => onRevoke(l.id)} className="text-gray-600 hover:text-red-700">
                            <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Revogar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {timeLabel(l.createdAt)} · {l.items.length} {l.items.length === 1 ? 'peça' : 'peças'} ·{' '}
                    <span className="text-emerald-700">{ok} aprovadas</span> · <span className="text-red-700">{fix} com ajuste</span> · {wait} esperando
                    {l.revokedAt ? ' · revogado' : l.expiresAt < Date.now() ? ' · expirado' : ''}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-400">{l.items.map((i) => titles[i.contentId] ?? '…').join(' · ')}</p>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

const Pauta: React.FC = () => {
  const team = useCrm((s) => s.team)
  const teamStatus = useCrm((s) => s.status)
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const view = params.get('visao') === 'semana' ? 'semana' : 'mes'
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('dia') ?? '') ? params.get('dia')! : today()
  const openId = params.get('peca') ?? undefined
  const stageFilter = (params.get('etapa') ?? '') as Stage | ''
  const channelFilter = params.get('canal') ?? ''
  const tagFilter = params.get('tipo') ?? ''

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>()
  const [data, setData] = useState<PautaData | null>(null)
  const [covers, setCovers] = useState<Record<string, CoverInfo>>({})
  const [sending, setSending] = useState<false | { ids?: string[]; title?: string }>(false)
  const [quick, setQuick] = useState<string>()
  const askIara = useIara((s) => s.ask)
  const [linksOpen, setLinksOpen] = useState(false)
  const [links, setLinks] = useState<ApprovalLink[] | null>(null)
  const [me, setMe] = useState<string>()

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: u }) => setMe(u.user?.id))
  }, [])

  const setParam = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      setParams(next, { replace: true })
    },
    [params, setParams]
  )

  const load = useCallback(
    async (quiet = false) => {
      if (!team) return
      if (!quiet) setState('loading')
      try {
        const next = await loadPauta(team.id)
        setData(next)
        setState('ready')
        void loadCovers(next.creatives).then(setCovers).catch(() => undefined)
      } catch (e) {
        console.error('[pauta] falha ao ler', e)
        setError(e instanceof Error ? e.message : undefined)
        if (!quiet) setState('error')
      }
    },
    [team]
  )

  useEffect(() => {
    void load()
  }, [load])

  // Ao vivo: o cliente respondeu, outra pessoa mudou um dia ou comentou
  const timer = useRef<number>()
  useEffect(() => {
    if (!team) return
    const later = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void load(true), 600)
    }
    const filter = `team_id=eq.${team.id}`
    const channel = supabase
      .channel(`pauta-${team.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_contents', filter }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_approval_items', filter }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_content_tags', filter }, later)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_content_comments', filter }, later)
      .subscribe()
    return () => {
      window.clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [team, load])

  const replace = (c: Content) => setData((d) => (d ? { ...d, contents: d.contents.map((x) => (x.id === c.id ? c : x)) } : d))

  const move = async (id: string, day: string | null) => {
    const c = data?.contents.find((x) => x.id === id)
    if (!c || c.editorialDate === (day ?? undefined)) return
    const before = c
    replace({ ...c, editorialDate: day ?? undefined, scheduledTime: day ? c.scheduledTime : undefined })
    try {
      replace(await scheduleContent(c, day, day ? (c.scheduledTime ?? null) : null, c.channel ?? null))
    } catch (e) {
      replace(before)
      toast.error(e instanceof Error ? e.message : 'Não consegui mudar o dia.')
    }
  }

  const visible = useMemo(() => {
    const list = data?.contents ?? []
    return list.filter((c) => (!stageFilter || stageOf(c) === stageFilter) && (!channelFilter || c.channel === channelFilter) && (!tagFilter || (tagFilter === 'sem' ? !c.tagIds?.length : c.tagIds?.includes(tagFilter))))
  }, [data, stageFilter, channelFilter, tagFilter])

  const byDay = useMemo(() => {
    const map = new Map<string, Content[]>()
    for (const c of visible) if (c.editorialDate) map.set(c.editorialDate, [...(map.get(c.editorialDate) ?? []), c])
    for (const list of map.values()) list.sort(byTime)
    return map
  }, [visible])

  const ideas = visible.filter((c) => c.status === 'ideia').sort((a, b) => b.createdAt - a.createdAt)
  const unscheduled = visible.filter((c) => !c.editorialDate && c.status !== 'ideia')
  const weeks = view === 'mes' ? monthGrid(anchor) : [weekDays(anchor)]
  const range = view === 'mes' ? { from: `${anchor.slice(0, 7)}-01`, to: weeks[weeks.length - 1].filter((d) => sameMonth(d, anchor)).pop()! } : { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) }

  const stageCounts = useMemo(() => {
    const out = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>
    for (const c of data?.contents ?? []) out[stageOf(c)] += 1
    return out
  }, [data])

  const step = (dir: number) => {
    if (view === 'semana') return setParam({ dia: addDays(anchor, dir * 7) })
    const d = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1 + dir, 1, 12)
    setParam({ dia: isoOf(d) })
  }

  const openLinks = async () => {
    if (!team) return
    setLinksOpen(true)
    setLinks(null)
    try {
      setLinks(await listApprovalLinks(team.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui ler os envios.')
      setLinks([])
    }
  }

  const revoke = async (id: string) => {
    try {
      await revokeApprovalLink(id)
      setLinks((l) => (l ?? []).map((x) => (x.id === id ? { ...x, revokedAt: Date.now() } : x)))
      toast.success('Link revogado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui revogar.')
    }
  }

  const quickApprove = async (c: Content) => {
    setQuick(c.id)
    try {
      replace(await transitionContent(c.id, c.version, 'producao'))
      toast.success('Ideia aprovada: agora é conteúdo.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui aprovar.')
    } finally {
      setQuick(undefined)
    }
  }

  const quickDiscard = async (c: Content) => {
    setQuick(c.id)
    try {
      await deleteContent(c.id)
      setData((d) => (d ? { ...d, contents: d.contents.filter((x) => x.id !== c.id) } : d))
      toast.success('Ideia descartada.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui descartar.')
    } finally {
      setQuick(undefined)
    }
  }

  // O que a Iara vê e pode fazer nesta tela
  useIaraScreen(
    team && data
      ? {
          id: 'pauta',
          title: `Pauta · ${view === 'mes' ? monthTitle(anchor) : rangeLabel(range.from, range.to)}`,
          selection: () => {
            const c = openId ? data.contents.find((x) => x.id === openId) : undefined
            return c ? `Peça: ${c.title}` : ''
          },
          describe: () =>
            [
              `Visão: ${view === 'mes' ? 'mês' : 'semana'} de ${range.from} a ${range.to}.`,
              stageFilter ? `Filtro de etapa: ${STAGE_LABEL[stageFilter]}.` : '',
              channelFilter ? `Filtro de canal: ${channelFilter}.` : '',
              data.tags.length ? `Tipos de conteúdo da conta: ${data.tags.map((t) => `${t.name} (id ${t.id})`).join(', ')}.` : 'A conta ainda não tem tipos de conteúdo.',
              tagFilter ? `Filtro de tipo: ${tagFilter === 'sem' ? 'sem tipo' : (data.tags.find((t) => t.id === tagFilter)?.name ?? tagFilter)}.` : '',
              openId ? `Peça aberta no painel (é "esta peça", "isto"): id ${openId}${data.contents.find((c) => c.id === openId) ? `, "${data.contents.find((c) => c.id === openId)!.title}", etapa ${STAGE_LABEL[stageOf(data.contents.find((c) => c.id === openId)!)]}` : ''}. Para mudar o texto, a data ou a etapa dela use o id.` : '',
              `Ideias esperando aprovação: ${ideas.length}. Sem data: ${unscheduled.length}.`,
            ]
              .filter(Boolean)
              .join('\n'),
          actions: [
            {
              name: 'abrir_peca',
              doc: '{"id":ID} — abre o painel de uma peça na Pauta.',
              run: async (a) => {
                setParam({ peca: String(a.id) })
                return { label: 'Abri a peça.', ok: true }
              },
            },
            {
              name: 'mostrar',
              doc: '{"dia"?:"AAAA-MM-DD","visao"?:"mes"|"semana","etapa"?:ETAPA|"","canal"?:CANAL|"","tipo"?:ID_DO_TIPO|"sem"|""} — muda o que a Pauta mostra (mês, semana, filtros). ETAPA = ideia|producao|gestor|pronto|cliente|ajuste|aprovado.',
              run: async (a) => {
                const patch: Record<string, string | undefined> = {}
                if (typeof a.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dia)) patch.dia = a.dia
                if (a.visao === 'semana' || a.visao === 'mes') patch.visao = a.visao === 'semana' ? 'semana' : undefined
                if (typeof a.etapa === 'string') patch.etapa = (STAGES as string[]).includes(a.etapa) ? a.etapa : undefined
                if (typeof a.canal === 'string') patch.canal = a.canal || undefined
                if (typeof a.tipo === 'string') patch.tipo = a.tipo || undefined
                setParam(patch)
                return { label: 'Mudei a visão da Pauta.', ok: true }
              },
            },
            {
              name: 'enviar_cliente',
              doc: '{"ids"?:[ID],"titulo"?:string} — abre o envio ao cliente com essas peças marcadas (só as aprovadas pelo gestor entram). A pessoa confere e gera o link.',
              run: async (a) => {
                if (!manager) return { label: 'Só dono e gestor enviam ao cliente.', ok: false }
                setSending({ ids: Array.isArray(a.ids) ? (a.ids as string[]) : undefined, title: typeof a.titulo === 'string' ? a.titulo : undefined })
                return { label: 'Abri o envio ao cliente para você conferir.', ok: true }
              },
            },
          ],
        }
      : null
  )

  if (teamStatus === 'ready' && !team) {
    return (
      <Page>
        <PageHeader title="Pauta" text="A pauta é de uma conta de empresa. Peça um convite em Equipe." />
      </Page>
    )
  }

  const opened = openId ? data?.contents.find((c) => c.id === openId) : undefined
  const titles = Object.fromEntries((data?.contents ?? []).map((c) => [c.id, c.title]))
  const todayIso = today()
  const pendingClient = stageCounts.cliente
  const fixes = stageCounts.ajuste

  return (
    <Page wide>
      <AreaTabs area="pauta" />
      <PageHeader title="Pauta" text={`O calendário de ${team?.name ?? 'a empresa'}: o que sai, quando e onde, e quem já aprovou.`}>
        <Button variant="outline" size="sm" onClick={() => void openLinks()}>
          <Link2 className="mr-1.5 h-4 w-4" aria-hidden /> Envios
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/conteudos?novo=1">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Novo conteúdo
          </Link>
        </Button>
        {manager && (
          <Button size="sm" onClick={() => setSending({})} disabled={state !== 'ready'}>
            <Send className="mr-1.5 h-4 w-4" aria-hidden /> Enviar ao cliente
          </Button>
        )}
      </PageHeader>

      {state === 'loading' && (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo a pauta
        </p>
      )}
      {state === 'error' && (
        <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> {error ?? 'Não consegui ler a pauta.'}
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {state === 'ready' && data && (
        <>
          {(pendingClient > 0 || fixes > 0) && (
            <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {pendingClient > 0 && (
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => setParam({ etapa: 'cliente' })}>
                  <strong className="font-semibold text-amber-900">{pendingClient}</strong> com o cliente
                </button>
              )}
              {fixes > 0 && (
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => setParam({ etapa: 'ajuste' })}>
                  <strong className="font-semibold text-red-700">{fixes}</strong> com ajuste pedido
                </button>
              )}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
                <button type="button" aria-label={view === 'mes' ? 'Mês anterior' : 'Semana anterior'} onClick={() => step(-1)} className="flex h-8 w-8 items-center justify-center text-gray-600 hover:text-gray-900">
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => setParam({ dia: undefined })} className="h-8 border-x border-gray-200 px-3 text-xs font-medium text-gray-700 hover:text-gray-900">
                  Hoje
                </button>
                <button type="button" aria-label={view === 'mes' ? 'Próximo mês' : 'Próxima semana'} onClick={() => step(1)} className="flex h-8 w-8 items-center justify-center text-gray-600 hover:text-gray-900">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <h2 className="text-base font-semibold capitalize text-gray-900" aria-live="polite">
                {view === 'mes' ? monthTitle(anchor) : rangeLabel(range.from, range.to)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Etapa" value={stageFilter} onChange={(e) => setParam({ etapa: e.target.value || undefined })} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')}>
                <option value="">Todas as etapas</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]} ({stageCounts[s]})
                  </option>
                ))}
              </select>
              <select aria-label="Canal" value={channelFilter} onChange={(e) => setParam({ canal: e.target.value || undefined })} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')}>
                <option value="">Todos os canais</option>
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {data.tags.length > 0 && (
                <select aria-label="Tipo de conteúdo" value={tagFilter} onChange={(e) => setParam({ tipo: e.target.value || undefined })} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')}>
                  <option value="">Todos os tipos</option>
                  {data.tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value="sem">Sem tipo</option>
                </select>
              )}
              <div role="radiogroup" aria-label="Visão" className="inline-flex rounded-lg bg-gray-100 p-0.5">
                {([['mes', 'Mês'], ['semana', 'Semana']] as const).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={view === id} onClick={() => setParam({ visao: id === 'mes' ? undefined : id })} className={cn('h-7 rounded-md px-3 text-xs font-medium', view === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <div className="grid min-w-[760px] grid-cols-7 border-b border-gray-200 bg-gray-50 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {(view === 'semana' ? weeks[0] : WEEK).map((d, i) => (
                  <div key={d} className={cn('px-2 py-1.5', i > 0 && 'border-l border-gray-200')}>
                    {view === 'semana' ? (
                      <span className={cn(d === todayIso && 'text-violet-700')}>
                        {WEEK[i]} <span className="tabular-nums">{Number(d.slice(8))}</span>
                      </span>
                    ) : (
                      d
                    )}
                  </div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className={cn('grid min-w-[760px] grid-cols-7', wi > 0 && 'border-t border-gray-200')}>
                  {week.map((day, di) => {
                    const items = byDay.get(day) ?? []
                    const out = view === 'mes' && !sameMonth(day, anchor)
                    const max = view === 'mes' ? 3 : 50
                    return (
                      <DayCell key={day} day={day} onDrop={(id, d) => void move(id, d)} label={day} className={cn('flex flex-col gap-1 p-1.5', di > 0 && 'border-l border-gray-200', view === 'mes' ? 'min-h-[118px]' : 'min-h-[420px]', out && 'bg-gray-50/70')}>
                        {view === 'mes' && (
                          <span className={cn('mb-0.5 inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px] tabular-nums', day === todayIso ? 'bg-violet-600 font-semibold text-white' : out ? 'text-gray-400' : 'text-gray-600')}>{Number(day.slice(8))}</span>
                        )}
                        {items.slice(0, max).map((c) => (
                          <PautaCard key={c.id} c={c} tags={data.tags} cover={covers[c.id]} open={data.open[c.id] ?? 0} compact={view === 'mes'} selected={openId === c.id} onOpen={() => setParam({ peca: c.id })} />
                        ))}
                        {items.length > max && (
                          <button type="button" onClick={() => setParam({ visao: 'semana', dia: day })} className="self-start px-1 text-[11px] font-medium text-gray-600 hover:text-gray-900">
                            +{items.length - max} mais
                          </button>
                        )}
                      </DayCell>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="grid content-start gap-4">
            <section aria-label="Ideias para aprovar" className="rounded-xl border border-gray-200 bg-white p-2.5">
              <h3 className="flex items-center justify-between px-0.5 text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Ideias
                </span>
                <span className="tabular-nums text-gray-500">{ideas.length}</span>
              </h3>
              <button type="button" onClick={() => askIara('Me dá 6 ideias novas de conteúdo para as próximas semanas, já com data sugerida.')} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-300 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Gerar ideias com a Iara
              </button>
              <ul className="mt-2 grid max-h-[340px] gap-1.5 overflow-y-auto">
                {ideas.map((c) => (
                  <li key={c.id} className="rounded-md border border-gray-200 p-2">
                    <button type="button" onClick={() => setParam({ peca: c.id })} className="block w-full text-left">
                      <span className="line-clamp-2 text-xs font-medium text-gray-900">{c.title}</span>
                      {c.idea && <span className="mt-0.5 line-clamp-2 block text-[11px] text-gray-500">{c.idea}</span>}
                    </button>
                    {manager && (
                      <div className="mt-1.5 flex gap-1">
                        <button type="button" disabled={quick === c.id} onClick={() => void quickApprove(c)} className="inline-flex h-6 items-center gap-1 rounded-md bg-gray-900 px-2 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-50">
                          {quick === c.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />} Aprovar
                        </button>
                        <button type="button" disabled={quick === c.id} onClick={() => void quickDiscard(c)} aria-label={`Descartar ${c.title}`} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50">
                          <X className="h-3 w-3" aria-hidden /> Descartar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {ideas.length === 0 && <li className="px-0.5 py-1 text-[11px] text-gray-400">Nenhuma ideia esperando.</li>}
              </ul>
            </section>
            <DayCell day="" onDrop={(id) => void move(id, null)} label="Sem data" className="self-start rounded-xl border border-dashed border-gray-300 bg-white p-2.5">
              <h3 className="flex items-center justify-between px-0.5 text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5" aria-hidden /> Sem data
                </span>
                <span className="tabular-nums text-gray-500">{unscheduled.length}</span>
              </h3>
              <p className="mt-1 px-0.5 text-[11px] text-gray-500">Arraste para um dia do calendário.</p>
              <div className="mt-2 grid max-h-[560px] gap-1.5 overflow-y-auto">
                {unscheduled.map((c) => (
                  <PautaCard key={c.id} c={c} tags={data.tags} cover={covers[c.id]} open={data.open[c.id] ?? 0} selected={openId === c.id} onOpen={() => setParam({ peca: c.id })} />
                ))}
                {unscheduled.length === 0 && <p className="px-0.5 py-2 text-[11px] text-gray-400">Tudo com data.</p>}
              </div>
            </DayCell>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-500" aria-label="Legenda">
            {STAGES.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-[3px] rounded-full', STAGE_TONE[s].bar)} aria-hidden /> {STAGE_LABEL[s]}
              </li>
            ))}
            {data.tags.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setParam({ tipo: tagFilter === t.id ? undefined : t.id })} aria-pressed={tagFilter === t.id} className={cn('flex items-center gap-1.5 rounded-full px-1 hover:text-gray-900', tagFilter === t.id && 'font-semibold text-gray-900')}>
                  <span className={cn('h-2 w-2 rounded-full', tagTone(t.color).dot)} aria-hidden /> {t.name}
                </button>
              </li>
            ))}
          </ul>
          {data.contents.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              Nenhum conteúdo ainda. Antes, confira se o <Link to="/cerebro" className="font-medium underline underline-offset-2">Cérebro</Link> e o <Link to="/plano" className="font-medium underline underline-offset-2">Plano</Link> dizem quem é a empresa: as ideias da IA saem deles. Depois, <Link to="/conteudos?novo=1" className="font-medium underline underline-offset-2">crie o primeiro conteúdo</Link> ou peça à Iara as ideias do mês.
            </p>
          )}
        </>
      )}

      {opened && data && (
        <PautaPanel
          key={opened.id}
          content={opened}
          creative={data.creatives[opened.id]}
          cover={covers[opened.id]}
          sent={data.sent[opened.id]}
          me={me}
          manager={manager}
          onClose={() => setParam({ peca: undefined })}
          onChanged={replace}
          onDeleted={(id) => {
            setData((d) => (d ? { ...d, contents: d.contents.filter((x) => x.id !== id) } : d))
            setParam({ peca: undefined })
          }}
          onSend={(id) => setSending({ ids: [id], title: opened.title })}
          tags={data.tags}
          onTagsChanged={(tags) => setData((d) => (d ? { ...d, tags } : d))}
        />
      )}

      {team && data && <SendDialog open={!!sending} preselect={sending ? sending.ids : undefined} presetTitle={sending ? sending.title : undefined} teamId={team.id} contents={data.contents} creatives={data.creatives} range={range} onClose={() => setSending(false)} onSent={() => void load(true)} />}
      <LinksDialog open={linksOpen} links={links} titles={titles} manager={manager} onClose={() => setLinksOpen(false)} onRevoke={(id) => void revoke(id)} />
    </Page>
  )
}

export default Pauta

