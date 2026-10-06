import React, { useMemo } from 'react'
import { ArrowDown, ArrowUp, CloudUpload, Component, Copy, Globe, Monitor, MousePointerClick, PenLine, Play, Search, Smartphone, Tablet, Trash2, Unlink2, type LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import type { EditorDevice, SectionNodeData, SpacePage } from '@/types/space'
import { ApprovalChip } from '@/features/approval/ApprovalChip'
import { VIEWPORT_WIDTH } from '@/features/elementor-preview/PreviewFrame'
import { STATUS_LABELS, useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress } from '@/features/wordpress/useWordPressConnection'
import { BrandButton } from '../brand/BrandButton'
import { PanelBoundary } from '../editor/PanelBoundary'
import { PropertiesPanel } from '../editor/PropertiesPanel'
import { parseSectionElements } from '../landingPage'
import { sectionMotionLabel } from '../levels/motion'
import { findElement } from '../navigator/elementorContentEditor'
import { DEVICE_LABELS } from '../pages/PageFrame'
import { PAGE_HEADER, PART_NOUN, SECTION_WIDTH, pageFrame, pageOf, pageSlug, partShownIn, plural, sitePages } from '../pages/pages'
import { PART_COLOR, confirmPartSectionRemoval } from '../pages/parts'

export const DEVICES: { id: EditorDevice; label: string; icon: LucideIcon }[] = [
  { id: 'desktop', label: DEVICE_LABELS.desktop, icon: Monitor },
  { id: 'tablet', label: DEVICE_LABELS.tablet, icon: Tablet },
  { id: 'mobile', label: DEVICE_LABELS.mobile, icon: Smartphone },
]

const Group: React.FC<{ title: string; children: React.ReactNode; aside?: React.ReactNode }> = ({ title, children, aside }) => (
  <section className="space-y-2 border-b border-gray-100 px-3 py-3">
    <div className="flex items-center justify-between">
      <h3 className="text-[11px] font-semibold text-gray-900">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
)

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-h-7 items-center gap-2">
    <span className="w-16 shrink-0 text-[11px] text-gray-500">{label}</span>
    <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
  </div>
)

const field =
  'h-7 w-full min-w-0 rounded-md bg-gray-100 px-2 text-[12px] text-gray-900 outline-none transition-shadow placeholder:text-gray-400 focus:bg-white focus:shadow-[0_0_0_2px_rgb(124_58_237/0.45)]'

const ActionButton: React.FC<{ icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }> = ({ icon: Icon, label, onClick, disabled, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex h-8 items-center gap-2 rounded-md px-2 text-left text-[12px] transition-colors disabled:pointer-events-none disabled:opacity-40',
      danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
    )}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" />
    {label}
  </button>
)

/** A tela em que o canvas mostra as seções, e a que as propriedades ajustam. */
export const DeviceSwitch: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const device = useSpaceStore((s) => s.previewDevice)
  const setPreviewDevice = useSpaceStore((s) => s.setPreviewDevice)
  return (
    <div role="radiogroup" aria-label="Tela" className="grid flex-1 grid-cols-3 gap-0.5 rounded-md bg-gray-100 p-0.5">
      {DEVICES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={device === id}
          aria-label={label}
          title={`${label} · ${VIEWPORT_WIDTH[id]}px`}
          onClick={() => setPreviewDevice(id)}
          className={cn(
            'flex h-6 items-center justify-center gap-1 rounded text-[11px] font-medium transition-[background-color,color,box-shadow]',
            device === id ? 'bg-white text-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.08)]' : 'text-gray-500 hover:text-gray-900'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {!compact && label}
        </button>
      ))}
    </div>
  )
}

