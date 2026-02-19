import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Resource } from './useResources';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type ResourceInput = Omit<Resource, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'workspace_id'>;

export const useResourceMutations = () => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  const createResource = useMutation({
    mutationFn: async (input: ResourceInput) => {
      if (!activeWorkspace?.id) {
        throw new Error('Workspace não selecionado');
      }

      const { data, error } = await supabase
        .from('resources')
        .insert([{ ...input, workspace_id: activeWorkspace.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-categories', activeWorkspace?.id] });
      toast.success('Recurso criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating resource:', error);
      toast.error('Erro ao criar recurso');
    },
  });

  const updateResource = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Resource> & { id: string }) => {
      if (!activeWorkspace?.id) {
        throw new Error('Workspace não selecionado');
      }

      const { data, error } = await supabase
        .from('resources')
        .update(input)
        .eq('id', id)
        .eq('workspace_id', activeWorkspace.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-categories', activeWorkspace?.id] });
      toast.success('Recurso atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating resource:', error);
      toast.error('Erro ao atualizar recurso');
    },
  });

  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      if (!activeWorkspace?.id) {
        throw new Error('Workspace não selecionado');
      }

      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id)
        .eq('workspace_id', activeWorkspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-categories', activeWorkspace?.id] });
      toast.success('Recurso deletado com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting resource:', error);
      toast.error('Erro ao deletar recurso');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!activeWorkspace?.id) {
        throw new Error('Workspace não selecionado');
      }

      const { data, error } = await supabase
        .from('resources')
        .update({ is_active })
        .eq('id', id)
        .eq('workspace_id', activeWorkspace.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error toggling resource:', error);
      toast.error('Erro ao atualizar status');
    },
  });

  return {
    createResource,
    updateResource,
    deleteResource,
    toggleActive,
  };
};
