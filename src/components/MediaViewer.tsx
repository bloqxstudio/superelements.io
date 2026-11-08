import React, { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, Loader2, Minus, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Ver uma imagem, um vídeo ou um PDF na mesma aba, ampliado (2026-11-07, o usuário: "tire o abrir em
 * outra aba e coloque um abrir na mesma aba, numa modal, ampliando a imagem… tudo isso deve ser visto ao
 * clicar pela Iara"). Um só visualizador no app: o Cérebro, o chat da Iara e as ações dela abrem por
 * `openViewer`. Setas e ← → trocam, clique ou + − ampliam, Esc fecha.
 */

export interface ViewerItem {
  /** Endereço pronto, ou `resolve` para buscar na hora (links assinados). */
  src?: string
  resolve?: () => Promise<string>
  name: string
  kind?: 'image' | 'video' | 'pdf'
  caption?: string
  /** Tela do app de onde a imagem vem (abre fechando o visualizador). */
  href?: string
  hrefLabel?: string
  onDelete?: () => Promise<void>
}

interface ViewerState { items: ViewerItem[]; index: number; open: (items: ViewerItem[], index?: number) => void; close: () => void; go: (d: number) => void }

export const useViewer = create<ViewerState>((set, get) => ({
  items: [],
  index: 0,
  open: (items, index = 0) => set({ items, index: Math.max(0, Math.min(index, items.length - 1)) }),
  close: () => set({ items: [], index: 0 }),
  go: (d) => { const { items, index } = get(); if (items.length) set({ index: (index + d + items.length) % items.length }) },
}))

export const openViewer = (items: ViewerItem[], index = 0) => useViewer.getState().open(items, index)

export const kindOf = (name: string): ViewerItem['kind'] => (/\.(mp4|webm|mov)(\?|$)/i.test(name) ? 'video' : /\.pdf(\?|$)/i.test(name) ? 'pdf' : 'image')

const ZOOMS = [1, 1.5, 2, 3]

export const MediaViewer: React.FC = () => {
  const { items, index, close, go } = useViewer()
  const item = items[index]
  const navigate = useNavigate()
  const [url, setUrl] = useState<string>()
  const [zoom, setZoom] = useState(0)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setZoom(0)
    setUrl(item?.src)
    if (!item || item.src || !item.resolve) return
    let live = true
    void item.resolve().then((u) => live && setUrl(u)).catch(() => live && toast.error('Não abriu o arquivo'))
    return () => { live = false }
  }, [item])

  useEffect(() => {
    if (!item) return
    const prev = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))
      else if (e.key === '-') setZoom((z) => Math.max(z - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.() }
  }, [item, close, go])

  // Ampliar pelo ponto clicado: rola a caixa para manter esse ponto na tela
  const toggleZoom = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const el = box.current
    const img = e.currentTarget
    const fx = (e.clientX - img.getBoundingClientRect().left) / img.clientWidth
    const fy = (e.clientY - img.getBoundingClientRect().top) / img.clientHeight
    setZoom((z) => {
      const next = z ? 0 : 2
      requestAnimationFrame(() => { if (el && next) { el.scrollLeft = fx * el.scrollWidth - el.clientWidth / 2; el.scrollTop = fy * el.scrollHeight - el.clientHeight / 2 } })
      return next
    })
  }, [])

  if (!item) return null
  const kind = item.kind ?? kindOf(item.name)
  const scale = ZOOMS[zoom]
  const many = items.length > 1

  const remove = async () => {
    if (!item.onDelete || !window.confirm(`Apagar ${item.name}?`)) return
    setBusy(true)
    try {
      await item.onDelete()
      const rest = items.filter((_, i) => i !== index)
      if (rest.length) useViewer.setState({ items: rest, index: Math.min(index, rest.length - 1) })
      else close()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou') }
    finally { setBusy(false) }
  }

  const download = async () => {
    if (!url) return
    try {
      const blob = await (await fetch(url)).blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = item.name.split('/').pop() || 'arquivo'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch { toast.error('Não baixou') }
  }

  const btn = 'flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40'
  return (
    <div role="dialog" aria-modal="true" aria-label={item.name} className="se-dock-inset fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="flex h-14 shrink-0 items-center gap-2 px-3 text-white">
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-medium">{item.name.split('/').pop()}</p>
          {(item.caption || many) && <p className="truncate text-xs text-white/50">{many ? `${index + 1} de ${items.length}` : ''}{item.caption ? `${many ? ' · ' : ''}${item.caption}` : ''}</p>}
        </div>
        {kind === 'image' && (
          <>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(z - 1, 0))} disabled={!zoom} aria-label="Diminuir"><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center text-xs tabular-nums text-white/60">{Math.round(scale * 100)}%</span>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Ampliar"><Plus className="h-4 w-4" /></button>
          </>
        )}
        {item.href && (
          <button type="button" onClick={() => { close(); navigate(item.href!) }} className="ml-1 hidden items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white sm:flex">
            {item.hrefLabel ?? 'Abrir de onde veio'}<ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" className={btn} onClick={() => void download()} disabled={!url} aria-label="Baixar"><Download className="h-4 w-4" /></button>
        {item.onDelete && <button type="button" className={cn(btn, 'hover:text-red-400')} onClick={() => void remove()} disabled={busy} aria-label="Apagar">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}
        <button ref={closeBtn} type="button" className={btn} onClick={close} aria-label="Fechar"><X className="h-5 w-5" /></button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={box} className={cn('absolute inset-0', zoom ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden p-4 sm:px-16')}
          onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          {!url ? <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            : kind === 'video' ? <video src={url} controls autoPlay playsInline className="max-h-full max-w-full rounded-md" />
            : kind === 'pdf' ? <iframe src={url} title={item.name} className="h-full w-full max-w-4xl rounded-md bg-white" />
            : (
              <img src={url} alt={item.name} onClick={toggleZoom} draggable={false}
                className={cn('select-none', zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in rounded-md object-contain shadow-2xl')}
                style={zoom ? { width: `${scale * 100}%`, minWidth: `${scale * 100}%` } : undefined} />
            )}
        </div>
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
      </div>

      {many && items.length <= 60 && (
        <div className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-3 py-3">
          {items.map((it, i) => (
            <button key={i} type="button" onClick={() => useViewer.setState({ index: i })} aria-label={`Ver ${it.name}`} aria-current={i === index}
              className={cn('h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 bg-white/5', i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100')}>
              <Thumb item={it} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const Thumb: React.FC<{ item: ViewerItem }> = ({ item }) => {
  const [src, setSrc] = useState(item.src)
  useEffect(() => { let live = true; if (!item.src && item.resolve) void item.resolve().then((u) => live && setSrc(u)).catch(() => {}); return () => { live = false } }, [item])
  if ((item.kind ?? kindOf(item.name)) !== 'image') return <span className="flex h-full w-full items-center justify-center text-[9px] uppercase text-white/60">{item.name.split('.').pop()}</span>
  return src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : null
}
