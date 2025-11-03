import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PreviewModal from '@/components/PreviewModal';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import { usePriorityComponentLoader } from '@/hooks/usePriorityComponentLoader';

const ComponentView = () => {
  const { connectionId, componentId, connectionSlug, categorySlug, componentSlug } = useParams();
  const navigate = useNavigate();
  const { getConnectionSlug, getCategorySlug } = useSlugResolver();
  
  // Use priority loading hook for fast component fetch
  const {
    component,
    connection,
    isLoading,
    error
  } = usePriorityComponentLoader({
    connectionSlug,
    componentSlug,
    connectionId,
    componentId
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar componente",
        description: error,
        variant: "destructive"
      });
      navigate('/');
    }
  }, [error, navigate]);

  // Update SEO meta tags when component loads
  useEffect(() => {
    if (component && connection) {
      document.title = `${component.title?.rendered || 'Componente'} - ${connection.name}`;
      
      const metaTags = [
        { property: 'og:title', content: component.title?.rendered || 'Componente' },
        { property: 'og:description', content: `Componente de ${connection.name}` },
        { property: 'og:url', content: window.location.href },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' }
      ];
      
      metaTags.forEach(({ property, name, content }) => {
        let meta = document.querySelector(
          property ? `meta[property="${property}"]` : `meta[name="${name}"]`
        ) as HTMLMetaElement;
        
        if (!meta) {
          meta = document.createElement('meta');
          if (property) meta.setAttribute('property', property);
          if (name) meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
        
        meta.setAttribute('content', content);
      });
    }
  }, [component, connection]);

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

  const handleClose = () => {
    // Voltar para a categoria ou conexão de origem
    const categoryId = component.categories?.[0];
    const connSlug = getConnectionSlug(connection?.id);
    const catSlug = categoryId ? getCategorySlug(categoryId) : null;
    
    if (categoryId && connSlug && catSlug) {
      navigate(`/${connSlug}/${catSlug}`);
    } else if (connSlug) {
      navigate(`/${connSlug}`);
    } else if (connectionId) {
      navigate(`/connection/${connectionId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <PreviewModal
      isOpen={true}
      onClose={handleClose}
      previewUrl={component.link}
      title={component.title?.rendered || 'Componente'}
      component={component}
    />
  );
};

export default ComponentView;
