import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CloudDownload, CloudUpload, Copy, Layers3, LayoutTemplate, Library, Palette, Play, Plus, Sparkles, Type, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSpaceStore } from '@/store/spaceStore'
import { BrandButton } from '@/features/space/brand/BrandButton'
import { LevelBar } from '@/features/space/levels/LevelBar'
import { PagePicker } from '@/features/space/pages/PagePicker'
import { useWordPressUi } from '@/features/wordpress/uiStore'
import { useActiveWordPress } from '@/features/wordpress/useWordPressConnection'
import { LIBRARY_PANEL_WIDTH } from './SpaceLibraryPanel'
import type { NodeType } from '@/types/space'
import { Hint, ToolButton, ToolDivider, ToolbarIsland } from './ToolbarIsland'

/** Abaixo desta largura do canvas os níveis e o Visualizar ficam só com ícone. */
const COMPACT_WIDTH = 1320
/** Abaixo desta, Biblioteca e Modelos também. */
const TIGHT_WIDTH = 960

const ADD_ITEMS: { type: NodeType; label: string; hint: string; icon: LucideIcon; tint: string }[] = [
  { type: 'section', label: 'Seção solta', hint: 'Fora das páginas, para colar um JSON', icon: LayoutTemplate, tint: 'bg-gray-100 text-gray-600' },
  { type: 'text', label: 'Texto', hint: 'Copy para ligar a uma seção', icon: Type, tint: 'bg-amber-50 text-amber-600' },
  { type: 'color-palette', label: 'Paleta de cores', hint: 'Cores para ligar a uma seção', icon: Palette, tint: 'bg-violet-50 text-violet-600' },
]

const ICON_SPRING = { type: 'spring', duration: 0.3, bounce: 0 } as const

interface SpaceToolbarProps {
  libraryOpen: boolean
  navigatorOpen: boolean
  onToggleLibrary: () => void
  onToggleNavigator: () => void
  onPreview: () => void
  onOpenTemplates: () => void
  onCopy: () => Promise<boolean>
}

/**
 * Barra do Space em três ilhas, na ordem do trabalho: montar a página (esquerda),
 * aplicar a marca por camada (centro) e publicar (direita).
 */
