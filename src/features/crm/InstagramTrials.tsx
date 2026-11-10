import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArrowUpRight, Check, ExternalLink, FlaskConical, Loader2, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { cn } from '@/lib/utils'
import { NoTablesError, compact, decideTrial, deleteTrial, loadMedia, loadTrials, readTrials, type IgAccount, type IgTrial } from './instagram'
import { PublishDialog } from './InstagramPublish'
import { nameOf, useTeamPeople } from './people'
import { Surface, whenLabel } from './ui'
import { DECISION_LABEL, STRATEGY_LABEL, VERDICT_LABEL, baselineOf, readTrial, type Baseline, type TrialDecision, type TrialReading, type TrialVerdict } from './trialReels'

/**
 * CRM › Instagram › Testes (`?aba=testes`): os testes de reels (trial reels). O vídeo sai só para
 * quem não segue; a função `instagram` relê os números de hora em hora e guarda os retratos de 24 h
 * e 72 h; o motor (`trialReels.ts`) compara com os reels normais da conta e diz se vale levar aos
 * seguidores. Levar é no app do Instagram (a API não permite): aqui a equipe registra a decisão.
 */

const VERDICT_TONE: Record<TrialVerdict, string> = {
  processando: 'bg-gray-100 text-gray-600',
  cedo: 'bg-sky-50 text-sky-700',
  levar: 'bg-emerald-50 text-emerald-700',
  esperar: 'bg-amber-50 text-amber-700',
  refazer: 'bg-rose-50 text-rose-700',
}
const BAR = (score: number | null) => (score === null ? 'bg-gray-200' : score >= 1 ? 'bg-emerald-500' : score >= 0.7 ? 'bg-lime-500' : score >= 0.45 ? 'bg-amber-500' : 'bg-rose-500')
const hoursLabel = (h: number) => (h < 1 ? 'agora há pouco' : h < 48 ? `há ${Math.round(h)} h` : `há ${Math.round(h / 24)} dias`)

const Checkpoints: React.FC<{ trial: IgTrial }> = ({ trial }) => {
  const rows = (['24', '72'] as const).map((k) => [k, trial.checkpoints[k]] as const)
  if (!rows.some(([, v]) => v)) return null
  const views = (m?: { views?: number; reach?: number }) => m?.views ?? m?.reach
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-md bg-gray-50 px-2 py-1.5">
          <p className="text-gray-500">Em {k} h</p>
          <p className="font-semibold tabular-nums text-gray-900">{v ? compact(views(v)) : '—'}</p>
        </div>
      ))}
      <div className="rounded-md bg-gray-50 px-2 py-1.5">
        <p className="text-gray-500">Agora</p>
        <p className="font-semibold tabular-nums text-gray-900">{compact(views(trial.insights))}</p>
      </div>
    </div>
  )
}

