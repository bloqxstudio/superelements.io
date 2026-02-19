import { useQuery } from '@tanstack/react-query';
import { useConnectionsStore } from '@/store/connectionsStore';

/**
 * Fetches the real total component count from WordPress REST API
 * by reading the X-WP-Total header from a per_page=1 request.
 * Runs in parallel for all active designer connections.
 *
 * Returns:
 *   data: total count across all connections (number)
 *   countByConnection: Map<connectionId, count>
 */
export const useLibraryComponentCount = (workspaceId?: string | null) => {
  const { getDesignerConnections } = useConnectionsStore();
  const designerConns = getDesignerConnections().filter(
    (c) => c.isActive && (!!workspaceId ? c.workspace_id === workspaceId : false)
  );

  return useQuery({
    queryKey: ['libraryComponentCount', designerConns.map((c) => c.id).join(',')],
    queryFn: async (): Promise<{ total: number; byConnection: Record<string, number> }> => {
      if (designerConns.length === 0) return { total: 0, byConnection: {} };

      const results = await Promise.all(
        designerConns.map(async (conn) => {
          try {
            const baseUrl = conn.base_url.replace(/\/$/, '');
            const url = `${baseUrl}/wp-json/wp/v2/${conn.post_type}?per_page=1&_fields=id`;

            const headers: Record<string, string> = {};
            if (conn.credentials?.username && conn.credentials?.application_password) {
              const encoded = btoa(
                `${conn.credentials.username}:${conn.credentials.application_password}`
              );
              headers['Authorization'] = `Basic ${encoded}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) return { id: conn.id, count: 0 };

            const total = parseInt(response.headers.get('X-WP-Total') || '0', 10);
            return { id: conn.id, count: isNaN(total) ? 0 : total };
          } catch {
            return { id: conn.id, count: 0 };
          }
        })
      );

      const byConnection: Record<string, number> = {};
      let total = 0;
      for (const r of results) {
        byConnection[r.id] = r.count;
        total += r.count;
      }

      return { total, byConnection };
    },
    enabled: designerConns.length > 0,
    staleTime: 10 * 60 * 1000, // 10 min
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
};
