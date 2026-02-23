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
import { KANBAN_COLUMNS } from '@/types/projects';
import type { ProjectTask, TaskFormValues, TaskStatus, BillingStatus, ServiceCatalogItem } from '@/types/projects';

const schema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(300),
  description: z.string().max(5000).optional().default(''),
  kanban_status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'billed']),
  service_catalog_id: z.string().optional().default(''),
  hourly_rate: z.string().optional().default(''),
  estimated_hours: z.string().optional().default(''),
  actual_hours: z.string().optional().default('0'),
  assignee_id: z.string().optional().default(''),
  due_date: z.string().optional().default(''),
  billing_status: z.enum(['unbilled', 'billed']).default('unbilled'),
});

interface WorkspaceMember {
  id: string;
  email: string;
}

interface Props {
  defaultValues?: ProjectTask;
  defaultStatus?: TaskStatus;
  services?: ServiceCatalogItem[];
  members?: WorkspaceMember[];
  onSubmit: (values: TaskFormValues) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
}

const TaskForm: React.FC<Props> = ({
  defaultValues,
  defaultStatus = 'backlog',
  services = [],
  members = [],
  onSubmit,
  isLoading,
  onCancel,
  onDelete,
}) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      kanban_status: defaultValues?.kanban_status ?? defaultStatus,
      service_catalog_id: defaultValues?.service_catalog_id ?? '',
      hourly_rate: defaultValues?.hourly_rate?.toString().replace('.', ',') ?? '',
      estimated_hours: defaultValues?.estimated_hours?.toString().replace('.', ',') ?? '',
      actual_hours: defaultValues?.actual_hours?.toString().replace('.', ',') ?? '0',
      assignee_id: defaultValues?.assignee_id ?? '',
      due_date: defaultValues?.due_date ?? '',
      billing_status: (defaultValues?.billing_status as BillingStatus) ?? 'unbilled',
    },
  });

  const serviceCatalogId = watch('service_catalog_id');
  const kanbanStatus = watch('kanban_status');
  const billingStatus = watch('billing_status');

  // Auto-fill hourly_rate from selected service default (only if field is empty or unchanged)
  useEffect(() => {
    if (!serviceCatalogId) return;
    const service = services.find((s) => s.id === serviceCatalogId);
    if (!service) return;
    // Only auto-fill if there's no override already set from a previous session
    const currentRate = watch('hourly_rate');
    if (!currentRate || currentRate === '') {
      setValue('hourly_rate', service.default_hourly_rate.toString().replace('.', ','));
    }
  }, [serviceCatalogId, services]);

  const handleServiceChange = (value: string) => {
    const serviceId = value === '_none' ? '' : value;
    setValue('service_catalog_id', serviceId);
    if (serviceId) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        setValue('hourly_rate', service.default_hourly_rate.toString().replace('.', ','));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Título *</Label>
        <Input
          id="task-title"
          placeholder="Ex: Criar página inicial"
          {...register('title')}
        />
        {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-description">Descrição</Label>
        <Textarea
          id="task-description"
          placeholder="Detalhes, requisitos, notas..."
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={kanbanStatus}
            onValueChange={(v) => setValue('kanban_status', v as TaskStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_COLUMNS.map((col) => (
                <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-due">Prazo</Label>
          <Input id="task-due" type="date" {...register('due_date')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Serviço</Label>
          <Select
            value={serviceCatalogId || '_none'}
            onValueChange={handleServiceChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sem serviço</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-rate">Taxa horária (R$/h)</Label>
          <Input
            id="task-rate"
            placeholder="Padrão do serviço"
            {...register('hourly_rate')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="task-estimated">Horas estimadas</Label>
          <Input id="task-estimated" placeholder="0" {...register('estimated_hours')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-actual">Horas realizadas</Label>
          <Input id="task-actual" placeholder="0" {...register('actual_hours')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {members.length > 0 && (
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select
              value={watch('assignee_id') || '_none'}
              onValueChange={(v) => setValue('assignee_id', v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem responsável</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.email.split('@')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Status de cobrança</Label>
          <Select
            value={billingStatus}
            onValueChange={(v) => setValue('billing_status', v as BillingStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unbilled">Não faturado</SelectItem>
              <SelectItem value="billed">Faturado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            Remover tarefa
          </Button>
        ) : <div />}

        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {defaultValues ? 'Salvar alterações' : 'Criar tarefa'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default TaskForm;
