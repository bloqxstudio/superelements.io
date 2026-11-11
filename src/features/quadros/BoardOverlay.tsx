import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, UserPlus } from 'lucide-react'
import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { listPeople } from '@/features/crm/teams'
import type { TeamPerson } from '@/features/crm/types'
import { arrowSkeleton } from './layout'
import { DIRS, nextSpot, withPerson, withoutPerson, type Dir, type Person } from './quick'

/**
 * Por cima do canvas (dentro do `.excalidraw`, na camada dos botões do canvas, abaixo da barra de ferramentas):
 *   - os "+" nos quatro lados do bloco escolhido: um clique cria um bloco igual, já ligado por seta, e abre o texto;
 *   - a foto de quem criou ou escreveu em cada nota, em cima dela, e o botão para marcar pessoas da conta na nota.
 */

type El = ExcalidrawElement & { customData?: { sticky?: boolean; card?: boolean; cardPart?: string; people?: Person[] } }
type Skel = Parameters<typeof convertToExcalidrawElements>[0]

const SHAPES = new Set(['rectangle', 'ellipse', 'diamond'])
/** Bloco que dá para continuar com o "+": forma simples ou nota (cartões da Iara são grupos, ficam de fora). */
export const isFlowBlock = (e: El) => SHAPES.has(e.type) && !e.customData?.card && !e.customData?.cardPart && !e.isDeleted

const uid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4)

const personOf = (p: TeamPerson, color: string): Person => ({ id: p.userId, name: p.name, avatar: p.avatarUrl, color })

