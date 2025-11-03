import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';
import PreviewModal from '@/components/PreviewModal';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useSlugResolver } from '@/hooks/useSlugResolver';

const ComponentView = () => {
  const { connectionId, componentId, connectionSlug, categorySlug, componentSlug } = useParams();
  const navigate = useNavigate();
  const { connections } = useConnectionsStore();
  const { components } = useWordPressStore();
  const { getConnectionBySlug, getCategoryBySlug, getConnectionSlug, getCategorySlug } = useSlugResolver();
  
  const [isLoading, setIsLoading] = useState(true);
  const [component, setComponent] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    const loadComponent = async () => {
      setIsLoading(true);
      
      // Resolver slugs para IDs em paralelo com busca em cache
      let resolvedConnectionId = connectionId;
      
      if (connectionSlug && !connectionId) {
        const conn = getConnectionBySlug(connectionSlug);
        resolvedConnectionId = conn?.id;
      }

      // 1. Buscar conexão e componente em cache em paralelo
      const foundConnection = connections.find(c => c.id === resolvedConnectionId);
      let foundComponent = components.find((c: any) => 
        (componentSlug ? c.slug === componentSlug : String(c.id) === componentId) && 
        c.connection_id === resolvedConnectionId
      );
      if (!foundConnection) {
        toast({
          title: "Conexão não encontrada",
          description: "Esta conexão não existe ou foi removida.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }
      
      setConnection(foundConnection);

      // 2. Se não está em cache, buscar do WordPress
      if (!foundComponent && foundConnection.credentials) {
        try {
          const endpoint = componentSlug 
            ? `${foundConnection.base_url}/wp-json/wp/v2/${foundConnection.post_type}?slug=${componentSlug}`
            : `${foundConnection.base_url}/wp-json/wp/v2/${foundConnection.post_type}/${componentId}`;
          
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Basic ${btoa(
                `${foundConnection.credentials.username}:${foundConnection.credentials.application_password}`
              )}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const componentData = Array.isArray(data) ? data[0] : data;
            
            if (componentData) {
              foundComponent = {
                ...componentData,
                connection_id: resolvedConnectionId,
                connection_name: foundConnection.name,
                connection_access_level: foundConnection.accessLevel
              };
            }
          }
        } catch (error) {
          console.error('Erro ao buscar componente:', error);
        }
      }

      if (!foundComponent) {
        toast({
          title: "Componente não encontrado",
          description: "Este componente não existe ou foi removido.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      setComponent(foundComponent);
      setIsLoading(false);

      // SEO: Atualizar meta tags dinamicamente
      if (foundComponent && foundConnection) {
        document.title = `${foundComponent.title?.rendered || 'Componente'} - ${foundConnection.name}`;
        
        // Adicionar Open Graph meta tags
        const metaTags = [
          { property: 'og:title', content: foundComponent.title?.rendered || 'Componente' },
          { property: 'og:description', content: `Componente de ${foundConnection.name}` },
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
    };

    if ((connectionId || connectionSlug) && (componentId || componentSlug)) {
      loadComponent();
    }
  }, [connectionId, componentId, connectionSlug, componentSlug, connections, components, getConnectionBySlug, navigate]);

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
