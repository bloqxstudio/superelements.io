import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const { connectionId, categoryId } = useParams();
  const { connections } = useConnectionsStore();
  
  const connection = connections.find(c => c.id === connectionId);
  
  // Não mostrar breadcrumbs na página inicial
  if (!connectionId && !categoryId) {
    return null;
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4 px-4 lg:px-6">
      <Link 
        to="/" 
        className="hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Todos</span>
      </Link>
      
      {connection && (
        <>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          <Link 
            to={`/connection/${connection.id}`}
            className="hover:text-foreground transition-colors truncate"
          >
            {connection.name}
          </Link>
        </>
      )}
      
      {categoryId && (
        <>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          <span className="text-foreground font-medium truncate">
            Categoria {categoryId}
          </span>
        </>
      )}
    </nav>
  );
};
