import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { CartItem } from '@/store/cartStore';
import { extractMultipleComponents, formatMultipleForClipboard } from '@/utils/cartElementorExtractor';

export const useCartCopy = () => {
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const copyAllToClipboard = async (items: CartItem[]) => {
    if (items.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione componentes ao carrinho antes de copiar.",
        variant: "destructive",
      });
      return;
    }

    setCopying(true);
    setProgress({ current: 0, total: items.length });

    try {
      toast({
        title: "Copiando componentes...",
        description: `Processando ${items.length} componente${items.length > 1 ? 's' : ''}...`,
      });

      const { elements, failedItems } = await extractMultipleComponents(items);

      if (elements.length === 0) {
        toast({
          title: "Erro ao copiar",
          description: "Nenhum componente pôde ser extraído. Verifique sua conexão.",
          variant: "destructive",
        });
        return;
      }

      const baseUrl = items[0]?.baseUrl || '';
      const clipboardData = formatMultipleForClipboard(elements, baseUrl);

      await navigator.clipboard.writeText(clipboardData);

      const successCount = items.length - failedItems.length;
      
      if (failedItems.length === 0) {
        toast({
          title: "✅ Sucesso!",
          description: `${successCount} componente${successCount > 1 ? 's copiados' : ' copiado'}! Cole no Elementor.`,
        });
      } else {
        toast({
          title: "⚠️ Parcialmente copiado",
          description: `${successCount} copiado${successCount > 1 ? 's' : ''}, ${failedItems.length} falhou${failedItems.length > 1 ? 'ram' : ''}: ${failedItems.join(', ')}`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Cart copy error:', error);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar os componentes. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return { copyAllToClipboard, copying, progress };
};
