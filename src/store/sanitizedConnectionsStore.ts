import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useConnectionsStore, WordPressConnection } from './connectionsStore';
import { useAccessControl } from '@/hooks/useAccessControl';

// Sanitized connection interface - excludes sensitive credentials
export interface SanitizedConnection {
  id: string;
  name: string;
  base_url: string;
  post_type: string;
  json_field: string;
  preview_field: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isActive: boolean;
  userType: 'free' | 'pro' | 'all';
  lastTested?: Date;
  componentsCount?: number;
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Credentials are excluded for security
}

interface SanitizedConnectionsStore {
  getSanitizedConnections: () => SanitizedConnection[];
  getSanitizedConnectionById: (id: string) => SanitizedConnection | null;
  getConnectionsForCurrentUser: () => SanitizedConnection[];
}

// Helper function to sanitize connection data based on user permissions
const sanitizeConnection = (
  connection: WordPressConnection, 
  canViewCredentials: boolean
): SanitizedConnection => {
  const sanitized: SanitizedConnection = {
    id: connection.id,
    name: connection.name,
    base_url: connection.base_url,
    post_type: connection.post_type,
    json_field: connection.json_field,
    preview_field: connection.preview_field,
    status: connection.status,
    isActive: connection.isActive,
    userType: connection.userType,
    lastTested: connection.lastTested,
    componentsCount: connection.componentsCount,
    error: connection.error,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };

  // Only include credentials if user has permission (owner or admin)
  if (canViewCredentials) {
    // Cast to add credentials for authorized users
    (sanitized as any).username = connection.username;
    (sanitized as any).application_password = connection.application_password;
    (sanitized as any).createdBy = connection.createdBy;
  }

  return sanitized;
};

export const useSanitizedConnectionsStore = create<SanitizedConnectionsStore>()(
  devtools(() => ({
    getSanitizedConnections: () => {
      const connections = useConnectionsStore.getState().connections;
      const { isAdmin } = useAccessControl();
      
      return connections.map(conn => 
        sanitizeConnection(conn, isAdmin || conn.createdBy === getCurrentUserId())
      );
    },
    
    getSanitizedConnectionById: (id: string) => {
      const connection = useConnectionsStore.getState().getConnectionById(id);
      if (!connection) return null;
      
      const { isAdmin } = useAccessControl();
      const canViewCredentials = isAdmin || connection.createdBy === getCurrentUserId();
      
      return sanitizeConnection(connection, canViewCredentials);
    },
    
    getConnectionsForCurrentUser: () => {
      const connections = useConnectionsStore.getState().connections;
      const { isAdmin, userRole } = useAccessControl();
      
      return connections
        .filter(conn => {
          // Admin sees all
          if (isAdmin) return true;
          
          // Users see connections they created or public ones matching their access level
          return conn.createdBy === getCurrentUserId() || 
                 (conn.isActive && (conn.userType === userRole || conn.userType === 'all'));
        })
        .map(conn => 
          sanitizeConnection(conn, isAdmin || conn.createdBy === getCurrentUserId())
        );
    }
  }), { name: 'sanitized-connections-store' })
);

// Helper to get current user ID (would normally come from auth context)
const getCurrentUserId = (): string | undefined => {
  // This should be replaced with actual auth context
  return undefined; // TODO: Implement proper user ID retrieval
};