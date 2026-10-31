import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { FormsTablesError, TEMPLATES, blankDefinition, createForm, deleteForm, listForms, submissionCounts, type CrmForm } from '@/features/crm/forms'
import { Page, PageHeader, Surface, plural, whenLabel } from '@/features/crm/ui'
import { THEME_DEFAULT, SETTINGS_DEFAULT } from '@/features/crm/forms'
import { cn } from '@/lib/utils'

/**
 * Formulários (CRM › Formulários): os formulários e quizzes da conta que vão embedados no site do
 * cliente (Elementor) no lugar do formulário do WordPress. Cada resposta vira um lead no funil.
 */

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const FormsPage: React.FC = () => {
  const { team } = useCrm()
  const navigate = useNavigate()
  const [forms, setForms] = useState<CrmForm[] | null>(null)
  const [counts, setCounts] = useState<Record<string, { total: number; qualified: number }>>({})
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const manager = team?.role === 'owner' || team?.role === 'admin'

  const load = useCallback(async () => {
    if (!team) return
    try {
      const [list, c] = await Promise.all([listForms(team.id), submissionCounts(team.id)])
      setForms(list)
      setCounts(c)
      setError(undefined)
    } catch (e) {
      setError(errorText(e))
      setForms([])
    }
  }, [team])

  useEffect(() => {
    setForms(null)
    void load()
  }, [load])

  const create = async (name: string, definition: ReturnType<typeof blankDefinition>, settings = SETTINGS_DEFAULT, key = 'blank') => {
    if (!team) return
    setBusy(key)
    try {
      const form = await createForm(team.id, name, definition, THEME_DEFAULT, settings)
      navigate(`/crm/formularios/${form.id}`)
    } catch (e) {
      toast.error(errorText(e))
      setBusy(undefined)
    }
  }

  return (
    <Page>
      <PageHeader title="Formulários" text="Monte formulários e quizzes aqui, coloque no Elementor no lugar do formulário do WordPress e receba cada resposta como lead no funil." />
      {!team || forms === null ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo os formulários…
        </p>
      ) : error ? (
        <Surface className="mt-6 max-w-2xl">
          <p className="text-sm text-rose-700">{error}</p>
          {error === new FormsTablesError().message && <p className="mt-2 text-sm text-gray-600">Aplique a migração e abra esta tela de novo.</p>}
        </Surface>
      ) : (
        <div className="mt-6 grid gap-6">
          <section aria-labelledby="novo">
            <h2 id="novo" className="mb-3 text-sm font-semibold text-gray-900">
              Criar
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!!busy}
                  onClick={() => void create(t.name, t.definition(), { ...SETTINGS_DEFAULT, ...t.settings }, t.id)}
                  className="rounded-xl bg-white p-4 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition hover:shadow-[0_0_0_1px_rgb(124_58_237/0.4)] disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4 text-violet-600" />} {t.name}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{t.text}</span>
                </button>
              ))}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void create('Novo formulário', blankDefinition('form'))}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-sm font-medium text-gray-600 hover:border-violet-400 hover:text-violet-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Em branco
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void create('Novo quiz', blankDefinition('quiz'), { ...SETTINGS_DEFAULT, autoAdvance: true })}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-sm font-medium text-gray-600 hover:border-violet-400 hover:text-violet-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Quiz em branco
              </button>
            </div>
          </section>

          <section aria-labelledby="lista">
            <h2 id="lista" className="mb-3 text-sm font-semibold text-gray-900">
              {plural(forms.length, 'formulário', 'formulários')}
            </h2>
            {!forms.length ? (
              <Surface>
                <p className="py-4 text-center text-sm text-gray-500">Nenhum formulário ainda. Comece por um modelo acima.</p>
              </Surface>
            ) : (
              <ul className="grid gap-2">
                {forms.map((f) => {
                  const c = counts[f.id] ?? { total: 0, qualified: 0 }
                  const rate = f.views > 0 ? Math.min(100, Math.round((c.total / f.views) * 1000) / 10) : undefined
                  return (
                    <li key={f.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
                      <Link to={`/crm/formularios/${f.id}`} className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900">{f.name}</span>
                          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{f.kind === 'quiz' ? 'Quiz' : 'Formulário'}</span>
                          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium', f.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>{f.status === 'published' ? 'Publicado' : 'Rascunho'}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {plural(c.total, 'resposta', 'respostas')}
                          {f.kind === 'quiz' && c.total > 0 && ` · ${c.qualified} qualificadas`}
                          {rate !== undefined && ` · ${f.views} visualizações · ${String(rate).replace('.', ',')}% convertem`} · atualizado {whenLabel(f.updatedAt)}
                        </span>
                      </Link>
                      {manager && (
                        <button
                          type="button"
                          className="rounded p-2 text-gray-400 hover:bg-zinc-100 hover:text-rose-600"
                          aria-label={`Apagar ${f.name}`}
                          onClick={() => {
                            if (!window.confirm(`Apagar “${f.name}” e as ${c.total} respostas? Os leads já criados no funil continuam.`)) return
                            deleteForm(f.id).then(() => setForms((list) => (list ?? []).filter((x) => x.id !== f.id)), (e) => toast.error(errorText(e)))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  )
}

export default FormsPage
