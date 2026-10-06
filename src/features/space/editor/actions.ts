import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { layerKind } from '@/features/space/navigator/navigatorLabels'
import type { EditorDevice, SectionNodeData } from '@/types/space'
import { MOD_KEY } from '@/features/space/pages/clipboard'
import { pageOf, plural } from '@/features/space/pages/pages'
import { elementComponent, identicalSections, newUse } from '@/features/space/components/components'
import { useComponentNaming } from '@/features/space/components/naming'
import { useSpaceUi } from '@/features/space/spaceUi'
import { useBlocks, type SavedBlock } from './blocks'
import { editTextIn } from './frames'
import { copyPins, pinKeys, type PinnedSettings } from './pinned'
import { deviceKey } from './settingsModel'
import {
  cloneWithFreshIds,
  createBlankSection,
  createElement,
  duplicateElement,
  editSection,
  insertElements,
  insertionTarget,
  isContainer,
  isLocked,
  locate,
  moveElement,
  patchSettings,
  removeElement,
  unwrapStack,
  wrapInStack,
  type InsertKind,
  type InsertTarget,
  type SettingsPatch,
} from './tree'

/**
 * Comandos do editor visual sobre as seções do canvas. Cada um grava um passo
 * do desfazer e deixa selecionado o que o usuário espera editar em seguida.
 */

const sectionData = (id: string) => {
  const node = useSpaceStore.getState().nodes.find((n) => n.id === id)
  return node?.type === 'section' ? (node.data as SectionNodeData) : null
}

export function selectElement(sectionId: string, elementId: string | null) {
  const store = useSpaceStore.getState()
  // Texto que ficou selecionado num painel faria o Ctrl+C copiar o texto em vez da camada
  const stray = window.getSelection()
  if (stray && !stray.isCollapsed && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) stray.removeAllRanges()
  if (elementId) store.selectNavigatorElement({ sectionId, elementId })
  else {
    store.selectNavigatorElement(null)
    store.setSelection([sectionId])
  }
}

/** A camada selecionada, com a árvore da seção e o lugar dela. */
export function selectedElement() {
  const selection = useSpaceStore.getState().navigatorSelection
  if (!selection) return null
  const data = sectionData(selection.sectionId)
  const root = data ? parseSectionElements(data.elementorJson) : null
  const location = root ? locate(root, selection.elementId) : null
  return data && root && location ? { ...selection, data, root, location } : null
}

/** Seção que recebe o que for inserido: a da camada selecionada, ou a única seção selecionada. */
function targetSection(): string | null {
  const { navigatorSelection, selectedIds } = useSpaceStore.getState()
  if (navigatorSelection) return navigatorSelection.sectionId
  const last = selectedIds[selectedIds.length - 1]
  return last && sectionData(last) ? last : null
}

interface CommitOptions {
  /** Chave para juntar mudanças seguidas num passo só (arrastar uma alça, digitar). */
  merge?: string
  pinned?: (current: PinnedSettings | undefined) => PinnedSettings | undefined
}

/** Aplica a edição no JSON da seção e grava. */
function commit<T>(sectionId: string, edit: (root: SectionElement[]) => T | false | null | undefined, options: CommitOptions = {}): T | null {
  const data = sectionData(sectionId)
  if (!data) return null
  const result = editSection(data.elementorJson, edit)
  if (!result) return null
  const patch: Partial<SectionNodeData> = { elementorJson: result.json }
  if (options.pinned) {
    const pinned = options.pinned(data.pinned)
    if (pinned !== data.pinned) patch.pinned = pinned
  }
  useSpaceStore.getState().updateNodeData(sectionId, patch, { merge: options.merge ?? false })
  return result.result
}

/** Pins dos elementos da subárvore, para copiar junto. */
function pinsOf(element: SectionElement, pinned: PinnedSettings | undefined): PinnedSettings {
  const out: PinnedSettings = {}
  const visit = (el: SectionElement) => {
    if (el.id && pinned?.[el.id]?.length) out[el.id] = [...pinned[el.id]]
    for (const child of el.elements ?? []) visit(child)
  }
  visit(element)
  return out
}

/** Cópia com ids novos e os pins levados para eles. */
function freshCopy(element: SectionElement, pinned: PinnedSettings) {
  const { element: copy, ids } = cloneWithFreshIds(element)
  const moved: PinnedSettings = {}
  for (const [from, to] of ids) if (pinned[from]) moved[to] = [...pinned[from]]
  return { element: copy, pinned: moved }
}

// ---------------------------------------------------------------------------
// Inserir

