import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Check, CircleAlert, Info, Loader2, Lock, Plug, Plus, RefreshCw, X } from 'lucide-react'
import { McpDialog } from '@/features/crm/McpDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { nameOf, useTeamPeople } from '@/features/crm/people'
import { Page, PageHeader, whenLabel } from '@/features/crm/ui'
import { ContentError, ContentTablesError, loadContext, saveContext, type ContextDraft } from '@/features/conteudos/api'
import { CONTEXT_LIMITS, canManage, validateContextDraft, type AccountContext } from '@/features/conteudos/rules'

/**
 * Plano da empresa (/plano): o contexto que todo conteúdo, Copy e Criativos reaproveitam.
 * Dono e gestor editam; os outros membros leem. Cada gravação é uma versão nova e só vale
 * se a pessoa partiu da versão mais recente (se outra pessoa salvou antes, a tela avisa e
 * não sobrescreve).
 *
 * Layout no estilo dos Ajustes da Apple: progresso no topo, seções agrupadas com índice
 * lateral, pilares como etiquetas e uma barra flutuante de salvar (⌘S) que só aparece com
 * mudanças.
 */

const EMPTY: ContextDraft = { offer: '', audience: '', tone: '', goal: '', restrictions: '', pillars: [] }

const draftOf = (c: AccountContext | null): ContextDraft => (c ? { offer: c.offer, audience: c.audience, tone: c.tone, goal: c.goal, restrictions: c.restrictions, pillars: c.pillars } : EMPTY)

const clean = (d: ContextDraft) => ({ ...d, pillars: d.pillars.map((p) => p.trim()).filter(Boolean) })
const same = (a: ContextDraft, b: ContextDraft) => JSON.stringify(clean(a)) === JSON.stringify(clean(b))

type TextKey = 'offer' | 'audience' | 'tone' | 'goal' | 'restrictions'
type PartKey = TextKey | 'pillars'

interface Part {
  key: PartKey
  label: string
  hint: string
  example?: string
  required?: boolean
  rows?: number
}

const SECTIONS: { id: string; title: string; text: string; parts: Part[] }[] = [
  {
    id: 'negocio',
    title: 'O negócio',
    text: 'O que a empresa vende, para quem e o que precisa acontecer agora.',
    parts: [
      { key: 'offer', label: 'Oferta', required: true, hint: 'O que a empresa vende e o que muda para quem compra.', example: 'Ex.: Clínica de fisioterapia no Centro. Tratamento de dor nas costas em 8 sessões, com avaliação no primeiro dia.' },
      { key: 'audience', label: 'Público', required: true, hint: 'Quem compra, onde está e o que já tentou.', example: 'Ex.: Adultos de 35 a 60 anos da cidade, que trabalham sentados e já tentaram remédio e academia.' },
      { key: 'goal', label: 'Objetivo', rows: 2, hint: 'O que o marketing precisa conseguir neste momento.', example: 'Ex.: 30 avaliações agendadas por mês pelo WhatsApp.' },
    ],
  },
  {
    id: 'voz',
    title: 'A voz',
    text: 'Como a empresa fala e o que nunca entra.',
    parts: [
      { key: 'tone', label: 'Tom de voz', rows: 2, hint: 'Como a empresa fala: formal, direto, próximo… e como não fala.', example: 'Ex.: Próximo e claro, sem jargão técnico. Nada de “milagre” ou “resultado garantido”.' },
      { key: 'restrictions', label: 'Restrições', rows: 2, hint: 'O que nunca entra: promessas, termos proibidos, regras do setor.', example: 'Ex.: Não mostrar preço. Não usar antes e depois (regra do conselho).' },
    ],
  },
  {
    id: 'conteudo',
    title: 'O conteúdo',
    text: 'Os assuntos que a empresa sempre aborda.',
    parts: [{ key: 'pillars', label: 'Pilares de conteúdo', hint: `Até ${CONTEXT_LIMITS.pillars} assuntos, com até ${CONTEXT_LIMITS.pillar} caracteres cada.` }],
  },
]

const PARTS = SECTIONS.flatMap((s) => s.parts)
const filled = (d: ContextDraft, key: PartKey) => (key === 'pillars' ? d.pillars.some((p) => p.trim()) : !!d[key].trim())

/** Caixa de texto que cresce com o conteúdo (Safari ainda não tem `field-sizing`). */
const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }> = ({ minRows = 3, className, value, ...props }) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} rows={minRows} value={value} className={cn('resize-none overflow-hidden', className)} {...props} />
}

