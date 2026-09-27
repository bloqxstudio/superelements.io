import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Download, ImageIcon, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBrandStore } from '@/features/space/brand/brandStore'
import { FeaturedImageEditor } from '@/features/space/featured/FeaturedImageEditor'
import { featuredPalette, readImageFile } from '@/features/space/featured/render'
import { clip, DESCRIPTION_LIMIT, pageTexts, SEO_TITLE_LIMIT, slugify, suggestSeo } from '@/features/space/featured/suggest'
import { collectImageUrls } from '@/features/space/pageImages'
import { useSpaceStore } from '@/store/spaceStore'
import { cn } from '@/lib/utils'
import type { FeaturedFields, FeaturedImage, PageDetails } from '@/types/space'
import { pageElements } from './publish'
import { CONNECTOR_ZIP, detectSeo, SEO_PLUGIN_NAMES, type SeoSupport } from './seo'
import { listSiteImages, type SiteImage } from './site'
import { useWordPressUi } from './uiStore'
import { useActiveWordPress } from './useWordPressConnection'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Contador ao lado do rótulo: passa do limite e fica âmbar, porque o Google corta. */
const Counter: React.FC<{ value: string; limit: number }> = ({ value, limit }) => (
  <span className={cn('text-[11px] tabular-nums', value.length > limit ? 'text-amber-700' : 'text-muted-foreground')}>
    {value.length}/{limit}
  </span>
)

/** Endereço enquanto digita: sem acento nem espaço, mas o hífen do fim fica para a próxima palavra. */
const slugDraft = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)

const featuredSrc =(featured?: FeaturedImage) =>
  featured?.kind === 'template' || featured?.kind === 'upload' ? featured.image : featured?.kind === 'media' ? featured.url : undefined

/** Aviso sobre o plugin de SEO do site: qual grava, ou o que falta para gravar. */
const SeoNotice: React.FC<{ seo: SeoSupport | null | 'loading'; connected: boolean }> = ({ seo, connected }) => {
  if (!connected) return <p className="text-xs text-muted-foreground">Os campos ficam guardados no projeto e vão para o plugin de SEO do site ao publicar.</p>
  if (seo === 'loading') {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Vendo o plugin de SEO do site…
      </p>
    )
  }
  if (!seo) return <p className="text-xs text-amber-700">Não foi possível ver o plugin de SEO do site.</p>
  if (seo.missing === 'plugin') {
    return (
      <p className="flex gap-2 text-xs text-amber-700">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />O site não tem Yoast, All in One SEO nem SEOPress. Título e descrição ficam
        guardados aqui, mas o site não usa.
      </p>
    )
  }
  if (seo.missing === 'connector') {
    return (
      <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
        <p>
          O Yoast só deixa gravar o SEO de páginas com o plugin Superelements Connector. Instale no site em Plugins, Adicionar novo, Enviar plugin, e abra esta
          tela de novo.
        </p>
        <a href={CONNECTOR_ZIP} download className="inline-flex w-fit items-center gap-1.5 font-medium underline underline-offset-2">
          <Download className="h-3.5 w-3.5" aria-hidden />
          Baixar o plugin (.zip)
        </a>
      </div>
    )
  }
  return <p className="text-xs text-muted-foreground">Grava no {SEO_PLUGIN_NAMES[seo.plugin!]} do site ao publicar.</p>
}

/**
 * Título, endereço, SEO e imagem destacada da página, guardados no projeto e
 * enviados ao publicar. É o conteúdo do diálogo das páginas (`WordPressPageDialogs`);
 * o editor da imagem entra no lugar do formulário, no mesmo diálogo.
 */
