import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { Block, Skeleton } from '@/features/home/HomeParts'
import { listContents, loadContext, ContentTablesError } from './api'
import { pendingActions, type AccountContext, type Content } from './rules'

/**
 * Início › "Plano e conteúdos": o que está pendente de verdade (plano sem preencher, conteúdos
 * esperando aprovação, datas editoriais vencidas, ideias paradas), lido do Supabase. Cada linha
 * abre a tela certa. Some quando o módulo Copy está desligado na conta.
 */

export const PlanBlock: React.FC = () => {
  const team = useCrm((s) => s.team)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'sem-banco'>('loading')
  const [context, setContext] = useState<AccountContext | null>(null)
  const [contents, setContents] = useState<Content[]>([])

  const enabled = !!team && moduleOn(team, 'copy')
  const teamId = team?.id

  useEffect(() => {
    if (!teamId || !enabled) return
    let alive = true
    setState('loading')
    Promise.all([loadContext(teamId), listContents(teamId)])
      .then(([ctx, list]) => {
        if (!alive) return
        setContext(ctx)
        setContents(list)
        setState('ready')
      })
      .catch((error) => {
        console.error('[home] plano e conteúdos', error)
        if (alive) setState(error instanceof ContentTablesError ? 'sem-banco' : 'error')
      })
    return () => {
      alive = false
    }
  }, [teamId, enabled])

  const items = useMemo(() => pendingActions({ role: team?.role, context, contents, now: Date.now() }), [team?.role, context, contents])

  if (!enabled || state === 'sem-banco') return null

  return (
    <Block id="plano-conteudos" title="Plano e conteúdos" hint="O contexto da empresa e o que falta aprovar ou produzir.">
      {state === 'loading' ? (
        <div className="grid gap-2" aria-busy="true">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : state === 'error' ? (
        <p role="alert" className="text-sm text-gray-600">
          Não consegui ler o plano e os conteúdos agora. <Link to="/conteudos" className="font-medium text-gray-900 underline underline-offset-2">Abrir Conteúdos</Link>
        </p>
      ) : items.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-900">{a.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{a.reason}</p>
              <Link to={a.to} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-gray-900 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {a.action} <ArrowUpRight aria-hidden className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> Plano em dia e nenhum conteúdo esperando. <Link to="/conteudos" className="font-medium text-gray-900 underline underline-offset-2">Ver conteúdos</Link>
        </p>
      )}
    </Block>
  )
}
