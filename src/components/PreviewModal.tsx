
import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useViewport, ViewportProvider } from '@/hooks/useViewport';
import PreviewModalHeader from '@/components/preview/PreviewModalHeader';
import ScaledIframe from '@/components/preview/ScaledIframe';
import { useCopyComponent } from '@/components/preview/hooks/useCopyComponent';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string;
  title?: string;
  component?: any; // Adicionar o componente completo
}

// Internal component that has access to ViewportProvider
const PreviewModalContent: React.FC<{
  previewUrl: string;
  title: string;
  component?: any;
}> = ({ previewUrl, title, component }) => {
  const { viewport } = useViewport();
  const { copyComponent } = useCopyComponent();

  const openInNewTab = () => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyJson = async () => {
    // Se temos o componente completo, usar o novo sistema
    if (component) {
      await copyComponent(component);
    } else {
      // Fallback para o sistema antigo (compatibilidade)
      await copyComponent(previewUrl, title);
    }
  };

  return (
    <>
      <PreviewModalHeader
        title={title}
        previewUrl={previewUrl}
        onCopyJson={handleCopyJson}
        onOpenInNewTab={openInNewTab}
      />
      
      {/* Preview Area */}
      <div className="bg-muted/30 overflow-hidden flex-1">
        <ScaledIframe
          url={previewUrl}
          title={title}
          viewport={viewport}
        />
        
        {/* Info - Texto menor em mobile */}
        <div className="pb-4 sm:pb-6 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visualização ao vivo do WordPress • Use o seletor de viewport para testar responsividade
          </p>
        </div>
      </div>
    </>
  );
};

const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  previewUrl,
  title = "Component Preview",
  component
}) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <ViewportProvider>
          <PreviewModalContent
            previewUrl={previewUrl}
            title={title}
            component={component}
          />
        </ViewportProvider>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewModal;
