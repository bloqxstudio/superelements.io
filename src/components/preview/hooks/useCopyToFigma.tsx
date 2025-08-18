
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
          title: "Component Not Found",
          description: "Could not find the component data for Figma copy",
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
            title: "🎨 Copied to Figma!",
            description: "Component copied in Figma format. Paste directly in Figma to see the design!",
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
            title: "🎨 Copied as SVG!",
            description: "Component copied as SVG. Paste in Figma - it will appear as an image that you can trace or use as reference.",
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
          title: "📋 Copied as JSON",
          description: "Component copied as JSON data. Use a Figma plugin like 'JSON to Figma' to import it.",
          duration: 5000
        });
        return;
      }

      // If nothing works, show helpful message
      toast({
        title: "⚠️ Limited Copy Options",
        description: "This component has limited data. The title and basic structure were copied as text. Consider using the 'Open in New Tab' option to view the full component.",
        variant: "destructive",
        duration: 6000
      });
      
      // Copy at least the basic info
      const basicInfo = `${component.title?.rendered || 'WordPress Component'}\nSource: ${previewUrl}`;
      await navigator.clipboard.writeText(basicInfo);
      
    } catch (error) {
      console.error('💥 Figma copy error:', error);
      
      toast({
        title: "Copy Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred while copying to Figma",
        variant: "destructive",
        duration: 6000
      });
    }
  };

  return { copyToFigma };
};