const TrialCard: React.FC<{ trial: IgTrial; reading: TrialReading; who?: string; onDecide: (d: TrialDecision | null) => void; onDelete: () => void; canDelete: boolean }> = ({ trial, reading, who, onDecide, onDelete, canDelete }) => {
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Surface className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
      <a href={trial.permalink} target="_blank" rel="noreferrer" className={cn('relative block aspect-[9/16] w-28 overflow-hidden rounded-lg bg-gray-900', !trial.permalink && 'pointer-events-none')}>
        {trial.thumbnail ? <img src={trial.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="absolute inset-0 flex items-center justify-center text-white/50"><FlaskConical className="h-5 w-5" /></span>}
      </a>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', VERDICT_TONE[reading.verdict])}>{VERDICT_LABEL[reading.verdict]}</span>
          {reading.score !== null && <span className="text-xs tabular-nums text-gray-500">nota {reading.score}</span>}
          {trial.decision && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">{DECISION_LABEL[trial.decision]}</span>}
          <span className="ml-auto text-xs text-gray-400">{trial.publishedAt ? hoursLabel(reading.hours) : whenLabel(trial.createdAt)}</span>
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold text-gray-900">{trial.title || trial.caption?.split('\n')[0] || 'Teste sem nome'}</p>
        <p className="text-xs text-gray-500">{STRATEGY_LABEL[trial.strategy]}{trial.durationS ? ` · ${trial.durationS.toFixed(0)} s` : ''}{who ? ` · ${who}` : ''}</p>
        <p className="mt-2 text-sm font-medium text-gray-900">{reading.headline}</p>
        <p className="text-sm text-gray-600">{reading.detail}</p>

        {reading.signals.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {reading.signals.map((s) => (
              <li key={s.id} className="rounded-md border border-gray-100 px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-gray-700">{s.label}</span>
                  <span className="text-gray-400">peso {s.weight}</span>
                </div>
                <p className="mt-0.5 text-sm tabular-nums text-gray-900">{s.value}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                  <div className={cn('h-full rounded-full', BAR(s.score))} style={{ width: `${Math.round(Math.min(1, s.score ?? 0) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-gray-500">Referência: {s.reference}</p>
              </li>
            ))}
          </ul>
        )}
        <Checkpoints trial={trial} />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trial.status === 'no_ar' && (
            <>
              <Button size="sm" variant={reading.verdict === 'levar' && !trial.decision ? 'default' : 'outline'} disabled={busy} onClick={() => void run(() => onDecide(trial.decision === 'levar' ? null : 'levar'))} className="gap-1.5">
                <ArrowUpRight className="h-4 w-4" /> {trial.decision === 'levar' ? 'Desfazer: levei' : 'Levei aos seguidores'}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => onDecide(trial.decision === 'refazer' ? null : 'refazer'))} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> {trial.decision === 'refazer' ? 'Desfazer: refazer' : 'Refazer'}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => onDecide(trial.decision === 'arquivar' ? null : 'arquivar'))} className="gap-1.5 text-gray-600">
                <Archive className="h-4 w-4" /> {trial.decision === 'arquivar' ? 'Desarquivar' : 'Arquivar'}
              </Button>
            </>
          )}
          {trial.permalink && (
            <Button asChild size="sm" variant="ghost" className="gap-1.5 text-gray-600">
              <a href={trial.permalink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir no Instagram</a>
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(onDelete)} className="ml-auto text-gray-400 hover:text-rose-600" aria-label="Tirar da lista">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {reading.verdict === 'levar' && !trial.decision && trial.strategy === 'MANUAL' && (
          <p className="mt-2 text-xs text-gray-500">Levar aos seguidores é no app do Instagram (a Meta não deixa fazer pela API): perfil › Reels › o teste › "Compartilhar com seguidores". Depois marque aqui.</p>
        )}
      </div>
    </Surface>
  )
}

export const TrialsArea: React.FC<{ account: IgAccount }> = ({ account }) => {
  const { team, userId } = useCrm()
  const people = useTeamPeople(account.teamId)
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [trials, setTrials] = useState<IgTrial[] | null>(null)
  const [baseline, setBaseline] = useState<Baseline>({ reels: 0 })
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [filter, setFilter] = useState<'abertos' | 'todos'>('abertos')

  const load = useCallback(async () => {
    try {
      const [list, media] = await Promise.all([loadTrials(account.id), loadMedia(account.id, 300)])
      const trialIds = new Set(list.map((t) => t.mediaId).filter(Boolean))
      const since = Date.now() - 90 * 86_400_000
      setBaseline(baselineOf(media.filter((m) => m.product === 'REELS' && m.postedAt >= since && !trialIds.has(m.id))))
      setTrials(list)
      setError(null)
    } catch (e) {
      setError(e instanceof NoTablesError ? 'As tabelas dos testes ainda não existem (migração 20261109230000).' : e instanceof Error ? e.message : String(e))
      setTrials([])
    }
  }, [account.id])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = async () => {
    setReading(true)
    try {
      const r = await readTrials(account.id)
      await load()
      toast.success(r.trials ? `Números de ${r.trials} ${r.trials === 1 ? 'teste' : 'testes'} atualizados.` : 'Nenhum teste no ar para ler.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui ler os números.')
    } finally {
      setReading(false)
    }
  }

  const readings = useMemo(() => new Map((trials ?? []).map((t) => [t.id, readTrial({ status: t.status, publishedAt: t.publishedAt, durationS: t.durationS, insights: t.insights }, baseline)])), [trials, baseline])
  const visible = (trials ?? []).filter((t) => filter === 'todos' || !t.decision)
  const count = (v: TrialVerdict) => (trials ?? []).filter((t) => !t.decision && readings.get(t.id)?.verdict === v).length
  const decided = (trials ?? []).filter((t) => t.decision)
  const promoted = decided.filter((t) => t.decision === 'levar').length

  const decide = async (trial: IgTrial, d: TrialDecision | null) => {
    if (!userId) return
    try {
      await decideTrial(trial.id, userId, d)
      setTrials((cur) => cur?.map((t) => (t.id === trial.id ? { ...t, decision: d ?? undefined, decidedBy: d ? userId : undefined } : t)) ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui salvar.')
    }
  }
  const remove = async (trial: IgTrial) => {
    try {
      await deleteTrial(trial.id)
      setTrials((cur) => cur?.filter((t) => t.id !== trial.id) ?? null)
      toast.success('Tirado da lista. O vídeo continua no Instagram.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui tirar.')
    }
  }

  return (
    <div className="grid gap-4">
      <Surface>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><FlaskConical className="h-4 w-4 text-violet-600" /> Testes de reels</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              O vídeo sai só para quem não segue @{account.username}. Os números são relidos de hora em hora e o motor compara com os seus reels normais
              {baseline.reels >= 3 ? ` (${baseline.reels} nos últimos 90 dias)` : ' (sem reels suficientes: usa referências fixas)'}: retenção, compartilhamentos e salvos, interações e visualizações.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void refresh()} disabled={reading} className="gap-1.5">
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar números
            </Button>
            <Button onClick={() => setPublishing(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo teste</Button>
          </div>
        </div>
        {trials && trials.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Rodando', count('cedo') + count('esperar') + count('processando')],
              ['Prontos para levar', count('levar')],
              ['Para refazer', count('refazer')],
              ['Levados', decided.length ? `${promoted} de ${decided.length}` : '—'],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Surface>

      {trials === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo os testes…</p>
      ) : error ? (
        <Surface><p className="text-sm text-rose-700">{error}</p></Surface>
      ) : !trials.length ? (
        <Surface className="text-center">
          <p className="text-sm font-medium text-gray-900">Nenhum teste ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">Publique um reels com "Publicar como teste" ligado (aqui, no Criativos, na cena em código ou no vídeo explicativo). Ele aparece nesta lista.</p>
          <Button className="mt-4 gap-1.5" onClick={() => setPublishing(true)}><Plus className="h-4 w-4" /> Novo teste</Button>
        </Surface>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            {(['abertos', 'todos'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-full px-3 py-1', filter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                {f === 'abertos' ? 'Sem decisão' : 'Todos'}
              </button>
            ))}
          </div>
          {!visible.length && <p className="flex items-center gap-2 text-sm text-gray-500"><Check className="h-4 w-4" /> Todos os testes têm decisão.</p>}
          {visible.map((t) => (
            <TrialCard
              key={t.id}
              trial={t}
              reading={readings.get(t.id)!}
              who={t.createdBy ? nameOf(people, t.createdBy) : undefined}
              onDecide={(d) => decide(t, d)}
              onDelete={() => remove(t)}
              canDelete={manager || t.createdBy === userId}
            />
          ))}
        </>
      )}
      {publishing && <PublishDialog account={account} startAsTrial onClose={() => setPublishing(false)} onPublished={() => void load()} />}
    </div>
  )
}
