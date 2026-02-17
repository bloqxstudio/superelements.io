
import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useEnhancedCopyComponent } from '@/features/components/hooks/useEnhancedCopyComponent';
import { useWordPressStore } from '@/store/wordpressStore';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useAuth } from '@/contexts/AuthContext';
import { extractComponentForClipboard, formatForElementorClipboard } from '@/utils/enhancedElementorExtractor';
import { copyToClipboardEnhanced } from '@/utils/enhancedRobustClipboard';
import { supabase } from '@/integrations/supabase/client';

export const useCopyComponent = () => {
  const { user } = useAuth();
  const { copyToClipboard } = useEnhancedCopyComponent();
  const { components, config } = useWordPressStore();
  const { getConnectionById } = useConnectionsStore();

  const resolveComponentContext = useCallback((componentOrUrl: any, title?: string) => {
    if (typeof componentOrUrl === 'object' && componentOrUrl?.id) {
      const component = componentOrUrl;
      const componentId = component.originalId || component.id;
      const connection = component.connection_id ? getConnectionById(component.connection_id) : null;

      const wordpressConfig = {
        baseUrl: connection?.base_url || '',
        postType: connection?.post_type || 'posts',
        username: connection?.credentials?.username || '',
        applicationPassword: connection?.credentials?.application_password || ''
      };

      if (!wordpressConfig.baseUrl) {
        throw new Error('Não foi possível identificar a URL base da conexão para personalizar este componente.');
      }

      return { component, componentId, wordpressConfig, jsonField: connection?.json_field || config.jsonField || '_elementor_data' };
    }

    const previewUrl = componentOrUrl;
    const legacyComponent = components.find(comp => {
      const componentPreviewUrl = comp[config.previewField] || comp.link;
      return componentPreviewUrl === previewUrl || comp.title?.rendered === title;
    });

    if (!legacyComponent) {
      throw new Error('Não foi possível encontrar os dados do componente para personalização.');
    }

    const componentId = legacyComponent.originalId || legacyComponent.id;
    const fallbackBaseUrl = config.baseUrl || '';

    if (!fallbackBaseUrl) {
      throw new Error('URL base do WordPress não está configurada para personalização.');
    }

    const wordpressConfig = {
      baseUrl: fallbackBaseUrl,
      postType: config.postType || 'posts',
      username: config.username,
      applicationPassword: config.applicationPassword
    };

    return { component: legacyComponent, componentId, wordpressConfig, jsonField: config.jsonField || '_elementor_data' };
  }, [components, config, getConnectionById]);

  const parseElementorCandidates = useCallback((source: unknown): any[] | null => {
    if (!source) return null;

    try {
      const parsed = typeof source === 'string' ? JSON.parse(source) : source;

      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasElementorShape = parsed.some((item) => item && typeof item === 'object' && (item.elType || item.widgetType || item.elements));
        return hasElementorShape ? parsed : null;
      }

      if (parsed && typeof parsed === 'object' && ((parsed as any).elType || (parsed as any).widgetType || (parsed as any).elements)) {
        return [parsed];
      }
    } catch {
      return null;
    }

    return null;
  }, []);

  const extractClipboardJsonWithFallback = useCallback(async (
    component: any,
    componentId: number,
    wordpressConfig: { baseUrl: string; postType: string; username?: string; applicationPassword?: string },
    jsonField: string
  ): Promise<string> => {
    try {
      return await extractComponentForClipboard(componentId, wordpressConfig, component);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldTryFallback = message.includes('does not contain Elementor data') || message.includes('No _elementor_data found');

      if (!shouldTryFallback) {
        throw error;
      }

      const candidates = [
        component?.[jsonField],
        component?.meta?.[jsonField],
        component?.acf?.[jsonField],
      ];

      for (const candidate of candidates) {
        const elements = parseElementorCandidates(candidate);
        if (elements && elements.length > 0) {
          return formatForElementorClipboard(elements, wordpressConfig.baseUrl);
        }
      }

      throw error;
    }
  }, [parseElementorCandidates]);

  const copyComponent = useCallback(async (componentOrUrl: any, title?: string) => {
    if (!user) {
      toast({
        title: "Acesso negado",
        description: "Você precisa estar logado para copiar componentes.",
        variant: "destructive",
      });
      return;
    }

    try {
      // NEW SYSTEM: If we received the full component
      if (typeof componentOrUrl === 'object' && componentOrUrl.id) {
        
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
          title: "❌ Componente Não Encontrado",
          description: "Não foi possível encontrar os dados do componente para cópia",
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
        title: "🔧 Falha na Cópia",
        description: error instanceof Error ? error.message : "Erro desconhecido ocorreu",
        variant: "destructive",
        duration: 6000
      });
    }
  }, [user, copyToClipboard, components, config, getConnectionById]);

  const personalizeAndCopyComponent = useCallback(async (
    componentOrUrl: any,
    prompt: string,
    title?: string,
    referenceUrl?: string
  ) => {
    if (!user) {
      toast({
        title: "Acesso negado",
        description: "Você precisa estar logado para usar copy personalizada.",
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "Prompt obrigatório",
        description: "Descreva o conteúdo que você quer aplicar no componente.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { component, componentId, wordpressConfig, jsonField } = resolveComponentContext(componentOrUrl, title);

      const clipboardJson = await extractClipboardJsonWithFallback(
        component,
        Number(componentId),
        wordpressConfig,
        jsonField
      );

      const { data, error } = await supabase.functions.invoke('personalize-component-copy', {
        body: {
          prompt: prompt.trim(),
          clipboardJson,
          componentTitle: component?.title?.rendered || title || 'Componente',
          referenceUrl: referenceUrl?.trim() || null,
        }
      });

      if (error || !data?.success || !data?.data?.personalized_json) {
        let detailedError = error?.message || data?.error || 'Falha ao gerar copy personalizada';
        const context = (error as any)?.context;

        if (context instanceof Response) {
          try {
            const contextPayload = await context.json();
            if (contextPayload?.error) {
              detailedError = contextPayload.error;
            }
          } catch {
            // keep fallback message
          }
        }

        throw new Error(detailedError);
      }

      const result = await copyToClipboardEnhanced(data.data.personalized_json);
      if (!result.success) {
        throw new Error(result.error || 'Falha ao copiar JSON personalizado');
      }

      toast({
        title: "✅ Copy personalizada pronta",
        description: "JSON atualizado com IA e copiado para a área de transferência.",
        duration: 4000
      });
    } catch (error) {
      console.error('💥 PERSONALIZED COPY ERROR:', error);
      toast({
        title: "Falha na copy personalizada",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
        duration: 6000
      });
    }
  }, [user, resolveComponentContext, extractClipboardJsonWithFallback]);

  return { copyComponent, personalizeAndCopyComponent };
};
