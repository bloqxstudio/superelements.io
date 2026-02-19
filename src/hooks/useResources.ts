import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: 'download' | 'link';
  url: string;
  file_size: string | null;
  icon: string;
  category: string | null;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  workspace_id: string;
}

interface UseResourcesOptions {
  workspaceId?: string | null;
  category?: string | null;
  includeInactive?: boolean;
}

export const useResources = (options: UseResourcesOptions = {}) => {
  const { workspaceId, category, includeInactive = false } = options;

  return useQuery({
    queryKey: ['resources', workspaceId, category, includeInactive],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];

      let query = supabase
        .from('resources')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Resource[];
    },
  });
};

export const useResourceCategories = (workspaceId?: string | null) => {
  return useQuery({
    queryKey: ['resource-categories', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];

      const { data, error } = await supabase
        .from('resources')
        .select('category')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .not('category', 'is', null);

      if (error) throw error;

      const categories = [...new Set(data.map(r => r.category))].filter(Boolean) as string[];
      return categories.sort();
    },
  });
};
