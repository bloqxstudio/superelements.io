
import React, { memo, useCallback } from 'react';
import { Copy, Check, Crown, Lock } from 'lucide-react';
import { useComponentAccess } from '@/hooks/useComponentAccess';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import OptimizedDynamicIframe from './OptimizedDynamicIframe';

interface ComponentCardProps {
  component: any;
  onPreview: (url: string, title: string) => void;
  onCopy: (component: any) => void;
  copyState: {
    copying: boolean;
    copied: boolean;
  };
  getDesktopPreviewUrl: (component: any) => string;
  getPreviewUrl: (component: any) => string;
}

const ComponentCard: React.FC<ComponentCardProps> = memo(({
  component,
  onPreview,
  onCopy,
  copyState,
  getDesktopPreviewUrl,
  getPreviewUrl
}) => {
  const navigate = useNavigate();
  const { getComponentAccess } = useComponentAccess();
  const accessInfo = getComponentAccess(component);

  const handlePreviewClick = useCallback(() => {
    onPreview(getPreviewUrl(component), component.title.rendered);
  }, [onPreview, getPreviewUrl, component]);

  const handleCopyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (accessInfo.canCopy) {
      onCopy(component);
    } else if (accessInfo.requiresUpgrade) {
      // Redirecionar para página de upgrade
      navigate('/pricing');
    }
  }, [onCopy, component, accessInfo, navigate]);

  const { copying, copied } = copyState;

  const getCopyButtonContent = () => {
    if (!accessInfo.canCopy && accessInfo.requiresUpgrade) {
      return {
        icon: <Crown className="h-3 w-3" />,
        text: 'PRO',
        className: 'bg-gradient-to-r from-yellow-400 to-orange-500 border-yellow-500 text-white hover:from-yellow-500 hover:to-orange-600'
      };
    }

    if (copying) {
      return {
        icon: <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />,
        text: '...',
        className: 'bg-gray-100 border-gray-300 text-gray-400'
      };
    }

    if (copied) {
      return {
        icon: <Check className="h-3 w-3" />,
        text: 'COPIADO!',
        className: 'bg-green-500 border-green-500 text-white hover:bg-green-600'
      };
    }

    return {
      icon: <Copy className="h-3 w-3" />,
      text: 'COPIAR',
      className: 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600 hover:border-gray-300'
    };
  };

  const buttonContent = getCopyButtonContent();

  return (
    <div className="rounded-lg text-card-foreground shadow-sm group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card border border-border relative h-full flex flex-col">
      
      {/* PRO Badge */}
      {accessInfo.level === 'pro' && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold">
            <Crown className="h-3 w-3 mr-1" />
            PRO
          </Badge>
        </div>
      )}

      {/* Preview Container - Fluid with 4:3 aspect ratio */}
      <div className="aspect-[4/3] bg-gray-50 cursor-pointer relative overflow-hidden flex-shrink-0" onClick={handlePreviewClick}>
        <div className="w-full h-full relative bg-white overflow-hidden">
          <OptimizedDynamicIframe 
            url={getDesktopPreviewUrl(component)} 
            title={`Preview of ${component.title.rendered}`} 
          />
        </div>
        
        {/* Overlay para componentes PRO não acessíveis */}
        {!accessInfo.canCopy && accessInfo.requiresUpgrade && (
          <div className="absolute inset-0 bg-black bg-opacity-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-white rounded-lg p-3 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Lock className="h-4 w-4" />
                <span>Recurso PRO</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Content Container */}
      <div className="p-3 flex-1 flex flex-col justify-center relative">
        <div className="flex items-center justify-between gap-2">
          <h3 
            title={component.title.rendered} 
            className="font-semibold text-foreground leading-tight line-clamp-2 flex-1 pr-2 text-base"
          >
            {component.title.rendered}
          </h3>
          
          <button 
            onClick={handleCopyClick} 
            disabled={copying || copied}
            className={`
              flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded 
              transition-all duration-200 disabled:cursor-not-allowed flex-shrink-0
              ${buttonContent.className}
            `} 
            title={accessInfo.canCopy ? "Copiar componente" : "Faça upgrade para PRO para copiar este componente"}
          >
            {buttonContent.icon}
            <span className="font-medium">
              {buttonContent.text}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Optimized comparison - only check what actually matters for re-rendering
  return (
    prevProps.component.id === nextProps.component.id &&
    prevProps.copyState.copying === nextProps.copyState.copying &&
    prevProps.copyState.copied === nextProps.copyState.copied &&
    prevProps.component.title.rendered === nextProps.component.title.rendered
  );
});

ComponentCard.displayName = 'ComponentCard';
export default ComponentCard;