/** Põe o elemento na seção, no alvo dado ou a partir da seleção; seleciona o novo. */
export function insertInto(sectionId: string, element: SectionElement, target?: InsertTarget, pins?: PinnedSettings, merge?: string) {
  const selection = useSpaceStore.getState().navigatorSelection
  const selectedId = selection?.sectionId === sectionId ? selection.elementId : null
  const id = commit(
    sectionId,
    (root) => insertElements(root, [element], target ?? insertionTarget(root, selectedId, element)) && element.id,
    { merge, ...(pins && Object.keys(pins).length ? { pinned: (current: PinnedSettings | undefined) => ({ ...current, ...pins }) } : {}) }
  )
  if (id) selectElement(sectionId, id)
  return id
}

/** Seção nova e vazia no fim da página ativa (ou no lugar dado), já com o container dela selecionado. */
export function addBlankSection(options: { pageId?: string; index?: number; with?: SectionElement[] } = {}) {
  const store = useSpaceStore.getState()
  const root = createBlankSection()
  if (options.with) root[0].elements = options.with
  const pageId = store.addSections([{ title: 'Nova seção', elementorJson: JSON.stringify(root) }], { pageId: options.pageId, index: options.index })
  const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
  const sectionId = page ? page.sectionIds[options.index ?? page.sectionIds.length - 1] : null
  if (sectionId) selectElement(sectionId, options.with?.[0]?.id ?? root[0].id ?? null)
  return sectionId
}

/** Elemento novo a partir do painel Inserir ou do atalho: na seleção, ou numa seção nova. */
export function insertKind(kind: InsertKind) {
  const element = createElement(kind)
  const sectionId = targetSection()
  if (sectionId) return insertInto(sectionId, element)
  addBlankSection({ with: [element] })
  return element.id ?? null
}

export function insertBlock(block: SavedBlock, sectionId = targetSection(), target?: InsertTarget) {
  const { element, pinned } = freshCopy(block.element, block.pinned)
  if (sectionId) return insertInto(sectionId, element, target, pinned)
  if (!isContainer(element)) {
    addBlankSection({ with: [element] })
    return element.id ?? null
  }
  // Bloco que já é um container de topo vira a própria seção
  const store = useSpaceStore.getState()
  const pageId = store.addSections([{ title: block.name, elementorJson: JSON.stringify([{ ...element, isInner: false }]), pinned }])
  const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
  const id = page?.sectionIds[page.sectionIds.length - 1]
  if (id) selectElement(id, element.id ?? null)
  return element.id ?? null
}

/**
 * Um uso novo do componente, ligado aos outros. A seção inteira entra na
 * página (logo depois da seção selecionada, ou no fim); a camada entra na
 * seleção, ou numa seção nova. Um componente não entra dentro de um uso dele
 * mesmo (cresceria a cada mudança).
 */
export function insertComponent(
  componentId: string,
  options: { pageId?: string; index?: number; sectionId?: string | null; target?: InsertTarget; select?: boolean } = {}
): string | null {
  const store = useSpaceStore.getState()
  const component = store.components.find((c) => c.id === componentId)
  if (!component) return null
  const select = options.select !== false

  if (component.level === 'section') {
    const selected = targetSection()
    const page =
      (options.pageId && store.pages.find((p) => p.id === options.pageId)) ||
      (selected && pageOf(store.pages, selected)) ||
      store.pages.find((p) => p.id === store.activePageId) ||
      store.pages[0]
    if (!page) return null
    const after = selected ? page.sectionIds.indexOf(selected) : -1
    const id = store.insertComponentSection(componentId, page.id, options.index ?? (after >= 0 ? after + 1 : page.sectionIds.length))
    if (id && select) selectElement(id, null)
    return id
  }

  const { elements, pinned } = newUse(component, store.nodes)
  const element = elements[0]
  if (!element?.id) return null
  const sectionId = options.sectionId === undefined ? targetSection() : options.sectionId
  if (!sectionId) {
    const root = createBlankSection()
    root[0].elements = [element]
    const pageId = store.addSections([{ title: component.name, elementorJson: JSON.stringify(root), ...(Object.keys(pinned).length ? { pinned } : {}) }], {
      pageId: options.pageId,
      index: options.index,
    })
    const page = useSpaceStore.getState().pages.find((p) => p.id === pageId)
    const created = page?.sectionIds[options.index ?? page.sectionIds.length - 1]
    if (created && select) selectElement(created, element.id)
    return element.id
  }
  if (sectionData(sectionId)?.component === componentId) {
    toast.error('O componente não entra dentro dele mesmo.')
    return null
  }
  const selection = useSpaceStore.getState().navigatorSelection
  const selectedId = selection?.sectionId === sectionId ? selection.elementId : null
  let inside = false
  const id = commit(
    sectionId,
    (root) => {
      if (!insertElements(root, [element], options.target ?? insertionTarget(root, selectedId, element))) return false
      inside = !!locate(root, element.id!)?.ancestors.some((a) => elementComponent(a) === componentId)
      return inside ? false : element.id
    },
    Object.keys(pinned).length ? { pinned: (current: PinnedSettings | undefined) => ({ ...current, ...pinned }) } : {}
  )
  if (inside) toast.error('O componente não entra dentro dele mesmo.')
  if (id && select) selectElement(sectionId, id)
  return id
}

