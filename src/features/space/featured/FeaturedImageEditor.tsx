import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { FeaturedFields, FeaturedImage } from '@/types/space'
import type { Brand } from '../brand/designMd'
import { featuredPalette, readImageFile, renderFeatured, type FeaturedRender } from './render'
import { FEATURED_TEMPLATES, featuredTemplate } from './templates'

interface FeaturedImageEditorProps {
  brand: Brand | null
  /** Modelo e campos para começar (os de antes, ou os padrões da página). */
  initial: { template: string; fields: FeaturedFields }
  /** Fotos para o modelo: as da página e as do banco da marca. */
  photos: string[]
  onUse: (image: FeaturedImage) => void
  onCancel: () => void
}

const RENDER_DELAY = 120

/** Monta a imagem destacada por um modelo, com a marca do projeto. É o conteúdo de um diálogo, não o diálogo. */
export const FeaturedImageEditor: React.FC<FeaturedImageEditorProps> = ({ brand, initial, photos, onUse, onCancel }) => {
  const [template, setTemplate] = useState(initial.template)
  const [fields, setFields] = useState<FeaturedFields>(initial.fields)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [render, setRender] = useState<FeaturedRender | null>(null)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  // A prévia é a própria imagem final, refeita a cada mudança
  useEffect(() => {
    const id = ++seq.current
    setRendering(true)
    const timer = setTimeout(() => {
      renderFeatured(template, fields, brand).then(
        (result) => {
          if (id !== seq.current) return
          setRender(result)
          setError(null)
          setRendering(false)
        },
        (err) => {
          if (id !== seq.current) return
          setError(err instanceof Error ? err.message : String(err))
          setRendering(false)
        }
      )
    }, RENDER_DELAY)
    return () => clearTimeout(timer)
  }, [template, fields, brand])

  const palette = useMemo(() => featuredPalette(brand), [brand])
  const candidates = useMemo(() => [...new Set([...uploaded, ...photos])], [uploaded, photos])
  const current = featuredTemplate(template)
  const set = (patch: Partial<FeaturedFields>) => setFields((f) => ({ ...f, ...patch }))

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const image = await readImageFile(file)
      setUploaded((list) => [image, ...list])
      set({ photo: image })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Imagem destacada</DialogTitle>
        <DialogDescription>1200×630, o tamanho que Google, WhatsApp e redes usam para mostrar a página.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-3">
          <div className="relative overflow-hidden rounded-lg border bg-gray-50" style={{ aspectRatio: '1200 / 630' }}>
            {render && <img src={render.image} alt="Prévia da imagem destacada" className="h-full w-full object-cover" />}
            {rendering && (
              <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm" aria-label="Atualizando a prévia">
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" aria-hidden />
              </span>
            )}
          </div>
          {[...(render?.warnings ?? []), ...(error ? [error] : [])].map((warning) => (
            <p key={warning} className="flex gap-2 text-xs text-amber-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {warning}
            </p>
          ))}
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label>Modelo</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modelo">
              {FEATURED_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === template}
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left transition-[background-color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
                    t.id === template ? 'border-gray-900 bg-gray-50' : 'hover:bg-gray-50'
                  )}
                >
                  <span className="block text-xs font-medium text-gray-900">{t.name}</span>
                  <span className="block text-[11px] leading-4 text-muted-foreground">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="featured-title">Título</Label>
            <Input id="featured-title" value={fields.title} onChange={(e) => set({ title: e.target.value })} autoComplete="off" />
          </div>
          {current.id !== 'marca' && (
            <div className="grid gap-2">
              <Label htmlFor="featured-subtitle">
                Linha de apoio <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="featured-subtitle" value={fields.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} autoComplete="off" />
            </div>
          )}

          {current.photo && (
            <div className="grid gap-2">
              <Label>Foto</Label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-gray-600 transition-[background-color,transform] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Enviar
                </button>
                {candidates.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => set({ photo: url })}
                    aria-pressed={fields.photo === url}
                    className={cn(
                      'aspect-square overflow-hidden rounded-md border transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
                      fields.photo === url && 'ring-2 ring-gray-900 ring-offset-1'
                    )}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Cor de fundo</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor de fundo">
              {palette.colors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={(fields.color ?? palette.background) === hex}
                  aria-label={hex}
                  title={hex}
                  onClick={() => set({ color: hex })}
                  className={cn(
                    'h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
                    (fields.color ?? palette.background) === hex && 'ring-2 ring-gray-900 ring-offset-2'
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Logo da marca</span>
            <Switch checked={fields.logo} onCheckedChange={(logo) => set({ logo })} disabled={!brand?.logo} />
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Voltar
        </Button>
        <Button
          type="button"
          disabled={!render || rendering}
          onClick={() => {
            if (!render) return
            onUse({ kind: 'template', template, fields, image: render.image })
          }}
        >
          Usar esta imagem
        </Button>
      </DialogFooter>
    </>
  )
}
