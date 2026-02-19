import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { slugify } from '@/utils/slugify';

export interface WorkspaceWithDetails {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  owner_email: string;
  member_count: number;
  connection_count: number;
  created_at: string;
}

export interface WorkspaceMemberDetail {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  email: string;
}

export const useWorkspaces = () => {
  return useQuery({
    queryKey: ['admin', 'workspaces'],
    queryFn: async () => {
      // Fetch workspaces first (do not couple listing to owner profile join)
      const { data: workspaces, error } = await supabase
        .from('workspaces')
        .select('id, name, slug, owner_id, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const workspaceIds = (workspaces ?? []).map((w) => w.id);
      const ownerIds = Array.from(new Set((workspaces ?? []).map((w) => w.owner_id)));

      // Fetch owner emails (best-effort; listing must still work if this fails)
      const ownerEmailMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', ownerIds);

        for (const owner of owners ?? []) {
          ownerEmailMap[owner.id] = owner.email;
        }
      }

      // Fetch member counts
      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .in('workspace_id', workspaceIds.length ? workspaceIds : ['00000000-0000-0000-0000-000000000000']);

      // Fetch connection counts
      const { data: connRows } = await supabase
        .from('connections')
        .select('workspace_id')
        .in('workspace_id', workspaceIds.length ? workspaceIds : ['00000000-0000-0000-0000-000000000000']);

      const memberCountMap: Record<string, number> = {};
      for (const r of memberRows ?? []) {
        memberCountMap[r.workspace_id] = (memberCountMap[r.workspace_id] ?? 0) + 1;
      }

      const connCountMap: Record<string, number> = {};
      for (const r of connRows ?? []) {
        if (r.workspace_id) {
          connCountMap[r.workspace_id] = (connCountMap[r.workspace_id] ?? 0) + 1;
        }
      }

      return (workspaces ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        owner_id: w.owner_id,
        owner_email: ownerEmailMap[w.owner_id] ?? '',
        member_count: memberCountMap[w.id] ?? 0,
        connection_count: connCountMap[w.id] ?? 0,
        created_at: w.created_at,
      })) as WorkspaceWithDetails[];
    },
  });
};

export const useWorkspaceMembers = (workspaceId: string | null) => {
  return useQuery({
    queryKey: ['admin', 'workspace-members', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, user_id, role, joined_at, profiles(email)')
        .eq('workspace_id', workspaceId!);

      if (error) throw error;

      return (data ?? []).map((m) => ({
        workspace_id: m.workspace_id,
        user_id: m.user_id,
        role: m.role as 'owner' | 'member',
        joined_at: m.joined_at,
        email: (m.profiles as { email: string } | null)?.email ?? '',
      })) as WorkspaceMemberDetail[];
    },
  });
};

export const useAllUsers = () => {
  return useQuery({
    queryKey: ['admin', 'all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .order('email', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, owner_id }: { name: string; owner_id: string }) => {
      const slug = slugify(name);

      const { data: ws, error } = await supabase
        .from('workspaces')
        .insert({ name, slug, owner_id })
        .select()
        .single();

      if (error) throw error;

      const { error: memberError } = await supabase
        .from('workspace_members')
        .upsert(
          { workspace_id: ws.id, user_id: owner_id, role: 'owner' },
          { onConflict: 'workspace_id,user_id' }
        );

      if (memberError) {
        await supabase.from('workspaces').delete().eq('id', ws.id);
        throw memberError;
      }

      return ws;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast({ title: 'Workspace criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar workspace', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast({ title: 'Workspace excluído' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir workspace', description: error.message, variant: 'destructive' });
    },
  });
};

export const useAddWorkspaceMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspace_id,
      user_id,
      role,
    }: {
      workspace_id: string;
      user_id: string;
      role: 'owner' | 'member';
    }) => {
      const { error } = await supabase
        .from('workspace_members')
        .insert({ workspace_id, user_id, role });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-members', vars.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast({ title: 'Membro adicionado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar membro', description: error.message, variant: 'destructive' });
    },
  });
};

export const useAddWorkspaceMemberByEmail = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspace_id,
      email,
      role,
    }: {
      workspace_id: string;
      email: string;
      role: 'owner' | 'member' | 'manager';
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        'https://nfmfcpcwyavutntnrxqq.supabase.co/functions/v1/invite-member',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ workspace_id, email, role }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao adicionar membro');
      return json as { user_id: string; invited: boolean };
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-members', vars.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast({
        title: data.invited ? 'Convite enviado' : 'Membro adicionado',
        description: data.invited
          ? 'Um email de convite foi enviado ao usuário.'
          : 'O membro foi adicionado ao workspace.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar membro', description: error.message, variant: 'destructive' });
    },
  });
};

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workspace_id, user_id }: { workspace_id: string; user_id: string }) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('user_id', user_id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-members', vars.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast({ title: 'Membro removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover membro', description: error.message, variant: 'destructive' });
    },
  });
};
