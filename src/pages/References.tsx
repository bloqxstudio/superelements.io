import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bookmark, Check, Copy, Download, ExternalLink, Heart, MessageCircle, Play, ImagePlus, Lightbulb, Loader2, MessagesSquare, Pencil, Plus, RefreshCw, Search, Sparkles, Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { FIELD, Page, PageHeader } from '@/features/crm/ui'
import { createContent } from '@/features/conteudos/api'
import { ImportDialog } from '@/features/referencias/ImportDialog'
import { RecreateDialog } from '@/features/referencias/RecreateDialog'
import { useReferencesIara } from '@/features/referencias/referenciasIara'
import { byRecent, createReference, createSource, deleteReference, deleteSource, listReferences, listSources, referenceShotUrl, updateReference, updateSource, uploadReferenceShot, type Reference, type ReferenceSource } from '@/features/referencias/api'
import { KIND_LABEL, PLATFORM_LABEL, contentFormatOf, parseRefUrl, parseTags, threadUrlOf, type RefKind } from '@/features/referencias/rules'
import { cn } from '@/lib/utils'
import { iaraEnabled } from '@/features/mcp/connect'
import { useAiSelection } from '@/features/mcp/aiContext'

/**
 * /referencias — as melhores referências visuais da conta (2026-11-09; o usuário: "uma aba pra referências,
 * pra mandar links de vídeos do Instagram e salvar como referência visual… salvar as melhores e enviar pra
 * ideias / produção de criativos"). Cada referência guarda o link, o tipo, por que é boa e, se a pessoa
 * subir, uma captura (no Cérebro da conta). O post aparece pelo embed oficial da rede (nada é baixado do
 * Instagram). Daqui ela vira ideia na Pauta ou pedido de criativo para a Iara; as que têm estrela vão no
 * contexto do Cérebro para toda criação.
 */

const KINDS = Object.keys(KIND_LABEL) as RefKind[]
/** 646000 → "646 mil", 1200000 → "1,2 mi". */
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : n >= 1e4 ? `${Math.round(n / 1e3)} mil` : n.toLocaleString('pt-BR'))

interface FormState { id?: string; url: string; kind: RefKind; title: string; notes: string; tags: string; starred: boolean; mediaPath?: string; file?: File }
const EMPTY: FormState = { url: '', kind: 'estatico', title: '', notes: '', tags: '', starred: false }

const Shot: React.FC<{ teamId: string; path: string; className?: string }> = ({ teamId, path, className }) => {
  const [url, setUrl] = useState<string>()
  useEffect(() => { void referenceShotUrl(teamId, path).then(setUrl, () => undefined) }, [teamId, path])
  return url ? <img src={url} alt="" loading="lazy" className={cn('h-full w-full object-cover', className)} /> : <div className="h-full w-full animate-pulse bg-gray-100" />
}

/**
 * O que vai para a IA conectada (MCP): o id e o título, com a ferramenta que abre a referência inteira
 * (capa, quadros, notas, números). A pessoa cola no chat do ChatGPT, do Claude ou do Cursor (2026-11-12).
 */
const referenceForAi = (r: Reference) =>
  `Use a referência da Sinfy ref_${r.id}${r.title ? ` ("${r.title}")` : ''}${r.author ? ` de @${r.author}` : ''}: abra com sinfy_referencia_ver (id ref_${r.id}) para ver a capa, os quadros e as notas.`

const copyForAi = (r: Reference) =>
  navigator.clipboard.writeText(referenceForAi(r)).then(
    () => toast.success('Referência copiada', { description: 'Cole no chat da sua IA conectada (ChatGPT, Claude ou Cursor).' }),
    () => toast.error('Não consegui copiar'),
  )

