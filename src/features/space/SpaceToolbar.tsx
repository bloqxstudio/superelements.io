import React from 'react'
import { LayoutTemplate, Type, Palette, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSpaceStore } from '@/store/spaceStore'
import { toast } from 'sonner'
import type { NodeType, SectionNodeData, TextNodeData, ColorPaletteNodeData } from '@/types/space'

// ─── Elementor JSON transformation helpers ──────────────────────────────────

/**
 * Recursively walk all elements in the Elementor JSON tree and apply a
 * visitor function to each element's settings object.
 */
function walkElements(elements: any[], visitor: (el: any) => void): void {
  for (const el of elements) {
    visitor(el)
    if (Array.isArray(el.elements) && el.elements.length > 0) {
      walkElements(el.elements, visitor)
    }
  }
}

/**
 * Apply a color palette to an Elementor JSON.
 * Strategy: replace every background_color found with colors cycling through the palette.
 */
function applyColorsToJson(json: any, colors: string[]): any {
  if (!colors.length) return json
  const result = JSON.parse(JSON.stringify(json)) // deep clone
  let colorIndex = 0

  const elements = result.elements ?? result.content ?? []
  walkElements(elements, (el) => {
    const s = el.settings
    if (!s) return
    if (s.background_color && typeof s.background_color === 'string' && s.background_color.startsWith('#')) {
      s.background_color = colors[colorIndex % colors.length]
      colorIndex++
    }
    if (s.title_color && typeof s.title_color === 'string' && s.title_color.startsWith('#')) {
      s.title_color = colors[colorIndex % colors.length]
    }
    if (s.text_color && typeof s.text_color === 'string' && s.text_color.startsWith('#')) {
      s.text_color = colors[colorIndex % colors.length]
    }
  })

  return result
}

/**
 * Apply copy text to an Elementor JSON.
 * Strategy: split the copy by double-newlines (paragraphs) and distribute them
 * across heading widgets (title field) and text-editor widgets (editor field).
 */
function applyCopyToJson(json: any, copy: string): any {
  if (!copy.trim()) return json
  const result = JSON.parse(JSON.stringify(json)) // deep clone

  // Split copy into chunks separated by blank lines
  const chunks = copy
    .split(/\n\n+/)
    .map((c) => c.trim())
    .filter(Boolean)

  let chunkIndex = 0
  const elements = result.elements ?? result.content ?? []

  walkElements(elements, (el) => {
    if (chunkIndex >= chunks.length) return
    const s = el.settings
    if (!s) return

    if (el.widgetType === 'heading' && s.title !== undefined) {
      s.title = chunks[chunkIndex++]
    } else if (el.widgetType === 'text-editor' && s.editor !== undefined) {
      s.editor = `<p>${chunks[chunkIndex++]}</p>`
    }
  })

  return result
}

// ─── Main JSON generator ─────────────────────────────────────────────────────

