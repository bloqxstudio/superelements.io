import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Monitor, Moon, Smartphone, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useCrm } from '@/features/crm/crmStore'
import { DesignEditor, FormPreview, ResultsEditor, SettingsEditor, StepsEditor, type PreviewScreen } from '@/features/crm/FormBuilder'
import { BookingEditor, BookingsList, PixelEditor, WelcomeEditor } from '@/features/crm/FormFlowEditors'
import { EmbedPanel, Submissions } from '@/features/crm/FormPanels'
import { blankDefinition, loadForm, saveForm, setFormSlug, type CrmForm } from '@/features/crm/forms'
import { PublishControl } from '@/features/crm/FormPublish'
import { Page, Surface } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * Editor de um formulário ou quiz: construir, aparência, configurações, código para o Elementor e
 * respostas. Salva sozinho (um instante depois da última mudança); a prévia é o forms.js do site.
 */

type Tab = 'inicio' | 'construir' | 'agenda' | 'aparencia' | 'config' | 'pixel' | 'embed' | 'respostas'
const TABS: { id: Tab; label: string }[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'construir', label: 'Perguntas' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'config', label: 'Configurações' },
  { id: 'pixel', label: 'Pixel da Meta' },
  { id: 'embed', label: 'Colocar no site' },
  { id: 'respostas', label: 'Respostas' },
]

/** Abas com a prévia ao lado e a tela que cada uma mostra primeiro. */
const PREVIEW_OF: Partial<Record<Tab, PreviewScreen>> = { inicio: 'welcome', construir: 'steps', agenda: 'booking', aparencia: 'welcome', config: 'done' }

const SCREENS: { id: PreviewScreen; label: string }[] = [
  { id: 'welcome', label: 'Início' },
  { id: 'steps', label: 'Perguntas' },
  { id: 'booking', label: 'Agenda' },
  { id: 'booked', label: 'Agendado' },
  { id: 'done', label: 'Final' },
]

type Draft = Pick<CrmForm, 'id' | 'teamId' | 'name' | 'status' | 'definition' | 'theme' | 'settings'>
const draftOf = (f: CrmForm): Draft => ({ id: f.id, teamId: f.teamId, name: f.name, status: f.status, definition: f.definition, theme: f.theme, settings: f.settings })

const FormEditor: React.FC = () => {
  const { id } = useParams()
  const { team } = useCrm()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [form, setForm] = useState<CrmForm | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>()
  const [tab, setTabRaw] = useState<Tab>('construir')
  const [saving, setSaving] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const [dark, setDark] = useState(false)
  const [phone, setPhone] = useState(true)
  // Modo teste da prévia: avança sem preencher (lembrado neste navegador)
  const [test, setTestRaw] = useState(() => { try { return localStorage.getItem('forms-preview-test') === '1' } catch { return false } })
  const setTest = (on: boolean) => { setTestRaw(on); try { localStorage.setItem('forms-preview-test', on ? '1' : '0') } catch { /* sem armazenamento */ } }
  const [shot, setShot] = useState<{ id: PreviewScreen; n: number }>({ id: 'steps', n: 0 })
  const screen = shot.id
  // Clicar na mesma tela de novo também volta a ela (a pessoa pode ter avançado na prévia)
  const setScreen = (id: PreviewScreen) => setShot((s) => ({ id, n: s.n + 1 }))
  const setTab = (t: Tab) => {
    setTabRaw(t)
    const s = PREVIEW_OF[t]
    if (s) setScreen(s)
  }
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

  /** Publicar (ou trocar o endereço): grava o endereço, depois o formulário publicado, na hora. */
  const publish = async (slug: string) => {
    const current = latest.current ?? draft
    if (!current) return
    if (slug !== form?.slug) {
      await setFormSlug(current.id, slug)
      setForm((f) => (f ? { ...f, slug } : f))
    }
    if (current.status === 'published') return
    const next = { ...current, status: 'published' as const }
    clearTimeout(timer.current)
    timer.current = undefined
    latest.current = next
    setDraft(next)
    setSaving('saving')
    try {
      await saveForm(next)
      setSaving('saved')
    } catch (e) {
      setSaving('dirty')
      throw e
    }
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
  const hasWelcome = !!draft.definition.welcome?.enabled
  const hasBooking = !!draft.settings.booking?.enabled
  const screens = SCREENS.filter((s) => (s.id === 'welcome' ? hasWelcome : s.id === 'booking' || s.id === 'booked' ? hasBooking : true))
  const preview = <FormPreview key={phone ? 'phone' : 'desk'} id={draft.id} name={draft.name} definition={draft.definition} theme={draft.theme} settings={draft.settings} dark={dark} screen={screen} screenNonce={shot.n} phone={phone} test={test} />

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
        <PublishControl form={{ ...form, ...draft }} onPublish={publish} onUnpublish={() => change({ status: 'draft' })} />
      </div>

      <div role="tablist" aria-label="Seções do formulário" className="se-tabs mt-5 flex gap-1 overflow-x-auto border-b border-gray-200">
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
        {PREVIEW_OF[tab] && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
            <div className="grid gap-4">
              {tab === 'inicio' && <WelcomeEditor form={draft} definition={draft.definition} onChange={(definition) => change({ definition })} />}
              {tab === 'agenda' && (
                <>
                  <BookingEditor definition={draft.definition} settings={draft.settings} onChange={(settings) => change({ settings })} />
                  {draft.settings.booking && <BookingsList form={{ ...form, ...draft }} manager={manager} />}
                </>
              )}
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prévia ao vivo</span>
                <span className="flex items-center gap-1">
                  <label className="mr-1 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-zinc-100" title="Avança as etapas sem preencher os campos (só nesta prévia)">
                    <Switch checked={test} onCheckedChange={setTest} className="scale-75" aria-label="Modo teste" /> Modo teste
                  </label>
                  <button type="button" onClick={() => setPhone((p) => !p)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-zinc-100" aria-pressed={phone}>
                    {phone ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />} {phone ? 'Computador' : 'Celular'}
                  </button>
                  <button type="button" onClick={() => setDark((d) => !d)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-zinc-100" aria-pressed={dark}>
                    {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} Fundo {dark ? 'claro' : 'escuro'}
                  </button>
                </span>
              </div>
              <div role="tablist" aria-label="Tela da prévia" className="mb-2 flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 text-xs">
                {screens.map((s) => (
                  <button key={s.id} type="button" role="tab" aria-selected={screen === s.id} onClick={() => setScreen(s.id)} className={cn('flex-1 rounded-md px-2 py-1 font-medium', screen === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                    {s.label}
                  </button>
                ))}
              </div>
              {preview}
            </div>
          </div>
        )}
        {tab === 'pixel' && (
          <div className="max-w-3xl">
            <PixelEditor form={{ ...form, ...draft }} settings={draft.settings} manager={manager} onChange={(settings) => change({ settings })} />
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
