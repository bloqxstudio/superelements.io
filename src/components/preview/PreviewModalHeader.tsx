
import React from 'react';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useViewport } from '@/hooks/useViewport';
import ViewportSwitcher from '@/components/ViewportSwitcher';
import { ExternalLink, Smartphone, Tablet, Monitor, Eye, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PreviewModalHeaderProps {
  title: string;
  previewUrl: string;
  onCopyJson: () => Promise<void>;
  onTogglePersonalizedCopy: () => void;
  personalizedCopyOpen: boolean;
  onOpenInNewTab: () => void;
}

const PreviewModalHeader: React.FC<PreviewModalHeaderProps> = ({
  title,
  previewUrl,
  onCopyJson,
  onTogglePersonalizedCopy,
  personalizedCopyOpen,
  onOpenInNewTab
}) => {
  const { user } = useAuth();
  const { viewport, getViewportWidth } = useViewport();

  const getViewportIcon = () => {
    switch (viewport) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      case 'desktop': return <Monitor className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Título */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#D2F525] rounded flex items-center justify-center flex-shrink-0">
            <Eye className="h-4 w-4 text-black" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base sm:text-lg truncate">{title}</DialogTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">Visualização ao vivo</p>
          </div>
        </div>
        
        {/* Controles - Stack em mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Viewport Info - Oculto em mobile muito pequeno */}
          <Badge variant="outline" className="hidden sm:flex items-center gap-2 justify-center">
            {getViewportIcon()}
            <span className="text-xs">{viewport}</span>
            <span className="text-muted-foreground text-xs">({getViewportWidth()}px)</span>
          </Badge>
          
          {/* Viewport Switcher - Compacto em mobile */}
          <div className="hidden sm:block">
            <ViewportSwitcher size="sm" />
          </div>
          
          {/* Botões - Stack em mobile */}
          <div className="flex flex-col sm:flex-row gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={personalizedCopyOpen ? "default" : "outline"}
                    size="sm"
                    onClick={onTogglePersonalizedCopy}
                    disabled={!user}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                    title={!user ? "Faça login para usar copy personalizada" : undefined}
                  >
                    <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">COPY IA</span>
                    <span className="sm:hidden">IA</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{!user ? 'Faça login para usar copy personalizada' : 'Abrir copy personalizada com IA'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopyJson}
                    disabled={!user}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                    title={!user ? "Faça login para copiar" : undefined}
                  >
                    <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{!user ? 'LOGIN NECESSÁRIO' : 'COPIAR'}</span>
                    <span className="sm:hidden">{!user ? 'LOGIN' : 'COPIAR'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{!user ? 'Faça login para copiar' : 'Copiar componente'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenInNewTab}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">ABRIR</span>
                    <span className="sm:hidden">ABRIR</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Abrir em nova aba</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      
      {/* Viewport Switcher para mobile */}
      <div className="sm:hidden pt-3">
        <ViewportSwitcher size="sm" />
      </div>
    </DialogHeader>
  );
};

export default PreviewModalHeader;
