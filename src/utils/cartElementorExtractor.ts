import { extractComponentForClipboard } from './directElementorExtractor';
import { CartItem } from '@/store/cartStore';

interface ElementorElement {
  id: string;
  elType: string;
  settings: Record<string, any>;
  elements: ElementorElement[];
  widgetType?: string;
}

interface WordPressConfig {
  baseUrl: string;
  postType: string;
  username?: string;
  password?: string;
  token?: string;
}

const getWordPressConfig = (item: CartItem): WordPressConfig => {
  return {
    baseUrl: item.baseUrl,
    postType: item.postType || 'posts',
  };
};

export const extractMultipleComponents = async (
  items: CartItem[]
): Promise<{ elements: ElementorElement[]; failedItems: string[] }> => {
  const allElements: ElementorElement[] = [];
  const failedItems: string[] = [];

  for (const item of items) {
    try {
      const componentId = item.component.originalId || item.component.id;
      const config = getWordPressConfig(item);
      
      const result = await extractComponentForClipboard(
        componentId,
        config
      );
      
      if (result) {
        const parsed = JSON.parse(result);
        if (parsed.content && Array.isArray(parsed.content)) {
          allElements.push(...parsed.content);
        }
      }
    } catch (error) {
      console.error(`Failed to extract component ${item.id}:`, error);
      const title = typeof item.component.title === 'string' 
        ? item.component.title 
        : item.component.title?.rendered || 'Untitled';
      failedItems.push(title);
    }
  }

  return { elements: allElements, failedItems };
};

export const formatMultipleForClipboard = (
  elements: ElementorElement[],
  baseUrl: string
): string => {
  return JSON.stringify({
    content: elements,
    page_settings: [],
    version: "0.4",
    title: "Multiple Components from Cart",
    type: "page",
  });
};
