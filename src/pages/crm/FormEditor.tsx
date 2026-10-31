import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useCrm } from '@/features/crm/crmStore'
import { DesignEditor, FormPreview, ResultsEditor, SettingsEditor, StepsEditor } from '@/features/crm/FormBuilder'
import { EmbedPanel, Submissions } from '@/features/crm/FormPanels'
import { blankDefinition, loadForm, saveForm, type CrmForm } from '@/features/crm/forms'
import { Page, Surface } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * Editor de um formulário ou quiz: construir, aparência, configurações, código para o Elementor e
 * respostas. Salva sozinho (um instante depois da última mudança); a prévia é o forms.js do site.
 */

type Tab = 'construir' | 'aparencia' | 'config' | 'embed' | 'respostas'
const TABS: { id: Tab; label: string }[] = [
  { id: 'construir', label: 'Construir' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'config', label: 'Configurações' },
  { id: 'embed', label: 'Colocar no site' },
  { id: 'respostas', label: 'Respostas' },
]

type Draft = Pick<CrmForm, 'id' | 'teamId' | 'name' | 'status' | 'definition' | 'theme' | 'settings'>
const draftOf = (f: CrmForm): Draft => ({ id: f.id, teamId: f.teamId, name: f.name, status: f.status, definition: f.definition, theme: f.theme, settings: f.settings })

const FormEditor: React.FC = () => {
  const { id } = useParams()
  const { team } = useCrm()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [form, setForm] = useState<CrmForm | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>()
  const [tab, setTab] = useState<Tab>('construir')
  const [saving, setSaving] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const [dark, setDark] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef<Draft>()

  useEffect(() => {
    if (!id) return
    let live = true
    loadForm(id).then(
      (f) => {
        if (!live) return
        setForm(f)
        if (f) setDraft(draftOf(f))
      },
      (e) => {
        toast.error(e instanceof Error ? e.message : String(e))
        if (live) setForm(null)
      }
    )
    return () => {
      live = false
    }
  }, [id])

  const flush = useCallback(async () => {
    const d = latest.current
    if (!d) return
    clearTimeout(timer.current)
    setSaving('saving')
    try {
      await saveForm(d)
      if (latest.current === d) setSaving('saved')
    } catch (e) {
      setSaving('dirty')
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      latest.current = next
      return next
    })
    setSaving('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 900)
  }

  // Sair da tela com mudança pendente salva antes
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        const d = latest.current
        if (d) void saveForm(d)
      }
    },
    []
  )

  if (form === undefined || (form && !draft)) {
    return (
      <Page wide>
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo o formulário…
        </p>
      </Page>
    )
  }
  if (!form || !draft) {
    return (
      <Page>
        <Surface className="max-w-lg">
          <p className="text-sm text-gray-700">Não encontrei este formulário.</p>
          <Link to="/crm/formularios" className="mt-2 inline-block text-sm font-medium text-violet-700 hover:underline">
            Voltar aos formulários
          </Link>
        </Surface>
      </Page>
    )
  }

  const quiz = draft.definition.kind === 'quiz'
  const preview = <FormPreview id={draft.id} name={draft.name} definition={draft.definition} theme={draft.theme} settings={draft.settings} dark={dark} />

  return (
    <Page wide>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/crm/formularios" className="rounded-lg p-2 text-gray-500 hover:bg-zinc-100 hover:text-gray-900" aria-label="Voltar aos formulários">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={draft.name}
          onChange={(e) => change({ name: e.target.value })}
          aria-label="Nome do formulário"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold tracking-tight text-gray-900 hover:border-gray-200 focus-visible:border-gray-300 focus-visible:outline-none"
        />
        <span className="flex items-center gap-1.5 text-xs text-gray-500" role="status">
          {saving === 'saving' && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>)}
          {saving === 'saved' && (<><Check className="h-3.5 w-3.5 text-emerald-600" /> Salvo</>)}
          {saving === 'dirty' && 'Alterações pendentes…'}
        </span>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Switch checked={draft.status === 'published'} onCheckedChange={(on) => change({ status: on ? 'published' : 'draft' })} />
          {draft.status === 'published' ? 'Publicado' : 'Rascunho'}
        </label>
      </div>

      <div role="tablist" aria-label="Seções do formulário" className="mt-5 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium', tab === t.id ? 'border-violet-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {(tab === 'construir' || tab === 'aparencia' || tab === 'config') && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
            <div className="grid gap-4">
              {tab === 'construir' && (
                <>
                  <StepsEditor definition={draft.definition} onChange={(definition) => change({ definition })} />
                  {quiz && <ResultsEditor definition={draft.definition} onChange={(definition) => change({ definition })} />}
                </>
              )}
              {tab === 'aparencia' && <DesignEditor theme={draft.theme} onChange={(theme) => change({ theme })} />}
              {tab === 'config' && (
                <SettingsEditor
                  settings={draft.settings}
                  kind={draft.definition.kind}
                  onKind={(kind) => change({ definition: { ...draft.definition, kind, results: kind === 'quiz' && !draft.definition.results.length ? blankDefinition('quiz').results : draft.definition.results } })}
                  onChange={(settings) => change({ settings })}
                />
              )}
            </div>
            <div className="lg:sticky lg:top-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prévia ao vivo</span>
                <button type="button" onClick={() => setDark((d) => !d)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-zinc-100" aria-pressed={dark}>
                  {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} Fundo {dark ? 'claro' : 'escuro'}
                </button>
              </div>
              {preview}
            </div>
          </div>
        )}
        {tab === 'embed' && (
          <div className="max-w-3xl">
            <EmbedPanel form={{ ...form, ...draft }} />
          </div>
        )}
        {tab === 'respostas' && (
          <div className="max-w-4xl">
            <Submissions form={{ ...form, ...draft }} manager={manager} />
          </div>
        )}
      </div>
    </Page>
  )
}

export default FormEditor
