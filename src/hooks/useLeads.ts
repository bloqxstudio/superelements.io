import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  Lead,
  LeadStatus,
  LeadFormValues,
  LeadInteractionFormValues,
  LeadDetail,
} from '@/types/leads';

// ── Query key factory ─────────────────────────────────────────────────────────

export const leadKeys = {
  all:    (wsId: string) => ['leads', wsId] as const,
  detail: (id: string)   => ['lead', id] as const,
};

// ── Query hooks ───────────────────────────────────────────────────────────────

export const useLeads = (workspaceId: string | undefined) =>
  useQuery({
    queryKey: leadKeys.all(workspaceId ?? ''),
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('kanban_status', { ascending: true })
        .order('position', { ascending: true });
      if (error) throw error;
      return data as Lead[];
    },
  });

export const useLeadDetail = (leadId: string | undefined) =>
  useQuery({
    queryKey: [...leadKeys.detail(leadId ?? ''), 'detail'],
    enabled: !!leadId,
    staleTime: 15_000,
    queryFn: async () => {
      const [leadRes, interactionsRes, linkedRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('id', leadId!)
          .single(),
        supabase
          .from('lead_interactions')
          .select('*, author:created_by(id, email)')
          .eq('lead_id', leadId!)
          .order('created_at', { ascending: false }),
        supabase
          .from('lead_projects')
          .select('*, project:projects(id, name, status)')
          .eq('lead_id', leadId!),
      ]);
      if (leadRes.error) throw leadRes.error;
      if (interactionsRes.error) throw interactionsRes.error;
      if (linkedRes.error) throw linkedRes.error;
      return {
        lead: leadRes.data as Lead,
        interactions: (interactionsRes.data ?? []) as LeadDetail['interactions'],
        linkedProjects: (linkedRes.data ?? []) as LeadDetail['linkedProjects'],
      } as LeadDetail;
    },
  });

// ── Mutation hooks ────────────────────────────────────────────────────────────

export const useLeadMutations = () => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: leadKeys.all(wsId!) });

  const createLead = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const { data: existing } = await supabase
        .from('leads')
        .select('position')
        .eq('workspace_id', wsId!)
        .eq('kanban_status', values.kanban_status)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('leads')
        .insert({
          workspace_id: wsId!,
          name: values.name,
          company: values.company || null,
          email: values.email || null,
          phone: values.phone || null,
          source: values.source,
          estimated_value: values.estimated_value
            ? parseFloat(values.estimated_value.replace(',', '.'))
            : null,
          tags: values.tags
            ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [],
          kanban_status: values.kanban_status,
          position: nextPosition,
          notes: values.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Lead criado!');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao criar lead: ${msg}`);
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LeadFormValues> }) => {
      const payload: Record<string, unknown> = {};
      if (values.name !== undefined) payload.name = values.name;
      if (values.company !== undefined) payload.company = values.company || null;
      if (values.email !== undefined) payload.email = values.email || null;
      if (values.phone !== undefined) payload.phone = values.phone || null;
      if (values.source !== undefined) payload.source = values.source;
      if (values.estimated_value !== undefined)
        payload.estimated_value = values.estimated_value
          ? parseFloat(values.estimated_value.replace(',', '.'))
          : null;
      if (values.tags !== undefined)
        payload.tags = values.tags
          ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];
      if (values.notes !== undefined) payload.notes = values.notes || null;
      if (values.kanban_status !== undefined) payload.kanban_status = values.kanban_status;

      const { data, error } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: [...leadKeys.detail(data.id), 'detail'] });
      toast.success('Lead atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar lead'),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Lead removido');
    },
    onError: () => toast.error('Erro ao remover lead'),
  });

  const moveLead = useMutation({
    mutationFn: async (
      affected: Array<{ id: string; kanban_status: LeadStatus; position: number }>
    ) => {
      await Promise.all(
        affected.map((l) =>
          supabase
            .from('leads')
            .update({ kanban_status: l.kanban_status, position: l.position })
            .eq('id', l.id)
        )
      );
    },
    onSuccess: () => invalidateAll(),
    onError: () => {
      invalidateAll();
      toast.error('Erro ao mover lead. Revertendo...');
    },
  });

  return { createLead, updateLead, deleteLead, moveLead };
};

// ── Interaction + project link mutations ─────────────────────────────────────

export const useLeadInteractionMutations = (leadId: string) => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const invalidateDetail = () =>
    queryClient.invalidateQueries({ queryKey: [...leadKeys.detail(leadId), 'detail'] });

  const createInteraction = useMutation({
    mutationFn: async (values: LeadInteractionFormValues) => {
      const { data, error } = await supabase
        .from('lead_interactions')
        .insert({
          lead_id: leadId,
          workspace_id: wsId!,
          content: values.content,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateDetail(),
    onError: () => toast.error('Erro ao adicionar nota'),
  });

  const deleteInteraction = useMutation({
    mutationFn: async (interactionId: string) => {
      const { error } = await supabase
        .from('lead_interactions')
        .delete()
        .eq('id', interactionId);
      if (error) throw error;
    },
    onSuccess: () => invalidateDetail(),
    onError: () => toast.error('Erro ao remover nota'),
  });

  const linkProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('lead_projects')
        .insert({ lead_id: leadId, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDetail();
      toast.success('Projeto vinculado!');
    },
    onError: () => toast.error('Erro ao vincular projeto'),
  });

  const unlinkProject = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('lead_projects').delete().eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDetail();
      toast.success('Projeto desvinculado');
    },
    onError: () => toast.error('Erro ao desvincular projeto'),
  });

  return { createInteraction, deleteInteraction, linkProject, unlinkProject };
};
