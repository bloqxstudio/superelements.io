import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowUpRight, Brain, ChevronRight, FileText, Folder, FolderOpen, Image as ImageIcon, Link2, ListTree,
  Loader2, Menu, Network, Palette, Users, PencilLine, Plus, Search, Sparkles, Star, Trash2, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { cn } from '@/lib/utils'
import {
  ACCEPT, deleteFile, deleteNote, isAutoPath, loadAccountVault, loadPlatformCreatives, mediaUrl, saveNote, starterNotes, uploadFiles, type LoadedVault,
} from '@/features/cerebro/data'
import { renderMarkdown } from '@/features/cerebro/markdown'
import { forgetBrain } from '@/features/cerebro/scope'
import { GraphView } from '@/features/cerebro/GraphView'
import {
  AUTO_FOLDER, areaId, areasOf, joinPath, buildGraph, buildTree, countMedia, dateOf, dirOf, fileName, folderLabel, folderNote, headingsOf, isImage, isLog, isVideo,
  metaOf, search, titleOf, type Area, type TreeFolder, type VaultMedia, type VaultNote,
} from '@/features/cerebro/vault'
import { DESIGN_PATH, PATTERN_DIR, isPatternPath, parsePattern, patternsOf } from '@/features/cerebro/standard'
import { BrandEmpty, BrandHeader, PatternActions, PatternsView } from '@/features/cerebro/StandardViews'
import { kindOf, openViewer, type ViewerItem } from '@/components/MediaViewer'
import { GenerateMedia } from '@/features/cerebro/GenerateMedia'
import '@/features/cerebro/cerebro.css'

/**
 * /cerebro — a base de conhecimento da conta aberta, num formato tipo Obsidian: pastas à esquerda, a
 * nota no meio, os links e o sumário à direita, busca e grafo. Só o que é desta empresa (2026-11-07, o
 * usuário: "somente daquela empresa"): quem é, o que vende, produtos e fotos, decisões e logs, mais a
 * pasta "Da plataforma", montada sozinha com o cadastro, o Plano, a marca e os criativos da conta.
 * Notas e arquivos ficam no app (`src/features/cerebro/data.ts`); toda a equipe da conta lê e escreve.
 */

const fmtDate = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'nota'
const cleanFolder = (f: string) => f.split('/').map((s) => slug(s)).filter(Boolean).join('/')

/** Um arquivo do cérebro, com o endereço resolvido. */
const MediaThumb: React.FC<{ m: VaultMedia; className?: string }> = ({ m, className }) => {
  const [src, setSrc] = useState<string | undefined>(m.url)
  useEffect(() => { let live = true; if (!m.url) void mediaUrl(m.path, m.mtime).then((u) => live && setSrc(u)).catch(() => {}); return () => { live = false } }, [m.path, m.mtime, m.url])
  if (isVideo(m.path)) return <video src={src} muted playsInline preload="metadata" className={className} />
  if (isImage(m.path)) return src ? <img src={src} alt={fileName(m.path)} loading="lazy" className={className} /> : <div className={cn('animate-pulse bg-gray-100', className)} />
  return <div className={cn('flex items-center justify-center bg-gray-50 text-xs font-medium uppercase text-gray-400', className)}>{m.path.split('.').pop()}</div>
}

/**
 * O último cérebro aberto fica guardado neste navegador (2026-11-07, o usuário: "se abrir uma vez, depois
 * manter já salvo? está bem lento"): a tela abre na hora com ele e atualiza por trás. Os links das
 * imagens valem 7 dias, então a cópia vale 5.
 */
const SAVED_KEY = (team: string) => `cerebro-cofre:${team}`
const SAVED_TTL = 5 * 86_400_000
const readSaved = (team?: string): LoadedVault | null => {
  if (!team) return null
  try {
    const raw = localStorage.getItem(SAVED_KEY(team))
    if (!raw) return null
    const { at, vault } = JSON.parse(raw) as { at: number; vault: LoadedVault }
    return Date.now() - at < SAVED_TTL && vault?.teamId === team ? vault : null
  } catch { return null }
}
const writeSaved = (vault: LoadedVault) => {
  try {
    const raw = JSON.stringify({ at: Date.now(), vault })
    if (raw.length < 3_000_000) localStorage.setItem(SAVED_KEY(vault.teamId), raw)
  } catch { /* cheio ou bloqueado: só não guarda */ }
}

/** O que vem dos Criativos (capas, imagens dos posts): chega depois do resto. */
const isCreative = (p: string) => p === `${AUTO_FOLDER}/criativos.md` || p.startsWith(`${AUTO_FOLDER}/criativos/`) || p.startsWith(`${AUTO_FOLDER}/imagens/`)

/** Num recarregamento, mantém as capas dos Criativos que já estavam na tela enquanto as novas chegam. */
const withCreatives = (v: LoadedVault, prev: LoadedVault): Partial<LoadedVault> => {
  return { notes: [...v.notes, ...prev.notes.filter((n) => isCreative(n.path))], media: [...v.media, ...prev.media.filter((m) => isCreative(m.path))], partial: false }
}

/**
 * Abre arquivos do cérebro no visualizador da mesma aba (`MediaViewer`), com as outras imagens da pasta
 * ou da nota para passar com as setas. `remove` apaga um arquivo da conta (as da plataforma não).
 */
const viewMedia = (vault: LoadedVault, paths: string[], start: string, remove?: (path: string) => Promise<void>) => {
  const items: ViewerItem[] = paths.map((path) => {
    const m = vault.media.find((x) => x.path === path)
    const own = !m?.url && !isAutoPath(path)
    return {
      name: fileName(path),
      src: m?.url,
      resolve: () => mediaUrl(path, m?.mtime),
      kind: kindOf(path),
      caption: m?.label ?? (dirOf(path) ? folderLabel(fileName(dirOf(path))) : undefined),
      href: m?.href,
      hrefLabel: m?.href?.startsWith('/criativos') ? 'Abrir no Criativos' : undefined,
      onDelete: own && remove ? () => remove(path) : undefined,
    }
  })
  openViewer(items, Math.max(0, paths.indexOf(start)))
}

