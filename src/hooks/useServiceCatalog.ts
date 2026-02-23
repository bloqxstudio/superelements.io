import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { ServiceCatalogItem, ServiceCatalogFormValues } from '@/types/projects';

// ── Query key factory ─────────────────────────────────────────────────────────

export const serviceKeys = {
  all:    (wsId: string) => ['service-catalog', wsId] as const,
  active: (wsId: string) => ['service-catalog-active', wsId] as const,
};

// ── Query hooks ───────────────────────────────────────────────────────────────

export const useServiceCatalog = (workspaceId: string | undefined) =>
  useQuery({
    queryKey: serviceKeys.all(workspaceId ?? ''),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as ServiceCatalogItem[];
    },
  });

export const useActiveServiceCatalog = (workspaceId: string | undefined) =>
  useQuery({
    queryKey: serviceKeys.active(workspaceId ?? ''),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as ServiceCatalogItem[];
    },
  });

// ── Mutation hooks ────────────────────────────────────────────────────────────

export const useServiceCatalogMutations = () => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: serviceKeys.all(wsId!) });
    queryClient.invalidateQueries({ queryKey: serviceKeys.active(wsId!) });
  };

  const createService = useMutation({
    mutationFn: async (values: ServiceCatalogFormValues) => {
      const { data, error } = await supabase
        .from('service_catalog')
        .insert({
          workspace_id: wsId!,
          name: values.name,
          description: values.description || null,
          default_hourly_rate: parseFloat(values.default_hourly_rate.replace(',', '.')),
          is_active: values.is_active,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Serviço criado!');
    },
    onError: () => toast.error('Erro ao criar serviço'),
  });

  const updateService = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ServiceCatalogFormValues> }) => {
      const payload: Record<string, unknown> = {};
      if (values.name !== undefined) payload.name = values.name;
      if (values.description !== undefined) payload.description = values.description || null;
      if (values.default_hourly_rate !== undefined) payload.default_hourly_rate = parseFloat(values.default_hourly_rate.replace(',', '.'));
      if (values.is_active !== undefined) payload.is_active = values.is_active;

      const { data, error } = await supabase
        .from('service_catalog')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Serviço atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar serviço'),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_catalog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Serviço removido');
    },
    onError: () => toast.error('Erro ao remover serviço'),
  });

  return { createService, updateService, deleteService };
};
