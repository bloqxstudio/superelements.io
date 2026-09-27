import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleAlert, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBrandStore } from '@/features/space/brand/brandStore'
import { plural } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import { cn } from '@/lib/utils'
import { designMdFromSite } from './brand'
import { ELEMENTOR_REST_VERSION, fetchSiteKit, fetchSiteLogo, fetchSitePage, listSitePages, type SiteLogo, type SitePageList } from './site'
import { useSiteKitStore, type SiteKit } from './siteKitStore'
import { detectSeo } from './seo'
import { STATUS_LABELS, useWordPressUi, wpDate } from './uiStore'
import { useActiveWordPress } from './useWordPressConnection'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: SitePageList; kit: SiteKit | null; kitError?: string; logo: SiteLogo | null }

const Chip: React.FC<{ children: React.ReactNode; tone?: 'default' | 'muted' | 'violet' }> = ({ children, tone = 'default' }) => (
  <span
    className={cn(
      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4',
      tone === 'default' && 'bg-gray-100 text-gray-700',
      tone === 'muted' && 'bg-gray-50 text-gray-500',
      tone === 'violet' && 'bg-violet-50 text-violet-700'
    )}
  >
    {children}
  </span>
)

const fontLabel = (kit: SiteKit, id: string) => {
  const font = kit.typography[id]
  return font?.family ? `${font.family}${font.weight ? ` ${font.weight}` : ''}` : null
}

