import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleAlert, Loader2, Lock, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { nameOf, useTeamPeople } from '@/features/crm/people'
import { FIELD, Page, PageHeader, whenLabel } from '@/features/crm/ui'
import { ContentError, ContentTablesError, loadContext, saveContext, type ContextDraft } from '@/features/conteudos/api'
import { CONTEXT_LIMITS, canManage, missingContext, validateContextDraft, type AccountContext } from '@/features/conteudos/rules'

/**
 * Plano da empresa (/plano): o contexto que todo conteúdo, Copy e Criativos reaproveitam.
 * Dono e gestor editam; os outros membros leem. Cada gravação é uma versão nova e só vale
 * se a pessoa partiu da versão mais recente (se outra pessoa salvou antes, a tela avisa e
 * não sobrescreve).
 */

const EMPTY: ContextDraft = { offer: '', audience: '', tone: '', goal: '', restrictions: '', pillars: [] }

const draftOf = (c: AccountContext | null): ContextDraft => (c ? { offer: c.offer, audience: c.audience, tone: c.tone, goal: c.goal, restrictions: c.restrictions, pillars: c.pillars } : EMPTY)

const same = (a: ContextDraft, b: ContextDraft) => JSON.stringify({ ...a, pillars: a.pillars.map((p) => p.trim()).filter(Boolean) }) === JSON.stringify({ ...b, pillars: b.pillars.map((p) => p.trim()).filter(Boolean) })

const Field: React.FC<{ id: string; label: string; hint: string; value: string; max: number; rows?: number; readOnly: boolean; placeholder?: string; onChange: (v: string) => void }> = ({ id, label, hint, value, max, rows = 4, readOnly, placeholder, onChange }) => (
  <div>
    <label htmlFor={id} className="text-sm font-medium text-gray-900">
      {label}
    </label>
    <p id={`${id}-hint`} className="mt-0.5 text-xs text-gray-500">
      {hint}
    </p>
    <textarea
      id={id}
      aria-describedby={`${id}-hint`}
      rows={rows}
      value={value}
      maxLength={max}
      readOnly={readOnly}
      placeholder={readOnly ? 'Ainda não preenchido.' : placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD, 'mt-1.5 py-2 leading-relaxed', readOnly && 'bg-gray-50 text-gray-700')}
    />
    {!readOnly && (
      <p className="mt-1 text-right text-[11px] tabular-nums text-gray-400" aria-hidden>
        {value.length}/{max}
      </p>
    )}
  </div>
)

