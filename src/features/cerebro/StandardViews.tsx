import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Plus, Sparkles, Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { loadProjectDoc } from '@/features/projects/storage'
import { deleteFile, deleteNote, mediaUrl, saveNote, uploadFiles, type LoadedVault } from './data'
import { DESIGN_PATH, FORMAT_LABEL, PATTERN_DIR, forgetStandard, patternNote, patternsOf, sourceHref, withRules, withStatus, type Pattern } from './standard'
import { aiReady, draftPattern } from './patternAi'
import { AUTO_FOLDER, dirOf, fileName, joinPath, type VaultMedia } from './vault'

/**
 * As peças do padrão de design no Cérebro: o cabeçalho da marca (cores e fontes do DESIGN.md), a grade
 * de padrões de post (marcar o padrão de cada formato, apagar os outros) e o "Novo padrão" a partir de
 * um post que a conta já criou nos Criativos.
 */

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'padrao'

const Img: React.FC<{ vault: LoadedVault; from: string; src?: string; className?: string; alt: string }> = ({ vault, from, src, className, alt }) => {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!src) return
    if (/^https?:/.test(src)) { setUrl(src); return }
    const path = joinPath(dirOf(from), src).path
    const m = vault.media.find((x) => x.path === path)
    let live = true
    void mediaUrl(vault.teamId, path, m?.mtime).then((u) => live && setUrl(u)).catch(() => {})
    return () => { live = false }
  }, [src, from, vault.media, vault.teamId])
  if (!src) return <div className={cn('flex items-center justify-center bg-gray-50 text-xs text-gray-400', className)}>Sem exemplo</div>
  return url ? <img src={url} alt={alt} className={className} /> : <div className={cn('animate-pulse bg-gray-100', className)} />
}

// ———————————————————————————————————— marca

