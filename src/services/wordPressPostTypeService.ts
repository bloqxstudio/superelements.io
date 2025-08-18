
import { WordPressApiService } from './wordpressApi';

export interface PostTypeMapping {
  slug: string;
  restBase: string;
  name: string;
  description?: string;
}

export interface WordPressPostType {
  name: string;
  slug: string;
  description: string;
  hierarchical: boolean;
  rest_base: string;
  labels?: {
    name?: string;
    singular_name?: string;
  };
}

// Base config interface for WordPress connection
export interface WordPressConnectionConfig {
  baseUrl: string;
  username?: string;
  applicationPassword?: string;
}

// Authenticated config interface (when auth is provided)
export interface AuthenticatedWordPressConfig {
  baseUrl: string;
  username: string;
  applicationPassword: string;
}

export class WordPressPostTypeService {
  /**
   * Extract post type from WordPress admin URL
   */
  static extractPostTypeFromUrl(url: string): { postType: string; baseUrl: string } | null {
    try {
      const urlObj = new URL(url);
      const postTypeParam = urlObj.searchParams.get('post_type');
      
      if (postTypeParam) {
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        return { postType: postTypeParam, baseUrl };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting post type from URL:', error);
      return null;
    }
  }

  /**
   * Fetch post types and create mapping between slugs and REST bases
   */
  static async fetchPostTypeMappings(config: WordPressConnectionConfig): Promise<PostTypeMapping[]> {
    try {
      // Create the config object for the API call
      const apiConfig = config.username && config.applicationPassword 
        ? {
            baseUrl: config.baseUrl,
            username: config.username,
            applicationPassword: config.applicationPassword
          }
        : { baseUrl: config.baseUrl, username: '', applicationPassword: '' };
      
      const postTypes = await WordPressApiService.fetchPostTypes(apiConfig);
      
      return postTypes.map(postType => ({
        slug: postType.slug,
        restBase: postType.rest_base || postType.slug,
        name: postType.labels?.name || postType.name,
        description: postType.description
      }));
    } catch (error) {
      console.error('Error fetching post type mappings:', error);
      throw new Error('Failed to fetch WordPress post types');
    }
  }

  /**
   * Get the correct REST base for a given post type slug
   */
  static async getRestBaseForPostType(
    slug: string,
    config: WordPressConnectionConfig
  ): Promise<string> {
    try {
      const mappings = await this.fetchPostTypeMappings(config);
      const mapping = mappings.find(m => m.slug === slug);
      
      if (!mapping) {
        console.warn(`No mapping found for post type "${slug}", using slug as REST base`);
        return slug;
      }
      
      console.log(`Mapped post type "${slug}" to REST base "${mapping.restBase}"`);
      return mapping.restBase;
    } catch (error) {
      console.error(`Error getting REST base for post type "${slug}":`, error);
      // Fallback to using the slug as REST base
      return slug;
    }
  }

  /**
   * Validate a WordPress site URL and optionally test authentication
   */
  static async validateWordPressSite(config: WordPressConnectionConfig): Promise<{ isValid: boolean; hasAuth: boolean; error?: string }> {
    try {
      // Create the config object for the API call
      const apiConfig = config.username && config.applicationPassword 
        ? {
            baseUrl: config.baseUrl,
            username: config.username,
            applicationPassword: config.applicationPassword
          }
        : { baseUrl: config.baseUrl, username: '', applicationPassword: '' };
      
      const postTypes = await WordPressApiService.fetchPostTypes(apiConfig);
      
      return {
        isValid: true,
        hasAuth: !!(config.username && config.applicationPassword),
        error: undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's an auth error vs site error
      if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
        return {
          isValid: true,
          hasAuth: false,
          error: 'Authentication failed - check username and password'
        };
      }
      
      return {
        isValid: false,
        hasAuth: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test a connection with extracted post type information
   */
  static async testUrlBasedConnection(
    url: string,
    credentials?: {
      username: string;
      applicationPassword: string;
    }
  ): Promise<{
    success: boolean;
    postType?: string;
    restBase?: string;
    baseUrl?: string;
    error?: string;
  }> {
    try {
      // Extract post type and base URL
      const extracted = this.extractPostTypeFromUrl(url);
      if (!extracted) {
        return {
          success: false,
          error: 'Could not extract post type from URL. Please provide a valid WordPress admin URL.'
        };
      }

      const config: WordPressConnectionConfig = {
        baseUrl: extracted.baseUrl,
        username: credentials?.username,
        applicationPassword: credentials?.applicationPassword
      };

      // Validate the WordPress site
      const validation = await this.validateWordPressSite(config);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'Invalid WordPress site'
        };
      }

      // Get the correct REST base for the post type
      const restBase = await this.getRestBaseForPostType(extracted.postType, config);

      return {
        success: true,
        postType: extracted.postType,
        restBase: restBase,
        baseUrl: extracted.baseUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}
