import React, { useMemo, useRef } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowUpLeft,
  Columns3,
  Copy,
  Group as GroupIcon,
  Package,
  Rows3,
  Trash2,
  Ungroup,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSpaceStore } from '@/store/spaceStore'
import { parseSectionElements, sectionWithTransforms, type SectionElement } from '@/features/space/landingPage'
import { layerKind, layerName } from '@/features/space/navigator/navigatorLabels'
import { useActiveBrand } from '@/features/space/brand/brandStore'
import { readImageFile } from '@/features/space/featured/render'
import type { SectionNodeData } from '@/types/space'
import {
  deleteSelectedElement,
  duplicateSelectedElement,
  saveSelectedAsBlock,
  selectParentElement,
  unwrapSelectedElement,
  updateElementSettings,
  wrapSelectedElement,
} from './actions'
import { AlignGrid, ColorInput, Group, NumberInput, Row, Segmented, Select, SidesInput, TextArea, TextInput, Toggle, type Option } from './controls'
import {
  deviceKey,
  familyOf,
  gapOf,
  gapValue,
  hasOwnValue,
  readSetting,
  sidesOf,
  sidesValue,
  sliderOf,
  sliderValue,
  styleKeys,
  type Sides,
} from './settingsModel'
import { isLocked, locate, settingsOf, type SettingsPatch } from './tree'

/**
 * Propriedades da camada selecionada, como o painel da direita do Framer, mas
 * gravando settings nativas do Elementor. Os valores mostrados já têm a marca
 * aplicada (é o que o canvas mostra); o que muda aqui fica fixo por cima dela.
 * Com Tablet ou Celular na barra do canvas, o ajuste vale só dali para baixo.
 */

const DEVICE_NAME = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Celular' } as const

const FONTS = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Open Sans', 'Lato', 'Nunito', 'DM Sans', 'Manrope', 'Work Sans', 'Raleway', 'Figtree', 'Plus Jakarta Sans', 'Playfair Display', 'Merriweather']
const WEIGHTS: Option<string>[] = ['300', '400', '500', '600', '700', '800', '900'].map((w) => ({ value: w, label: w }))
const HEADING_TAGS: Option<string>[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'].map((t) => ({ value: t, label: t.toUpperCase() }))
const CONTAINER_TAGS: Option<string>[] = ['div', 'section', 'header', 'footer', 'article', 'aside', 'nav', 'main'].map((t) => ({ value: t, label: t }))
const ICONS: Option<string>[] = [
  ['fas fa-star', 'Estrela'],
  ['fas fa-check', 'Check'],
  ['fas fa-arrow-right', 'Seta'],
  ['fas fa-heart', 'Coração'],
  ['fas fa-phone', 'Telefone'],
  ['fas fa-envelope', 'E-mail'],
  ['fas fa-map-marker-alt', 'Local'],
  ['fas fa-clock', 'Relógio'],
  ['fas fa-bolt', 'Raio'],
  ['fab fa-whatsapp', 'WhatsApp'],
  ['fab fa-instagram', 'Instagram'],
].map(([value, label]) => ({ value, label }))

type Shadow = 'none' | 'soft' | 'medium' | 'strong'
const SHADOWS: Record<Exclude<Shadow, 'none'>, Record<string, unknown>> = {
  soft: { horizontal: 0, vertical: 2, blur: 8, spread: -2, color: 'rgba(0,0,0,0.12)' },
  medium: { horizontal: 0, vertical: 8, blur: 24, spread: -6, color: 'rgba(0,0,0,0.16)' },
  strong: { horizontal: 0, vertical: 20, blur: 48, spread: -12, color: 'rgba(0,0,0,0.28)' },
}

const FLEX_ALIGN = ['flex-start', 'center', 'flex-end']
const alignIndex = (value: unknown) =>
  value === 'center' ? 1 : value === 'flex-end' || value === 'end' ? 2 : value === 'flex-start' || value === 'start' ? 0 : null

const num = (value: unknown) => {
  const slider = sliderOf(value)
  const n = slider ? Number(slider.size) : NaN
  return Number.isFinite(n) ? n : null
}

/** Cores hex mais usadas na seção, para a paleta quando não há marca. */
function sectionColors(elements: SectionElement[] | null) {
  const counts = new Map<string, number>()
  const visit = (list: SectionElement[]) => {
    for (const el of list) {
      for (const value of Object.values(settingsOf(el))) {
        if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) counts.set(value.toUpperCase(), (counts.get(value.toUpperCase()) ?? 0) + 1)
      }
      visit(el.elements ?? [])
    }
  }
  visit(elements ?? [])
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex]) => ({ name: 'Da seção', hex }))
}

function sectionFonts(elements: SectionElement[] | null) {
  const fonts = new Set<string>()
  const visit = (list: SectionElement[]) => {
    for (const el of list) {
      const family = settingsOf(el).typography_font_family
      if (typeof family === 'string' && family) fonts.add(family)
      visit(el.elements ?? [])
    }
  }
  visit(elements ?? [])
  return [...fonts]
}

const iconButton =
  'flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-[color,background-color,transform] hover:bg-gray-100 hover:text-gray-900 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'

