
export interface WordPressUrlInfo {
  baseUrl: string;
  postType?: string;
  isValid: boolean;
}

/**
 * Extrai informações de uma URL do WordPress admin
 */
export const extractWordPressInfo = (url: string): WordPressUrlInfo => {
  try {
    const urlObj = new URL(url.trim());
    
    // Extrai a base URL (protocolo + host)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    // Verifica se é uma URL do WordPress admin
    if (!urlObj.pathname.includes('/wp-admin/')) {
      return {
        baseUrl,
        isValid: true // URL simples ainda é válida
      };
    }
    
    // Extrai o post_type da query string
    const postType = urlObj.searchParams.get('post_type');
    
    return {
      baseUrl,
      postType: postType || undefined,
      isValid: true
    };
  } catch (error) {
    console.error('Error parsing WordPress URL:', error);
    return {
      baseUrl: '',
      isValid: false
    };
  }
};

/**
 * Valida se uma string parece ser uma URL válida
 */
export const isValidUrl = (urlString: string): boolean => {
  try {
    new URL(urlString.trim());
    return true;
  } catch {
    return false;
  }
};

/**
 * Exemplos de URLs válidas para o placeholder
 */
export const URL_EXAMPLES = [
  'https://yoursite.com/wp-admin/edit.php?post_type=elementor-library',
  'https://yoursite.com/wp-admin/edit.php?post_type=custom-post',
  'https://yoursite.com'
];
