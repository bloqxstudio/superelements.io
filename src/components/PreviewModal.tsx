
import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  const { copyComponent, personalizeAndCopyComponent } = useCopyComponent();
  const [personalizedCopyOpen, setPersonalizedCopyOpen] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState('');
  const [referenceUrl, setReferenceUrl] = React.useState('');
  const [isGeneratingPersonalizedCopy, setIsGeneratingPersonalizedCopy] = React.useState(false);

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

  const handlePersonalizedCopy = async () => {
    setIsGeneratingPersonalizedCopy(true);
    try {
      if (component) {
        await personalizeAndCopyComponent(component, customPrompt, title, referenceUrl);
      } else {
        await personalizeAndCopyComponent(previewUrl, customPrompt, title, referenceUrl);
      }
    } finally {
      setIsGeneratingPersonalizedCopy(false);
    }
  };

  return (
    <>
      <PreviewModalHeader
        title={title}
        previewUrl={previewUrl}
        onCopyJson={handleCopyJson}
        onTogglePersonalizedCopy={() => setPersonalizedCopyOpen((prev) => !prev)}
        personalizedCopyOpen={personalizedCopyOpen}
        onOpenInNewTab={openInNewTab}
      />

      {personalizedCopyOpen && (
        <div className="border-b bg-background px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Descreva o conteúdo/prompt para preencher os espaços reservados do JSON deste componente.
            </p>
            <Textarea
              value={customPrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
              placeholder="Ex.: Hero para consultoria financeira, tom premium, foco em captação de leads B2B, CTA para agendar diagnóstico gratuito."
              className="min-h-[96px]"
            />
            <Input
              value={referenceUrl}
              onChange={(event) => setReferenceUrl(event.target.value)}
              placeholder="URL de referência (opcional) para criar seção com imagem/texto/cores. Ex.: https://espn.com.br/..."
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomPrompt('');
                  setReferenceUrl('');
                }}
                disabled={isGeneratingPersonalizedCopy}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={handlePersonalizedCopy}
                disabled={isGeneratingPersonalizedCopy || !customPrompt.trim()}
              >
                {isGeneratingPersonalizedCopy ? 'Gerando...' : 'Gerar e Copiar'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
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
