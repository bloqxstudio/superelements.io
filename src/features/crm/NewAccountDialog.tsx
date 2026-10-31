import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/features/projects/projectStore'
import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from './crmStore'
import { ModuleToggles } from './ModuleToggles'
import type { ModuleId } from './modules'
import { createAccount } from './teams'
import { FIELD } from './ui'

/**
 * Cadastro básico de uma conta nova (uma empresa-cliente): nome, segmento, site e
 * contato, mais os módulos que já nascem ligados. A conexão de cada serviço
 * (Instagram, WhatsApp, site) é feita depois, dentro da conta.
 */

const EMPTY = { name: '', segment: '', website: '', contactName: '', contactEmail: '', contactPhone: '' }

export const NewAccountDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (teamId: string) => void }> = ({ open, onOpenChange, onCreated }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const load = useCrm((s) => s.load)
  const select = useCrm((s) => s.select)
  const [form, setForm] = useState(EMPTY)
  const [modules, setModules] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setModules({})
  }, [open])

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setSaving(true)
    try {
      const id = await createAccount({ ...form, modules })
      await load(user.id, true)
      await select(id)
      onOpenChange(false)
      onCreated?.(id)
      // Conta de cliente tem um site só: o projeto nasce junto e abre com o guia de instalação
      if (modules.projetos !== false) {
        try {
          const project = await useProjectStore.getState().create({ name: form.name.trim(), context: form.website.trim() ? `Site: ${form.website.trim()}` : '' })
          toast.success(`Conta ${form.name.trim()} criada`, { description: 'Siga o guia: conectar o site, instalar o plugin e importar as páginas.' })
          navigate(`/projetos/${project.id}?configurar=1`)
          return
        } catch (error) {
          console.error('[contas] falha ao criar o projeto da conta', error)
        }
      }
      toast.success(`Conta ${form.name.trim()} criada`, { description: 'Você já está nela. Convide as pessoas em Equipe e conecte os serviços.' })
    } catch (error) {
      toast.error('Não foi possível criar a conta', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
          <DialogDescription>Uma empresa-cliente com o ambiente separado: pessoas, clientes e conexões só dela.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-700">Nome da empresa</span>
              <input value={form.name} onChange={set('name')} maxLength={120} required autoFocus className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-gray-700">Segmento</span>
              <input value={form.segment} onChange={set('segment')} maxLength={120} placeholder="Ex.: escritório de arquitetura" className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-gray-700">Site</span>
              <input value={form.website} onChange={set('website')} maxLength={200} placeholder="https://" className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-gray-700">Pessoa de contato</span>
              <input value={form.contactName} onChange={set('contactName')} maxLength={120} className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-gray-700">E-mail do contato</span>
              <input type="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={160} className={`${FIELD} h-10`} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-700">Telefone ou WhatsApp</span>
              <input value={form.contactPhone} onChange={set('contactPhone')} maxLength={40} className={`${FIELD} h-10`} />
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">Módulos que já nascem ligados</p>
            <ModuleToggles value={modules} onChange={(id: ModuleId, on) => setModules((m) => ({ ...m, [id]: on }))} disabled={saving} />
            <p className="mt-2 text-xs text-gray-500">Dá para mudar depois em Contas. Equipe e cadastro ficam sempre ligados.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
