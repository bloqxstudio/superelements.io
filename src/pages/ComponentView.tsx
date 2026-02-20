import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWordPressStore } from '@/store/wordpressStore';
import PreviewModal from '@/components/PreviewModal';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ComponentView = () => {
  const { componentId } = useParams();
  const navigate = useNavigate();
  const { components } = useWordPressStore();

  const [isLoading, setIsLoading] = useState(true);
  const [component, setComponent] = useState<any>(null);

  useEffect(() => {
    if (!componentId) {
      navigate('/');
      return;
    }

    const numericId = parseInt(componentId, 10);
    const found = components.find((c: any) => c.id === numericId);

    if (found) {
      setComponent(found);
      setIsLoading(false);
    } else {
      toast({
        title: "Componente não encontrado",
        description: "Este componente não está disponível.",
        variant: "destructive"
      });
      navigate('/');
    }
  }, [componentId, components, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando componente...</p>
        </div>
      </div>
    );
  }

  if (!component) return null;

  return (
    <PreviewModal
      isOpen={true}
      onClose={() => navigate('/')}
      previewUrl={component.link}
      title={component.title?.rendered || 'Componente'}
      component={component}
    />
  );
};

export default ComponentView;
