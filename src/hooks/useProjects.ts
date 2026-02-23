import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Project, ProjectFormValues } from '@/types/projects';

// ── Query key factory ─────────────────────────────────────────────────────────

export const projectKeys = {
  all:    (wsId: string) => ['projects', wsId] as const,
  detail: (id: string)   => ['project', id] as const,
  costs:  (wsId: string) => ['project-costs', wsId] as const,
};

// ── Query hooks ───────────────────────────────────────────────────────────────

export const useProjects = (workspaceId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.all(workspaceId ?? ''),
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client_account:connections(id, name)
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

export interface ProjectWithTasks {
  project: Project;
  tasks: import('@/types/projects').ProjectTask[];
}

export const useProjectWithTasks = (projectId: string | undefined) =>
  useQuery({
    queryKey: [...projectKeys.detail(projectId ?? ''), 'with-tasks'],
    enabled: !!projectId,
    staleTime: 15_000,
    queryFn: async () => {
      const [projectRes, tasksRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, client_account:connections(id, name)')
          .eq('id', projectId!)
          .single(),
        supabase
          .from('project_tasks')
          .select('*, service_catalog:service_catalog(id, name, default_hourly_rate), assignee:assignee_id(id, email)')
          .eq('project_id', projectId!)
          .order('kanban_status', { ascending: true })
          .order('position', { ascending: true }),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (tasksRes.error) throw tasksRes.error;
      return {
        project: projectRes.data as Project,
        tasks: (tasksRes.data ?? []) as import('@/types/projects').ProjectTask[],
      };
    },
  });

export const useProject = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.detail(projectId ?? ''),
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client_account:connections(id, name)
        `)
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data as Project;
    },
  });

export const useProjectCosts = (workspaceId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.costs(workspaceId ?? ''),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_cost_summary')
        .select('*')
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return data;
    },
  });

// ── Mutation hooks ────────────────────────────────────────────────────────────

export const useProjectMutations = () => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const createProject = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          workspace_id: wsId!,
          name: values.name,
          description: values.description || null,
          client_account_id: values.client_account_id || null,
          status: values.status,
          budget: values.budget ? parseFloat(values.budget.replace(',', '.')) : null,
          deadline: values.deadline || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(wsId!) });
      toast.success('Projeto criado com sucesso!');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao criar projeto: ${msg}`);
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ProjectFormValues> }) => {
      const payload: Record<string, unknown> = {};
      if (values.name !== undefined) payload.name = values.name;
      if (values.description !== undefined) payload.description = values.description || null;
      if (values.client_account_id !== undefined) payload.client_account_id = values.client_account_id || null;
      if (values.status !== undefined) payload.status = values.status;
      if (values.budget !== undefined) payload.budget = values.budget ? parseFloat(values.budget.replace(',', '.')) : null;
      if (values.deadline !== undefined) payload.deadline = values.deadline || null;

      const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(wsId!) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(data.id) });
      toast.success('Projeto atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar projeto'),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(wsId!) });
      toast.success('Projeto removido');
    },
    onError: () => toast.error('Erro ao remover projeto'),
  });

  return { createProject, updateProject, deleteProject };
};