const Card: React.FC<{ r: Reference; teamId: string; onEdit: () => void; onChange: (r: Reference) => void; onDelete: () => void; selected?: boolean; onSelect?: () => void }> = ({ r, teamId, onEdit, onChange, onDelete, selected, onSelect }) => {
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const [embed, setEmbed] = useState(false)
  const [busy, setBusy] = useState<string>()
  const parsed = useMemo(() => parseRefUrl(r.url), [r.url])
  const tall = r.kind === 'reels' || r.kind === 'story' || r.kind === 'video' || r.kind === 'motion'

  const star = async () => {
    try { onChange(await updateReference(r.id, { starred: !r.starred })) } catch (e) { toast.error(e instanceof Error ? e.message : 'Não salvou.') }
  }
  const toIdea = async () => {
    if (!team) return
    setBusy('ideia')
    try {
      const c = await createContent(team.id, {
        title: (r.title || `Ideia na linha de uma referência (${KIND_LABEL[r.kind].toLowerCase()})`).slice(0, 160),
        idea: [r.notes, `Referência: ${r.url}`].filter(Boolean).join('\n\n').slice(0, 4000),
        goal: '',
        format: contentFormatOf(r.kind) as Parameters<typeof createContent>[1]['format'],
        script: '',
        editorialDate: null,
      })
      toast.success('Ideia criada na Pauta', { action: { label: 'Abrir', onClick: () => navigate(`/conteudos/${c.id}`) } })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui criar a ideia.')
    } finally {
      setBusy(undefined)
    }
  }
  const [recreating, setRecreating] = useState(false)

  return (
    <article className={cn('flex flex-col overflow-hidden rounded-xl bg-white', selected ? 'shadow-[0_0_0_2px_rgb(124_58_237)]' : 'shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]')}>
      <div className={cn('relative bg-gray-50', tall ? 'aspect-[9/14]' : 'aspect-[4/5]')}>
        {embed && parsed?.embed ? (
          <iframe src={parsed.embed} title={r.title || 'Referência'} loading="lazy" className="h-full w-full border-0 bg-white" allow="encrypted-media; picture-in-picture" />
        ) : r.mediaPath ? (
          <Shot teamId={teamId} path={r.mediaPath} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-gray-500">
            <Bookmark className="h-6 w-6 text-gray-300" aria-hidden />
            {PLATFORM_LABEL[r.platform]}
          </div>
        )}
        {!embed && parsed?.embed && (
          <button type="button" onClick={() => setEmbed(true)} className="absolute inset-x-3 bottom-3 rounded-lg bg-white/95 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-white">
            Ver o post aqui
          </button>
        )}
        {embed && (
          <button type="button" aria-label="Fechar o post" onClick={() => setEmbed(false)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
        )}
        <button type="button" onClick={() => void star()} aria-pressed={r.starred} title={r.starred ? 'Tirar das melhores' : 'Marcar como uma das melhores (vai no contexto da IA)'} className={cn('absolute left-2 top-2 rounded-full p-1.5 shadow', r.starred ? 'bg-amber-400 text-white' : 'bg-white/90 text-gray-500 hover:text-amber-500')}>
          <Star className="h-3.5 w-3.5" fill={r.starred ? 'currentColor' : 'none'} />
        </button>
        {!embed && onSelect && (
          <button type="button" onClick={() => { if (!selected && !iaraEnabled()) void copyForAi(r); onSelect() }} aria-pressed={!!selected} title={selected ? 'Tirar a seleção' : iaraEnabled() ? 'Selecionar para a Iara (recriar ou criar um vídeo pelo chat)' : 'Selecionar e copiar para a sua IA conectada'} className={cn('absolute right-2 top-2 flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold shadow', selected ? 'bg-violet-600 text-white' : 'bg-white/90 text-gray-600 hover:text-violet-700')}>
            <Check className="h-3.5 w-3.5" /> {selected ? 'Selecionada' : 'Selecionar'}
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {r.auto && !r.reviewed && <span className="rounded-full bg-violet-600 px-2 py-0.5 font-semibold text-white">Nova</span>}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">{KIND_LABEL[r.kind]}</span>
          <span className="text-gray-500">{r.author ? `@${r.author}` : PLATFORM_LABEL[r.platform]}</span>
          {r.auto && r.reviewed && <span className="text-gray-400" title="Lida e classificada pelo Mac a partir do grupo">· do grupo</span>}
        </div>
        {r.title && <h3 className="mt-1.5 text-sm font-semibold leading-snug text-gray-900">{r.title}</h3>}
        {r.likes !== undefined && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[11px] tabular-nums text-gray-600" title={r.metricsAt ? `Números do post quando foi lido, em ${new Date(r.metricsAt).toLocaleDateString('pt-BR')}` : undefined}>
            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3 text-rose-500" aria-hidden />{compact(r.likes)}<span className="sr-only"> curtidas</span></span>
            {r.comments !== undefined && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" aria-hidden />{compact(r.comments)}<span className="sr-only"> comentários</span></span>}
            {r.views !== undefined && <span className="inline-flex items-center gap-1"><Play className="h-3 w-3" aria-hidden />{compact(r.views)}<span className="sr-only"> visualizações</span></span>}
          </p>
        )}
        {r.notes && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-gray-600">{r.notes}</p>}
        {r.tags.length > 0 && <p className="mt-1.5 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800">#{t}</span>)}</p>}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!!busy} onClick={() => void toIdea()} title="Cria uma ideia na Pauta com esta referência">
            {busy === 'ideia' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />} Ideia
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setRecreating(true)} title="Recriar como post ou vídeo, com um conteúdo novo ou como está, na marca da conta">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" /> Recriar
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => void copyForAi(r)} title="Copia o id desta referência para colar no chat da sua IA conectada (MCP)">
            <Copy className="h-3.5 w-3.5" /> Para a IA
          </Button>
          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center rounded-md px-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Abrir o link"><ExternalLink className="h-3.5 w-3.5" /></a>
          {r.auto && !r.reviewed && (
            <button type="button" onClick={() => void updateReference(r.id, { reviewed: true }).then(onChange, () => undefined)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900" title="A classificação da IA está boa"><Check className="h-3.5 w-3.5" /> Ok</button>
          )}
          <button type="button" onClick={onEdit} className="inline-flex h-7 items-center rounded-md px-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDelete} className="ml-auto inline-flex h-7 items-center rounded-md px-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700" title="Apagar"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {recreating && <RecreateDialog reference={r} open onClose={() => setRecreating(false)} />}
    </article>
  )
}

const EVERY = [[30, '30 min'], [60, '1 hora'], [180, '3 horas'], [720, '12 horas'], [1440, '1 dia']] as const
const ago = (t?: number) => {
  if (!t) return 'ainda não leu'
  const m = Math.round((Date.now() - t) / 60_000)
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`
}

/**
 * Os grupos do Instagram desta conta (2026-11-09): a equipe manda os posts no grupo e o Mac
 * (`services/referencias`, logado na conta pessoal) lê na rotina ou quando alguém pede "Ver novas agora",
 * classifica com a IA e cria as referências como "Nova".
 */
const Groups: React.FC<{ teamId: string; onRun: () => void; onReview: () => void }> = ({ teamId, onRun, onReview }) => {
  const [list, setList] = useState<ReferenceSource[]>()
  // "Importar do grupo": o fluxo por tela (escolher quantos → acompanhar → revisar as novas)
  const [importing, setImporting] = useState<{ sourceId?: string }>()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const load = useCallback(() => listSources(teamId).then(setList, () => setList([])), [teamId])
  useEffect(() => { void load() }, [load])
  // Enquanto há pedido de leitura sem resposta, confere de tempos em tempos
  const waiting = list?.some((s) => s.runRequestedAt && (!s.lastRunAt || s.runRequestedAt > s.lastRunAt))
  // `onRun` chega como função nova a cada render da tela: pelo ref, o intervalo de 20 s não recomeça a cada
  // render (antes, com ele nas dependências, a conferência quase nunca chegava aos 20 s; revisão de 2026-11-13)
  const runRef = useRef(onRun)
  runRef.current = onRun
  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => { void load(); runRef.current() }, 20_000)
    return () => window.clearInterval(t)
  }, [waiting, load])

  const thread = threadUrlOf(link)
  const add = async () => {
    if (!thread || !name.trim()) return
    try {
      const s = await createSource(teamId, name, thread)
      setList((l) => [...(l ?? []), s])
      setAdding(false); setName(''); setLink('')
      toast.success('Grupo cadastrado: o Mac lê na próxima volta (em até 1 minuto, se estiver ligado).')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não cadastrou.') }
  }
  const patch = async (s: ReferenceSource, p: Parameters<typeof updateSource>[1]) => {
    try { const n = await updateSource(s.id, p); setList((l) => (l ?? []).map((x) => (x.id === n.id ? n : x))); if (p.requestRun) toast.message('Pedido enviado ao Mac: as novas aparecem aqui em alguns minutos.') } catch (e) { toast.error(e instanceof Error ? e.message : 'Não salvou.') }
  }
  const remove = async (s: ReferenceSource) => {
    if (!window.confirm(`Parar de ler o grupo "${s.name}"? As referências que já vieram dele ficam.`)) return
    try { await deleteSource(s.id); setList((l) => (l ?? []).filter((x) => x.id !== s.id)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Não tirou.') }
  }

  return (
    <section className="mt-5 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" aria-labelledby="grupos-ig">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="grupos-ig" className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MessagesSquare className="h-4 w-4 text-fuchsia-600" /> Grupos do Instagram</h2>
          <p className="mt-0.5 text-xs text-gray-500">Mande os posts no grupo do cliente: o Mac da equipe abre cada um, guarda a capa e os quadros, a IA classifica e a referência aparece aqui como Nova.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!adding && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Grupo</Button>}
          {!!list?.some((s) => s.enabled) && <Button size="sm" className="gap-1.5" onClick={() => setImporting({})}><Download className="h-4 w-4" /> Importar do grupo</Button>}
        </div>
      </div>
      {list && importing && (
        <ImportDialog sources={list} teamId={teamId} open initialSourceId={importing.sourceId}
          onClose={() => { setImporting(undefined); void load(); onRun() }}
          onProgress={onRun}
          onReview={() => { setImporting(undefined); void load(); onRun(); onReview() }} />
      )}
      {adding && (
        <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); void add() }}>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Refs Vizor)" className={cn(FIELD, 'h-9')} />
          <div>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link do grupo: instagram.com/direct/t/…" className={cn(FIELD, 'h-9')} />
            <span className="mt-1 block text-[11px] text-gray-500">{link && !thread ? 'Abra o grupo no instagram.com (no computador) e copie o endereço da barra.' : 'No computador, abra o grupo em instagram.com e copie o endereço da barra.'}</span>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-9" disabled={!thread || !name.trim()}>Cadastrar</Button>
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </form>
      )}
      {list && list.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {list.map((s) => {
            const pending = !!s.runRequestedAt && (!s.lastRunAt || s.runRequestedAt > s.lastRunAt)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                <span className="font-medium text-gray-900">{s.name}</span>
                <span className={cn('text-gray-500', s.lastError && 'text-red-700')}>
                  {s.lastError ? s.lastError : pending ? (s.runStage === 'importando' && s.runTotal ? `Importando ${s.runDone ?? 0} de ${s.runTotal}…` : s.runStage === 'lendo' ? 'Lendo o grupo…' : 'Esperando o Mac ler…') : `Lido ${ago(s.lastRunAt)}${s.lastFound !== undefined && s.lastRunAt ? ` · ${s.lastFound} nova${s.lastFound === 1 ? '' : 's'}` : ''}`}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-gray-600">
                    Rotina
                    <select value={s.everyMinutes} onChange={(e) => void patch(s, { everyMinutes: Number(e.target.value) })} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs">
                      {EVERY.map(([v, l]) => <option key={v} value={v}>a cada {l}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-gray-600"><input type="checkbox" checked={s.enabled} onChange={(e) => void patch(s, { enabled: e.target.checked })} className="h-3.5 w-3.5" /> Ligado</label>
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!s.enabled} onClick={() => setImporting({ sourceId: s.id })}>
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {pending ? 'Ver andamento' : 'Importar'}
                  </Button>
                  <a href={s.threadUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-900" title="Abrir o grupo"><ExternalLink className="h-3.5 w-3.5" /></a>
                  <button type="button" onClick={() => void remove(s)} className="text-gray-400 hover:text-red-700" title="Parar de ler este grupo"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const References: React.FC = () => {
  const team = useCrm((s) => s.team)
  const teamStatus = useCrm((s) => s.status)
  const [items, setItems] = useState<Reference[]>()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'novas' | 'melhores' | RefKind>('todas')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recentes' | 'engajamento'>('recentes')
  const fileRef = useRef<HTMLInputElement>(null)
  // A referência selecionada vai para o chat da Iara (2026-11-10)
  const [selectedId, setSelectedId] = useState<string>()

  const load = useCallback(async () => {
    if (!team) return
    try { setItems(await listReferences(team.id)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Não consegui abrir as referências.'); setItems([]) }
  }, [team])
  useEffect(() => { void load() }, [load])

  const parsed = form ? parseRefUrl(form.url) : undefined
  const setUrl = (url: string) => setForm((f) => {
    const next = { ...(f ?? EMPTY), url }
    const p = parseRefUrl(url)
    // O tipo sugerido pelo link, só enquanto a pessoa não escolheu outro
    if (p?.kind && (!f || f.kind === (parseRefUrl(f.url)?.kind ?? 'estatico'))) next.kind = p.kind
    return next
  })

  const save = async () => {
    if (!team || !form || !parsed) return
    setSaving(true)
    try {
      let mediaPath = form.mediaPath
      if (form.file) mediaPath = await uploadReferenceShot(team.id, form.file)
      const draft = { url: parsed.url, platform: parsed.platform, kind: form.kind, title: form.title, notes: form.notes, tags: parseTags(form.tags), starred: form.starred, mediaPath: mediaPath ?? null }
      const saved = form.id ? await updateReference(form.id, draft) : await createReference(team.id, draft)
      setItems((list) => [saved, ...(list ?? []).filter((r) => r.id !== saved.id)].sort(byRecent))
      setForm(null)
      toast.success(form.id ? 'Referência atualizada' : 'Referência salva')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: Reference) => {
    if (!window.confirm('Apagar esta referência? A captura continua no Cérebro.')) return
    try { await deleteReference(r.id); setItems((list) => (list ?? []).filter((x) => x.id !== r.id)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou.') }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((r) => (filter === 'todas' ? true : filter === 'novas' ? r.auto && !r.reviewed : filter === 'melhores' ? r.starred : r.kind === filter))
      .filter((r) => !q || [r.title, r.notes, r.url, r.author ?? '', ...r.tags].join(' ').toLowerCase().includes(q))
      .sort(sort === 'engajamento' ? (a, b) => ((b.likes ?? -1) + (b.comments ?? 0)) - ((a.likes ?? -1) + (a.comments ?? 0)) : byRecent)
  }, [items, filter, query, sort])

  const selected = items?.find((r) => r.id === selectedId)
  useReferencesIara(items, selected, setSelectedId)
  // O "Para a IA" global (Alt+I) leva a referência escolhida
  useAiSelection('referencia', selected ? referenceForAi(selected) : undefined)

  if (teamStatus === 'ready' && !team) {
    return <Page><PageHeader title="Referências" text="As referências são de uma conta de empresa. Peça um convite em Equipe." /></Page>
  }

  return (
    <Page wide>
      <PageHeader title="Referências" text={`As melhores referências visuais de ${team?.name ?? 'a empresa'}: posts, carrosséis, vídeos e motion. Viram ideia na Pauta ou pedido de criativo, e as marcadas com estrela vão no contexto da IA.`}>
        <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> Nova referência</Button>
      </PageHeader>

      {form && (
        <form className="mt-5 grid gap-3 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-gray-800">Link da postagem</span>
            <input autoFocus value={form.url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link do Instagram, TikTok, YouTube, Pinterest, Behance ou de um site" className={cn(FIELD, 'h-9')} />
            {form.url && !parsed && <span className="mt-1 block text-xs text-red-700">Isso não parece um link.</span>}
            {parsed && <span className="mt-1 block text-xs text-gray-500">{PLATFORM_LABEL[parsed.platform]}{parsed.embed ? ' · dá para ver o post aqui' : ' · sem prévia; suba uma captura se quiser ver aqui'}</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Tipo</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as RefKind })} className={cn(FIELD, 'h-9')}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Nome <span className="font-normal text-gray-500">(opcional)</span></span>
            <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: capa com número grande" className={cn(FIELD, 'h-9')} />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-gray-800">O que aproveitar dela</span>
            <textarea rows={2} value={form.notes} maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: gancho no primeiro segundo, legenda animada palavra por palavra, cores contrastadas." className={cn(FIELD, 'py-2')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Etiquetas <span className="font-normal text-gray-500">(separe por vírgula)</span></span>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="gancho, tipografia, depoimento" className={cn(FIELD, 'h-9')} />
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium text-gray-800">Captura <span className="font-normal text-gray-500">(opcional; fica no Cérebro)</span></span>
            <input ref={fileRef} type="file" accept="image/*,video/mp4" className="hidden" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })} />
            <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> {form.file ? form.file.name.slice(0, 28) : form.mediaPath ? 'Trocar a captura' : 'Subir uma captura'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.starred} onChange={(e) => setForm({ ...form, starred: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              Uma das melhores <span className="text-xs text-gray-500">(vai no contexto da IA)</span>
            </label>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              <Button type="submit" disabled={!parsed || saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{form.id ? 'Salvar' : 'Salvar referência'}</Button>
            </div>
          </div>
        </form>
      )}

      {team && <Groups teamId={team.id} onRun={() => window.setTimeout(() => void load(), 1500)} onReview={() => { setFilter('novas'); setSort('recentes') }} />}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(['todas', 'novas', 'melhores', ...KINDS] as const).map((f) => {
          const n = f === 'todas' ? items?.length : f === 'novas' ? items?.filter((r) => r.auto && !r.reviewed).length : f === 'melhores' ? items?.filter((r) => r.starred).length : items?.filter((r) => r.kind === f).length
          if (f !== 'todas' && f !== 'melhores' && !n) return null
          return (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn('h-8 rounded-full border px-3 text-xs font-medium', filter === f ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>
              {f === 'todas' ? 'Todas' : f === 'novas' ? 'Novas do grupo' : f === 'melhores' ? '★ Melhores' : KIND_LABEL[f]} {n !== undefined && <span className="tabular-nums opacity-70">{n}</span>}
            </button>
          )
        })}
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordem" className="ml-auto h-8 rounded-full border border-gray-200 bg-white px-3 text-xs">
          <option value="recentes">Mais recentes no grupo</option>
          <option value="engajamento">Mais engajamento</option>
        </select>
        <label className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3">
          <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar nas referências" className="w-36 bg-transparent text-xs outline-none" />
        </label>
      </div>

      {!items ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo as referências</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">Nenhuma referência ainda</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">Cole o link de um post, Reels ou vídeo que é a cara do que a empresa quer. Marque as melhores com estrela: elas vão junto quando a IA criar. Para o contexto geral da empresa, use o <Link to="/cerebro" className="underline">Cérebro</Link>.</p>
          <Button className="mt-4" size="sm" onClick={() => setForm({ ...EMPTY })}><Plus className="mr-1.5 h-4 w-4" /> Salvar a primeira</Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Nenhuma referência neste filtro.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((r) => (
            <Card key={r.id} r={r} teamId={team!.id}
              onEdit={() => setForm({ id: r.id, url: r.url, kind: r.kind, title: r.title, notes: r.notes, tags: r.tags.join(', '), starred: r.starred, mediaPath: r.mediaPath })}
              onChange={(next) => setItems((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)))}
              onDelete={() => void remove(r)}
              selected={selectedId === r.id} onSelect={() => setSelectedId((cur) => (cur === r.id ? undefined : r.id))} />
          ))}
        </div>
      )}
    </Page>
  )
}

export default References