/** A seleção vira componente: a camada selecionada, ou a seção. */
export function componentizeSelection(name?: string) {
  const store = useSpaceStore.getState()
  const sel = store.navigatorSelection
  const sectionId = sel?.sectionId ?? targetSection()
  if (!sectionId) return null
  const data = sectionData(sectionId)
  const already = sel ? elementComponent(locate(parseSectionElements(data?.elementorJson ?? '') ?? [], sel.elementId)?.element) : data?.component
  const id = store.createComponent(sectionId, sel?.elementId, name)
  if (!id) {
    toast.error('Não deu para transformar em componente.')
    return null
  }
  if (!already) {
    const created = useSpaceStore.getState().components.find((c) => c.id === id)
    // O painel do componente abre com o nome selecionado, para dar o nome na hora
    if (!name) {
      useSpaceUi.getState().setRight('style')
      useComponentNaming.getState().set(id)
    }
    // A mesma seção repetida em outras páginas (o cabeçalho copiado, por exemplo), mesmo com outros textos: ligar numa ação
    const copies = sel ? [] : identicalSections(useSpaceStore.getState().nodes, sectionId)
    toast.success(`"${created?.name ?? 'Componente'}" virou componente`, {
      description: copies.length
        ? `Há ${plural(copies.length, 'seção com o mesmo desenho', 'seções com o mesmo desenho')} em outras páginas: ligue para o estilo mudar junto (os textos de cada uma ficam).`
        : 'Dê um nome no painel. Duplique, copie e cole ou insira pelo painel Inserir: o estilo muda junto em todos.',
      ...(copies.length
        ? {
            duration: 12000,
            action: {
              label: 'Ligar',
              onClick: () => {
                const linked = useSpaceStore.getState().linkCopies(id, copies)
                if (linked) toast.success(`${plural(linked, 'cópia ligada', 'cópias ligadas')} ao componente`, { description: `${MOD_KEY}Z desfaz.` })
              },
            },
          }
        : {}),
    })
  }
  return id
}

// ---------------------------------------------------------------------------
// Mudar a camada selecionada

const LOCKED_HINT = 'Este item é parte de um widget (acordeão, carrossel) e fica no lugar dele.'

export function deleteSelectedElement() {
  const sel = selectedElement()
  if (!sel) return false
  if (isLocked(sel.location)) {
    toast.message(LOCKED_HINT)
    return false
  }
  const parentId = sel.location.parent?.id ?? null
  const ok = commit(sel.sectionId, (root) => !!removeElement(root, sel.elementId))
  if (ok) selectElement(sel.sectionId, parentId)
  return !!ok
}

export function duplicateSelectedElement() {
  const sel = selectedElement()
  if (!sel) return false
  if (isLocked(sel.location)) {
    toast.message(LOCKED_HINT)
    return false
  }
  let ids: Map<string, string> | undefined
  const id = commit(
    sel.sectionId,
    (root) => {
      const result = duplicateElement(root, sel.elementId)
      ids = result?.ids
      return result?.id
    },
    { pinned: (current) => (ids ? copyPins(current, ids) : current) }
  )
  if (id) selectElement(sel.sectionId, id)
  return !!id
}

export function copySelectedElement(cut = false) {
  const sel = selectedElement()
  if (!sel) return false
  const element = structuredClone(sel.location.element)
  useSpaceStore.getState().setElementClipboard({ elements: [element], pinned: pinsOf(element, sel.data.pinned) })
  if (cut) {
    if (!deleteSelectedElement()) return false
    toast.success(`${layerKind(element)} recortado`, { description: `Cole com ${MOD_KEY}V em outra camada ou seção.` })
  } else toast.success(`${layerKind(element)} copiado`, { description: `Cole com ${MOD_KEY}V em outra camada ou seção.` })
  return true
}

export function pasteElement() {
  const clipboard = useSpaceStore.getState().elementClipboard
  if (!clipboard?.elements.length) return false
  const sectionId = targetSection()
  const copies = clipboard.elements.map((element) => freshCopy(element, clipboard.pinned))
  const [first] = copies
  if (!sectionId) {
    addBlankSection({ with: copies.map((c) => c.element) })
    return true
  }
  return !!insertInto(sectionId, first.element, undefined, first.pinned)
}

export function wrapSelectedElement(direction: 'column' | 'row' = 'column') {
  const sel = selectedElement()
  if (!sel) return false
  if (isLocked(sel.location)) {
    toast.message(LOCKED_HINT)
    return false
  }
  const id = commit(sel.sectionId, (root) => wrapInStack(root, sel.elementId, direction))
  if (id) selectElement(sel.sectionId, id)
  return !!id
}

