import React from 'react'
import { ClipboardCopy, Copy, CopyPlus, FileText, FolderInput, MoreHorizontal, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSpaceStore } from '@/store/spaceStore'
import { copySelection } from './actions'
import { MOD_KEY } from './clipboard'
import { pageOf, plural } from './pages'

const item = 'gap-2 rounded-lg text-xs'
const icon = 'h-3.5 w-3.5 text-gray-400'

/** As seções em que o menu age: a seleção, se esta seção faz parte dela; senão só esta. */
const targetIds = (sectionId: string) => {
  const { selectedIds } = useSpaceStore.getState()
  return selectedIds.includes(sectionId) ? selectedIds : [sectionId]
}

interface SectionMenuProps {
  sectionId: string
  className: string
}

/** Menu da seção: copiar, duplicar, copiar ou mover para outra página e tirar da página. */
export const SectionMenu: React.FC<SectionMenuProps> = ({ sectionId, className }) => {
  const pages = useSpaceStore((s) => s.pages)
  const selectedCount = useSpaceStore((s) => (s.selectedIds.includes(sectionId) ? s.selectedIds.length : 1))
  const page = pageOf(pages, sectionId)
  const otherPages = pages.filter((p) => p.id !== page?.id)
  const { duplicateSections, copySectionsTo, moveSectionToPage } = useSpaceStore.getState()
  const what = selectedCount > 1 ? ` (${selectedCount})` : ''

  const copyTo = (pageId: string, name: string) => {
    const count = copySectionsTo(targetIds(sectionId), pageId)
    if (count) toast.success(`${plural(count, 'seção copiada', 'seções copiadas')} para ${name}`)
  }

  const moveTo = (pageId: string) => {
    for (const id of targetIds(sectionId)) moveSectionToPage(id, pageId)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={className} title="Mais ações" aria-label="Mais ações da seção">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56 rounded-xl p-1">
        <DropdownMenuItem className={item} onSelect={() => copySelection(targetIds(sectionId))}>
          <Copy className={icon} /> Copiar{what}
          <DropdownMenuShortcut>{MOD_KEY}C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => duplicateSections(targetIds(sectionId))}>
          <CopyPlus className={icon} /> Duplicar{what}
          <DropdownMenuShortcut>{MOD_KEY}D</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={item}>
            <ClipboardCopy className={icon} /> Copiar para
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48 rounded-xl p-1">
            {pages.map((p) => (
              <DropdownMenuItem key={p.id} className={item} onSelect={() => copyTo(p.id, p.name)}>
                <FileText className={icon} />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {otherPages.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={item}>
              <FolderInput className={icon} /> {page ? 'Mover para' : 'Pôr na página'}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 rounded-xl p-1">
              {otherPages.map((p) => (
                <DropdownMenuItem key={p.id} className={item} onSelect={() => moveTo(p.id)}>
                  <FileText className={icon} />
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {page && (
          // Só esta: várias soltas de uma vez cairiam umas sobre as outras abaixo da página
          <DropdownMenuItem className={item} onSelect={() => moveSectionToPage(sectionId, null)}>
            <Unlink className={icon} /> Tirar da página
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
