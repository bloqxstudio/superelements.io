
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
      // 1. Buscar componentes do post type (apenas primeiro lote para extrair categorias)
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      let apiUrl = `${baseUrl}/wp-json/wp/v2/${config.postType}?per_page=100&_fields=id,categories`;
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (config.username && config.applicationPassword) {
        const credentials = btoa(`${config.username}:${config.applicationPassword}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch components: ${response.status}`);
      }

      const components = await response.json();
      
      if (!Array.isArray(components)) {
        throw new Error('Invalid response format');
      }

      console.log(`Found ${components.length} components to analyze categories`);

      // 2. Extrair categorias dos componentes
      const categoryIds = new Set<number>();
      const categoryCounts = new Map<number, number>();

      components.forEach(component => {
        if (component.categories && Array.isArray(component.categories)) {
          component.categories.forEach(categoryId => {
            categoryIds.add(categoryId);
            categoryCounts.set(categoryId, (categoryCounts.get(categoryId) || 0) + 1);
          });
        }
      });

      if (categoryIds.size === 0) {
        console.log('No categories found in components');
        return [];
      }

      // 3. Buscar informações completas das categorias que têm componentes
      const categoriesData = await WordPressApiService.fetchCategories(config);
      
      // 4. Filtrar apenas categorias que têm componentes e não são "uncategorized"
      const categoriesWithComponents = categoriesData
        .filter(cat => 
          categoryIds.has(cat.id) && 
          cat.slug !== 'uncategorized' &&
          (categoryCounts.get(cat.id) || 0) > 0
        )
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          count: categoryCounts.get(cat.id) || 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Filtered to ${categoriesWithComponents.length} categories with components:`, 
        categoriesWithComponents.map(c => `${c.name} (${c.count})`));

      return categoriesWithComponents;
      
    } catch (error) {
      console.error('Error fetching categories with components:', error);
      throw error;
    }
  }
}
