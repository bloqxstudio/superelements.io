import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, History, Info, Loader2, Plus, ScanSearch, Sparkles, Square, Trash2, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useCreativeLink } from '@/features/criativos/link'
import { useIa } from '@/features/ia/porTarefa'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import { CHAT_AGENTS } from '@/features/space/chat/protocol'
import { cn } from '@/lib/utils'
import { compact, loadMedia, type IgAccount, type IgMedia } from './instagram'
import { AI_AREA_LABEL, deleteAnalysis, loadAnalyses, readWithAi, saveAnalysis, type AiArea, type SavedAnalysis } from './profileAnalysis'
import { HIGHLIGHT_MAX, auditProfile, scoreLabel, type Finding, type Level, type Pillar } from './profileAudit'
import { nameOf, useTeamPeople } from './people'
import { FIELD, Surface, dayLabel } from './ui'

/**
 * CRM › Instagram › Análise (`?aba=analise`): o perfil conectado como quem chega
 * pela primeira vez o vê, com a nota de cada parte e o que fazer. As checagens
 * rodam na hora sobre o que já foi sincronizado (`profileAudit.ts`); "Analisar
 * com IA" junta a leitura da IA desta máquina, que vê a foto e o grid, e salva a
 * análise no histórico. Os destaques são escritos pela pessoa: a API da Meta não
 * os entrega.
 */

const LEVEL: Record<Level, { icon: React.ElementType; tone: string; label: string }> = {
  critico: { icon: XCircle, tone: 'text-rose-600', label: 'Crítico' },
  atencao: { icon: AlertTriangle, tone: 'text-amber-600', label: 'Atenção' },
  ok: { icon: CheckCircle2, tone: 'text-emerald-600', label: 'Bom' },
  info: { icon: Info, tone: 'text-gray-400', label: 'Informação' },
}
const ORDER: Record<Level, number> = { critico: 0, atencao: 1, info: 2, ok: 3 }

const toneOf = (score: number | null) => (score === null ? 'text-gray-300' : score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-lime-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500')
const barOf = (score: number | null) => (score === null ? 'bg-gray-200' : score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-lime-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500')

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado'),
    () => toast.error('Não deu para copiar.')
  )

// ---------- peças ----------

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 112 }) => {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-gray-100" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke="currentColor" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className={cn('transition-[stroke-dashoffset] duration-700', toneOf(score))} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-gray-900">{score}</span>
        <span className="text-[11px] text-gray-500">de 100</span>
      </div>
    </div>
  )
}

const Photo: React.FC<{ account: IgAccount; className?: string }> = ({ account, className }) => {
  const [broken, setBroken] = useState(false)
  return account.picture && !broken ? (
    <img src={account.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn('rounded-full object-cover', className)} />
  ) : (
    <span className={cn('flex items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white', className)} aria-hidden>
      {account.username.charAt(0).toUpperCase()}
    </span>
  )
}

const Thumb: React.FC<{ media: IgMedia }> = ({ media }) => {
  const [broken, setBroken] = useState(false)
  const src = media.thumbnail ?? media.mediaUrl
  return (
    <a href={media.permalink} target="_blank" rel="noreferrer" className="block aspect-[4/5] overflow-hidden bg-gray-100">
      {src && !broken && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />}
    </a>
  )
}

