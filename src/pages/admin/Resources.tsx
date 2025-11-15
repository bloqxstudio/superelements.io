import { useState } from 'react';
import { useResources } from '@/hooks/useResources';
import { useResourceMutations } from '@/hooks/useResourceMutations';
import { ResourceTable } from '@/components/admin/ResourceTable';
import { ResourceForm } from '@/components/admin/ResourceForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, AlertCircle } from 'lucide-react';
import type { Resource } from '@/hooks/useResources';

const AdminResources = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const { data: resources, isLoading, error } = useResources({ includeInactive: true });
  const { createResource, updateResource, deleteResource, toggleActive } = useResourceMutations();

  const handleCreate = () => {
    setEditingResource(null);
    setIsFormOpen(true);
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setIsFormOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingResource) {
      await updateResource.mutateAsync({ id: editingResource.id, ...values });
    } else {
      await createResource.mutateAsync(values);
    }
    setIsFormOpen(false);
    setEditingResource(null);
  };

  const handleDelete = async (id: string) => {
    await deleteResource.mutateAsync(id);
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    await toggleActive.mutateAsync({ id, is_active });
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar recursos</h2>
          <p className="text-muted-foreground">Tente novamente mais tarde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Gerenciar Recursos</h1>
          <p className="text-muted-foreground text-lg">
            Gerencie downloads e links disponíveis para usuários PRO
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Recurso
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : resources ? (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Total: {resources.length} recurso{resources.length !== 1 ? 's' : ''}
            {' • '}
            Ativos: {resources.filter(r => r.is_active).length}
          </div>
          <ResourceTable
            resources={resources}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        </>
      ) : null}

      <ResourceForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        resource={editingResource}
        onSubmit={handleSubmit}
        isLoading={createResource.isPending || updateResource.isPending}
      />
    </div>
  );
};

export default AdminResources;
