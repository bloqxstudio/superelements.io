
import React, { memo, useCallback } from 'react';
import { Copy, Check, Crown, Lock, Unlock } from 'lucide-react';
import { useComponentAccess } from '@/hooks/useComponentAccess';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useEnhancedCopyComponent } from './hooks/useEnhancedCopyComponent';
import OptimizedDynamicIframe from './OptimizedDynamicIframe';

interface OptimizedComponentCardProps {
  component: any;
  onPreview: (url: string, title: string) => void;
  getDesktopPreviewUrl: (component: any) => string;
  getPreviewUrl: (component: any) => string;
  baseUrl: string;
}

const OptimizedComponentCard: React.FC<OptimizedComponentCardProps> = memo(({
  component,
  onPreview,
  getDesktopPreviewUrl,
  getPreviewUrl,
  baseUrl
}) => {
  const navigate = useNavigate();
  const { getComponentAccess } = useComponentAccess();
  const { copyToClipboard, getCopyState } = useEnhancedCopyComponent();
  
  // Helper function to get component title
  const getComponentTitle = useCallback((comp: any) => {
    if (typeof comp.title === 'string') {
      return comp.title;
    }
    return comp.title?.rendered || 'Untitled Component';
  }, []);
  
  const componentTitle = getComponentTitle(component);
  
  console.log('🎯 OPTIMIZED COMPONENT CARD RENDER:', {
    componentId: component.id,
    originalId: component.originalId,
    componentTitle,
    baseUrl,
    connectionId: component.connection_id,
    hasConnectionId: !!component.connection_id
  });
  
  // Memoize access info calculation
  const accessInfo = React.useMemo(() => getComponentAccess(component), [component, getComponentAccess]);
  
  // Memoize preview URLs
  const desktopPreviewUrl = React.useMemo(() => getDesktopPreviewUrl(component), [getDesktopPreviewUrl, component]);
  const previewUrl = React.useMemo(() => getPreviewUrl(component), [getPreviewUrl, component]);

  const handlePreviewClick = useCallback(() => {
    onPreview(previewUrl, componentTitle);
  }, [onPreview, previewUrl, componentTitle]);

  const handleCopyClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    console.log('🚀 COPY BUTTON CLICKED:', {
      componentId: component.id,
      originalId: component.originalId,
      connectionId: component.connection_id,
      baseUrl,
      canCopy: accessInfo.canCopy,
      requiresUpgrade: accessInfo.requiresUpgrade,
      hasConnectionId: !!component.connection_id
    });
    
    if (accessInfo.canCopy) {
      // Usuário tem acesso - tentar copiar
      await copyToClipboard(component, baseUrl);
    } else if (accessInfo.requiresUpgrade) {
      // Usuário precisa fazer upgrade
      navigate('/pricing');
    }
  }, [copyToClipboard, component, baseUrl, accessInfo, navigate]);

  const copyState = getCopyState(component.originalId || component.id);
  const { copying, copied } = copyState;

  const getCopyButtonContent = useCallback(() => {
    if (!accessInfo.canCopy && accessInfo.requiresUpgrade) {
      return {
        icon: <Unlock className="h-3 w-3" />,
        text: 'DESBLOQUEAR',
        className: 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
      };
    }

    if (copying) {
      return {
        icon: <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />,
        text: '...',
        className: 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
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
  }, [accessInfo.canCopy, accessInfo.requiresUpgrade, copying, copied]);

  const buttonContent = getCopyButtonContent();

  return (
    <div className="rounded-lg text-card-foreground shadow-sm group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card border border-border relative h-full flex flex-col">

      {/* Preview Container */}
      <div className="aspect-[4/3] bg-gray-50 cursor-pointer relative overflow-hidden flex-shrink-0" onClick={handlePreviewClick}>
        <div className="w-full h-full relative bg-white overflow-hidden">
          <OptimizedDynamicIframe 
            url={desktopPreviewUrl} 
            title={`Preview of ${componentTitle}`} 
          />
        </div>
        
        {/* Overlay for locked PRO components */}
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
            title={componentTitle} 
            className="font-semibold text-foreground leading-tight line-clamp-2 flex-1 pr-2 text-base"
          >
            {componentTitle}
          </h3>
          
          <button 
            onClick={handleCopyClick} 
            disabled={copying}
            className={`
              flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded 
              transition-all duration-200 disabled:cursor-not-allowed flex-shrink-0
              ${buttonContent.className}
            `} 
            title={
              accessInfo.canCopy 
                ? (copying ? "Copiando..." : (copied ? "Copiado!" : "Copiar componente"))
                : "Faça upgrade para PRO para copiar este componente"
            }
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
  // Optimized comparison - only re-render when necessary
  return (
    prevProps.component.id === nextProps.component.id &&
    prevProps.component.originalId === nextProps.component.originalId &&
    prevProps.component.connection_id === nextProps.component.connection_id &&
    prevProps.baseUrl === nextProps.baseUrl
  );
});

OptimizedComponentCard.displayName = 'OptimizedComponentCard';
export default OptimizedComponentCard;
