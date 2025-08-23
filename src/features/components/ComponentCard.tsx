
import React, { memo, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import OptimizedDynamicIframe from './OptimizedDynamicIframe';
import { ComponentAccessBadge } from '@/components/ComponentAccessBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectionsStore } from '@/store/connectionsStore';

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
  const { profile } = useAuth();
  const { getConnectionById } = useConnectionsStore();

  // Get connection info to determine access level
  const connection = component.connection_id ? getConnectionById(component.connection_id) : null;
  const shouldShowBadge = connection?.userType === 'pro';
  const isAccessible = !connection || connection.userType === 'all' || connection.userType === 'free' || 
    (connection.userType === 'pro' && profile?.role !== 'free');

  const handlePreviewClick = useCallback(() => {
    onPreview(getPreviewUrl(component), component.title.rendered);
  }, [onPreview, getPreviewUrl, component]);

  const handleCopyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) {
      navigate('/auth');
      return;
    }
    onCopy(component);
  }, [onCopy, component, profile, navigate]);

  const { copying, copied } = copyState;

  const getCopyButtonContent = () => {
    if (!profile) {
      return {
        icon: <Copy className="h-3 w-3" />,
        text: 'FAZER LOGIN',
        className: 'bg-primary border-primary text-primary-foreground hover:bg-primary/90'
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
      
      {/* Preview Container - Fluid with 4:3 aspect ratio */}
      <div className="aspect-[4/3] bg-gray-50 cursor-pointer relative overflow-hidden flex-shrink-0" onClick={handlePreviewClick}>
        {/* Access Level Badge */}
        {shouldShowBadge && (
          <div className="absolute top-2 right-2 z-10">
            <ComponentAccessBadge 
              accessLevel="pro"
              userRole={profile?.role}
              size="sm"
            />
          </div>
        )}
        
        <div className="w-full h-full relative bg-white overflow-hidden">
          <OptimizedDynamicIframe 
            url={getDesktopPreviewUrl(component)} 
            title={`Preview of ${component.title.rendered}`} 
          />
        </div>
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
            disabled={profile && (copying || copied)}
            className={`
              flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded 
              transition-all duration-200 disabled:cursor-not-allowed flex-shrink-0
              ${buttonContent.className}
            `} 
            title={!profile ? "Fazer login para copiar" : "Copiar componente"}
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
