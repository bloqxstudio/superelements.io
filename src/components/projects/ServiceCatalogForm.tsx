import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { ServiceCatalogItem, ServiceCatalogFormValues } from '@/types/projects';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(1000).optional().default(''),
  default_hourly_rate: z
    .string()
    .min(1, 'Taxa horária é obrigatória')
    .refine((v) => !isNaN(parseFloat(v.replace(',', '.'))), 'Valor inválido'),
  is_active: z.boolean().default(true),
});

interface Props {
  defaultValues?: ServiceCatalogItem;
  onSubmit: (values: ServiceCatalogFormValues) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const ServiceCatalogForm: React.FC<Props> = ({ defaultValues, onSubmit, isLoading, onCancel }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ServiceCatalogFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      default_hourly_rate: defaultValues?.default_hourly_rate?.toString().replace('.', ',') ?? '',
      is_active: defaultValues?.is_active ?? true,
    },
  });

  const isActive = watch('is_active');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sc-name">Nome do serviço *</Label>
        <Input
          id="sc-name"
          placeholder="Ex: Web Design WordPress/Elementor"
          {...register('name')}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-description">Descrição</Label>
        <Textarea
          id="sc-description"
          placeholder="Descreva o que inclui este serviço..."
          rows={2}
          {...register('description')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-rate">Taxa horária padrão (R$/h) *</Label>
        <Input
          id="sc-rate"
          placeholder="Ex: 150,00"
          {...register('default_hourly_rate')}
        />
        {errors.default_hourly_rate && (
          <p className="text-xs text-red-500">{errors.default_hourly_rate.message}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="sc-active"
          checked={isActive}
          onCheckedChange={(v) => setValue('is_active', v)}
        />
        <Label htmlFor="sc-active" className="cursor-pointer">
          Serviço ativo
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? 'Salvar alterações' : 'Criar serviço'}
        </Button>
      </div>
    </form>
  );
};

export default ServiceCatalogForm;
