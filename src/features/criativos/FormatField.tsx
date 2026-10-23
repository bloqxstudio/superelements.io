import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FORMAT_LIST, customFormat, sizeOf, type FormatId } from './types'

/**
 * Escolha de formato: os prontos (feed, quadrado, story, paisagem, link,
 * vertical) ou um tamanho livre em pixels, para qualquer card no mesmo canvas.
 */

const CUSTOM = '__custom'

export const FormatField: React.FC<{ value: FormatId; onChange: (format: FormatId) => void; className?: string }> = ({ value, onChange, className }) => {
  const known = FORMAT_LIST.some((f) => f.id === value)
  const size = sizeOf(value)
  const [open, setOpen] = useState(false)
  const [w, setW] = useState(String(size.width))
  const [h, setH] = useState(String(size.height))

  const apply = () => {
    const width = Number(w)
    const height = Number(h)
    if (!(width >= 200 && height >= 200)) return
    onChange(customFormat(width, height))
    setOpen(false)
  }

  return (
    <div className="relative">
      <select
        aria-label="Formato"
        value={open ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setW(String(size.width))
            setH(String(size.height))
            setOpen(true)
          } else {
            setOpen(false)
            onChange(e.target.value)
          }
        }}
        className={className ?? 'h-8 rounded-md border border-gray-200 bg-white px-2 text-sm'}
      >
        {!known && <option value={value}>{size.width}×{size.height} · livre</option>}
        {FORMAT_LIST.map((f) => (
          <option key={f.id} value={f.id}>{f.label} · {f.width}×{f.height}</option>
        ))}
        <option value={CUSTOM}>Tamanho livre…</option>
      </select>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-60 space-y-2 rounded-xl border bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-end gap-1.5">
            <label className="block flex-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Largura
              <input type="number" min={200} max={4000} value={w} onChange={(e) => setW(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-sm normal-case text-gray-900" />
            </label>
            <span className="pb-1.5 text-gray-400">×</span>
            <label className="block flex-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Altura
              <input type="number" min={200} max={4000} value={h} onChange={(e) => setH(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-sm normal-case text-gray-900" />
            </label>
          </div>
          <p className="text-[11px] text-gray-500">Em pixels, de 200 a 4000 por lado.</p>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={apply}>Usar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
