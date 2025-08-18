
import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useEnhancedCopyComponent } from '@/features/components/hooks/useEnhancedCopyComponent';
import { useWordPressStore } from '@/store/wordpressStore';
import { useConnectionsStore } from '@/store/connectionsStore';

export const useCopyComponent = () => {
  const { copyToClipboard } = useEnhancedCopyComponent();
  const { components, config } = useWordPressStore();
  const { getConnectionById } = useConnectionsStore();

  const copyComponent = useCallback(async (componentOrUrl: any, title?: string) => {
    console.log('🚀 MODAL COPY STARTED:', { 
      hasComponent: typeof componentOrUrl === 'object',
      componentOrUrl, 
      title 
    });
    
    try {
      // NOVO SISTEMA: Se recebemos o componente completo
      if (typeof componentOrUrl === 'object' && componentOrUrl.id) {
        console.log('✅ Using NEW modal copy system with full component');
        
        const component = componentOrUrl;
        
        // Obter baseUrl usando a mesma lógica do ComponentGridContent
        let baseUrl = '';
        if (component.connection_id) {
          const connection = getConnectionById(component.connection_id);
          if (connection) {
            baseUrl = connection.base_url;
            console.log('🔗 Modal connection found:', {
              connectionId: component.connection_id,
              connectionName: connection.name,
              baseUrl
            });
          }
        }
        
        // Usar o mesmo sistema dos cards
        await copyToClipboard(component, baseUrl);
        return;
      }
      
      // SISTEMA ANTIGO: Fallback para compatibilidade (quando só temos URL/título)
      console.log('⚠️ Using LEGACY modal copy system - searching by URL/title');
      
      const previewUrl = componentOrUrl;
      const component = components.find(comp => {
        const componentPreviewUrl = comp[config.previewField] || comp.link;
        const matchesUrl = componentPreviewUrl === previewUrl;
        const matchesTitle = comp.title.rendered === title;
        
        console.log('🔍 Legacy search - Checking component match:', {
          componentId: comp.id,
          componentTitle: comp.title?.rendered,
          componentPreviewUrl,
          matchesUrl,
          matchesTitle
        });
        
        return matchesUrl || matchesTitle;
      });

      if (!component) {
        console.error('💥 Component not found for legacy copy:', { previewUrl, title, availableComponents: components.length });
        toast({
          title: "❌ Component Not Found",
          description: "Could not find the component data for copying",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Component found for legacy copy:', {
        id: component.id,
        title: component.title?.rendered
      });

      // Montar objeto compatível e usar sistema novo
      const compatibleComponent = {
        id: component.id,
        originalId: component.id,
        title: component.title,
        connection_id: undefined, // Legacy não tem connection_id
        url: component.link
      };

      const extractConfig = {
        baseUrl: config.baseUrl || '',
        postType: config.postType || 'posts',
        username: config.username,
        applicationPassword: config.applicationPassword
      };

      await copyToClipboard(compatibleComponent, extractConfig.baseUrl);
      
    } catch (error) {
      console.error('💥 MODAL COPY ERROR:', {
        error: error instanceof Error ? error.message : error,
        fullError: error,
        componentOrUrl,
        title
      });
      
      toast({
        title: "🔧 Copy Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
        duration: 6000
      });
    }
  }, [copyToClipboard, components, config, getConnectionById]);

  return { copyComponent };
};
