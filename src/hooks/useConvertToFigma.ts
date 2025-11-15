import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ConversionResult {
  success: boolean;
  cached?: boolean;
  savedCost?: boolean;
  data?: any;
  error?: string;
}

export const useConvertToFigma = () => {
  const { user } = useAuth();
  const [converting, setConverting] = useState(false);

  const convertToFigma = async (
    componentId: number, 
    componentUrl: string,
    forceRefresh: boolean = false
  ): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Login Necessário",
        description: "Você precisa estar logado para copiar designs.",
        variant: "destructive"
      });
      return false;
    }

    setConverting(true);

    try {
      toast({
        title: "🎨 Convertendo para Figma...",
        description: "Aguarde enquanto preparamos o design para você.",
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke('convert-to-figma', {
        body: { 
          componentId, 
          componentUrl,
          forceRefresh
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Falha ao chamar função de conversão');
      }

      const result: ConversionResult = data;

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Falha na conversão');
      }

      // Copy to Figma clipboard
      await copyToFigmaClipboard(result.data);

      // Success toast with cache info
      const description = result.cached 
        ? "✨ Design copiado do cache (economia de custos)! Cole no Figma com Ctrl+V ou Cmd+V"
        : "✅ Design convertido e copiado! Cole no Figma com Ctrl+V ou Cmd+V";

      toast({
        title: "🎉 Pronto para Colar no Figma!",
        description,
        duration: 5000
      });

      // Track analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'design_converted_to_figma', {
          component_id: componentId,
          cached: result.cached,
          saved_cost: result.savedCost
        });
      }

      return true;

    } catch (error) {
      console.error('Conversion error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // User-friendly error messages
      let userMessage = errorMessage;
      let title = "Falha na Conversão";
      
      if (errorMessage.includes('CODE_TO_DESIGN_API_KEY')) {
        title = "Configuração Incompleta";
        userMessage = "A API key do code.to.design não está configurada. Entre em contato com o suporte.";
      } else if (errorMessage.includes('Failed to fetch')) {
        title = "Erro de Rede";
        userMessage = "Não foi possível carregar o componente. Verifique sua conexão.";
      } else if (errorMessage.includes('API error')) {
        title = "Erro da API";
        userMessage = "Falha ao converter o design. Tente novamente em alguns instantes.";
      }
      
      toast({
        title,
        description: userMessage,
        variant: "destructive",
        duration: 6000
      });

      return false;
    } finally {
      setConverting(false);
    }
  };

  return { convertToFigma, converting };
};

/**
 * Copy Figma data to clipboard in the correct format
 */
async function copyToFigmaClipboard(figmaData: any) {
  try {
    // The exact format depends on code.to.design API response
    // Usually it's special HTML that Figma recognizes
    const htmlContent = figmaData.html || figmaData.clipboard || JSON.stringify(figmaData);
    
    // Try using ClipboardItem API for better compatibility
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
      'text/plain': new Blob([htmlContent], { type: 'text/plain' })
    });

    await navigator.clipboard.write([clipboardItem]);
  } catch (clipboardError) {
    // Fallback to simple text copy
    console.warn('ClipboardItem failed, using text fallback:', clipboardError);
    const textContent = typeof figmaData === 'string' ? figmaData : JSON.stringify(figmaData);
    await navigator.clipboard.writeText(textContent);
  }
}
