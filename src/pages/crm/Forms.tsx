import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { Bars, Card, Donut } from '@/features/home/HomeCharts'
import { FormsTablesError, TEMPLATES, blankDefinition, createForm, deleteForm, listForms, submissionCounts, type CrmForm } from '@/features/crm/forms'
import { Page, PageHeader, Surface, plural, whenLabel } from '@/features/crm/ui'
import { THEME_DEFAULT, SETTINGS_DEFAULT } from '@/features/crm/forms'
import { cn } from '@/lib/utils'

/**
 * Formulários (CRM › Formulários): os formulários e quizzes da conta que vão embedados no site do
 * cliente (Elementor) no lugar do formulário do WordPress. Cada resposta vira um lead no funil.
 */

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const TINTS: [string, string][] = [['#2D83EE', '#8B5CF6'], ['#34C759', '#14B8A6'], ['#FF9F0A', '#FF375F'], ['#8B5CF6', '#FF375F'], ['#14B8A6', '#2D83EE']]
const tint = (id: string) => TINTS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]

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
                  className="group rounded-2xl bg-white p-4 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-14px_rgb(0_0_0/0.14)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_16px_36px_-14px_rgb(0_0_0/0.22)] active:scale-[0.97] disabled:opacity-60"
                >
                  <span className="mb-3 flex h-24 flex-col justify-end gap-1.5 rounded-xl p-3" style={{ background: `linear-gradient(150deg, ${tint(t.id)[0]}, ${tint(t.id)[1]})` }} aria-hidden>
                    <i className="block h-2 w-2/3 rounded-full bg-white/80" /><i className="block h-2 w-1/2 rounded-full bg-white/55" /><i className="block h-4 w-1/3 rounded-md bg-white/90" />
                  </span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4 text-gray-500" />} {t.name}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{t.text}</span>
                </button>
              ))}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void create('Novo formulário', blankDefinition('form'))}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Em branco
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void create('Novo quiz', blankDefinition('quiz'), { ...SETTINGS_DEFAULT, autoAdvance: true })}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Quiz em branco
              </button>
            </div>
          </section>

          {forms.length > 0 && Object.values(counts).some((c) => c.total > 0) && (
            <section aria-labelledby="desempenho">
              <h2 id="desempenho" className="mb-3 text-sm font-semibold text-gray-900">Desempenho</h2>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
                <Card title="Respostas por formulário" sub="Total recebido"><Bars items={forms.map((f) => ({ label: f.name, value: (counts[f.id] ?? { total: 0 }).total })).sort((a, b) => b.value - a.value).slice(0, 6)} /></Card>
                <Card title="Quantos convertem" sub="Respostas sobre visualizações"><Bars items={forms.filter((f) => f.views > 0).map((f) => ({ label: f.name, value: Math.round(Math.min(100, ((counts[f.id]?.total ?? 0) / f.views) * 100)) })).sort((a, b) => b.value - a.value).slice(0, 6)} offset={2} /></Card>
                <Card title="Formulários e quizzes"><Donut items={[{ label: 'Formulários', value: forms.filter((f) => f.kind === 'form').length }, { label: 'Quizzes', value: forms.filter((f) => f.kind === 'quiz').length }].filter((i) => i.value > 0)} /></Card>
              </div>
            </section>
          )}

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
                            deleteForm(f).then(() => setForms((list) => (list ?? []).filter((x) => x.id !== f.id)), (e) => toast.error(errorText(e)))
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
