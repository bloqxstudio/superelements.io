import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Columns3, Copy, Download, Link2, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { renderElementorDocument } from '@/engine/elementor'
import { SCREEN_HEIGHT, VIEWPORT_WIDTH, type PreviewViewport } from '@/features/elementor-preview/PreviewFrame'
import { useSpaceStore } from '@/store/spaceStore'
import { buildLandingPage } from '../landingPage'
import { copyLandingToElementor, downloadLandingHtml } from '../exportLanding'
import { useSiteKit } from '@/features/wordpress/siteKitStore'
import { isFromSite, renderKit } from '../renderKit'
import { useActiveBrand } from '../brand/brandStore'
import { ApprovalPanel } from '@/features/approval/ApprovalPanel'
import { shareState, useApprovalStore } from '@/features/approval/approvalStore'
import { pageSections, plural } from './pages'
import { slugify } from '../featured/suggest'
import type { SpacePage } from '@/types/space'

/** Altura da legenda abaixo da tela, fora da conta da escala. */
const CAPTION_HEIGHT = 24

/** 'all': as três telas lado a lado, para comparar o responsivo. */
type PlayerView = PreviewViewport | 'all'

const VIEWPORTS: { key: PlayerView; label: string; icon: React.ElementType }[] = [
  { key: 'desktop', label: 'Desktop', icon: Monitor },
  { key: 'tablet', label: 'Tablet', icon: Tablet },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
  { key: 'all', label: 'Lado a lado', icon: Columns3 },
]

/** Parte da largura de cada tela no lado a lado, perto da proporção entre elas. */
const SIDE_BY_SIDE: { viewport: PreviewViewport; grow: number }[] = [
  { viewport: 'desktop', grow: 5 },
  { viewport: 'tablet', grow: 3 },
  { viewport: 'mobile', grow: 2 },
]

interface PlayerNavigation {
  routes: Record<string, string>
  origins: string[]
}

const normalizePath = (path: string) => {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return clean || '/'
}

/** Endereços que o player reconhece como páginas deste projeto. */
const playerNavigation = (pages: SpacePage[]): PlayerNavigation => {
  const routes: Record<string, string> = {}
  const origins = new Set<string>()
  const addRoute = (path: string, targetPageId: string) => {
    const normalized = normalizePath(path.startsWith('/') ? path : `/${path}`)
    routes[normalized] ??= targetPageId
  }

  pages.forEach((page) => {
    const slug = page.details?.slug?.trim() || slugify(page.details?.title?.trim() || page.name)
    if (slug) addRoute(slug, page.id)

    if (page.wordpress?.link) {
      try {
        const link = new URL(page.wordpress.link)
        origins.add(link.origin)
        addRoute(link.pathname, page.id)
      } catch {
        // Um vínculo antigo pode ter guardado uma URL incompleta; o slug continua funcionando.
      }
    }
    if (page.wordpress?.siteUrl) {
      try {
        origins.add(new URL(page.wordpress.siteUrl).origin)
      } catch {
        // Mesmo caso acima: não impede os links relativos do preview.
      }
    }
  })

  const home = pages.find((page) => {
    const value = page.details?.slug?.trim() || slugify(page.details?.title?.trim() || page.name)
    return ['home', 'inicio'].includes(value)
  })
  if (!routes['/'] && (home || pages[0])) routes['/'] = (home || pages[0]).id

  return { routes, origins: [...origins] }
}

/**
 * O iframe tem origem isolada pelo sandbox. Esta ponte captura apenas links que
 * correspondem a páginas do projeto e pede ao player para trocar de documento.
 * Âncoras da própria página e links externos continuam com o comportamento normal.
 */