function generateElementorJson(): string {
  const { nodes, connections } = useSpaceStore.getState()

  const sectionNodes = nodes
    .filter((n) => n.type === 'section')
    .sort((a, b) => a.y - b.y)

  if (sectionNodes.length === 0) return ''

  const resultElements: any[] = []

  for (const sectionNode of sectionNodes) {
    const sectionData = sectionNode.data as SectionNodeData

    let parsedJson: any = null
    try {
      if (sectionData.elementorJson.trim()) {
        parsedJson = JSON.parse(sectionData.elementorJson)
      }
    } catch {
      // invalid JSON — skip this section
      continue
    }

    if (!parsedJson) continue

    // Find incoming connections to this section
    const incomingConnections = connections.filter((c) => c.targetId === sectionNode.id)

    let modifiedJson = parsedJson

    for (const conn of incomingConnections) {
      const sourceNode = nodes.find((n) => n.id === conn.sourceId)
      if (!sourceNode) continue

      if (conn.type === 'apply-colors') {
        const palette = sourceNode.data as ColorPaletteNodeData
        modifiedJson = applyColorsToJson(modifiedJson, palette.colors)
      }

      if (conn.type === 'apply-copy') {
        const text = sourceNode.data as TextNodeData
        modifiedJson = applyCopyToJson(modifiedJson, text.content)
      }
    }

    // Collect the top-level elements from this section's JSON
    const topElements = modifiedJson.elements ?? modifiedJson.content ?? []
    resultElements.push(...topElements)
  }

  // If only one section, return the full original JSON structure with modified elements
  if (sectionNodes.length === 1) {
    const sectionData = sectionNodes[0].data as SectionNodeData
    try {
      const base = JSON.parse(sectionData.elementorJson)
      const incomingConnections = connections.filter((c) => c.targetId === sectionNodes[0].id)
      let modified = base
      for (const conn of incomingConnections) {
        const sourceNode = nodes.find((n) => n.id === conn.sourceId)
        if (!sourceNode) continue
        if (conn.type === 'apply-colors') modified = applyColorsToJson(modified, (sourceNode.data as ColorPaletteNodeData).colors)
        if (conn.type === 'apply-copy') modified = applyCopyToJson(modified, (sourceNode.data as TextNodeData).content)
      }
      return JSON.stringify(modified, null, 2)
    } catch {
      return ''
    }
  }

  // Multiple sections: wrap all elements into the first section's container structure
  const firstSectionData = sectionNodes[0].data as SectionNodeData
  try {
    const base = JSON.parse(firstSectionData.elementorJson)
    const combined = { ...base, elements: resultElements }
    return JSON.stringify(combined, null, 2)
  } catch {
    return JSON.stringify({ elements: resultElements }, null, 2)
  }
}

// ─── Toolbar component ────────────────────────────────────────────────────────

export const SpaceToolbar: React.FC = () => {
  const { addNode, clearCanvas, canvasTransform, nodes, connections } = useSpaceStore()

  const handleAdd = (type: NodeType) => {
    const viewportCenterX = window.innerWidth / 2
    const viewportCenterY = window.innerHeight / 2
    const worldX = (viewportCenterX - canvasTransform.x) / canvasTransform.zoom
    const worldY = (viewportCenterY - canvasTransform.y) / canvasTransform.zoom
    const offset = nodes.length * 30
    addNode(type, worldX + offset, worldY + offset)
  }

  const handleGenerateJson = async () => {
    const sectionCount = nodes.filter((n) => n.type === 'section').length
    if (sectionCount === 0) {
      toast.error('Adicione ao menos uma seção antes de gerar o JSON')
      return
    }

    const jsonString = generateElementorJson()
    if (!jsonString) {
      toast.error('Nenhum JSON válido encontrado nas seções')
      return
    }

    try {
      await navigator.clipboard.writeText(jsonString)
      toast.success('JSON copiado!', {
        description: `${sectionCount} seção(ões) · ${connections.length} conexão(ões) aplicadas`,
      })
    } catch {
      toast.error('Não foi possível copiar. Verifique as permissões do navegador.')
    }
  }

  const handleClear = () => {
    if (nodes.length === 0 && connections.length === 0) return
    if (confirm('Limpar o canvas? Todas as seções e conexões serão removidas.')) {
      clearCanvas()
    }
  }

  const sectionCount = nodes.filter((n) => n.type === 'section').length

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-white rounded-xl border border-gray-200 shadow-md px-3 py-2 select-none">
      <span className="text-[10px] font-semibold text-gray-400 mr-1 uppercase tracking-wide">Adicionar</span>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => handleAdd('section')}
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        Seção
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50"
        onClick={() => handleAdd('text')}
      >
        <Type className="h-3.5 w-3.5" />
        Texto
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50"
        onClick={() => handleAdd('color-palette')}
      >
        <Palette className="h-3.5 w-3.5" />
        Paleta
      </Button>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <Button
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={handleGenerateJson}
        disabled={sectionCount === 0}
      >
        <Copy className="h-3.5 w-3.5" />
        Gerar JSON
      </Button>

      {(nodes.length > 0 || connections.length > 0) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-gray-400 hover:text-red-500 ml-1"
          onClick={handleClear}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {nodes.length > 0 && (
        <span className="ml-1 text-[10px] text-gray-400">
          {nodes.length} nó{nodes.length !== 1 ? 's' : ''}
          {connections.length > 0 && ` · ${connections.length} conex${connections.length !== 1 ? 'ões' : 'ão'}`}
        </span>
      )}
    </div>
  )
}
