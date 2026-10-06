import React, { useRef, useState } from 'react'
import { ClipboardPaste, CloudUpload, Component, Copy, Globe, GripVertical, LayoutTemplate, MoreHorizontal, Pencil, Play, Plus, Search, Trash2, Unlink2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress } from '@/features/wordpress/useWordPressConnection'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceNode, SpacePage } from '@/types/space'
import { ApprovalChip } from '@/features/approval/ApprovalChip'
import { VIEWPORT_WIDTH } from '@/features/elementor-preview/PreviewFrame'
import { useClaudeBridge } from '@/features/space/bridge/bridgeStore'
import { PresenceStack } from '@/features/space/presence/PresenceStack'
import { usePagePresence } from '@/features/space/presence/presence'
import { Hint } from '../ToolbarIsland'
import { MOD_KEY } from './clipboard'
import { EMPTY_PAGE_BODY, PAGE_GAP, PAGE_HEADER, PAGE_WIDTH, SECTION_WIDTH, instanceOf, nextPagePosition, pageFrame, pageParts, pageSections, partShownIn, plural, sheetLayout, sitePages } from './pages'
import { PART_COLOR, PART_COLOR_STRONG, PART_LABEL, PART_NOUN } from './parts'
import { PartInstance } from './PartInstance'
import { useSpaceUi } from '../spaceUi'

/** Distância em px abaixo da qual soltar o mouse conta como clique, não como arrasto. */
const CLICK_SLOP = 4
/** Altura da barra da página na tela, em qualquer zoom. */
const BAR_HEIGHT = 34
/** Entre a barra e a folha, na tela. */
const BAR_GAP = 8
/** Na vista afastada a barra vira só o nome, mais baixo. */
const COMPACT_BAR_HEIGHT = 22
/** Abaixo desta largura na tela, a página mostra só o nome em cima. */
const NARROW_BAR = 190

export const DEVICE_LABELS = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Celular' } as const

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
      className="h-6 min-w-0 flex-1 rounded-md border border-violet-300 bg-white px-1.5 text-[13px] font-semibold text-gray-900 outline-none ring-2 ring-violet-500/20"
    />
  )
}

/** Cabeçalho e rodapé do site no menu da página: ligar ou tirar cada um só nela. */
const PartToggles: React.FC<{ page: SpacePage }> = ({ page }) => {
  const pages = useSpaceStore((s) => s.pages)
  const parts = pages.filter((p) => p.part)
  if (!parts.length) return null
  const { header, footer } = pageParts(page, pages)
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Componentes</DropdownMenuLabel>
      {parts.map((part) => (
        <DropdownMenuCheckboxItem
          key={part.id}
          className="gap-2 rounded-lg text-xs"
          checked={header?.id === part.id || footer?.id === part.id}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(shown) => useSpaceStore.getState().setPartShown(part.id, page.id, shown)}
        >
          <Component className="h-3.5 w-3.5" style={{ color: PART_COLOR }} />
          <span className="truncate">{part.name}</span>
        </DropdownMenuCheckboxItem>
      ))}
    </>
  )
}

