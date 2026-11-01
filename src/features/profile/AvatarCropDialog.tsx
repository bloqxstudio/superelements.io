import React, { useEffect, useRef, useState } from 'react'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AVATAR_MIN_SIDE, AVATAR_OUT, type AvatarCrop } from './profile'

/**
 * Enquadrar a foto antes de salvar: arrasta para posicionar, zoom pelo
 * controle, pela roda do mouse ou pelos botões. O zoom para antes de a
 * foto ficar com menos de AVATAR_MIN_SIDE px de lado (ela ficaria borrada).
 */

const STAGE = 288

export const AvatarCropDialog: React.FC<{
  image: ImageBitmap | null
  saving: boolean
  onCancel: () => void
  onSave: (crop: AvatarCrop) => void
}> = ({ image, saving, onCancel, onSave }) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const minSide = image ? Math.min(image.width, image.height) : 1
  const base = STAGE / minSide
  const maxZoom = Math.max(1, Math.min(4, minSide / AVATAR_MIN_SIDE))
  const scale = base * zoom
  const dispW = (image?.width ?? 0) * scale
  const dispH = (image?.height ?? 0) * scale
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.max(-(dispW - STAGE) / 2, Math.min((dispW - STAGE) / 2, o.x)),
    y: Math.max(-(dispH - STAGE) / 2, Math.min((dispH - STAGE) / 2, o.y)),
  })
  const pos = clamp(offset)
  const left = (STAGE - dispW) / 2 + pos.x
  const top = (STAGE - dispH) / 2 + pos.y
  const side = STAGE / scale

  useEffect(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [image])

  // A prévia desenhada em canvas (nítida em telas retina)
  useEffect(() => {
    const c = canvas.current
    if (!c || !image) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.height = STAGE * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, STAGE, STAGE)
    ctx.drawImage(image, left, top, dispW, dispH)
  }, [image, left, top, dispW, dispH])

  const setZoomKeep = (z: number) => setZoom(Math.max(1, Math.min(maxZoom, z)))
  const outSide = Math.round(Math.min(AVATAR_OUT, side))

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enquadrar a foto</DialogTitle>
          <DialogDescription>Arraste para posicionar e use o zoom. O círculo é o que a equipe vai ver.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-xl bg-gray-900 active:cursor-grabbing"
            style={{ width: STAGE, height: STAGE }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (d) setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }))
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => setZoomKeep(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          >
            <canvas ref={canvas} style={{ width: STAGE, height: STAGE }} aria-label="Prévia da foto" />
            {/* Fora do círculo fica escuro */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.55)] ring-2 ring-white/80" />
          </div>
          <div className="flex w-full items-center gap-3">
            <button type="button" onClick={() => setZoomKeep(zoom / 1.2)} aria-label="Menos zoom" className="text-gray-500 hover:text-gray-900">
              <ZoomOut className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={1}
              max={maxZoom}
              step={0.01}
              value={zoom}
              disabled={maxZoom <= 1}
              onChange={(e) => setZoomKeep(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-gray-900"
            />
            <button type="button" onClick={() => setZoomKeep(zoom * 1.2)} aria-label="Mais zoom" className="text-gray-500 hover:text-gray-900">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {maxZoom <= 1 ? 'Foto pequena: dá para posicionar, mas não aproximar.' : `Fica com ${outSide} × ${outSide} px.`}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving} className="gap-1.5" onClick={() => onSave({ x: -left / scale, y: -top / scale, side })}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
