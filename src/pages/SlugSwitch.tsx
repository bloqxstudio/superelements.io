import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import Components from './Components';
import ComponentViewDirect from './ComponentViewDirect';
import { Loader2 } from 'lucide-react';

/**
 * SlugSwitch: Roteador inteligente para URLs de 2 segmentos
 * Decide se o segundo slug é uma categoria (renderiza Components) ou um componente (renderiza ComponentViewDirect)
 */
const SlugSwitch = () => {
  const { connectionSlug, secondSlug } = useParams<{ connectionSlug: string; secondSlug: string }>();
  const { connections } = useConnectionsStore();
  const { getConnectionBySlug } = useSlugResolver();
  const { connectionsData } = useMultiConnectionData();
  const [isCategory, setIsCategory] = useState<boolean | null>(null);

  useEffect(() => {
    const determineSlugType = () => {
      // Aguardar conexões carregarem
      if (connections.length === 0) return;
      
      // Resolver conexão
      const connection = getConnectionBySlug(connectionSlug);
      if (!connection) {
        setIsCategory(false);
        return;
      }

      // Buscar categorias da conexão
      const connectionData = connectionsData.find(cd => cd.connectionId === connection.id);
      
      // Se connectionData não existe ou está carregando, aguardar
      if (!connectionData || connectionData.isLoading) return;
      
      // Verificar se secondSlug é uma categoria válida
      const isCategorySlug = connectionData.categories.some(cat => cat.slug === secondSlug);
      
      setIsCategory(isCategorySlug);
    };

    determineSlugType();
  }, [connectionSlug, secondSlug, connections, connectionsData, getConnectionBySlug]);

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