const withPlayerNavigation = (html: string, navigation: PlayerNavigation, currentPageId: string) => {
  const config = JSON.stringify({ ...navigation, currentPageId }).replace(/</g, '\\u003c')
  const script = `<style data-se-player-navigation>html{transition:opacity 160ms ease}html.se-player-leaving{opacity:0}@media(prefers-reduced-motion:reduce){html{transition:none}}</style><script data-se-player-navigation>(function(){
var config=${config};
var leaving=false;
var normalize=function(path){var clean=String(path||'').split(/[?#]/,1)[0].replace(/\\/{2,}/g,'/').replace(/\\/$/,'');return clean||'/'};
var match=function(anchor){
  var raw=(anchor.getAttribute('href')||'').trim();
  if(!raw||raw.charAt(0)==='#'||raw.charAt(0)==='?'||/^(mailto|tel|sms|javascript|data):/i.test(raw))return null;
  var path='';var hash='';
  try{
    if(/^[a-z][a-z\\d+.-]*:/i.test(raw)||raw.indexOf('//')===0){
      var absolute=new URL(raw,document.baseURI);
      if(config.origins.indexOf(absolute.origin)===-1)return null;
      path=absolute.pathname;hash=absolute.hash;
    }else{
      var parts=raw.split('#');hash=parts.length>1?'#'+parts.slice(1).join('#'):'';
      var withoutQuery=parts[0].split('?')[0];
      path=withoutQuery.charAt(0)==='/'?withoutQuery:'/'+withoutQuery.replace(/^(?:\\.\\.?\\/)+/,'');
    }
  }catch(error){return null}
  var pageId=config.routes[normalize(path)];
  return pageId?{pageId:pageId,hash:hash}:null;
};
document.addEventListener('click',function(event){
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  var target=event.target;var anchor=target&&target.closest?target.closest('a[href]'):null;
  if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
  var route=match(anchor);if(!route)return;
  event.preventDefault();
  if(route.pageId===config.currentPageId&&route.hash){
    var destination=null;
    try{destination=document.getElementById(decodeURIComponent(route.hash.slice(1)))||document.querySelector(route.hash)}catch(error){}
    if(destination)destination.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if(leaving)return;leaving=true;
  document.documentElement.classList.add('se-player-leaving');
  var delay=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:160;
  window.setTimeout(function(){parent.postMessage({type:'se-player-navigate',pageId:route.pageId},'*')},delay);
},true);
}());</script>`
  return html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`
}

/**
 * Uma tela do device com a página rolando dentro dela, como no navegador: as
 * animações de entrada disparam conforme a seção aparece, e `vh` vale a altura
 * da tela. A tela é escalada para caber inteira na área disponível.
 */
const Screen: React.FC<{
  html: string
  viewport: PreviewViewport
  replay: number
  pageId: string
  navigation: PlayerNavigation
  onNavigate: (pageId: string) => void
}> = ({ html, viewport, replay, pageId, navigation, onNavigate }) => {
  const areaRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
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
  const srcDoc = useMemo(
    () => withPlayerNavigation(html.replace('</head>', `<style>:root{--se-vh:${height / 100}px}</style></head>`), navigation, pageId),
    [html, height, navigation, pageId]
  )

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.type !== 'se-player-navigate') return
      if (typeof event.data.pageId === 'string') onNavigate(event.data.pageId)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [onNavigate])

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
              key={`${pageId}-${viewport}-${replay}`}
              ref={frameRef}
              title="Player da página"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className="animate-in fade-in duration-200 motion-reduce:animate-none"
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
  const pages = useSpaceStore((s) => s.pages)
  const playing = pages.find((page) => page.id === pageId)
  const [history, setHistory] = useState<{ basePageId: string | null; entries: string[]; index: number }>({ basePageId: null, entries: [], index: -1 })
  useEffect(() => {
    if (pageId) setHistory({ basePageId: pageId, entries: [pageId], index: 0 })
  }, [pageId])
  const currentPageId = history.basePageId === pageId ? history.entries[history.index] || pageId : pageId
  const currentPage = pages.find((page) => page.id === currentPageId) ?? playing
  // Ao fechar, o conteúdo continua o da última página enquanto o diálogo some
  const lastPage = useRef(currentPage)
  if (currentPage) lastPage.current = currentPage
  const page = currentPage ?? lastPage.current
  const nodes = useSpaceStore((s) => s.nodes)
  const connections = useSpaceStore((s) => s.connections)
  const closePlayer = useSpaceStore((s) => s.closePlayer)
  const brand = useActiveBrand()
  const siteKit = useSiteKit()
  const [viewport, setViewport] = useState<PlayerView>('desktop')
  // Abre na tela que o canvas está mostrando
  useEffect(() => {
    if (pageId) setViewport(useSpaceStore.getState().previewDevice)
  }, [pageId])
  const [replay, setReplay] = useState(0)
  const navigation = useMemo(() => playerNavigation(pages), [pages])
  const navigate = useCallback(
    (targetPageId: string) => {
      if (!pages.some((candidate) => candidate.id === targetPageId)) return
      if (targetPageId === currentPageId) {
        setReplay((value) => value + 1)
        return
      }
      setHistory((current) => {
        const sameSession = current.basePageId === pageId
        const entries = sameSession && current.entries.length ? current.entries : pageId ? [pageId] : []
        const index = sameSession && current.index >= 0 ? current.index : entries.length - 1
        return { basePageId: pageId, entries: [...entries.slice(0, index + 1), targetPageId], index: index + 1 }
      })
    },
    [currentPageId, pageId, pages]
  )
  const moveHistory = (direction: -1 | 1) => {
    setHistory((current) => ({ ...current, index: Math.max(0, Math.min(current.entries.length - 1, current.index + direction)) }))
  }
  const canGoBack = history.basePageId === pageId && history.index > 0
  const canGoForward = history.basePageId === pageId && history.index >= 0 && history.index < history.entries.length - 1
  const approvalOpen = useApprovalStore((s) => s.panelOpen)
  const approval = shareState(useApprovalStore((s) => (page ? s.shares[page.id] : undefined))).kind
  const setApprovalOpen = useApprovalStore((s) => s.setPanelOpen)

  const built = useMemo(
    () => (page ? buildLandingPage(pageSections(page, nodes), nodes, connections, brand) : null),
    [page, nodes, connections, brand]
  )
  const html = useMemo(
    () =>
      built?.elements.length && page
        ? renderElementorDocument(built.elements, {
            title: page.name,
            kit: renderKit(brand, siteKit, pageSections(page, nodes).some(isFromSite)),
            motion: 'play',
          }).document
        : null,
    [built, page, nodes, brand, siteKit]
  )

  const count = built?.sectionCount ?? 0
  const skipped = built?.skipped ? ` · ${plural(built.skipped, 'seção sem JSON ficou', 'seções sem JSON ficaram')} de fora` : ''

  return (
    <Dialog
      open={!!playing}
      onOpenChange={(open) => {
        if (open) return
        closePlayer()
        setApprovalOpen(false)
      }}
    >
      <DialogContent className="flex h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b px-4 py-3 pr-12">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex items-center gap-0.5" aria-label="Histórico do preview">
              <Button size="icon" variant="ghost" className="h-7 w-7 active:scale-[0.96]" disabled={!canGoBack} onClick={() => moveHistory(-1)} title="Página anterior">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="sr-only">Página anterior</span>
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 active:scale-[0.96]" disabled={!canGoForward} onClick={() => moveHistory(1)} title="Próxima página">
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="sr-only">Próxima página</span>
              </Button>
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{page?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                {plural(count, 'seção', 'seções')}{skipped}. Links internos navegam entre as páginas do projeto.
              </DialogDescription>
            </div>
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
            <Button
              size="sm"
              variant={approvalOpen ? 'secondary' : 'outline'}
              className="relative h-8 gap-1.5 text-xs active:scale-[0.96]"
              aria-expanded={approvalOpen}
              onClick={() => setApprovalOpen(!approvalOpen)}
              title="Link para o cliente ver a página e aprovar, sem login"
            >
              <Link2 className="h-3.5 w-3.5" /> Aprovação
              {approval !== 'none' && (
                <>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${approval === 'approved' ? 'bg-emerald-500' : approval === 'changes' ? 'bg-amber-500' : 'bg-gray-400'}`}
                    aria-hidden
                  />
                  <span className="sr-only">{approval === 'approved' ? '(aprovada)' : approval === 'changes' ? '(ajuste pedido)' : '(aguardando resposta)'}</span>
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs active:scale-[0.96]" onClick={() => downloadLandingHtml(page?.id ?? null)} disabled={!html}>
              <Download className="h-3.5 w-3.5" /> Baixar HTML
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs active:scale-[0.96]" onClick={() => copyLandingToElementor({ pageId: page?.id ?? null })} disabled={!html}>
              <Copy className="h-3.5 w-3.5" /> Copiar para o Elementor
            </Button>
          </div>
        </DialogHeader>

        {approvalOpen && page && <ApprovalPanel pageId={page.id} pageName={page.name} html={html} />}

        <div className="flex min-h-0 flex-1 flex-col bg-muted/40 p-4">
          {html && viewport === 'all' ? (
            <div className="flex min-h-0 flex-1 gap-4">
              {SIDE_BY_SIDE.map(({ viewport: device, grow }) => (
                <div key={device} className="flex min-h-0 min-w-0 flex-col" style={{ flex: `${grow} 1 0` }}>
                  <Screen html={html} viewport={device} replay={replay} pageId={page!.id} navigation={navigation} onNavigate={navigate} />
                </div>
              ))}
            </div>
          ) : html ? (
            <Screen html={html} viewport={viewport === 'all' ? 'desktop' : viewport} replay={replay} pageId={page!.id} navigation={navigation} onNavigate={navigate} />
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
