import React, { useRef } from 'react'
import { Check, ChevronDown, FileText, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSpaceStore } from '@/store/spaceStore'
import { Hint, ToolButton } from '../ToolbarIsland'

interface PagePickerProps {
  /** Largura coberta pela biblioteca, para centralizar a página na área livre. */
  leftInset: number
  /** Só o ícone e a seta, sem o nome da página. */
  compact?: boolean
}

/** A página em montagem: recebe as seções da biblioteca e dos modelos. Troca de página e cria uma nova. */
export const PagePicker: React.FC<PagePickerProps> = ({ leftInset, compact = false }) => {
  const pages = useSpaceStore((s) => s.pages)
  const activePageId = useSpaceStore((s) => s.activePageId)
  const { focusPage, addPage } = useSpaceStore.getState()
  const active = pages.find((p) => p.id === activePageId)
  // Página nova abre com o nome em edição; o menu não pode devolver o foco ao botão
  const keepFocus = useRef(false)

  return (
    <DropdownMenu>
      <Hint label="Página em montagem" hint="Recebe as seções da biblioteca e dos modelos">
        <DropdownMenuTrigger asChild>
          <ToolButton label={active ? `Página ${active.name}` : 'Páginas'} showLabel={false} className="max-w-44">
            <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
            {!compact && <span className="truncate text-gray-900">{active?.name ?? 'Páginas'}</span>}
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          </ToolButton>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-60 rounded-xl p-1"
        onCloseAutoFocus={(e) => {
          if (keepFocus.current) e.preventDefault()
          keepFocus.current = false
        }}
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium text-gray-500">Páginas do canvas</DropdownMenuLabel>
        {pages.map((page) => (
          <DropdownMenuItem key={page.id} className="gap-2 rounded-lg px-2 py-1.5 text-xs" onSelect={() => focusPage(page.id, { leftInset })}>
            <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{page.name}</span>
            <span className="shrink-0 tabular-nums text-[11px] text-gray-400">{page.sectionIds.length}</span>
            <Check className={`h-3.5 w-3.5 shrink-0 ${page.id === activePageId ? 'text-violet-600' : 'invisible'}`} aria-hidden />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 rounded-lg px-2 py-1.5 text-xs"
          onSelect={() => {
            keepFocus.current = true
            addPage(undefined, { leftInset })
          }}
        >
          <Plus className="h-3.5 w-3.5 text-gray-500" aria-hidden />
          Nova página
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
