import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isResearch } from '@/features/copy/knowledge'
import { listOpportunities } from '@/features/crm/opportunities'
import { useRoutines } from '@/features/ia/rotinas'
import { FileText, FolderKanban, Globe, Handshake, Images, type LucideIcon } from 'lucide-react'
import { listDocs } from '@/features/copy/storage'
import type { CopySummary } from '@/features/copy/types'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { elapsed, useSeconds } from './JobFeed'
import { AREAS, useJobs, type Area, type Job } from './jobs'

/**
 * A empresa operando: cada área (Criativos, Copy, Landing pages, Sites) com o
 * que existe, o que está em produção agora e quem está trabalhando, ao vivo.
 */

const ICON: Record<Area, LucideIcon> = { criativos: Images, copy: FileText, landing: Globe, sites: FolderKanban, comercial: Handshake }
const OPEN: Record<Area, string> = { criativos: '/criativos', copy: '/copy', landing: '/copy', sites: '/projetos', comercial: '/crm' }

const Metric: React.FC<{ n: number | string; label: string; hot?: boolean }> = ({ n, label, hot }) => (
  <div>
    <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', hot ? 'text-violet-700' : 'text-gray-900')}>{n}</p>
    <p className="text-[11px] text-gray-500">{label}</p>
  </div>
)