/** Menu "…" da folha de um componente: renomear, onde aparece, voltar a ser seção comum e excluir. */
const PartMenu: React.FC<{ page: SpacePage }> = ({ page }) => {
  const pages = useSpaceStore((s) => s.pages)
  const nodes = useSpaceStore((s) => s.nodes)
  const activePageId = useSpaceStore((s) => s.activePageId)
  const { setRenamingPage, removePage, unlinkPagePart, setPartShown, insertInstance } = useSpaceStore.getState()
  const wordpress = useActiveWordPress()
  const keepFocus = useRef(false)
  const kind = page.part!.kind
  // Componente livre: aparece onde tem instância; cabeçalho e rodapé: em todas as páginas, menos as tiradas
  const free = kind === 'section'
  const noun = free ? 'componente' : PART_NOUN[kind]
  const site = sitePages(pages)
  const shownIn = partShownIn(page, pages, nodes)
  const instances = free ? nodes.filter((n) => instanceOf(n) === page.id).length : 0
  // Onde a instância entra: na página ativa (se não é este componente), senão na primeira do site
  const target = pages.find((p) => p.id === activePageId && p.id !== page.id) ?? site[0]

  const unlink = () => {
    const count = unlinkPagePart(page.id)
    if (count) toast.success(`O ${noun} voltou a ser seção comum`, { description: `Cada uma das ${plural(count, 'página', 'páginas')} ficou com a própria cópia. ${MOD_KEY}Z desfaz.` })
  }
  const handleRemove = () => {
    const where = free
      ? instances
        ? ` As ${plural(instances, 'instância', 'instâncias')} saem das páginas.`
        : ''
      : shownIn.length
        ? ` Ele sai de ${plural(shownIn.length, 'página', 'páginas')}.`
        : ''
    if (confirm(free ? `Excluir o componente "${page.name}"?${where}` : `Excluir o ${noun} do site?${where}`)) removePage(page.id)
  }
  const insert = (pageId: string, name: string) => {
    if (insertInstance(page.id, pageId)) toast.success(`Instância de ${page.name} no fim de ${name}`, { description: 'Arraste para o lugar certo na página.' })
    else toast.error('Um componente não entra nele mesmo.')
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Opções do ${noun}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-[color,background-color,transform] hover:bg-black/5 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-60 rounded-xl p-1"
        onCloseAutoFocus={(e) => {
          if (keepFocus.current) e.preventDefault()
          keepFocus.current = false
        }}
      >
        <DropdownMenuItem
          className="gap-2 rounded-lg text-xs"
          onSelect={() => {
            keepFocus.current = true
            setRenamingPage(page.id)
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Renomear
        </DropdownMenuItem>
        {wordpress && (
          <DropdownMenuItem className="gap-2 rounded-lg text-xs" disabled={!page.sectionIds.length} onSelect={() => useWordPressUi.getState().openPublish(page.id)}>
            <CloudUpload className="h-3.5 w-3.5" /> {page.wordpress?.siteUrl === wordpress.site.siteUrl ? `Atualizar o ${noun} no site…` : `Publicar o ${noun} no site…`}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {free ? (
          <>
            {target && (
              <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => insert(target.id, target.name)}>
                <Plus className="h-3.5 w-3.5" /> Pôr em {target.name}
              </DropdownMenuItem>
            )}
            <DropdownMenuLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {shownIn.length ? `Usado em ${plural(instances, 'lugar', 'lugares')}` : 'Ainda não está em nenhuma página'}
            </DropdownMenuLabel>
            {shownIn.map((p) => (
              <DropdownMenuItem key={p.id} className="rounded-lg text-xs" onSelect={() => useSpaceStore.getState().focusPage(p.id)}>
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <>
            <DropdownMenuLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Aparece em</DropdownMenuLabel>
            {site.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.id}
                className="rounded-lg text-xs"
                checked={shownIn.some((s) => s.id === p.id)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(shown) => setPartShown(page.id, p.id, shown)}
              >
                <span className="truncate">{p.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 rounded-lg text-xs"
          disabled={!shownIn.length}
          onSelect={unlink}
          title={free ? 'Cada instância vira uma cópia comum, que passa a mudar sozinha' : `Cada página fica com a própria cópia do ${noun}, que passa a mudar sozinha`}
        >
          <Unlink2 className="h-3.5 w-3.5" /> Voltar a ser seção comum
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-lg text-xs text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={handleRemove}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir {free ? 'componente' : noun}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Menu "…" da página: colar, renomear, duplicar, SEO, publicar, componentes e excluir. */
const PageMenu: React.FC<{ page: SpacePage; count: number; onlyPage: boolean }> = ({ page, count, onlyPage }) => {
  const clipboardCount = useSpaceStore((s) => s.clipboard?.sections.length ?? 0)
  const { setRenamingPage, duplicatePage, removePage, pasteSections } = useSpaceStore.getState()
  const wordpress = useActiveWordPress()
  // O menu devolve o foco ao botão ao fechar; em Renomear o foco tem de ficar no campo
  const keepFocus = useRef(false)

  const handleRemove = () => {
    const withSections = count === 0 ? '' : count === 1 ? ' e a seção dela' : ` e as ${count} seções dela`
    if (confirm(`Excluir a página "${page.name}"${withSections}?`)) removePage(page.id)
  }
  const paste = () => {
    const result = pasteSections({ pageId: page.id })
    if (result) toast.success(`${plural(result.count, 'seção colada', 'seções coladas')} em ${page.name}`)
  }

  return (
    // Não modal: o menu modal bloqueia os cliques da tela e, se abre um diálogo, o bloqueio fica preso
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Opções da página ${page.name}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-[color,background-color,transform] hover:bg-black/5 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
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
            <CloudUpload className="h-3.5 w-3.5" /> {page.wordpress?.siteUrl === wordpress.site.siteUrl ? 'Atualizar no site…' : 'Publicar no site…'}
          </DropdownMenuItem>
        )}
        <PartToggles page={page} />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 rounded-lg text-xs text-red-600 focus:bg-red-50 focus:text-red-700" disabled={onlyPage} onSelect={handleRemove}>
          <Trash2 className="h-3.5 w-3.5" />
          {onlyPage ? 'Única página do canvas' : 'Excluir página'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface PageBarProps {
  page: SpacePage
  count: number
  /** Altura real da página na tela do device, em px. */
  realHeight: number
  onlyPage: boolean
  active: boolean
  dragging: boolean
  onGrab: (e: React.MouseEvent) => void
}

/**
 * Barra acima da folha, como a do Framer: nome, tela e tamanho, quem está na
 * página, o player e o menu. Fica do mesmo tamanho na tela em qualquer zoom;
 * quando a página fica estreita, mostra só o que cabe.
 */
const PageBar: React.FC<PageBarProps> = ({ page, count, realHeight, onlyPage, active, dragging, onGrab }) => {
  const zoom = useSpaceStore((s) => s.canvasTransform.zoom)
  const device = useSpaceStore((s) => s.previewDevice)
  const renaming = useSpaceStore((s) => s.renamingPageId === page.id)
  const { setRenamingPage, openPlayer } = useSpaceStore.getState()
  const presence = usePagePresence(page.id)
  // Agente construindo a página pelo plano (ponte do dev)
  const building = useClaudeBridge((s) => s.working[page.id])
  const siteLink = page.wordpress
  // Folha de componente (cabeçalho, rodapé do site): ciano, com o losango e onde aparece
  const part = page.part
  const usage = useSpaceStore((s) => (part ? partShownIn(page, s.pages, s.nodes).length : 0))
  const menu = part ? <PartMenu page={page} /> : <PageMenu page={page} count={count} onlyPage={onlyPage} />

  const width = PAGE_WIDTH * zoom
  const roomy = width >= 430
  const medium = width >= 300
  const narrow = width < NARROW_BAR
  const tiny = width < 120

  // Página estreita na tela (vista afastada): só o nome, como o Framer, avançando sobre o vão até a próxima
  if (narrow && !renaming) {
    return (
      <div
        className={cn('group flex items-center gap-1 text-[12px]', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ height: COMPACT_BAR_HEIGHT }}
        onMouseDown={onGrab}
        onDoubleClick={() => setRenamingPage(page.id)}
        title={`${page.name} · clique duas vezes para renomear`}
      >
        {part && <Component className="h-3 w-3 shrink-0" style={{ color: PART_COLOR }} aria-label="Componente" />}
        <h2 className={cn('min-w-0 truncate font-medium', part ? 'text-cyan-800' : active ? 'text-violet-700' : 'text-gray-600')}>{page.name}</h2>
        {!tiny && <PresenceStack presence={presence} max={1} size={16} ring="#f4f4f5" />}
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" onMouseDown={stop} onDoubleClick={stop}>
          {menu}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg pl-1 pr-1 text-[12px] transition-[background-color,box-shadow,color] duration-150',
        part
          ? active
            ? 'bg-cyan-50 text-cyan-950 shadow-[0_0_0_1px_rgb(8_145_178/0.6)]'
            : 'bg-cyan-50/70 text-cyan-950 shadow-[0_0_0_1px_rgb(8_145_178/0.3)] hover:shadow-[0_0_0_1px_rgb(8_145_178/0.5)]'
          : active
            ? 'bg-violet-50 text-violet-900 shadow-[0_0_0_1px_rgb(139_92_246/0.45)]'
            : 'bg-white text-gray-700 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.16)]',
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{ height: BAR_HEIGHT }}
      onMouseDown={renaming ? undefined : onGrab}
      onDoubleClick={() => setRenamingPage(page.id)}
    >
      {part ? (
        <Component className="ml-1 h-3.5 w-3.5 shrink-0" style={{ color: PART_COLOR }} aria-hidden />
      ) : (
        !narrow && <GripVertical className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-violet-400' : 'text-gray-300')} aria-hidden />
      )}
      {renaming ? (
        <NameInput page={page} />
      ) : (
        <h2 className={cn('min-w-0 truncate font-semibold', part ? 'text-cyan-950' : active ? 'text-violet-950' : 'text-gray-900')} title="Clique duas vezes para renomear">
          {page.name}
        </h2>
      )}
      {!renaming && part && (
        <span
          className="inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[11px] font-medium text-white"
          style={{ background: PART_COLOR }}
          title={`Uma cópia só: o que mudar aqui muda em todas as páginas que mostram o ${PART_NOUN[part.kind]}`}
        >
          {roomy ? `Componente · em ${plural(usage, 'página', 'páginas')}` : 'Componente'}
        </span>
      )}
      {!renaming && medium && !part && (
        <span className={cn('shrink-0 truncate tabular-nums', active ? 'text-violet-600' : 'text-gray-400')}>
          {DEVICE_LABELS[device]} {VIEWPORT_WIDTH[device]}
          {roomy && count > 0 && <> × {realHeight.toLocaleString('pt-BR')}</>}
        </span>
      )}
      {!renaming && roomy && building && (
        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-[#D97757]/10 px-1.5 text-[11px] font-medium text-[#A94E2F]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D97757] motion-safe:animate-pulse" />
          {building.agent} construindo
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1" onMouseDown={stop} onDoubleClick={stop}>
        {roomy && !part && <ApprovalChip pageId={page.id} />}
        {roomy && siteLink && !part && (
          <Hint label={`No WordPress: ${siteLink.title}`} hint={`${STATUS_LABELS[siteLink.status] ?? siteLink.status} · publicar atualiza essa página`}>
            <a
              href={siteLink.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver no site"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sky-600 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Hint>
        )}
        {/* Quem está na página aparece até a barra ficar pequena demais */}
        {!tiny && <PresenceStack presence={presence} max={medium ? 3 : narrow ? 1 : 2} size={20} ring={active ? '#f5f3ff' : '#ffffff'} className="mr-0.5" />}
        {!narrow && (
          <Hint label="Player da página" hint="Só esta página, na tela do device, rolando como no site">
            <button
              type="button"
              disabled={!count}
              onClick={() => openPlayer(page.id)}
              aria-label={`Player da página ${page.name}`}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30',
                part ? 'text-cyan-800 hover:bg-cyan-100' : active ? 'text-violet-700 hover:bg-violet-100' : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
              )}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </button>
          </Hint>
        )}
        {menu}
      </div>
    </div>
  )
}

interface PageFrameProps {
  page: SpacePage
  pages: SpacePage[]
  nodes: SpaceNode[]
  onlyPage: boolean
}

/**
 * Uma página no canvas: a barra em cima move a página inteira (as seções vão
 * junto, sempre na coluna); a folha embaixo é a página como no site, com as
 * seções coladas umas nas outras.
 */
const PageFrame: React.FC<PageFrameProps> = ({ page, pages, nodes, onlyPage }) => {
  const active = useSpaceStore((s) => s.activePageId === page.id)
  const zoom = useSpaceStore((s) => s.canvasTransform.zoom)
  const device = useSpaceStore((s) => s.previewDevice)
  const drop = useSpaceStore((s) => (s.dropTarget?.pageId === page.id ? s.dropTarget : null))
  const clipboardCount = useSpaceStore((s) => s.clipboard?.sections.length ?? 0)
  const { movePage, setActivePage } = useSpaceStore.getState()
  const [dragging, setDragging] = useState(false)
  const bodyDown = useRef({ x: 0, y: 0 })

  const frame = pageFrame(page, nodes, pages)
  const layout = sheetLayout(page, nodes, pages)
  const sections = pageSections(page, nodes)
  const count = sections.length
  const part = page.part
  const sheetHeight = frame.height - PAGE_HEADER
  // A folha tem a largura da página no canvas; a tela do device cabe nela inteira
  const realHeight = Math.round((sheetHeight * VIEWPORT_WIDTH[device]) / SECTION_WIDTH)

  const handleBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
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

  // Linha onde a seção arrastada vai entrar; a posição não conta a própria seção, que saiu da coluna
  let dropLineY: number | null = null
  const others = drop ? sections.filter((s) => s.id !== drop.sectionId) : sections
  if (drop && others.length) {
    const at = others[drop.index]
    const last = others[others.length - 1]
    dropLineY = (at ? at.y : last.y + last.height) - page.y
  }
  const emptyDrop = !!drop && !others.length

  return (
    <div className="pointer-events-none absolute" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }} data-page-id={page.id}>
      {/* A barra fica do mesmo tamanho na tela: a largura acompanha a da página e a escala desfaz o zoom */}
      <div
        className="pointer-events-auto absolute left-0 origin-bottom-left"
        style={{
          bottom: sheetHeight,
          width: PAGE_WIDTH * zoom < NARROW_BAR ? (PAGE_WIDTH + PAGE_GAP * 0.85) * zoom : PAGE_WIDTH * zoom,
          paddingBottom: PAGE_WIDTH * zoom < NARROW_BAR ? 4 : BAR_GAP,
          transform: `scale(${1 / zoom})`,
        }}
      >
        <PageBar page={page} count={count} realHeight={realHeight} onlyPage={onlyPage} active={active} dragging={dragging} onGrab={handleBarMouseDown} />
      </div>

      <div
        className={cn('canvas-background pointer-events-auto absolute inset-x-0 bottom-0 bg-white transition-shadow duration-150', dragging && 'shadow-[0_12px_32px_-12px_rgb(0_0_0/0.18)]')}
        style={{
          top: PAGE_HEADER,
          boxShadow: drop
            ? '0 0 0 calc(2px / var(--z, 1)) rgb(139 92 246 / 0.8)'
            : part
              ? `0 0 0 calc(${active ? 2 : 1.5}px / var(--z, 1)) ${active ? PART_COLOR_STRONG : PART_COLOR}, 0 2px 12px -4px rgb(0 0 0 / 0.08)`
              : active
                ? '0 0 0 calc(1px / var(--z, 1)) rgb(139 92 246 / 0.5), 0 2px 12px -4px rgb(0 0 0 / 0.08)'
                : '0 0 0 calc(1px / var(--z, 1)) rgb(0 0 0 / 0.08), 0 2px 12px -4px rgb(0 0 0 / 0.08)',
        }}
        onMouseDown={(e) => (bodyDown.current = { x: e.clientX, y: e.clientY })}
        onClick={(e) => {
          if (Math.hypot(e.clientX - bodyDown.current.x, e.clientY - bodyDown.current.y) < CLICK_SLOP) setActivePage(page.id)
        }}
      >
        {!count && part && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-1 px-8 text-center transition-colors duration-150',
              emptyDrop ? 'bg-cyan-50/80' : 'bg-white'
            )}
            style={{ height: EMPTY_PAGE_BODY }}
          >
            <p className="text-xs font-medium text-gray-700">{emptyDrop ? `Solte para pôr no ${PART_NOUN[part.kind]}` : `${part.kind === 'section' ? page.name : PART_LABEL[part.kind]} vazio`}</p>
            {!emptyDrop && (
              <p className="text-[11px] leading-relaxed text-gray-500">
                {part.kind === 'section' ? 'Arraste uma seção até aqui: ela aparece em todas as instâncias.' : 'Arraste uma seção até aqui: ela aparece em todas as páginas do site.'}
              </p>
            )}
          </div>
        )}
        {!count && !part && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center gap-1 px-8 text-center transition-colors duration-150',
              emptyDrop ? 'bg-violet-50/80' : 'bg-white'
            )}
            // Abaixo do cabeçalho do site, se a página mostra um
            style={{ top: layout.bodyTop - page.y - PAGE_HEADER, height: EMPTY_PAGE_BODY }}
          >
            <p className="text-xs font-medium text-gray-700">{emptyDrop ? 'Solte para pôr na página' : 'Página vazia'}</p>
            {!emptyDrop && (
              <>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Comece por um modelo pronto ou arraste seções da Biblioteca até aqui{clipboardCount ? `, ou cole com ${MOD_KEY}V` : ''}.
                </p>
                <div className="pointer-events-auto mt-2 flex items-center gap-1.5" onMouseDown={stop}>
                  <button
                    type="button"
                    onClick={() => {
                      // O modelo entra na página ativa quando ela está vazia: esta
                      setActivePage(page.id)
                      useSpaceUi.getState().openLibrary('templates')
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-[11px] font-medium text-white transition-[background-color,transform] hover:bg-gray-700 active:scale-[0.96]"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" /> Usar um modelo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage(page.id)
                      useSpaceUi.getState().openLibrary('sections')
                    }}
                    className="inline-flex h-7 items-center rounded-lg px-2.5 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.96]"
                  >
                    Ver seções
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cabeçalho e rodapé do site: o mesmo componente em todas as páginas, não uma cópia */}
      {layout.header && (
        <PartInstance page={page} part={layout.header.page} sections={pageSections(layout.header.page, nodes)} top={layout.header.y - page.y} height={layout.header.height} />
      )}
      {layout.footer && (
        <PartInstance page={page} part={layout.footer.page} sections={pageSections(layout.footer.page, nodes)} top={layout.footer.y - page.y} height={layout.footer.height} />
      )}

      {dropLineY !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 rounded-full bg-violet-500"
          style={{ top: dropLineY, height: 'calc(3px / var(--z, 1))', transform: 'translateY(-50%)' }}
        />
      )}
    </div>
  )
}

/** Atalho no canvas, onde a próxima página vai entrar. */
const NewPageTile: React.FC<{ pages: SpacePage[]; nodes: SpaceNode[] }> = ({ pages, nodes }) => {
  const addPage = useSpaceStore((s) => s.addPage)
  const zoom = useSpaceStore((s) => s.canvasTransform.zoom)
  const { x, y } = nextPagePosition(pages, nodes)
  // Do tamanho da barra das páginas em qualquer zoom; afastado, vira só o "+"
  const full = PAGE_WIDTH * zoom >= NARROW_BAR
  return (
    <div className="absolute origin-bottom-left" style={{ left: x, bottom: `calc(100% - ${y + PAGE_HEADER}px)`, top: 'auto', transform: `scale(${1 / zoom})`, paddingBottom: full ? BAR_GAP : 4 }}>
      <Hint label="Nova página" hint="Em branco; pelo + da aba Páginas também dá para começar de um modelo">
        <button
          type="button"
          onMouseDown={stop}
          onClick={() => addPage()}
          aria-label="Nova página"
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg bg-white/60 text-[12px] font-medium text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition-[color,background-color,box-shadow,transform] duration-150 hover:bg-white hover:text-gray-900 hover:shadow-[0_0_0_1px_rgb(0_0_0/0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
            full ? 'px-3' : 'w-[22px]'
          )}
          style={{ height: full ? BAR_HEIGHT : COMPACT_BAR_HEIGHT }}
        >
          <Plus className={full ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
          {full && 'Nova página'}
        </button>
      </Hint>
    </div>
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
  const onlyPage = sitePages(pages).length === 1
  return (
    <>
      {pages.map((page) => (
        <PageFrame key={page.id} page={page} pages={pages} nodes={nodes} onlyPage={onlyPage} />
      ))}
      <NewPageTile pages={pages} nodes={nodes} />
      <LibraryGhost />
    </>
  )
}
