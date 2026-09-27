import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, CircleAlert, FileUp, Info, RotateCcw, SwatchBook, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { renderElementorDocument } from '@/engine/elementor'
import { PreviewFrame } from '@/features/elementor-preview/PreviewFrame'
import { applyBrand, brandKit } from './applyBrand'
import { BrandAssets } from './BrandAssets'
import { BrandLayersSummary } from './BrandLayersSummary'
import { useBrandStore, withLogoRatios } from './brandStore'
import { parseDesignMd } from './designMd'
import { FORMAT_LABELS } from './designFormats'
import { DESIGN_MD_EXAMPLES } from './examples'
import { SPECIMEN_ELEMENTS, SPECIMEN_WITH_LOGO } from './specimen'
import { Hint, ToolButton } from '../ToolbarIsland'

/** Botão da barra do Space que abre o DESIGN.md da marca. */
export const BrandButton: React.FC = () => {
  const { source, enabled, brand, logoRatios, setSource, setEnabled, measureLogos } = useBrandStore()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(source)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (draft.trim() ? parseDesignMd(draft) : null), [draft])
  // O rascunho com as proporções do logo, para a amostra mostrar o tamanho que as seções vão ter
  const draftBrand = useMemo(() => withLogoRatios(parsed?.brand ?? null, logoRatios), [parsed, logoRatios])
  useEffect(() => {
    if (open) measureLogos(parsed?.brand)
  }, [open, parsed, measureLogos])
  const dirty = draft !== source
  const active = enabled && brand

  // Amostra: a mesma aplicação que as seções recebem, com as animações rodando
  const [compare, setCompare] = useState(false)
  const [replay, setReplay] = useState(0)
  const specimen = useMemo(() => {
    const b = draftBrand
    if (!b) return null
    const base = b.logo ? SPECIMEN_WITH_LOGO : SPECIMEN_ELEMENTS
    const elements = compare ? base : applyBrand(base, b)
    return renderElementorDocument(elements, { title: 'Amostra da marca', kit: compare ? undefined : brandKit(b), motion: 'play', showUnsupported: false }).document
  }, [draftBrand, compare])

  const openDialog = () => {
    setDraft(source)
    setOpen(true)
  }

  // Arquivo em outro formato: é salvo já convertido para o modelo do Space
  const converted = parsed?.brand && parsed.canonical ? parsed.canonical : null
  const formatLabel = parsed?.format ? FORMAT_LABELS[parsed.format] : ''

  const save = () => {
    setSource(converted ?? draft)
    if (!draft.trim()) {
      toast.success('Marca removida do Space')
    } else {
      setEnabled(true)
      toast.success(`Marca ${parsed?.brand?.name ?? ''} aplicada`, {
        description: `${converted ? `Convertida de ${formatLabel} para o modelo do Space. ` : ''}Canvas, biblioteca, prévia e cópia para o Elementor já usam a marca.`,
      })
    }
    setOpen(false)
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    setDraft(await file.text())
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <Hint
        label={brand ? `Marca ${brand.name}` : 'Marca'}
        hint={
          active
            ? 'Aplicada a todas as seções. Clique para editar o guia.'
            : brand
              ? 'Salva, mas desligada: as seções estão sem a marca.'
              : 'Colar ou importar o DESIGN.md da marca'
        }
      >
        <ToolButton icon={brand?.colors.length ? undefined : SwatchBook} label="Marca" onClick={openDialog} className="max-w-48">
          {brand ? (
            <>
              {/* As cores da marca fazem as vezes do ícone */}
              {brand.colors.length > 0 && (
                <span
                  aria-hidden
                  className={`relative grid h-3.5 w-3.5 shrink-0 grid-cols-2 overflow-hidden rounded-[4px] ${active ? '' : 'opacity-40 grayscale'}`}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} style={{ backgroundColor: brand.colors[i % brand.colors.length].hex }} />
                  ))}
                  {/* Contorno por cima das cores, para as claras não sumirem no branco */}
                  <span className="absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" />
                </span>
              )}
              <span className={`truncate ${active ? 'text-gray-900' : 'text-gray-400'}`}>{brand.name}</span>
            </>
          ) : (
            'Marca'
          )}
        </ToolButton>
      </Hint>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-5xl flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Marca do Space</DialogTitle>
            <DialogDescription>
              Cole ou importe o guia da marca em qualquer formato: DESIGN.md, Google Stitch, design tokens (JSON ou YAML),
              CSS ou texto livre. Cores, tipografia, botões, cantos, cards, sombra, imagens, logo e movimento valem para
              todas as seções: as do canvas, as da biblioteca, a prévia e a cópia para o Elementor. O layout das seções não muda.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-3.5 w-3.5" />
                  Importar arquivo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.markdown,.txt,.json,.yaml,.yml,.css,text/markdown,text/plain,application/json,text/css"
                  className="hidden"
                  onChange={(e) => importFile(e.target.files?.[0])}
                />
                <span className="ml-1 text-[11px] text-muted-foreground">Exemplos:</span>
                {DESIGN_MD_EXAMPLES.map((example) => (
                  <Button
                    key={example.id}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDraft(example.source)}
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                placeholder={'Cole aqui o DESIGN.md, os tokens ou o guia da marca. Ex.:\n\n---\nname: Minha marca\ncolors:\n  background: "#FFFFFF"\n  primary: "#111111"\nfonts:\n  heading: { family: Manrope, weight: 800 }\n  body: Manrope\n---\n\n## Voz\n- ...'}
                className="min-h-[340px] flex-1 resize-none font-mono text-xs leading-relaxed"
              />
            </div>

            <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-xs">
              {!parsed && (
                <p className="text-muted-foreground">
                  Cores, tipografia, botões, cantos, cards, sombra, imagens e movimento são aplicados por código em toda
                  seção, e só o que o guia define. O resto do texto (voz, princípios, o que evitar) fica guardado para a
                  geração de copy. Arquivos em outro formato são convertidos para o modelo do Space ao salvar.
                </p>
              )}

              {converted && (
                <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-2.5 text-sky-900">
                  <p className="flex gap-1.5">
                    <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Lido como <strong>{formatLabel}</strong>. Ao salvar, vira o modelo do Space.
                    </span>
                  </p>
                  <Button variant="outline" size="sm" className="h-7 w-full bg-white text-xs" onClick={() => setDraft(converted)}>
                    Ver a conversão antes de salvar
                  </Button>
                </div>
              )}

              {parsed?.brand &&
                parsed.notes.map((note) => (
                  <p key={note} className="flex gap-1.5 text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {note}
                  </p>
                ))}

              {parsed?.errors.map((error) => (
                <p key={error} className="flex gap-1.5 text-red-600">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              ))}

              {parsed?.brand && (
                <>
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Marca</p>
                      <p className="mt-0.5 truncate text-sm font-semibold">{parsed.brand.name}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="outline" size="sm" className="h-7 bg-background text-xs" onClick={() => setCompare((c) => !c)}>
                        {compare ? 'Ver com a marca' : 'Ver sem a marca'}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 gap-1 bg-background text-xs" onClick={() => setReplay((n) => n + 1)} title="Rever as animações de entrada">
                        <RotateCcw className="h-3 w-3" />
                        Animação
                      </Button>
                    </div>
                  </div>

                  {specimen && (
                    <div className="overflow-hidden rounded-md border bg-white">
                      <PreviewFrame key={`${replay}-${compare}`} html={specimen} viewport="fluid" showSize={false} />
                    </div>
                  )}

                  {draftBrand && <BrandAssets brand={draftBrand} source={converted ?? draft} onChange={setDraft} />}

                  <BrandLayersSummary brand={parsed.brand} />

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Regras de texto</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {parsed.brand.guidelines
                        ? `${parsed.brand.guidelines.split('\n').filter((l) => l.trim()).length} linhas guardadas para a geração de copy.`
                        : 'Nenhuma. Voz e princípios escritos no arquivo entram aqui.'}
                    </p>
                  </div>
                </>
              )}

              {parsed?.warnings.map((warning) => (
                <p key={warning} className="flex gap-1.5 text-amber-700">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {warning}
                </p>
              ))}
            </aside>
          </div>

          <DialogFooter className="flex-row items-center gap-2 sm:justify-between">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!brand} />
              Aplicar a marca salva
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={!dirty || (!!draft.trim() && !parsed?.brand)}>
                {draft.trim() ? 'Salvar marca' : 'Remover marca'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