const TextPart: React.FC<{ part: Part; value: string; readOnly: boolean; onChange: (v: string) => void }> = ({ part, value, readOnly, onChange }) => {
  const id = `plano-${part.key}`
  const max = CONTEXT_LIMITS[part.key as TextKey]
  const near = value.length > max * 0.8
  return (
    <div className="px-4 py-4 md:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-gray-900">
          {part.label}
          {part.required && <span className="ml-1.5 text-[11px] font-medium text-gray-400">obrigatório</span>}
        </label>
        {!readOnly && near && (
          <span className={cn('text-[11px] tabular-nums', value.length >= max ? 'text-red-600' : 'text-gray-400')} aria-live="polite">
            {value.length}/{max}
          </span>
        )}
      </div>
      <p id={`${id}-hint`} className="mt-0.5 text-xs text-gray-500">
        {part.hint}
      </p>
      {readOnly ? (
        <p className={cn('mt-2 whitespace-pre-wrap text-sm leading-relaxed', value.trim() ? 'text-gray-800' : 'italic text-gray-400')}>{value.trim() || 'Ainda não preenchido.'}</p>
      ) : (
        <AutoTextarea
          id={id}
          aria-describedby={`${id}-hint`}
          minRows={part.rows ?? 3}
          value={value}
          maxLength={max}
          placeholder={part.example}
          onChange={(e) => onChange(e.target.value)}
          className="se-field mt-2 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus-visible:outline-none"
        />
      )}
    </div>
  )
}

const PillarsPart: React.FC<{ part: Part; pillars: string[]; readOnly: boolean; onChange: (v: string[]) => void }> = ({ part, pillars, readOnly, onChange }) => {
  const [text, setText] = useState('')
  const list = pillars.map((p) => p.trim()).filter(Boolean)
  const full = list.length >= CONTEXT_LIMITS.pillars
  const add = () => {
    const value = text.trim().slice(0, CONTEXT_LIMITS.pillar)
    if (!value || full) return
    if (list.some((p) => p.toLowerCase() === value.toLowerCase())) {
      setText('')
      return
    }
    onChange([...list, value])
    setText('')
  }
  return (
    <div className="px-4 py-4 md:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="plano-pilares" className="text-[13px] font-semibold text-gray-900">
          {part.label}
        </label>
        <span className="text-[11px] tabular-nums text-gray-400">
          {list.length}/{CONTEXT_LIMITS.pillars}
        </span>
      </div>
      <p id="plano-pilares-hint" className="mt-0.5 text-xs text-gray-500">
        {part.hint}
      </p>
      {list.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Pilares">
          {list.map((p, i) => (
            <li key={`${p}-${i}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-gray-100 pl-3 pr-1 text-[13px] font-medium text-gray-800">
              {p}
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => onChange(list.filter((_, j) => j !== i))}
                  className="grid h-6 w-6 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
                  aria-label={`Tirar o pilar ${p}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <span className="w-2" />
              )}
            </li>
          ))}
        </ul>
      )}
      {readOnly && list.length === 0 && <p className="mt-2 text-sm italic text-gray-400">Ainda não preenchido.</p>}
      {!readOnly && (
        <div className="mt-3 flex gap-2">
          <input
            id="plano-pilares"
            aria-describedby="plano-pilares-hint"
            value={text}
            maxLength={CONTEXT_LIMITS.pillar}
            disabled={full}
            placeholder={full ? 'Limite de pilares atingido' : list.length ? 'Outro pilar e Enter' : 'Ex.: Dicas de postura no trabalho'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                add()
              } else if (e.key === 'Backspace' && !text && list.length) {
                onChange(list.slice(0, -1))
              }
            }}
            className="se-field h-10 min-w-0 flex-1 rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none disabled:bg-gray-50"
          />
          <Button type="button" variant="secondary" onClick={add} disabled={!text.trim() || full} aria-label="Adicionar pilar">
            <Plus className="h-4 w-4" aria-hidden /> Adicionar
          </Button>
        </div>
      )}
    </div>
  )
}

