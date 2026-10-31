import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink, FileText, Images, Info, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { nameOf, useTeamPeople } from '@/features/crm/people'
import { FIELD, Page, whenLabel } from '@/features/crm/ui'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import {
  ContentError, ContentTablesError, deleteContent, linkContent, listLinks, listSnapshots, loadContent, loadContext, saveContent, transitionContent, unlinkContent,
  type ApprovalSnapshot,
} from '@/features/conteudos/api'
import {
  CONTENT_FORMATS, STATUS_LABEL, TRANSITION_ACTIONS, approvalIsCurrent, briefOf, canApprove, canManage, checkLink, checkTransition, formatLabel, missingContext, validateContentDraft,
  type AccountContext, type Content, type ContentFormat, type ContentLink, type ContentStatus, type LinkCheck,
} from '@/features/conteudos/rules'
import { MaterialUnavailable, copyHash, docScript, forwardToCopy, forwardToCriativos, readCopy, readSet, scriptFromCopy, scriptToCopy, setHash } from '@/features/conteudos/forward'
import { StatusChip } from '@/features/conteudos/StatusChip'

/**
 * Um conteúdo (/conteudos/:id): ideia, roteiro, briefing do Plano, estado e material ligado.
 *
 * A aprovação cobre só o TEXTO deste conteúdo (título, formato, objetivo, ideia e roteiro) na
 * versão exata em que foi dada. Design de Criativos e links externos não são cobertos. Quem
 * decide é o servidor; esta tela só mostra e pede.
 */

interface Draft {
  title: string
  idea: string
  goal: string
  format: ContentFormat
  script: string
  editorialDate: string
}

const draftOf = (c: Content): Draft => ({ title: c.title, idea: c.idea, goal: c.goal, format: c.format, script: c.script, editorialDate: c.editorialDate ?? '' })

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <section className={cn('rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] md:p-5', className)}>
    <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
    {children}
  </section>
)

interface MaterialState {
  check?: LinkCheck
  loading: boolean
}

