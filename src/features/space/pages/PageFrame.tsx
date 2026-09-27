import React, { useRef, useState } from 'react'
import { ClipboardPaste, CloudUpload, Copy, FileText, Globe, MoreHorizontal, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress } from '@/features/wordpress/useWordPressConnection'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceNode, SpacePage } from '@/types/space'
import { Hint } from '../ToolbarIsland'
import { MOD_KEY } from './clipboard'
import { EMPTY_PAGE_BODY, PAGE_HEADER, PAGE_PAD, PAGE_WIDTH, SECTION_GAP, SECTION_WIDTH, nextPagePosition, pageFrame, pageSections, plural } from './pages'

/** Distância em px abaixo da qual soltar o mouse conta como clique, não como arrasto. */
const CLICK_SLOP = 4
/** Raio do quadro: o dos cards de seção (12) somado ao respiro da página. */
const FRAME_RADIUS = 12 + PAGE_PAD

const stop = (e: React.MouseEvent) => e.stopPropagation()

const NameInput: React.FC<{ page: SpacePage }> = ({ page }) => {
  const renamePage = useSpaceStore((s) => s.renamePage)
  const setRenamingPage = useSpaceStore((s) => s.setRenamingPage)
  const [value, setValue] = useState(page.name)
  const done = useRef(false)

  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    if (commit) renamePage(page.id, value)
    setRenamingPage(null)
  }

  return (
    <input
      autoFocus
      value={value}
      aria-label="Nome da página"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onMouseDown={stop}
      className="h-7 min-w-0 flex-1 rounded-md border border-violet-300 bg-white px-2 text-[13px] font-semibold text-gray-900 outline-none ring-2 ring-violet-500/20"
    />
  )
}

interface PageFrameProps {
  page: SpacePage
  nodes: SpaceNode[]
  onlyPage: boolean
}

/**
 * Quadro de uma página no canvas. O cabeçalho move a página inteira (as seções
 * vão junto, sempre na coluna); o miolo deixa arrastar o canvas por baixo.
 */
