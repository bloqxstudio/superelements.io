import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, Circle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { cleanOverview } from '@/features/cerebro/contextText'
import { cn } from '@/lib/utils'
import { radarScore, radarSteps, type RadarContent, type RadarFacts, type RadarState } from './journey'

/**
 * Radar da operação no Início (Fase 3 da nova jornada de criação, 2026-11-09): as cinco etapas, sempre
 * à vista, com o que está em dia e o que falta agora. Só para contas com produção de conteúdo (copy).
 */

const db = supabase as unknown as SupabaseClient
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function loadFacts(teamId: string): Promise<RadarFacts> {
  const [readme, ctx, rows, links, patterns] = await Promise.all([
    db.from('crm_knowledge_notes').select('content').eq('team_id', teamId).eq('path', 'README.md').maybeSingle().then(({ data }) => (data as { content?: string } | null)?.content ?? '', () => ''),
    db.from('crm_account_context').select('offer, audience, tone, pillars, brand_md').eq('team_id', teamId).maybeSingle()
      .then(({ data }) => data as { offer?: string; audience?: string; tone?: string; pillars?: string[]; brand_md?: string } | null, () => null),
    db.from('crm_contents').select('id, status, editorial_date, client_status').eq('team_id', teamId).limit(2000)
      .then(({ data }) => (data ?? []) as { id: string; status: RadarContent['status']; editorial_date: string | null; client_status: RadarContent['clientStatus'] | null }[], () => []),
    db.from('crm_content_links').select('content_id').eq('team_id', teamId).eq('kind', 'criativos').limit(2000)
      .then(({ data }) => new Set(((data ?? []) as { content_id: string }[]).map((l) => l.content_id)), () => new Set<string>()),
    db.from('crm_knowledge_notes').select('id', { count: 'exact', head: true }).eq('team_id', teamId).like('path', 'marca/padroes/%')
      .then(({ count }) => count ?? 0, () => 0),
  ])
  return {
    brain: !!cleanOverview(readme),
    plan: { offer: !!ctx?.offer?.trim(), audience: !!ctx?.audience?.trim(), tone: !!ctx?.tone?.trim(), pillars: !!ctx?.pillars?.length },
    brand: !!ctx?.brand_md?.trim(),
    patterns,
    contents: rows.map((r) => ({ status: r.status, editorialDate: r.editorial_date ?? undefined, clientStatus: r.client_status ?? undefined, hasCreative: links.has(r.id) })),
    today: localDay(),
  }
}

const TONE: Record<RadarState, { icon: React.ElementType; badge: string; label: string }> = {
  ok: { icon: Check, badge: 'bg-emerald-500 text-white', label: 'Em dia' },
  atencao: { icon: AlertTriangle, badge: 'bg-amber-400 text-amber-950', label: 'Pede atenção' },
  falta: { icon: Circle, badge: 'bg-white text-gray-400 shadow-[0_0_0_1px_rgb(0_0_0/0.1)]', label: 'Falta' },
}

export const OperationRadar: React.FC = () => {
  const team = useCrm((s) => s.team)
  const [facts, setFacts] = useState<RadarFacts>()

  useEffect(() => {
    setFacts(undefined)
    if (!team) return
    let alive = true
    void loadFacts(team.id).then((f) => alive && setFacts(f))
    return () => { alive = false }
  }, [team])

  if (!team || !moduleOn(team, 'copy')) return null
  const steps = facts ? radarSteps(facts) : undefined
  const score = steps ? radarScore(steps) : 0

  return (
    <section aria-labelledby="radar-operacao" className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="radar-operacao" className="text-base font-semibold text-gray-900">Radar da operação</h2>
          <p className="mt-0.5 text-sm text-gray-500">O que está completo e o que falta em cada etapa, do Cérebro à aprovação do cliente.</p>
        </div>
        {steps && <span className="text-sm tabular-nums text-gray-500"><span className="font-semibold text-gray-900">{score}</span> de {steps.length} em dia</span>}
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-busy={!steps}>
        {(steps ?? Array.from({ length: 5 }, () => undefined)).map((s, i) => {
          if (!s) return <li key={i} className="h-36 animate-pulse rounded-xl bg-gray-50" />
          const tone = TONE[s.state]
          const Icon = tone.icon
          return (
            <li key={s.id} className={cn('flex flex-col rounded-xl p-3', s.state === 'ok' ? 'bg-gray-50' : s.state === 'atencao' ? 'bg-amber-50/70' : 'bg-gray-50')}>
              <div className="flex items-center gap-2">
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', tone.badge)} aria-hidden>
                  <Icon className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                <span className="sr-only">: {tone.label}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{s.have}</p>
              {s.missing && <p className={cn('mt-1 text-xs font-medium leading-relaxed', s.state === 'atencao' ? 'text-amber-900' : 'text-gray-900')}>{s.missing}</p>}
              <Link to={s.to} className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-gray-700 hover:text-gray-900">
                {s.action} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
