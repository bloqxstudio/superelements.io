import React, { useEffect, useMemo, useRef } from 'react'
import { CloudUpload, Component as ComponentIcon, Globe, PanelBottom, PanelTop, Unlink, X } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import type { ComponentRole, ComponentTexts, SectionNodeData, SpaceComponent } from '@/types/space'
import { MOD_KEY } from '@/features/space/pages/clipboard'
import { pageOf, plural } from '@/features/space/pages/pages'
import { componentKind } from '@/features/wordpress/publish'
import { useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress } from '@/features/wordpress/useWordPressConnection'
import { COMPONENT_COLOR, COMPONENT_COLOR_STRONG, componentUses, textsOf, type ComponentUse } from './components'
import { useComponentNaming } from './naming'
import { goToUse } from './selection'

/**
 * O componente no lugar em que ele está, na aba Estilo: não há área separada
 * de componentes. Clicar num uso mostra o nome, onde mais ele aparece (clicar
 * leva até lá), se os textos são iguais em todos ou de cada uso, o papel no
 * site e as ações. O estilo muda junto em todos os usos.
 */

const ROLE_LABEL: Record<ComponentRole, string> = { header: 'Cabeçalho do site', footer: 'Rodapé do site' }

const sameUse = (a: ComponentUse, b: { sectionId: string; elementId?: string }) => a.sectionId === b.sectionId && (a.elementId ?? null) === (b.elementId ?? null)

const actionButton =
  'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition-[background-color,color,transform] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600'