const ContentDetail: React.FC = () => {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const role = team?.role
  const people = useTeamPeople(team?.id)
  useProjectList()
  const projects = useProjectStore((s) => s.projects)

  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error' | 'sem-banco'>('loading')
  const [content, setContent] = useState<Content>()
  const [ctx, setCtx] = useState<AccountContext | null>(null)
  const [draft, setDraft] = useState<Draft>()
  const [links, setLinks] = useState<ContentLink[]>([])
  const [snapshots, setSnapshots] = useState<ApprovalSnapshot[]>([])
  const [material, setMaterial] = useState<Record<'copy' | 'criativos', MaterialState>>({ copy: { loading: false }, criativos: { loading: false } })
  const [busy, setBusy] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [projectId, setProjectId] = useState('')

  // A tela é reaproveitada ao trocar de /conteudos/:id: respostas de leituras e ações do id anterior
  // não podem substituir a tela do novo. `seq` numera as leituras; `idRef` diz qual id está aberto.
  const seq = useRef(0)
  const idRef = useRef(id)
  idRef.current = id
  const stale = (contentId: string) => idRef.current !== contentId

  const load = useCallback(async () => {
    if (!team) return
    const mine = ++seq.current
    setState('loading')
    setContent(undefined)
    setDraft(undefined)
    setLinks([])
    setSnapshots([])
    setMaterial({ copy: { loading: false }, criativos: { loading: false } })
    try {
      const c = await loadContent(id)
      if (mine !== seq.current) return
      if (!c || c.teamId !== team.id) return setState('missing')
      const [context, ls, snaps] = await Promise.all([loadContext(team.id), listLinks(id), listSnapshots(id)])
      if (mine !== seq.current) return
      setContent(c)
      setDraft(draftOf(c))
      setCtx(context)
      setLinks(ls)
      setSnapshots(snaps)
      setConflict(false)
      setProblem(undefined)
      setState('ready')
    } catch (error) {
      if (mine !== seq.current) return
      console.error('[conteudo] falha ao ler', error)
      setState(error instanceof ContentTablesError ? 'sem-banco' : 'error')
    }
  }, [team, id])

  useEffect(() => {
    void load()
  }, [load])

  const copyLink = links.find((l) => l.kind === 'copy')
  const setLinkRow = links.find((l) => l.kind === 'criativos')

  // Confere o material ligado de verdade: lê o documento e o conjunto agora e compara com o roteiro
  const script = content?.script
  useEffect(() => {
    if (!content) return
    let alive = true
    const run = async (kind: 'copy' | 'criativos', link: ContentLink | undefined) => {
      if (!link) return setMaterial((m) => ({ ...m, [kind]: { loading: false } }))
      setMaterial((m) => ({ ...m, [kind]: { loading: true } }))
      let check: LinkCheck
      if (kind === 'copy') {
        const doc = await readCopy(link)
        check = checkLink('copy', { script: script ?? '', docScript: doc ? docScript(doc) : undefined, available: !!doc })
      } else {
        const set = await readSet(link)
        check = checkLink('criativos', { script: script ?? '', linkedHash: link.linkedHash, currentHash: set ? await setHash(set) : undefined, available: !!set })
      }
      if (alive) setMaterial((m) => ({ ...m, [kind]: { loading: false, check } }))
    }
    void run('copy', copyLink)
    void run('criativos', setLinkRow)
    return () => {
      alive = false
    }
  }, [content, script, copyLink, setLinkRow])

  const dirty = !!content && !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(content))
  const invalid = draft ? validateContentDraft(draft) : undefined

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const handle = (error: unknown) => {
    if (error instanceof ContentError && error.kind === 'conflito') setConflict(true)
    else setProblem(error instanceof Error ? error.message : 'Não consegui concluir.')
  }

  const save = async () => {
    if (!content || !draft || invalid || busy) return
    setBusy('salvar')
    setProblem(undefined)
    try {
      const wasApproved = content.status === 'aprovado'
      const next = await saveContent(content.id, content.version, { ...draft, editorialDate: draft.editorialDate || null })
      if (stale(content.id)) return
      setContent(next)
      setDraft(draftOf(next))
      if (wasApproved && next.status !== 'aprovado') toast.message('A aprovação foi derrubada: o texto mudou. Envie para revisão de novo.')
      else toast.success('Salvo.')
    } catch (error) {
      handle(error)
    } finally {
      setBusy(undefined)
    }
  }

  const moveTo = async (to: ContentStatus) => {
    if (!content || busy) return
    // Mudar de estado recarrega o texto salvo: com mudanças soltas elas se perderiam
    if (dirty) return setProblem('Salve ou descarte as mudanças antes de mudar o estado.')
    setBusy(to)
    setProblem(undefined)
    try {
      const next = await transitionContent(content.id, content.version, to)
      if (stale(content.id)) return
      setContent(next)
      setDraft(draftOf(next))
      const snaps = await listSnapshots(content.id)
      if (stale(content.id)) return
      setSnapshots(snaps)
      toast.success(to === 'aprovado' ? 'Texto aprovado, na versão salva.' : `Agora: ${STATUS_LABEL[to].toLowerCase()}.`)
    } catch (error) {
      handle(error)
    } finally {
      setBusy(undefined)
    }
  }

  const remove = async () => {
    if (!content || busy || !window.confirm('Apagar este conteúdo? Isso não tem volta.')) return
    setBusy('apagar')
    try {
      await deleteContent(content.id)
      navigate('/conteudos')
    } catch (error) {
      handle(error)
      setBusy(undefined)
    }
  }

  const project = projects.find((p) => p.id === projectId)

  const forward = async (kind: 'copy' | 'criativos') => {
    if (!content || busy) return
    if (dirty) return setProblem('Salve as mudanças antes de encaminhar: o material leva o texto salvo.')
    setBusy(kind)
    setProblem(undefined)
    try {
      const existing = kind === 'copy' ? copyLink : setLinkRow
      const run = kind === 'copy' ? forwardToCopy : forwardToCriativos
      const { path, created } = await run(content, ctx, existing, project ? { id: project.id, name: project.name } : undefined)
      if (created) toast.success(kind === 'copy' ? 'Documento criado no Copy, com o briefing do plano.' : 'Conjunto criado em Criativos, com o briefing do plano.')
      else if (!existing) toast.message(kind === 'copy' ? 'Este conteúdo já tinha um documento no Copy: abri o mesmo.' : 'Este conteúdo já tinha um conjunto em Criativos: abri o mesmo.')
      if (stale(content.id)) return
      navigate(path)
    } catch (error) {
      if (error instanceof MaterialUnavailable) setProblem(error.message)
      else handle(error)
      setBusy(undefined)
    }
  }

  const pullFromCopy = async () => {
    if (!content || !copyLink || busy) return
    // Trazer o texto do Copy recarrega o rascunho do servidor: com mudanças soltas elas se perderiam
    if (dirty) return setProblem('Salve ou descarte as mudanças antes de trazer o texto do Copy: ele troca o roteiro.')
    if (!window.confirm('Trocar o roteiro deste conteúdo pelo texto do documento do Copy? O roteiro atual será substituído (e, se o conteúdo estava aprovado, a aprovação cai).')) return
    setBusy('trazer')
    try {
      const text = await scriptFromCopy(copyLink)
      const next = await saveContent(content.id, content.version, { script: text })
      if (stale(content.id)) return
      setContent(next)
      setDraft(draftOf(next))
      const refreshed = await readCopy(copyLink)
      if (refreshed) await linkContent(content.id, 'copy', copyLink.artifactId, copyLink.projectId, await copyHash(refreshed))
      const fresh = await listLinks(content.id)
      if (stale(content.id)) return
      setLinks(fresh)
      toast.success('Roteiro atualizado com o texto do Copy.')
    } catch (error) {
      handle(error)
    } finally {
      setBusy(undefined)
    }
  }

  const pushToCopy = async () => {
    if (!content || !copyLink || busy) return
    if (dirty) return setProblem('Salve as mudanças antes de enviar o roteiro ao Copy.')
    setBusy('enviar')
    try {
      await scriptToCopy(content, copyLink)
      const fresh = await listLinks(content.id)
      // Os vínculos novos refazem a conferência lendo o documento de verdade
      if (stale(content.id)) return
      setLinks(fresh)
      toast.success('O documento do Copy agora tem o texto do roteiro.')
    } catch (error) {
      handle(error)
    } finally {
      setBusy(undefined)
    }
  }

  const unlink = async (kind: 'copy' | 'criativos') => {
    if (!content || busy) return
    setBusy(`desligar-${kind}`)
    try {
      await unlinkContent(content.id, kind)
      const fresh = await listLinks(content.id)
      if (stale(content.id)) return
      setLinks(fresh)
    } catch (error) {
      handle(error)
    } finally {
      setBusy(undefined)
    }
  }

  const checks = useMemo(() => [material.copy.check, material.criativos.check].filter((c): c is LinkCheck => !!c), [material])
  const copyPending = material.copy.loading || material.criativos.loading
  const brief = content && draft ? briefOf(ctx, { goal: draft.goal, idea: draft.idea, format: draft.format }) : undefined

  if (state === 'loading') {
    return (
      <Page>
        <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o conteúdo
        </p>
      </Page>
    )
  }
  if (state !== 'ready' || !content || !draft) {
    return (
      <Page>
        <Link to="/conteudos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Conteúdos
        </Link>
        <div role="alert" className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700">
          {state === 'missing' ? 'Este conteúdo não existe ou não é desta conta.' : state === 'sem-banco' ? 'Falta aplicar a migração 20261031041728 no Supabase.' : 'Não consegui ler este conteúdo.'}
          {state === 'error' && (
            <Button className="ml-3" size="sm" variant="outline" onClick={() => void load()}>
              Tentar de novo
            </Button>
          )}
        </div>
      </Page>
    )
  }

  const approvedSnapshot = snapshots.find((s) => s.kind === 'aprovacao' && s.contentVersion === content.approvedVersion)
  const actions = TRANSITION_ACTIONS[content.status]

  return (
    <Page>
      <Link to="/conteudos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Conteúdos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{content.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <StatusChip status={content.status} />
            <span>{formatLabel(content.format)}</span>
            <span>Versão {content.version}</span>
            <span>Atualizado {whenLabel(content.updatedAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => {
            const check = a.to === 'aprovado' ? canApprove(content, role, checks, dirty || copyPending) : checkTransition(content, a.to, role)
            const blocked = !check.ok || dirty || !!busy
            return (
              <Button key={a.to} variant={a.tone === 'primary' ? 'default' : 'outline'} size="sm" disabled={blocked} title={!check.ok ? check.reason : undefined} onClick={() => void moveTo(a.to)}>
                {busy === a.to && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                {a.label}
              </Button>
            )
          })}
        </div>
      </header>

      {/* Por que um botão está desligado, dito em texto (o title não chega a todo mundo) */}
      {(() => {
        const next = actions.find((a) => a.tone === 'primary')
        if (!next) return null
        const check = next.to === 'aprovado' ? canApprove(content, role, checks, dirty || copyPending) : checkTransition(content, next.to, role)
        const why = !check.ok ? check.reason : dirty ? 'Salve ou descarte as mudanças antes de mudar o estado.' : undefined
        return why ? <p className="mt-2 text-xs text-gray-500">{why}</p> : null
      })()}

      {conflict && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">Outra pessoa alterou este conteúdo enquanto você editava. Nada foi sobrescrito. Carregue a versão atual (seu rascunho será descartado).</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Carregar a versão atual
          </Button>
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {problem}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <form
          className="grid content-start gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Section title="Conteúdo">
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-800">Título</span>
                <input value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={cn(FIELD, 'h-9')} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-800">Ideia</span>
                <textarea rows={3} value={draft.idea} maxLength={4000} onChange={(e) => setDraft({ ...draft, idea: e.target.value })} className={cn(FIELD, 'py-2')} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-800">Objetivo</span>
                <input value={draft.goal} maxLength={600} placeholder={ctx?.goal ? `Do plano: ${ctx.goal.slice(0, 90)}` : undefined} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} className={cn(FIELD, 'h-9')} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-800">Formato</span>
                  <select value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as ContentFormat })} className={cn(FIELD, 'h-9')}>
                    {CONTENT_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-800">Data editorial <span className="font-normal text-gray-500">(opcional; não entra na aprovação)</span></span>
                  <input type="date" value={draft.editorialDate} onChange={(e) => setDraft({ ...draft, editorialDate: e.target.value })} className={cn(FIELD, 'h-9')} />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-800">Roteiro / texto</span>
                <textarea rows={14} value={draft.script} maxLength={20000} onChange={(e) => setDraft({ ...draft, script: e.target.value })} placeholder="Parágrafos separados por uma linha em branco." className={cn(FIELD, 'py-2 leading-relaxed')} />
                <span className="mt-1 block text-right text-[11px] tabular-nums text-gray-400" aria-hidden>
                  {draft.script.length}/20000
                </span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <Button type="submit" disabled={!dirty || !!invalid || !!busy || conflict}>
                {busy === 'salvar' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
                Salvar
              </Button>
              {dirty && !busy && (
                <Button type="button" variant="ghost" onClick={() => setDraft(draftOf(content))}>
                  Descartar
                </Button>
              )}
              <span className="text-xs text-gray-500" role="status">
                {invalid ?? (dirty ? (content.status === 'aprovado' ? 'Mudar o texto derruba a aprovação.' : 'Mudanças ainda não salvas.') : 'Tudo salvo.')}
              </span>
              {canManage(role) && content.status !== 'aprovado' && (
                <Button type="button" variant="ghost" size="sm" className="ml-auto text-red-700 hover:text-red-800" onClick={() => void remove()} disabled={!!busy}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Apagar
                </Button>
              )}
            </div>
          </Section>
        </form>

        <div className="grid content-start gap-5">
          <Section title="Aprovação">
            {approvalIsCurrent(content) ? (
              <div className="text-sm text-gray-700">
                <p className="flex items-start gap-2 font-medium text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Texto aprovado na versão {content.approvedVersion}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {nameOf(people, content.approvedBy) ?? 'Um gestor'} · {content.approvedAt ? whenLabel(content.approvedAt) : ''}
                  {approvedSnapshot?.contextVersion ? ` · plano v${approvedSnapshot.contextVersion}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">{content.status === 'revisao' ? 'Em revisão: um dono ou gestor da conta pode aprovar.' : 'Sem aprovação valendo.'}</p>
            )}
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>A aprovação vale só para o <strong>texto</strong> deste conteúdo (título, formato, objetivo, ideia e roteiro), na versão exata aprovada. <strong>Não cobre</strong> o design dos Criativos nem links externos. Qualquer edição do texto derruba a aprovação.</span>
            </p>
            {snapshots.length > 0 && (
              <details className="mt-3 text-xs text-gray-600">
                <summary className="cursor-pointer font-medium text-gray-700">Registros ({snapshots.length})</summary>
                <ul className="mt-2 grid gap-1.5">
                  {snapshots.map((s) => (
                    <li key={s.id} className="rounded-md border border-gray-100 p-2">
                      <span className="font-medium text-gray-800">{s.kind === 'aprovacao' ? 'Aprovação' : 'Enviado para revisão'}</span> · v{s.contentVersion} · {whenLabel(s.createdAt)}
                      {nameOf(people, s.createdBy) ? ` · ${nameOf(people, s.createdBy)}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          <Section title="Briefing do plano">
            {brief && (
              <dl className="grid gap-2 text-xs text-gray-600">
                {([['Objetivo', brief.objective], ['Público', brief.audience], ['Oferta', brief.offer], ['Tom', brief.tone]] as const).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-medium text-gray-800">{k}</dt>
                    <dd className="whitespace-pre-line">{v || <span className="text-gray-400">Não preenchido</span>}</dd>
                  </div>
                ))}
                {ctx?.pillars.length ? (
                  <div>
                    <dt className="font-medium text-gray-800">Pilares</dt>
                    <dd>{ctx.pillars.join(' · ')}</dd>
                  </div>
                ) : null}
                {ctx?.restrictions && (
                  <div>
                    <dt className="font-medium text-gray-800">Restrições</dt>
                    <dd className="whitespace-pre-line">{ctx.restrictions}</dd>
                  </div>
                )}
              </dl>
            )}
            <p className="mt-3 text-xs text-gray-500">
              {ctx ? `Plano versão ${ctx.version}.` : 'A conta ainda não tem plano.'} {missingContext(ctx).length > 0 && <>Falta: {missingContext(ctx).join(' e ')}. </>}
              <Link to="/plano" className="font-medium text-gray-800 underline underline-offset-2">{canManage(role) ? 'Editar o plano' : 'Ver o plano'}</Link>
            </p>
          </Section>

          <Section title="Material ligado">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Onde guardar ao criar</span>
              <select value={projectId} disabled={!!copyLink && !!setLinkRow} onChange={(e) => setProjectId(e.target.value)} className={cn(FIELD, 'h-8 text-xs')}>
                <option value="">Só para mim (pasta pessoal)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    Projeto {p.name} (a equipe do projeto abre)
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-gray-500">Sem projeto, só quem criou abre o material. Vale para o que for criado agora.</span>
            </label>

            {(['copy', 'criativos'] as const).map((kind) => {
              const link = kind === 'copy' ? copyLink : setLinkRow
              const m = material[kind]
              const Icon = kind === 'copy' ? FileText : Images
              const name = kind === 'copy' ? 'Copy' : 'Criativos'
              if (kind === 'criativos' && team && team.modules.criativos === false) return null
              return (
                <div key={kind} className="mt-4 border-t border-gray-100 pt-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Icon className="h-4 w-4" aria-hidden /> {name}
                  </p>
                  {link && m.loading && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Conferindo o material</p>}
                  {link && m.check && (
                    <p className={cn('mt-1 text-xs', m.check.state === 'igual' ? 'text-gray-600' : 'text-amber-800')} role={m.check.blocksApproval ? 'alert' : undefined}>
                      {m.check.note}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant={link ? 'outline' : 'default'} disabled={!!busy} onClick={() => void forward(kind)}>
                      {busy === kind && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                      {link ? <><ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Abrir no {name}</> : `Encaminhar para ${name}`}
                    </Button>
                    {link && kind === 'copy' && m.check?.state === 'diferente' && (
                      <>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void pullFromCopy()}>Trazer o texto do Copy</Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void pushToCopy()}>Enviar o roteiro ao Copy</Button>
                      </>
                    )}
                    {link && (
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void unlink(kind)}>
                        Desligar
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            <p className="mt-3 text-xs text-gray-500">O mesmo documento e o mesmo conjunto abrem sempre: encaminhar de novo não cria cópias.</p>
          </Section>
        </div>
      </div>
    </Page>
  )
}

export default ContentDetail
