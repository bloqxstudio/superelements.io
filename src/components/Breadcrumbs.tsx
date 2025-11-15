import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const { connectionId, categoryId, connectionSlug, categorySlug, componentSlug } = useParams();
  const { connections } = useConnectionsStore();
  const { availableCategories, components } = useWordPressStore();
  const { getConnectionBySlug, getCategoryBySlug } = useSlugResolver();
  
  // Resolver slugs para obter dados completos
  let connection = connectionId ? connections.find(c => c.id === connectionId) : null;
  if (!connection && connectionSlug) {
    connection = getConnectionBySlug(connectionSlug);
  }
  
  let category = null;
  if (connection && categoryId) {
    category = availableCategories.find(c => c.id === parseInt(categoryId));
  } else if (connection && categorySlug) {
    category = getCategoryBySlug(categorySlug, connection.id);
  }

  // Buscar componente pelo slug
  const component = componentSlug ? components.find(c => c.slug === componentSlug) : null;
  const componentTitle = typeof component?.title === 'object' 
    ? component.title.rendered 
    : (component?.title || componentSlug || '');
  
  // Não mostrar breadcrumbs na página inicial
  if (!connectionId && !categoryId && !connectionSlug && !categorySlug && !componentSlug) {
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
            to={connection.slug ? `/${connection.slug}` : `/connection/${connection.id}`}
            className="hover:text-foreground transition-colors truncate"
          >
            {connection.name}
          </Link>
        </>
      )}
      
      {category && (
        <>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          {componentSlug ? (
            <Link 
              to={connection.slug && category.slug 
                ? `/${connection.slug}/${category.slug}` 
                : `/connection/${connection.id}/category/${category.id}`
              }
              className="hover:text-foreground transition-colors truncate"
            >
              {category.name}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate">
              {category.name}
            </span>
          )}
        </>
      )}

      {componentSlug && (
        <>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          <span className="text-foreground font-medium truncate">
            {componentTitle}
          </span>
        </>
      )}
    </nav>
  );
};
