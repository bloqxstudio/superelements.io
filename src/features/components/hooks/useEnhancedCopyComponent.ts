
import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useComponentAccess } from '@/hooks/useComponentAccess';
import { useConnectionsStore } from '@/store/connectionsStore';
import { extractComponentForClipboard } from '@/utils/directElementorExtractor';
import { copyToClipboardEnhanced, getEnhancedClipboardErrorMessage } from '@/utils/enhancedRobustClipboard';

interface CopyState {
  copying: boolean;
  copied: boolean;
}

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  username?: string;
  applicationPassword?: string;
}

export const useEnhancedCopyComponent = () => {
  const [copyStates, setCopyStates] = useState<Record<string | number, CopyState>>({});
  const timeoutRefs = useRef<Record<string | number, NodeJS.Timeout>>({});
  const { getComponentAccess } = useComponentAccess();
  const { getConnectionById } = useConnectionsStore();

  const setCopyingState = useCallback((componentId: string | number, copying: boolean) => {
    setCopyStates(prev => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        copying
      }
    }));
  }, []);

  const setCopiedState = useCallback((componentId: string | number, copied: boolean) => {
    setCopyStates(prev => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        copied
      }
    }));
  }, []);

  const resetCopiedState = useCallback((componentId: string | number) => {
    if (timeoutRefs.current[componentId]) {
      clearTimeout(timeoutRefs.current[componentId]);
    }
    
    timeoutRefs.current[componentId] = setTimeout(() => {
      setCopiedState(componentId, false);
      delete timeoutRefs.current[componentId];
    }, 3000);
  }, [setCopiedState]);

  /**
   * Sistema de cópia com debugging completo para resolver o erro "Missing Connection"
   */
  const copyComponentToClipboard = useCallback(async (component: any, baseUrl: string) => {
    const wordpressId = component.originalId || component.id;
    const componentId = component.originalId || component.id;
    
    console.log('🔍 DETAILED COPY DEBUG START:', {
      componentId: component.id,
      originalId: component.originalId,
      wordpressId,
      componentTitle: typeof component.title === 'object' ? component.title?.rendered : component.title,
      providedBaseUrl: baseUrl,
      // Debugging connection_id from multiple sources
      componentConnectionId: component.connection_id,
      componentConnectionIdUnderscore: component._connectionId,
      componentConnectionName: component._connectionName,
      componentConnectionUserType: component._connectionUserType,
      hasConnectionId: !!component.connection_id,
      hasConnectionIdUnderscore: !!component._connectionId,
      fullComponent: component
    });
    
    // VERIFICAÇÃO CRÍTICA DE ACESSO (FREE vs PRO)
    const accessInfo = getComponentAccess(component);
    
    console.log('🛡️ COPY ACCESS VERIFICATION:', {
      componentId: component.id,
      componentTitle: typeof component.title === 'object' ? component.title?.rendered : component.title,
      userCanCopy: accessInfo.canCopy,
      componentLevel: accessInfo.level,
      requiresUpgrade: accessInfo.requiresUpgrade,
      connectionId: component.connection_id
    });
    
    // BLOQUEAR CÓPIA SE USUÁRIO NÃO TEM PERMISSÃO
    if (!accessInfo.canCopy) {
      console.log('🚫 COPY BLOCKED:', {
        reason: accessInfo.requiresUpgrade ? 'PRO_FEATURE_REQUIRED' : 'ACCESS_DENIED',
        componentLevel: accessInfo.level,
        componentId: component.id
      });
      
      if (accessInfo.requiresUpgrade) {
        toast({
          title: "🔒 PRO Feature Required",
          description: "This is a PRO component. Upgrade your plan to copy premium components.",
          duration: 5000
        });
      } else {
        toast({
          title: "🚫 Access Denied", 
          description: "You don't have permission to copy this component.",
          variant: "destructive",
          duration: 3000
        });
      }
      return;
    }
    
    // VERIFICAÇÃO EXTRA DE SEGURANÇA (Double-check)
    if (accessInfo.level === 'pro' && !accessInfo.canCopy) {
      console.error('🚨 SECURITY BREACH ATTEMPT:', {
        componentId: component.id,
        componentLevel: accessInfo.level,
        userCanCopy: accessInfo.canCopy,
        message: 'Free user attempting to copy PRO component'
      });
      
      toast({
        title: "🚨 Access Blocked",
        description: "This PRO component is not available on your current plan.",
        variant: "destructive",
        duration: 5000
      });
      return;
    }
    
    // Prevenir cópias simultâneas
    if (copyStates[componentId]?.copying) {
      console.warn('⚠️ Copy already in progress for component:', componentId);
      return;
    }
    
    setCopyingState(componentId, true);
    
    try {
      // Melhorar a busca do connection_id com fallbacks
      let connectionId = component.connection_id || component._connectionId;
      
      console.log('🔗 CONNECTION ID RESOLUTION:', {
        originalConnectionId: component.connection_id,
        fallbackConnectionId: component._connectionId,
        resolvedConnectionId: connectionId,
        hasResolvedConnection: !!connectionId
      });
      
      // Validação com mensagem mais específica
      if (!connectionId) {
        console.error('💥 MISSING CONNECTION ID DEBUG:', {
          componentId: component.id,
          originalId: component.originalId,
          availableProperties: Object.keys(component),
          componentData: component
        });
        
        throw new Error(`Missing connection ID for component ${component.id}. Available properties: ${Object.keys(component).join(', ')}`);
      }

      const connection = getConnectionById(connectionId);
      if (!connection) {
        console.error('💥 CONNECTION NOT FOUND DEBUG:', {
          searchedConnectionId: connectionId,
          componentId: component.id,
          originalId: component.originalId
        });
        
        throw new Error(`Connection not found for ID: ${connectionId}`);
      }

      if (!connection.username || !connection.application_password) {
        console.error('💥 MISSING CREDENTIALS DEBUG:', {
          connectionId: connectionId,
          connectionName: connection.name,
          hasUsername: !!connection.username,
          hasPassword: !!connection.application_password
        });
        
        throw new Error(`Missing WordPress credentials for connection: ${connection.name}`);
      }
      
      const extractConfig: WordPressConfig = {
        baseUrl: connection.base_url,
        postType: connection.post_type,
        username: connection.username,
        applicationPassword: connection.application_password
      };

      console.log('📡 EXTRACT CONFIG DEBUG:', {
        baseUrl: extractConfig.baseUrl,
        postType: extractConfig.postType,
        hasAuth: !!(extractConfig.username && extractConfig.applicationPassword),
        wordpressId,
        componentId: component.id,
        connectionName: connection.name
      });

      // Extrair dados do componente
      const clipboardJson = await extractComponentForClipboard(wordpressId, extractConfig);
      
      console.log('📊 EXTRACTED DATA SUCCESS:', {
        dataSize: clipboardJson.length,
        preview: clipboardJson.substring(0, 200) + '...'
      });
      
      // Copiar para clipboard
      const clipboardResult = await copyToClipboardEnhanced(clipboardJson);
      
      console.log('📋 CLIPBOARD RESULT:', clipboardResult);
      
      if (clipboardResult.success) {
        // Sucesso
        setCopyStates(prev => ({
          ...prev,
          [componentId]: {
            copying: false,
            copied: true
          }
        }));
        
        resetCopiedState(componentId);
        
        const levelEmoji = accessInfo.level === 'pro' ? '👑' : '✨';
        const methodInfo = clipboardResult.method === 'clipboard-api' ? '' : ` (${clipboardResult.method})`;
        
        toast({
          title: `${levelEmoji} Component Copied Successfully!`,
          description: `${accessInfo.level.toUpperCase()} component copied with all styles preserved. Ready to paste in Elementor!${methodInfo}`,
          duration: 4000
        });
        
        console.log('✅ COPY SUCCESS:', {
          componentTitle: typeof component.title === 'object' ? component.title?.rendered : component.title,
          level: accessInfo.level,
          connectionId: connectionId,
          postType: extractConfig.postType,
          clipboardSize: clipboardJson.length,
          method: clipboardResult.method
        });
      } else {
        // Falha no clipboard
        setCopyingState(componentId, false);
        
        if (clipboardResult.method === 'manual') {
          toast({
            title: "📋 Manual Copy Required",
            description: "A copy dialog has been opened. Please select all text and copy it manually.",
            duration: 6000
          });
        } else {
          const errorInfo = getEnhancedClipboardErrorMessage(clipboardResult.error);
          
          toast({
            title: errorInfo.title,
            description: errorInfo.description,
            variant: "destructive",
            duration: 8000
          });
        }
        
        console.error('💥 CLIPBOARD COPY FAILED:', {
          componentId: component.id,
          originalId: component.originalId,
          connectionId: connectionId,
          error: clipboardResult.error,
          method: clipboardResult.method
        });
      }
      
    } catch (error) {
      console.error('💥 COMPONENT EXTRACTION ERROR:', {
        componentId: component.id,
        originalId: component.originalId,
        connectionId: component.connection_id || component._connectionId,
        error: error instanceof Error ? error.message : error,
        fullError: error
      });
      
      setCopyingState(componentId, false);
      
      // Tratamento de erros mais específico
      let errorMessage = "🔧 Copy Failed";
      let errorDescription = "Unknown error occurred";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('missing connection id')) {
          errorMessage = "🔗 Missing Connection";
          errorDescription = "This component doesn't have a valid connection ID. Please refresh the page and try again.";
        } else if (errorMsg.includes('connection not found')) {
          errorMessage = "🔗 Connection Not Found";
          errorDescription = "The WordPress connection for this component could not be found. Please check your connections.";
        } else if (errorMsg.includes('missing wordpress credentials')) {
          errorMessage = "🔐 Missing Credentials";
          errorDescription = "WordPress username or application password is missing for this connection.";
        } else if (errorMsg.includes('authentication failed') || errorMsg.includes('401')) {
          errorMessage = "🔐 Authentication Error";
          errorDescription = "WordPress credentials are invalid. Please check your username and application password.";
        } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          errorMessage = "🔍 Component Not Found";
          errorDescription = "The component may have been removed or the connection URL is incorrect.";
        } else if (errorMsg.includes('no _elementor_data')) {
          errorMessage = "📭 No Elementor Data";
          errorDescription = "This component doesn't contain valid Elementor data to copy.";
        } else {
          errorDescription = error.message;
        }
      }
      
      toast({
        title: errorMessage,
        description: errorDescription,
        variant: "destructive",
        duration: 6000
      });
    }
  }, [copyStates, setCopyingState, resetCopiedState, getComponentAccess, getConnectionById]);

  const getCopyState = useCallback((componentId: string | number): CopyState => {
    return copyStates[componentId] || { copying: false, copied: false };
  }, [copyStates]);

  return {
    copyToClipboard: copyComponentToClipboard,
    getCopyState
  };
};
