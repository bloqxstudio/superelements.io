import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { create } from 'zustand'
import { ExternalLink, Loader2, Maximize2, Minimize2, PanelRight, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Uma janela (webview) para ver a entrega sem sair da tela: abre a própria tela
 * do app (documento, criativos, projeto) em modo embutido, sem o menu lateral.
 * Dá para escolher o tamanho (compacta, ampla ou tela cheia), arrastar a borda
 * para ajustar e recarregar; o tamanho fica lembrado.
 */

interface PreviewState {
  open?: { href: string; title: string }
}

const usePreview = create<PreviewState>()(() => ({}))

export const openPreview = (target: { href: string; title: string }) => usePreview.setState({ open: target })
export const closePreview = () => usePreview.setState({ open: undefined })

const embedded = (href: string) => `${href}${href.includes('?') ? '&' : '?'}embed=1`

const KEY = 'previa-largura'
const MIN = 380
const PRESETS = { compacta: 480, ampla: 880 } as const

const readWidth = () => {
  try {
    const n = Number(localStorage.getItem(KEY))
    return n >= MIN ? n : PRESETS.ampla
  } catch {
    return PRESETS.ampla
  }
}

export const PreviewDrawer: React.FC = () => {
  const open = usePreview((s) => s.open)
  const [loading, setLoading] = useState(true)
  const [width, setWidth] = useState(readWidth)
  const [full, setFull] = useState(false)
  const [reload, setReload] = useState(0)
  const [resizing, setResizing] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => setLoading(true), [open?.href, reload])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePreview()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const setSaved = (w: number) => {
    const next = Math.round(Math.min(window.innerWidth, Math.max(MIN, w)))
    setWidth(next)
    try {
      localStorage.setItem(KEY, String(next))
    } catch {
      // vale até recarregar
    }
  }

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setResizing(true)
  }
  const onResize = (e: React.PointerEvent) => resizing && setSaved(window.innerWidth - e.clientX)

  if (!open) return null
  const w = full ? '100vw' : `min(${width}px, 100vw)`
  return (
    <aside role="dialog" aria-label={`Prévia: ${open.title}`} className="fixed inset-y-0 right-0 z-50 flex flex-col border-l bg-white shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.3)]" style={{ width: w }}>
      {!full && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar a largura"
          onPointerDown={startResize}
          onPointerMove={onResize}
          onPointerUp={() => setResizing(false)}
          onPointerCancel={() => setResizing(false)}
          className="absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize after:absolute after:inset-y-0 after:left-1 after:w-1 after:rounded-full after:bg-transparent hover:after:bg-violet-400"
        />
      )}
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b bg-white px-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{open.title}</p>
        <div role="group" aria-label="Tamanho" className="hidden items-center rounded-lg bg-gray-100 p-0.5 sm:flex">
          {([['compacta', PanelRight], ['ampla', PanelRight]] as const).map(([id], i) => (
            <button key={id} type="button" aria-pressed={!full && width === PRESETS[id]} onClick={() => { setFull(false); setSaved(PRESETS[id]) }} className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', !full && width === PRESETS[id] ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>{i === 0 ? 'Compacta' : 'Ampla'}</button>
          ))}
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Recarregar" title="Recarregar" onClick={() => setReload((n) => n + 1)}><RefreshCw className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={full ? 'Reduzir' : 'Tela cheia da prévia'} title={full ? 'Reduzir' : 'Ocupar a tela toda'} onClick={() => setFull((f) => !f)}>{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 bg-white"><Link to={open.href} onClick={closePreview}><ExternalLink className="h-3.5 w-3.5" /> Abrir</Link></Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Fechar a prévia" onClick={closePreview}><X className="h-4 w-4" /></Button>
      </header>
      <div className="relative min-h-0 flex-1 bg-zinc-100">
        {loading && <div className="absolute inset-0 z-[1] flex items-center justify-center gap-2 bg-zinc-50 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</div>}
        <iframe ref={frame} key={`${open.href}-${reload}`} src={embedded(open.href)} title={open.title} className={cn('h-full w-full border-0', resizing && 'pointer-events-none')} onLoad={() => setLoading(false)} />
      </div>
    </aside>
  )
}
