import { useState, useCallback, useRef } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { toast } from '@/hooks/use-toast';
import { extractComponentForClipboard } from '@/utils/enhancedElementorExtractor';
import { copyToClipboardEnhanced } from '@/utils/enhancedRobustClipboard';

interface CopyState {
  copying: boolean;
  copied: boolean;
}

export const useEnhancedCopyComponent = () => {
  const { connections, getConnectionById } = useConnectionsStore();
  const [copyStates, setCopyStates] = useState<Record<string, CopyState>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const setCopyState = useCallback((componentId: string, state: Partial<CopyState>) => {
    setCopyStates(prev => ({
      ...prev,
      [componentId]: { ...prev[componentId], ...state }
    }));
  }, []);

  const copyToClipboard = useCallback(async (component: any, baseUrl: string) => {
    const componentId = component.originalId || component.id;
    
    try {
      setCopyState(componentId, { copying: true, copied: false });
      
      // Get connection for WordPress config
      const connection = component.connection_id ? getConnectionById(component.connection_id) : null;
      
      if (!connection && !baseUrl) {
        throw new Error('No connection or baseUrl available for component extraction');
      }

      // Validate connection if available
      if (connection && connection.status !== 'connected') {
        throw new Error('WordPress connection is not active. Please check your connection settings.');
      }

      // Build WordPress config
      const wordpressConfig = {
        baseUrl: connection?.base_url || baseUrl,
        postType: connection?.post_type || 'posts',
        username: connection?.username || '',
        applicationPassword: connection?.application_password || ''
      };

      // Validate required fields
      if (!wordpressConfig.baseUrl) {
        throw new Error('WordPress site URL is required');
      }

      console.log('🚀 Starting component copy:', {
        componentId,
        baseUrl: wordpressConfig.baseUrl,
        postType: wordpressConfig.postType,
        hasAuth: !!(wordpressConfig.username && wordpressConfig.applicationPassword),
        isVercel: window.location.hostname.includes('vercel.app') || window.location.hostname.includes('superelements.io'),
        hostname: window.location.hostname,
        secureContext: window.isSecureContext,
        hasClipboardApi: !!navigator.clipboard
      });

      // Extract component data - pass the full component object for local data priority
      const elementorData = await extractComponentForClipboard(
        parseInt(componentId),
        wordpressConfig,
        component // Pass the component object for local data extraction
      );

      // Copy to clipboard using enhanced system
      const result = await copyToClipboardEnhanced(elementorData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to copy to clipboard');
      }

      setCopyState(componentId, { copying: false, copied: true });
      
      // Reset after 3 seconds
      if (timeoutRefs.current[componentId]) {
        clearTimeout(timeoutRefs.current[componentId]);
      }
      
      timeoutRefs.current[componentId] = setTimeout(() => {
        setCopyState(componentId, { copied: false });
        delete timeoutRefs.current[componentId];
      }, 3000);
      
      toast({
        title: "✅ Componente Copiado!",
        description: "Componente copiado com sucesso. Pronto para colar!",
        variant: "default",
        duration: 3000
      });
      
    } catch (error) {
      console.error('Copy component error:', error);
      setCopyState(componentId, { copying: false, copied: false });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Enhanced error handling with specific messages for Elementor components
      let userMessage = '';
      let title = "Falha na Cópia";
      
      if (errorMessage.includes('not created with Elementor') || errorMessage.includes('does not contain Elementor data') || errorMessage.includes('NO VALID ELEMENTOR DATA FOUND')) {
        title = "Falha na Cópia";
        userMessage = "Falha ao copiar componente. Tente novamente.";
      } else if (errorMessage.includes('ELEMENTOR COMPONENT DETECTED BUT DATA EXTRACTION FAILED')) {
        title = "Falha na Cópia";
        userMessage = "Falha ao copiar componente. Tente novamente.";
      } else if (errorMessage.includes('Authentication failed')) {
        title = "Erro de Autenticação";
        userMessage = "Credenciais do WordPress são inválidas ou expiraram. Verifique seu nome de usuário e senha de aplicativo nas configurações de conexão.";
      } else if (errorMessage.includes('Component not found')) {
        title = "Componente Não Encontrado";
        userMessage = "O componente não foi encontrado. Pode ter sido excluído ou movido.";
      } else if (errorMessage.includes('Access denied')) {
        title = "Acesso Negado";
        userMessage = "Seu usuário WordPress não tem permissão para acessar este conteúdo. Entre em contato com o administrador.";
      } else if (errorMessage.includes('connection is not active')) {
        title = "Erro de Conexão";
        userMessage = "Conexão WordPress não está ativa. Reconecte-se ao seu site WordPress.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        title = "Erro de Rede";
        userMessage = "Falha na conexão de rede. Verifique sua conexão com a internet e tente novamente.";
      } else if (errorMessage.includes('site URL is required')) {
        title = "Erro de Configuração";
        userMessage = "URL do site WordPress está faltando. Verifique suas configurações de conexão.";
      } else {
        userMessage = `Falha ao copiar componente: ${errorMessage}`;
      }
      
      toast({
        title,
        description: userMessage,
        variant: "destructive",
        duration: 6000
      });
    }
  }, [setCopyState, getConnectionById]);

  const getCopyState = useCallback((componentId: string): CopyState => {
    return copyStates[componentId] || { copying: false, copied: false };
  }, [copyStates]);

  return {
    copyToClipboard,
    getCopyState
  };
};