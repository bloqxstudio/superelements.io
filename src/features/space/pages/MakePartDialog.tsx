import React, { useEffect, useMemo, useState } from 'react'
import { Component } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import type { PagePartKind, SectionNodeData } from '@/types/space'
import { MOD_KEY } from './clipboard'
import { pageOf, plural } from './pages'
import { PART_COLOR, PART_LABEL, PART_NOUN, findComponentCopies, findPartCopies, useMakePartDialog, type PartCopy } from './parts'

/** O que vai acontecer com a página, em uma linha. */
function outcome(row: PartCopy, shown: boolean, kind: PagePartKind) {
  const noun = PART_NOUN[kind]
  const title = row.copy ? `"${(row.copy.data as SectionNodeData).title || 'Seção sem nome'}"` : ''
  if (!shown) return row.copy ? `Fica sem o ${noun} do site e mantém a seção ${title}` : `Fica sem o ${noun}`
  if (!row.copy) return kind === 'header' ? 'O cabeçalho entra no topo' : 'O rodapé entra no fim'
  return row.same ? `A cópia ${title}, igual, sai da página` : `A seção ${title} sai da página: era um pouco diferente`
}

const Body: React.FC<{ sectionId: string; kind: PagePartKind }> = ({ sectionId, kind }) => {
  const close = useMakePartDialog((s) => s.close)
  const pages = useSpaceStore((s) => s.pages)
  const nodes = useSpaceStore((s) => s.nodes)
  const section = nodes.find((n) => n.id === sectionId)
  const home = pageOf(pages, sectionId)
  // As linhas são lidas uma vez, ao abrir: o canvas pode mudar por trás (outra pessoa, o agente)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => findPartCopies(sectionId, kind, pages, nodes), [sectionId, kind])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const label = PART_LABEL[kind]
  const noun = PART_NOUN[kind]
  const title = (section?.data as SectionNodeData | undefined)?.title || 'Seção sem nome'

  // A seção saiu do canvas com a janela aberta: não há o que transformar
  useEffect(() => {
    if (!section) close()
  }, [section, close])
  if (!section) return null

  const shownCount = 1 + rows.filter((r) => !hidden.has(r.page.id)).length
  const toggle = (pageId: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })

  const confirm = () => {
    const remove = rows.filter((r) => r.copy && !hidden.has(r.page.id)).map((r) => r.copy!.id)
    const partId = useSpaceStore.getState().makePagePart(sectionId, kind, { remove, exclude: [...hidden] })
    close()
    if (!partId) return
    toast.success(`${label} virou componente`, {
      description: `Aparece em ${plural(shownCount, 'página', 'páginas')}.${remove.length ? ` ${plural(remove.length, 'cópia foi', 'cópias foram')} para a lixeira.` : ''} ${MOD_KEY}Z desfaz.`,
      action: { label: 'Ver componente', onClick: () => useSpaceStore.getState().focusPage(partId) },
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: PART_COLOR }}>
            <Component className="h-3.5 w-3.5" />
          </span>
          Transformar em {noun} do site
        </DialogTitle>
        <DialogDescription className="leading-relaxed">
          "{title}" passa a ser um componente: existe uma vez só, numa folha própria em ciano, e aparece {kind === 'header' ? 'no topo' : 'no fim'} das páginas. O que mudar nele muda em todas.
        </DialogDescription>
      </DialogHeader>

      <ul className="-mx-1 max-h-[46vh] space-y-0.5 overflow-y-auto">
        {home && (
          <li className="flex items-start gap-2.5 rounded-lg px-2 py-2">
            <input type="checkbox" checked disabled className="mt-0.5 h-3.5 w-3.5 accent-cyan-600" aria-label={home.name} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-gray-900">{home.name}</span>
              <span className="block text-[12px] text-gray-500">De onde vem o {noun}</span>
            </span>
          </li>
        )}
        {rows.map((row) => {
          const shown = !hidden.has(row.page.id)
          const differs = shown && !!row.copy && !row.same
          return (
            <li key={row.page.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50">
                <input type="checkbox" checked={shown} onChange={() => toggle(row.page.id)} className="mt-0.5 h-3.5 w-3.5 accent-cyan-600" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-gray-900">{row.page.name}</span>
                  <span className={cn('flex items-center gap-1.5 text-[12px]', differs ? 'text-amber-700' : 'text-gray-500')}>
                    {differs && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                    {outcome(row, shown, kind)}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {rows.some((r) => r.copy && !r.same) && (
        <p className="text-[12px] leading-relaxed text-gray-500">
          A página que tinha um {noun} diferente passa a mostrar este. Para manter o dela, desmarque: ela fica com a própria seção.
        </p>
      )}

      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button type="button" onClick={confirm} className="bg-cyan-700 text-white hover:bg-cyan-800">
          Transformar em componente
        </Button>
      </DialogFooter>
    </>
  )
}

/** Componente livre: as cópias iguais em outras páginas podem virar instâncias dele. */
const ComponentBody: React.FC<{ sectionId: string }> = ({ sectionId }) => {
  const close = useMakePartDialog((s) => s.close)
  const pages = useSpaceStore((s) => s.pages)
  const nodes = useSpaceStore((s) => s.nodes)
  const section = nodes.find((n) => n.id === sectionId)
  // Lidas uma vez, ao abrir
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => findComponentCopies(sectionId, pages, nodes), [sectionId])
  const [kept, setKept] = useState<Set<string>>(new Set())
  const title = (section?.data as SectionNodeData | undefined)?.title || 'Seção sem nome'

  useEffect(() => {
    if (!section) close()
  }, [section, close])
  if (!section) return null

  const toggle = (id: string) =>
    setKept((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const confirm = () => {
    const replace = rows.flatMap((r) => r.copies.map((c) => c.id)).filter((id) => !kept.has(id))
    const id = useSpaceStore.getState().makeComponent(sectionId, replace)
    close()
    if (!id) return
    toast.success(`"${title}" virou componente`, {
      description: `${replace.length ? `${plural(replace.length + 1, 'instância', 'instâncias')} no lugar das cópias; as cópias foram para a lixeira. ` : ''}${MOD_KEY}Z desfaz.`,
      action: { label: 'Ver componente', onClick: () => useSpaceStore.getState().focusPage(id) },
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: PART_COLOR }}>
            <Component className="h-3.5 w-3.5" />
          </span>
          Transformar em componente
        </DialogTitle>
        <DialogDescription className="leading-relaxed">
          "{title}" passa a existir uma vez só, numa folha própria em ciano; no lugar dela fica uma instância. Outras páginas têm a mesma seção: as
          marcadas também viram instâncias e passam a mudar junto.
        </DialogDescription>
      </DialogHeader>

      <ul className="-mx-1 max-h-[46vh] space-y-0.5 overflow-y-auto">
        {rows.flatMap((row) =>
          row.copies.map((copy) => {
            const on = !kept.has(copy.id)
            const position = row.page.sectionIds.indexOf(copy.id) + 1
            return (
              <li key={copy.id}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50">
                  <input type="checkbox" checked={on} onChange={() => toggle(copy.id)} className="mt-0.5 h-3.5 w-3.5 accent-cyan-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-gray-900">
                      {row.page.name} · seção {position}
                    </span>
                    <span className="block text-[12px] text-gray-500">{on ? 'A cópia igual vira instância do componente' : 'Continua seção comum, só desta página'}</span>
                  </span>
                </label>
              </li>
            )
          })
        )}
      </ul>

      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button type="button" onClick={confirm} className="bg-cyan-700 text-white hover:bg-cyan-800">
          Transformar em componente
        </Button>
      </DialogFooter>
    </>
  )
}

/** Confirma o que acontece em cada página antes de a seção virar o cabeçalho (ou rodapé) do site, ou um componente. */
export const MakePartDialog: React.FC = () => {
  const request = useMakePartDialog((s) => s.request)
  const close = useMakePartDialog((s) => s.close)
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg">
        {request?.kind === 'section' ? (
          <ComponentBody key={request.sectionId} sectionId={request.sectionId} />
        ) : (
          request && <Body key={request.sectionId + request.kind} sectionId={request.sectionId} kind={request.kind} />
        )}
      </DialogContent>
    </Dialog>
  )
}
