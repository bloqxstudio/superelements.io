
import { useWordPressStore } from '@/store/wordpressStore';
import { toast } from '@/hooks/use-toast';
import { copyComponentToFigmaKiwiEnhanced, canConvertToFigmaKiwiEnhanced } from '@/utils/figmaKiwiExportEnhanced';
import { copyComponentToFigmaAsSVG, canConvertToSVG } from '@/utils/figmaSvgExport';
import { copyComponentToFigma, canConvertToFigma } from '@/utils/figmaClipboard';

export const useCopyToFigma = () => {
  const { components, config } = useWordPressStore();

  const copyToFigma = async (previewUrl: string, title: string) => {
    try {
      console.log('🎯 Starting Figma copy process for:', title);
      
      // Find the component
      const component = components.find(comp => {
        const componentPreviewUrl = comp[config.previewField] || comp.link;
        return componentPreviewUrl === previewUrl || comp.title.rendered === title;
      });

      if (!component) {
        toast({
          title: "Componente Não Encontrado",
          description: "Não foi possível encontrar os dados do componente para cópia no Figma",
          variant: "destructive"
        });
        return;
      }

      console.log('📦 Component found:', component.title?.rendered);

      // Try enhanced Kiwi format first (with fallback data generation)
      if (canConvertToFigmaKiwiEnhanced(component)) {
        try {
          await copyComponentToFigmaKiwiEnhanced(component);
          
          toast({
            title: "🎨 Copiado para o Figma!",
            description: "Componente copiado no formato Figma. Cole diretamente no Figma para ver o design!",
            duration: 5000
          });
          return;
        } catch (kiwiError) {
          console.warn('⚠️ Enhanced Kiwi copy failed, trying SVG fallback:', kiwiError);
        }
      }

      // Try SVG as second method
      if (canConvertToSVG(component)) {
        try {
          await copyComponentToFigmaAsSVG(component);
          
          toast({
            title: "🎨 Copiado como SVG!",
            description: "Componente copiado como SVG. Cole no Figma - aparecerá como uma imagem que você pode rastrear ou usar como referência.",
            duration: 5000
          });
          return;
        } catch (svgError) {
          console.warn('⚠️ SVG copy failed, trying JSON fallback:', svgError);
        }
      }

      // Final fallback to JSON
      if (canConvertToFigma(component)) {
        await copyComponentToFigma(component);
        
        toast({
          title: "📋 Copiado como JSON",
          description: "Componente copiado como dados JSON. Use um plugin do Figma como 'JSON to Figma' para importá-lo.",
          duration: 5000
        });
        return;
      }

      // If nothing works, show helpful message
      toast({
        title: "⚠️ Opções de Cópia Limitadas",
        description: "Este componente tem dados limitados. O título e estrutura básica foram copiados como texto. Considere usar a opção 'Abrir em Nova Aba' para ver o componente completo.",
        variant: "destructive",
        duration: 6000
      });
      
      // Copy at least the basic info
      const basicInfo = `${component.title?.rendered || 'Componente WordPress'}\nFonte: ${previewUrl}`;
      await navigator.clipboard.writeText(basicInfo);
      
    } catch (error) {
      console.error('💥 Figma copy error:', error);
      
      toast({
        title: "Falha na Cópia",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado ao copiar para o Figma",
        variant: "destructive",
        duration: 6000
      });
    }
  };

  return { copyToFigma };
};
