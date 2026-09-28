import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Project } from './types'

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem projeto, o diálogo cria um novo. */
  project?: Project
  /** Com promessa, o diálogo espera e só fecha se der certo. */
  onSubmit: (fields: { name: string; context: string }) => void | Promise<void>
}

const CONTEXT_PLACEHOLDER =
  'Quem é o cliente, o que vende e para quem. Tom de voz, ofertas, diferenciais, links, restrições…'

/** Nome e contexto do projeto; o mesmo formulário cria e edita. */
export const ProjectDialog: React.FC<ProjectDialogProps> = ({ open, onOpenChange, project, onSubmit }) => {
  const [name, setName] = useState('')
  const [context, setContext] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setContext(project?.context ?? '')
  }, [open, project])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), context })
      onOpenChange(false)
    } catch {
      // Quem chamou já avisou; o que foi digitado fica no formulário
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{project ? 'Detalhes do projeto' : 'Novo projeto'}</DialogTitle>
            <DialogDescription>
              Um projeto por cliente. A marca (DESIGN.md) entra pelo botão Marca, dentro do canvas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="project-name">Nome</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Processbase"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-context">
              Contexto <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="project-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={CONTEXT_PLACEHOLDER}
              rows={7}
              className="resize-y text-sm"
            />
            <p className="text-xs text-muted-foreground">Fica guardado no projeto para usar depois, como na geração de textos.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? (project ? 'Salvando…' : 'Criando…') : project ? 'Salvar' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