interface PropertiesPanelProps {
  sectionId: string
  elementId: string
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ sectionId, elementId }) => {
  const data = useSpaceStore((s) => {
    const node = s.nodes.find((n) => n.id === sectionId)
    return node?.type === 'section' ? (node.data as SectionNodeData) : undefined
  })
  const device = useSpaceStore((s) => s.previewDevice)
  const brand = useActiveBrand()
  const fileRef = useRef<HTMLInputElement>(null)

  const base = useMemo(() => (data ? parseSectionElements(data.elementorJson) : null), [data])
  const location = useMemo(() => (base ? locate(base, elementId) : null), [base, elementId])
  // O que o canvas mostra: com texto, paleta e marca aplicados, e os ajustes fixados por cima
  const effective = useMemo(() => {
    const { nodes, connections } = useSpaceStore.getState()
    const node = nodes.find((n) => n.id === sectionId)
    const root = node && data ? sectionWithTransforms(node, nodes, connections, brand) : null
    return root ? locate(root, elementId)?.element ?? null : null
  }, [sectionId, elementId, data, brand])
  const swatches = useMemo(() => (brand?.colors.length ? brand.colors.map((c) => ({ name: c.name, hex: c.hex })) : sectionColors(base)), [brand, base])
  const fontOptions = useMemo(() => {
    const brandFonts = brand ? [brand.fonts.heading?.family, brand.fonts.body?.family, brand.fonts.label?.family].filter(Boolean) as string[] : []
    return [...new Set([...brandFonts, ...sectionFonts(base), ...FONTS])].map((f) => ({ value: f, label: brandFonts.includes(f) ? `${f} (marca)` : f }))
  }, [brand, base])

  if (!data || !location) return null
  const element = location.element
  const shown = effective ?? element
  const family = familyOf(element)
  const type = element.widgetType ?? ''
  const keys = styleKeys(element)
  const locked = isLocked(location)
  const parent = location.parent
  const branded = !!brand && !data.origin

  // Leitura: o valor que vale nesta tela; `own` diz se a tela tem valor próprio
  const read = (key: string) => readSetting(shown, key, device)
  const readOwn = (key: string) => settingsOf(shown)[deviceKey(key, device)]
  const own = (key: string) => hasOwnValue(element, key, device)
  const str = (key: string) => {
    const v = read(key)
    return typeof v === 'string' ? v : ''
  }
  const color = (key: string) => {
    const v = settingsOf(shown)[key]
    return typeof v === 'string' ? v : ''
  }

  const set = (patch: SettingsPatch) => updateElementSettings(sectionId, elementId, patch, { device, merge: `panel:${elementId}:${Object.keys(patch).join(',')}:${device}` })
  const setContent = (patch: SettingsPatch) =>
    updateElementSettings(sectionId, elementId, patch, { device: 'desktop', pin: false, merge: `content:${elementId}:${Object.keys(patch).join(',')}` })
  const reset = (...names: string[]) => set(Object.fromEntries(names.map((k) => [k, undefined])))

  /** Número de um slider: valor desta tela e o herdado como dica. */
  const sliderField = (key: string, defaultUnit = 'px') => {
    const ownValue = num(readOwn(key))
    const inherited = num(read(key))
    const unit = sliderOf(read(key))?.unit ?? defaultUnit
    return {
      value: ownValue,
      placeholder: inherited === null ? '' : String(inherited),
      unit: unit === 'custom' ? '' : unit,
      change: (n: number | null) => set({ [key]: n === null ? undefined : sliderValue(n, unit === 'custom' ? defaultUnit : unit) }),
      scrub: (delta: number) => set({ [key]: sliderValue(Math.max(0, (num(read(key)) ?? 0) + delta), unit === 'custom' ? defaultUnit : unit) }),
    }
  }

  const sidesField = (key: string) => {
    const ownValue = sidesOf(readOwn(key))
    const inherited = sidesOf(read(key))
    return {
      value: ownValue?.sides ?? null,
      placeholder: inherited?.sides ?? null,
      change: (sides: Sides | null) => set({ [key]: sides ? sidesValue(sides, ownValue?.unit ?? inherited?.unit ?? 'px') : undefined }),
    }
  }

  const typography = (patch: SettingsPatch) => set({ typography_typography: 'custom', ...patch })

  // Cabeçalho ------------------------------------------------------------------
  const name = data.navigatorLabels?.[elementId] ?? ''
  const rename = (value: string) => {
    const labels = { ...data.navigatorLabels }
    if (value.trim()) labels[elementId] = value
    else delete labels[elementId]
    useSpaceStore.getState().updateNodeData(sectionId, { navigatorLabels: labels })
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    try {
      const url = await readImageFile(file)
      const image = settingsOf(element).image as Record<string, unknown> | undefined
      setContent({ image: { ...image, url, id: '', alt: (image?.alt as string) || file.name.replace(/\.[^.]+$/, '') } })
      toast.success('Imagem adicionada', { description: 'Ela vai para a mídia do WordPress ao publicar.' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a imagem.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const link = (settingsOf(element).link ?? {}) as Record<string, unknown>
  const image = (settingsOf(element).image ?? {}) as Record<string, unknown>

  // Layout (containers) -----------------------------------------------------------
  const isContainerLayout = family === 'container'
  const grid = isContainerLayout && str('container_type') === 'grid'
  const direction = str('flex_direction') || 'column'
  const isRow = direction.startsWith('row')
  const main = alignIndex(read('flex_justify_content'))
  const cross = alignIndex(read('flex_align_items'))
  const justify = str('flex_justify_content')
  const boxed = (str('content_width') || 'boxed') === 'boxed'

  // Tamanho como filho ------------------------------------------------------------
  const widgetWidth = str('_element_width')
  const grows = str('_flex_size') === 'grow'
  const containerWidth = sliderOf(read('width'))
  const widthMode =
    family === 'widget'
      ? widgetWidth === 'initial'
        ? 'fixed'
        : widgetWidth === 'auto'
          ? 'fit'
          : grows || widgetWidth === 'inherit'
            ? 'fill'
            : 'default'
      : grows
        ? 'fill'
        : containerWidth
          ? containerWidth.unit === 'custom'
            ? 'fit'
            : 'fixed'
          : 'default'

  const setWidthMode = (mode: string) => {
    if (family === 'widget') {
      if (mode === 'default') set({ _element_width: undefined, _flex_size: undefined, _element_custom_width: undefined })
      if (mode === 'fill') set({ _element_width: 'inherit', _flex_size: 'grow', _element_custom_width: undefined })
      if (mode === 'fit') set({ _element_width: 'auto', _flex_size: 'none', _element_custom_width: undefined })
      if (mode === 'fixed') set({ _element_width: 'initial', _flex_size: 'none', _element_custom_width: sliderValue(num(read('_element_custom_width')) ?? 320) })
    } else {
      if (mode === 'default') set({ width: undefined, _flex_size: undefined })
      if (mode === 'fill') set({ width: undefined, _flex_size: 'grow' })
      if (mode === 'fit') set({ content_width: 'full', width: { unit: 'custom', size: 'fit-content', sizes: [] }, _flex_size: 'none' })
      if (mode === 'fixed') set({ content_width: 'full', width: sliderValue(containerWidth?.unit === 'custom' ? 320 : num(read('width')) ?? 320), _flex_size: 'none' })
    }
  }

  // Aparência --------------------------------------------------------------------
  const bg = keys.background
  const bgType = bg ? str(`${bg}_background`) : ''
  const bgColor = bg ? (bgType === 'classic' ? color(`${bg}_color`) : '') : keys.buttonBackground ? color(keys.buttonBackground) : ''
  const setBackground = (hex: string | null) => {
    if (bg) set(hex ? { [`${bg}_background`]: 'classic', [`${bg}_color`]: hex } : { [`${bg}_background`]: undefined, [`${bg}_color`]: undefined })
    else if (keys.buttonBackground) set({ [keys.buttonBackground]: hex ?? undefined })
  }
  const borderStyle = str(`${keys.border}_border`)
  const radius = sidesOf(read(keys.radius))?.sides[0] ?? null
  const radiusOwn = sidesOf(readOwn(keys.radius))?.sides[0] ?? null
  const shadowOn = str(`${keys.shadow}_box_shadow_type`) === 'yes'
  const shadowValue = settingsOf(shown)[`${keys.shadow}_box_shadow`] as Record<string, unknown> | undefined
  const shadow: Shadow | '' = !shadowOn
    ? 'none'
    : ((Object.entries(SHADOWS).find(([, preset]) => preset.blur === shadowValue?.blur && preset.vertical === shadowValue?.vertical)?.[0] as Shadow | undefined) ?? '')

  const typographyAvailable = !!keys.typography
  const textColorKey = keys.textColor

  const hide = (key: 'hide_desktop' | 'hide_tablet' | 'hide_mobile', value: string) => ({
    checked: settingsOf(element)[key] === value,
    change: (on: boolean) => set({ [key]: on ? value : undefined }),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-2 border-b border-gray-100 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            value={name}
            placeholder={layerName(element, { sectionTitle: data.title, depth: location.ancestors.length, index: location.index, siblings: location.siblings, parent: parent ?? undefined })}
            onChange={(e) => rename(e.target.value)}
            aria-label="Nome da camada"
            className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-xs font-semibold text-gray-900 outline-none transition-colors placeholder:text-gray-900 hover:border-gray-200 focus:border-violet-400 focus:bg-white"
          />
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{layerKind(element)}</span>
        </div>
        <div className="flex items-center gap-0.5" role="toolbar" aria-label="Ações da camada">
          <button type="button" className={iconButton} onClick={selectParentElement} disabled={!parent} title="Selecionar o pai (Esc)" aria-label="Selecionar o pai">
            <ArrowUpLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconButton} onClick={duplicateSelectedElement} disabled={locked} title="Duplicar (Ctrl+D)" aria-label="Duplicar">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconButton} onClick={() => wrapSelectedElement()} disabled={locked} title="Agrupar num stack (Ctrl+G)" aria-label="Agrupar num stack">
            <GroupIcon className="h-3.5 w-3.5" />
          </button>
          {family === 'container' && (
            <button type="button" className={iconButton} onClick={unwrapSelectedElement} disabled={locked} title="Desagrupar (Ctrl+Shift+G)" aria-label="Desagrupar">
              <Ungroup className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className={iconButton} onClick={() => saveSelectedAsBlock(name)} title="Salvar como bloco, para reusar pelo painel Inserir" aria-label="Salvar como bloco">
            <Package className="h-3.5 w-3.5" />
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
            onClick={deleteSelectedElement}
            disabled={locked}
            title="Apagar (Delete)"
            aria-label="Apagar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {device !== 'desktop' && (
          <p className="rounded-md bg-violet-50 px-2 py-1.5 text-[10.5px] leading-snug text-violet-800">
            Ajustando para <strong className="font-semibold">{DEVICE_NAME[device]}</strong>: vale desta tela para baixo. O ponto roxo marca o que mudou aqui.
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {family === 'widget' && (
          <Group title="Conteúdo">
            {type === 'heading' && (
              <>
                <TextArea label="Texto" value={String(settingsOf(element).title ?? '')} onChange={(v) => setContent({ title: v })} rows={2} />
                <Row label="Tag">
                  <Select label="Tag do título" value={str('header_size') || 'h2'} options={HEADING_TAGS} onChange={(v) => setContent({ header_size: v || undefined })} />
                </Row>
                <Row label="Link">
                  <TextInput label="Link do título" value={String(link.url ?? '')} placeholder="https://" onChange={(v) => setContent({ link: { ...link, url: v } })} />
                </Row>
              </>
            )}
            {type === 'text-editor' && (
              <TextArea label="Texto (aceita HTML)" value={String(settingsOf(element).editor ?? '')} onChange={(v) => setContent({ editor: v })} rows={5} />
            )}
            {type === 'button' && (
              <>
                <Row label="Texto">
                  <TextInput label="Texto do botão" value={String(settingsOf(element).text ?? '')} onChange={(v) => setContent({ text: v })} />
                </Row>
                <Row label="Link">
                  <TextInput label="Link do botão" value={String(link.url ?? '')} placeholder="https:// ou #contato" onChange={(v) => setContent({ link: { ...link, url: v } })} />
                </Row>
                <Row label="Nova aba">
                  <Toggle label="Abrir em nova aba" checked={link.is_external === 'on'} onChange={(on) => setContent({ link: { ...link, is_external: on ? 'on' : '' } })} />
                </Row>
              </>
            )}
            {type === 'image' && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-3 text-[11px] font-semibold text-white transition-[background-color,transform] hover:bg-violet-700 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Escolher imagem
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
                <Row label="Endereço">
                  <TextInput label="Endereço da imagem" value={String(image.url ?? '').startsWith('data:') ? 'Imagem do computador' : String(image.url ?? '')} placeholder="https://" onChange={(v) => setContent({ image: { ...image, url: v, id: '' } })} />
                </Row>
                <Row label="Texto alt">
                  <TextInput label="Texto alternativo" value={String(image.alt ?? '')} placeholder="O que a imagem mostra" onChange={(v) => setContent({ image: { ...image, alt: v } })} />
                </Row>
                <Row label="Link">
                  <TextInput
                    label="Link da imagem"
                    value={settingsOf(element).link_to === 'custom' ? String(link.url ?? '') : ''}
                    placeholder="Sem link"
                    onChange={(v) => setContent(v ? { link_to: 'custom', link: { ...link, url: v } } : { link_to: undefined })}
                  />
                </Row>
              </>
            )}
            {type === 'icon' && (
              <Row label="Ícone">
                <Select
                  label="Ícone"
                  value={String((settingsOf(element).selected_icon as Record<string, unknown> | undefined)?.value ?? '')}
                  options={ICONS}
                  placeholder="Outro"
                  onChange={(v) => v && setContent({ selected_icon: { value: v, library: v.startsWith('fab') ? 'fa-brands' : 'fa-solid' } })}
                />
              </Row>
            )}
            {type === 'video' && (
              <Row label="YouTube">
                <TextInput label="Endereço do vídeo" value={String(settingsOf(element).youtube_url ?? '')} placeholder="https://youtube.com/watch?v=" onChange={(v) => setContent({ youtube_url: v })} />
              </Row>
            )}
            {type === 'html' && (
              <TextArea label="HTML, CSS e script" mono rows={10} value={String(settingsOf(element).html ?? '')} onChange={(v) => setContent({ html: v })} />
            )}
            {type === 'divider' && (
              <Row label="Estilo">
                <Select
                  label="Estilo da linha"
                  value={str('style') || 'solid'}
                  options={[
                    { value: 'solid', label: 'Contínua' },
                    { value: 'dashed', label: 'Tracejada' },
                    { value: 'dotted', label: 'Pontilhada' },
                    { value: 'double', label: 'Dupla' },
                  ]}
                  onChange={(v) => set({ style: v || undefined })}
                />
              </Row>
            )}
            {!['heading', 'text-editor', 'button', 'image', 'icon', 'video', 'html', 'divider', 'spacer'].includes(type) && (
              <p className="text-[10.5px] leading-relaxed text-gray-400">O conteúdo deste widget se ajusta no Elementor; aqui ficam tamanho, espaço e aparência.</p>
            )}
          </Group>
        )}

        {isContainerLayout && (
          <Group title="Layout">
            <Row label="Tipo">
              <Segmented
                label="Tipo de layout"
                value={grid ? 'grid' : 'flex'}
                options={[
                  { value: 'flex', label: 'Stack' },
                  { value: 'grid', label: 'Grid' },
                ]}
                onChange={(v) => set({ container_type: v === 'grid' ? 'grid' : undefined, ...(v === 'grid' && !read('grid_columns_grid') ? { grid_columns_grid: sliderValue(2, 'fr') } : {}) })}
              />
            </Row>
            {!grid && (
              <>
                <Row label="Direção" own={own('flex_direction')} onReset={() => reset('flex_direction')}>
                  <Segmented
                    label="Direção"
                    value={isRow ? 'row' : 'column'}
                    options={[
                      { value: 'column', label: 'Coluna', icon: Rows3 },
                      { value: 'row', label: 'Linha', icon: Columns3 },
                    ]}
                    onChange={(v) => set({ flex_direction: v })}
                  />
                </Row>
                <Row label="Alinhar" own={own('flex_justify_content') || own('flex_align_items')} onReset={() => reset('flex_justify_content', 'flex_align_items')}>
                  <AlignGrid
                    label="Alinhamento dos itens"
                    value={isRow ? { row: cross, col: justify.startsWith('space') ? null : main } : { row: justify.startsWith('space') ? null : main, col: cross }}
                    onChange={(row, col) =>
                      set(isRow ? { flex_justify_content: FLEX_ALIGN[col], flex_align_items: FLEX_ALIGN[row] } : { flex_justify_content: FLEX_ALIGN[row], flex_align_items: FLEX_ALIGN[col] })
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Select
                      label="Distribuir"
                      value={justify.startsWith('space') ? justify : ''}
                      placeholder="Juntos"
                      options={[
                        { value: 'space-between', label: 'Nas pontas' },
                        { value: 'space-around', label: 'Ao redor' },
                        { value: 'space-evenly', label: 'Iguais' },
                      ]}
                      onChange={(v) => set({ flex_justify_content: v || FLEX_ALIGN[main ?? 0] })}
                    />
                    <label className="flex items-center justify-between gap-2 text-[10.5px] text-gray-500">
                      Quebrar linha
                      <Toggle label="Quebrar linha" checked={str('flex_wrap') === 'wrap'} onChange={(on) => set({ flex_wrap: on ? 'wrap' : 'nowrap' })} />
                    </label>
                  </div>
                </Row>
                {(() => {
                  const gap = gapOf(readOwn('flex_gap'))
                  const inherited = gapOf(read('flex_gap'))
                  return (
                    <Row label="Gap" own={own('flex_gap')} onReset={() => reset('flex_gap')} onScrub={(d) => set({ flex_gap: gapValue(Math.max(0, (inherited ?? 20) + d)) })}>
                      <NumberInput label="Espaço entre os itens" value={gap} placeholder={inherited === null ? '20' : String(inherited)} unit="px" min={0} onChange={(n) => set({ flex_gap: n === null ? undefined : gapValue(n) })} />
                    </Row>
                  )
                })()}
              </>
            )}
            {grid && (
              <>
                {(['grid_columns_grid', 'grid_rows_grid'] as const).map((key) => {
                  const field = sliderField(key, 'fr')
                  return (
                    <Row key={key} label={key === 'grid_columns_grid' ? 'Colunas' : 'Linhas'} own={own(key)} onReset={() => reset(key)} onScrub={(d) => set({ [key]: sliderValue(Math.max(1, (num(read(key)) ?? 1) + d), 'fr') })}>
                      <NumberInput label={key === 'grid_columns_grid' ? 'Colunas' : 'Linhas'} value={field.value} placeholder={field.placeholder || (key === 'grid_columns_grid' ? '3' : '2')} min={1} max={12} onChange={(n) => set({ [key]: n === null ? undefined : sliderValue(n, 'fr') })} />
                    </Row>
                  )
                })}
                {(() => {
                  const gap = gapOf(readOwn('grid_gaps'))
                  const inherited = gapOf(read('grid_gaps'))
                  return (
                    <Row label="Gap" own={own('grid_gaps')} onReset={() => reset('grid_gaps')} onScrub={(d) => set({ grid_gaps: gapValue(Math.max(0, (inherited ?? 20) + d)) })}>
                      <NumberInput label="Espaço entre os itens" value={gap} placeholder={inherited === null ? '20' : String(inherited)} unit="px" min={0} onChange={(n) => set({ grid_gaps: n === null ? undefined : gapValue(n) })} />
                    </Row>
                  )
                })()}
              </>
            )}
            {(() => {
              const field = sidesField('padding')
              return (
                <Row label="Padding" own={own('padding')} onReset={() => reset('padding')}>
                  <SidesInput label="Padding" value={field.value} placeholder={field.placeholder} onChange={field.change} />
                </Row>
              )
            })()}
            <Row label="Conteúdo" hint="Contido: o conteúdo fica na largura máxima, centralizado. Total: ocupa a largura toda.">
              <Segmented
                label="Largura do conteúdo"
                value={boxed ? 'boxed' : 'full'}
                options={[
                  { value: 'boxed', label: 'Contido' },
                  { value: 'full', label: 'Total' },
                ]}
                onChange={(v) => set({ content_width: v })}
              />
            </Row>
            {boxed &&
              (() => {
                const field = sliderField('boxed_width')
                return (
                  <Row label="Largura máx." own={own('boxed_width')} onReset={() => reset('boxed_width')} onScrub={field.scrub}>
                    <NumberInput label="Largura máxima do conteúdo" value={field.value} placeholder={field.placeholder || '1140'} unit={field.unit} min={0} onChange={field.change} />
                  </Row>
                )
              })()}
            {(() => {
              const field = sliderField('min_height')
              return (
                <Row label="Altura mín." own={own('min_height')} onReset={() => reset('min_height')} onScrub={field.scrub}>
                  <NumberInput label="Altura mínima" value={field.value} placeholder={field.placeholder || 'Auto'} unit={field.unit} min={0} onChange={field.change} />
                </Row>
              )
            })()}
            <Row label="Recorte">
              <Segmented
                label="Recortar o que passa da borda"
                value={str('overflow') === 'hidden' ? 'hidden' : 'visible'}
                options={[
                  { value: 'visible', label: 'Visível' },
                  { value: 'hidden', label: 'Recortar' },
                ]}
                onChange={(v) => set({ overflow: v === 'hidden' ? 'hidden' : undefined })}
              />
            </Row>
            <Row label="Tag HTML">
              <Select label="Tag HTML do container" value={str('html_tag') || 'div'} options={CONTAINER_TAGS} onChange={(v) => set({ html_tag: v && v !== 'div' ? v : undefined })} />
            </Row>
          </Group>
        )}

        {parent && (family === 'widget' || family === 'container') && (
          <Group title="Tamanho e posição">
            <Row label="Largura" own={own('_element_width') || own('_flex_size') || own('width')} onReset={() => reset('_element_width', '_flex_size', '_element_custom_width', 'width')}>
              <Segmented
                label="Largura"
                value={widthMode}
                options={[
                  { value: 'default', label: 'Padrão' },
                  { value: 'fill', label: 'Encher' },
                  { value: 'fit', label: 'Ajustar' },
                  { value: 'fixed', label: 'Fixa' },
                ]}
                onChange={setWidthMode}
              />
            </Row>
            {widthMode === 'fixed' &&
              (() => {
                const field = sliderField(family === 'widget' ? '_element_custom_width' : 'width')
                return (
                  <Row label="" onScrub={field.scrub}>
                    <NumberInput label="Largura fixa" value={field.value ?? num(read(family === 'widget' ? '_element_custom_width' : 'width'))} placeholder={field.placeholder} unit={field.unit} min={0} onChange={field.change} />
                  </Row>
                )
              })()}
            {parent.elType === 'container' && (
              <Row label="Alinhar-se" own={own('_flex_align_self')} onReset={() => reset('_flex_align_self')}>
                <Segmented
                  label="Alinhar-se no stack"
                  value={str('_flex_align_self')}
                  options={[
                    { value: 'flex-start', label: 'Início' },
                    { value: 'center', label: 'Centro' },
                    { value: 'flex-end', label: 'Fim' },
                    { value: 'stretch', label: 'Esticar' },
                  ]}
                  onChange={(v) => set({ _flex_align_self: str('_flex_align_self') === v ? undefined : v })}
                />
              </Row>
            )}
            {type === 'image' &&
              (() => {
                const field = sliderField('height')
                return (
                  <>
                    <Row label="Altura" own={own('height')} onReset={() => reset('height')} onScrub={field.scrub}>
                      <NumberInput label="Altura da imagem" value={field.value} placeholder={field.placeholder || 'Auto'} unit={field.unit} min={0} onChange={field.change} />
                    </Row>
                    <Row label="Encaixe" own={own('object-fit')} onReset={() => reset('object-fit')}>
                      <Segmented
                        label="Encaixe da imagem"
                        value={str('object-fit')}
                        options={[
                          { value: 'cover', label: 'Cobrir' },
                          { value: 'contain', label: 'Caber' },
                          { value: 'fill', label: 'Esticar' },
                        ]}
                        onChange={(v) => set({ 'object-fit': v })}
                      />
                    </Row>
                  </>
                )
              })()}
            {type === 'spacer' &&
              (() => {
                const field = sliderField('space')
                return (
                  <Row label="Altura" own={own('space')} onReset={() => reset('space')} onScrub={field.scrub}>
                    <NumberInput label="Altura do espaço" value={field.value} placeholder={field.placeholder || '50'} unit={field.unit} min={0} onChange={field.change} />
                  </Row>
                )
              })()}
            {(() => {
              const field = sidesField(keys.margin)
              return (
                <Row label="Margem" own={own(keys.margin)} onReset={() => reset(keys.margin)}>
                  <SidesInput label="Margem" value={field.value} placeholder={field.placeholder} onChange={field.change} />
                </Row>
              )
            })()}
            {family === 'widget' &&
              (() => {
                const field = sidesField('_padding')
                return (
                  <Row label="Padding" own={own('_padding')} onReset={() => reset('_padding')}>
                    <SidesInput label="Padding" value={field.value} placeholder={field.placeholder} onChange={field.change} />
                  </Row>
                )
              })()}
            <Row label="Posição">
              <Segmented
                label="Posição"
                value={str(keys.position) === 'absolute' ? 'absolute' : 'static'}
                options={[
                  { value: 'static', label: 'No fluxo' },
                  { value: 'absolute', label: 'Solta' },
                ]}
                onChange={(v) => set({ [keys.position]: v === 'absolute' ? 'absolute' : undefined })}
              />
            </Row>
            {str(keys.position) === 'absolute' &&
              (['_offset_x', '_offset_y'] as const).map((key) => {
                const field = sliderField(key)
                return (
                  <Row key={key} label={key === '_offset_x' ? 'X' : 'Y'} own={own(key)} onReset={() => reset(key)} onScrub={field.scrub}>
                    <NumberInput label={key === '_offset_x' ? 'Distância da esquerda' : 'Distância do topo'} value={field.value} placeholder={field.placeholder || '0'} unit={field.unit} onChange={field.change} />
                  </Row>
                )
              })}
          </Group>
        )}

        {typographyAvailable && (
          <Group title="Texto">
            <Row label="Fonte">
              <Select label="Fonte" value={str('typography_font_family')} placeholder="Do tema" options={fontOptions} onChange={(v) => typography({ typography_font_family: v || undefined })} />
            </Row>
            <Row label="Peso">
              <Select label="Peso da fonte" value={String(read('typography_font_weight') ?? '')} placeholder="Padrão" options={WEIGHTS} onChange={(v) => typography({ typography_font_weight: v || undefined })} />
            </Row>
            {(
              [
                ['typography_font_size', 'Tamanho', 'px'],
                ['typography_line_height', 'Entrelinha', 'em'],
                ['typography_letter_spacing', 'Espaçamento', 'px'],
              ] as const
            ).map(([key, label, unit]) => {
              const field = sliderField(key, unit)
              return (
                <Row key={key} label={label} own={own(key)} onReset={() => reset(key)} onScrub={(d) => typography({ [key]: sliderValue(Math.max(key === 'typography_letter_spacing' ? -20 : 0, (num(read(key)) ?? (key === 'typography_font_size' ? 16 : 1)) + (unit === 'em' ? d / 20 : d)), field.unit || unit) })}>
                  <NumberInput
                    label={label}
                    value={field.value}
                    placeholder={field.placeholder || 'Padrão'}
                    unit={field.unit || unit}
                    step={unit === 'em' ? 0.05 : key === 'typography_letter_spacing' ? 0.1 : 1}
                    min={key === 'typography_letter_spacing' ? -20 : 0}
                    onChange={(n) => typography({ [key]: n === null ? undefined : sliderValue(n, field.unit || unit) })}
                  />
                </Row>
              )
            })}
            <Row label="Caixa">
              <Segmented
                label="Caixa do texto"
                value={str('typography_text_transform') || 'none'}
                options={[
                  { value: 'none', label: 'Aa' },
                  { value: 'uppercase', label: 'AA' },
                  { value: 'lowercase', label: 'aa' },
                  { value: 'capitalize', label: 'Aa Aa' },
                ]}
                onChange={(v) => typography({ typography_text_transform: v === 'none' ? undefined : v })}
              />
            </Row>
            <Row label="Alinhar" own={own('align')} onReset={() => reset('align')}>
              <Segmented
                label="Alinhamento do texto"
                value={str('align')}
                options={[
                  { value: 'left', label: 'Esquerda', icon: AlignLeft },
                  { value: 'center', label: 'Centro', icon: AlignCenter },
                  { value: 'right', label: 'Direita', icon: AlignRight },
                  { value: 'justify', label: 'Justificado', icon: AlignJustify },
                ]}
                onChange={(v) => set({ align: v })}
              />
            </Row>
            {textColorKey && (
              <Row label="Cor">
                <ColorInput label="Cor do texto" value={color(textColorKey)} swatches={swatches} onChange={(hex) => set({ [textColorKey]: hex ?? undefined })} />
              </Row>
            )}
          </Group>
        )}

        {(type === 'icon' || type === 'divider') && textColorKey && (
          <Group title="Cor">
            <Row label="Cor">
              <ColorInput label="Cor" value={color(textColorKey)} swatches={swatches} onChange={(hex) => set({ [textColorKey]: hex ?? undefined })} />
            </Row>
            {type === 'icon' &&
              (() => {
                const field = sliderField('size')
                return (
                  <Row label="Tamanho" own={own('size')} onReset={() => reset('size')} onScrub={field.scrub}>
                    <NumberInput label="Tamanho do ícone" value={field.value} placeholder={field.placeholder || '50'} unit={field.unit} min={0} onChange={field.change} />
                  </Row>
                )
              })()}
          </Group>
        )}

        {family !== 'section' && (
          <Group title="Aparência">
            {(bg || keys.buttonBackground) && (
              <Row label="Fundo">
                {bgType === 'gradient' ? (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[10.5px] text-gray-500">
                    Degradê
                    <button type="button" className="rounded px-1.5 py-0.5 text-violet-700 hover:bg-violet-50" onClick={() => setBackground(swatches[0]?.hex ?? '#FFFFFF')}>
                      Trocar por cor
                    </button>
                  </span>
                ) : (
                  <ColorInput label="Cor de fundo" value={bgColor} swatches={swatches} onChange={setBackground} />
                )}
              </Row>
            )}
            <Row label="Borda">
              <Select
                label="Estilo da borda"
                value={borderStyle && borderStyle !== 'none' ? borderStyle : ''}
                placeholder="Nenhuma"
                options={[
                  { value: 'solid', label: 'Contínua' },
                  { value: 'dashed', label: 'Tracejada' },
                  { value: 'dotted', label: 'Pontilhada' },
                ]}
                onChange={(v) =>
                  set(
                    v
                      ? { [`${keys.border}_border`]: v, ...(sidesOf(read(`${keys.border}_width`)) ? {} : { [`${keys.border}_width`]: sidesValue([1, 1, 1, 1]) }) }
                      : { [`${keys.border}_border`]: undefined, [`${keys.border}_width`]: undefined, [`${keys.border}_color`]: undefined }
                  )
                }
              />
            </Row>
            {borderStyle && borderStyle !== 'none' && (
              <>
                <Row label="Espessura" own={own(`${keys.border}_width`)} onReset={() => reset(`${keys.border}_width`)}>
                  <NumberInput
                    label="Espessura da borda"
                    value={sidesOf(readOwn(`${keys.border}_width`))?.sides[0] ?? null}
                    placeholder={String(sidesOf(read(`${keys.border}_width`))?.sides[0] ?? 1)}
                    unit="px"
                    min={0}
                    onChange={(n) => set({ [`${keys.border}_width`]: n === null ? undefined : sidesValue([n, n, n, n]) })}
                  />
                </Row>
                <Row label="Cor da borda">
                  <ColorInput label="Cor da borda" value={color(`${keys.border}_color`)} swatches={swatches} onChange={(hex) => set({ [`${keys.border}_color`]: hex ?? undefined })} />
                </Row>
              </>
            )}
            <Row label="Cantos" own={own(keys.radius)} onReset={() => reset(keys.radius)} onScrub={(d) => set({ [keys.radius]: sidesValue(Array(4).fill(Math.max(0, (radius ?? 0) + d)) as Sides) })}>
              <NumberInput
                label="Raio dos cantos"
                value={radiusOwn}
                placeholder={radius === null ? '0' : String(radius)}
                unit="px"
                min={0}
                onChange={(n) => set({ [keys.radius]: n === null ? undefined : sidesValue([n, n, n, n]) })}
              />
            </Row>
            <Row label="Sombra">
              <Segmented
                label="Sombra"
                value={shadow}
                options={[
                  { value: 'none', label: 'Nenhuma' },
                  { value: 'soft', label: 'Suave' },
                  { value: 'medium', label: 'Média' },
                  { value: 'strong', label: 'Forte' },
                ]}
                onChange={(v) =>
                  set(
                    v === 'none'
                      ? { [`${keys.shadow}_box_shadow_type`]: undefined, [`${keys.shadow}_box_shadow`]: undefined }
                      : { [`${keys.shadow}_box_shadow_type`]: 'yes', [`${keys.shadow}_box_shadow`]: SHADOWS[v] }
                  )
                }
              />
            </Row>
          </Group>
        )}

        {(keys.hoverColor || keys.hoverBackground || family === 'container') && (
          <Group title="Ao passar o mouse" defaultOpen={false}>
            {keys.hoverColor && (
              <Row label="Texto">
                <ColorInput label="Cor do texto ao passar o mouse" value={color(keys.hoverColor)} swatches={swatches} onChange={(hex) => set({ [keys.hoverColor!]: hex ?? undefined })} />
              </Row>
            )}
            {keys.hoverBackground && (
              <Row label="Fundo">
                <ColorInput label="Fundo ao passar o mouse" value={color(keys.hoverBackground)} swatches={swatches} onChange={(hex) => set({ [keys.hoverBackground!]: hex ?? undefined })} />
              </Row>
            )}
            {family === 'container' && (
              <Row label="Fundo">
                <ColorInput
                  label="Fundo ao passar o mouse"
                  value={str('background_hover_background') === 'classic' ? color('background_hover_color') : ''}
                  swatches={swatches}
                  onChange={(hex) => set(hex ? { background_hover_background: 'classic', background_hover_color: hex } : { background_hover_background: undefined, background_hover_color: undefined })}
                />
              </Row>
            )}
            <p className="text-[10px] leading-relaxed text-gray-400">Passe o mouse no canvas para ver.</p>
          </Group>
        )}

        <Group title="Avançado" defaultOpen={false}>
          <Row label="ID">
            <TextInput label="ID do elemento" mono value={String(settingsOf(element)._element_id ?? '')} placeholder="contato" onChange={(v) => set({ _element_id: v.replace(/[^\w-]/g, '') || undefined })} />
          </Row>
          <Row label="Classes">
            <TextInput label="Classes CSS" mono value={String(settingsOf(element)[keys.cssClasses] ?? '')} placeholder="minha-classe" onChange={(v) => set({ [keys.cssClasses]: v || undefined })} />
          </Row>
          <Row label="Esconder em">
            <div className="flex flex-1 items-center justify-between gap-2 text-[10.5px] text-gray-500">
              {(
                [
                  ['hide_desktop', 'hidden-desktop', 'Desktop'],
                  ['hide_tablet', 'hidden-tablet', 'Tablet'],
                  ['hide_mobile', 'hidden-mobile', 'Celular'],
                ] as const
              ).map(([key, value, label]) => {
                const toggle = hide(key, value)
                return (
                  <label key={key} className="flex items-center gap-1">
                    <Toggle label={`Esconder no ${label}`} checked={toggle.checked} onChange={toggle.change} />
                    {label}
                  </label>
                )
              })}
            </div>
          </Row>
          <TextArea
            label="CSS da camada (use selector para ela)"
            mono
            rows={4}
            value={String(settingsOf(element).custom_css ?? '')}
            placeholder={'selector { }'}
            onChange={(v) => set({ custom_css: v || undefined })}
          />
        </Group>

        {branded && (
          <p className="px-3 py-2.5 text-[10px] leading-relaxed text-gray-400">
            A marca {brand.name} está ativa: o que você muda aqui fica valendo por cima dela nesta camada.
          </p>
        )}
      </div>
    </div>
  )
}

