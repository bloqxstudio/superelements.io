import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarDays, CircleAlert, Columns3, ListChecks, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { FIELD, Page, PageHeader } from '@/features/crm/ui'
import { StatusChip } from '@/features/conteudos/StatusChip'
import { ContentError, ContentTablesError, createContent, listContents, loadContext } from '@/features/conteudos/api'
import { CONTENT_FORMATS, STATUS_LABEL, STATUS_ORDER, briefOf, editorialLate, formatLabel, missingContext, validateContentDraft, type AccountContext, type Content, type ContentFormat, type ContentStatus } from '@/features/conteudos/rules'

/**
 * Conteúdos (/conteudos): o que a empresa vai publicar, da ideia à aprovação, em lista ou em
 * quadro. O briefing de cada conteúdo vem do Plano da conta. Os estados só mudam pelo servidor,
 * dentro do conteúdo (/conteudos/:id).
 */

const dateLabel = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : undefined)
const isLate = (c: Content) => editorialLate(c, Date.now())

const NewContent: React.FC<{ open: boolean; teamId: string; context: AccountContext | null; onClose: () => void }> = ({ open, teamId, context, onClose }) => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [idea, setIdea] = useState('')
  const [goal, setGoal] = useState('')
  const [format, setFormat] = useState<ContentFormat>('post-instagram')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (open) {
      setTitle('')
      setIdea('')
      setGoal('')
      setFormat('post-instagram')
      setDate('')
      setError(undefined)
    }
  }, [open])

  const brief = briefOf(context, { goal, idea, format })
  const missing = missingContext(context)

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateContentDraft({ title, idea, goal, script: '' })
    if (problem) return setError(problem)
    setBusy(true)
    setError(undefined)
    try {
      const created = await createContent(teamId, { title: title.trim(), idea, goal, format, script: '', editorialDate: date || null })
      navigate(`/conteudos/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui criar.')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo conteúdo</DialogTitle>
          <DialogDescription>Comece pela ideia. O roteiro, o Copy e os Criativos vêm depois.</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="grid gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Título</span>
            <input autoFocus required value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={cn(FIELD, 'h-9')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Ideia</span>
            <textarea rows={3} value={idea} maxLength={4000} onChange={(e) => setIdea(e.target.value)} className={cn(FIELD, 'py-2')} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">Formato</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as ContentFormat)} className={cn(FIELD, 'h-9')}>
                {CONTENT_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-800">Data editorial <span className="font-normal text-gray-500">(opcional)</span></span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(FIELD, 'h-9')} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-800">Objetivo <span className="font-normal text-gray-500">(vale mais que o do plano)</span></span>
            <input value={goal} maxLength={600} onChange={(e) => setGoal(e.target.value)} placeholder={context?.goal ? `Plano: ${context.goal.slice(0, 80)}` : undefined} className={cn(FIELD, 'h-9')} />
          </label>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-800">Briefing aplicado a partir do Plano{context ? ` (versão ${context.version})` : ''}</p>
            {context ? (
              <p className="mt-1">{[brief.audience && 'Público', brief.offer && 'Oferta', brief.tone && 'Tom', context.pillars.length && 'Pilares', context.restrictions && 'Restrições'].filter(Boolean).join(' · ') || 'O plano está vazio.'}</p>
            ) : (
              <p className="mt-1">A conta ainda não tem plano. O conteúdo funciona, mas o briefing sairá só com o que você escrever aqui.</p>
            )}
            {context && missing.length > 0 && <p className="mt-1 text-amber-800">Falta no plano: {missing.join(' e ')}.</p>}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Criar conteúdo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const Card: React.FC<{ c: Content }> = ({ c }) => (
  <Link to={`/conteudos/${c.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <p className="line-clamp-2 text-sm font-medium text-gray-900">{c.title}</p>
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
      <span>{formatLabel(c.format)}</span>
      {c.editorialDate && (
        <span className={cn('inline-flex items-center gap-1', isLate(c) && 'font-medium text-red-700')}>
          <CalendarDays className="h-3 w-3" aria-hidden /> {dateLabel(c.editorialDate)}
          {isLate(c) && <span className="sr-only"> (vencida)</span>}
        </span>
      )}
    </p>
  </Link>
)

const Contents: React.FC = () => {
  const team = useCrm((s) => s.team)
  const teamStatus = useCrm((s) => s.status)
  const [params, setParams] = useSearchParams()
  const filter = params.get('estado') ?? 'todos'
  const view = params.get('visao') === 'quadro' ? 'quadro' : 'lista'
  const creating = params.get('novo') === '1'

  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'sem-banco'>('loading')
  const [items, setItems] = useState<Content[]>([])
  const [context, setContext] = useState<AccountContext | null>(null)

  const load = useCallback(async () => {
    if (!team) return
    setState('loading')
    try {
      const [list, ctx] = await Promise.all([listContents(team.id), loadContext(team.id)])
      setItems(list)
      setContext(ctx)
      setState('ready')
    } catch (error) {
      console.error('[conteudos] falha ao ler', error)
      if (error instanceof ContentError) toast.error(error.message)
      setState(error instanceof ContentTablesError ? 'sem-banco' : 'error')
    }
  }, [team])

  useEffect(() => {
    void load()
  }, [load])

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const shown = useMemo(() => {
    if (filter === 'atrasado') return items.filter(isLate)
    if (STATUS_ORDER.includes(filter as ContentStatus)) return items.filter((c) => c.status === filter)
    return items
  }, [items, filter])

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((s) => [s, items.filter((c) => c.status === s).length])) as Record<ContentStatus, number>, [items])

  if (teamStatus === 'ready' && !team) {
    return (
      <Page>
        <PageHeader title="Conteúdos" text="Os conteúdos são de uma conta de empresa. Peça um convite em Equipe." />
      </Page>
    )
  }

  const filters: { id: string; label: string; n?: number }[] = [{ id: 'todos', label: 'Todos', n: items.length }, ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_LABEL[s], n: counts[s] })), { id: 'atrasado', label: 'Data vencida', n: items.filter(isLate).length }]

  return (
    <Page>
      <PageHeader title="Conteúdos" text={`O que ${team?.name ?? 'a empresa'} vai publicar, da ideia à aprovação do texto.`}>
        <Button asChild variant="outline" size="sm">
          <Link to="/plano">Plano da empresa</Link>
        </Button>
        <Button size="sm" onClick={() => setParam('novo', '1')} disabled={state !== 'ready'}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Novo conteúdo
        </Button>
      </PageHeader>

      {state === 'ready' && !context && (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          A conta ainda não tem plano, então os briefings saem sem contexto. <Link to="/plano" className="font-medium underline underline-offset-2">Abrir o plano</Link>
        </p>
      )}

      {state === 'loading' && (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo os conteúdos
        </p>
      )}
      {state === 'sem-banco' && (
        <p role="alert" className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Os Conteúdos ainda não estão disponíveis: falta aplicar a migração 20261031041728 no Supabase.
        </p>
      )}
      {state === 'error' && (
        <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> Não consegui ler os conteúdos.
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {state === 'ready' && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.id}
                  onClick={() => setParam('estado', f.id === 'todos' ? undefined : f.id)}
                  className={cn('h-8 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', filter === f.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}
                >
                  {f.label} <span className="tabular-nums opacity-70">{f.n}</span>
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Visão" className="inline-flex rounded-lg bg-gray-100 p-0.5">
              {([['lista', 'Lista', ListChecks], ['quadro', 'Quadro', Columns3]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="radio" aria-checked={view === id} onClick={() => setParam('visao', id === 'lista' ? undefined : id)} className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', view === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-800">Nenhum conteúdo ainda</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">Comece pela primeira ideia. O briefing vem do Plano da empresa e o texto pode seguir para o Copy e os Criativos.</p>
              <Button className="mt-4" size="sm" onClick={() => setParam('novo', '1')}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Criar o primeiro
              </Button>
            </div>
          ) : view === 'lista' ? (
            shown.length === 0 ? (
              <p className="mt-6 text-sm text-gray-500">Nenhum conteúdo neste filtro.</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
                {shown.map((c) => (
                  <li key={c.id}>
                    <Link to={`/conteudos/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className="min-w-0 flex-1 basis-60 truncate text-sm font-medium text-gray-900">{c.title}</span>
                      <span className="text-xs text-gray-500">{formatLabel(c.format)}</span>
                      <span className={cn('flex w-20 items-center gap-1 text-xs text-gray-500', isLate(c) && 'font-medium text-red-700')}>
                        {c.editorialDate && (
                          <>
                            <CalendarDays className="h-3 w-3" aria-hidden /> {dateLabel(c.editorialDate)}
                          </>
                        )}
                      </span>
                      <StatusChip status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STATUS_ORDER.map((s) => {
                const col = shown.filter((c) => c.status === s)
                return (
                  <section key={s} aria-label={STATUS_LABEL[s]} className="rounded-xl bg-gray-100/70 p-2.5">
                    <h2 className="flex items-center justify-between px-1.5 pb-2 text-xs font-semibold text-gray-700">
                      {STATUS_LABEL[s]} <span className="tabular-nums text-gray-500">{col.length}</span>
                    </h2>
                    <div className="grid gap-2">
                      {col.length ? col.map((c) => <Card key={c.id} c={c} />) : <p className="px-1.5 py-3 text-xs text-gray-400">Vazio</p>}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {team && <NewContent open={creating} teamId={team.id} context={context} onClose={() => setParam('novo', undefined)} />}
    </Page>
  )
}

export default Contents