export function createConnected(api: ExcalidrawImperativeAPI, src: El, dir: Dir, me?: Person, keys?: HTMLElement): string {
  const all = api.getSceneElementsIncludingDeleted() as readonly El[]
  const others = all.filter((e) => !e.isDeleted && e.id !== src.id && e.type !== 'arrow' && !(e.type === 'text' && e.containerId))
  const spot = nextSpot(src, dir, others)
  const id = uid()
  const sticky = !!src.customData?.sticky
  const shape = {
    type: src.type, id, x: spot.x, y: spot.y, width: src.width, height: src.height,
    strokeColor: src.strokeColor, backgroundColor: src.backgroundColor, fillStyle: src.fillStyle, strokeWidth: src.strokeWidth,
    strokeStyle: src.strokeStyle, roughness: src.roughness, opacity: src.opacity, roundness: src.roundness,
    ...(sticky ? { customData: { sticky: true, ...(me ? { people: [me] } : {}) } } : {}),
  }
  const target = { id, x: spot.x, y: spot.y, width: src.width, height: src.height }
  const arrowSkel = arrowSkeleton(src, target) as Record<string, unknown>
  delete arrowSkel.start
  delete arrowSkel.end
  const made = convertToExcalidrawElements([shape, arrowSkel] as unknown as Skel, { regenerateIds: false }) as unknown as El[]
  const block = made.find((e) => e.id === id)!
  const arrow = made.find((e) => e.type === 'arrow')!
  Object.assign(arrow, { startBinding: { elementId: src.id, focus: 0, gap: 8 }, endBinding: { elementId: id, focus: 0, gap: 8 } })
  Object.assign(block, { boundElements: [{ id: arrow.id, type: 'arrow' }] })
  const next = all.map((e) => (e.id === src.id ? newElementWith(e, { boundElements: [...(e.boundElements ?? []), { id: arrow.id, type: 'arrow' }] }) : e))
  api.updateScene({
    elements: [...next, arrow, block] as ExcalidrawElement[],
    appState: { selectedElementIds: { [id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  api.setActiveTool({ type: 'selection' })
  // Abre o texto do bloco novo: o Enter do próprio Excalidraw num bloco escolhido (ele ouve no `.excalidraw`)
  if (keys) setTimeout(() => { keys.focus({ preventScroll: true }); keys.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })) }, 30)
  return id
}

/** Põe ou tira uma pessoa da nota (sem passo no desfazer: quem escreveu não é uma edição). */
export function setStickyPeople(api: ExcalidrawImperativeAPI, id: string, change: (list: Person[] | undefined) => Person[]) {
  const all = api.getSceneElementsIncludingDeleted() as readonly El[]
  let touched = false
  const next = all.map((e) => {
    if (e.id !== id) return e
    const people = change(e.customData?.people)
    if (JSON.stringify(people) === JSON.stringify(e.customData?.people ?? [])) return e
    touched = true
    return newElementWith(e, { customData: { ...(e.customData ?? {}), people } })
  })
  if (touched) api.updateScene({ elements: next as ExcalidrawElement[], captureUpdate: CaptureUpdateAction.NEVER })
}

const Avatar: React.FC<{ p: Person; size: number }> = ({ p, size }) => (
  <span className="qd-face" style={{ width: size, height: size, background: p.color, borderColor: '#fff', fontSize: size * 0.45 }} title={p.name}>
    {p.avatar ? <img src={p.avatar} alt="" draggable={false} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
    <span aria-hidden>{p.name.slice(0, 1).toUpperCase()}</span>
  </span>
)

export const BoardOverlay: React.FC<{ api: ExcalidrawImperativeAPI; host: HTMLElement; me: Person; teamId: string; colorOf: (id: string) => string }> = ({ api, host, me, teamId, colorOf }) => {
  const [, setFrame] = useState(0)
  const raf = useRef<number>()
  const [picker, setPicker] = useState<string | null>(null)
  const [people, setPeople] = useState<TeamPerson[] | null>(null)

  useEffect(() => {
    const off = api.onChange(() => {
      if (raf.current) return
      raf.current = requestAnimationFrame(() => { raf.current = undefined; setFrame((f) => f + 1) })
    })
    return () => { off(); if (raf.current) cancelAnimationFrame(raf.current) }
  }, [api])

  useEffect(() => {
    if (!picker || people) return
    listPeople(teamId).then(setPeople).catch(() => setPeople([]))
  }, [picker, people, teamId])

  const s = api.getAppState()
  const z = s.zoom.value
  const toScreen = useCallback((x: number, y: number) => ({ left: (x + s.scrollX) * z, top: (y + s.scrollY) * z }), [s.scrollX, s.scrollY, z])
  const elements = api.getSceneElements() as readonly El[]
  const selectedIds = Object.keys(s.selectedElementIds).filter((k) => s.selectedElementIds[k])
  const busy = !!(s.editingTextElement || s.newElement || s.selectedElementsAreBeingDragged || s.resizingElement || s.multiElement || s.activeTool.type !== 'selection' || s.contextMenu || s.openDialog)
  const single = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) : undefined
  const flow = single && !busy && isFlowBlock(single) && !single.locked ? single : undefined
  useEffect(() => { if (picker && single?.id !== picker) setPicker(null) }, [picker, single?.id])

  // Notas com gente, só as que estão na tela
  const faces = useMemo(() => {
    if (z < 0.25) return []
    const vw = s.width / z, vh = s.height / z, vx = -s.scrollX, vy = -s.scrollY
    return elements.filter((e) => e.customData?.sticky && e.customData.people?.length && e.x < vx + vw && e.x + e.width > vx && e.y < vy + vh && e.y + e.height > vy)
  }, [elements, s.width, s.height, s.scrollX, s.scrollY, z])

  const handles = flow ? DIRS.map((dir) => {
    const cx = flow.x + flow.width / 2, cy = flow.y + flow.height / 2
    const off = 30 / z
    const at = dir === 'right' ? { x: flow.x + flow.width + off, y: cy } : dir === 'left' ? { x: flow.x - off, y: cy } : dir === 'down' ? { x: cx, y: flow.y + flow.height + off } : { x: cx, y: flow.y - off }
    return { dir, ...toScreen(at.x, at.y) }
  }) : []

  const stickyPicked = single && single.customData?.sticky && !busy ? single : undefined
  const stop = (e: React.PointerEvent | React.MouseEvent) => { e.stopPropagation() }

  return createPortal(
    <div className="qd-overlay" aria-hidden={false}>
      {faces.map((e) => {
        const list = e.customData!.people!
        const pos = toScreen(e.x, e.y)
        const size = Math.max(18, Math.min(30, 26 * Math.sqrt(z)))
        return (
          <div key={e.id} className="qd-faces" style={{ left: pos.left, top: pos.top - size - 6 }} title={`Nota de ${list.map((p) => p.name).join(', ')}`}>
            {list.slice(0, 5).map((p) => <Avatar key={p.id} p={p} size={size} />)}
            {list.length > 5 && <span className="qd-face qd-face-more" style={{ width: size, height: size, fontSize: size * 0.4 }}>+{list.length - 5}</span>}
          </div>
        )
      })}

      {stickyPicked && (() => {
        const list = stickyPicked.customData?.people ?? []
        const pos = toScreen(stickyPicked.x + stickyPicked.width, stickyPicked.y)
        return (
          <div className="qd-tag-people" style={{ left: pos.left - 28, top: pos.top - 34 }} onPointerDown={stop}>
            <button type="button" className="qd-tag-btn" title="Marcar quem colaborou nesta nota" aria-label="Marcar pessoas na nota" aria-expanded={picker === stickyPicked.id}
              onClick={() => setPicker((v) => (v ? null : stickyPicked.id))}>
              <UserPlus className="h-3.5 w-3.5" />
            </button>
            {picker === stickyPicked.id && (
              <div className="qd-tag-menu" role="menu" aria-label="Pessoas da conta">
                <p>Quem colaborou nesta nota</p>
                {!people && <span className="qd-tag-empty">Carregando…</span>}
                {people?.length === 0 && <span className="qd-tag-empty">Ninguém na equipe da conta.</span>}
                {people?.map((p) => {
                  const on = list.some((x) => x.id === p.userId)
                  return (
                    <button key={p.userId} type="button" role="menuitemcheckbox" aria-checked={on}
                      onClick={() => setStickyPeople(api, stickyPicked.id, (cur) => (on ? withoutPerson(cur, p.userId) : withPerson(cur, personOf(p, colorOf(p.userId)))))}>
                      <Avatar p={personOf(p, colorOf(p.userId))} size={22} />
                      <span className="truncate">{p.userId === me.id ? `${p.name} (você)` : p.name}</span>
                      {on && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-violet-600" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {handles.map((h) => (
        <button
          key={h.dir} type="button" className="qd-plus" style={{ left: h.left, top: h.top }}
          title="Criar um bloco igual, já ligado" aria-label={`Criar bloco ligado ${({ right: 'à direita', left: 'à esquerda', down: 'abaixo', up: 'acima' } as const)[h.dir]}`}
          onPointerDown={stop}
          onClick={() => flow && createConnected(api, flow, h.dir, flow.customData?.sticky ? me : undefined, host)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ))}
    </div>,
    host,
  )
}