// ———————————————————————————————————— árvore

const noteLabel = (n: VaultNote) => n.path === 'README.md' ? 'Visão geral' : fileName(n.path) === 'decisoes.md' ? 'Decisões' : undefined

const NoteRow: React.FC<{ note: VaultNote; depth: number; current: string | null; onOpen: (p: string) => void; label?: string }> = ({ note, depth, current, onOpen, label }) => {
  const date = isLog(note.path) ? dateOf(note.path) : null
  const active = current === note.path
  return (
    <button
      type="button"
      onClick={() => onOpen(note.path)}
      aria-current={active ? 'page' : undefined}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={cn('flex w-full items-center gap-2 rounded-md py-[5px] pr-2 text-left text-[13px] transition-colors',
        active ? 'bg-violet-50 font-medium text-violet-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}
    >
      <FileText className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-violet-500' : 'text-gray-400')} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label ?? noteLabel(note) ?? titleOf(note)}</span>
      {date && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{date.slice(5).split('-').reverse().join('/')}</span>}
    </button>
  )
}

const FilesRow: React.FC<{ folder: TreeFolder; depth: number; currentFolder: string | null; onFolder: (p: string) => void }> = ({ folder, depth, currentFolder, onFolder }) => (
  <button type="button" onClick={() => onFolder(folder.path || '.')} style={{ paddingLeft: 8 + depth * 14 }}
    className={cn('flex w-full items-center gap-2 rounded-md py-[5px] pr-2 text-left text-[13px] transition-colors',
      currentFolder === (folder.path || '.') ? 'bg-violet-50 font-medium text-violet-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
    <span className="flex-1">{folder.path.startsWith(AUTO_FOLDER) ? 'Imagens' : 'Arquivos'}</span>
    <span className="text-[11px] tabular-nums text-gray-400">{folder.media.length}</span>
  </button>
)

const FolderRow: React.FC<{
  folder: TreeFolder; depth: number; current: string | null; currentFolder: string | null
  open: Set<string>; toggle: (p: string) => void; onOpen: (p: string) => void; onFolder: (p: string) => void; areas: Map<string, Area>
}> = (props) => {
  const { folder, depth, current, currentFolder, open, toggle, onOpen, onFolder, areas } = props
  const isOpen = open.has(folder.path)
  const area = depth === 0 ? areas.get(folder.name) : undefined
  // Pastas só de imagens (as capas dos criativos) viram uma linha de galeria
  if (!folder.notes.length && folder.folders.every((f) => !f.notes.length) && countMedia(folder) > 0 && depth > 0) {
    return (
      <button type="button" onClick={() => onFolder(folder.path)} style={{ paddingLeft: 8 + depth * 14 }}
        className={cn('flex w-full items-center gap-2 rounded-md py-[5px] pr-2 text-left text-[13px] transition-colors',
          currentFolder === folder.path ? 'bg-violet-50 font-medium text-violet-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{folder.name === 'criativos' ? 'Imagens dos criativos' : folderLabel(folder.name)}</span>
        <span className="text-[11px] tabular-nums text-gray-400">{countMedia(folder)}</span>
      </button>
    )
  }
  const label = area?.label ?? folderLabel(folder.name)
  const readme = folder.notes.find((n) => fileName(n.path) === 'README.md')
  const rest = folder.notes.filter((n) => n !== readme)
  const count = folder.name === 'log' ? folder.notes.length : null
  return (
    <div>
      <div className="group flex items-center" style={{ paddingLeft: depth * 14 }}>
        <button type="button" onClick={() => toggle(folder.path)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Fechar' : 'Abrir'} ${label}`}
          className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-700">
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', isOpen && 'rotate-90')} aria-hidden />
        </button>
        <button type="button" onClick={() => { if (readme) onOpen(readme.path); else onFolder(folder.path); if (!isOpen) toggle(folder.path) }}
          className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md py-[5px] pr-2 text-left text-[13px] transition-colors',
            (readme && current === readme.path) || currentFolder === folder.path ? 'bg-violet-50 font-medium text-violet-900' : 'font-medium text-gray-800 hover:bg-gray-100')}>
          {area ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: area.color }} aria-hidden />
            : isOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden /> : <Folder className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== null && <span className="text-[11px] font-normal tabular-nums text-gray-400">{count}</span>}
        </button>
      </div>
      {isOpen && (
        <div>
          {rest.map((n) => <NoteRow key={n.path} note={n} depth={depth + 1} current={current} onOpen={onOpen} />)}
          {folder.folders.map((f) => <FolderRow key={f.path} {...props} folder={f} depth={depth + 1} />)}
          {folder.media.length > 0 && <FilesRow folder={folder} depth={depth + 1} currentFolder={currentFolder} onFolder={onFolder} />}
        </div>
      )}
    </div>
  )
}

// ———————————————————————————————————— nota

const NoteBody: React.FC<{ vault: LoadedVault; note: VaultNote; onOpen: (p: string) => void; onFolder: (p: string) => void; onRemoveMedia?: (path: string) => void; onView: (paths: string[], start: string) => void }> = ({ vault, note, onOpen, onFolder, onRemoveMedia, onView }) => {
  const removeRef = useRef(onRemoveMedia)
  removeRef.current = onRemoveMedia
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const html = useMemo(() => renderMarkdown(vault, note.path, note.content), [vault, note])
  useEffect(() => {
    const root = ref.current
    if (!root) return
    let live = true
    root.querySelectorAll<HTMLImageElement | HTMLVideoElement>('[data-midia]').forEach((el) => {
      const path = el.dataset.midia!
      const m = vault.media.find((x) => x.path === path)
      void mediaUrl(path, m?.mtime).then((u) => { if (live) el.src = u }).catch(() => {})
      // Tirar a foto da nota: um × sobre cada imagem (nota que se edita)
      if (removeRef.current && !el.parentElement?.classList.contains('cb-media')) {
        const wrap = document.createElement('span')
        wrap.className = 'cb-media group relative inline-block max-w-full'
        el.replaceWith(wrap)
        wrap.appendChild(el)
        const b = document.createElement('button')
        b.type = 'button'
        b.dataset.tirar = path
        b.setAttribute('aria-label', `Tirar ${fileName(path)} da nota`)
        b.title = 'Tirar da nota'
        b.className = 'absolute right-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm opacity-100 transition-opacity hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'
        b.textContent = 'Tirar ✕'
        wrap.appendChild(b)
      }
    })
    return () => { live = false }
  }, [html, vault.media])
  const click = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    const a = t.closest('a') as HTMLAnchorElement | null
    const tirar = (t.closest('[data-tirar]') as HTMLElement | null)?.dataset.tirar
    if (tirar) { e.preventDefault(); e.stopPropagation(); removeRef.current?.(tirar); return }
    if (a?.dataset.nota) { e.preventDefault(); onOpen(a.dataset.nota) }
    else if (a?.dataset.pasta) { e.preventDefault(); onFolder(a.dataset.pasta) }
    else if (a?.dataset.rota) { e.preventDefault(); navigate(a.dataset.rota) }
    else if (a?.dataset.midiaAbrir) { e.preventDefault(); onView([a.dataset.midiaAbrir], a.dataset.midiaAbrir) }
    else if (t.tagName === 'IMG' && (t as HTMLImageElement).dataset.midia) {
      // As imagens da nota, na ordem, para passar com as setas
      const all = [...new Set([...(ref.current?.querySelectorAll<HTMLImageElement>('img[data-midia]') ?? [])].map((x) => x.dataset.midia!))]
      onView(all, (t as HTMLImageElement).dataset.midia!)
    }
  }
  return <div ref={ref} className="cb-prose" onClick={click} dangerouslySetInnerHTML={{ __html: html }} />
}

const Editor: React.FC<{ teamId: string; note: VaultNote; onSaved: () => void; onCancel: () => void; onDirty: (d: boolean) => void }> = ({ teamId, note, onSaved, onCancel, onDirty }) => {
  const [text, setText] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = text !== note.content
  useEffect(() => onDirty(dirty), [dirty, onDirty])
  const save = useCallback(async () => {
    setSaving(true)
    try { await saveNote(teamId, note.path, text); toast.success('Nota salva'); onSaved() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não salvou') }
    finally { setSaving(false) }
  }, [teamId, note.path, text, onSaved])
  // Colar ou soltar uma foto no texto: sobe para a pasta da nota e entra como imagem
  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setUploading('Enviando')
    try {
      const dir = dirOf(note.path)
      const paths = await uploadFiles(teamId, dir, files, setUploading)
      const md = paths.map((p) => `${isImage(p) || isVideo(p) ? '!' : ''}[${fileName(p)}](${dir ? p.slice(dir.length + 1) : p})`).join('\n')
      const el = area.current
      const at = el?.selectionStart ?? text.length
      setText((t) => `${t.slice(0, at)}${at && t[at - 1] !== '\n' ? '\n' : ''}${md}\n${t.slice(at)}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não enviou') }
    finally { setUploading(null) }
  }
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Editando <code className="rounded bg-gray-100 px-1 py-0.5">{note.path}</code> · ⌘S salva · cole ou solte fotos no texto</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>{dirty ? 'Descartar' : 'Fechar'}</Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving || !!uploading}>{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Salvar</Button>
        </div>
      </div>
      {uploading && <p className="mb-2 flex items-center gap-1.5 text-xs text-violet-700"><Loader2 className="h-3 w-3 animate-spin" />{uploading}</p>}
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty) void save() } if (e.key === 'Escape' && !dirty) onCancel() }}
        onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.length) { e.preventDefault(); void addFiles(files) } }}
        onDrop={(e) => { const files = [...e.dataTransfer.files]; if (files.length) { e.preventDefault(); void addFiles(files) } }}
        spellCheck
        autoFocus
        aria-label="Texto da nota em Markdown"
        className="min-h-[60vh] flex-1 resize-none rounded-xl border border-gray-200 bg-white p-5 font-mono text-[13.5px] leading-relaxed text-gray-800 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
      />
    </div>
  )
}

// ———————————————————————————————————— nova nota

const NewNote: React.FC<{ teamId: string; folders: string[]; defaultFolder: string; onCreated: (path: string) => void; onClose: () => void }> = ({ teamId, folders, defaultFolder, onCreated, onClose }) => {
  const [kind, setKind] = useState<'nota' | 'log'>('nota')
  const [folder, setFolder] = useState(defaultFolder)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    const t = title.trim()
    if (!t) return
    const date = today()
    const base = kind === 'log' ? 'log' : cleanFolder(folder)
    const path = kind === 'log' ? `log/${date}-${slug(t)}.md` : `${base ? base + '/' : ''}${slug(t)}.md`
    const content = kind === 'log'
      ? `# ${t}\n\n**Data:** ${date}\n\n## O que aconteceu\n\n## O que entregamos\n\n## O que aprendemos\n\n## Próximo passo\n`
      : `# ${t}\n\n`
    setBusy(true)
    try { await saveNote(teamId, path, content, true); onCreated(path) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não criou') }
    finally { setBusy(false) }
  }
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Nova</p>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-[13px]">
        {(['nota', 'log'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={cn('rounded-md py-1.5 font-medium transition-colors', kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
            {k === 'log' ? 'Log de hoje' : 'Nota'}
          </button>
        ))}
      </div>
      {kind === 'nota' && (
        <>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cb-folder">Pasta <span className="font-normal text-gray-400">(vazia = início; uma nova é criada)</span></label>
          <input id="cb-folder" list="cb-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="produtos"
            className="mb-3 h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          <datalist id="cb-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </>
      )}
      <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cb-title">Título</label>
      <input id="cb-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} autoFocus
        placeholder={kind === 'log' ? 'O que aconteceu' : 'Ex.: Linha de películas automotivas'} className="mb-4 h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
      <Button className="w-full" size="sm" onClick={() => void create()} disabled={!title.trim() || busy}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Criar e editar</Button>
    </div>
  )
}

// ———————————————————————————————————— tela

export default function Cerebro() {
  const team = useCrm((st) => st.team)
  const navigate = useNavigate()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const [vault, setVault] = useState<LoadedVault | null>(() => readSaved(useCrm.getState().team?.id))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [treeOpen, setTreeOpen] = useState(false)
  const [open, setOpen] = useState<Set<string>>(() => new Set([AUTO_FOLDER, 'produtos']))
  const [hiddenAreas, setHiddenAreas] = useState<Set<string>>(() => new Set())
  const fileInput = useRef<HTMLInputElement>(null)

  const notePath = params.get('nota')
  const folderPath = params.get('pasta')
  const graphMode = params.get('vista') === 'grafo'

  // Só a troca de conta recarrega: o objeto da conta no store muda a cada atualização dele
  const teamId = team?.id
  const teamRef = useRef(team)
  teamRef.current = team
  const editingRef = useRef(editing)
  editingRef.current = editing
  const reload = useCallback(async () => {
    const t = teamRef.current
    if (!t) return
    setRefreshing(true)
    try {
      forgetBrain()
      const team = { id: t.id, name: t.name, isHome: t.isHome, profile: t.profile }
      // Abre com as notas e os arquivos; as capas dos Criativos (o que demora) entram depois
      const v = await loadAccountVault(team, { creatives: 'later' })
      setVault((prev) => (v.partial && prev?.teamId === v.teamId && !prev.partial ? { ...v, ...withCreatives(v, prev) } : v))
      setError(null)
      if (v.partial) {
        const c = await loadPlatformCreatives(team)
        setVault((cur) => (cur && cur.teamId === v.teamId ? { ...cur, notes: [...cur.notes.filter((n) => !isCreative(n.path)), ...c.notes], media: [...cur.media.filter((m) => !isCreative(m.path)), ...c.media], partial: false } : cur))
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não deu para ler o cérebro') }
    finally { setRefreshing(false) }
  }, [])

  useEffect(() => { setVault((v) => (v?.teamId === teamId ? v : readSaved(teamId))); void reload() }, [reload, teamId])
  // Guarda a versão completa para a próxima abertura
  useEffect(() => {
    if (!vault || vault.partial) return
    const id = window.setTimeout(() => writeSaved(vault), 800)
    return () => window.clearTimeout(id)
  }, [vault])
  // Ao vivo: outra pessoa (ou a Iara) gravou uma nota desta conta
  useEffect(() => {
    if (!teamId) return
    let timer = 0
    const ch = supabase.channel(`cerebro:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_knowledge_notes', filter: `team_id=eq.${teamId}` }, () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => { if (!editingRef.current) void reload() }, 600)
      })
      .subscribe()
    return () => { window.clearTimeout(timer); void supabase.removeChannel(ch) }
  }, [teamId, reload])

  const graph = useMemo(() => vault ? buildGraph(vault) : null, [vault])
  const tree = useMemo(() => vault ? buildTree(vault) : null, [vault])
  const areas = useMemo(() => vault ? areasOf(vault) : [], [vault])
  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])
  const hits = useMemo(() => vault && query.trim() ? search(vault, query) : [], [vault, query])
  const ownNotes = vault?.notes.filter((n) => !n.auto) ?? []

  const defaultNote = vault?.notes.find((n) => n.path === 'README.md')?.path ?? vault?.notes.find((n) => !n.auto)?.path ?? `${AUTO_FOLDER}/empresa.md`
  const currentPath = folderPath ? null : (notePath && vault?.notes.some((n) => n.path === notePath) ? notePath : defaultNote)
  const note = vault?.notes.find((n) => n.path === currentPath) ?? null

  // Abrir a pasta da nota atual na árvore
  useEffect(() => {
    const target = currentPath ?? folderPath
    if (!target) return
    setOpen((prev) => {
      const next = new Set(prev)
      const parts = target.split('/')
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'))
      return next.size === prev.size ? prev : next
    })
  }, [currentPath, folderPath])

  const guard = useCallback(() => {
    if (editing && dirty) { toast.message('Salve ou descarte a edição antes de sair da nota.'); return false }
    setEditing(false)
    return true
  }, [editing, dirty])

  const openNote = useCallback((path: string) => {
    if (!guard()) return
    setParams((p) => { const n = new URLSearchParams(p); n.set('nota', path); n.delete('pasta'); return n })
    setTreeOpen(false)
    document.getElementById('cb-main')?.scrollTo({ top: 0 })
  }, [guard, setParams])
  const openFolder = useCallback((path: string) => {
    if (!guard()) return
    const readme = vault && path !== '.' ? folderNote(vault, path) : null
    if (readme && vault?.media.every((m) => dirOf(m.path) !== path)) return openNote(readme)
    setParams((p) => { const n = new URLSearchParams(p); n.set('pasta', path); n.delete('nota'); return n })
    setTreeOpen(false)
  }, [guard, setParams, vault, openNote])
  const setGraph = (on: boolean) => { if (!guard()) return; setParams((p) => { const n = new URLSearchParams(p); if (on) n.set('vista', 'grafo'); else n.delete('vista'); return n }) }
  const openFromGraph = useCallback((p: string) => setParams((x) => { const n = new URLSearchParams(x); n.set('nota', p); n.delete('vista'); n.delete('pasta'); return n }), [setParams])
  const toggle = useCallback((p: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n }), [])

  // A pasta onde entram arquivos e notas novas: a aberta, ou a da nota aberta
  const workFolder = folderPath ? (folderPath === '.' ? '' : folderPath) : currentPath ? dirOf(currentPath) : ''
  const targetFolder = isAutoPath(workFolder) ? '' : workFolder

  const upload = async (files: File[]) => {
    if (!team || !files.length) return
    setBusy('Enviando')
    try {
      const saved = await uploadFiles(team.id, targetFolder, files, setBusy)
      toast.success(`${saved.length} arquivo(s) em ${targetFolder ? folderLabel(targetFolder) : 'Início'}.`)
      await reload()
      openFolder(targetFolder || '.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não enviou') }
    finally { setBusy(null) }
  }

  const start = async () => {
    if (!team) return
    setBusy('Criando')
    try {
      for (const n of starterNotes(team.name, today())) await saveNote(team.id, n.path, n.content, true).catch(() => {})
      await reload()
      openNote('README.md')
      setEditing(true)
    } finally { setBusy(null) }
  }

  const remove = async () => {
    if (!team || !note || note.auto) return
    if (!window.confirm(`Apagar a nota "${titleOf(note)}"?`)) return
    try { await deleteNote(team.id, note.path); toast.success('Nota apagada'); setParams(new URLSearchParams()); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou') }
  }

  // Apagar pelo visualizador
  const removeFile = useCallback(async (path: string) => { if (!team) return; await deleteFile(team.id, path); await reload() }, [team, reload])
  // /cerebro?midia=<arquivo> (links da Iara): abre a imagem ampliada, com as outras da mesma pasta
  const midia = params.get('midia')
  useEffect(() => {
    if (!midia || !vault) return
    const siblings = vault.media.filter((m) => dirOf(m.path) === dirOf(midia) && isImage(m.path)).map((m) => m.path)
    if (!vault.media.some((m) => m.path === midia) && vault.partial) return // ainda chegando
    viewMedia(vault, siblings.includes(midia) ? siblings : [midia], midia, removeFile)
    setParams((x) => { const n = new URLSearchParams(x); n.delete('midia'); if (!n.get('nota')) n.set('pasta', dirOf(midia) || '.'); return n }, { replace: true })
  }, [midia, vault, removeFile, setParams])

  // Tira a imagem da nota (todas as menções a ela) e apaga o arquivo se nenhuma outra nota usa
  const removeMedia = async (path: string) => {
    if (!team || !note || note.auto || note.linked) return
    if (!window.confirm(`Tirar ${fileName(path)} desta nota? O arquivo é apagado se nenhuma outra nota usar.`)) return
    const dir = dirOf(note.path)
    const next = note.content
      .replace(/!\[[^\]]*\]\(([^)\s]+)\)/g, (m, src: string) => (!/^https?:/.test(src) && joinPath(dir, decodeURI(src)).path === path ? '' : m))
      .replace(/^[ \t]*$\n(?=^[ \t]*$\n)/gm, '')
    try {
      await saveNote(team.id, note.path, next)
      const used = vault?.notes.some((n) => n.path !== note.path && n.content.includes(fileName(path)))
      if (!used) await deleteFile(team.id, path).catch(() => {})
      toast.success(used ? 'Tirada da nota (outra nota ainda usa o arquivo).' : 'Imagem tirada e apagada.')
      await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não tirou') }
  }

  // Apaga uma pasta inteira: as notas (gestor) e os arquivos dela
  const removeFolder = async (dir: string) => {
    if (!team || !vault || !dir || isAutoPath(dir)) return
    const notes = vault.notes.filter((n) => !n.auto && !n.linked && (n.path.startsWith(dir + '/')))
    const files = vault.media.filter((m) => !m.url && m.path.startsWith(dir + '/'))
    if (!window.confirm(`Apagar a pasta ${folderLabel(fileName(dir))} com ${notes.length} nota(s) e ${files.length} arquivo(s)? Não dá para desfazer.`)) return
    setBusy('Apagando')
    try {
      for (const n of notes) await deleteNote(team.id, n.path)
      for (const m of files) await deleteFile(team.id, m.path)
      toast.success('Pasta apagada.')
      setParams(new URLSearchParams())
      await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou'); await reload() }
    finally { setBusy(null) }
  }

  if (!team) return <Centered icon={Users} title="Abra uma conta" text="O cérebro mostra só o que é da empresa aberta no menu." />
  if (error && !vault) return <Centered icon={Brain} title="Não deu para abrir o cérebro" text={error} action={<Button size="sm" variant="outline" onClick={() => void reload()}>Tentar de novo</Button>} />
  if (!vault || !tree || !graph) return <Centered icon={Loader2} spin title="Abrindo o cérebro" />

  const backlinks = currentPath ? (graph.backlinks.get(currentPath) ?? []) : []
  const outgoing = currentPath ? (graph.links.get(currentPath) ?? []) : []
  const headings = note ? headingsOf(note).filter((h) => h.level > 1 && h.level < 4) : []
  const meta = note ? metaOf(note) : {}
  const noteArea = currentPath ? areaMap.get(areaId(currentPath)) : undefined
  const recentLogs = vault.notes.filter((n) => isLog(n.path) && n.path !== currentPath).sort((a, b) => b.path.localeCompare(a.path)).slice(0, 6)
  const shownFolder = folderPath === '.' ? '' : folderPath
  const folderMedia = shownFolder !== null ? vault.media.filter((m) => shownFolder === '' ? !m.path.includes('/') : m.path.startsWith(shownFolder + '/')) : []
  const folderNotes = shownFolder !== null ? vault.notes.filter((n) => dirOf(n.path) === shownFolder) : []
  const crumbs = (currentPath ?? (shownFolder ? shownFolder + '/x' : '')).split('/').slice(0, -1)
  const titleByPath = (p: string) => { const n = vault.notes.find((x) => x.path === p); return n ? titleOf(n) : fileName(p) }
  const folders = [...new Set(vault.notes.filter((n) => !n.auto).map((n) => dirOf(n.path)).filter(Boolean))].sort()

  const sidebar = (
    <aside className="flex h-full w-full flex-col">
      <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2" title="O cérebro mostra só o que é da empresa aberta no menu">
        <Brain className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900">{team.name}</span>
      </div>
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar em ${team.name}`} aria-label="Buscar nas notas"
            onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); if (e.key === 'Enter' && hits[0]) openNote(hits[0].path) }}
            className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-7 text-[13px] outline-none placeholder:text-gray-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar a busca" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {query.trim() ? (
          hits.length ? (
            <ul className="space-y-0.5">
              {hits.map((h) => (
                <li key={h.path}>
                  <button type="button" onClick={() => openNote(h.path)} className={cn('w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-100', currentPath === h.path && 'bg-violet-50')}>
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: areaMap.get(areaId(h.path))?.color }} aria-hidden />
                      <span className="truncate">{h.title}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-gray-500">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="px-2 py-6 text-center text-xs text-gray-500">Nada encontrado para “{query}”.</p>
        ) : (
          <nav aria-label="Notas do cérebro" className="space-y-0.5">
            {!ownNotes.length && (
              <div className="mb-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/50 p-3">
                <p className="text-[13px] font-medium text-gray-900">Comece a base de {team.name}</p>
                <p className="mt-1 text-xs leading-snug text-gray-600">Visão geral (quem é, o que vende, para quem), produtos com fotos e decisões. A Iara também preenche.</p>
                <Button size="sm" className="mt-2.5 h-7 w-full text-xs" onClick={() => void start()} disabled={!!busy}>
                  {busy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1.5 h-3 w-3" />}Criar a estrutura
                </Button>
              </div>
            )}
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Padrão de design</p>
            <PinRow icon={Palette} label="Marca (DESIGN.md)" active={currentPath === DESIGN_PATH} hint={vault.notes.find((n) => n.path === DESIGN_PATH)?.content.trim() ? undefined : 'vazio'} onClick={() => openNote(DESIGN_PATH)} />
            <PinRow icon={Star} label="Padrões de post" active={folderPath === PATTERN_DIR} hint={String(patternsOf(vault).length)} onClick={() => openFolder(PATTERN_DIR)} />
            <div className="h-3" />
            {tree.notes.map((n) => <NoteRow key={n.path} note={n} depth={0} current={currentPath} onOpen={openNote} />)}
            {tree.media.length > 0 && <FilesRow folder={tree} depth={0} currentFolder={folderPath} onFolder={openFolder} />}
            <div className="h-2" />
            {tree.folders.map((f) => <FolderRow key={f.path} folder={f} depth={0} current={currentPath} currentFolder={folderPath} open={open} toggle={toggle} onOpen={openNote} onFolder={openFolder} areas={areaMap} />)}
          </nav>
        )}
      </div>
      <div className="border-t border-gray-100 px-3 py-2.5 text-[11px] leading-snug text-gray-400">
        Só de {team.name} · toda a equipe da conta vê
        <span className="block">{ownNotes.length} notas · {vault.media.filter((m) => !m.url).length} arquivos</span>
      </div>
    </aside>
  )

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-[480px] flex-col">
      {/* Barra do cérebro */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-100 px-3 md:px-4">
        <button type="button" onClick={() => setTreeOpen((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 lg:hidden" aria-label="Notas" aria-expanded={treeOpen}>
          <Menu className="h-4 w-4" />
        </button>
        <Brain className="hidden h-4 w-4 text-violet-600 lg:block" aria-hidden />
        <h1 className="text-[15px] font-semibold tracking-tight text-gray-900">Cérebro</h1>
        {(refreshing || vault?.partial) && <span className="flex items-center gap-1 text-[11px] text-gray-400" aria-live="polite"><Loader2 className="h-3 w-3 animate-spin" />Atualizando</span>}
        <div className="ml-3 hidden rounded-lg bg-gray-100 p-0.5 text-[13px] sm:flex" role="tablist" aria-label="Vista">
          <button type="button" role="tab" aria-selected={!graphMode} onClick={() => setGraph(false)} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors', !graphMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
            <FileText className="h-3.5 w-3.5" aria-hidden /> Notas
          </button>
          <button type="button" role="tab" aria-selected={graphMode} onClick={() => setGraph(true)} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors', graphMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
            <Network className="h-3.5 w-3.5" aria-hidden /> Grafo
          </button>
        </div>
        <div className="flex-1" />
        <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; void upload(f) }} />
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={!!busy}
          title={`Fotos, vídeos e PDF entram em ${targetFolder ? folderLabel(targetFolder) : 'Início'}`}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
          <span className="hidden md:inline">{busy ?? 'Adicionar arquivos'}</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setGenerating((v) => !v)} aria-expanded={generating} title="Criar fotos e peças da empresa com a IA de imagens">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">Criar imagem</span>
        </Button>
        <div className="relative">
          <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)} aria-expanded={creating}><Plus className="mr-1 h-3.5 w-3.5" />Nova</Button>
          {creating && <NewNote teamId={team.id} folders={folders} defaultFolder={targetFolder} onClose={() => setCreating(false)}
            onCreated={(p) => { setCreating(false); void reload().then(() => { setParams((x) => { const n = new URLSearchParams(x); n.set('nota', p); n.delete('pasta'); n.delete('vista'); return n }); setEditing(true) }) }} />}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Árvore: fixa no desktop, gaveta abaixo de 1024 px */}
        <div className="hidden w-[264px] shrink-0 border-r border-gray-100 bg-gray-50/40 lg:block">{sidebar}</div>
        {treeOpen && (
          <>
            <button type="button" aria-label="Fechar as notas" onClick={() => setTreeOpen(false)} className="absolute inset-0 z-20 bg-black/20 lg:hidden" />
            <div className="absolute inset-y-0 left-0 z-30 w-[86%] max-w-[300px] border-r border-gray-200 bg-white shadow-xl lg:hidden">{sidebar}</div>
          </>
        )}

        {graphMode ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 px-4 py-2">
              {areas.map((a) => {
                const off = hiddenAreas.has(a.id)
                return (
                  <button key={a.id} type="button" aria-pressed={!off}
                    onClick={() => setHiddenAreas((prev) => { const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })}
                    className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', off ? 'border-gray-200 text-gray-400' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>
                    <span className="h-2 w-2 rounded-full" style={{ background: off ? '#d1d5db' : a.color }} aria-hidden />{a.label}
                  </button>
                )
              })}
            </div>
            <div className="min-h-0 flex-1">
              <GraphView vault={vault} graph={graph} areas={areas} current={currentPath} hidden={hiddenAreas} onOpen={openFromGraph} />
            </div>
          </div>
        ) : (
          <>
            <main id="cb-main" className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[760px] px-5 pb-24 pt-6 md:px-10 md:pt-8">
                {/* Caminho */}
                {crumbs.length > 0 && (
                  <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                    {crumbs.map((c, i) => {
                      const p = crumbs.slice(0, i + 1).join('/')
                      return (
                        <React.Fragment key={p}>
                          {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" aria-hidden />}
                          <button type="button" onClick={() => openFolder(p)} className="rounded px-1 py-0.5 hover:bg-gray-100 hover:text-gray-800">{folderLabel(c)}</button>
                        </React.Fragment>
                      )
                    })}
                  </nav>
                )}

                {generating && (
                  <GenerateMedia teamId={team.id} vault={vault} folder={targetFolder} folders={[...new Set([...folders, ...vault.media.filter((m) => !m.url).map((m) => dirOf(m.path)).filter(Boolean)])].sort()}
                    onClose={() => setGenerating(false)} onSaved={() => void reload()} />
                )}
                {shownFolder === PATTERN_DIR ? (
                  <PatternsView teamId={team.id} vault={vault} manager={manager} onOpen={openNote} onChanged={() => void reload()} />
                ) : shownFolder !== null ? (
                  <div>
                    <div className="mb-1 flex items-start gap-2">
                      <h1 className="flex-1 text-[28px] font-semibold tracking-tight text-gray-900">{shownFolder ? folderLabel(fileName(shownFolder)) : 'Arquivos do início'}</h1>
                      {manager && shownFolder && !isAutoPath(shownFolder) && shownFolder !== 'marca' && (
                        <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:bg-red-50 hover:text-red-600" disabled={!!busy} onClick={() => void removeFolder(shownFolder)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Apagar pasta
                        </Button>
                      )}
                    </div>
                    <p className="mb-6 text-sm text-gray-500">
                      {folderMedia.length} arquivo(s){folderNotes.length ? ` · ${folderNotes.length} nota(s)` : ''}.
                      {isAutoPath(shownFolder)
                        ? <> Estas vêm dos Criativos da conta: para tirar uma daqui, apague o post lá.</>
                        : <> Use <b className="font-medium text-gray-700">Adicionar arquivos</b> ou <b className="font-medium text-gray-700">Criar imagem</b> para pôr fotos aqui. Passe o mouse numa foto para apagar.</>}
                    </p>
                    {folderNotes.length > 0 && <div className="mb-6 space-y-0.5">{folderNotes.map((n) => <NoteRow key={n.path} note={n} depth={0} current={null} onOpen={openNote} />)}</div>}
                    {folderMedia.length ? (
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {folderMedia.map((m) => (
                          <li key={m.path} className="group relative">
                            <button type="button" onClick={() => viewMedia(vault, folderMedia.map((x) => x.path), m.path, removeFile)} className="block w-full text-left">
                              <MediaThumb m={m} className="aspect-square w-full rounded-lg border border-gray-200 object-cover transition-opacity group-hover:opacity-90" />
                              <span className="mt-1.5 block truncate text-xs text-gray-600">{fileName(m.path)}</span>
                              {m.size > 0 && <span className="block text-[11px] text-gray-400">{(m.size / 1024).toFixed(0)} KB · {fmtDate(m.mtime)}</span>}
                            </button>
                            {!m.url && (
                              <button type="button" aria-label={`Apagar ${fileName(m.path)}`}
                                onClick={async () => { if (!window.confirm(`Apagar ${fileName(m.path)}?`)) return; try { await deleteFile(team.id, m.path); await reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou') } }}
                                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-gray-500 shadow-sm transition-opacity hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">Ainda sem imagens nem vídeos nesta pasta.</p>}
                  </div>
                ) : note ? (
                  note.linked === 'brand' && !note.content.trim() && !editing ? (
                    <article>
                      <h1 className="mb-4 text-[28px] font-semibold tracking-tight text-gray-900">Marca (DESIGN.md)</h1>
                      <BrandEmpty teamId={team.id} isHome={team.isHome} canEdit={manager} onEdit={() => setEditing(true)} onSaved={() => void reload()} />
                    </article>
                  ) : editing && !note.auto ? (
                    <Editor teamId={team.id} note={note} onDirty={setDirty} onCancel={() => { setDirty(false); setEditing(false) }} onSaved={() => { setDirty(false); setEditing(false); void reload() }} />
                  ) : (
                    <article>
                      <div className="mb-5 flex items-start gap-2"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {noteArea && noteArea.id !== 'raiz' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            <span className="h-2 w-2 rounded-full" style={{ background: noteArea.color }} aria-hidden />{noteArea.label}
                          </span>
                        )}
                        {isLog(note.path) && dateOf(note.path) && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{fmtDay(dateOf(note.path)!)}</span>}
                        {meta['estado'] && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">{meta['estado']}</span>}
                        {meta['atualizado em']?.match(/\d{4}-\d{2}-\d{2}/) && <span className="text-xs text-gray-400">Atualizado em {fmtDay(meta['atualizado em'].match(/\d{4}-\d{2}-\d{2}/)![0])}</span>}
                      </div>
                        {!note.auto && (note.linked !== 'brand' || manager) && <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-gray-500" onClick={() => setEditing(true)}><PencilLine className="mr-1.5 h-3.5 w-3.5" />Editar</Button>}
                        {!note.auto && !note.linked && manager && <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-gray-400 hover:text-red-600" onClick={() => void remove()} aria-label="Apagar a nota"><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                      {note.auto && (
                        <p className="mb-5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          Montada sozinha com {note.auto.label}. {note.auto.route && <a href={note.auto.route} onClick={(e) => { e.preventDefault(); navigate(note.auto!.route!) }} className="font-medium text-violet-700 hover:underline">Mudar lá →</a>}
                        </p>
                      )}
                      {isPatternPath(note.path) && <PatternActions teamId={team.id} vault={vault} pattern={parsePattern(note)} manager={manager} onDone={() => void reload()} />}
                      {note.linked === 'brand' && <BrandHeader md={note.content} />}
                      <NoteBody key={note.path} vault={vault} note={note.linked === 'brand' ? { ...note, content: note.content.replace(/^---\n[\s\S]*?\n---\n?/, '') } : note} onOpen={openNote} onFolder={openFolder} onRemoveMedia={!note.auto && !note.linked ? (p) => void removeMedia(p) : undefined} onView={(paths, start) => viewMedia(vault, paths, start, removeFile)} />
                      <p className="mt-12 border-t border-gray-100 pt-4 text-xs text-gray-400">{note.auto ? 'Da plataforma, atualizada agora' : note.linked === 'brand' ? 'A marca da conta: os Criativos e a Iara usam este texto em todo post novo.' + (manager ? '' : ' Só gestor edita.') : `${note.path} · salva em ${fmtDate(note.mtime)}`}</p>
                    </article>
                  )
                ) : null}
              </div>
            </main>

            {/* Lado direito: sumário, links, últimos logs */}
            {note && !editing && (
              <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-l border-gray-100 px-4 py-6 xl:block" aria-label="Sobre esta nota">
                {headings.length > 1 && (
                  <Side icon={ListTree} title="Nesta nota">
                    {headings.map((h) => (
                      <a key={h.slug + h.text} href={`#h-${h.slug}`} onClick={(e) => { e.preventDefault(); document.getElementById(`h-${h.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                        className={cn('block truncate rounded py-1 text-[13px] text-gray-600 hover:text-gray-900', h.level === 3 && 'pl-3 text-gray-500')}>{h.text}</a>
                    ))}
                  </Side>
                )}
                <Side icon={Link2} title={`Links para cá · ${backlinks.length}`}>
                  {backlinks.length ? backlinks.map((p) => <SideLink key={p} label={titleByPath(p)} color={areaMap.get(areaId(p))?.color} onClick={() => openNote(p)} />)
                    : <p className="py-1 text-xs text-gray-400">Nenhuma nota aponta para esta.</p>}
                </Side>
                {outgoing.length > 0 && (
                  <Side icon={ArrowUpRight} title={`Links desta nota · ${outgoing.length}`}>
                    {outgoing.map((p) => <SideLink key={p} label={titleByPath(p)} color={areaMap.get(areaId(p))?.color} onClick={() => openNote(p)} />)}
                  </Side>
                )}
                {recentLogs.length > 0 && (
                  <Side icon={FileText} title="Últimos logs">
                    {recentLogs.map((n) => <SideLink key={n.path} label={titleOf(n)} hint={dateOf(n.path)?.slice(5).split('-').reverse().join('/')} onClick={() => openNote(n.path)} />)}
                  </Side>
                )}
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const PinRow: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; hint?: string; active: boolean; onClick: () => void }> = ({ icon: Icon, label, hint, active, onClick }) => (
  <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
    className={cn('flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[13px] transition-colors', active ? 'bg-violet-50 font-medium text-violet-900' : 'text-gray-700 hover:bg-gray-100')}>
    <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-violet-500' : 'text-gray-400')} aria-hidden />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {hint && <span className="text-[11px] tabular-nums text-gray-400">{hint}</span>}
  </button>
)

const Side: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <section className="mb-6">
    <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400"><Icon className="h-3.5 w-3.5" />{title}</h2>
    <div>{children}</div>
  </section>
)

const SideLink: React.FC<{ label: string; color?: string; hint?: string; onClick: () => void }> = ({ label, color, hint, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded py-1 text-left text-[13px] text-gray-600 hover:text-violet-700">
    {color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {hint && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{hint}</span>}
  </button>
)

const Centered: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; text?: string; spin?: boolean; action?: React.ReactNode }> = ({ icon: Icon, title, text, spin, action }) => (
  <div className="flex min-h-[calc(100dvh-56px)] items-center justify-center px-6">
    <div className="max-w-sm text-center">
      <Icon className={cn('mx-auto mb-3 h-6 w-6 text-gray-400', spin && 'animate-spin')} />
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  </div>
)