/** Marca do site: as cores e fontes globais do Elementor e o logo, com o botão de usar no projeto. */
const SiteBrand: React.FC<{ siteName: string; kit: SiteKit | null; kitError?: string; logo: SiteLogo | null }> = ({ siteName, kit, kitError, logo }) => {
  const currentBrand = useBrandStore((s) => s.brand)
  const [confirming, setConfirming] = useState(false)

  if (!kit) {
    return (
      <p className="flex gap-2 rounded-lg border px-4 py-3 text-xs text-amber-700">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Não foi possível ler as cores e fontes globais do Elementor{kitError ? `: ${kitError}` : '.'}
      </p>
    )
  }

  const apply = () => {
    const { setSource, setEnabled } = useBrandStore.getState()
    setSource(designMdFromSite(siteName, kit, logo))
    setEnabled(true)
    useSiteKitStore.getState().setKit(kit)
    setConfirming(false)
    toast.success('A marca do site agora é a marca do projeto', {
      description: 'As cores e fontes globais do Elementor viraram o DESIGN.md. As seções importadas do site continuam como estão.',
    })
  }

  const colors = Object.entries(kit.colors)
  const heading = fontLabel(kit, 'primary')
  const body = fontLabel(kit, 'text')

  return (
    <div className="grid gap-3 rounded-lg border px-4 py-3">
      <div className="flex items-center gap-4">
        {logo && <img src={logo.url} alt={logo.alt ?? ''} className="h-8 max-w-[96px] shrink-0 object-contain" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1" aria-label="Cores globais do site">
            {colors.map(([id, value]) => (
              <span
                key={id}
                title={`${kit.titles[id] ?? id}: ${value}`}
                className="h-5 w-5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {[heading && `Títulos: ${heading}`, body && `Texto: ${body}`].filter(Boolean).join(' · ') || 'Sem fontes globais'}
          </p>
        </div>
        {!confirming && (
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => (currentBrand ? setConfirming(true) : apply())}>
            Usar como marca do projeto
          </Button>
        )}
      </div>
      {confirming && (
        <div className="flex flex-col gap-2 border-t pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-gray-700">Trocar a marca atual ({currentBrand?.name}) pela do site? O DESIGN.md do projeto é substituído.</p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="h-8 text-xs" onClick={apply}>
              Trocar a marca
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Páginas e marca do WordPress do cliente, para trazer ao canvas. */
export const WordPressImportDialog: React.FC = () => {
  const open = useWordPressUi((s) => s.importOpen)
  const close = useWordPressUi((s) => s.close)
  const connection = useActiveWordPress()
  const canvasPages = useSpaceStore((s) => s.pages)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!connection) return
    setLoad({ status: 'loading' })
    try {
      const [list, kit, logo] = await Promise.all([
        listSitePages(connection),
        fetchSiteKit(connection).then(
          (kit) => ({ kit, error: undefined }),
          (error) => ({ kit: null, error: errorText(error) })
        ),
        fetchSiteLogo(connection).catch(() => null),
      ])
      setLoad({ status: 'ready', list, kit: kit.kit, kitError: kit.error, logo })
    } catch (error) {
      setLoad({ status: 'error', message: errorText(error) })
    }
  }, [connection])

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setProgress(null)
    refresh()
  }, [open, refresh])

  // Página do canvas já ligada a cada página do site
  const linked = useMemo(() => {
    const map = new Map<number, string>()
    for (const page of canvasPages) if (page.wordpress && page.wordpress.siteUrl === connection?.site.siteUrl) map.set(page.wordpress.postId, page.id)
    return map
  }, [canvasPages, connection])

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const importSelected = async () => {
    if (!connection || load.status !== 'ready') return
    const ids = [...selected]
    // As seções do site apontam para as cores globais dele: o Kit entra junto
    if (load.kit) useSiteKitStore.getState().setKit(load.kit)

    const failed: string[] = []
    let imported = 0
    const seo = await detectSeo(connection).catch(() => undefined)
    for (const [index, id] of ids.entries()) {
      setProgress(`Importando ${index + 1} de ${ids.length}…`)
      try {
        const page = await fetchSitePage(connection, id, seo)
        const { pages, loadSitePage, setPageDetails } = useSpaceStore.getState()
        const existing = pages.find((p) => p.wordpress?.postId === id && p.wordpress.siteUrl === connection.site.siteUrl)
        setPageDetails(loadSitePage(page.name, page.sections, page.link, existing?.id), page.details)
        imported++
      } catch (error) {
        const title = load.list.pages.find((p) => p.id === id)?.title ?? `Página ${id}`
        failed.push(`${title}: ${errorText(error)}`)
      }
    }
    setProgress(null)

    if (imported) toast.success(`${plural(imported, 'página importada', 'páginas importadas')} do WordPress`)
    if (failed.length) toast.error(`${plural(failed.length, 'página não veio', 'páginas não vieram')}`, { description: failed.join('\n') })
    if (!failed.length) close()
  }

  const relinked = [...selected].filter((id) => linked.has(id)).length

  let body: React.ReactNode
  if (!connection) {
    body = <p className="text-sm text-muted-foreground">Conecte o WordPress do cliente pelo botão WordPress, no alto da tela.</p>
  } else if (load.status === 'loading') {
    body = (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Lendo o site…
      </p>
    )
  } else if (load.status === 'error') {
    body = (
      <div className="grid justify-items-start gap-3 py-4">
        <p className="flex gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {load.message}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={refresh}>
          <RefreshCw aria-hidden />
          Tentar de novo
        </Button>
      </div>
    )
  } else {
    const { pages, noElementorData } = load.list
    body = (
      <div className="grid gap-5">
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Marca do site</h3>
          <SiteBrand siteName={connection.site.name} kit={load.kit} kitError={load.kitError} logo={load.logo} />
        </section>

        <section className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Páginas</h3>
          {noElementorData ? (
            <p className="flex gap-2 rounded-lg border px-4 py-3 text-xs text-amber-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              O Elementor deste site não mostra o conteúdo das páginas pela API. Isso começa na versão {ELEMENTOR_REST_VERSION}: atualize o
              Elementor no site e abra esta tela de novo.
            </p>
          ) : !pages.length ? (
            <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">O site não tem páginas.</p>
          ) : (
            <ul className="max-h-[320px] divide-y overflow-y-auto rounded-lg border">
              {pages.map((page) => {
                const inCanvas = linked.has(page.id)
                return (
                  <li key={page.id}>
                    <label
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                        page.elementor ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-gray-900"
                        checked={selected.has(page.id)}
                        disabled={!page.elementor || !!progress}
                        onChange={() => toggle(page.id)}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{page.title}</span>
                      {inCanvas && <Chip tone="violet">No canvas</Chip>}
                      {!page.elementor && <Chip tone="muted">Sem Elementor</Chip>}
                      <Chip>{STATUS_LABELS[page.status] ?? page.status}</Chip>
                      <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">{wpDate(page.modifiedGmt)}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {relinked > 0 && (
            <p className="text-xs text-amber-700">
              {relinked === 1 ? 'Uma delas já está' : `${relinked} delas já estão`} no canvas: importar de novo troca as seções pela versão do
              site.
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !progress && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar do WordPress</DialogTitle>
          <DialogDescription>
            {connection ? `${connection.site.name}. ` : ''}As páginas entram no canvas como estão no site. Ao publicar, a plataforma atualiza
            a mesma página lá.
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={!!progress}>
            Fechar
          </Button>
          <Button type="button" onClick={importSelected} disabled={!selected.size || !!progress || load.status !== 'ready'}>
            {progress && <Loader2 className="animate-spin" aria-hidden />}
            {progress ?? (selected.size ? `Importar ${plural(selected.size, 'página', 'páginas')}` : 'Importar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
