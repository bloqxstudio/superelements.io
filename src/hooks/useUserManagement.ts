import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AppRole } from '@/contexts/AuthContext';

export interface UserWorkspace {
  workspace_id: string;
  workspace_name: string;
  role: 'owner' | 'member';
}

export interface UserWithRole {
  id: string;
  email: string;
  phone?: string;
  role: AppRole;
  created_at: string;
  workspaces: UserWorkspace[];
}

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // Buscar todos os perfis
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, phone, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar roles de todos os usuários
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Buscar workspace memberships com nome do workspace
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('user_id, role, workspace_id, workspaces(name)');

      // Combinar dados
      const users: UserWithRole[] = profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        const userMemberships = (memberships ?? [])
          .filter((m) => m.user_id === profile.id)
          .map((m) => ({
            workspace_id: m.workspace_id,
            workspace_name: (m.workspaces as { name: string } | null)?.name ?? '',
            role: m.role as 'owner' | 'member',
          }));

        return {
          ...profile,
          role: (userRole?.role as AppRole) || 'free',
          workspaces: userMemberships,
        };
      });

      return users;
    }
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Role atualizado',
        description: 'O papel do usuário foi alterado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar role',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password, phone, role }: { 
      email: string; 
      password: string; 
      phone?: string; 
      role: AppRole;
    }) => {
      // Criar usuário via Supabase Auth Admin API (requer service role key no backend)
      // Por enquanto, vamos usar o signup normal
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: phone ? { phone } : undefined
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('Usuário não foi criado');

      // Atualizar role para a desejada (o trigger cria com 'free' por padrão)
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', data.user.id);

      if (roleError) throw roleError;

      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Usuário criado',
        description: 'O novo usuário foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Email enviado',
        description: 'Um link de redefinição de senha foi enviado.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar email',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
};