/** O topo do perfil como o Instagram mostra, com os destaques editáveis. */
const ProfileCard: React.FC<{ account: IgAccount; media: IgMedia[]; highlights: string[] | null; onHighlights: (h: string[] | null) => void }> = ({ account, media, highlights, onHighlights }) => {
  const [draft, setDraft] = useState('')
  const add = () => {
    const name = draft.trim()
    if (!name) return
    onHighlights([...(highlights ?? []), name].slice(0, 20))
    setDraft('')
  }
  const grid = media.filter((m) => m.product !== 'STORY').slice(0, 9)
  return (
    <Surface className="p-0 md:p-0">
      <div className="p-4">
        <div className="flex items-center gap-4">
          <Photo account={account} className="h-20 w-20 shrink-0 ring-1 ring-black/5" />
          <div className="grid flex-1 grid-cols-3 text-center">
            {(
              [
                [account.mediaCount, 'posts'],
                [account.followers, 'seguidores'],
                [account.follows, 'seguindo'],
              ] as [number | undefined, string][]
            ).map(([n, label]) => (
              <div key={label}>
                <p className="text-base font-semibold tabular-nums text-gray-900">{compact(n)}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 text-sm">
          {account.name ? <p className="font-semibold text-gray-900">{account.name}</p> : <p className="italic text-gray-400">Sem nome</p>}
          {account.biography ? <p className="whitespace-pre-line text-gray-800">{account.biography}</p> : <p className="italic text-gray-400">Sem bio</p>}
          {account.website && (
            <a href={account.website} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-medium text-sky-800 hover:underline">
              {account.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
          <p className="mt-1 text-xs text-gray-400">{[...(account.biography ?? '')].length} de 150 caracteres na bio</p>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-gray-700">Destaques</p>
            <p className="text-[11px] text-gray-400">a Meta não entrega: escreva como estão</p>
          </div>
          {highlights !== null && highlights.length > 0 && (
            <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
              {highlights.map((h, i) => (
                <li key={`${h}-${i}`} className="group flex w-16 shrink-0 flex-col items-center gap-1">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-sm font-semibold uppercase text-gray-500 ring-1 ring-gray-200">
                    {h.charAt(0)}
                    <button type="button" onClick={() => onHighlights(highlights.filter((_, j) => j !== i))} aria-label={`Tirar ${h}`} className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white group-hover:flex focus-visible:flex">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                  <span className={cn('w-full truncate text-center text-[11px]', [...h].length > HIGHLIGHT_MAX ? 'text-amber-700' : 'text-gray-700')} title={h}>
                    {h}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder="Nome do destaque e Enter"
              maxLength={40}
              className={cn(FIELD, 'h-8 flex-1 text-xs')}
              aria-label="Nome do destaque"
            />
            <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={add} disabled={!draft.trim()} aria-label="Adicionar destaque">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={highlights !== null && highlights.length === 0} onChange={(e) => onHighlights(e.target.checked ? [] : null)} className="h-3.5 w-3.5 rounded border-gray-300" />O perfil não tem destaques
          </label>
        </div>
      </div>
      {grid.length > 0 && (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-b-xl border-t border-gray-100">
          {grid.map((m) => (
            <Thumb key={m.id} media={m} />
          ))}
        </div>
      )}
    </Surface>
  )
}

const FindingRow: React.FC<{ finding: Finding }> = ({ finding }) => {
  const { icon: Icon, tone, label } = LEVEL[finding.level]
  return (
    <li className="flex gap-2.5 py-2.5">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone)} aria-label={label} />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-gray-900">{finding.title}</p>
        {finding.detail && <p className="mt-0.5 text-gray-600">{finding.detail}</p>}
        {finding.action && <p className="mt-1 text-gray-800">→ {finding.action}</p>}
      </div>
    </li>
  )
}

const PillarCard: React.FC<{ pillar: Pillar; note?: string }> = ({ pillar, note }) => {
  const findings = [...pillar.findings].sort((a, b) => ORDER[a.level] - ORDER[b.level])
  return (
    <Surface>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{pillar.label}</h3>
        <span className={cn('text-sm font-semibold tabular-nums', pillar.score === null ? 'text-gray-400' : 'text-gray-900')}>{pillar.score === null ? 'sem nota' : pillar.score}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full transition-[width] duration-700', barOf(pillar.score))} style={{ width: `${pillar.score ?? 0}%` }} />
      </div>
      {note && (
        <p className="mt-3 flex gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-950">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <span>{note}</span>
        </p>
      )}
      <ul className="mt-1 divide-y divide-gray-100">
        {findings.map((f) => (
          <FindingRow key={f.id} finding={f} />
        ))}
      </ul>
    </Surface>
  )
}

/** Qual nota da IA vai junto de cada parte. */
const NOTE_OF: Partial<Record<Pillar['id'], AiArea>> = { bio: 'bio', foto: 'foto', destaques: 'destaques', formatos: 'conteudo', legendas: 'legendas' }

const AiPanel: React.FC<{ analysis: SavedAnalysis }> = ({ analysis }) => {
  const ai = analysis.ai!
  return (
    <Surface className="ring-1 ring-violet-200">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
        <h2 className="text-sm font-semibold text-gray-900">Leitura da IA</h2>
        <span className="ml-auto text-xs text-gray-500">
          {CHAT_AGENTS[ai.engine]?.name ?? ai.engine} · {dayLabel(analysis.createdAt)}
          {ai.images === 0 ? ' · sem imagens' : ''}
        </span>
      </div>
      {ai.summary && <p className="mt-3 text-[15px] leading-relaxed text-gray-900">{ai.summary}</p>}
      {ai.steps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Para esta semana</p>
          <ol className="mt-2 grid gap-2">
            {ai.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-800">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {(ai.bio || ai.name) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ai.name && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Nome sugerido</p>
                <button type="button" onClick={() => void copy(ai.name!)} className="text-gray-400 hover:text-gray-900" aria-label="Copiar nome">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">{ai.name}</p>
            </div>
          )}
          {ai.bio && (
            <div className={cn('rounded-lg bg-gray-50 p-3', !ai.name && 'sm:col-span-2')}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Bio sugerida · {[...ai.bio].length} caracteres</p>
                <button type="button" onClick={() => void copy(ai.bio!)} className="text-gray-400 hover:text-gray-900" aria-label="Copiar bio">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-900">{ai.bio}</p>
            </div>
          )}
        </div>
      )}
      {ai.highlights.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Destaques sugeridos</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-gray-800">
            {ai.highlights.map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        </div>
      )}
      {ai.notes.grid && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{AI_AREA_LABEL.grid}</p>
          <p className="mt-1 text-sm text-gray-800">{ai.notes.grid}</p>
        </div>
      )}
    </Surface>
  )
}

const AiControl: React.FC<{ running: boolean; step: string; onRun: () => void; onStop: () => void }> = ({ running, step, onRun, onStop }) => {
  const connected = useCreativeLink((s) => s.connected)
  const stale = useCreativeLink((s) => s.stale)
  const agents = useCreativeLink((s) => s.agents)
  const { ia, pick } = useIa('perfil')
  const [open, setOpen] = useState(false)
  const available = agents.filter((a) => a.available)
  if (running)
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {step}
        </span>
        <Button size="sm" variant="outline" onClick={onStop} className="gap-1.5">
          <Square className="h-3.5 w-3.5" /> Parar
        </Button>
      </div>
    )
  if (!connected || stale || !available.length)
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
          <Sparkles className="h-4 w-4" /> {stale ? 'Atualizar o conector' : 'Conectar a IA'}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="sm" className="gap-0 p-0">
            <DialogTitle className="sr-only">Conectar meus agentes</DialogTitle>
            <ConnectorPrompt />
          </DialogContent>
        </Dialog>
      </>
    )
  return (
    <div className="flex items-center gap-2">
      {available.length > 1 && (
        <select value={ia} onChange={(e) => pick(e.target.value as typeof ia)} aria-label="IA que analisa" className="h-8 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900">
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {CHAT_AGENTS[a.id].name}
            </option>
          ))}
        </select>
      )}
      <Button size="sm" onClick={onRun} className="gap-1.5">
        <Sparkles className="h-4 w-4" /> Analisar com IA
      </Button>
    </div>
  )
}

// ---------- a área ----------

export const AnalysisArea: React.FC<{ account: IgAccount }> = ({ account }) => {
  const people = useTeamPeople(account.teamId)
  const [media, setMedia] = useState<IgMedia[] | null>(null)
  const [history, setHistory] = useState<SavedAnalysis[] | null | undefined>(undefined)
  const [highlights, setHighlights] = useState<string[] | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('')
  const stop = useRef<AbortController | null>(null)
  const { ia } = useIa('perfil')

  useEffect(() => {
    let alive = true
    Promise.all([loadMedia(account.id), loadAnalyses(account.id)])
      .then(([m, h]) => {
        if (!alive) return
        setMedia(m)
        setHistory(h)
        // Os destaques da última análise: a pessoa só ajusta o que mudou
        const last = h?.find((a) => a.highlights !== null)
        if (last) setHighlights(last.highlights)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
      stop.current?.abort()
    }
  }, [account.id])

  const audit = useMemo(() => (media ? auditProfile({ profile: account, media, highlights }) : null), [account, media, highlights])
  const latestAi = history?.find((a) => a.ai) ?? null
  const viewing = (shown && history?.find((a) => a.id === shown)) || latestAi
  const previous = history?.[0]

  const persist = useCallback(
    async (ai: SavedAnalysis['ai']) => {
      if (!audit) return
      const saved = await saveAnalysis({ account, report: audit, ai, highlights })
      setHistory((h) => [saved, ...(h ?? [])])
      setShown(null)
      return saved
    },
    [account, audit, highlights]
  )

  const saveOnly = async () => {
    setSaving(true)
    try {
      await persist(null)
      toast.success('Análise salva no histórico')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const runAi = async () => {
    if (!audit || !media) return
    const controller = new AbortController()
    stop.current = controller
    setRunning(true)
    setStep('Começando')
    try {
      const ai = await readWithAi({ account, media, highlights, report: audit, engine: ia, signal: controller.signal, onStep: setStep })
      await persist(ai)
      toast.success('Análise pronta', { description: ai.images ? `A IA viu ${ai.images} ${ai.images === 1 ? 'imagem' : 'imagens'} do perfil.` : 'Sem imagens: o conector pode estar desatualizado, ou a foto e o grid não baixaram.' })
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
      stop.current = null
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteAnalysis(id)
      setHistory((h) => h?.filter((a) => a.id !== id) ?? h)
      if (shown === id) setShown(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  if (!media || history === undefined || !audit)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Lendo o perfil…
      </p>
    )

  const delta = previous ? audit.score - previous.score : null
  const worst = audit.pillars.flatMap((p) => p.findings).filter((f) => f.level === 'critico' || f.level === 'atencao')

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900">
            <ScanSearch className="h-6 w-6 text-gray-400" aria-hidden /> Análise do perfil
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">@{account.username} como quem chega pela primeira vez vê: o que está bom, o que trava e o que fazer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {history !== null && (
            <Button size="sm" variant="outline" onClick={() => void saveOnly()} disabled={saving || running} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar no histórico
            </Button>
          )}
          {history !== null && <AiControl running={running} step={step} onRun={() => void runAi()} onStop={() => stop.current?.abort()} />}
        </div>
      </div>

      {history === null && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          As checagens funcionam, mas o histórico e a leitura da IA precisam da migração <code className="text-xs">20261102140000_crm_instagram_analyses.sql</code>.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-4 lg:sticky lg:top-4">
          <Surface>
            <div className="flex items-center gap-4">
              <ScoreRing score={audit.score} />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-900">{scoreLabel(audit.score)}</p>
                {delta !== null && previous && (
                  <p className={cn('text-sm tabular-nums', delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-gray-500')}>
                    {delta > 0 ? `+${delta}` : delta === 0 ? 'igual' : delta} desde {dayLabel(previous.createdAt)}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {worst.length ? `${worst.length} ${worst.length === 1 ? 'ponto' : 'pontos'} para ajustar` : 'Nada urgente para ajustar'}
                </p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2">
              {audit.pillars.map((p) => (
                <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
                  <a href={`#analise-${p.id}`} className="text-gray-700 hover:text-gray-900 hover:underline">
                    {p.label}
                  </a>
                  <span className="tabular-nums text-gray-500">{p.score ?? '—'}</span>
                  <div className="col-span-2 h-1 overflow-hidden rounded-full bg-gray-100">
                    <div className={cn('h-full rounded-full', barOf(p.score))} style={{ width: `${p.score ?? 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Surface>

          <ProfileCard account={account} media={media} highlights={highlights} onHighlights={setHighlights} />

          {history && history.length > 0 && (
            <Surface title="Histórico" action={<History className="h-4 w-4 text-gray-400" aria-hidden />}>
              <ul className="divide-y divide-gray-100">
                {history.map((a) => (
                  <li key={a.id} className="group flex items-center gap-3 py-2">
                    <span className={cn('w-8 text-sm font-semibold tabular-nums', toneOf(a.score))}>{a.score}</span>
                    <button type="button" onClick={() => setShown(a.ai ? a.id : null)} disabled={!a.ai} className={cn('min-w-0 flex-1 text-left text-xs', a.ai ? 'text-gray-800 hover:underline' : 'text-gray-500')}>
                      {dayLabel(a.createdAt)} · {a.createdBy ? nameOf(people, a.createdBy) : 'alguém'}
                      {a.ai ? ' · com IA' : ''}
                      {viewing?.id === a.id ? ' (aberta)' : ''}
                    </button>
                    <button type="button" onClick={() => void remove(a.id)} className="text-gray-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Apagar análise">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </div>

        <div className="grid gap-4">
          {viewing?.ai ? (
            <AiPanel analysis={viewing} />
          ) : (
            history !== null && (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
                <p>
                  As notas abaixo saem dos números e textos do perfil. <span className="font-medium text-gray-900">Analisar com IA</span> junta a leitura da foto, do grid e do tom da bio, com uma bio sugerida e os passos da semana.
                </p>
              </div>
            )
          )}
          {audit.pillars.map((p) => (
            <div key={p.id} id={`analise-${p.id}`} className="scroll-mt-4">
              <PillarCard pillar={p} note={NOTE_OF[p.id] ? viewing?.ai?.notes[NOTE_OF[p.id]!] : undefined} />
            </div>
          ))}
          <p className="text-xs text-gray-500">
            Números dos posts guardados na última sincronização ({compact(media.length)} posts). As referências (taxa de 3%, até 15 letras por destaque, 150 caracteres na bio) são guias práticos, não regras da Meta.
          </p>
        </div>
      </div>
    </div>
  )
}