export const DetailsPanel: React.FC = () => {
  const pageId = useWordPressUi((s) => s.detailsPageId)
  const closeDetails = useWordPressUi((s) => s.closeDetails)
  const page = useSpaceStore((s) => s.pages.find((p) => p.id === pageId))
  const connection = useActiveWordPress()
  const brand = useBrandStore((s) => s.brand)
  const [draft, setDraft] = useState<PageDetails>({})
  const [seo, setSeo] = useState<SeoSupport | null | 'loading'>(null)
  const editing = useWordPressUi((s) => s.editingFeatured)
  const setEditing = useWordPressUi((s) => s.setEditingFeatured)
  const [library, setLibrary] = useState<{ status: 'closed' | 'loading' | 'ready' | 'error'; items: SiteImage[]; message?: string }>({
    status: 'closed',
    items: [],
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const open = !!pageId && !!page
  useEffect(() => {
    if (!pageId) return
    setDraft({ ...useSpaceStore.getState().pages.find((p) => p.id === pageId)?.details })
    setLibrary({ status: 'closed', items: [] })
  }, [pageId])

  useEffect(() => {
    if (!pageId || !connection) return setSeo(null)
    setSeo('loading')
    detectSeo(connection).then(setSeo, () => setSeo(null))
  }, [pageId, connection])

  // Conteúdo da página: sugestões de texto e fotos para o modelo
  const content = useMemo(() => {
    if (!pageId) return null
    try {
      return pageElements(pageId).elements
    } catch {
      return null
    }
  }, [pageId])
  const photos = useMemo(
    () => [...new Set([...(content ? collectImageUrls(content) : []), ...(brand?.photos.map((p) => p.url) ?? [])])],
    [content, brand]
  )

  if (!open || !page) return null

  const set = (patch: Partial<PageDetails>) => setDraft((d) => ({ ...d, ...patch }))
  const title = draft.title ?? ''
  const shownTitle = title.trim() || page.name
  const siteName = connection?.site.name
  const host = connection ? hostOf(connection.site.siteUrl) : 'seu-site.com.br'
  const slugPlaceholder = slugify(shownTitle) || 'pagina'
  const showKeyword = seo === null || seo === 'loading' || !!seo?.keyword

  const suggest = () => {
    const suggestion = suggestSeo(content ?? [], shownTitle, siteName)
    set({ seoTitle: suggestion.seoTitle, description: suggestion.description || draft.description })
    if (!suggestion.description) toast.info('A página não tem um parágrafo para virar descrição: escreva uma.')
  }

  const featuredInitial = (): { template: string; fields: FeaturedFields } => {
    if (draft.featured?.kind === 'template') return { template: draft.featured.template, fields: draft.featured.fields }
    const heading = content ? pageTexts(content).heading : undefined
    return {
      template: photos.length ? 'foto' : 'cor',
      fields: {
        title: draft.seoTitle?.split(' | ')[0]?.trim() || heading || shownTitle,
        photo: photos[0],
        color: featuredPalette(brand).background,
        logo: !!brand?.logo,
      },
    }
  }

  const uploadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      set({ featured: { kind: 'upload', image: await readImageFile(file), name: file.name } })
    } catch (error) {
      toast.error(errorText(error))
    }
  }

  const openLibrary = async () => {
    if (!connection) return
    setLibrary({ status: 'loading', items: [] })
    try {
      setLibrary({ status: 'ready', items: await listSiteImages(connection) })
    } catch (error) {
      setLibrary({ status: 'error', items: [], message: errorText(error) })
    }
  }

  const save = () => {
    const slug = draft.slug?.replace(/^-+|-+$/g, '')
    useSpaceStore.getState().setPageDetails(page.id, { ...draft, slug: slug || undefined })
    toast.success(`Detalhes de ${page.name} guardados`, { description: connection ? 'Vão para o site na próxima publicação.' : undefined })
    closeDetails()
  }

  const src = featuredSrc(draft.featured)
  const description = draft.description ?? ''
  const seoTitle = draft.seoTitle ?? ''

  if (editing) {
    return (
      <FeaturedImageEditor
        brand={brand}
        initial={featuredInitial()}
        photos={photos}
        onCancel={() => setEditing(false)}
        onUse={(featured) => {
          set({ featured })
          setEditing(false)
        }}
      />
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalhes da página</DialogTitle>
        <DialogDescription>
          {page.name}: o título, o endereço, o que aparece no Google e a imagem destacada. Vão para o site junto com a página.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor="details-title">Título da página</Label>
            <Input id="details-title" value={title} placeholder={page.name} onChange={(e) => set({ title: e.target.value })} autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="details-slug">Endereço</Label>
            <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="shrink-0 pl-3 text-sm text-muted-foreground">{host}/</span>
              <input
                id="details-slug"
                value={draft.slug ?? ''}
                placeholder={slugPlaceholder}
                onChange={(e) => set({ slug: slugDraft(e.target.value) })}
                autoComplete="off"
                spellCheck={false}
                className="h-10 min-w-0 flex-1 rounded-r-md bg-transparent px-1 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 border-t pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">SEO</h3>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={suggest} disabled={!content}>
                Sugerir pelo conteúdo
              </Button>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="details-seo-title">Título no Google</Label>
                <Counter value={seoTitle} limit={SEO_TITLE_LIMIT} />
              </div>
              <Input id="details-seo-title" value={seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} placeholder={siteName ? `${shownTitle} | ${siteName}` : shownTitle} autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="details-description">Descrição</Label>
                <Counter value={description} limit={DESCRIPTION_LIMIT} />
              </div>
              <Textarea id="details-description" value={description} onChange={(e) => set({ description: e.target.value })} rows={3} className="resize-y text-sm" />
            </div>
            {showKeyword && (
              <div className="grid gap-2">
                <Label htmlFor="details-keyword">
                  Palavra-chave <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input id="details-keyword" value={draft.focusKeyword ?? ''} onChange={(e) => set({ focusKeyword: e.target.value })} autoComplete="off" />
              </div>
            )}

            <div className="rounded-lg border px-4 py-3" aria-label="Prévia no Google">
              <p className="truncate text-xs text-gray-600">
                {host} › {draft.slug?.trim() || slugPlaceholder}
              </p>
              <p className="mt-0.5 truncate text-[17px] leading-snug text-[#1a0dab]">{clip(seoTitle.trim() || (siteName ? `${shownTitle} | ${siteName}` : shownTitle), SEO_TITLE_LIMIT)}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-gray-600">
                {description.trim() ? clip(description.trim(), DESCRIPTION_LIMIT) : 'Sem descrição: o Google escolhe um trecho da página.'}
              </p>
            </div>
            <SeoNotice seo={seo} connected={!!connection} />
          </div>
        </div>

        <div className="grid content-start gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Imagem destacada</h3>
          <div className="flex items-center justify-center overflow-hidden rounded-lg border bg-gray-50" style={{ aspectRatio: '1200 / 630' }}>
            {src ? (
              <img src={src} alt="Imagem destacada" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="h-5 w-5" aria-hidden />
                {draft.featured?.kind === 'none' ? 'Sem imagem destacada (a do site sai)' : 'Sem imagem destacada'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            É a imagem que aparece ao compartilhar a página no WhatsApp e nas redes, e nas listas do site.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" onClick={() => setEditing(true)}>
              {draft.featured?.kind === 'template' ? 'Editar o modelo' : 'Criar com modelo'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              Enviar arquivo
            </Button>
            {connection && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={openLibrary}>
                Da biblioteca do site
              </Button>
            )}
            {src && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                // Página ligada: tirar a imagem daqui tira a do site também
                onClick={() => set({ featured: page.wordpress ? { kind: 'none' } : undefined })}
              >
                Remover
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />

          {library.status === 'loading' && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Lendo a biblioteca de mídia…
            </p>
          )}
          {library.status === 'error' && <p className="text-xs text-destructive">{library.message}</p>}
          {library.status === 'ready' &&
            (library.items.length ? (
              <div className="grid max-h-[240px] grid-cols-4 gap-2 overflow-y-auto">
                {library.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => set({ featured: { kind: 'media', id: item.id, url: item.url } })}
                    aria-pressed={draft.featured?.kind === 'media' && draft.featured.id === item.id}
                    className={cn(
                      'aspect-square overflow-hidden rounded-md border transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
                      draft.featured?.kind === 'media' && draft.featured.id === item.id && 'ring-2 ring-gray-900 ring-offset-1'
                    )}
                  >
                    <img src={item.thumb} alt={item.alt ?? ''} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">A biblioteca de mídia do site não tem imagens.</p>
            ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={closeDetails}>
          Cancelar
        </Button>
        <Button type="button" onClick={save}>
          Guardar detalhes
        </Button>
      </DialogFooter>
    </>
  )
}
