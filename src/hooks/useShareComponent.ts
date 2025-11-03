import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export const useShareComponent = () => {
  const shareComponent = useCallback(async (
    component: any,
    connectionId: string
  ) => {
    const componentId = component.originalId || component.id;
    const shareUrl = `${window.location.origin}/component/${connectionId}/${componentId}`;
    const componentTitle = component.title?.rendered || component.title || 'Componente';
    
    // Se suporta Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: componentTitle,
          text: 'Confira este componente!',
          url: shareUrl
        });
        
        toast({
          title: "✅ Compartilhado!",
          description: "Link compartilhado com sucesso"
        });
        return;
      } catch (error) {
        // Usuário cancelou ou erro
        if ((error as Error).name !== 'AbortError') {
          console.error('Erro ao compartilhar:', error);
        }
      }
    }
    
    // Fallback: Copiar para clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "🔗 Link copiado!",
        description: "O link foi copiado para sua área de transferência",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar link",
        description: "Não foi possível copiar o link",
        variant: "destructive"
      });
    }
  }, []);

  return { shareComponent };
};
