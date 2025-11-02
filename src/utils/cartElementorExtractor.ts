import { extractComponentForClipboard } from './directElementorExtractor';
import { CartItem } from '@/store/cartStore';
import { useConnectionsStore } from '@/store/connectionsStore';
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
  applicationPassword?: string;
}

const getWordPressConfig = (item: CartItem): WordPressConfig => {
  const state = useConnectionsStore.getState();
  const connection = state.getConnectionById(item.connectionId);

  const baseUrl = (connection?.base_url || item.baseUrl || '').replace(/\/$/, '');
  const postType = connection?.post_type || item.postType || 'posts';

  return {
    baseUrl,
    postType,
    username: connection?.credentials?.username,
    applicationPassword: connection?.credentials?.application_password,
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
        if (parsed && Array.isArray(parsed.elements)) {
          allElements.push(...parsed.elements);
        } else if (parsed && Array.isArray(parsed.content)) {
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
  const siteurl = (baseUrl || '').replace(/\/$/, '');
  return JSON.stringify({
    type: "elementor",
    siteurl,
    elements
  });
};
