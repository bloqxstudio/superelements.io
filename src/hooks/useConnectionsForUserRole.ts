
import { useAccessControl } from '@/hooks/useAccessControl';
import { useConnectionsStore } from '@/store/connectionsStore';

export const useConnectionsForUserRole = () => {
  const { userRole, isAdmin, isPro, isFree } = useAccessControl();
  const { connections } = useConnectionsStore();

  const getConnectionsForCurrentUser = () => {
    const activeConnections = connections.filter(c => c.isActive);
    
    console.log('🔍 FILTERING CONNECTIONS FOR USER:', {
      userRole,
      totalActiveConnections: activeConnections.length,
      connectionDetails: activeConnections.map(c => ({
        id: c.id,
        name: c.name,
        userType: c.userType
      }))
    });

    // ADMIN e PRO têm acesso a todas as conexões ativas
    if (isAdmin || isPro) {
      console.log('✅ ADMIN/PRO USER - Access to all connections:', activeConnections.length);
      return activeConnections;
    }

    // FREE users agora também veem todas as conexões ativas
    // O controle de cópia é feito no useComponentAccess
    console.log('👀 FREE USER - Access to all connections for viewing (copy restrictions handled elsewhere):', {
      originalCount: activeConnections.length,
      visibleConnections: activeConnections.map(c => ({
        name: c.name,
        userType: c.userType
      }))
    });
    
    return activeConnections;
  };

  const getConnectionById = (connectionId: string) => {
    return connections.find(c => c.id === connectionId);
  };

  return {
    getConnectionsForCurrentUser,
    getConnectionById,
    userRole,
    isAdmin,
    isPro,
    isFree
  };
};