interface ComponentCardProps {
  componentId: string
  sectionId: string
  /** Sem camada: a seção inteira é o uso. */
  elementId?: string
  /** A seleção está dentro do uso (não é ele). */
  inside?: boolean
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ componentId, sectionId, elementId, inside }) => {
  const component = useSpaceStore((s) => s.components.find((c) => c.id === componentId))
  const { nodes, pages } = useSpaceStore(useShallow((s) => ({ nodes: s.nodes, pages: s.pages })))
  const connection = useActiveWordPress()
  const uses = useMemo(() => componentUses(nodes).filter((u) => u.componentId === componentId), [nodes, componentId])
  // Recém-criado: o nome já vem selecionado, para digitar por cima
  const naming = useComponentNaming((s) => s.id === componentId)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!naming) return
    const input = nameRef.current
    if (input) {
      input.focus()
      input.select()
    }
    useComponentNaming.getState().set(null)
  }, [naming])
  if (!component) return null
  const texts = textsOf(component)

  const store = useSpaceStore.getState()
  const here = { sectionId, elementId }
  const others = uses.filter((u) => !sameUse(u, here))
  const pagesWith = new Set(uses.map((u) => pageOf(pages, u.sectionId)?.id).filter(Boolean))
  const missingPages = pages.filter((p) => !pagesWith.has(p.id))
  const kind = componentKind(component)
  const linked = !!connection && component.wordpress?.siteUrl === connection.site.siteUrl
  const where = (use: ComponentUse) => {
    const page = pageOf(pages, use.sectionId)
    const section = nodes.find((n) => n.id === use.sectionId)
    const title = (section?.data as SectionNodeData | undefined)?.title
    return [page?.name ?? 'Solta no canvas', use.elementId && title].filter(Boolean).join(' · ')
  }

  const setRole = (role: ComponentRole | undefined) => {
    const before = store.components.find((c) => role && c.role === role && c.id !== component.id)
    store.setComponentRole(component.id, role)
    if (role) {
      toast.success(`${component.name} é o ${ROLE_LABEL[role].toLowerCase()}`, {
        description: `${before ? `${before.name} deixou de ser. ` : ''}Páginas novas já vêm com ele; com o Elementor Pro, publicar vai para o Theme Builder.`,
      })
    }
  }

  const placeEverywhere = () => {
    const added = store.placeComponent(component.id, pages.map((p) => p.id), component.role === 'footer' ? 'bottom' : 'top')
    if (added) toast.success(`${component.name} entrou em ${plural(added, 'página', 'páginas')}`, { description: `${MOD_KEY}Z desfaz.` })
  }

  const detach = () => {
    store.detachComponent(sectionId, elementId)
    toast.success('Este uso virou cópia comum', { description: `Os outros seguem ligados. ${MOD_KEY}Z desfaz.` })
  }

  const setTexts = (next: ComponentTexts) => {
    store.setComponentTexts(component.id, next, { sectionId, elementId })
    if (next === 'shared' && others.length) {
      toast.success('Textos iguais em todos os usos', { description: `Os textos deste foram para ${others.length === 1 ? 'o outro' : `os outros ${others.length}`}. ${MOD_KEY}Z desfaz.` })
    }
  }

  const dissolve = () => {
    store.deleteComponent(component.id)
    toast.success(`${component.name} deixou de ser componente`, { description: `${plural(uses.length, 'uso virou cópia comum', 'usos viraram cópias comuns')}. ${MOD_KEY}Z desfaz.` })
  }

  return (
    <section className="space-y-2 border-b border-cyan-100 bg-cyan-50/50 px-3 py-2.5" aria-label={`Componente ${component.name}`}>
      <div className="flex items-center gap-2">
        <ComponentIcon className="h-3.5 w-3.5 shrink-0" style={{ color: COMPONENT_COLOR }} aria-hidden />
        <input
          ref={nameRef}
          key={component.id + component.name}
          defaultValue={component.name}
          aria-label="Nome do componente"
          placeholder="Nome do componente"
          onBlur={(e) => store.renameComponent(component.id, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-xs font-semibold outline-none transition-colors hover:border-cyan-200 focus:border-cyan-500 focus:bg-white"
          style={{ color: COMPONENT_COLOR_STRONG }}
        />
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-cyan-800 ring-1 ring-inset ring-cyan-200">
          {component.role ? ROLE_LABEL[component.role] : 'Componente'}
        </span>
      </div>

      <p className="text-[11px] leading-snug text-cyan-950/80">
        {inside && 'Você está dentro do componente. '}
        {!others.length
          ? 'Por enquanto só está aqui. Duplique, copie e cole ou insira pelo painel Inserir para usar em outros lugares.'
          : texts === 'shared'
            ? `Mudar aqui muda ${others.length === 1 ? 'o outro uso' : `os outros ${others.length} usos`}, textos também.`
            : `O estilo muda junto ${others.length === 1 ? 'no outro uso' : `nos outros ${others.length} usos`}; os textos são de cada um.`}
      </p>

      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-[11px] text-cyan-950/70">Textos</span>
        <div role="radiogroup" aria-label="Textos do componente" className="grid flex-1 grid-cols-2 gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-inset ring-cyan-200">
          {(
            [
              ['own', 'Cada um o seu', 'Cada uso tem os próprios textos, links e imagens; só o estilo muda junto'],
              ['shared', 'Iguais em todos', 'Textos, links e imagens iguais em todos os usos; os deste uso vão para os outros'],
            ] as const
          ).map(([value, label, title]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={texts === value}
              title={title}
              onClick={() => setTexts(value)}
              className={cn(
                'h-6 rounded text-[11px] font-medium transition-[background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600',
                texts === value ? 'bg-cyan-700 text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {others.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Outros usos">
          {others.slice(0, 8).map((use) => (
            <li key={`${use.sectionId}:${use.elementId ?? ''}`}>
              <button
                type="button"
                onClick={() => goToUse(use)}
                className="max-w-[200px] truncate rounded-md bg-white px-1.5 py-0.5 text-[11px] text-gray-700 ring-1 ring-inset ring-cyan-200 transition-colors hover:text-gray-950 hover:ring-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                title="Ir até este uso"
              >
                {where(use)}
              </button>
            </li>
          ))}
          {others.length > 8 && <li className="px-1 text-[11px] text-cyan-900/70">+{others.length - 8}</li>}
        </ul>
      )}

      {component.level === 'section' && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] text-cyan-950/70">No site</span>
          {(['header', 'footer'] as const).map((role) => {
            const Icon = role === 'header' ? PanelTop : PanelBottom
            const on = component.role === role
            return (
              <button
                key={role}
                type="button"
                aria-pressed={on}
                onClick={() => setRole(on ? undefined : role)}
                className={cn(actionButton, on ? 'bg-cyan-700 text-white hover:bg-cyan-800' : 'bg-white text-gray-700 ring-1 ring-inset ring-cyan-200 hover:ring-cyan-400')}
                title={on ? 'Deixar de ser' : `Usar como ${ROLE_LABEL[role].toLowerCase()}: páginas novas já vêm com ele`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden /> {role === 'header' ? 'Cabeçalho' : 'Rodapé'}
              </button>
            )
          })}
          {component.role && missingPages.length > 0 && (
            <button type="button" onClick={placeEverywhere} className={cn(actionButton, 'text-cyan-800 hover:bg-cyan-100')} title={`Falta em: ${missingPages.map((p) => p.name).join(', ')}`}>
              Pôr nas {plural(missingPages.length, 'página que falta', 'páginas que faltam')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {connection && kind && (
          <button
            type="button"
            onClick={() => useWordPressUi.getState().openComponentPublish(component.id)}
            className={cn(actionButton, 'bg-white text-gray-800 ring-1 ring-inset ring-cyan-200 hover:ring-cyan-400')}
          >
            <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {linked ? 'Atualizar no site…' : 'Publicar no site…'}
          </button>
        )}
        {!inside && (
          <button type="button" onClick={detach} className={cn(actionButton, 'text-gray-600 hover:bg-white hover:text-gray-900')} title="Este uso vira cópia comum; os outros seguem ligados">
            <Unlink className="h-3.5 w-3.5" aria-hidden /> Separar este
          </button>
        )}
        <button type="button" onClick={dissolve} className={cn(actionButton, 'text-gray-500 hover:bg-white hover:text-red-600')} title="Todos os usos viram cópias comuns">
          <X className="h-3.5 w-3.5" aria-hidden /> Desfazer componente
        </button>
      </div>

      {linked && component.wordpress && (
        <a href={component.wordpress.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-[11px] text-sky-700 hover:underline">
          <Globe className="h-3 w-3 shrink-0" aria-hidden />
          No site: {component.wordpress.title}
        </a>
      )}
    </section>
  )
}

/** Os componentes que aparecem numa seção (ou página): clicar seleciona o uso, para editar ali mesmo. */
export const ComponentsHere: React.FC<{ sectionIds: string[]; title: string; layersOnly?: boolean }> = ({ sectionIds, title, layersOnly }) => {
  const { nodes, components } = useSpaceStore(useShallow((s) => ({ nodes: s.nodes, components: s.components })))
  const uses = useMemo(() => {
    const wanted = new Set(sectionIds)
    const order = new Map(sectionIds.map((id, i) => [id, i]))
    return componentUses(nodes)
      .filter((u) => wanted.has(u.sectionId) && (!layersOnly || !!u.elementId))
      .sort((a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0))
  }, [nodes, sectionIds, layersOnly])
  if (!uses.length) return null
  const nameOf = (id: string): SpaceComponent | undefined => components.find((c) => c.id === id)

  return (
    <section className="space-y-1.5 border-b border-gray-100 px-3 py-3">
      <h3 className="text-[11px] font-semibold text-gray-900">{title}</h3>
      <ul className="-mx-1 flex flex-col">
        {uses.map((use) => (
          <li key={`${use.sectionId}:${use.elementId ?? ''}`}>
            <button
              type="button"
              onClick={() => goToUse(use)}
              className="flex h-7 w-full items-center gap-2 rounded-md px-1 text-left text-[12px] transition-colors hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              title="Selecionar e editar aqui"
            >
              <ComponentIcon className="h-3.5 w-3.5 shrink-0" style={{ color: COMPONENT_COLOR }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium" style={{ color: COMPONENT_COLOR_STRONG }}>
                {nameOf(use.componentId)?.name ?? 'Componente'}
              </span>
              <span className="shrink-0 text-[10px] text-gray-400">{use.elementId ? 'camada' : 'seção'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
