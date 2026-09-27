import React, { useRef, useState } from 'react'
import { ImagePlus, Plus, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addPhoto, LOGO_LABELS, LOGO_VARIANTS, removePhoto, setLogoVariant, type LogoVariant } from './assets'
import { oklch, parseColor } from './color'
import type { Brand } from './designMd'

/**
 * Logo e banco de fotos da marca na tela da marca. Tudo o que muda aqui é
 * escrito no front matter do guia, que continua sendo a fonte da marca.
 */

/** Logo enviado vira data URL dentro do guia: acima disso, o guia fica pesado demais para guardar. */
const MAX_LOGO_BYTES = 500 * 1024
const LOGO_TYPES = 'image/svg+xml,image/png,image/webp,image/jpeg'

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

/** A cor mais clara e a mais escura da marca, para mostrar cada versão do logo no fundo em que ela entra. */
function tileColors(brand: Brand) {
  const tones = brand.colors.map((c) => ({ hex: c.hex, l: oklch(parseColor(c.hex)!).l }))
  const light = tones.filter((t) => t.l > 0.85).sort((a, b) => b.l - a.l)[0]?.hex ?? '#FFFFFF'
  const dark = tones.filter((t) => t.l < 0.4).sort((a, b) => a.l - b.l)[0]?.hex ?? '#111111'
  return { light, dark }
}

interface Props {
  brand: Brand
  /** Guia no modelo do Space (já convertido, se veio em outro formato). */
  source: string
  onChange: (source: string) => void
}

export const BrandAssets: React.FC<Props> = ({ brand, source, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [target, setTarget] = useState<LogoVariant>('onLight')
  const [photoUrl, setPhotoUrl] = useState('')
  const { light, dark } = tileColors(brand)
  const logo = brand.logo

  const apply = (next: string | null) => {
    if (next === null) {
      toast.error('Não consegui editar o guia', { description: 'O bloco entre "---" precisa ser um YAML válido.' })
      return false
    }
    onChange(next)
    return true
  }

  const pickLogo = (variant: LogoVariant) => {
    setTarget(variant)
    fileRef.current?.click()
  }

  const uploadLogo = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo grande demais', { description: `O arquivo tem ${Math.round(file.size / 1024)} KB; o limite é 500 KB. Um SVG costuma ter poucos KB.` })
      return
    }
    apply(setLogoVariant(source, target, await readAsDataUrl(file)))
  }

  const submitPhoto = (e: React.FormEvent) => {
    e.preventDefault()
    const url = photoUrl.trim()
    if (!/^(https?:\/\/|\/)\S+$/i.test(url)) {
      toast.error('Endereço inválido', { description: 'Use uma URL (https://...) ou um caminho do site (/brands/...).' })
      return
    }
    if (apply(addPhoto(source, { url }))) setPhotoUrl('')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Logo</p>
        <p className="mt-0.5 text-muted-foreground">
          {logo
            ? 'Entra no lugar do logo do site nas seções (cabeçalho, rodapé, login). Logos de clientes ficam como estão.'
            : 'Sem logo: as seções mantêm o delas. Envie um SVG ou PNG para cada fundo.'}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {LOGO_VARIANTS.map((variant) => {
            const url = logo?.[variant]
            const onDark = variant === 'onDark' || variant === 'symbolOnDark'
            return (
              <div key={variant} className="group relative">
                <button
                  type="button"
                  onClick={() => pickLogo(variant)}
                  title={url ? `Trocar: ${LOGO_LABELS[variant].toLowerCase()}` : `Enviar: ${LOGO_LABELS[variant].toLowerCase()}`}
                  className={`flex h-14 w-full items-center justify-center rounded-md border px-3 transition-colors ${url ? '' : 'border-dashed hover:border-foreground/40'}`}
                  style={{ backgroundColor: url ? (onDark ? dark : light) : undefined }}
                >
                  {url ? (
                    <img src={url} alt={LOGO_LABELS[variant]} className="max-h-8 max-w-full object-contain" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                {url && (
                  <button
                    type="button"
                    aria-label={`Tirar: ${LOGO_LABELS[variant].toLowerCase()}`}
                    onClick={() => apply(setLogoVariant(source, variant, null))}
                    className="absolute right-1 top-1 hidden rounded bg-background/90 p-0.5 text-muted-foreground shadow-sm hover:text-foreground group-hover:block"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{LOGO_LABELS[variant]}</p>
              </div>
            )
          })}
        </div>
        <input ref={fileRef} type="file" accept={LOGO_TYPES} className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fotos da marca{brand.photos.length ? ` · ${brand.photos.length}` : ''}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Ficam guardadas com a marca. As seções ainda não recebem as fotos: elas mantêm as imagens delas.
        </p>
        {brand.photos.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-1.5">
            {brand.photos.map((photo) => (
              <li key={photo.url} className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted" title={photo.alt ?? photo.url}>
                <img src={photo.url} alt={photo.alt ?? ''} className="h-full w-full object-cover" loading="lazy" />
                <button
                  type="button"
                  aria-label="Tirar a foto do banco"
                  onClick={() => apply(removePhoto(source, photo.url))}
                  className="absolute right-1 top-1 hidden rounded bg-background/90 p-0.5 text-muted-foreground shadow-sm hover:text-foreground group-hover:block"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitPhoto} className="mt-2 flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <ImagePlus className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="URL da foto"
              className="h-7 bg-background pl-7 text-xs"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-7 gap-1 bg-background text-xs" disabled={!photoUrl.trim()}>
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </form>
      </div>
    </div>
  )
}