export function unwrapSelectedElement() {
  const sel = selectedElement()
  if (!sel || !isContainer(sel.location.element)) return false
  const firstChild = sel.location.element.elements?.[0]?.id ?? null
  const ok = commit(sel.sectionId, (root) => unwrapStack(root, sel.elementId))
  if (!ok) {
    toast.message('Os itens deste stack não podem ficar soltos aqui.')
    return false
  }
  selectElement(sel.sectionId, firstChild ?? sel.location.parent?.id ?? null)
  return true
}

/** Sobe (-1) ou desce (1) a camada entre as irmãs. */
export function moveSelectedElement(direction: -1 | 1) {
  const sel = selectedElement()
  if (!sel) return false
  const { index, siblings, parent } = sel.location
  const next = direction < 0 ? index - 1 : index + 2
  if (next < 0 || next > siblings.length) return false
  return !!commit(sel.sectionId, (root) => moveElement(root, sel.elementId, { parentId: parent?.id ?? null, index: next }))
}

export function moveElementTo(sectionId: string, elementId: string, target: InsertTarget) {
  const ok = commit(sectionId, (root) => moveElement(root, elementId, target))
  if (ok) selectElement(sectionId, elementId)
  return !!ok
}

/** Leva a camada para outra seção (arrastar na árvore do Navigator); um passo só no desfazer. */
export function moveElementAcross(fromSectionId: string, elementId: string, toSectionId: string, target: InsertTarget) {
  if (fromSectionId === toSectionId) return moveElementTo(fromSectionId, elementId, target)
  const data = sectionData(fromSectionId)
  const root = data ? parseSectionElements(data.elementorJson) : null
  const location = root ? locate(root, elementId) : null
  if (!data || !location) return false
  if (isLocked(location)) {
    toast.message(LOCKED_HINT)
    return false
  }
  const merge = `across:${elementId}:${Date.now()}`
  const pins = pinsOf(location.element, data.pinned)
  if (!commit(fromSectionId, (tree) => !!removeElement(tree, elementId), { merge })) return false
  return !!insertInto(toSectionId, location.element, target, pins, merge)
}

export function selectParentElement() {
  const sel = selectedElement()
  if (!sel) return false
  selectElement(sel.sectionId, sel.location.parent?.id ?? null)
  return true
}

export function selectFirstChild() {
  const sel = selectedElement()
  const child = sel?.location.element.elements?.[0]
  if (!sel || !child?.id) return false
  selectElement(sel.sectionId, child.id)
  return true
}

export function selectSibling(direction: -1 | 1) {
  const sel = selectedElement()
  const sibling = sel?.location.siblings[sel.location.index + direction]
  if (!sel || !sibling?.id) return false
  selectElement(sel.sectionId, sibling.id)
  return true
}

/** Enter: abre o texto para digitar; em containers, entra no primeiro filho. */
export function enterSelectedElement() {
  const sel = selectedElement()
  if (!sel) return false
  const type = sel.location.element.widgetType
  if (type === 'heading' || type === 'text-editor' || type === 'button') {
    editTextIn(sel.sectionId, sel.elementId)
    return true
  }
  return selectFirstChild()
}

export function saveSelectedAsBlock(name?: string) {
  const sel = selectedElement()
  if (!sel) return false
  const element = structuredClone(sel.location.element)
  const ok = useBlocks.getState().add({ name: name?.trim() || layerKind(element), element, pinned: pinsOf(element, sel.data.pinned) })
  if (ok) toast.success('Salvo em Meus blocos', { description: 'Está no painel Inserir, para usar em qualquer seção.' })
  else toast.error('O navegador não deixou guardar o bloco.')
  return ok
}

// ---------------------------------------------------------------------------
// Settings

interface SettingsOptions {
  device?: EditorDevice
  merge?: string
  /** false: conteúdo (texto, link, imagem), que a marca não troca e não precisa ser fixado. */
  pin?: boolean
}

/** Grava settings no elemento, na variante do tamanho de tela, e fixa as chaves por cima da marca. */
export function updateElementSettings(sectionId: string, elementId: string, patch: SettingsPatch, options: SettingsOptions = {}) {
  const device = options.device ?? useSpaceStore.getState().previewDevice
  const mapped: SettingsPatch = {}
  for (const [key, value] of Object.entries(patch)) mapped[deviceKey(key, device)] = value
  return !!commit(sectionId, (root) => patchSettings(root, elementId, mapped), {
    merge: options.merge,
    pinned: options.pin === false ? undefined : (current) => pinKeys(current, elementId, Object.keys(mapped)),
  })
}
