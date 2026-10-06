import React, { useRef, useState } from 'react'
import { Component, FileText, Globe, Home, LayoutTemplate, Plus } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpacePage } from '@/types/space'
import { PresenceStack } from '@/features/space/presence/PresenceStack'
import { usePagePresence } from '@/features/space/presence/presence'
import { pageSlug, partShownIn, plural, sitePages } from './pages'
import { PART_COLOR } from './parts'
import { useSpaceUi } from '../spaceUi'

/** Instância do componente no fim da página aberta (ou da primeira do site, se a aberta é o próprio componente). */
function insertHere(component: SpacePage) {
  const { pages, activePageId, insertInstance } = useSpaceStore.getState()
  const target = pages.find((p) => p.id === activePageId && p.id !== component.id && p.part?.kind !== 'header' && p.part?.kind !== 'footer') ?? pages.find((p) => !p.part)
  if (!target) return
  if (insertInstance(component.id, target.id)) toast.success(`${component.name} no fim de ${target.name}`, { description: 'Arraste para o lugar certo na página.' })
  else toast.error('Um componente não entra nele mesmo.')
}

/** Endereço da página no site: o slug dos detalhes, ou o que o WordPress criaria pelo nome. */
const pathOf = (page: SpacePage, index: number) => (index === 0 ? '/' : `/${page.details?.slug || pageSlug(page.name)}`)

const PageRow: React.FC<{ page: SpacePage; index: number; active: boolean }> = ({ page, index, active }) => {
  // Componente do site (cabeçalho, rodapé): no lugar do endereço, em quantas páginas aparece
  const usage = useSpaceStore((s) => (page.part ? partShownIn(page, s.pages, s.nodes).length : 0))
  // Renomear aqui é só desta linha: a barra da página no canvas tem o próprio campo
  const [renaming, setRenaming] = useState(false)
  const { focusPage, renamePage } = useSpaceStore.getState()
  const presence = usePagePresence(page.id)
  const [value, setValue] = useState(page.name)
  const done = useRef(false)
  const Icon = page.part ? Component : index === 0 ? Home : FileText
  const where = page.part ? `em ${plural(usage, 'página', 'páginas')}` : pathOf(page, index)

  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    if (commit) renamePage(page.id, value)
    setRenaming(false)
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-current={active ? 'page' : undefined}
        onClick={() => !renaming && focusPage(page.id)}
        onDoubleClick={() => {
          done.current = false
          setValue(page.name)
          setRenaming(true)
        }}
        onKeyDown={(e) => {
          if (renaming) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            focusPage(page.id)
          }
          if (e.key === 'F2') {
            done.current = false
            setValue(page.name)
            setRenaming(true)
          }
        }}
        className={cn(
          'group flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
          active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
        title={`${page.part ? `Componente, aparece ${where}` : where} · clique duas vezes para renomear`}
      >
        <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-gray-900' : 'text-gray-400')} strokeWidth={1.75} style={page.part ? { color: PART_COLOR } : undefined} />
        {renaming ? (
          <input
            autoFocus
            value={value}
            aria-label="Nome da página"
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => finish(true)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') finish(true)
              if (e.key === 'Escape') finish(false)
            }}
            className="h-6 min-w-0 flex-1 rounded-md border border-violet-300 bg-white px-1.5 text-[12px] font-medium text-gray-900 outline-none ring-2 ring-violet-500/20"
          />
        ) : (
          <>
            <span className={cn('min-w-0 truncate', active && 'font-medium', page.part && 'text-cyan-900')}>{page.name}</span>
            <span className={cn('min-w-0 shrink truncate text-[11px]', page.part ? 'text-cyan-700/80' : 'text-gray-400')}>{where}</span>
          </>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <PresenceStack presence={presence} max={2} size={16} ring={active ? '#f3f4f6' : '#ffffff'} />
          {page.wordpress && <Globe className="h-3 w-3 text-sky-500" aria-label="Ligada a uma página do site" />}
          {!page.part && <span className="text-[10px] tabular-nums text-gray-400">{page.sectionIds.length || ''}</span>}
          {page.part?.kind === 'section' && (
            <button
              type="button"
              aria-label={`Pôr ${page.name} na página aberta`}
              title="Pôr uma instância na página aberta (no fim; arraste para o lugar)"
              onClick={(e) => {
                e.stopPropagation()
                insertHere(page)
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-cyan-700 opacity-0 transition-[opacity,background-color] hover:bg-cyan-50 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>
    </li>
  )
}

/** Aba Páginas: todas as páginas do projeto, como no Framer. Clicar leva até ela no canvas. */
export const PagesList: React.FC = () => {
  const pages = useSpaceStore((s) => s.pages)
  const activePageId = useSpaceStore((s) => s.activePageId)
  const addPage = useSpaceStore((s) => s.addPage)
  const site = sitePages(pages)
  const parts = pages.filter((p) => p.part)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-1 pt-1">
        <span className="text-[11px] font-semibold text-gray-900">Páginas</span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-[color,background-color,transform] hover:bg-gray-100 hover:text-gray-900 active:scale-[0.94]"
              aria-label="Nova página"
              title="Nova página"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-56 rounded-xl p-1">
            <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => addPage()}>
              <FileText className="h-3.5 w-3.5" /> Página em branco
            </DropdownMenuItem>
            {/* O modelo entra na página ativa se ela estiver vazia; senão, numa página nova */}
            <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={() => useSpaceUi.getState().openLibrary('templates')}>
              <LayoutTemplate className="h-3.5 w-3.5" /> Página de um modelo…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {site.map((page, index) => (
          <PageRow key={page.id} page={page} index={index} active={page.id === activePageId} />
        ))}
        {parts.length > 0 && (
          <>
            <li aria-hidden className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Componentes
            </li>
            {parts.map((page, index) => (
              <PageRow key={page.id} page={page} index={index} active={page.id === activePageId} />
            ))}
          </>
        )}
      </ul>
    </div>
  )
}
