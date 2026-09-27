import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { renderElementorDocument } from '@/engine/elementor'
import { SCREEN_HEIGHT, VIEWPORT_WIDTH, type PreviewViewport } from '@/features/elementor-preview/PreviewFrame'
import { useSpaceStore } from '@/store/spaceStore'
import { buildLandingPage } from '../landingPage'
import { copyLandingToElementor, downloadLandingHtml } from '../exportLanding'
import { brandKit } from '../brand/applyBrand'
import { useActiveBrand } from '../brand/brandStore'
import { pageSections, plural } from './pages'

/** Altura da legenda abaixo da tela, fora da conta da escala. */
const CAPTION_HEIGHT = 24

const VIEWPORTS: { key: PreviewViewport; label: string; icon: React.ElementType }[] = [
  { key: 'desktop', label: 'Desktop', icon: Monitor },
  { key: 'tablet', label: 'Tablet', icon: Tablet },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
]

/**
 * Uma tela do device com a página rolando dentro dela, como no navegador: as
 * animações de entrada disparam conforme a seção aparece, e `vh` vale a altura
 * da tela. A tela é escalada para caber inteira na área disponível.
 */
const Screen: React.FC<{ html: string; viewport: PreviewViewport; replay: number }> = ({ html, viewport, replay }) => {
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setArea({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const width = VIEWPORT_WIDTH[viewport]
  const height = SCREEN_HEIGHT[viewport]
  const scale = area.width && area.height ? Math.min(1, area.width / width, (area.height - CAPTION_HEIGHT) / height) : 0
  const srcDoc = useMemo(() => html.replace('</head>', `<style>:root{--se-vh:${height / 100}px}</style></head>`), [html, height])

  return (
    <div ref={areaRef} className="flex min-h-0 flex-1 flex-col items-center justify-center">
      {scale > 0 && (
        <>
          <div
            className="overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_32px_-8px_rgb(0_0_0/0.18)]"
            style={{ width: width * scale, height: height * scale }}
          >
            <iframe
              // Trocar de device ou pedir de novo recomeça do topo, com as animações
              key={`${viewport}-${replay}`}
              title="Player da página"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              style={{ width, height, border: 0, display: 'block', transform: `scale(${scale})`, transformOrigin: '0 0' }}
            />
          </div>
          <p className="mt-2 text-center text-[11px] tabular-nums text-muted-foreground">
            {width} × {height} · {Math.round(scale * 100)}%
          </p>
        </>
      )}
    </div>
  )
}

/** Player de uma página: só ela, na tela do device, para rolar como no site. */
export const PagePlayer: React.FC = () => {
  const pageId = useSpaceStore((s) => s.playingPageId)
  const playing = useSpaceStore((s) => s.pages.find((p) => p.id === s.playingPageId))
  // Ao fechar, o conteúdo continua o da última página enquanto o diálogo some
  const lastPage = useRef(playing)
  if (playing) lastPage.current = playing
  const page = playing ?? lastPage.current
  const nodes = useSpaceStore((s) => s.nodes)
  const connections = useSpaceStore((s) => s.connections)
  const closePlayer = useSpaceStore((s) => s.closePlayer)
  const brand = useActiveBrand()
  const [viewport, setViewport] = useState<PreviewViewport>('desktop')
  const [replay, setReplay] = useState(0)

  const built = useMemo(
    () => (page ? buildLandingPage(pageSections(page, nodes), nodes, connections, brand) : null),
    [page, nodes, connections, brand]
  )
  const html = useMemo(
    () =>
      built?.elements.length && page
        ? renderElementorDocument(built.elements, { title: page.name, kit: brand ? brandKit(brand) : undefined, motion: 'play' }).document
        : null,
    [built, page, brand]
  )

  const count = built?.sectionCount ?? 0
  const skipped = built?.skipped ? ` · ${plural(built.skipped, 'seção sem JSON ficou', 'seções sem JSON ficaram')} de fora` : ''

  return (
    <Dialog open={!!playing} onOpenChange={(open) => !open && closePlayer()}>
      <DialogContent className="flex h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b px-4 py-3 pr-12">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">{page?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              {plural(count, 'seção', 'seções')}{skipped}. Role dentro da tela para ver a página como no site.
            </DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {VIEWPORTS.map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={viewport === key ? 'default' : 'ghost'}
                  className="h-7 gap-1.5 px-2.5 active:scale-[0.96]"
                  aria-pressed={viewport === key}
                  onClick={() => setViewport(key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs active:scale-[0.96]"
              onClick={() => setReplay((n) => n + 1)}
              disabled={!html}
              title="Voltar ao topo e rever as animações"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Recomeçar
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs active:scale-[0.96]" onClick={() => downloadLandingHtml(pageId)} disabled={!html}>
              <Download className="h-3.5 w-3.5" /> Baixar HTML
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs active:scale-[0.96]" onClick={() => copyLandingToElementor({ pageId })} disabled={!html}>
              <Copy className="h-3.5 w-3.5" /> Copiar para o Elementor
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-muted/40 p-4">
          {html ? (
            <Screen html={html} viewport={viewport} replay={replay} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              A página {page?.name} ainda não tem seção com JSON válido.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
