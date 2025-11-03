import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import PreviewModal from '@/components/PreviewModal';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ComponentViewDirectProps {
  connectionSlug: string;
  componentSlug: string;
}

/**
 * ComponentViewDirect: Abre componente diretamente via modal
 * Usado quando a URL é /:connectionSlug/:componentSlug (2 segmentos onde segundo não é categoria)
 */
const ComponentViewDirect: React.FC<ComponentViewDirectProps> = ({ connectionSlug, componentSlug }) => {
  const navigate = useNavigate();
  const { connections } = useConnectionsStore();
  const { components } = useWordPressStore();
  const { getConnectionBySlug, getCategorySlug } = useSlugResolver();
  
  const [isLoading, setIsLoading] = useState(true);
  const [component, setComponent] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    const loadComponent = async () => {
      // Aguardar conexões carregarem
      if (connections.length === 0) return;
      
      setIsLoading(true);
      
      // Resolver conexão
      const foundConnection = getConnectionBySlug(connectionSlug);
      
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

      // Buscar componente em cache primeiro
      let foundComponent = components.find((c: any) => 
        c.slug === componentSlug && c.connection_id === foundConnection.id
      );

      // Se não está em cache, buscar do WordPress
      if (!foundComponent && foundConnection.credentials) {
        try {
          const endpoint = `${foundConnection.base_url}/wp-json/wp/v2/${foundConnection.post_type}?slug=${componentSlug}`;
          
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
                connection_id: foundConnection.id,
                connection_name: foundConnection.name,
                connection_access_level: foundConnection.accessLevel
              };
            }
          }
        } catch (error) {
          console.error('❌ Erro ao buscar componente:', error);
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

    loadComponent();
  }, [connectionSlug, componentSlug, connections, components, getConnectionBySlug, navigate]);

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
    const catSlug = categoryId ? getCategorySlug(categoryId) : null;
    
    if (catSlug) {
      navigate(`/${connectionSlug}/${catSlug}`);
    } else {
      navigate(`/${connectionSlug}`);
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

export default ComponentViewDirect;
