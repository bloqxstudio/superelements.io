import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { WordPressPostTypeService } from '@/services/wordPressPostTypeService';
import { slugify } from '@/utils/slugify';

export interface WordPressConnection {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  post_type: string;
  json_field: string;
  preview_field: string;
  credentials?: {
    username: string;
    application_password: string;
  };
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isActive: boolean;
  userType: 'free' | 'pro' | 'all';
  accessLevel: 'free' | 'pro' | 'admin';
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
          const { data: { user } } = await supabase.auth.getUser();
          
          // Fetch connections
          const { data: connectionsData, error: connectionsError } = await supabase
            .from('connections')
            .select('*')
            .order('created_at', { ascending: false });

          if (connectionsError) {
            console.error('❌ Error fetching connections:', connectionsError);
            throw connectionsError;
          }

          console.log('📊 Raw connections data:', connectionsData);

          // Fetch credentials for:
          // 1. User's own connections (if logged in)
          // 2. Shared connections (user_type = 'all') - accessible to everyone
          const { data: credentialsData, error: credError } = await supabase
            .from('connection_credentials')
            .select('*');
          
          if (credError) {
            console.warn('⚠️ Error fetching credentials:', credError);
          }
          
          const credentials = credentialsData || [];

          // Create credentials map
          const credentialsMap = new Map(
            credentials.map(cred => [
              cred.connection_id,
              {
                username: cred.username,
                application_password: cred.application_password
              }
            ])
          );

          const connections: WordPressConnection[] = (connectionsData || []).map(conn => ({
            id: conn.id,
            name: conn.name,
            slug: (conn as any).slug || slugify(conn.name),
            base_url: conn.base_url,
            post_type: conn.post_type,
            json_field: conn.json_field,
            preview_field: conn.preview_field,
            credentials: credentialsMap.get(conn.id), // Only populated for owned connections
            status: conn.status as WordPressConnection['status'],
            isActive: conn.is_active,
            userType: conn.user_type as WordPressConnection['userType'],
            accessLevel: (conn.access_level || 'free') as WordPressConnection['accessLevel'],
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
            withCredentials: connections.filter(c => c.credentials).length,
            byUserType: {
              free: connections.filter(c => c.userType === 'free').length,
              pro: connections.filter(c => c.userType === 'pro').length,
              all: connections.filter(c => c.userType === 'all').length,
            },
            connectionDetails: connections.map(c => ({
              id: c.id,
              name: c.name,
              isActive: c.isActive,
              status: c.status,
              hasCredentials: !!c.credentials
            }))
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
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          // Insert connection without credentials
          const { data: connData, error: connError } = await supabase
            .from('connections')
            .insert({
              name: connectionData.name,
              base_url: connectionData.base_url,
              post_type: connectionData.post_type,
              json_field: connectionData.json_field,
              preview_field: connectionData.preview_field,
              status: connectionData.status,
              is_active: connectionData.isActive,
              user_type: connectionData.userType,
              last_tested: connectionData.lastTested?.toISOString(),
              components_count: connectionData.componentsCount || 0,
              error: connectionData.error,
              created_by: user.id,
            })
            .select()
            .single();

          if (connError) throw connError;

          // Insert credentials separately if provided
          if (connectionData.credentials) {
            const { error: credError } = await supabase
              .from('connection_credentials')
              .insert({
                connection_id: connData.id,
                username: connectionData.credentials.username,
                application_password: connectionData.credentials.application_password,
              });

            if (credError) {
              // Rollback: delete the connection if credentials insert fails
              await supabase.from('connections').delete().eq('id', connData.id);
              throw credError;
            }
          }

          // Refresh connections list
          await get().fetchConnections();
          
          return connData.id;
        } catch (error) {
          console.error('Error adding connection:', error);
          throw error;
        }
      },
      
      updateConnection: async (id, updates) => {
        try {
          const { credentials, ...connectionUpdates } = updates;
          const updateData: any = {};
          
          if (connectionUpdates.name) updateData.name = connectionUpdates.name;
          if (connectionUpdates.slug) updateData.slug = connectionUpdates.slug;
          if (connectionUpdates.base_url) updateData.base_url = connectionUpdates.base_url;
          if (connectionUpdates.post_type) updateData.post_type = connectionUpdates.post_type;
          if (connectionUpdates.json_field) updateData.json_field = connectionUpdates.json_field;
          if (connectionUpdates.preview_field) updateData.preview_field = connectionUpdates.preview_field;
          if (connectionUpdates.status) updateData.status = connectionUpdates.status;
          if (connectionUpdates.isActive !== undefined) updateData.is_active = connectionUpdates.isActive;
          if (connectionUpdates.userType) updateData.user_type = connectionUpdates.userType;
          if (connectionUpdates.lastTested) updateData.last_tested = connectionUpdates.lastTested.toISOString();
          if (connectionUpdates.componentsCount !== undefined) updateData.components_count = connectionUpdates.componentsCount;
          if (connectionUpdates.error !== undefined) updateData.error = connectionUpdates.error;

          // Update connection metadata
          const { error: connError } = await supabase
            .from('connections')
            .update(updateData)
            .eq('id', id);

          if (connError) throw connError;

          // Update credentials separately if provided
          if (credentials) {
            const { error: credError } = await supabase
              .from('connection_credentials')
              .upsert({
                connection_id: id,
                username: credentials.username,
                application_password: credentials.application_password,
              });

            if (credError) throw credError;
          }

          // Refresh connections list to get updated data
          await get().fetchConnections();
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
        if (!connection || !connection.credentials) {
          console.error(`Connection ${id} not found or missing credentials`);
          return false;
        }
        
        try {
          const validation = await WordPressPostTypeService.validateWordPressSite({
            baseUrl: connection.base_url,
            username: connection.credentials.username,
            applicationPassword: connection.credentials.application_password
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
        if (!connection || !connection.credentials) {
          console.error(`Connection ${id} not found or missing credentials`);
          return;
        }
        
        try {
          const currentPostType = connection.post_type;
          
          const correctRestBase = await WordPressPostTypeService.getRestBaseForPostType(
            currentPostType,
            {
              baseUrl: connection.base_url,
              username: connection.credentials.username,
              applicationPassword: connection.credentials.application_password
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
