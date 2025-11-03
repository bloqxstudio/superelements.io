import { useCallback } from 'react';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';

export const useSlugResolver = () => {
  const { connections } = useConnectionsStore();
  const { availableCategories } = useWordPressStore();

  // Resolver conexão por slug
  const getConnectionBySlug = useCallback((slug: string | undefined) => {
    if (!slug) return null;
    return connections.find(c => c.slug === slug) || null;
  }, [connections]);

  // Resolver categoria por slug
  const getCategoryBySlug = useCallback((slug: string | undefined, connectionId?: string) => {
    if (!slug) return null;
    return availableCategories.find(cat => cat.slug === slug) || null;
  }, [availableCategories]);

  // Obter slug de conexão
  const getConnectionSlug = useCallback((connectionId: string | null | undefined) => {
    if (!connectionId) return null;
    const conn = connections.find(c => c.id === connectionId);
    return conn?.slug || null;
  }, [connections]);

  // Obter slug de categoria
  const getCategorySlug = useCallback((categoryId: number | null | undefined) => {
    if (!categoryId) return null;
    const cat = availableCategories.find(c => c.id === categoryId);
    return cat?.slug || null;
  }, [availableCategories]);

  return {
    getConnectionBySlug,
    getCategoryBySlug,
    getConnectionSlug,
    getCategorySlug
  };
};
