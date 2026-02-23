import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Project, ProjectFormValues, ProjectStatus } from '@/types/projects';
import { PROJECT_STATUS_CONFIG } from '@/types/projects';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(2000).optional().default(''),
  client_account_id: z.string().optional().default(''),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
  budget: z.string().optional().default(''),
  deadline: z.string().optional().default(''),
});

interface ClientAccount {
  id: string;
  name: string;
}

interface Props {
  defaultValues?: Project;
  clientAccounts?: ClientAccount[];
  onSubmit: (values: ProjectFormValues) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const ProjectForm: React.FC<Props> = ({
  defaultValues,
  clientAccounts = [],
  onSubmit,
  isLoading,
  onCancel,
}) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      client_account_id: defaultValues?.client_account_id ?? '',
      status: defaultValues?.status ?? 'active',
      budget: defaultValues?.budget?.toString().replace('.', ',') ?? '',
      deadline: defaultValues?.deadline ?? '',
    },
  });

  const status = watch('status');
  const clientAccountId = watch('client_account_id');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="proj-name">Nome do projeto *</Label>
        <Input id="proj-name" placeholder="Ex: Site institucional" {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proj-description">Descrição</Label>
        <Textarea
          id="proj-description"
          placeholder="Objetivo, escopo, contexto..."
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setValue('status', v as ProjectStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(PROJECT_STATUS_CONFIG) as [ProjectStatus, { label: string }][]).map(
                ([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="proj-deadline">Prazo</Label>
          <Input id="proj-deadline" type="date" {...register('deadline')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cliente (opcional)</Label>
          <Select
            value={clientAccountId}
            onValueChange={(v) => setValue('client_account_id', v === '_none' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sem cliente</SelectItem>
              {clientAccounts.map((ca) => (
                <SelectItem key={ca.id} value={ca.id}>
                  {ca.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="proj-budget">Orçamento (R$)</Label>
          <Input id="proj-budget" placeholder="Ex: 3.500,00" {...register('budget')} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? 'Salvar alterações' : 'Criar projeto'}
        </Button>
      </div>
    </form>
  );
};

export default ProjectForm;
