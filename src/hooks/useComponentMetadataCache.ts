import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ComponentMetadata {
  id: number;
  slug: string;
  title: string;
  categories: number[];
  preview_url: string;
  connection_id: string;
  connection_name: string;
  link: string;
  date: string;
  modified: string;
  cached_at: number;
}

interface ComponentCacheEntry {
  components: ComponentMetadata[];
  cached_at: number;
}

interface ComponentMetadataCache {
  cache: Record<string, ComponentCacheEntry>; // key: "connectionId-categoryIds"
  ttl: number; // 24 horas
  maxCacheSize: number;
  
  getCachedComponents: (connectionId: string | undefined, categoryIds: number[]) => ComponentMetadata[] | null;
  setCachedComponents: (connectionId: string | undefined, categoryIds: number[], components: ComponentMetadata[]) => void;
  invalidateCache: (connectionId?: string) => void;
  isExpired: (cacheKey: string) => boolean;
  pruneOldCache: () => void;
  getCacheKey: (connectionId: string | undefined, categoryIds: number[]) => string;
}

export const useComponentMetadataCache = create<ComponentMetadataCache>()(
  persist(
    (set, get) => ({
      cache: {},
      ttl: 24 * 60 * 60 * 1000, // 24 horas
      maxCacheSize: 1000, // Limite de 1000 componentes
      
      getCacheKey: (connectionId: string | undefined, categoryIds: number[]) => {
        const connId = connectionId || 'all';
        const catIds = categoryIds.length > 0 ? categoryIds.sort().join(',') : 'no-categories';
        return `${connId}-${catIds}`;
      },
      
      getCachedComponents: (connectionId: string | undefined, categoryIds: number[]) => {
        const cacheKey = get().getCacheKey(connectionId, categoryIds);
        const cached = get().cache[cacheKey];
        
        if (!cached) {
          return null;
        }
        
        // Verificar se expirou
        if (get().isExpired(cacheKey)) {
          return null;
        }
        
        console.log(`✅ Retrieved ${cached.components.length} components from cache (key: ${cacheKey})`);
        return cached.components;
      },
      
      setCachedComponents: (connectionId: string | undefined, categoryIds: number[], components: ComponentMetadata[]) => {
        const cacheKey = get().getCacheKey(connectionId, categoryIds);
        const now = Date.now();
        
        // Verificar tamanho do cache e limpar se necessário
        const totalCached = Object.values(get().cache).reduce((sum, entry) => sum + entry.components.length, 0);
        if (totalCached + components.length > get().maxCacheSize) {
          console.log('⚠️ Cache limit reached, pruning old entries...');
          get().pruneOldCache();
        }
        
        const componentsWithTimestamp = components.map(comp => ({
          ...comp,
          cached_at: now
        }));
        
        set((state) => ({
          cache: {
            ...state.cache,
            [cacheKey]: {
              components: componentsWithTimestamp,
              cached_at: now
            }
          }
        }));
        
        console.log(`✅ Cached ${components.length} component metadata (key: ${cacheKey})`);
      },
      
      invalidateCache: (connectionId?: string) => {
        if (connectionId) {
          // Remover apenas entradas da conexão específica
          set((state) => {
            const newCache = { ...state.cache };
            Object.keys(newCache).forEach(key => {
              if (key.startsWith(connectionId) || key.startsWith('all-')) {
                delete newCache[key];
              }
            });
            return { cache: newCache };
          });
          console.log(`🗑️ Invalidated component cache for connection ${connectionId}`);
        } else {
          // Remover tudo
          set({ cache: {} });
          console.log('🗑️ Invalidated all component caches');
        }
      },
      
      isExpired: (cacheKey: string) => {
        const cached = get().cache[cacheKey];
        
        if (!cached) {
          return true;
        }
        
        const now = Date.now();
        const cacheAge = now - cached.cached_at;
        const expired = cacheAge > get().ttl;
        
        if (expired) {
          console.log(`⏰ Cache expired for key ${cacheKey} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        }
        
        return expired;
      },
      
      pruneOldCache: () => {
        const now = Date.now();
        const ttl = get().ttl;
        
        set((state) => {
          const newCache = { ...state.cache };
          let removedCount = 0;
          
          // Remover entradas expiradas
          Object.keys(newCache).forEach(key => {
            if (now - newCache[key].cached_at > ttl) {
              delete newCache[key];
              removedCount++;
            }
          });
          
          // Se ainda está cheio, remover 20% das entradas mais antigas
          const totalCached = Object.values(newCache).reduce((sum, entry) => sum + entry.components.length, 0);
          if (totalCached > state.maxCacheSize) {
            const sorted = Object.entries(newCache).sort((a, b) => a[1].cached_at - b[1].cached_at);
            const toRemove = Math.ceil(sorted.length * 0.2);
            
            for (let i = 0; i < toRemove; i++) {
              delete newCache[sorted[i][0]];
              removedCount++;
            }
          }
          
          console.log(`🧹 Pruned ${removedCount} cache entries`);
          return { cache: newCache };
        });
      }
    }),
    {
      name: 'component-metadata-cache',
      version: 1,
    }
  )
);
