import React from 'react'
import { create } from 'zustand'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

/**
 * Uma janela pequena (webview) para ver a entrega sem sair do escritório: abre
 * a própria tela do app (documento, criativos, projeto) em modo embutido, sem o
 * menu lateral, ao lado da planta.
 */

interface PreviewState {
  open?: { href: string; title: string }
}

const usePreview = create<PreviewState>()(() => ({}))

export const openPreview = (target: { href: string; title: string }) => usePreview.setState({ open: target })
export const closePreview = () => usePreview.setState({ open: undefined })

const embedded = (href: string) => `${href}${href.includes('?') ? '&' : '?'}embed=1`

export const PreviewDrawer: React.FC = () => {
  const open = usePreview((s) => s.open)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => setLoading(true), [open?.href])
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePreview()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return (
    <aside role="dialog" aria-label={`Prévia: ${open.title}`} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l bg-white shadow-2xl">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{open.title}</p>
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 bg-white"><Link to={open.href} onClick={closePreview}><ExternalLink className="h-3.5 w-3.5" /> Abrir em tela cheia</Link></Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Fechar a prévia" onClick={closePreview}><X className="h-4 w-4" /></Button>
      </header>
      <div className="relative min-h-0 flex-1 bg-zinc-50">
        {loading && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</div>}
        <iframe key={open.href} src={embedded(open.href)} title={open.title} className="h-full w-full border-0" onLoad={() => setLoading(false)} />
      </div>
    </aside>
  )
}
