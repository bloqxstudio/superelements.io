import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Pencil, Trash2, Settings2 } from 'lucide-react';
import { useServiceCatalog, useServiceCatalogMutations } from '@/hooks/useServiceCatalog';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import ServiceCatalogForm from './ServiceCatalogForm';
import type { ServiceCatalogItem } from '@/types/projects';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ServiceCatalogManager: React.FC<Props> = ({ open, onOpenChange }) => {
  const { activeWorkspace } = useWorkspace();
  const { data: services = [], isLoading } = useServiceCatalog(activeWorkspace?.id);
  const { createService, updateService, deleteService } = useServiceCatalogMutations();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceCatalogItem | null>(null);

  const handleCreate = async (values: Parameters<typeof createService.mutateAsync>[0]) => {
    await createService.mutateAsync(values);
    setShowForm(false);
  };

  const handleUpdate = async (values: Parameters<typeof updateService.mutateAsync>[0]['values']) => {
    if (!editing) return;
    await updateService.mutateAsync({ id: editing.id, values });
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este serviço do catálogo?')) return;
    deleteService.mutate(id);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Catálogo de Serviços
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form: criar novo ou editar */}
          {(showForm || editing) && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">
                {editing ? 'Editar serviço' : 'Novo serviço'}
              </p>
              <ServiceCatalogForm
                defaultValues={editing ?? undefined}
                onSubmit={editing ? handleUpdate : handleCreate}
                isLoading={createService.isPending || updateService.isPending}
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            </div>
          )}

          {/* Botão adicionar */}
          {!showForm && !editing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar serviço
            </Button>
          )}

          <Separator />

          {/* Lista de serviços */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum serviço cadastrado ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 bg-background"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{service.name}</span>
                      {!service.is_active && (
                        <Badge variant="outline" className="text-xs shrink-0">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(service.default_hourly_rate)}/h
                      {service.description && ` · ${service.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { setEditing(service); setShowForm(false); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(service.id)}
                      disabled={deleteService.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceCatalogManager;
