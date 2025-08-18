
import { useAccessControl } from '@/hooks/useAccessControl';
import { useConnectionsStore } from '@/store/connectionsStore';

export interface ComponentAccessInfo {
  canView: boolean;
  canCopy: boolean;
  level: 'free' | 'pro';
  requiresUpgrade: boolean;
}

export const useComponentAccess = () => {
  const { isPro, isAdmin, isFree } = useAccessControl();
  const { getConnectionById } = useConnectionsStore();

  const getComponentAccess = (component: any): ComponentAccessInfo => {
    // Determinar o nível do componente baseado na conexão
    const componentLevel = determineComponentLevel(component);
    
    console.log('🔐 COMPONENT ACCESS CHECK:', {
      componentId: component.id,
      componentTitle: typeof component.title === 'object' ? component.title?.rendered : component.title,
      componentLevel,
      userRole: { isPro, isAdmin, isFree },
      connectionId: component.connection_id || component._connectionId,
      directUserType: component._connectionUserType
    });
    
    // ADMIN têm acesso completo a TUDO - OVERRIDE TOTAL
    if (isAdmin) {
      console.log('👑 ADMIN OVERRIDE - Full access granted');
      return {
        canView: true,
        canCopy: true, // ADMIN sempre pode copiar
        level: componentLevel,
        requiresUpgrade: false
      };
    }

    // PRO têm acesso completo
    if (isPro) {
      return {
        canView: true,
        canCopy: true,
        level: componentLevel,
        requiresUpgrade: false
      };
    }

    // FREE users podem ver tudo, mas só copiar componentes free
    if (isFree) {
      return {
        canView: true,
        canCopy: componentLevel === 'free',
        level: componentLevel,
        requiresUpgrade: componentLevel === 'pro'
      };
    }

    // Fallback para usuários não autenticados
    return {
      canView: componentLevel === 'free',
      canCopy: false,
      level: componentLevel,
      requiresUpgrade: true
    };
  };

  const determineComponentLevel = (component: any): 'free' | 'pro' => {
    // CRITICAL: Usar connection_id OU _connectionId como fallback
    const connectionId = component.connection_id || component._connectionId;
    if (connectionId) {
      const connection = getConnectionById(connectionId);
      
      if (connection) {
        console.log('📊 DETAILED COMPONENT LEVEL DETERMINATION:', {
          componentId: component.id,
          componentTitle: typeof component.title === 'object' ? component.title?.rendered : component.title,
          connectionId: connectionId,
          originalConnectionId: component.connection_id,
          fallbackConnectionId: component._connectionId,
          connectionName: connection.name,
          connectionUserType: connection.userType,
          rawConnection: connection
        });
        
        // CRITICAL: Usar apenas connection.userType (já mapeado corretamente)
        const userType = connection.userType;
        
        console.log('🔍 MAPPING VERIFICATION:', {
          componentId: component.id,
          connectionId: connectionId,
          mappedUserType: connection.userType,
          resolvedUserType: userType,
          willBeClassifiedAs: userType === 'pro' ? 'PRO' : 'FREE',
          // Também verificar se temos _connectionUserType direto do componente
          componentUserType: component._connectionUserType
        });
        
        // Se a conexão é 'pro', o componente é PRO
        if (userType === 'pro') {
          console.log('🔒 COMPONENT CLASSIFIED AS PRO:', {
            componentId: component.id,
            connectionName: connection.name,
            reason: `userType: ${userType}`
          });
          return 'pro';
        }
        
        // Se a conexão é 'free' ou 'all', o componente é FREE
        if (userType === 'free' || userType === 'all') {
          console.log('✅ COMPONENT CLASSIFIED AS FREE:', {
            componentId: component.id,
            connectionName: connection.name,
            reason: `userType: ${userType}`
          });
          return 'free';
        }
        
        console.warn('⚠️ UNKNOWN USER TYPE, defaulting to FREE:', {
          componentId: component.id,
          connectionName: connection.name,
          userType: userType
        });
        return 'free';
      } else {
        console.error('💥 CONNECTION NOT FOUND FOR COMPONENT:', {
          componentId: component.id,
          connectionId: connectionId,
          originalConnectionId: component.connection_id,
          fallbackConnectionId: component._connectionId,
          availableConnections: 'check connections store'
        });
      }
    } else {
      console.warn('⚠️ COMPONENT HAS NO CONNECTION_ID:', {
        componentId: component.id,
        hasOriginalConnectionId: !!component.connection_id,
        hasFallbackConnectionId: !!component._connectionId,
        componentProperties: Object.keys(component),
        connectionUserType: component._connectionUserType
      });
    }

    // FALLBACK ADICIONAL: Se temos _connectionUserType diretamente no componente
    if (component._connectionUserType) {
      console.log('🔄 USING DIRECT COMPONENT USER TYPE:', {
        componentId: component.id,
        componentUserType: component._connectionUserType,
        willBeClassifiedAs: component._connectionUserType === 'pro' ? 'PRO' : 'FREE'
      });
      
      return component._connectionUserType === 'pro' ? 'pro' : 'free';
    }

    // Fallback final: se não conseguir determinar pela conexão, assume como free
    console.warn('⚠️ Could not determine component level from connection, defaulting to free:', {
      componentId: component.id,
      connectionId: connectionId,
      originalConnectionId: component.connection_id,
      fallbackConnectionId: component._connectionId
    });
    
    return 'free';
  };

  return {
    getComponentAccess,
    isPro,
    isAdmin,
    isFree
  };
};
