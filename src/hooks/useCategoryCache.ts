import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CachedCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  connection_id: string;
  cached_at: number;
}

interface CategoryCacheStore {
  categories: Record<string, CachedCategory[]>; // key: connectionId
  ttl: number; // 24 horas
  
  getCachedCategories: (connectionId: string) => CachedCategory[] | null;
  setCachedCategories: (connectionId: string, categories: CachedCategory[]) => void;
  invalidateCache: (connectionId?: string) => void;
  isExpired: (connectionId: string) => boolean;
}

export const useCategoryCache = create<CategoryCacheStore>()(
  persist(
    (set, get) => ({
      categories: {},
      ttl: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
      
      getCachedCategories: (connectionId: string) => {
        const cached = get().categories[connectionId];
        
        if (!cached || cached.length === 0) {
          return null;
        }
        
        // Verificar se expirou
        if (get().isExpired(connectionId)) {
          return null;
        }
        
        return cached;
      },
      
      setCachedCategories: (connectionId: string, categories: CachedCategory[]) => {
        const now = Date.now();
        const categoriesWithTimestamp = categories.map(cat => ({
          ...cat,
          connection_id: connectionId,
          cached_at: now
        }));
        
        set((state) => ({
          categories: {
            ...state.categories,
            [connectionId]: categoriesWithTimestamp
          }
        }));
        
        console.log(`✅ Cached ${categories.length} categories for connection ${connectionId}`);
      },
      
      invalidateCache: (connectionId?: string) => {
        if (connectionId) {
          // Remover apenas categorias da conexão específica
          set((state) => {
            const newCategories = { ...state.categories };
            delete newCategories[connectionId];
            return { categories: newCategories };
          });
          console.log(`🗑️ Invalidated category cache for connection ${connectionId}`);
        } else {
          // Remover tudo
          set({ categories: {} });
          console.log('🗑️ Invalidated all category caches');
        }
      },
      
      isExpired: (connectionId: string) => {
        const cached = get().categories[connectionId];
        
        if (!cached || cached.length === 0) {
          return true;
        }
        
        const now = Date.now();
        const cacheAge = now - (cached[0]?.cached_at || 0);
        const expired = cacheAge > get().ttl;
        
        if (expired) {
          console.log(`⏰ Cache expired for connection ${connectionId} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        }
        
        return expired;
      }
    }),
    {
      name: 'category-cache-storage',
      version: 1,
    }
  )
);
