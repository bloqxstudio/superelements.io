import { useConnectionsStore } from '@/store/connectionsStore';
import { useWordPressStore } from '@/store/wordpressStore';

export const useSlugResolver = () => {
  const { connections } = useConnectionsStore();
  const { availableCategories } = useWordPressStore();

  // Resolver conexão por slug
  const getConnectionBySlug = (slug: string | undefined) => {
    if (!slug) return null;
    return connections.find(c => c.slug === slug) || null;
  };

  // Resolver categoria por slug
  const getCategoryBySlug = (slug: string | undefined, connectionId?: string) => {
    if (!slug) return null;
    return availableCategories.find(cat => cat.slug === slug) || null;
  };

  // Obter slug de conexão
  const getConnectionSlug = (connectionId: string | null | undefined) => {
    if (!connectionId) return null;
    const conn = connections.find(c => c.id === connectionId);
    return conn?.slug || null;
  };

  // Obter slug de categoria
  const getCategorySlug = (categoryId: number | null | undefined) => {
    if (!categoryId) return null;
    const cat = availableCategories.find(c => c.id === categoryId);
    return cat?.slug || null;
  };

  return {
    getConnectionBySlug,
    getCategoryBySlug,
    getConnectionSlug,
    getCategorySlug
  };
};
