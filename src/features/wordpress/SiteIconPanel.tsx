import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useBrandStore } from '@/features/space/brand/brandStore'
import { renderIcon, type IconOptions, type IconRender, type IconShape } from '@/features/space/featured/favicon'
import { featuredPalette, readImageFile } from '@/features/space/featured/render'
import { cn } from '@/lib/utils'
import { refreshConnection } from './connect'
import { saveSiteIcon } from './siteIcon'
import type { WordPressConnection } from './types'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const SHAPES: { value: IconShape; label: string }[] = [
  { value: 'square', label: 'Quadrado' },
  { value: 'rounded', label: 'Arredondado' },
  { value: 'circle', label: 'Círculo' },
]

// Xadrez atrás do ícone: mostra onde ele é transparente
const CHECKER = 'bg-[conic-gradient(#e5e7eb_25%,#fff_0_50%,#e5e7eb_0_75%,#fff_0)] [background-size:16px_16px]'

const Segmented = <T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) => (
  <div className="grid gap-2">
    <Label>{label}</Label>
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-medium transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
            value === option.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
)

/** Aba do navegador com o ícone, no tema claro ou escuro. */
const TabMock: React.FC<{ icon?: string; name: string; dark?: boolean }> = ({ icon, name, dark }) => (
  <div className={cn('flex items-end px-3 pt-2', dark ? 'bg-[#202124]' : 'bg-[#dee1e6]')}>
    <div className={cn('flex h-8 w-44 items-center gap-2 rounded-t-lg px-3', dark ? 'bg-[#35363a] text-gray-100' : 'bg-white text-gray-800')}>
      {icon ? <img src={icon} alt="" className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0 rounded-sm bg-gray-300" />}
      <span className="truncate text-[11px]">{name}</span>
    </div>
  </div>
)

interface SiteIconPanelProps {
  projectId: string
  connection: WordPressConnection
  reload: () => Promise<void>
  onBack: () => void
}

/** Troca o favicon do site: símbolo da marca ou arquivo enviado, fundo, forma e tamanho. */
export const SiteIconPanel: React.FC<SiteIconPanelProps> = ({ projectId, connection, reload, onBack }) => {
  const brand = useBrandStore((s) => s.brand)
  const palette = useMemo(() => featuredPalette(brand), [brand])
  const [options, setOptions] = useState<IconOptions>(() => ({
    source: brand?.logo ? 'brand' : 'upload',
    background: brand?.logo ? palette.background : null,
    shape: 'rounded',
    scale: 0.7,
  }))
  const [render, setRender] = useState<IconRender | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const timer = setTimeout(() => {
      renderIcon(options, brand).then(
        (result) => id === seq.current && setRender(result),
        (err) => id === seq.current && setError(errorText(err))
      )
    }, 80)
    return () => clearTimeout(timer)
  }, [options, brand])

  const set = (patch: Partial<IconOptions>) => setOptions((o) => ({ ...o, ...patch }))

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      set({ source: 'upload', upload: await readImageFile(file, 1024) })
    } catch (err) {
      setError(errorText(err))
    }
  }

  const save = async () => {
    if (!render) return
    setSaving(true)
    setError(null)
    try {
      await saveSiteIcon(connection, render.image)
      // Relê o site para o ícone novo aparecer aqui e no botão do header
      await refreshConnection(projectId, connection).catch(() => undefined)
      await reload()
      toast.success('Ícone do site trocado', { description: 'O navegador pode levar um tempo para mostrar o novo, porque guarda o antigo.' })
      onBack()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const blocked = connection.can.manageOptions === false
  const hasImage = options.source === 'brand' ? !!brand?.logo : !!options.upload
  const warnings = render?.warnings ?? []

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ícone do site</DialogTitle>
        <DialogDescription>O favicon de {connection.site.name}: aparece na aba do navegador, nos favoritos e na tela do celular.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <div className={cn('flex aspect-square items-center justify-center overflow-hidden rounded-lg border', CHECKER)}>
            {render && hasImage && <img src={render.image} alt="Prévia do ícone" className="h-full w-full" />}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <TabMock icon={hasImage ? render?.image : undefined} name={connection.site.name} />
            <TabMock icon={hasImage ? render?.image : undefined} name={connection.site.name} dark />
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-gradient-to-br from-slate-700 to-slate-900 px-3 py-3">
            {render && hasImage ? (
              <img src={render.image} alt="" className="h-12 w-12 rounded-[12px] bg-white/10" />
            ) : (
              <span className="h-12 w-12 rounded-[12px] bg-white/10" />
            )}
            <span className="text-[11px] leading-4 text-white/80">Na tela do celular</span>
          </div>
        </div>

        <div className="grid content-start gap-5">
          <Segmented
            label="Imagem"
            value={options.source}
            onChange={(source) => (source === 'upload' && !options.upload ? fileRef.current?.click() : set({ source }))}
            options={[
              { value: 'brand', label: 'Símbolo da marca' },
              { value: 'upload', label: 'Arquivo enviado' },
            ]}
          />
          {options.source === 'upload' && (
            <Button type="button" variant="outline" size="sm" className="h-8 w-fit text-xs" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              {options.upload ? 'Trocar o arquivo' : 'Enviar arquivo'}
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />

          <div className="grid gap-2">
            <Label>Fundo</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fundo">
              <button
                type="button"
                role="radio"
                aria-checked={options.background === null}
                aria-label="Transparente"
                title="Transparente"
                onClick={() => set({ background: null })}
                className={cn(
                  'h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
                  CHECKER,
                  options.background === null && 'ring-2 ring-gray-900 ring-offset-2'
                )}
              />
              {palette.colors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={options.background === hex}
                  aria-label={hex}
                  title={hex}
                  onClick={() => set({ background: hex })}
                  className={cn(
                    'h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
                    options.background === hex && 'ring-2 ring-gray-900 ring-offset-2'
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <Segmented label="Forma" value={options.shape} onChange={(shape) => set({ shape })} options={SHAPES} />

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="icon-scale">Tamanho da imagem</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{Math.round(options.scale * 100)}%</span>
            </div>
            <input
              id="icon-scale"
              type="range"
              min={40}
              max={100}
              step={5}
              value={Math.round(options.scale * 100)}
              onChange={(e) => set({ scale: Number(e.target.value) / 100 })}
              className="accent-gray-900"
            />
          </div>

          {connection.site.iconUrl && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Hoje o site usa
              <img src={connection.site.iconUrl} alt="Ícone atual do site" className="h-5 w-5 rounded-sm" />
            </p>
          )}
          {warnings.map((warning) => (
            <p key={warning} className="flex gap-2 text-xs text-amber-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {warning}
            </p>
          ))}
          {blocked && <p className="text-xs text-destructive">Só um administrador do WordPress pode trocar o ícone do site. Conecte com um usuário administrador.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
          Voltar
        </Button>
        <Button type="button" onClick={save} disabled={saving || blocked || !render || !hasImage}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {saving ? 'Gravando…' : 'Gravar no site'}
        </Button>
      </DialogFooter>
    </>
  )
}