const Worker: React.FC<{ job: Job; now: number }> = ({ job, now }) => {
  const body = (
    <>
      <span className="relative mt-1 flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: job.color ?? '#7c3aed' }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: job.color ?? '#7c3aed' }} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-gray-900">{job.kind} · {job.label}</span>
        <span className="block truncate text-[11px] text-gray-500">{job.agent} · {job.step}</span>
      </span>
      <span className="text-[11px] tabular-nums text-gray-500">{elapsed(job.startedAt, job.endedAt ?? now)}</span>
    </>
  )
  return <li>{job.href ? <Link to={job.href} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-gray-50">{body}</Link> : <div className="flex items-start gap-2 px-1 py-1">{body}</div>}</li>
}

export const Operations: React.FC = () => {
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const projectIds = projects.map((p) => p.id).join(',')
  const jobs = useJobs((s) => s.jobs)
  const spaceRuns = useAgents((s) => s.agents)
  const [docs, setDocs] = useState<CopySummary[] | null>(null)
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const running = jobs.filter((j) => j.status === 'running')
  const now = useSeconds(running.length > 0)
  const routines = useRoutines((s) => s.routines)
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => void listOpportunities().then((l) => setOpen(l.filter((o) => o.stage !== 'fechado' && o.stage !== 'perdido').length)).catch(() => setOpen(null)), [running.length])

  // Recarrega os números quando um trabalho começa ou termina
  useEffect(() => {
    const ids = projectIds ? projectIds.split(',') : []
    void listDocs(ids).then(setDocs).catch(() => setDocs([]))
    void listSets(ids).then(setSets).catch(() => setSets([]))
  }, [projectIds, running.length])

  const spaceWorking = spaceRuns.filter((a) => ['working', 'question'].includes(agentStatus(a, now)))
  const pagesInProduction = projects.reduce((n, p) => n + (p.summary.pages ?? 1), 0)

  const by = useMemo(() => {
    const d = docs ?? []
    const lp = d.filter((x) => x.format === 'lp')
    const research = d.filter((x) => isResearch(x.format))
    return {
      copyDocs: d.filter((x) => x.format !== 'lp' && x.format !== 'site'),
      research,
      lp,
      siteDocs: d.filter((x) => x.format === 'site'),
      folders: new Set(d.map((x) => x.folderId).filter(Boolean)).size,
    }
  }, [docs])
  const written = (list: CopySummary[]) => list.filter((d) => d.words > 5).length

  const total = running.length + spaceWorking.length
  const cards: { area: Area; metrics: React.ReactNode; jobs: Job[]; extra?: React.ReactNode }[] = [
    {
      area: 'criativos',
      metrics: (<><Metric n={sets?.length ?? '–'} label="conjuntos" /><Metric n={sets?.reduce((n, s) => n + s.posts, 0) ?? '–'} label="posts" /><Metric n={running.filter((j) => j.area === 'criativos').length} label="em produção" hot /></>),
      jobs: jobs.filter((j) => j.area === 'criativos'),
    },
    {
      area: 'copy',
      metrics: (<><Metric n={by.research.length} label="pesquisas" /><Metric n={running.filter((j) => j.area === 'copy' && j.kind === 'Pesquisa').length} label="pesquisando agora" hot /><Metric n={written(by.copyDocs)} label="textos escritos" /><Metric n={by.folders} label="pastas" /></>),
      jobs: jobs.filter((j) => j.area === 'copy'),
    },
    {
      area: 'landing',
      metrics: (<><Metric n={by.lp.length} label="copies de LP" /><Metric n={written(by.lp)} label="escritas" /><Metric n={running.filter((j) => j.area === 'landing').length} label="em produção" hot /></>),
      jobs: jobs.filter((j) => j.area === 'landing'),
    },
    {
      area: 'sites',
      metrics: (<><Metric n={projects.length} label="projetos" /><Metric n={pagesInProduction} label="páginas" /><Metric n={spaceWorking.length + running.filter((j) => j.area === 'sites').length} label="em produção" hot /></>),
      jobs: jobs.filter((j) => j.area === 'sites'),
      extra: spaceWorking.length > 0 && (
        <ul className="space-y-0.5">
          {spaceWorking.map((a) => (
            <li key={a.key}>
              <Link to={`/projetos/${a.projectId}`} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-gray-50">
                <span className="relative mt-1 flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60 motion-safe:animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-gray-900">{a.projectName ?? 'Projeto'}</span><span className="block truncate text-[11px] text-gray-500">{a.agent} · {a.now ?? (a.state === 'question' ? 'esperando você' : 'trabalhando')}</span></span>
                <span className="text-[11px] tabular-nums text-gray-500">{elapsed(a.startedAt, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
    {
      area: 'comercial',
      metrics: (<><Metric n={open ?? '–'} label="cartões abertos" /><Metric n={routines.filter((r) => r.enabled).length} label="rotinas ligadas" /><Metric n={running.filter((j) => j.area === 'comercial').length} label="em produção" hot /></>),
      jobs: jobs.filter((j) => j.area === 'comercial'),
    },
  ]

  return (
    <section aria-label="A empresa operando">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">A empresa operando</h2>
        <p className="text-xs text-gray-500">{total > 0 ? `${total} ${total === 1 ? 'agente trabalhando' : 'agentes trabalhando'} agora` : 'Nenhum agente trabalhando agora'}</p>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {cards.map(({ area, metrics, jobs: list, extra }) => {
          const Icon = ICON[area]
          const live = list.filter((j) => j.status === 'running')
          const recent = list.filter((j) => j.status !== 'running').slice(0, 3)
          return (
            <article key={area} className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]" aria-label={AREAS[area].label}>
              <header className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-700"><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-gray-900">{AREAS[area].label}</h3><p className="text-[11px] text-gray-500">{AREAS[area].hint}</p></div>
                <Link to={OPEN[area]} className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">Abrir</Link>
              </header>
              <div className="mt-3 flex gap-6">{metrics}</div>
              <div className="mt-3 border-t border-gray-100 pt-2">
                {live.length === 0 && !extra ? (
                  <p className="px-1 py-1 text-xs text-gray-400">Ninguém trabalhando aqui agora.</p>
                ) : (
                  <ul className="space-y-0.5">{live.map((j) => <Worker key={j.id} job={j} now={now} />)}</ul>
                )}
                {extra}
                {recent.length > 0 && (
                  <ul className="mt-1 space-y-0.5 opacity-70">
                    {recent.map((j) => <li key={j.id} className="flex items-center gap-2 px-1 text-[11px] text-gray-500"><span className={cn('h-1.5 w-1.5 rounded-full', j.status === 'error' ? 'bg-red-500' : 'bg-emerald-500')} /><span className="min-w-0 flex-1 truncate">{j.kind} · {j.label}</span><span>{j.status === 'error' ? 'não terminou' : 'pronto'} · {elapsed(j.startedAt, j.endedAt ?? now)}</span></li>)}
                  </ul>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