export const SpaceToolbar: React.FC<SpaceToolbarProps> = ({ libraryOpen, navigatorOpen, onToggleLibrary, onToggleNavigator, onPreview, onOpenTemplates, onCopy }) => {
  const addNode = useSpaceStore((s) => s.addNode)
  const canvasWidth = useSpaceStore((s) => s.viewport.width)
  // Visualizar e Copiar agem sobre a página ativa
  const activePage = useSpaceStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const hasSections = !!activePage?.sectionIds.length
  const pageName = activePage?.name ?? 'página'
  const compact = canvasWidth < COMPACT_WIDTH
  const tight = canvasWidth < TIGHT_WIDTH
  // Com o WordPress do cliente conectado, publicar no site vira a ação principal
  const wordpress = useActiveWordPress()
  const linked = !!activePage?.wordpress && activePage.wordpress.siteUrl === wordpress?.site.siteUrl
  const { openImport, openPublish } = useWordPressUi.getState()

  const handleAdd = (type: NodeType) => {
    const { canvasTransform, viewport, nodes } = useSpaceStore.getState()
    const worldX = (viewport.width / 2 - canvasTransform.x) / canvasTransform.zoom
    const worldY = (viewport.height / 2 - canvasTransform.y) / canvasTransform.zoom
    const offset = nodes.length * 30
    addNode(type, worldX + offset, worldY + offset)
  }

  // O ícone do Copiar vira um check por um instante depois de copiar
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])
  const handleCopy = async () => {
    if (!(await onCopy())) return
    setCopied(true)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-50 grid select-none grid-cols-[1fr_auto_1fr] items-start gap-2">
      {/* Montar: de onde vêm as seções */}
      <ToolbarIsland aria-label="Montar a página" className="justify-self-start">
        <PagePicker leftInset={libraryOpen ? LIBRARY_PANEL_WIDTH + 24 : 0} compact={tight} />
        <Hint label="Navigator" hint="Ver a árvore nativa de containers e widgets">
          <ToolButton icon={Layers3} label="Navigator" showLabel={!tight} pressed={navigatorOpen} onClick={onToggleNavigator} />
        </Hint>
        <ToolDivider />
        <Hint label="Biblioteca de seções" hint="Seções do pack, por tipo">
          <ToolButton icon={Library} label="Biblioteca" showLabel={!tight} pressed={libraryOpen} onClick={onToggleLibrary} />
        </Hint>
        <Hint label="Modelos de página" hint="Uma landing pronta numa página">
          <ToolButton icon={Sparkles} label="Modelos" showLabel={!tight} onClick={onOpenTemplates} />
        </Hint>
        {wordpress && (
          <Hint label="Importar do WordPress" hint={`Páginas e marca de ${wordpress.site.name}`}>
            <ToolButton icon={CloudDownload} label="Do site" showLabel={!tight} onClick={openImport} />
          </Hint>
        )}
        <DropdownMenu>
          <Hint label="Adicionar ao canvas" hint="Seção solta, texto ou paleta">
            <DropdownMenuTrigger asChild>
              <ToolButton icon={Plus} label="Adicionar ao canvas" showLabel={false} />
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="start" sideOffset={8} className="w-60 rounded-xl p-1">
            {ADD_ITEMS.map(({ type, label, hint, icon: Icon, tint }) => (
              <DropdownMenuItem key={type} onSelect={() => handleAdd(type)} className="gap-2.5 rounded-lg px-2 py-1.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tint}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-gray-900">{label}</span>
                  <span className="block text-[11px] text-gray-500">{hint}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarIsland>

      {/* Marca e a camada em edição */}
      <ToolbarIsland aria-label="Marca e nível de edição">
        <BrandButton />
        <ToolDivider />
        <LevelBar variant="inline" compact={compact} />
      </ToolbarIsland>

      {/* Publicar */}
      <ToolbarIsland aria-label="Publicar" className="justify-self-end">
        <Hint label={`Player da página ${pageName}`} hint="Só esta página, com a marca e as animações, rolando como no site">
          <ToolButton icon={Play} label="Player" showLabel={!compact} onClick={onPreview} disabled={!hasSections} />
        </Hint>
        <Hint label="Copiar para o Elementor" hint={`A página ${pageName}, na ordem dela`}>
          <Button
            size="sm"
            variant={wordpress ? 'ghost' : 'default'}
            className={`h-8 gap-1.5 rounded-lg px-3 text-xs transition-[color,background-color,transform] active:scale-[0.96]${wordpress ? ' text-gray-600' : ''}`}
            onClick={handleCopy}
            disabled={!hasSections}
          >
            <span className="relative h-3.5 w-3.5">
              <AnimatePresence initial={false}>
                <motion.span
                  key={copied ? 'check' : 'copy'}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                  transition={ICON_SPRING}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </motion.span>
              </AnimatePresence>
            </span>
            {wordpress ? 'Copiar' : 'Copiar para o Elementor'}
          </Button>
        </Hint>
        {wordpress && (
          <Hint
            label={linked ? `Atualizar ${pageName} no site` : `Publicar ${pageName} no site`}
            hint={linked ? `Na mesma página, em ${wordpress.site.name}` : `Página nova em ${wordpress.site.name}`}
          >
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-3 text-xs transition-[color,background-color,transform] active:scale-[0.96]"
              onClick={() => activePage && openPublish(activePage.id)}
              disabled={!hasSections}
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {linked ? 'Atualizar no site' : 'Publicar no site'}
            </Button>
          </Hint>
        )}
      </ToolbarIsland>
    </div>
  )
}
