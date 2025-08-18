
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { WordPressConnection } from '@/store/connectionsStore';

interface ActiveConnection {
  connection: WordPressConnection;
  isActive: boolean;
  isLoading: boolean;
  hasError: boolean;
  lastActivity: Date;
  componentCount: number;
  categories: Array<{
    id: number;
    name: string;
    count: number;
  }>;
}

interface ConnectionManagementStore {
  // Multi-connection state
  activeConnections: Map<string, ActiveConnection>;
  primaryConnectionId: string | null;
  
  // Actions
  activateConnection: (connection: WordPressConnection) => void;
  deactivateConnection: (connectionId: string) => void;
  setPrimaryConnection: (connectionId: string) => void;
  updateConnectionStatus: (connectionId: string, updates: Partial<ActiveConnection>) => void;
  
  // Getters
  getActiveConnections: () => ActiveConnection[];
  getPrimaryConnection: () => ActiveConnection | null;
  isConnectionActive: (connectionId: string) => boolean;
  getConnectionById: (connectionId: string) => ActiveConnection | null;
  
  // Cleanup
  cleanupInactiveConnections: () => void;
}

export const useConnectionManagementStore = create<ConnectionManagementStore>()(
  devtools(
    (set, get) => ({
      activeConnections: new Map(),
      primaryConnectionId: null,
      
      activateConnection: (connection) => {
        set((state) => {
          const newActiveConnections = new Map(state.activeConnections);
          
          newActiveConnections.set(connection.id, {
            connection,
            isActive: true,
            isLoading: false,
            hasError: false,
            lastActivity: new Date(),
            componentCount: connection.componentsCount || 0,
            categories: []
          });
          
          return {
            activeConnections: newActiveConnections,
            primaryConnectionId: state.primaryConnectionId || connection.id
          };
        });
        
        console.log(`Activated connection: ${connection.name}`);
      },
      
      deactivateConnection: (connectionId) => {
        set((state) => {
          const newActiveConnections = new Map(state.activeConnections);
          newActiveConnections.delete(connectionId);
          
          // If we're removing the primary connection, set a new one
          let newPrimaryId = state.primaryConnectionId;
          if (state.primaryConnectionId === connectionId) {
            const remainingConnections = Array.from(newActiveConnections.keys());
            newPrimaryId = remainingConnections.length > 0 ? remainingConnections[0] : null;
          }
          
          return {
            activeConnections: newActiveConnections,
            primaryConnectionId: newPrimaryId
          };
        });
        
        console.log(`Deactivated connection: ${connectionId}`);
      },
      
      setPrimaryConnection: (connectionId) => {
        const state = get();
        if (state.activeConnections.has(connectionId)) {
          set({ primaryConnectionId: connectionId });
          console.log(`Set primary connection: ${connectionId}`);
        }
      },
      
      updateConnectionStatus: (connectionId, updates) => {
        set((state) => {
          const newActiveConnections = new Map(state.activeConnections);
          const existing = newActiveConnections.get(connectionId);
          
          if (existing) {
            newActiveConnections.set(connectionId, {
              ...existing,
              ...updates,
              lastActivity: new Date()
            });
          }
          
          return { activeConnections: newActiveConnections };
        });
      },
      
      getActiveConnections: () => {
        const state = get();
        return Array.from(state.activeConnections.values())
          .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      },
      
      getPrimaryConnection: () => {
        const state = get();
        return state.primaryConnectionId 
          ? state.activeConnections.get(state.primaryConnectionId) || null
          : null;
      },
      
      isConnectionActive: (connectionId) => {
        const state = get();
        return state.activeConnections.has(connectionId);
      },
      
      getConnectionById: (connectionId) => {
        const state = get();
        return state.activeConnections.get(connectionId) || null;
      },
      
      cleanupInactiveConnections: () => {
        set((state) => {
          const newActiveConnections = new Map(state.activeConnections);
          const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
          
          for (const [id, connection] of newActiveConnections.entries()) {
            if (connection.lastActivity < cutoffTime && !connection.isLoading) {
              newActiveConnections.delete(id);
              console.log(`Cleaned up inactive connection: ${id}`);
            }
          }
          
          return { activeConnections: newActiveConnections };
        });
      }
    }),
    { name: 'connection-management-store' }
  )
);
