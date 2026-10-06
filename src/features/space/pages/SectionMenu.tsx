import React from 'react'
import { ClipboardCopy, Component, Copy, CopyPlus, FileText, FolderInput, MoreHorizontal, Sparkles, Unlink } from 'lucide-react'
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
import type { PagePartKind, SectionNodeData } from '@/types/space'
import { copySelection } from './actions'
import { MOD_KEY } from './clipboard'
import { instanceOf, pageOf, partPage, plural } from './pages'
import { PART_COLOR, PART_LABEL, PART_NOUN, findComponentCopies, useMakePartDialog } from './parts'

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
  // Seção de uma página do site pode virar o cabeçalho ou o rodapé do site (ou dar lugar ao que já existe)
  const instance = useSpaceStore((s) => !!instanceOf(s.nodes.find((n) => n.id === sectionId)))
  const canBecomePart = !!page && !page.part && !instance
  // Qualquer seção de página (menos as do cabeçalho e do rodapé) pode virar um componente livre
  const canBecomeComponent = !!page && page.part?.kind !== 'header' && page.part?.kind !== 'footer' && !instance

  const toComponent = () => {
    const { pages: all, nodes } = useSpaceStore.getState()
    // Com cópias iguais em outras páginas, a janela pergunta quais viram instância; sem elas, vira na hora
    if (findComponentCopies(sectionId, all, nodes).length) return useMakePartDialog.getState().open(sectionId, 'section')
    const id = useSpaceStore.getState().makeComponent(sectionId)
    if (id) {
      toast.success(`"${section?.title || 'Seção'}" virou componente`, {
        description: `No lugar dela ficou uma instância. Copie (${MOD_KEY}C) e cole em outras páginas; o que mudar na folha dele muda em todas.`,
        action: { label: 'Ver componente', onClick: () => useSpaceStore.getState().focusPage(id) },
      })
    }
  }

  const toPart = (kind: PagePartKind) => {
    const existing = partPage(pages, kind)
    if (!existing) return useMakePartDialog.getState().open(sectionId, kind)
    useSpaceStore.getState().replaceWithPart(sectionId, existing.id)
    toast.success(`A página passou a mostrar o ${PART_NOUN[kind]} do site`, { description: `A seção foi para a lixeira. ${MOD_KEY}Z desfaz.` })
  }

  const copyTo = (pageId: string, name: string) => {
    const count = copySectionsTo(targetIds(sectionId), pageId)
    if (count) toast.success(`${plural(count, 'seção copiada', 'seções copiadas')} para ${name}`)
  }

  const moveTo = (pageId: string) => {
    for (const id of targetIds(sectionId)) moveSectionToPage(id, pageId)
  }

  return (
    // Não modal: "Transformar em componente" abre uma janela, e o menu modal deixaria o canvas sem clique
    <DropdownMenu modal={false}>
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
            <Unlink className={icon} /> {page.part ? `Tirar do ${PART_NOUN[page.part.kind]}` : 'Tirar da página'}
          </DropdownMenuItem>
        )}
        {canBecomeComponent && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={item}>
                <Component className="h-3.5 w-3.5" style={{ color: PART_COLOR }} /> Componente
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 rounded-xl p-1">
                <DropdownMenuItem className={item} onSelect={toComponent} title="Uma cópia só: põe a instância onde quiser, e o que mudar na folha dele muda em todas">
                  <Component className="h-3.5 w-3.5" style={{ color: PART_COLOR }} />
                  Transformar em componente
                </DropdownMenuItem>
                {canBecomePart && <DropdownMenuSeparator />}
                {canBecomePart &&
                  (['header', 'footer'] as const).map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      className={item}
                      onSelect={() => toPart(kind)}
                      title={
                        partPage(pages, kind)
                          ? `Tira esta seção e mostra o ${PART_NOUN[kind]} do site no lugar dela`
                          : `Aparece sozinho em todas as páginas: o que mudar nele muda em todas`
                      }
                    >
                      <Component className="h-3.5 w-3.5" style={{ color: PART_COLOR }} />
                      {partPage(pages, kind) ? `Trocar pelo ${PART_NOUN[kind]} do site` : `Transformar em ${PART_LABEL[kind].toLowerCase()}`}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
