
import { WordPressApiService } from '@/services/wordpressApi';

interface CategoryWithComponents {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  jsonField: string;
  previewField: string;
  username: string;
  applicationPassword: string;
}

export class PostTypeCategoryService {
  /**
   * Busca apenas categorias que têm componentes no post type específico
   */
  static async fetchCategoriesWithComponents(config: WordPressConfig): Promise<CategoryWithComponents[]> {
    console.log(`Fetching categories with components for post type: ${config.postType}`);
    
    try {
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (config.username && config.applicationPassword) {
        const credentials = btoa(`${config.username}:${config.applicationPassword}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      // 1. Buscar todas as categorias do WordPress primeiro
      console.log('Fetching all categories from WordPress...');
      const allCategories = await WordPressApiService.fetchCategories(config);
      
      if (allCategories.length === 0) {
        console.log('No categories found in WordPress');
        return [];
      }

      console.log(`Found ${allCategories.length} total categories in WordPress`);

      // 2. Verificar quais categorias têm componentes neste post type
      const categoriesWithComponents: CategoryWithComponents[] = [];
      const batchSize = 5; // Processar 5 categorias por vez

      for (let i = 0; i < allCategories.length; i += batchSize) {
        const batch = allCategories.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (category) => {
          // Pular "uncategorized"
          if (category.slug === 'uncategorized') {
            return null;
          }

          // Verificar se categoria tem componentes neste post type
          const checkUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?categories=${category.id}&per_page=1&_fields=id`;
          
          try {
            const checkResponse = await fetch(checkUrl, { method: 'GET', headers });
            
            if (checkResponse.ok) {
              const totalHeader = checkResponse.headers.get('X-WP-Total');
              const count = totalHeader ? parseInt(totalHeader, 10) : 0;
              
              if (count > 0) {
                return {
                  id: category.id,
                  name: category.name,
                  slug: category.slug,
                  count: count
                };
              }
            }
          } catch (error) {
            console.warn(`Failed to check category ${category.name}:`, error);
          }
          
          return null;
        });

        const results = await Promise.all(batchPromises);
        const validResults = results.filter((r): r is CategoryWithComponents => r !== null);
        categoriesWithComponents.push(...validResults);
        
        // Pequeno delay entre lotes para não sobrecarregar o servidor
        if (i + batchSize < allCategories.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`Found ${categoriesWithComponents.length} categories with components:`, 
        categoriesWithComponents.map(c => `${c.name} (${c.count})`));
      
      // Ordenar por nome
      categoriesWithComponents.sort((a, b) => a.name.localeCompare(b.name));
      
      return categoriesWithComponents;
      
    } catch (error) {
      console.error('Error fetching categories with components:', error);
      throw error;
    }
  }
}
