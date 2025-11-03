import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import Components from './Components';
import ComponentViewDirect from './ComponentViewDirect';
import { Loader2 } from 'lucide-react';

/**
 * SlugSwitch: Roteador inteligente para URLs de 2 segmentos
 * Decide rapidamente se o segundo slug é uma categoria ou um componente
 */
const SlugSwitch = () => {
  const { connectionSlug, secondSlug } = useParams<{ connectionSlug: string; secondSlug: string }>();
  const { connections, isLoading, fetchConnections } = useConnectionsStore();
  const { components } = useWordPressStore();
  const { getConnectionBySlug } = useSlugResolver();
  const { connectionsData } = useMultiConnectionData();
  const [isCategory, setIsCategory] = useState<boolean | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    
    const determineSlugType = async () => {
      // Aguardar conexões carregarem
      if (connections.length === 0) {
        if (!isLoading) {
          fetchConnections();
        }
        return;
      }
      
      // Resolver conexão
      const connection = getConnectionBySlug(connectionSlug);
      if (!connection) {
        console.info('🔍 SlugSwitch: Conexão não encontrada, assumindo categoria');
        if (!cancelRef.current) setIsCategory(true);
        return;
      }

      console.info('🔍 SlugSwitch: Analisando slug:', secondSlug, 'para conexão:', connection.name);

      // Checagem rápida: se já temos as categorias carregadas, verificar imediatamente
      const connectionData = connectionsData.find(cd => cd.connectionId === connection.id);
      if (connectionData && !connectionData.isLoading && connectionData.categories.length > 0) {
        const isCategorySlug = connectionData.categories.some(cat => cat.slug === secondSlug);
        if (isCategorySlug) {
          console.info('✅ SlugSwitch: Detectado como CATEGORIA via connectionsData');
          if (!cancelRef.current) setIsCategory(true);
          return;
        }
      }

      // Tentar resolver como componente: buscar no cache primeiro
      const cachedComponent = components.find((c: any) => 
        c.slug === secondSlug && c.connection_id === connection.id
      );

      if (cachedComponent) {
        console.info('✅ SlugSwitch: Detectado como COMPONENTE via cache');
        if (!cancelRef.current) setIsCategory(false);
        return;
      }

      // Buscar no WordPress: tentar fetch público primeiro
      try {
        const endpoint = `${connection.base_url}/wp-json/wp/v2/${connection.post_type}?slug=${secondSlug}&_fields=id,slug`;
        
        let response = await fetch(endpoint);
        
        // Se falhar por autenticação E houver credentials, tentar com Basic Auth
        if ((response.status === 401 || response.status === 403) && connection.credentials) {
          console.info('🔒 SlugSwitch: Tentando com autenticação...');
          response = await fetch(endpoint, {
            headers: {
              'Authorization': `Basic ${btoa(
                `${connection.credentials.username}:${connection.credentials.application_password}`
              )}`
            }
          });
        }
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            console.info('✅ SlugSwitch: Detectado como COMPONENTE via WordPress');
            if (!cancelRef.current) setIsCategory(false);
            return;
          }
        }
      } catch (error) {
        console.error('❌ SlugSwitch: Erro ao verificar componente:', error);
      }

      // Timeout de segurança: se ainda não decidiu, assume que é CATEGORIA
      setTimeout(() => {
        if (!cancelRef.current && isCategory === null) {
          console.info('⏱️ SlugSwitch: Timeout - assumindo CATEGORIA por padrão');
          setIsCategory(true);
        }
      }, 1200);
    };

    determineSlugType();

    return () => {
      cancelRef.current = true;
    };
  }, [connectionSlug, secondSlug, connections, connectionsData, components, getConnectionBySlug, isLoading, fetchConnections]);

  // Loading state enquanto determina o tipo de slug
  if (isCategory === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se é categoria, renderiza a grid de componentes filtrada
  if (isCategory) {
    return <Components />;
  }

  // Se NÃO é categoria, trata como componentSlug e abre modal diretamente
  return <ComponentViewDirect connectionSlug={connectionSlug!} componentSlug={secondSlug!} />;
};

export default SlugSwitch;
