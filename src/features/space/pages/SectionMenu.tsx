import React from 'react'
import { ClipboardCopy, Component as ComponentIcon, Copy, CopyPlus, FileText, FolderInput, MoreHorizontal, Sparkles, Unlink } from 'lucide-react'
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
import { isPackSection } from '@/features/section-pack/categories'
import { writeSectionWithAi } from '@/features/space/copy/writeWithAi'
import { componentizeSelection, selectElement } from '@/features/space/editor/actions'
import type { SectionNodeData } from '@/types/space'
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

// Seções com a IA escrevendo agora: o item fica desligado até a resposta voltar
const writing = new Set<string>()

/** Pede à IA os textos da seção para o projeto; o resultado é um passo do Ctrl+Z. */
function writeWithAi(sectionId: string, title: string) {
  if (writing.has(sectionId)) return
  writing.add(sectionId)
  toast.promise(
    writeSectionWithAi(sectionId).finally(() => writing.delete(sectionId)),
    {
      loading: `Escrevendo os textos de ${title}…`,
      success: (count) => `${plural(count, 'texto escrito', 'textos escritos')} para o projeto. ${MOD_KEY}Z desfaz.`,
      error: (e: Error) => e.message || 'Não deu para escrever os textos.',
    }
  )
}

/** Menu da seção: copiar, duplicar, copiar ou mover para outra página, tirar da página e escrever com IA. */
export const SectionMenu: React.FC<SectionMenuProps> = ({ sectionId, className }) => {
  const pages = useSpaceStore((s) => s.pages)
  const section = useSpaceStore((s) => s.nodes.find((n) => n.id === sectionId)?.data as SectionNodeData | undefined)
  const fromPack = isPackSection(section?.sourceId)
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
        {fromPack && (
          <>
            <DropdownMenuItem
              className={item}
              onSelect={() => writeWithAi(sectionId, section?.title ?? 'a seção')}
              title="Textos novos para esta seção, com o contexto, a voz da marca e os textos das páginas do projeto"
            >
              <Sparkles className={icon} /> Escrever textos com IA
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem className={item} onSelect={() => copySelection(targetIds(sectionId))}>
          <Copy className={icon} /> Copiar{what}
          <DropdownMenuShortcut>{MOD_KEY}C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => duplicateSections(targetIds(sectionId))}>
          <CopyPlus className={icon} /> Duplicar{what}
          <DropdownMenuShortcut>{MOD_KEY}D</DropdownMenuShortcut>
        </DropdownMenuItem>
        {section?.component ? (
          <DropdownMenuItem
            className={item}
            onSelect={() => {
              useSpaceStore.getState().detachComponent(sectionId)
              toast.success('Esta seção virou cópia comum', { description: `Os outros usos seguem ligados. ${MOD_KEY}Z desfaz.` })
            }}
            title="Esta seção deixa de mudar junto com os outros usos do componente"
          >
            <Unlink className={icon} /> Separar do componente
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className={item}
            onSelect={() => {
              selectElement(sectionId, null)
              componentizeSelection()
            }}
            title="Os usos ficam ligados: mudar um muda todos"
          >
            <ComponentIcon className={icon} /> Transformar em componente
            <DropdownMenuShortcut>{MOD_KEY}Alt+K</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

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