const PageFrame: React.FC<PageFrameProps> = ({ page, nodes, onlyPage }) => {
  const active = useSpaceStore((s) => s.activePageId === page.id)
  const renaming = useSpaceStore((s) => s.renamingPageId === page.id)
  const drop = useSpaceStore((s) => (s.dropTarget?.pageId === page.id ? s.dropTarget : null))
  const clipboardCount = useSpaceStore((s) => s.clipboard?.sections.length ?? 0)
  const { movePage, setActivePage, setRenamingPage, openPlayer, duplicatePage, removePage, pasteSections } = useSpaceStore.getState()
  const [dragging, setDragging] = useState(false)
  const wordpress = useActiveWordPress()
  const siteLink = page.wordpress
  // O menu devolve o foco ao botão ao fechar; em Renomear o foco tem de ficar no campo
  const keepFocus = useRef(false)
  const bodyDown = useRef({ x: 0, y: 0 })

  const frame = pageFrame(page, nodes)
  const sections = pageSections(page, nodes)
  const count = sections.length

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const { zoom } = useSpaceStore.getState().canvasTransform
    const start = { x: e.clientX, y: e.clientY, pageX: page.x, pageY: page.y }
    let moved = false

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      if (!moved && Math.hypot(dx, dy) < CLICK_SLOP) return
      if (!moved) setDragging(true)
      moved = true
      movePage(page.id, start.pageX + dx / zoom, start.pageY + dy / zoom)
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setDragging(false)
      if (!moved) setActivePage(page.id)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleRemove = () => {
    const withSections = count === 0 ? '' : count === 1 ? ' e a seção dela' : ` e as ${count} seções dela`
    if (confirm(`Excluir a página "${page.name}"${withSections}?`)) removePage(page.id)
  }

  const paste = () => {
    const result = pasteSections({ pageId: page.id })
    if (result) toast.success(`${plural(result.count, 'seção colada', 'seções coladas')} em ${page.name}`)
  }

  // Linha onde a seção arrastada vai entrar; a posição não conta a própria seção, que saiu da coluna
  let dropLineY: number | null = null
  const others = drop ? sections.filter((s) => s.id !== drop.sectionId) : sections
  if (drop && others.length) {
    const at = others[drop.index]
    const last = others[others.length - 1]
    dropLineY = (at ? at.y - SECTION_GAP / 2 : last.y + last.height + SECTION_GAP / 2) - page.y
  }
  const emptyDrop = !!drop && !others.length

  return (
    <div
      className={cn(
        'canvas-background absolute border transition-[border-color,background-color,box-shadow] duration-150',
        active ? 'border-violet-300 bg-white/75' : 'border-gray-200 bg-white/45',
        drop && 'ring-2 ring-violet-400/70',
        dragging && 'shadow-[0_12px_32px_-12px_rgb(0_0_0/0.18)]'
      )}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height, borderRadius: FRAME_RADIUS }}
      data-page-id={page.id}
    >
      <header
        className={cn('flex items-center gap-2 pl-4 pr-2', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ height: PAGE_HEADER }}
        onMouseDown={renaming ? undefined : handleHeaderMouseDown}
        onDoubleClick={() => setRenamingPage(page.id)}
      >
        <FileText className={cn('h-3.5 w-3.5 shrink-0 transition-colors', active ? 'text-violet-600' : 'text-gray-400')} aria-hidden />
        {renaming ? (
          <NameInput page={page} />
        ) : (
          <>
            <h2 className="min-w-0 truncate text-[13px] font-semibold text-gray-900" title="Clique duas vezes para renomear">
              {page.name}
            </h2>
            <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{count ? plural(count, 'seção', 'seções') : 'vazia'}</span>
            {siteLink && (
              <Hint label={`No WordPress: ${siteLink.title}`} hint={`${STATUS_LABELS[siteLink.status] ?? siteLink.status} · publicar atualiza essa página`}>
                <a
                  href={siteLink.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseDown={stop}
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-sky-50 px-1.5 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Globe className="h-3 w-3" aria-hidden />
                  No site
                </a>
              </Hint>
            )}
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1" onMouseDown={stop} onDoubleClick={stop}>
          <Hint label="Player da página" hint="Só esta página, na tela do device, para rolar como no site">
            <button
              type="button"
              disabled={!count}
              onClick={() => openPlayer(page.id)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-xs font-medium text-white transition-[background-color,transform] hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
            >
              <Play className="h-3 w-3 fill-current" aria-hidden />
              Player
            </button>
          </Hint>
          {/* Não modal: o menu modal bloqueia os cliques da tela e, se abre um diálogo, o bloqueio fica preso */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Opções da página ${page.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-[color,background-color,transform] hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-48 rounded-xl p-1"
              onCloseAutoFocus={(e) => {
                if (keepFocus.current) e.preventDefault()
                keepFocus.current = false
              }}
            >
              {clipboardCount > 0 && (
                <>
                  <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={paste}>
                    <ClipboardPaste className="h-3.5 w-3.5" /> Colar {plural(clipboardCount, 'seção', 'seções')}
                    <DropdownMenuShortcut>{MOD_KEY}V</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs"
                onSelect={() => {
                  keepFocus.current = true
                  setRenamingPage(page.id)
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => duplicatePage(page.id)}>
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => useWordPressUi.getState().openDetails(page.id)}>
                <Search className="h-3.5 w-3.5" /> Detalhes e SEO…
              </DropdownMenuItem>
              {wordpress && (
                <DropdownMenuItem className="gap-2 rounded-lg text-xs" disabled={!count} onSelect={() => useWordPressUi.getState().openPublish(page.id)}>
                  <CloudUpload className="h-3.5 w-3.5" /> {siteLink?.siteUrl === wordpress.site.siteUrl ? 'Atualizar no site…' : 'Publicar no site…'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs text-red-600 focus:bg-red-50 focus:text-red-700"
                disabled={onlyPage}
                onSelect={handleRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {onlyPage ? 'Única página do canvas' : 'Excluir página'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div
        className="canvas-background absolute inset-x-0 bottom-0"
        style={{ top: PAGE_HEADER }}
        onMouseDown={(e) => (bodyDown.current = { x: e.clientX, y: e.clientY })}
        onClick={(e) => {
          if (Math.hypot(e.clientX - bodyDown.current.x, e.clientY - bodyDown.current.y) < CLICK_SLOP) setActivePage(page.id)
        }}
      >
        {!count && (
          <div
            className={cn(
              'pointer-events-none absolute flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-8 text-center transition-colors duration-150',
              emptyDrop ? 'border-violet-400 bg-violet-50/80' : 'border-gray-300'
            )}
            style={{ inset: `${PAGE_PAD}px ${PAGE_PAD}px`, height: EMPTY_PAGE_BODY }}
          >
            <p className="text-xs font-medium text-gray-700">{emptyDrop ? 'Solte para pôr na página' : 'Página vazia'}</p>
            {!emptyDrop && (
              <p className="text-[11px] leading-relaxed text-gray-500">
                Arraste seções da Biblioteca ou de outra página até aqui{clipboardCount ? `, ou cole com ${MOD_KEY}V` : ''}. Os Modelos também preenchem a página.
              </p>
            )}
          </div>
        )}
      </div>

      {dropLineY !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute h-[3px] rounded-full bg-violet-500"
          style={{ top: dropLineY - 1.5, left: PAGE_PAD, right: PAGE_PAD }}
        />
      )}
    </div>
  )
}

/** Atalho no canvas, onde a próxima página vai entrar. */
const NewPageTile: React.FC<{ pages: SpacePage[]; nodes: SpaceNode[] }> = ({ pages, nodes }) => {
  const addPage = useSpaceStore((s) => s.addPage)
  const { x, y } = nextPagePosition(pages, nodes)
  return (
    <button
      type="button"
      onMouseDown={stop}
      onClick={() => addPage()}
      className="absolute flex items-center justify-center gap-2 border border-dashed border-gray-400/70 text-sm font-medium text-gray-600 transition-[color,border-color,background-color,transform] duration-150 hover:border-gray-400 hover:bg-white/60 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
      style={{ left: x, top: y, width: PAGE_WIDTH, height: PAGE_HEADER + 72, borderRadius: FRAME_RADIUS }}
    >
      <Plus className="h-4 w-4" aria-hidden />
      Nova página
    </button>
  )
}

/** Onde o card da biblioteca vai cair como seção solta, se for solto fora das páginas. */
const LibraryGhost: React.FC = () => {
  const ghost = useSpaceStore((s) => s.libraryGhost)
  if (!ghost) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 flex flex-col justify-between rounded-xl border-2 border-dashed border-violet-400 bg-violet-50/70 p-3"
      style={{ left: ghost.x, top: ghost.y, width: SECTION_WIDTH, height: 160 }}
    >
      <span className="truncate text-xs font-semibold text-violet-900">{ghost.title}</span>
      <span className="text-[11px] text-violet-700">Solta no canvas · arraste até uma página para pôr nela</span>
    </div>
  )
}

/** Quadros das páginas, por baixo dos nós do canvas. */
export const PagesLayer: React.FC = () => {
  const pages = useSpaceStore((s) => s.pages)
  const nodes = useSpaceStore((s) => s.nodes)
  return (
    <>
      {pages.map((page) => (
        <PageFrame key={page.id} page={page} nodes={nodes} onlyPage={pages.length === 1} />
      ))}
      <NewPageTile pages={pages} nodes={nodes} />
      <LibraryGhost />
    </>
  )
}
