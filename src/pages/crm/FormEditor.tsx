import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Loader2, Monitor, Moon, Smartphone, Sun, Undo2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCrm } from '@/features/crm/crmStore'
import { DesignEditor, FormPreview, ResultsEditor, SettingsEditor, StepsEditor, type PreviewScreen } from '@/features/crm/FormBuilder'
import { BookingEditor, BookingsList, PixelEditor, WelcomeEditor } from '@/features/crm/FormFlowEditors'
import { EmbedPanel, Submissions } from '@/features/crm/FormPanels'
import { FormLive } from '@/features/crm/FormLive'
import { blankDefinition, formIssues, hasUnpublished, loadForm, publishForm, saveForm, setFormSlug, unpublishForm, type CrmForm } from '@/features/crm/forms'
import { PublishControl } from '@/features/crm/FormPublish'
import { Page, Surface } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * Editor de um formulário ou quiz: construir, aparência, configurações, código para o Elementor e
 * respostas. Salva o rascunho sozinho (um instante depois da última mudança); a prévia é o forms.js do
 * site. O que está no ar só muda em "Publicar alterações", que confere o formulário antes (`formIssues`):
 * com erro, não publica. "Desfazer" (Ctrl/⌘ + Z fora dos campos) volta passo a passo; "Descartar" volta
 * o rascunho para a versão no ar.
 */

type Tab = 'inicio' | 'construir' | 'agenda' | 'aparencia' | 'config' | 'pixel' | 'embed' | 'aovivo' | 'respostas'
const TABS: { id: Tab; label: string }[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'construir', label: 'Perguntas' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'config', label: 'Configurações' },
  { id: 'pixel', label: 'Pixel da Meta' },
  { id: 'embed', label: 'Colocar no site' },
  { id: 'aovivo', label: 'Ao vivo e funil' },
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

/** Passos guardados para desfazer; mudanças seguidas (digitar) em menos de 800 ms viram um passo só. */
const HISTORY = 60

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
  const history = useRef<Draft[]>([])
  const lastPush = useRef(0)
  const [undoCount, setUndoCount] = useState(0)
  const [publishing, setPublishing] = useState(false)

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

  const schedule = () => {
    setSaving('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 900)
  }

  const change = (patch: Partial<Draft>) => {
    const current = latest.current ?? draft
    if (!current) return
    const now = Date.now()
    if (now - lastPush.current > 800) {
      history.current = [...history.current, current].slice(-HISTORY)
      setUndoCount(history.current.length)
    }
    lastPush.current = now
    const next = { ...current, ...patch }
    latest.current = next
    setDraft(next)
    schedule()
  }

  const undo = () => {
    const prev = history.current.pop()
    setUndoCount(history.current.length)
    if (!prev) return
    const current = latest.current ?? draft
    // O status (no ar ou não) não volta com o desfazer: ele muda só por publicar e despublicar
    const next = { ...prev, status: current?.status ?? prev.status }
    lastPush.current = 0
    latest.current = next
    setDraft(next)
    schedule()
  }

  /** Volta o rascunho para a versão no ar (dá para desfazer). */
  const discard = () => {
    const live = form?.live
    if (!live) return
    change({ name: live.name, definition: live.definition, theme: live.theme, settings: live.settings })
    lastPush.current = 0
    toast.success('Rascunho igual à versão no ar')
  }

  // Ctrl/⌘ + Z fora dos campos de texto (dentro deles, o desfazer é o do próprio campo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /** Põe o rascunho no ar (depois da conferência). */
  const goLive = async () => {
    const current = latest.current ?? draft
    if (!current) return
    clearTimeout(timer.current)
    timer.current = undefined
    setPublishing(true)
    setSaving('saving')
    try {
      const live = await publishForm(current)
      const next = { ...current, status: 'published' as const }
      latest.current = next
      setDraft(next)
      setForm((f) => (f ? { ...f, status: 'published', live } : f))
      setSaving('saved')
      return live
    } catch (e) {
      setSaving('dirty')
      throw e
    } finally {
      setPublishing(false)
    }
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
    await goLive()
  }

  const unpublish = async () => {
    const current = latest.current ?? draft
    if (!current) return
    try {
      await unpublishForm(current)
      const next = { ...current, status: 'draft' as const }
      latest.current = next
      setDraft(next)
      setForm((f) => (f ? { ...f, status: 'draft' } : f))
      toast.success('Formulário fora do ar')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
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
  const issues = formIssues(draft.definition, draft.settings)
  const errors = issues.filter((i) => i.level === 'error')
  const published = draft.status === 'published'
  const pending = published && hasUnpublished({ ...draft, live: form.live })
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
        <Button size="sm" variant="ghost" onClick={undo} disabled={!undoCount} title="Desfazer (Ctrl/⌘ + Z)">
          <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Desfazer
        </Button>
        <PublishControl form={{ ...form, ...draft }} onPublish={publish} onUnpublish={() => void unpublish()} />
      </div>

      {pending && (
        <div className={cn('mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm', errors.length ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50')} role="status">
          <span className={cn('flex items-center gap-1.5 font-medium', errors.length ? 'text-rose-800' : 'text-amber-900')}>
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {errors.length ? 'Alterações não publicadas, com erro: o site continua com a versão anterior.' : 'Alterações não publicadas: o site continua com a versão anterior.'}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {form.live && (
              <Button size="sm" variant="ghost" onClick={discard}>
                Descartar alterações
              </Button>
            )}
            <Button
              size="sm"
              disabled={!!errors.length || publishing}
              title={errors.length ? 'Corrija os erros abaixo para publicar' : undefined}
              onClick={() => goLive().then(() => toast.success('Alterações publicadas'), (e) => toast.error(e instanceof Error ? e.message : String(e)))}
            >
              {publishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 h-3.5 w-3.5" />} Publicar alterações
            </Button>
          </span>
        </div>
      )}
      {issues.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          {issues.map((i, n) => (
            <li key={n} className="flex items-start gap-2">
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', i.level === 'error' ? 'bg-rose-500' : 'bg-amber-500')} aria-hidden />
              <span className={i.level === 'error' ? 'text-gray-900' : 'text-gray-600'}>
                {i.level === 'error' ? 'Erro: ' : 'Atenção: '}
                {i.text}
              </span>
              {i.step && (
                <button type="button" className="ml-auto shrink-0 text-xs font-medium text-violet-700 hover:underline" onClick={() => { setTab('construir'); setScreen('steps') }}>
                  Ver na etapa {i.step}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

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
        {tab === 'aovivo' && <FormLive form={{ ...form, ...draft }} />}
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
