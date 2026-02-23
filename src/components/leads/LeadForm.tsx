import React from 'react';
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
import type { Lead, LeadFormValues, LeadSource, LeadStatus } from '@/types/leads';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_CONFIG } from '@/types/leads';

const schema = z.object({
  name:            z.string().min(1, 'Nome é obrigatório').max(200),
  company:         z.string().max(200).optional().default(''),
  email:           z
    .string()
    .optional()
    .default('')
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email inválido'),
  phone:           z.string().max(30).optional().default(''),
  source:          z.enum(['indication', 'instagram', 'linkedin', 'website', 'cold_outreach', 'other']),
  estimated_value: z.string().optional().default(''),
  tags:            z.string().optional().default(''),
  notes:           z.string().max(1000).optional().default(''),
  kanban_status:   z.enum(['new_lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost']),
});

interface Props {
  defaultValues?: Lead;
  initialStatus?: LeadStatus;
  onSubmit: (values: LeadFormValues) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const LeadForm: React.FC<Props> = ({
  defaultValues,
  initialStatus = 'new_lead',
  onSubmit,
  isLoading,
  onCancel,
}) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:            defaultValues?.name ?? '',
      company:         defaultValues?.company ?? '',
      email:           defaultValues?.email ?? '',
      phone:           defaultValues?.phone ?? '',
      source:          defaultValues?.source ?? 'other',
      estimated_value: defaultValues?.estimated_value?.toString().replace('.', ',') ?? '',
      tags:            defaultValues?.tags?.join(', ') ?? '',
      notes:           defaultValues?.notes ?? '',
      kanban_status:   defaultValues?.kanban_status ?? initialStatus,
    },
  });

  const source = watch('source');
  const kanbanStatus = watch('kanban_status');
  const isEditMode = !!defaultValues;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Nome *</Label>
        <Input id="lead-name" placeholder="Ex: João Silva" {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      {/* Company + Source */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lead-company">Empresa</Label>
          <Input id="lead-company" placeholder="Ex: Empresa Ltda" {...register('company')} />
        </div>
        <div className="space-y-1.5">
          <Label>Fonte</Label>
          <Select
            value={source}
            onValueChange={(v) => setValue('source', v as LeadSource)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lead-email">Email</Label>
          <Input id="lead-email" type="email" placeholder="contato@empresa.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-phone">Telefone / WhatsApp</Label>
          <Input id="lead-phone" placeholder="(11) 99999-9999" {...register('phone')} />
        </div>
      </div>

      {/* Estimated value + Status (status only in edit mode) */}
      <div className={`grid gap-3 ${isEditMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-1.5">
          <Label htmlFor="lead-value">Valor estimado (R$)</Label>
          <Input id="lead-value" placeholder="Ex: 5.000,00" {...register('estimated_value')} />
        </div>
        {isEditMode && (
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={kanbanStatus}
              onValueChange={(v) => setValue('kanban_status', v as LeadStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(LEAD_STATUS_CONFIG) as [LeadStatus, { label: string }][]).map(
                  ([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="lead-tags">Tags</Label>
        <Input
          id="lead-tags"
          placeholder="Ex: design, urgente, e-commerce"
          {...register('tags')}
        />
        <p className="text-xs text-muted-foreground">Separe as tags por vírgula</p>
      </div>

      {/* Quick note */}
      <div className="space-y-1.5">
        <Label htmlFor="lead-notes">Nota rápida</Label>
        <Textarea
          id="lead-notes"
          placeholder="Observações gerais sobre o lead..."
          rows={2}
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? 'Salvar alterações' : 'Criar lead'}
        </Button>
      </div>
    </form>
  );
};

export default LeadForm;
