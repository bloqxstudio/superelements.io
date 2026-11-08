import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Film, Instagram, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadReelViaLink, useCreativeLink } from '../link'
import { referenceFrames } from '../sceneAi'

/**
 * O vídeo de referência do vídeo explicativo: um arquivo, ou o link de um reel do Instagram
 * (baixado pelo conector neste computador, `scripts/criativos/reel.ts`). Vira 10 quadros para a
 * IA seguir o ritmo e o jeito de animar; o vídeo não fica salvo em lugar nenhum.
 */

export type Reference = { name: string; frames: string[] }

const IG = /instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\//i

export const ReferencePicker: React.FC<{ value: Reference | null; onChange: (r: Reference | null) => void; compact?: boolean }> = ({ value, onChange, compact }) => {
  const input = useRef<HTMLInputElement>(null)
  const connected = useCreativeLink((s) => s.connected)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const fromFile = async (file?: File) => {
    if (!file) return
    setBusy('Lendo o vídeo…')
    try {
      onChange({ name: file.name, frames: await referenceFrames(file, 10) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler a referência.')
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  const fromLink = async () => {
    const url = link.trim()
    if (!IG.test(url)) return toast.error('Cole o link de um reel ou post de vídeo do Instagram (instagram.com/reel/…).')
    setBusy('Baixando o reel…')
    try {
      const out = await downloadReelViaLink(url)
      const blob = await (await fetch(out.data)).blob()
      setBusy('Lendo o vídeo…')
      onChange({ name: `Instagram · ${out.name}`, frames: await referenceFrames(new File([blob], out.name, { type: out.type }), 10) })
      setLink('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não consegui baixar o reel.'
      toast.error(/desconhecido/i.test(msg) ? 'O conector desta máquina é antigo: baixe o conector de novo para buscar reels pelo link.' : msg)
    } finally {
      setBusy(null)
    }
  }

  if (value)
    return (
      <div>
        <span className="flex min-w-0 items-center gap-1 text-xs text-gray-600"><span className="truncate">{value.name} · {value.frames.length} quadros</span><button type="button" aria-label="Tirar a referência" onClick={() => onChange(null)}><Trash2 className="h-3 w-3 hover:text-red-600" /></button></span>
        <div className="mt-1.5 flex gap-1 overflow-x-auto">{value.frames.map((f, i) => (<img key={i} src={f} alt="" className={compact ? 'h-12 rounded border border-gray-200' : 'h-14 rounded border border-gray-200'} />))}</div>
      </div>
    )

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 focus-within:ring-2 focus-within:ring-ring">
          <Instagram className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void fromLink()} disabled={!!busy} placeholder="Cole o link de um reel do Instagram" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 bg-white" disabled={!!busy || !link.trim() || !connected} onClick={() => void fromLink()}>{busy === 'Baixando o reel…' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Buscar'}</Button>
      </div>
      <input ref={input} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => void fromFile(e.target.files?.[0])} />
      <button type="button" disabled={!!busy} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline" onClick={() => input.current?.click()}><Film className="h-3.5 w-3.5" /> ou envie um arquivo de vídeo</button>
      {busy && <p className="text-[11px] text-violet-700">{busy}</p>}
      {!connected && <p className="text-[11px] text-gray-500">Buscar pelo link precisa do conector desta máquina aberto.</p>}
    </div>
  )
}
