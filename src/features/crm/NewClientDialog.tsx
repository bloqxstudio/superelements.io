import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { STAGES, type Opportunity, type Stage } from '@/features/prospects/funnel'
import { createClient, saveContact } from './clients'
import { createOpportunity, leadForClient } from './opportunities'
import { SOURCES, STATUSES, type Client, type ClientSource, type ClientStatus } from './types'
import { FIELD } from './ui'
import { cn } from '@/lib/utils'

/**
 * Cadastro de um cliente que não veio da Prospecção (indicação, Instagram,
 * anúncio…), com a pessoa de contato e, se quiser, já no funil.
 */

const EMPTY = { name: '', segment: '', city: '', whatsapp: '', email: '', website: '', instagram: '', contact: '', source: 'indicacao' as ClientSource, status: 'lead' as ClientStatus }

export const NewClientDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Começa marcado "pôr no funil" (o botão da tela de Oportunidades). */
  toFunnel?: boolean
  onCreated: (client: Client, opportunity?: Opportunity) => void
}> = ({ open, onOpenChange, toFunnel = false, onCreated }) => {
  const [form, setForm] = useState(EMPTY)
  const [funnel, setFunnel] = useState(toFunnel)
  const [stage, setStage] = useState<Stage>('contatado')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setFunnel(toFunnel)
    setStage('contatado')
  }, [open, toFunnel])

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const client = await createClient({
        name: form.name,
        segment: form.segment,
        city: form.city,
        whatsapp: form.whatsapp,
        phone: form.whatsapp,
        email: form.email,
        website: form.website,
        instagram: form.instagram,
        source: form.source,
        status: form.status,
      })
      if (form.contact.trim()) await saveContact(client.id, { name: form.contact.trim(), whatsapp: form.whatsapp || undefined, email: form.email || undefined, primary: true })
      const opportunity = funnel ? await createOpportunity(client.id, { stage, lead: leadForClient(client), region: form.city }) : undefined
      toast.success(`${client.name} cadastrado${opportunity ? ' e no funil' : ''}`)
      onCreated(client, opportunity)
      onOpenChange(false)
    } catch (error) {
      toast.error('Não foi possível cadastrar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const input = (key: keyof typeof EMPTY, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input value={form[key]} onChange={set(key)} className={cn(FIELD, 'h-9')} {...props} />
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>Uma empresa ou pessoa com quem a equipe conversa. Dá para completar a ficha depois.</DialogDescription>
        </DialogHeader>
        <form id="novo-cliente" onSubmit={(e) => void submit(e)} className="grid gap-3">
          {input('name', 'Nome da empresa ou da pessoa', { required: true, autoFocus: true, maxLength: 200, placeholder: 'Ex.: Clínica Sorriso' })}
          <div className="grid gap-3 sm:grid-cols-2">
            {input('contact', 'Pessoa de contato', { placeholder: 'Ex.: Dra. Ana' })}
            {input('segment', 'Segmento', { placeholder: 'Ex.: Dentistas' })}
            {input('whatsapp', 'WhatsApp ou telefone', { type: 'tel', inputMode: 'tel', placeholder: '(51) 99999-9999' })}
            {input('email', 'E-mail', { type: 'email' })}
            {input('website', 'Site', { placeholder: 'exemplo.com.br' })}
            {input('instagram', 'Instagram', { placeholder: '@perfil' })}
            {input('city', 'Cidade', { placeholder: 'São Leopoldo, RS' })}
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-700">Como chegou</span>
              <select value={form.source} onChange={set('source')} className={cn(FIELD, 'h-9')}>
                {SOURCES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-700">Situação</span>
            <select value={form.status} onChange={set('status')} className={cn(FIELD, 'h-9')}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.hint}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-gray-200 bg-zinc-50 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={funnel} onChange={(e) => setFunnel(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Pôr no funil como oportunidade
            </label>
            {funnel && (
              <label className="mt-2 grid gap-1">
                <span className="text-xs font-medium text-gray-700">Etapa</span>
                <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={cn(FIELD, 'h-9')}>
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="novo-cliente" disabled={saving || !form.name.trim()} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
