import React, { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Globe, Loader2, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CampaignLink, directUrl, viewUrl } from '@/features/crm/FormPanels'
import { SLUG_RE, slugify, type CrmForm } from '@/features/crm/forms'
import { cn } from '@/lib/utils'

/**
 * Publicar o formulário no app (o padrão: a página `/f/<endereço>`, destino de anúncio, WhatsApp e bio).
 * Em rascunho, o topo mostra "Publicar"; ao publicar, a pessoa escolhe o endereço e recebe o link pronto
 * para copiar ou ver. Publicado, o topo mostra o link, "Ver formulário" e o menu (mudar endereço,
 * despublicar). Colocar no site (Elementor) continua na própria aba.
 */

const copy = (text: string, what = 'Link copiado') =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(what),
    () => toast.error('Não consegui copiar')
  )

const host = (url: string) => url.replace(/^https?:\/\//, '')

type Props = {
  form: CrmForm
  /** Grava o endereço e publica; lança o erro para a janela mostrar. */
  onPublish: (slug: string) => Promise<void>
  onUnpublish: () => void
}

export const PublishControl: React.FC<Props> = ({ form, onPublish, onUnpublish }) => {
  const [open, setOpen] = useState(false)
  const published = form.status === 'published'
  const url = directUrl(form)

  if (!published) {
    return (
      <>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-gray-600">Rascunho</span>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Globe className="mr-1.5 h-3.5 w-3.5" /> Publicar
        </Button>
        <PublishDialog open={open} onOpenChange={setOpen} form={form} onPublish={onPublish} />
      </>
    )
  }

  return (
    <>
      <div className="flex min-w-0 items-center rounded-lg border border-gray-200 bg-white text-sm">
        <span className="flex items-center gap-1.5 border-r border-gray-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> No ar
        </span>
        <button type="button" onClick={() => void copy(url)} className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-gray-700 hover:bg-zinc-50" title="Copiar o link">
          <span className="max-w-[260px] truncate">{host(url)}</span>
          <Copy className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        </button>
      </div>
      <Button size="sm" variant="outline" asChild>
        <a href={viewUrl(form)} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver formulário
        </a>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="px-2" aria-label="Mais opções de publicação">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)}>Endereço e link de campanha</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onSelect={onUnpublish}>
            Despublicar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PublishDialog open={open} onOpenChange={setOpen} form={form} onPublish={onPublish} />
    </>
  )
}

const PublishDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; form: CrmForm; onPublish: (slug: string) => Promise<void> }> = ({ open, onOpenChange, form, onPublish }) => {
  const published = form.status === 'published'
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // Acabou de publicar: a janela troca para o link pronto
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(form.slug || slugify(form.name))
    setError(undefined)
    setDone(published)
    // Só ao abrir: depois, quem manda é o que a pessoa digita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const clean = slugify(value)
  const bad = !SLUG_RE.test(clean)
  const changed = clean !== (form.slug ?? '')

  const submit = async () => {
    if (bad || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await onPublish(clean)
      setValue(clean)
      setDone(true)
      toast.success(published ? 'Endereço salvo' : 'Formulário publicado')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const base = host(directUrl({ id: form.id, slug: undefined })).replace(/\/f\/.*$/, '')
  const editing = !done || changed

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{done && !changed ? 'Formulário no ar' : published ? 'Endereço do formulário' : 'Publicar formulário'}</DialogTitle>
          <DialogDescription>
            {done && !changed ? 'Use este link no anúncio, no WhatsApp ou na bio. Cada resposta chega como lead em Oportunidades.' : 'Escolha o endereço da página. O formulário fica no ar no app, sem precisar de site.'}
          </DialogDescription>
        </DialogHeader>

        <div>
          <label htmlFor="publish-slug" className="mb-1 block text-xs font-medium text-gray-600">
            Endereço
          </label>
          <div className={cn('flex items-center rounded-lg border bg-white text-sm focus-within:ring-2 focus-within:ring-ring', (error || (bad && clean !== '')) ? 'border-rose-400' : 'border-gray-200')}>
            <span className="shrink-0 select-none pl-3 text-gray-400">{base}/f/</span>
            <input
              id="publish-slug"
              autoFocus={!done}
              className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-gray-900 placeholder:text-gray-400 focus:outline-none"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                setError(undefined)
              }}
              onBlur={() => setValue(clean)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
              placeholder="diagnostico"
              spellCheck={false}
              aria-invalid={!!error || bad}
            />
          </div>
          <p className={cn('mt-1 text-xs', error || (bad && clean !== '') ? 'text-rose-600' : 'text-gray-500')}>
            {error ?? (bad ? 'Use de 3 a 60 letras minúsculas, números e hífens.' : published && changed ? 'O endereço antigo para de abrir: atualize os anúncios e as conversões personalizadas da Meta.' : 'Letras minúsculas, números e hífens. Cada endereço é único.')}
          </p>
        </div>

        {editing ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={bad || busy || (published && !changed)}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Globe className="mr-1.5 h-4 w-4" />}
              {published ? 'Salvar endereço' : 'Publicar'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 pl-3 ring-1 ring-inset ring-emerald-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <code className="min-w-0 flex-1 break-all text-sm text-gray-900">{directUrl(form)}</code>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" asChild>
                <a href={viewUrl(form)} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Ver formulário
                </a>
              </Button>
              <Button onClick={() => void copy(directUrl(form))}>
                <Copy className="mr-1.5 h-4 w-4" /> Copiar link
              </Button>
            </div>
            <CampaignLink form={form} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
