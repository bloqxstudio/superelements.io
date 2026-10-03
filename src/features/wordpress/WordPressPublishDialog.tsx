import React, { useEffect, useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { slugify } from '@/features/space/featured/suggest'
import { plural } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import { cn } from '@/lib/utils'
import {
  imagesToUpload,
  PageConflictError,
  pageBackups,
  pageElements,
  publishPage,
  restoreLastBackup,
  type PageStatus,
  type PageTemplate,
  type PublishResult,
} from './publish'
import { detectSeo, SEO_PLUGIN_NAMES } from './seo'
import { fetchSitePage } from './site'
import { STATUS_LABELS, useWordPressUi, wpDate } from './uiStore'
import { useActiveWordPress, useWordPressSession } from './useWordPressConnection'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

type Element = { widgetType?: string; elements?: Element[] }
const hasHtmlWidget = (elements: Element[]): boolean => elements.some((el) => el.widgetType === 'html' || hasHtmlWidget(el.elements ?? []))

interface Choice<T extends string> {
  value: T
  label: string
  hint: string
  disabled?: boolean
}

function Choices<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: Choice<T>[]; onChange: (value: T) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
            value === option.value ? 'border-gray-900 bg-gray-50' : 'hover:bg-gray-50',
            option.disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <input
            type="radio"
            name={name}
            className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900"
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

const TEMPLATE_OPTIONS: Choice<PageTemplate>[] = [
  { value: 'elementor_canvas', label: 'Tela cheia', hint: 'Tela do Elementor: só as seções da página, sem o cabeçalho e o rodapé do tema' },
  { value: 'elementor_header_footer', label: 'Com o tema', hint: 'Cabeçalho e rodapé do tema em volta' },
]

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www./, '')
  } catch {
    return url
  }
}

/** O que vai junto com a página: título, endereço, SEO e imagem destacada, com o botão para editar. */
const DetailsSummary: React.FC<{ pageId: string }> = ({ pageId }) => {
  const page = useSpaceStore((s) => s.pages.find((p) => p.id === pageId))
  const connection = useActiveWordPress()
  if (!page) return null
  const details = page.details ?? {}
  const featured = details.featured
  const src = featured?.kind === 'template' || featured?.kind === 'upload' ? featured.image : featured?.kind === 'media' ? featured.url : undefined
  const title = details.title?.trim() || page.wordpress?.title || page.name
  const slug = details.slug?.trim() || slugify(title)
  const seo = details.seoTitle?.trim() || details.description?.trim()

  return (
    <div className="flex gap-3 rounded-lg border p-3">
      <div className="flex h-[58px] w-[110px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-gray-50">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[10px] leading-3 text-muted-foreground">Sem imagem destacada</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {connection ? hostOf(connection.site.siteUrl) : ''}/{slug}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{seo ? `SEO: ${details.seoTitle?.trim() || details.description?.trim()}` : 'Sem título e descrição de SEO'}</p>
      </div>
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 self-center text-xs" onClick={() => useWordPressUi.getState().openDetails(pageId)}>
        Editar detalhes
      </Button>
    </div>
  )
}

type Phase =
  | { kind: 'form' }
  | { kind: 'working'; step: string }
  | { kind: 'conflict'; modifiedGmt: string }
  | { kind: 'done'; result: PublishResult }
  | { kind: 'error'; message: string }

/**
 * Publica a página do canvas no WordPress do cliente, ou atualiza a página
 * ligada a ela. É o conteúdo do diálogo das páginas (`WordPressPageDialogs`).
 */