const Progress: React.FC<{ done: number; total: number; missingRequired: string[] }> = ({ done, total, missingRequired }) => {
  const pct = Math.round((done / total) * 100)
  const complete = done === total
  return (
    <div className="se-surface flex items-center gap-4 !p-4 md:!p-5">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center" aria-hidden>
        <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(0 0 0 / .07)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={complete ? '#34c759' : '#1d1d1f'} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} className="transition-[stroke-dasharray] duration-500" />
        </svg>
        <span className="absolute text-[11px] font-semibold tabular-nums text-gray-900">{complete ? <Check className="h-4 w-4 text-[#34c759]" /> : `${done}/${total}`}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{complete ? 'Plano completo' : `${done} de ${total} partes preenchidas`}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {missingRequired.length
            ? `Falta ${missingRequired.join(' e ')}: sem isso o briefing dos conteúdos sai incompleto.`
            : complete
              ? 'Todo conteúdo, texto e criativo já parte deste contexto.'
              : 'O básico está pronto. As outras partes deixam o briefing mais preciso.'}
        </p>
      </div>
    </div>
  )
}

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
  const [mcpOpen, setMcpOpen] = useState(false)

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
  const done = PARTS.filter((p) => filled(draft, p.key)).length
  const missingRequired = PARTS.filter((p) => p.required && !filled(draft, p.key)).map((p) => p.label.toLowerCase())
  const canSave = manager && dirty && !saving && !invalid && !conflict

  // Quem sai da tela com mudanças não salvas é avisado pelo navegador
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = useCallback(async () => {
    if (!team || saving || invalid) return
    setSaving(true)
    setProblem(undefined)
    try {
      const saved = await saveContext(team.id, ctx?.version ?? 0, clean(draft))
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
  }, [team, saving, invalid, ctx, draft])

  // ⌘S / Ctrl+S salva
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (canSave) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSave, save])

  if (teamStatus === 'ready' && !team) {
    return (
      <Page>
        <PageHeader title="Plano" text="O Plano é de uma conta de empresa. Peça um convite em Equipe." />
      </Page>
    )
  }

  const profile = team?.profile
  const author = ctx ? nameOf(people, ctx.updatedBy) : undefined

  return (
    <Page>
      <PageHeader title="Plano da empresa" text={`O contexto de ${team?.name ?? 'sua conta'} que todo conteúdo, texto e criativo reaproveita. Escreva uma vez; o briefing sai daqui.`}>
        {team && (
          <Button type="button" variant="outline" size="sm" onClick={() => setMcpOpen(true)}>
            <Plug className="h-3.5 w-3.5" aria-hidden /> Conectar sua IA
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/conteudos">
            Ir para Conteúdos <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </PageHeader>

      {team && <McpDialog open={mcpOpen} onOpenChange={setMcpOpen} teamId={team.id} teamName={team.name} />}

      {state === 'loading' && (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o plano
        </p>
      )}

      {state === 'sem-banco' && (
        <p role="alert" className="mt-8 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          O Plano ainda não está disponível: falta aplicar a migração 20261031041728 no Supabase.
        </p>
      )}

      {state === 'error' && (
        <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> Não consegui ler o plano.
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {state === 'ready' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
          {/* Índice lateral: cada seção com o estado de preenchimento */}
          <aside className="hidden lg:block">
            <nav className="sticky top-6 grid gap-6" aria-label="Seções do plano">
              <ul className="grid gap-0.5">
                {SECTIONS.map((s) => {
                  const ok = s.parts.every((p) => filled(draft, p.key))
                  const count = s.parts.filter((p) => filled(draft, p.key)).length
                  return (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="se-nav-item flex items-center justify-between gap-2 px-2.5 text-gray-700 hover:text-gray-900">
                        {s.title}
                        {ok ? (
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#34c759] text-white" aria-label="completo">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                          </span>
                        ) : (
                          <span className="text-[11px] tabular-nums text-gray-400">
                            {count}/{s.parts.length}
                          </span>
                        )}
                      </a>
                    </li>
                  )
                })}
              </ul>

              <div className="grid gap-2 border-t border-black/5 pt-5 text-xs leading-relaxed text-gray-500">
                <p className="flex items-center gap-1.5 font-semibold text-gray-700">
                  <Info className="h-3.5 w-3.5" aria-hidden /> Onde o plano é usado
                </p>
                <p>No briefing de Conteúdos, do Copy e dos Criativos, e no registro de cada aprovação.</p>
                <p>Documentos que já existem não mudam: a versão usada fica guardada neles.</p>
              </div>

              {ctx && (
                <p className="border-t border-black/5 pt-5 text-xs leading-relaxed text-gray-500">
                  Versão {ctx.version}
                  <br />
                  {whenLabel(ctx.updatedAt)}
                  {author ? ` · ${author}` : ''}
                </p>
              )}
            </nav>
          </aside>

          <form
            className="grid min-w-0 gap-8 pb-28"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave) void save()
            }}
          >
            <div className="grid gap-3">
              <Progress done={done} total={PARTS.length} missingRequired={missingRequired} />

              {!manager && (
                <p className="flex items-start gap-2 rounded-[14px] bg-black/[.04] p-3.5 text-sm text-gray-600">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Só dono e gestor da conta editam o plano. Você vê o que está valendo.
                </p>
              )}
              {!ctx && manager && <p className="rounded-[14px] bg-black/[.04] p-3.5 text-sm text-gray-600">Este plano ainda está vazio. Nada foi preenchido por nós: escreva com o que a empresa realmente diz e faz.</p>}

              {conflict && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">Outra pessoa salvou o plano enquanto você editava. Nada foi sobrescrito. Carregue a versão atual (seu rascunho será descartado).</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Carregar a versão atual
                  </Button>
                </div>
              )}
              {problem && (
                <p role="alert" className="rounded-[14px] border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                  {problem}
                </p>
              )}
            </div>

            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-6" aria-labelledby={`${s.id}-title`}>
                <div className="mb-2.5 px-1">
                  <h2 id={`${s.id}-title`} className="text-[15px] font-semibold tracking-tight text-gray-900">
                    {s.title}
                  </h2>
                  <p className="text-xs text-gray-500">{s.text}</p>
                </div>
                {/* Lista agrupada (inset grouped): um cartão, partes separadas por linha fina */}
                <div className="se-surface divide-y divide-black/[.06] overflow-hidden !p-0">
                  {s.parts.map((part) =>
                    part.key === 'pillars' ? (
                      <PillarsPart key={part.key} part={part} pillars={draft.pillars} readOnly={!manager} onChange={(v) => setDraft({ ...draft, pillars: v })} />
                    ) : (
                      <TextPart key={part.key} part={part} value={draft[part.key as TextKey]} readOnly={!manager} onChange={(v) => setDraft({ ...draft, [part.key]: v })} />
                    )
                  )}
                </div>
              </section>
            ))}

            {(profile?.segment || profile?.website) && (
              <section aria-labelledby="cadastro-title">
                <div className="mb-2.5 px-1">
                  <h2 id="cadastro-title" className="text-[15px] font-semibold tracking-tight text-gray-900">
                    Já no cadastro da conta
                  </h2>
                  <p className="text-xs text-gray-500">Só para consulta: o cadastro não é copiado nem alterado pelo plano.</p>
                </div>
                <dl className="se-surface divide-y divide-black/[.06] overflow-hidden !p-0 text-sm">
                  {profile.segment && (
                    <div className="flex justify-between gap-4 px-4 py-3 md:px-5">
                      <dt className="text-gray-500">Segmento</dt>
                      <dd className="text-right text-gray-900">{profile.segment}</dd>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex justify-between gap-4 px-4 py-3 md:px-5">
                      <dt className="text-gray-500">Site</dt>
                      <dd className="min-w-0 break-all text-right text-gray-900">{profile.website}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Barra flutuante de salvar: aparece só com mudanças */}
            {manager && (
              <div
                className={cn(
                  'se-glass fixed bottom-4 left-1/2 z-30 flex w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 items-center gap-3 !rounded-2xl px-4 py-2.5 transition-all duration-300 md:left-[calc(50%+126px-var(--iara-dock,0px)/2)]',
                  dirty || saving ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
                )}
                aria-hidden={!(dirty || saving)}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-gray-600" role="status">
                  {invalid ?? (saving ? 'Salvando…' : 'Mudanças não salvas')}
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setDraft(draftOf(ctx))} tabIndex={dirty ? 0 : -1}>
                  Descartar
                </Button>
                <Button type="submit" size="sm" disabled={!canSave} tabIndex={dirty ? 0 : -1}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {ctx ? 'Salvar versão' : 'Salvar plano'}
                  <kbd className="ml-1 hidden rounded bg-white/15 px-1 text-[10px] font-medium sm:inline">⌘S</kbd>
                </Button>
              </div>
            )}
          </form>
        </div>
      )}
    </Page>
  )
}

export default Plan
