
import React, { memo, useCallback } from 'react';
import { Copy, Check, Lock, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useEnhancedCopyComponent } from './hooks/useEnhancedCopyComponent';
import { useAuth } from '@/contexts/AuthContext';
import OptimizedDynamicIframe from './OptimizedDynamicIframe';
import { AddToCartButton } from '@/features/cart/components/AddToCartButton';
import { ComponentAccessBadge } from '@/components/ComponentAccessBadge';
import { toast } from '@/hooks/use-toast';
import { useShareComponent } from '@/hooks/useShareComponent';

interface OptimizedComponentCardProps {
  component: any;
  onPreview: (url: string, title: string) => void;
  getDesktopPreviewUrl: (component: any) => string;
  getPreviewUrl: (component: any) => string;
  baseUrl: string;
  connectionId?: string;
  postType?: string;
  accessLevel?: 'free' | 'pro' | 'admin';
}

const OptimizedComponentCard: React.FC<OptimizedComponentCardProps> = memo(({
  component,
  onPreview,
  getDesktopPreviewUrl,
  getPreviewUrl,
  baseUrl,
  connectionId = '',
  postType = 'posts',
  accessLevel = 'free'
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { copyToClipboard, getCopyState } = useEnhancedCopyComponent();
  const { shareComponent } = useShareComponent();
  
  // Helper function to get component title
  const getComponentTitle = useCallback((comp: any) => {
    if (typeof comp.title === 'string') {
      return comp.title;
    }
    return comp.title?.rendered || 'Untitled Component';
  }, []);
  
  const componentTitle = getComponentTitle(component);
  
  
  // Calculate access based on user role and component accessLevel
  const accessInfo = React.useMemo(() => {
    if (!profile) {
      return { canCopy: false, requiresUpgrade: false, reason: 'login' };
    }
    
    if (profile.role === 'admin') {
      return { canCopy: true, requiresUpgrade: false };
    }
    
    if (accessLevel === 'free') {
      return { canCopy: true, requiresUpgrade: false };
    }
    
    if (accessLevel === 'pro') {
      if (profile.role === 'pro') {
        return { canCopy: true, requiresUpgrade: false };
      } else {
        return { canCopy: false, requiresUpgrade: true, reason: 'upgrade' };
      }
    }
    
    return { canCopy: true, requiresUpgrade: false };
  }, [profile, accessLevel]);
  
  // Memoize preview URLs
  const desktopPreviewUrl = React.useMemo(() => getDesktopPreviewUrl(component), [getDesktopPreviewUrl, component]);
  const previewUrl = React.useMemo(() => getPreviewUrl(component), [getPreviewUrl, component]);

  const handlePreviewClick = useCallback(() => {
    onPreview(previewUrl, componentTitle);
  }, [onPreview, previewUrl, componentTitle]);

  const handleCopyClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!profile) {
      navigate('/auth');
      return;
    }
    
    if (accessInfo.requiresUpgrade) {
      toast({
        title: "🔒 Componente PRO",
        description: "Este componente está disponível apenas para usuários PRO. Faça upgrade para acessar!",
        variant: "default",
        duration: 5000
      });
      return;
    }
    
    if (accessInfo.canCopy) {
      await copyToClipboard(component, baseUrl);
    }
  }, [copyToClipboard, component, baseUrl, accessInfo, navigate, profile]);

  const handleShareClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await shareComponent(component, connectionId || '');
  }, [shareComponent, component, connectionId]);

  const copyState = getCopyState(component.originalId || component.id);
  const { copying, copied } = copyState;

  const getCopyButtonContent = useCallback(() => {
    if (!profile) {
      return {
        icon: <Lock className="h-3 w-3 opacity-60" />,
        text: 'LOGIN',
        className: 'bg-muted border-muted-foreground/20 text-muted-foreground hover:bg-muted/80 cursor-pointer'
      };
    }

    if (accessInfo.requiresUpgrade) {
      return {
        icon: <Lock className="h-3 w-3" />,
        text: 'PRO',
        className: 'bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-100 cursor-pointer'
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
  }, [copying, copied, profile, accessInfo]);

  const buttonContent = getCopyButtonContent();

  return (
    <div className="rounded-lg text-card-foreground shadow-sm group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card border border-border relative h-full flex flex-col">
      
      {/* Access Level Badge */}
      {accessLevel && accessLevel !== 'free' && (
        <div className="absolute top-2 right-2 z-10">
          <ComponentAccessBadge 
            accessLevel={accessLevel} 
            userRole={profile?.role}
            size="sm"
          />
        </div>
      )}

      {/* Preview Container */}
      <div className="aspect-[4/3] bg-gray-50 cursor-pointer relative overflow-hidden flex-shrink-0" onClick={handlePreviewClick}>
        <div className="w-full h-full relative bg-white overflow-hidden">
          <OptimizedDynamicIframe 
            url={desktopPreviewUrl} 
            title={`Preview of ${componentTitle}`} 
          />
        </div>
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
          
          <div className="flex gap-1.5 flex-shrink-0">
            <AddToCartButton 
              component={component} 
              baseUrl={baseUrl}
              connectionId={connectionId}
              postType={postType}
            />
            
            <button
              onClick={handleShareClick}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-all duration-200 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 hover:border-blue-300 flex-shrink-0"
              title="Compartilhar componente"
            >
              <Share2 className="h-3 w-3" />
              <span className="font-medium hidden sm:inline">COMPARTILHAR</span>
            </button>
            
            <button 
              onClick={handleCopyClick} 
              disabled={profile && copying}
              className={`
                flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded 
                transition-all duration-200 disabled:cursor-not-allowed flex-shrink-0
                ${buttonContent.className}
              `} 
              title={!profile ? "Clique para fazer login e copiar componente" : (copying ? "Copiando..." : (copied ? "Copiado!" : "Copiar componente"))}
            >
              {buttonContent.icon}
              <span className="font-medium">
                {buttonContent.text}
              </span>
            </button>
          </div>
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
