import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { CartItem } from '@/store/cartStore';
import { formatMultipleForClipboard } from '@/utils/cartElementorExtractor';
import { extractComponentForClipboard } from '@/utils/enhancedElementorExtractor';
import { copyToClipboardEnhanced } from '@/utils/enhancedRobustClipboard';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectionsStore } from '@/store/connectionsStore';
import { supabase } from '@/integrations/supabase/client';

const getPositionLabel = (index: number, total: number): string => {
  if (total === 1) return 'seção principal da página';
  if (index === 0) return 'hero/topo da página (primeira seção visível)';
  if (index === total - 1) return 'seção final / CTA de fechamento da página';
  if (index === 1 && total > 2) return 'segunda seção (apresentação de benefícios ou features)';
  return `seção intermediária ${index + 1} de ${total} (conteúdo de apoio)`;
};

const buildPrompt = (rawCopy: string, componentTitle: string, index: number, total: number): string => {
  const position = getPositionLabel(index, total);
  return `Este componente ocupa a posição: ${position}.

Conteúdo bruto fornecido pelo cliente:
${rawCopy}

Adapte os textos deste componente (${componentTitle}) para que reflitam o conteúdo acima de forma coerente com sua posição na página.`;
};

const resolveConfig = (item: CartItem, getConnectionById: (id: string) => any) => {
  const connection = getConnectionById(item.connectionId);
  const baseUrl = (connection?.base_url || item.baseUrl || '').replace(/\/$/, '');
  return {
    baseUrl,
    postType: connection?.post_type || item.postType || 'posts',
    username: connection?.credentials?.username,
    applicationPassword: connection?.credentials?.application_password,
  };
};

const extractEdgeFunctionError = async (error: any): Promise<string> => {
  const context = error?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.json();
      if (payload?.error) return payload.error;
    } catch {
      // ignore
    }
  }
  return error?.message || 'Falha ao gerar copy personalizada';
};

export const useCartPersonalize = () => {
  const { user } = useAuth();
  const { getConnectionById } = useConnectionsStore();
  const [personalizing, setPersonalizing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const personalizeAndCopy = async (items: CartItem[], rawCopy: string) => {
    if (!user) {
      toast({ title: "Acesso negado", description: "Você precisa estar logado para personalizar componentes.", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione componentes ao carrinho antes de personalizar.", variant: "destructive" });
      return;
    }
    if (!rawCopy.trim()) {
      toast({ title: "Copy obrigatória", description: "Insira o conteúdo bruto antes de personalizar.", variant: "destructive" });
      return;
    }

    setPersonalizing(true);
    setProgress({ current: 0, total: items.length });

    const personalizedElements: any[] = [];
    const failedTitles: string[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setProgress({ current: i + 1, total: items.length });

        const componentTitle =
          typeof item.component.title === 'string'
            ? item.component.title
            : item.component.title?.rendered || `Componente ${i + 1}`;

        try {
          const componentId = Number(item.component.originalId || item.component.id);
          const config = resolveConfig(item, getConnectionById);

          // Use enhancedElementorExtractor — tries local data first, then API with retry
          const clipboardJson = await extractComponentForClipboard(componentId, config, item.component);

          const prompt = buildPrompt(rawCopy, componentTitle, i, items.length);

          const { data, error } = await supabase.functions.invoke('personalize-component-copy', {
            body: { prompt, clipboardJson, componentTitle },
          });

          if (error || !data?.success || !data?.data?.personalized_json) {
            const message = error ? await extractEdgeFunctionError(error) : (data?.error || 'Resposta inválida da IA');
            console.warn(`Personalization failed for "${componentTitle}":`, message);
            // Fallback: push original elements
            const original = JSON.parse(clipboardJson);
            if (original?.elements) personalizedElements.push(...original.elements);
            failedTitles.push(componentTitle);
          } else {
            const personalized = JSON.parse(data.data.personalized_json);
            if (personalized?.elements) {
              personalizedElements.push(...personalized.elements);
            } else {
              const original = JSON.parse(clipboardJson);
              if (original?.elements) personalizedElements.push(...original.elements);
              failedTitles.push(componentTitle);
            }
          }
        } catch (itemError) {
          console.error(`Extraction error for "${componentTitle}":`, itemError);
          failedTitles.push(componentTitle);
        }
      }

      if (personalizedElements.length === 0) {
        toast({ title: "Erro na personalização", description: "Nenhum componente pôde ser processado. Verifique sua conexão.", variant: "destructive" });
        return;
      }

      const baseUrl = items[0]?.baseUrl || '';
      const clipboardData = formatMultipleForClipboard(personalizedElements, baseUrl);
      const clipResult = await copyToClipboardEnhanced(clipboardData);
      if (!clipResult.success) {
        throw new Error(clipResult.error || 'Falha ao copiar para a área de transferência');
      }

      const successCount = items.length - failedTitles.length;
      if (failedTitles.length === 0) {
        toast({
          title: "✅ Personalizado e copiado!",
          description: `${successCount} componente${successCount > 1 ? 's personalizados' : ' personalizado'}! Cole no Elementor.`,
        });
      } else {
        toast({
          title: "⚠️ Parcialmente personalizado",
          description: `${successCount} ok, ${failedTitles.length} sem personalização: ${failedTitles.join(', ')}. Cole no Elementor.`,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('🔴 Cart personalize OUTER error:', msg, error);
      toast({ title: "Erro ao personalizar", description: msg || "Não foi possível personalizar os componentes. Tente novamente.", variant: "destructive" });
    } finally {
      setPersonalizing(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return { personalizeAndCopy, personalizing, progress };
};
