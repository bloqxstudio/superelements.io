import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { projectKeys } from '@/hooks/useProjects';
import type { ProjectTask, TaskFormValues, TaskStatus } from '@/types/projects';

// ── Query key factory ─────────────────────────────────────────────────────────

export const taskKeys = {
  all: (projectId: string) => ['project-tasks', projectId] as const,
};

// ── Query hook ────────────────────────────────────────────────────────────────

export const useProjectTasks = (projectId: string | undefined) =>
  useQuery({
    queryKey: taskKeys.all(projectId ?? ''),
    enabled: !!projectId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          service_catalog:service_catalog(id, name, default_hourly_rate),
          assignee:assignee_id(id, email)
        `)
        .eq('project_id', projectId!)
        .order('kanban_status', { ascending: true })
        .order('position', { ascending: true });
      if (error) throw error;
      return data as ProjectTask[];
    },
  });

// ── Mutation hooks ────────────────────────────────────────────────────────────

export const useProjectTaskMutations = (projectId: string) => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) });
    // Also invalidate the combined project+tasks query used by ProjectDetail
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
  };

  const createTask = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      // Determine next position in the target column
      const { data: existing } = await supabase
        .from('project_tasks')
        .select('position')
        .eq('project_id', projectId)
        .eq('kanban_status', values.kanban_status)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: projectId,
          workspace_id: wsId!,
          title: values.title,
          description: values.description || null,
          kanban_status: values.kanban_status,
          position: nextPosition,
          service_catalog_id: values.service_catalog_id || null,
          hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate.replace(',', '.')) : null,
          estimated_hours: values.estimated_hours ? parseFloat(values.estimated_hours.replace(',', '.')) : null,
          actual_hours: values.actual_hours ? parseFloat(values.actual_hours.replace(',', '.')) : 0,
          assignee_id: values.assignee_id || null,
          due_date: values.due_date || null,
          billing_status: values.billing_status,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Tarefa criada!');
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<TaskFormValues> }) => {
      const payload: Record<string, unknown> = {};
      if (values.title !== undefined) payload.title = values.title;
      if (values.description !== undefined) payload.description = values.description || null;
      if (values.kanban_status !== undefined) payload.kanban_status = values.kanban_status;
      if (values.service_catalog_id !== undefined) payload.service_catalog_id = values.service_catalog_id || null;
      if (values.hourly_rate !== undefined) payload.hourly_rate = values.hourly_rate ? parseFloat(values.hourly_rate.replace(',', '.')) : null;
      if (values.estimated_hours !== undefined) payload.estimated_hours = values.estimated_hours ? parseFloat(values.estimated_hours.replace(',', '.')) : null;
      if (values.actual_hours !== undefined) payload.actual_hours = values.actual_hours ? parseFloat(values.actual_hours.replace(',', '.')) : 0;
      if (values.assignee_id !== undefined) payload.assignee_id = values.assignee_id || null;
      if (values.due_date !== undefined) payload.due_date = values.due_date || null;
      if (values.billing_status !== undefined) payload.billing_status = values.billing_status;

      const { data, error } = await supabase
        .from('project_tasks')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Tarefa atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  });

  // Specialized mutation for drag & drop: batch-update status and positions
  const moveTask = useMutation({
    mutationFn: async (
      affectedTasks: Array<{ id: string; kanban_status: TaskStatus; position: number }>
    ) => {
      await Promise.all(
        affectedTasks.map((t) =>
          supabase
            .from('project_tasks')
            .update({ kanban_status: t.kanban_status, position: t.position })
            .eq('id', t.id)
        )
      );
    },
    onSuccess: () => {
      invalidateTasks();
    },
    onError: () => {
      invalidateTasks();
      toast.error('Erro ao mover tarefa. Revertendo...');
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Tarefa removida');
    },
    onError: () => toast.error('Erro ao remover tarefa'),
  });

  return { createTask, updateTask, moveTask, deleteTask };
};