/** Cores e fontes do cabeçalho do DESIGN.md, para ver a marca sem ler YAML. */
export const BrandHeader: React.FC<{ md: string }> = ({ md }) => {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const colors = [...fm.matchAll(/^\s*([a-z-]+):\s*["']?(#[0-9a-fA-F]{3,8})["']?\s*$/gm)].map((m) => ({ name: m[1], hex: m[2] }))
  const fonts = [...new Set([...fm.matchAll(/family:\s*["']?([^"'\n]+)/g)].map((m) => m[1].trim()))]
  if (!colors.length && !fonts.length) return null
  return (
    <div className="mb-6 rounded-xl border border-gray-200 p-4">
      {colors.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <li key={c.name + c.hex} className="flex items-center gap-2 rounded-lg border border-gray-100 py-1 pl-1 pr-2.5" title={c.hex}>
              <span className="h-6 w-6 rounded-md border border-black/10" style={{ background: c.hex }} aria-hidden />
              <span className="text-xs text-gray-700">{c.name}</span>
              <span className="font-mono text-[11px] text-gray-400">{c.hex.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
      {fonts.length > 0 && <p className="mt-3 text-xs text-gray-500">Fontes: {fonts.map((f) => <span key={f} className="mr-2 font-medium text-gray-800">{f}</span>)}</p>}
      <p className="mt-3 text-xs text-gray-400">É a marca que os Criativos usam para montar os posts desta conta.</p>
    </div>
  )
}

/** Conta sem DESIGN.md: escrever, ou trazer a marca de um projeto da conta. */
export const BrandEmpty: React.FC<{ teamId: string; isHome?: boolean; canEdit: boolean; onEdit: () => void; onSaved: () => void }> = ({ teamId, isHome, canEdit, onEdit, onSaved }) => {
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    const q = supabase.from('space_projects').select('id, name')
    void (isHome ? q.or(`team_id.eq.${teamId},team_id.is.null`) : q.eq('team_id', teamId)).is('archived_at', null).order('updated_at', { ascending: false }).limit(12)
      .then(({ data }) => setProjects((data ?? []) as { id: string; name: string }[]))
  }, [teamId, isHome])
  const bring = async (p: { id: string; name: string }) => {
    setBusy(p.id)
    try {
      const source = (await loadProjectDoc(p.id))?.doc?.brand?.source
      if (!source?.trim()) { toast.message(`${p.name} não tem marca (DESIGN.md) guardada.`); return }
      await saveNote(teamId, DESIGN_PATH, source)
      toast.success(`Marca trazida de ${p.name}.`)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não trouxe a marca') }
    finally { setBusy(null) }
  }
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-6">
      <p className="text-sm font-medium text-gray-900">A conta ainda não tem a marca guardada</p>
      <p className="mt-1 text-sm text-gray-500">O DESIGN.md diz as cores, as fontes, o logo e as regras. Os Criativos usam ele em todo post novo.</p>
      {!canEdit ? <p className="mt-3 text-xs text-gray-500">Só gestor da conta grava a marca.</p> : (
        <>
          <Button size="sm" className="mt-4" onClick={onEdit}>Escrever o DESIGN.md</Button>
          {projects && projects.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-gray-600">Ou trazer de um projeto desta conta</p>
              <ul className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => void bring(p)} disabled={!!busy}
                      className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:border-violet-300 hover:text-violet-800 disabled:opacity-50">
                      {busy === p.id && <Loader2 className="h-3 w-3 animate-spin" />}{p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ———————————————————————————————————— padrões de post

async function markDefault(teamId: string, vault: LoadedVault, target: Pattern) {
  const all = patternsOf(vault)
  for (const p of all) {
    if (p.path !== target.path && p.format !== target.format) continue
    const want = p.path === target.path
    if (p.isDefault === want) continue
    const note = vault.notes.find((n) => n.path === p.path)!
    await saveNote(teamId, p.path, withStatus(note.content, want))
  }
  forgetStandard()
}

/** O arquivo da imagem de exemplo de um padrão (só os guardados no Cérebro). */
const examplePath = (p: Pattern) => (p.example && !/^https?:/.test(p.example) ? joinPath(dirOf(p.path), p.example).path : undefined)

async function deleteOthers(teamId: string, vault: LoadedVault, keep: Pattern) {
  const others = patternsOf(vault).filter((p) => p.path !== keep.path && p.format === keep.format)
  for (const p of others) {
    await deleteNote(teamId, p.path)
    const file = examplePath(p)
    if (file && file !== examplePath(keep)) await deleteFile(teamId, file).catch(() => {})
  }
  if (!keep.isDefault) await markDefault(teamId, vault, keep)
  forgetStandard()
  return others.length
}

/** Os botões de uma nota de padrão. */
export const PatternActions: React.FC<{ teamId: string; vault: LoadedVault; pattern: Pattern; manager: boolean; onDone: () => void }> = ({ teamId, vault, pattern, manager, onDone }) => {
  const [busy, setBusy] = useState(false)
  const others = patternsOf(vault).filter((p) => p.path !== pattern.path && p.format === pattern.format)
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok); onDone() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não deu') }
    finally { setBusy(false) }
  }
  const label = FORMAT_LABEL[pattern.format] ?? 'sem formato'
  const note = vault.notes.find((n) => n.path === pattern.path)
  const href = note ? sourceHref(note.content) : undefined
  const [reading, setReading] = useState<string | null>(null)
  const rewrite = async () => {
    if (!note) return
    if (pattern.rules.length && !window.confirm('Trocar as regras e o "Quando usar" desta nota pelo que a IA ler do post de exemplo?')) return
    setReading('Abrindo o post')
    try {
      const d = await draftPattern({ teamId, href, onStep: setReading })
      if (!d.rules.length) throw new Error('Não achei o post de exemplo nos Criativos.')
      await saveNote(teamId, pattern.path, withRules(note.content, d.rules, d.when))
      forgetStandard()
      toast.success(d.byAi ? `A IA escreveu ${d.rules.length} regras.` : `Regras tiradas das medidas do post (a IA desta máquina não está conectada).`)
      onDone()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não leu o post') }
    finally { setReading(null) }
  }
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      {pattern.isDefault
        ? <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-medium text-white"><Star className="h-3 w-3 fill-current" />Padrão do {label}</span>
        : <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs text-gray-700">Alternativo · {label}</span>}
      <span className="min-w-[220px] flex-1 text-xs text-gray-500">{pattern.isDefault ? 'Os Criativos seguem este padrão em todo post novo deste formato.' : 'Não é usado nos posts novos enquanto não for o padrão.'}</span>
      {href && (
        <Button size="sm" variant={pattern.rules.length ? 'ghost' : 'default'} className="h-7" disabled={busy || !!reading} onClick={() => void rewrite()}
          title="Lê o post de exemplo (as camadas e a imagem de cada slide) e escreve as regras">
          {reading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
          {reading ? `${reading}…` : pattern.rules.length ? 'Refazer as regras pelo post' : 'Escrever as regras pelo post'}
        </Button>
      )}
      {!pattern.isDefault && (
        <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => void run(() => markDefault(teamId, vault, pattern), `${pattern.name} é o padrão do ${label}.`)}>
          <Check className="mr-1 h-3.5 w-3.5" />Marcar como padrão
        </Button>
      )}
      {manager && others.length > 0 && (
        <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy}
          onClick={() => { if (window.confirm(`Apagar os outros ${others.length} padrão(ões) do ${label} (${others.map((o) => o.name).join(', ')}) e ficar só com "${pattern.name}"?`)) void run(() => deleteOthers(teamId, vault, pattern), `Ficou só "${pattern.name}" no ${label}.`) }}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />Apagar os outros ({others.length})
        </Button>
      )}
    </div>
  )
}

/** A grade dos padrões, por formato. */
export const PatternsView: React.FC<{ teamId: string; vault: LoadedVault; manager: boolean; onOpen: (p: string) => void; onChanged: () => void }> = ({ teamId, vault, manager, onOpen, onChanged }) => {
  const [creating, setCreating] = useState(false)
  const patterns = patternsOf(vault)
  // Fotos da pasta que nenhum padrão usa (exemplos de padrões apagados, envios avulsos)
  const used = new Set(patterns.map(examplePath).filter(Boolean))
  const loose = vault.media.filter((m) => !m.url && m.path.startsWith(PATTERN_DIR + '/') && !used.has(m.path))
  const byFormat = useMemo(() => {
    const m = new Map<string, Pattern[]>()
    for (const p of patterns) m.set(p.format, [...(m.get(p.format) ?? []), p])
    for (const list of m.values()) list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
    return [...m.entries()].sort(([a], [b]) => Object.keys(FORMAT_LABEL).indexOf(a) - Object.keys(FORMAT_LABEL).indexOf(b))
  }, [patterns])
  return (
    <div>
      <div className="mb-1 flex items-start gap-3">
        <h1 className="flex-1 text-[28px] font-semibold tracking-tight text-gray-900">Padrões de post</h1>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1 h-3.5 w-3.5" />Novo padrão</Button>
      </div>
      <p className="mb-6 text-sm text-gray-500">Um padrão por formato. O marcado com ★ entra em todo post novo e em toda edição dos Criativos e da Iara; os outros ficam guardados até você escolher ou apagar.</p>
      {creating && <NewPattern teamId={teamId} vault={vault} onClose={() => setCreating(false)} onCreated={(p) => { setCreating(false); onChanged(); onOpen(p) }} />}
      {!patterns.length && !creating && (
        <p className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">Nenhum padrão ainda. Clique em <b className="font-medium">Novo padrão</b> e escolha um post que deu certo.</p>
      )}
      {loose.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Fotos sem padrão · {loose.length}</h2>
          <p className="mb-3 text-xs text-gray-500">Nenhum padrão usa estas fotos. Apague as que não servem mais.</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {loose.map((m) => (
              <li key={m.path} className="group relative">
                <Img vault={vault} from={PATTERN_DIR + '/x.md'} src={m.path.slice(PATTERN_DIR.length + 1)} alt={fileName(m.path)} className="aspect-[4/5] w-full rounded-lg border border-gray-200 object-cover" />
                <button type="button" aria-label={`Apagar ${fileName(m.path)}`}
                  onClick={async () => { if (!window.confirm(`Apagar ${fileName(m.path)}?`)) return; try { await deleteFile(teamId, m.path); onChanged() } catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou') } }}
                  className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-gray-500 shadow-sm hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {byFormat.map(([format, list]) => (
        <section key={format || 'x'} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{FORMAT_LABEL[format] ?? 'Sem formato'}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {list.map((p) => (
              <li key={p.path} className={cn('overflow-hidden rounded-xl border bg-white', p.isDefault ? 'border-violet-400 ring-2 ring-violet-100' : 'border-gray-200')}>
                <button type="button" onClick={() => onOpen(p.path)} className="block w-full text-left">
                  <Img vault={vault} from={p.path} src={p.example} alt={p.name} className="aspect-[4/5] w-full bg-gray-50 object-cover" />
                  <span className="block px-3 pt-2.5 text-[13px] font-medium text-gray-900">{p.name}</span>
                  <span className="block px-3 pb-2.5 text-[11px] text-gray-500">{p.isDefault ? '★ Padrão' : 'Alternativo'} · {p.rules.length} regra(s)</span>
                </button>
                {!p.isDefault && (
                  <div className="border-t border-gray-100 px-3 py-2">
                    <button type="button" className="text-xs font-medium text-violet-700 hover:underline"
                      onClick={async () => { try { await markDefault(teamId, vault, p); toast.success(`${p.name} é o padrão.`); onChanged() } catch (e) { toast.error(e instanceof Error ? e.message : 'Não deu') } }}>
                      Marcar como padrão
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {manager && list.length > 1 && list.some((p) => p.isDefault) && (
            <button type="button" className="mt-3 text-xs text-red-600 hover:underline"
              onClick={async () => {
                const keep = list.find((p) => p.isDefault)!
                if (!window.confirm(`Apagar os ${list.length - 1} padrão(ões) alternativos do ${FORMAT_LABEL[format] ?? 'formato'} e ficar só com "${keep.name}"?`)) return
                try { const n = await deleteOthers(teamId, vault, keep); toast.success(`${n} apagado(s).`); onChanged() } catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou') }
              }}>
              Apagar os alternativos e ficar só com o padrão
            </button>
          )}
        </section>
      ))}
    </div>
  )
}

/** Novo padrão a partir de um post dos Criativos da conta (a capa vira o exemplo). */
const NewPattern: React.FC<{ teamId: string; vault: LoadedVault; onClose: () => void; onCreated: (path: string) => void }> = ({ teamId, vault, onClose, onCreated }) => {
  const covers = vault.media.filter((m) => m.path.startsWith(`${AUTO_FOLDER}/criativos/`) && m.url)
  const [pick, setPick] = useState<VaultMedia | null>(null)
  const [name, setName] = useState('')
  const [format, setFormat] = useState('4x5')
  const [rules, setRules] = useState('')
  const [when, setWhen] = useState<string[]>([])
  const [makeDefault, setMakeDefault] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState<string | null>(null)
  const [byAi, setByAi] = useState<boolean | null>(null)
  const nameTouched = React.useRef(false)
  const job = React.useRef<AbortController | null>(null)
  useEffect(() => () => job.current?.abort(), [])
  // Escolher o post já lê o padrão dele: a IA olha os slides e as medidas; sem IA, só as medidas
  const read = async (m: VaultMedia) => {
    job.current?.abort()
    const ctrl = new AbortController()
    job.current = ctrl
    setReading('Abrindo o post'); setByAi(null)
    try {
      const d = await draftPattern({ teamId, href: m.href, coverUrl: m.url, signal: ctrl.signal, onStep: (x) => !ctrl.signal.aborted && setReading(x) })
      if (ctrl.signal.aborted) return
      setRules(d.rules.join('\n')); setWhen(d.when); setByAi(d.byAi)
      if (d.name && !nameTouched.current) setName(d.name)
    } catch (e) { if (!ctrl.signal.aborted) toast.error(e instanceof Error ? e.message : 'Não leu o post') }
    finally { if (job.current === ctrl) setReading(null) }
  }
  const choose = (m: VaultMedia) => { setPick(m); if (m.format) setFormat(m.format); if (!nameTouched.current) setName(m.label?.split(' · ').pop() ?? ''); void read(m) }
  const create = async () => {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    try {
      const base = `${PATTERN_DIR}/${slug(n)}`
      if (vault.notes.some((x) => x.path === `${base}.md`)) throw new Error('Já existe um padrão com esse nome.')
      let example: string | undefined
      if (pick?.url) {
        const blob = await (await fetch(pick.url)).blob()
        const [saved] = await uploadFiles(teamId, PATTERN_DIR, [new File([blob], `${slug(n)}.jpg`, { type: blob.type || 'image/jpeg' })])
        example = saved.slice(PATTERN_DIR.length + 1)
      }
      const list = rules.split('\n').map((r) => r.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean)
      const path = `${base}.md`
      // Marcar como padrão desmarca o padrão anterior do mesmo formato
      if (makeDefault) {
        for (const p of patternsOf(vault).filter((x) => x.format === format && x.isDefault)) {
          await saveNote(teamId, p.path, withStatus(vault.notes.find((x) => x.path === p.path)!.content, false))
        }
      }
      const source = pick?.href ? { label: pick.label ?? 'post nos Criativos', href: pick.href } : undefined
      await saveNote(teamId, path, patternNote({ name: n, format, isDefault: makeDefault, rules: list, when, example, source }), true)
      forgetStandard()
      onCreated(path)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não criou') }
    finally { setBusy(false) }
  }
  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Novo padrão de post</p>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
      </div>
      <p className="mb-2 text-xs font-medium text-gray-600">1. Escolha um post que deu certo como exemplo {covers.length ? '' : '(a conta ainda não tem posts nos Criativos)'}</p>
      {covers.length > 0 && (
        <ul className="mb-4 grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
          {covers.map((m) => (
            <li key={m.path}>
              <button type="button" onClick={() => choose(m)} title={m.label} aria-pressed={pick?.path === m.path}
                className={cn('block w-full overflow-hidden rounded-md border-2', pick?.path === m.path ? 'border-violet-500' : 'border-transparent hover:border-gray-300')}>
                <img src={m.url} alt={m.label ?? ''} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pd-name">2. Nome do padrão</label>
          <input id="pd-name" value={name} onChange={(e) => { nameTouched.current = true; setName(e.target.value) }} placeholder="Ex.: Carrossel editorial com foto"
            className="h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pd-format">Formato</label>
          <select id="pd-format" value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
            {Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-1 mt-3 flex items-center gap-2">
        <label className="flex-1 text-xs font-medium text-gray-600" htmlFor="pd-rules">3. Regras, uma por linha <span className="font-normal text-gray-400">(lidas do post escolhido; ajuste o que quiser)</span></label>
        {pick && !reading && <button type="button" onClick={() => void read(pick)} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline"><Sparkles className="h-3 w-3" />Ler de novo</button>}
      </div>
      {reading && <p className="mb-1.5 flex items-center gap-1.5 text-xs text-violet-700"><Loader2 className="h-3 w-3 animate-spin" />{reading}… {aiReady() ? 'a IA olha cada slide, as fontes, as cores e a foto' : ''}</p>}
      {!reading && byAi === false && <p className="mb-1.5 text-xs text-amber-700">Regras tiradas só das medidas das camadas: a IA desta máquina não está conectada (abra o conector para ela olhar a foto e o estilo).</p>}
      <textarea id="pd-rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={rules.split('\n').length > 4 ? 10 : 4} disabled={!!reading} placeholder={'Título em no máximo duas linhas, à esquerda\nFoto ocupa a metade de cima, com veu escuro\nÚltimo slide sempre com chamada para o WhatsApp'}
        className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-violet-600" />
        Marcar como o padrão do {FORMAT_LABEL[format]}
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => void create()} disabled={!name.trim() || busy || !!reading}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Criar padrão</Button>
      </div>
    </div>
  )
}