export const PublishPanel: React.FC = () => {
  const pageId = useWordPressUi((s) => s.publishPageId)
  const close = useWordPressUi((s) => s.close)
  const connection = useActiveWordPress()
  const projectId = useWordPressSession((s) => s.projectId)
  const page = useSpaceStore((s) => s.pages.find((p) => p.id === pageId))
  const nodes = useSpaceStore((s) => s.nodes)
  const link = page?.wordpress && connection && page.wordpress.siteUrl === connection.site.siteUrl ? page.wordpress : undefined

  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [status, setStatus] = useState<PageStatus>('draft')
  const [publishDraft, setPublishDraft] = useState(false)
  const [template, setTemplate] = useState<PageTemplate>('elementor_canvas')
  const [backups, setBackups] = useState<{ count: number; last?: number }>({ count: 0 })

  const open = !!pageId && !!page
  useEffect(() => {
    if (!pageId) return
    setPhase({ kind: 'form' })
    setStatus('draft')
    setPublishDraft(false)
    setTemplate('elementor_canvas')
  }, [pageId])

  // Enquanto grava, o diálogo não fecha
  useEffect(() => {
    useWordPressUi.getState().setBusy(phase.kind === 'working')
    return () => useWordPressUi.getState().setBusy(false)
  }, [phase.kind])

  useEffect(() => {
    if (!open || !link || !projectId) return setBackups({ count: 0 })
    pageBackups(projectId, link.postId)
      .then((list) => setBackups({ count: list.length, last: list[0]?.savedAt }))
      .catch(() => setBackups({ count: 0 }))
  }, [open, link, projectId, phase.kind])

  // O que vai para o site: seções, imagens a enviar e widgets HTML
  const summary = useMemo(() => {
    if (!open || !connection || !pageId) return null
    try {
      const { elements, sectionCount } = pageElements(pageId)
      return { sectionCount, images: imagesToUpload(elements, connection).length, html: hasHtmlWidget(elements as Element[]) }
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pageId, connection, nodes, page?.sectionIds])

  if (!open || !page) return null

  const run = async (overwrite = false) => {
    if (!connection || !projectId) return
    setPhase({ kind: 'working', step: 'Preparando a página…' })
    try {
      const result = await publishPage({
        connection,
        projectId,
        pageId: page.id,
        status: link ? (publishDraft ? 'publish' : undefined) : status,
        template,
        overwrite,
        onProgress: (step) => setPhase({ kind: 'working', step }),
      })
      setPhase({ kind: 'done', result })
    } catch (error) {
      if (error instanceof PageConflictError) setPhase({ kind: 'conflict', modifiedGmt: error.modifiedGmt })
      else setPhase({ kind: 'error', message: errorText(error) })
    }
  }

  const bringSiteVersion = async () => {
    if (!connection || !link) return
    setPhase({ kind: 'working', step: 'Trazendo a versão do site…' })
    try {
      const imported = await fetchSitePage(connection, link.postId, await detectSeo(connection).catch(() => undefined))
      const { loadSitePage, setPageDetails } = useSpaceStore.getState()
      setPageDetails(loadSitePage(imported.name, imported.sections, imported.link, page.id), imported.details)
      toast.success(`${page.name} agora está como no site`)
      close()
    } catch (error) {
      setPhase({ kind: 'error', message: errorText(error) })
    }
  }

  const undo = async () => {
    if (!connection || !projectId) return
    setPhase({ kind: 'working', step: 'Voltando a versão anterior no site…' })
    try {
      const restored = await restoreLastBackup(connection, projectId, page.id)
      toast.success('O site voltou para a versão anterior', {
        description: `A de ${new Date(restored.restoredFrom).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. O canvas continua com as suas mudanças.`,
      })
      setPhase({ kind: 'form' })
    } catch (error) {
      setPhase({ kind: 'error', message: errorText(error) })
    }
  }

  const unlink = () => {
    useSpaceStore.getState().setPageWordPress(page.id, undefined)
    toast.success(`${page.name} não está mais ligada ao WordPress`, { description: 'A próxima publicação cria uma página nova no site.' })
  }

  const heading =
    phase.kind === 'done'
      ? phase.result.created
        ? 'Página publicada no WordPress'
        : 'Página atualizada no WordPress'
      : link
        ? 'Atualizar no WordPress'
        : 'Publicar no WordPress'
  const canPublish = !!connection?.can.publishPages
  const statusOptions: Choice<PageStatus>[] = [
    { value: 'draft', label: 'Rascunho', hint: 'Só quem está logado no site vê' },
    { value: 'publish', label: 'Publicada', hint: 'No ar, no endereço da página', disabled: !canPublish },
  ]
  const blocked = !connection?.can.editPages

  let body: React.ReactNode
  let footer: React.ReactNode

  if (!connection) {
    body = <p className="text-sm text-muted-foreground">Conecte o WordPress do cliente pelo botão WordPress, no alto da tela.</p>
    footer = (
      <Button type="button" onClick={close}>
        Fechar
      </Button>
    )
  } else if (phase.kind === 'working') {
    body = (
      <p className="flex items-center gap-2 py-6 text-sm text-gray-700" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {phase.step}
      </p>
    )
    footer = null
  } else if (phase.kind === 'conflict') {
    body = (
      <div className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">A página mudou no site</p>
        <p>
          Alguém editou {link?.title} no WordPress em {wpDate(phase.modifiedGmt)}, depois da última sincronização daqui. Atualizar agora apaga
          essas mudanças. Trazer a versão do site troca as seções desta página no canvas.
        </p>
      </div>
    )
    footer = (
      <>
        <Button type="button" variant="ghost" onClick={() => setPhase({ kind: 'form' })}>
          Voltar
        </Button>
        <Button type="button" variant="outline" onClick={bringSiteVersion}>
          Trazer a versão do site
        </Button>
        <Button type="button" variant="destructive" onClick={() => run(true)}>
          Atualizar mesmo assim
        </Button>
      </>
    )
  } else if (phase.kind === 'done') {
    const { result } = phase
    const statusLabel = (STATUS_LABELS[result.status] ?? result.status).toLowerCase()
    body = (
      <div className="grid gap-3">
        <p className="flex gap-2 text-sm text-gray-900">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          {result.created ? 'Página criada' : 'Página atualizada'} no site, {statusLabel === 'publicada' ? 'publicada' : `como ${statusLabel}`}.
          {result.uploaded > 0 && ` ${plural(result.uploaded, 'imagem foi', 'imagens foram')} para a biblioteca de mídia.`}
        </p>
        {result.failedImages.length > 0 && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {plural(result.failedImages.length, 'imagem não subiu e continua', 'imagens não subiram e continuam')} apontando para o endereço de
            origem.
          </p>
        )}
        {result.featured === 'unsupported' && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />O tema do site não usa imagem destacada em páginas: ela não foi gravada.
          </p>
        )}
        {result.featured === 'failed' && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />A imagem destacada não subiu para a biblioteca de mídia do site.
          </p>
        )}
        {result.seo === 'saved' && result.seoSupport?.plugin && (
          <p className="text-xs text-muted-foreground">SEO gravado no {SEO_PLUGIN_NAMES[result.seoSupport.plugin]}.</p>
        )}
        {result.seo === 'failed' && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />O SEO não gravou: {result.seoError}
          </p>
        )}
        {result.seo === 'skipped' && result.seoSupport?.missing && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {result.seoSupport.missing === 'connector'
              ? 'O SEO ficou de fora: o Yoast só grava em páginas com o plugin Superelements Connector (baixe nos detalhes da página).'
              : 'O SEO ficou de fora: o site não tem Yoast, All in One SEO nem SEOPress.'}
          </p>
        )}
        {!result.cacheCleared && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />O WordPress não deixou limpar o cache de CSS do Elementor com este
            usuário: a página pode aparecer com o estilo antigo até alguém usar Elementor, Ferramentas, Regenerar arquivos.
          </p>
        )}
      </div>
    )
    footer = (
      <>
        <Button type="button" variant="ghost" onClick={close}>
          Fechar
        </Button>
        <Button variant="outline" asChild>
          <a href={result.editUrl} target="_blank" rel="noopener noreferrer">
            Editar no Elementor
            <ExternalLink aria-hidden />
          </a>
        </Button>
        <Button asChild>
          <a href={result.link} target="_blank" rel="noopener noreferrer">
            {result.status === 'publish' ? 'Ver no site' : 'Ver prévia'}
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </>
    )
  } else {
    const draft = link?.status === 'draft'
    body = (
      <div className="grid gap-5">
        {link ? (
          <div className="rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2">
              <a href={link.link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sm font-medium text-gray-900 hover:underline">
                {link.title}
              </a>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                {STATUS_LABELS[link.status] ?? link.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sincronizada em {new Date(link.syncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Situação</Label>
            <Choices name="Situação" value={status} onChange={(value) => setStatus(value)} options={statusOptions} />
          </div>
        )}

        {/* Também na página ligada: a página do Space traz o próprio cabeçalho, e o layout do site pode ser o do tema */}
        <div className="grid gap-2">
          <Label>Layout</Label>
          <Choices name="Layout" value={template} onChange={(value) => setTemplate(value)} options={TEMPLATE_OPTIONS} />
        </div>

        <DetailsSummary pageId={page.id} />

        {summary && (
          <p className="text-xs text-muted-foreground">
            {link ? `${plural(summary.sectionCount, 'seção vai', 'seções vão')} substituir o conteúdo da página no site.` : plural(summary.sectionCount, 'seção', 'seções')}
            {summary.images > 0 && ` ${plural(summary.images, 'imagem nova vai', 'imagens novas vão')} para a biblioteca de mídia do site.`}
          </p>
        )}
        {summary?.html && connection.can.unfilteredHtml === false && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />A página tem widgets HTML, e este usuário do WordPress não pode gravar
            HTML sem filtro: os scripts deles saem ao publicar. Conecte com um administrador para manter.
          </p>
        )}
        {blocked && <p className="text-sm text-destructive">Este usuário do WordPress não pode editar páginas.</p>}

        {link && draft && canPublish && (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-gray-900" checked={publishDraft} onChange={(e) => setPublishDraft(e.target.checked)} />
            Publicar a página (hoje ela é rascunho)
          </label>
        )}

        {link && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {backups.count > 0 && backups.last && (
              <button type="button" onClick={undo} className="rounded underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Desfazer a última atualização
              </button>
            )}
            <button type="button" onClick={unlink} className="rounded underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Desligar do WordPress
            </button>
          </p>
        )}

        {phase.kind === 'error' && (
          <p className="flex gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {phase.message}
          </p>
        )}
      </div>
    )
    footer = (
      <>
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => run()} disabled={blocked || !summary?.sectionCount}>
          {link ? 'Atualizar no site' : status === 'publish' ? 'Publicar página' : 'Criar rascunho'}
        </Button>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>
          {phase.kind === 'done'
            ? `${page.name} em ${connection?.site.name ?? 'o site'}.`
            : link
              ? `A página ${page.name} do canvas vai para ${connection?.site.name ?? 'o site'}, no mesmo endereço.`
              : `A página ${page.name} vira uma página nova em ${connection?.site.name ?? 'o site'}, feita no Elementor.`}
        </DialogDescription>
      </DialogHeader>
      {body}
      {footer && <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter>}
    </>
  )
}
