import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { subscribeTopic } from '@/lib/realtimeTopic'
import { LIVE_MS, isLive, toVisit, type FormVisit } from '@/features/crm/formFunnel'

export * from '@/features/crm/formFunnel'

/**
 * Visitas dos formulários (`crm_form_visits`, migração 20261104200000): lidas do período e mantidas
 * ao vivo pela Realtime. Cada mudança da linha (etapa nova, sinal, saída) chega aqui sozinha.
 */

const db = supabase as unknown as SupabaseClient
export const COLUMNS =
  'id, form_id, visitor, started_at, last_at, left_at, active_ms, screen, step_id, step_index, steps_total, steps_seen, started, submitted, qualified, schedule_view, scheduled, submission_id, page, embed, channel, source, medium, campaign, content, term, click_id, referrer_host, device, browser, os, country, region, region_name, city'

export class VisitsTableError extends Error {
  constructor() {
    super('Falta aplicar a migração 20261104200000_crm_form_visits.sql no Supabase.')
  }
}

export async function listFormVisits(formId: string, since: number, limit = 3000): Promise<FormVisit[]> {
  const { data, error } = await db.from('crm_form_visits').select(COLUMNS).eq('form_id', formId).gte('started_at', new Date(since).toISOString()).order('started_at', { ascending: false }).limit(limit)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') throw new VisitsTableError()
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => toVisit(r as Record<string, unknown>))
}

/** Um relógio que anda a cada `ms`, para "agora" e "há 2 min" se refazerem sem nova leitura */
export function useNow(ms = 5000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** As visitas de um formulário desde `since`, ao vivo */
export function useFormVisits(formId: string, since: number) {
  const [visits, setVisits] = useState<FormVisit[] | null>(null)
  const [error, setError] = useState<string>()
  const sinceRef = useRef(since)
  sinceRef.current = since

  const load = useCallback(async () => {
    try {
      setVisits(await listFormVisits(formId, since))
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setVisits([])
    }
  }, [formId, since])

  useEffect(() => {
    setVisits(null)
    void load()
  }, [load])

  useEffect(() => {
    // Tópico fixo: o helper espera o canal antigo com esse tópico sair antes de entrar (revisão de 2026-11-13)
    const leave = subscribeTopic(`form-visits-${formId}`, (channel) =>
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_form_visits', filter: `form_id=eq.${formId}` }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            setVisits((list) => (list ? list.filter((v) => v.id !== id) : list))
            return
          }
          const visit = toVisit(payload.new as Record<string, unknown>)
          if (visit.startedAt < sinceRef.current) return
          setVisits((list) => {
            if (!list) return list
            const i = list.findIndex((v) => v.id === visit.id)
            if (i < 0) return [visit, ...list]
            const next = list.slice()
            next[i] = visit
            return next
          })
        })
    )
    // Reserva: se a Realtime cair, uma leitura a cada 2 min com a aba à vista
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 120_000)
    return () => {
      clearInterval(t)
      leave()
    }
  }, [formId, load])

  return { visits, error, reload: load }
}

/** Quantas pessoas estão em cada formulário da conta agora (para a lista de formulários) */
export function useLiveCounts(teamId: string | undefined) {
  const [rows, setRows] = useState<Map<string, { formId: string; lastAt: number; leftAt?: number }>>(new Map())
  const now = useNow(10_000)

  useEffect(() => {
    if (!teamId) return
    let alive = true
    const load = async () => {
      const { data } = await db.from('crm_form_visits').select('id, form_id, last_at, left_at').eq('team_id', teamId).is('left_at', null).gte('last_at', new Date(Date.now() - LIVE_MS).toISOString()).limit(500)
      if (!alive) return
      setRows(new Map((data ?? []).map((r) => [String(r.id), { formId: String(r.form_id), lastAt: Date.parse(String(r.last_at)) }])))
    }
    void load()
    // Tópico fixo: o helper espera o canal antigo com esse tópico sair antes de entrar (revisão de 2026-11-13)
    const leave = subscribeTopic(`form-visits-team-${teamId}`, (channel) =>
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_form_visits', filter: `team_id=eq.${teamId}` }, (payload) => {
          const r = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>
          setRows((map) => {
            const next = new Map(map)
            if (payload.eventType === 'DELETE') next.delete(String(r.id))
            else next.set(String(r.id), { formId: String(r.form_id), lastAt: Date.parse(String(r.last_at)), leftAt: r.left_at ? Date.parse(String(r.left_at)) : undefined })
            return next
          })
        })
    )
    return () => {
      alive = false
      leave()
    }
  }, [teamId])

  const counts: Record<string, number> = {}
  for (const v of rows.values()) if (isLive(v, now)) counts[v.formId] = (counts[v.formId] ?? 0) + 1
  return counts
}