const Plan: React.FC = () => {
  const team = useCrm((s) => s.team)
  const teamStatus = useCrm((s) => s.status)
  const people = useTeamPeople(team?.id)
  const manager = canManage(team?.role)

  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'sem-banco'>('loading')
  const [ctx, setCtx] = useState<AccountContext | null>(null)
  const [draft, setDraft] = useState<ContextDraft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [problem, setProblem] = useState<string>()

  const load = useCallback(async () => {
    if (!team) return
    setState('loading')
    try {
      const c = await loadContext(team.id)
      setCtx(c)
      setDraft(draftOf(c))
      setConflict(false)
      setProblem(undefined)
      setState('ready')
    } catch (error) {
      console.error('[plano] falha ao ler', error)
      setState(error instanceof ContentTablesError ? 'sem-banco' : 'error')
    }
  }, [team])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = state === 'ready' && !same(draft, draftOf(ctx))
  const invalid = useMemo(() => validateContextDraft({ ...draft, pillars: draft.pillars }), [draft])
  const missing = missingContext(draft)

  // Quem sai da tela com mudanças não salvas é avisado pelo navegador
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async () => {
    if (!team || saving || invalid) return
    setSaving(true)
    setProblem(undefined)
    try {
      const saved = await saveContext(team.id, ctx?.version ?? 0, { ...draft, pillars: draft.pillars.map((p) => p.trim()).filter(Boolean) })
      setCtx(saved)
      setDraft(draftOf(saved))
      setConflict(false)
      toast.success(`Plano salvo (versão ${saved.version}).`)
    } catch (error) {
      if (error instanceof ContentError && error.kind === 'conflito') setConflict(true)
      else setProblem(error instanceof Error ? error.message : 'Não consegui salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (teamStatus === 'ready' && !team) {
    return (
      <Page>
        <PageHeader title="Plano" text="O Plano é de uma conta de empresa. Peça um convite em Equipe." />
      </Page>
    )
  }

  const profile = team?.profile
  const pillarsText = draft.pillars.join('\n')

  return (
    <Page>
      <PageHeader title="Plano da empresa" text={`O contexto de ${team?.name ?? 'sua conta'} que todo conteúdo, texto e criativo reaproveita. Escreva uma vez; o briefing sai daqui.`}>
        {state === 'ready' && ctx && (
          <span className="text-xs text-gray-500">
            Versão {ctx.version} · {whenLabel(ctx.updatedAt)}
            {nameOf(people, ctx.updatedBy) ? ` · ${nameOf(people, ctx.updatedBy)}` : ''}
          </span>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/conteudos">Ir para Conteúdos</Link>
        </Button>
      </PageHeader>

      {state === 'loading' && (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o plano
        </p>
      )}

      {state === 'sem-banco' && (
        <p role="alert" className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          O Plano ainda não está disponível: falta aplicar a migração 20261031041728 no Supabase.
        </p>
      )}

      {state === 'error' && (
        <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> Não consegui ler o plano.
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {state === 'ready' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form
            className="grid gap-6 rounded-xl bg-white p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] md:p-6"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            {!manager && (
              <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Só dono e gestor da conta editam o plano. Você vê o que está valendo.
              </p>
            )}
            {!ctx && manager && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Este plano ainda está vazio. Nada foi preenchido por nós: escreva com o que a empresa realmente diz e faz.</p>}

            {conflict && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">Outra pessoa salvou o plano enquanto você editava. Nada foi sobrescrito. Carregue a versão atual (seu rascunho será descartado).</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Carregar a versão atual
                </Button>
              </div>
            )}
            {problem && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {problem}
              </p>
            )}

            <Field id="plano-oferta" label="Oferta" hint="O que a empresa vende e o que muda para quem compra." value={draft.offer} max={CONTEXT_LIMITS.offer} readOnly={!manager} onChange={(v) => setDraft({ ...draft, offer: v })} />
            <Field id="plano-publico" label="Público" hint="Quem compra, onde está e o que já tentou." value={draft.audience} max={CONTEXT_LIMITS.audience} readOnly={!manager} onChange={(v) => setDraft({ ...draft, audience: v })} />
            <Field id="plano-tom" label="Tom de voz" hint="Como a empresa fala: formal, direto, próximo… e como não fala." value={draft.tone} max={CONTEXT_LIMITS.tone} rows={3} readOnly={!manager} onChange={(v) => setDraft({ ...draft, tone: v })} />
            <Field id="plano-objetivo" label="Objetivo" hint="O que o marketing precisa conseguir neste momento." value={draft.goal} max={CONTEXT_LIMITS.goal} rows={3} readOnly={!manager} onChange={(v) => setDraft({ ...draft, goal: v })} />
            <Field
              id="plano-pilares"
              label="Pilares de conteúdo"
              hint={`Os assuntos que a empresa sempre aborda. Um por linha, até ${CONTEXT_LIMITS.pillars}, com até ${CONTEXT_LIMITS.pillar} caracteres cada.`}
              value={pillarsText}
              max={CONTEXT_LIMITS.pillars * (CONTEXT_LIMITS.pillar + 1)}
              rows={4}
              readOnly={!manager}
              onChange={(v) => setDraft({ ...draft, pillars: v.split('\n') })}
            />
            <Field id="plano-restricoes" label="Restrições" hint="O que nunca entra: promessas, termos proibidos, regras do setor." value={draft.restrictions} max={CONTEXT_LIMITS.restrictions} rows={3} readOnly={!manager} onChange={(v) => setDraft({ ...draft, restrictions: v })} />

            {manager && (
              <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                <Button type="submit" disabled={!dirty || saving || !!invalid || conflict}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
                  {saving ? 'Salvando' : ctx ? 'Salvar nova versão' : 'Salvar o plano'}
                </Button>
                {dirty && !saving && (
                  <Button type="button" variant="ghost" onClick={() => setDraft(draftOf(ctx))}>
                    Descartar mudanças
                  </Button>
                )}
                <span className="text-xs text-gray-500" role="status">
                  {invalid ?? (dirty ? 'Mudanças ainda não salvas.' : ctx ? 'Tudo salvo.' : '')}
                </span>
              </div>
            )}
          </form>

          <aside className="grid content-start gap-4 text-sm">
            <section className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
              <h2 className="text-sm font-semibold text-gray-900">Onde o plano é usado</h2>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-gray-600">
                <li>No briefing de cada conteúdo em Conteúdos.</li>
                <li>No briefing do documento criado no Copy.</li>
                <li>No briefing do conjunto criado em Criativos.</li>
                <li>No snapshot de cada submissão e aprovação, com a versão do plano que valia.</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">Documentos que já existem não mudam quando o plano muda: a versão usada fica registrada neles.</p>
            </section>
            {manager && missing.length > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Falta preencher: {missing.join(' e ')}. Sem isso o briefing dos conteúdos sai incompleto.</p>
            )}
            {(profile?.segment || profile?.website) && (
              <section className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
                <h2 className="text-sm font-semibold text-gray-900">Já no cadastro da conta</h2>
                <dl className="mt-2 space-y-1 text-xs text-gray-600">
                  {profile.segment && (
                    <div>
                      <dt className="inline font-medium text-gray-700">Segmento: </dt>
                      <dd className="inline">{profile.segment}</dd>
                    </div>
                  )}
                  {profile.website && (
                    <div>
                      <dt className="inline font-medium text-gray-700">Site: </dt>
                      <dd className="inline break-all">{profile.website}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-2 text-xs text-gray-500">Só para consulta: o cadastro não é copiado nem alterado pelo plano.</p>
              </section>
            )}
          </aside>
        </div>
      )}
    </Page>
  )
}

export default Plan