/** Sem nada selecionado: a página ativa, a tela, a marca e o site. */
const PageStyle: React.FC<{ page: SpacePage }> = ({ page }) => {
  const nodes = useSpaceStore((s) => s.nodes)
  const pages = useSpaceStore((s) => s.pages)
  const device = useSpaceStore((s) => s.previewDevice)
  const { renamePage, openPlayer } = useSpaceStore.getState()
  const wordpress = useActiveWordPress()
  const count = page.sectionIds.length
  const height = Math.round(((pageFrame(page, nodes, pages).height - PAGE_HEADER) * VIEWPORT_WIDTH[device]) / SECTION_WIDTH)
  const path = sitePages(pages)[0]?.id === page.id ? '/' : `/${page.details?.slug || pageSlug(page.name)}`
  const linked = !!page.wordpress && page.wordpress.siteUrl === wordpress?.site.siteUrl

  if (page.part) {
    const shownIn = partShownIn(page, pages, nodes)
    return (
      <>
        <Group title="Componente">
          <Row label="Nome">
            <input key={page.id} defaultValue={page.name} className={field} aria-label="Nome do componente" onBlur={(e) => renamePage(page.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          </Row>
          <Row label="Aparece em">
            <span className="truncate text-[12px] text-gray-700" title={shownIn.map((p) => p.name).join(', ')}>
              {shownIn.length ? plural(shownIn.length, 'página', 'páginas') : 'Nenhuma página'}
            </span>
          </Row>
          <ComponentNote kind={page.part.kind === 'section' ? undefined : PART_NOUN[page.part.kind]} />
        </Group>
        <Group title="Tela">
          <DeviceSwitch />
        </Group>
        <Group title="Marca">
          <BrandButton variant="row" />
        </Group>
        <Group title="Site">
          <div className="-mx-1 flex flex-col">
            <ActionButton icon={Play} label="Ver no player" onClick={() => openPlayer(page.id)} disabled={!count} />
            {wordpress && (
              <ActionButton
                icon={CloudUpload}
                label={linked ? 'Atualizar no Theme Builder…' : 'Publicar no Theme Builder…'}
                onClick={() => useWordPressUi.getState().openPublish(page.id)}
                disabled={!count}
              />
            )}
          </div>
          {linked && page.wordpress && (
            <a href={page.wordpress.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-[11px] text-sky-700 hover:underline">
              <Globe className="h-3 w-3 shrink-0" />
              {page.wordpress.title} · modelo do Theme Builder
            </a>
          )}
        </Group>
      </>
    )
  }

  return (
    <>
      <Group title="Página" aside={<ApprovalChip pageId={page.id} />}>
        <Row label="Nome">
          <input key={page.id} defaultValue={page.name} className={field} aria-label="Nome da página" onBlur={(e) => renamePage(page.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </Row>
        <Row label="Endereço">
          <span className="truncate text-[12px] text-gray-700">{path}</span>
        </Row>
        <Row label="Seções">
          <span className="text-[12px] tabular-nums text-gray-700">{count ? plural(count, 'seção', 'seções') : 'Nenhuma ainda'}</span>
        </Row>
      </Group>

      <Group title="Tela">
        <DeviceSwitch />
        <Row label="Tamanho">
          <span className="text-[12px] tabular-nums text-gray-700">
            {VIEWPORT_WIDTH[device]} × {count ? height.toLocaleString('pt-BR') : '—'}
          </span>
        </Row>
      </Group>

      <Group title="Marca">
        <BrandButton variant="row" />
      </Group>

      <Group title="Site">
        <div className="-mx-1 flex flex-col">
          <ActionButton icon={Play} label="Ver no player" onClick={() => openPlayer(page.id)} disabled={!count} />
          <ActionButton icon={Search} label="Detalhes e SEO…" onClick={() => useWordPressUi.getState().openDetails(page.id)} />
          {wordpress && (
            <ActionButton icon={CloudUpload} label={linked ? 'Atualizar no site…' : 'Publicar no site…'} onClick={() => useWordPressUi.getState().openPublish(page.id)} disabled={!count} />
          )}
        </div>
        {page.wordpress && (
          <a href={page.wordpress.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-[11px] text-sky-700 hover:underline">
            <Globe className="h-3 w-3 shrink-0" />
            {page.wordpress.title} · {STATUS_LABELS[page.wordpress.status] ?? page.wordpress.status}
          </a>
        )}
      </Group>
    </>
  )
}

/** O que distingue um componente de uma seção comum, em uma frase. */
const ComponentNote: React.FC<{ kind?: string }> = ({ kind }) => (
  <p className="rounded-lg bg-cyan-50 px-2.5 py-2 text-[11px] leading-relaxed text-cyan-900">
    Componente: existe uma vez só e aparece {kind ? `em todas as páginas que mostram o ${kind}` : 'em todas as instâncias dele'}. O que mudar aqui muda em todas.
  </p>
)

/** Uma seção selecionada (sem camada): nome, lugar na página e as ações dela. */
const SectionStyle: React.FC<{ sectionId: string }> = ({ sectionId }) => {
  const { node, pages } = useSpaceStore(useShallow((s) => ({ node: s.nodes.find((n) => n.id === sectionId), pages: s.pages })))
  const { updateNodeData, moveSection, duplicateSections, removeNode } = useSpaceStore.getState()
  if (!node || node.type !== 'section') return null
  const data = node.data as SectionNodeData
  const page = pageOf(pages, sectionId)
  const index = page ? page.sectionIds.indexOf(sectionId) : -1
  const motion = sectionMotionLabel(data.levels?.motion)
  const part = page?.part ? page : undefined
  const shownIn = part ? partShownIn(part, pages, useSpaceStore.getState().nodes) : []

  // Instância de um componente: o conteúdo é o da folha dele
  const source = data.instanceOf ? pages.find((p) => p.id === data.instanceOf) : undefined
  if (data.instanceOf) {
    return (
      <>
        <Group title="Componente">
          <Row label="Instância de">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-cyan-900">
              <Component className="h-3.5 w-3.5 shrink-0" style={{ color: PART_COLOR }} />
              <span className="truncate">{source?.name ?? 'componente excluído'}</span>
            </span>
          </Row>
          <Row label="Lugar">
            <span className="truncate text-[12px] text-gray-700">{page ? `${index + 1} de ${page.sectionIds.length} · ${page.name}` : 'Solta no canvas'}</span>
          </Row>
          <ComponentNote />
          <div className="-mx-1 flex flex-col">
            {source && <ActionButton icon={PenLine} label="Editar componente" onClick={() => useSpaceStore.getState().focusPage(source.id)} />}
            {source && <ActionButton icon={Unlink2} label="Separar do componente" onClick={() => useSpaceStore.getState().detachInstance(sectionId)} />}
            {page && <ActionButton icon={ArrowUp} label="Subir" onClick={() => moveSection(sectionId, -1)} disabled={index <= 0} />}
            {page && <ActionButton icon={ArrowDown} label="Descer" onClick={() => moveSection(sectionId, 1)} disabled={index >= page.sectionIds.length - 1} />}
            <ActionButton icon={Trash2} label="Tirar desta página" danger onClick={() => removeNode(sectionId)} />
          </div>
        </Group>
      </>
    )
  }

  return (
    <>
      {part && (
        <Group title="Componente">
          <Row label="Do">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-cyan-900">
              <Component className="h-3.5 w-3.5 shrink-0" style={{ color: PART_COLOR }} />
              <span className="truncate">{part.name}</span>
            </span>
          </Row>
          <Row label="Aparece em">
            <span className="truncate text-[12px] text-gray-700" title={shownIn.map((p) => p.name).join(', ')}>
              {shownIn.length ? plural(shownIn.length, 'página', 'páginas') : 'Nenhuma página'}
            </span>
          </Row>
          <ComponentNote kind={part.part!.kind === 'section' ? undefined : PART_NOUN[part.part!.kind]} />
          <div className="-mx-1 flex flex-col">
            <ActionButton icon={PenLine} label="Ir para o componente" onClick={() => useSpaceStore.getState().focusPage(part.id)} />
          </div>
        </Group>
      )}
      <Group title="Seção">
        <Row label="Nome">
          <input key={sectionId} defaultValue={data.title} className={field} aria-label="Nome da seção" onBlur={(e) => updateNodeData(sectionId, { title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </Row>
        <Row label="Lugar">
          <span className="truncate text-[12px] text-gray-700">{page ? `${index + 1} de ${page.sectionIds.length} · ${page.name}` : 'Solta no canvas'}</span>
        </Row>
        {data.sourceId && (
          <Row label="Origem">
            <span className="truncate font-mono text-[11px] text-gray-500">{data.sourceId}</span>
          </Row>
        )}
        {motion && (
          <Row label="Movimento">
            <span className="truncate text-[12px] text-gray-700">{motion}</span>
          </Row>
        )}
      </Group>
      <Group title="Ações">
        <div className="-mx-1 flex flex-col">
          {page && <ActionButton icon={ArrowUp} label="Subir" onClick={() => moveSection(sectionId, -1)} disabled={index <= 0} />}
          {page && <ActionButton icon={ArrowDown} label="Descer" onClick={() => moveSection(sectionId, 1)} disabled={index >= page.sectionIds.length - 1} />}
          <ActionButton icon={Copy} label="Duplicar" onClick={() => duplicateSections([sectionId])} />
          <ActionButton icon={Trash2} label="Remover" danger onClick={() => confirmPartSectionRemoval([sectionId]) && removeNode(sectionId)} />
        </div>
      </Group>
      <p className="flex gap-2 px-3 py-3 text-[11px] leading-relaxed text-gray-500">
        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        Clique num título, texto, botão ou imagem dentro da seção para mudar o conteúdo e o estilo dele. Clique duas vezes para escrever direto no canvas.
      </p>
    </>
  )
}

/**
 * Aba Estilo, como a do Framer: o que está selecionado define o que aparece.
 * Uma camada mostra as propriedades; uma seção, o nome e as ações; nada, a
 * página ativa com a tela e a marca.
 */
export const StyleTab: React.FC = () => {
  const { selection, selectedIds, activePageId, pages, nodes } = useSpaceStore(
    useShallow((s) => ({ selection: s.navigatorSelection, selectedIds: s.selectedIds, activePageId: s.activePageId, pages: s.pages, nodes: s.nodes }))
  )
  const element = useMemo(() => {
    if (!selection) return null
    const owner = nodes.find((n) => n.id === selection.sectionId)
    return owner ? findElement(parseSectionElements((owner.data as SectionNodeData).elementorJson), selection.elementId) : null
  }, [selection, nodes])

  if (selection && element) {
    return (
      <PanelBoundary what="as propriedades desta camada" resetKey={`${selection.sectionId}:${selection.elementId}`}>
        <PropertiesPanel key={`${selection.sectionId}:${selection.elementId}`} sectionId={selection.sectionId} elementId={selection.elementId} />
      </PanelBoundary>
    )
  }
  const sections = selectedIds.filter((id) => nodes.some((n) => n.id === id && n.type === 'section'))
  if (sections.length === 1) return <SectionStyle sectionId={sections[0]} />
  if (sections.length > 1) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-[12px] font-medium text-gray-800">{plural(sections.length, 'seção selecionada', 'seções selecionadas')}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Copie, duplique ou peça ao agente para mexer nelas juntas.</p>
      </div>
    )
  }
  const page = pages.find((p) => p.id === activePageId) ?? pages[0]
  return page ? <PageStyle page={page} /> : null
}
