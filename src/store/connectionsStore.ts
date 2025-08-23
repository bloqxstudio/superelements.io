import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { WordPressPostTypeService } from '@/services/wordPressPostTypeService';

export interface WordPressConnection {
  id: string;
  name: string;
  base_url: string;
  post_type: string;
  json_field: string;
  preview_field: string;
  username: string;
  application_password: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isActive: boolean;
  userType: 'free' | 'pro' | 'all';
  lastTested?: Date;
  componentsCount?: number;
  error?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ConnectionsStore {
  // Connections state
  connections: WordPressConnection[];
  isLoading: boolean;
  activeConnectionId: string | null;
  
  // Actions
  fetchConnections: () => Promise<void>;
  addConnection: (connection: Omit<WordPressConnection, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  updateConnection: (id: string, updates: Partial<WordPressConnection>) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  
  // Enhanced actions for post type mapping
  validateConnection: (id: string) => Promise<boolean>;
  refreshPostTypeMapping: (id: string) => Promise<void>;
  
  // Backward compatibility methods
  getActiveConnection: () => WordPressConnection | null;
  setActiveConnection: (id: string | null) => void;
  
  // Enhanced getters for multiple active connections
  getActiveConnections: () => WordPressConnection[];
  getConnectionById: (id: string) => WordPressConnection | null;
  getConnectionsForUserType: (userType: 'free' | 'pro') => WordPressConnection[];
}

export const useConnectionsStore = create<ConnectionsStore>()(
  devtools(
    (set, get) => ({
      connections: [],
      isLoading: false,
      activeConnectionId: null,
      
      fetchConnections: async () => {
        console.log('🔗 Fetching connections from Supabase...');
        set({ isLoading: true });
        
        try {
          // Simplified - fetch all connections without auth check
          const { data, error } = await supabase
            .from('connections')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching connections:', error);
            throw error;
          }

          console.log('📊 Raw connections data:', data);

          const connections: WordPressConnection[] = (data || []).map(conn => ({
            id: conn.id,
            name: conn.name,
            base_url: conn.base_url,
            post_type: conn.post_type,
            json_field: conn.json_field,
            preview_field: conn.preview_field,
            username: conn.username,
            application_password: conn.application_password,
            status: conn.status as WordPressConnection['status'],
            isActive: conn.is_active,
            userType: conn.user_type as WordPressConnection['userType'],
            lastTested: conn.last_tested ? new Date(conn.last_tested) : undefined,
            componentsCount: conn.components_count || 0,
            error: conn.error || undefined,
            createdBy: conn.created_by || undefined,
            createdAt: conn.created_at ? new Date(conn.created_at) : undefined,
            updatedAt: conn.updated_at ? new Date(conn.updated_at) : undefined,
          }));

          console.log('✅ Processed connections:', {
            total: connections.length,
            active: connections.filter(c => c.isActive).length,
            byUserType: {
              free: connections.filter(c => c.userType === 'free').length,
              pro: connections.filter(c => c.userType === 'pro').length,
              all: connections.filter(c => c.userType === 'all').length,
            }
          });

          set({ connections, isLoading: false });

          // Remover auto-seleção - deixar o estado inicial como "All Components"
          console.log('🏠 Initial load - maintaining "All Components" state (no auto-selection)');
        } catch (error) {
          console.error('❌ Error in fetchConnections:', error);
          set({ isLoading: false, connections: [] });
        }
      },
      
      addConnection: async (connectionData) => {
        try {
          // Simplified - create connection without auth check
          const { data, error } = await supabase
            .from('connections')
            .insert({
              name: connectionData.name,
              base_url: connectionData.base_url,
              post_type: connectionData.post_type,
              json_field: connectionData.json_field,
              preview_field: connectionData.preview_field,
              username: connectionData.username,
              application_password: connectionData.application_password,
              status: connectionData.status,
              is_active: connectionData.isActive,
              user_type: connectionData.userType,
              last_tested: connectionData.lastTested?.toISOString(),
              components_count: connectionData.componentsCount || 0,
              error: connectionData.error,
              created_by: null, // Simplified - no user context needed
            })
            .select()
            .single();

          if (error) throw error;

          // Refresh connections list
          await get().fetchConnections();
          
          return data.id;
        } catch (error) {
          console.error('Error adding connection:', error);
          throw error;
        }
      },
      
      updateConnection: async (id, updates) => {
        try {
          const updateData: any = {};
          
          if (updates.name) updateData.name = updates.name;
          if (updates.base_url) updateData.base_url = updates.base_url;
          if (updates.post_type) updateData.post_type = updates.post_type;
          if (updates.json_field) updateData.json_field = updates.json_field;
          if (updates.preview_field) updateData.preview_field = updates.preview_field;
          if (updates.username) updateData.username = updates.username;
          if (updates.application_password) updateData.application_password = updates.application_password;
          if (updates.status) updateData.status = updates.status;
          if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
          if (updates.userType) updateData.user_type = updates.userType;
          if (updates.lastTested) updateData.last_tested = updates.lastTested.toISOString();
          if (updates.componentsCount !== undefined) updateData.components_count = updates.componentsCount;
          if (updates.error !== undefined) updateData.error = updates.error;

          const { error } = await supabase
            .from('connections')
            .update(updateData)
            .eq('id', id);

          if (error) throw error;

          // Update local state
          set((state) => ({
            connections: state.connections.map((conn) =>
              conn.id === id ? { ...conn, ...updates } : conn
            ),
          }));
        } catch (error) {
          console.error('Error updating connection:', error);
          throw error;
        }
      },
      
      removeConnection: async (id) => {
        try {
          const { error } = await supabase
            .from('connections')
            .delete()
            .eq('id', id);

          if (error) throw error;

          set((state) => ({
            connections: state.connections.filter((conn) => conn.id !== id),
            activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId
          }));
        } catch (error) {
          console.error('Error removing connection:', error);
          throw error;
        }
      },
      
      validateConnection: async (id) => {
        const connection = get().getConnectionById(id);
        if (!connection) {
          console.error(`Connection ${id} not found`);
          return false;
        }
        
        try {
          const validation = await WordPressPostTypeService.validateWordPressSite({
            baseUrl: connection.base_url,
            username: connection.username,
            applicationPassword: connection.application_password
          });
          
          // Update connection status based on validation
          await get().updateConnection(id, {
            status: validation.isValid ? 'connected' : 'error',
            error: validation.error,
            lastTested: new Date()
          });
          
          return validation.isValid;
        } catch (error) {
          console.error(`Error validating connection ${id}:`, error);
          
          await get().updateConnection(id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Validation failed',
            lastTested: new Date()
          });
          
          return false;
        }
      },
      
      refreshPostTypeMapping: async (id) => {
        const connection = get().getConnectionById(id);
        if (!connection) {
          console.error(`Connection ${id} not found`);
          return;
        }
        
        try {
          const currentPostType = connection.post_type;
          
          const correctRestBase = await WordPressPostTypeService.getRestBaseForPostType(
            currentPostType,
            {
              baseUrl: connection.base_url,
              username: connection.username,
              applicationPassword: connection.application_password
            }
          );
          
          if (correctRestBase !== currentPostType) {
            console.log(`Updating post type mapping for connection ${id}:`, {
              from: currentPostType,
              to: correctRestBase
            });
            
            await get().updateConnection(id, {
              post_type: correctRestBase,
              lastTested: new Date()
            });
          }
        } catch (error) {
          console.error(`Error refreshing post type mapping for connection ${id}:`, error);
        }
      },

      getActiveConnection: () => {
        const state = get();
        if (state.activeConnectionId) {
          return state.connections.find(conn => conn.id === state.activeConnectionId) || null;
        }
        return null; // Não retornar automaticamente a primeira conexão ativa
      },

      setActiveConnection: (id) => {
        set({ activeConnectionId: id });
      },
      
      getActiveConnections: () => {
        const state = get();
        return state.connections.filter((conn) => conn.isActive);
      },
      
      getConnectionById: (id) => {
        const state = get();
        return state.connections.find((conn) => conn.id === id) || null;
      },

      getConnectionsForUserType: (userType) => {
        const state = get();
        return state.connections.filter((conn) => 
          conn.isActive && (conn.userType === userType || conn.userType === 'all')
        );
      },
    }),
    { name: 'connections-store' }
  )
);
