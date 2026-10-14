import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Opportunity } from '@/features/prospects/funnel'
import { getOpportunity, listOpportunities } from './opportunities'

type SetItems = (update: (prev: Opportunity[]) => Opportunity[]) => void

/**
 * O funil ao vivo: o cartão que outra pessoa da equipe criou, moveu ou
 * editou chega pela Realtime do Supabase (só o que a pessoa pode ver, pelas
 * regras das tabelas). A tela relê o cartão inteiro, com o cliente; cartão
 * apagado sai. Ao reconectar depois de uma queda, relê o funil todo.
 * `prepare` ajusta cada cartão como a tela usa (a nota da empresa, por exemplo).
 */
export function useOpportunityFeed(pipelineId: string | undefined, teamId: string | undefined, onChange: SetItems, prepare: (o: Opportunity) => Opportunity = (o) => o) {
  const latest = useRef({ onChange, prepare })
  latest.current = { onChange, prepare }

  useEffect(() => {
    if (!pipelineId || !teamId) return
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | null = null
    let alive = true

    const flush = async () => {
      timer = null
      const ids = [...pending]
      pending.clear()
      const fresh = await Promise.all(ids.map((id) => getOpportunity(id).catch(() => undefined)))
      if (!alive) return
      latest.current.onChange((prev) => {
        let next = prev
        for (const [i, id] of ids.entries()) {
          const one = fresh[i]
          if (!one || one.pipelineId !== pipelineId) {
            next = next.filter((o) => o.id !== id)
            continue
          }
          const ready = latest.current.prepare(one)
          next = next.some((o) => o.id === id) ? next.map((o) => (o.id === id ? ready : o)) : [...next, ready]
        }
        return next
      })
    }
    // Várias mudanças juntas (mover e anotar) viram uma leitura só
    const queue = (id: string) => {
      pending.add(id)
      timer ??= setTimeout(() => void flush(), 250)
    }

    let subscribed = false
    const channel = supabase
      .channel(`crm-funil-${pipelineId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_opportunities', filter: `pipeline_id=eq.${pipelineId}` }, (payload) => queue(String(payload.new.id)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_opportunities', filter: `pipeline_id=eq.${pipelineId}` }, (payload) => queue(String(payload.new.id)))
      // Exclusão não tem filtro na Realtime: chega só o id, e sai da lista se estiver nela
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_opportunities' }, (payload) => {
        const id = String((payload.old as { id?: string }).id ?? '')
        if (id) latest.current.onChange((prev) => (prev.some((o) => o.id === id) ? prev.filter((o) => o.id !== id) : prev))
      })
      // O cadastro mudou (nome, telefone, leitura do site): relê os cartões desse cliente
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_clients', filter: `team_id=eq.${teamId}` }, (payload) => {
        const clientId = String(payload.new.id)
        latest.current.onChange((prev) => {
          for (const o of prev) if (o.clientId === clientId) queue(o.id)
          return prev
        })
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (subscribed) {
          // Voltou de uma queda: o que mudou enquanto isso não chegou
          listOpportunities(pipelineId)
            .then((list) => alive && latest.current.onChange(() => list.map(latest.current.prepare)))
            .catch(() => {})
        }
        subscribed = true
      })

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [pipelineId, teamId])
}
