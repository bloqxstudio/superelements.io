import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  SpaceNode,
  SpaceConnection,
  CanvasTransform,
  PendingConnection,
  NodeType,
  SectionNodeData,
  TextNodeData,
  ColorPaletteNodeData,
} from '@/types/space'

interface SpaceState {
  nodes: SpaceNode[]
  connections: SpaceConnection[]
  canvasTransform: CanvasTransform
  pendingConnection: PendingConnection | null
  selectedNodeId: string | null
}

interface SpaceActions {
  addNode: (type: NodeType, x: number, y: number) => void
  removeNode: (id: string) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeData: (id: string, data: Partial<SectionNodeData | TextNodeData | ColorPaletteNodeData>) => void
  updateNodeSize: (id: string, width: number, height: number) => void
  startConnection: (sourceId: string, sourceX: number, sourceY: number) => void
  updatePendingConnection: (currentX: number, currentY: number) => void
  completeConnection: (targetId: string) => void
  cancelConnection: () => void
  removeConnection: (id: string) => void
  setCanvasTransform: (transform: Partial<CanvasTransform>) => void
  panCanvas: (dx: number, dy: number) => void
  setSelectedNodeId: (id: string | null) => void
  clearCanvas: () => void
}

const NODE_DIMENSIONS: Record<NodeType, { width: number; height: number }> = {
  section: { width: 280, height: 200 },
  text: { width: 240, height: 160 },
  'color-palette': { width: 240, height: 140 },
}

const DEFAULT_NODE_DATA: Record<NodeType, SectionNodeData | TextNodeData | ColorPaletteNodeData> = {
  section: { title: 'Nova Seção', elementorJson: '' },
  text: { content: '' },
  'color-palette': { name: 'Minha Paleta', colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'] },
}

export const useSpaceStore = create<SpaceState & SpaceActions>()(
  devtools(
    (set, get) => ({
      nodes: [],
      connections: [],
      canvasTransform: { x: 0, y: 0, zoom: 1 },
      pendingConnection: null,
      selectedNodeId: null,

      addNode: (type, x, y) => {
        const dims = NODE_DIMENSIONS[type]
        const data = { ...DEFAULT_NODE_DATA[type] }
        const newId = crypto.randomUUID()

        const { nodes, connections } = get()

        // For text/palette nodes: if there's already a section, auto-connect to the last one
        // and position the new node to the left of that section
        let autoConnectSectionId: string | null = null
        let finalX = x - dims.width / 2
        let finalY = y - dims.height / 2

        if (type === 'text' || type === 'color-palette') {
          // Pick the most recently added section (last in array)
          const sections = nodes.filter((n) => n.type === 'section')
          if (sections.length > 0) {
            const targetSection = sections[sections.length - 1]
            autoConnectSectionId = targetSection.id

            // Position: to the left of the section, vertically centered
            const GAP = 40
            finalX = targetSection.x - dims.width - GAP
            // Stack multiple transformers vertically if section already has connections
            const existingInputs = connections.filter((c) => c.targetId === targetSection.id)
            finalY = targetSection.y + existingInputs.length * (dims.height + 20)
          }
        }

        const connType: 'apply-copy' | 'apply-colors' =
          type === 'color-palette' ? 'apply-colors' : 'apply-copy'

        set(
          (state) => ({
            nodes: [
              ...state.nodes,
              {
                id: newId,
                type,
                x: finalX,
                y: finalY,
                ...dims,
                data,
              },
            ],
            connections:
              autoConnectSectionId
                ? [
                    ...state.connections,
                    {
                      id: crypto.randomUUID(),
                      sourceId: newId,
                      targetId: autoConnectSectionId,
                      type: connType,
                    },
                  ]
                : state.connections,
          }),
          false,
          'addNode'
        )
      },

      removeNode: (id) => {
        set(
          (state) => ({
            nodes: state.nodes.filter((n) => n.id !== id),
            connections: state.connections.filter((c) => c.sourceId !== id && c.targetId !== id),
          }),
          false,
          'removeNode'
        )
      },

      updateNodePosition: (id, x, y) => {
        set(
          (state) => ({
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
          }),
          false,
          'updateNodePosition'
        )
      },

      updateNodeData: (id, data) => {
        set(
          (state) => ({
            nodes: state.nodes.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, ...data } as typeof n.data } : n
            ),
          }),
          false,
          'updateNodeData'
        )
      },

      updateNodeSize: (id, width, height) => {
        set(
          (state) => ({
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, width, height } : n)),
          }),
          false,
          'updateNodeSize'
        )
      },

      startConnection: (sourceId, sourceX, sourceY) => {
        set(
          { pendingConnection: { sourceId, sourceX, sourceY, currentX: sourceX, currentY: sourceY } },
          false,
          'startConnection'
        )
      },

      updatePendingConnection: (currentX, currentY) => {
        set(
          (state) =>
            state.pendingConnection
              ? { pendingConnection: { ...state.pendingConnection, currentX, currentY } }
              : {},
          false,
          'updatePendingConnection'
        )
      },

      completeConnection: (targetId) => {
        const { pendingConnection, nodes, connections } = get()
        if (!pendingConnection) return

        const { sourceId } = pendingConnection

        // Prevent self-connection and duplicates
        if (sourceId === targetId) {
          set({ pendingConnection: null }, false, 'cancelConnection')
          return
        }

        const isDuplicate = connections.some(
          (c) => c.sourceId === sourceId && c.targetId === targetId
        )
        if (isDuplicate) {
          set({ pendingConnection: null }, false, 'cancelConnection')
          return
        }

        const sourceNode = nodes.find((n) => n.id === sourceId)
        const targetNode = nodes.find((n) => n.id === targetId)
        if (!sourceNode || !targetNode) {
          set({ pendingConnection: null }, false, 'cancelConnection')
          return
        }

        // Infer connection type: text → section = apply-copy, palette → section = apply-colors
        let connType: 'apply-copy' | 'apply-colors' = 'apply-copy'
        if (sourceNode.type === 'color-palette') {
          connType = 'apply-colors'
        } else if (sourceNode.type === 'text') {
          connType = 'apply-copy'
        }

        set(
          (state) => ({
            connections: [
              ...state.connections,
              { id: crypto.randomUUID(), sourceId, targetId, type: connType },
            ],
            pendingConnection: null,
          }),
          false,
          'completeConnection'
        )
      },

      cancelConnection: () => {
        set({ pendingConnection: null }, false, 'cancelConnection')
      },

      removeConnection: (id) => {
        set(
          (state) => ({ connections: state.connections.filter((c) => c.id !== id) }),
          false,
          'removeConnection'
        )
      },

      setCanvasTransform: (transform) => {
        set(
          (state) => ({ canvasTransform: { ...state.canvasTransform, ...transform } }),
          false,
          'setCanvasTransform'
        )
      },

      panCanvas: (dx, dy) => {
        set(
          (state) => ({
            canvasTransform: {
              ...state.canvasTransform,
              x: state.canvasTransform.x + dx,
              y: state.canvasTransform.y + dy,
            },
          }),
          false,
          'panCanvas'
        )
      },

      setSelectedNodeId: (id) => {
        set({ selectedNodeId: id }, false, 'setSelectedNodeId')
      },

      clearCanvas: () => {
        set(
          { nodes: [], connections: [], pendingConnection: null, selectedNodeId: null },
          false,
          'clearCanvas'
        )
      },
    }),
    { name: 'space-store' }
  )
)
