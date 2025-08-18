
interface ElementorElement {
  id: string;
  elType: string;
  widgetType?: string;
  settings: Record<string, any>;
  elements: ElementorElement[];
  isInner?: boolean;
}

interface ExtractedStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: string;
  padding?: string;
  margin?: string;
}

/**
 * Gera um ID único para elementos Elementor
 */
const generateElementId = (): string => {
  return Math.random().toString(36).substr(2, 7);
};

/**
 * Extrai estilos CSS de um elemento HTML
 */
const extractStyles = (element: Element): ExtractedStyle => {
  const computedStyle = window.getComputedStyle ? window.getComputedStyle(element) : null;
  const styles: ExtractedStyle = {};
  
  if (computedStyle) {
    if (computedStyle.color && computedStyle.color !== 'rgb(0, 0, 0)') {
      styles.color = computedStyle.color;
    }
    if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      styles.backgroundColor = computedStyle.backgroundColor;
    }
    if (computedStyle.fontSize) {
      styles.fontSize = computedStyle.fontSize;
    }
    if (computedStyle.fontWeight && computedStyle.fontWeight !== '400') {
      styles.fontWeight = computedStyle.fontWeight;
    }
    if (computedStyle.fontFamily) {
      styles.fontFamily = computedStyle.fontFamily;
    }
    if (computedStyle.textAlign && computedStyle.textAlign !== 'start') {
      styles.textAlign = computedStyle.textAlign;
    }
  }
  
  return styles;
};

/**
 * Converte estilos extraídos para configurações do Elementor
 */
const stylesToElementorSettings = (styles: ExtractedStyle): Record<string, any> => {
  const settings: Record<string, any> = {};
  
  if (styles.color) {
    settings.text_color = styles.color;
  }
  if (styles.backgroundColor) {
    settings.background_color = styles.backgroundColor;
  }
  if (styles.fontSize) {
    settings.typography_font_size = { size: parseInt(styles.fontSize), unit: 'px' };
  }
  if (styles.fontWeight) {
    settings.typography_font_weight = styles.fontWeight;
  }
  if (styles.fontFamily) {
    settings.typography_font_family = styles.fontFamily;
  }
  if (styles.textAlign) {
    settings.align = styles.textAlign;
  }
  
  return settings;
};

/**
 * Transforma um elemento HTML em elemento Elementor
 */
const htmlElementToElementor = (element: Element): ElementorElement | null => {
  const tagName = element.tagName.toLowerCase();
  const textContent = element.textContent?.trim() || '';
  const styles = extractStyles(element);
  const baseSettings = stylesToElementorSettings(styles);
  
  let elementorElement: ElementorElement;
  
  switch (tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      elementorElement = {
        id: generateElementId(),
        elType: 'widget',
        widgetType: 'heading',
        settings: {
          title: textContent,
          size: tagName,
          ...baseSettings
        },
        elements: []
      };
      break;
      
    case 'p':
      elementorElement = {
        id: generateElementId(),
        elType: 'widget',
        widgetType: 'text-editor',
        settings: {
          editor: textContent,
          ...baseSettings
        },
        elements: []
      };
      break;
      
    case 'a':
    case 'button':
      const href = element.getAttribute('href') || '#';
      elementorElement = {
        id: generateElementId(),
        elType: 'widget',
        widgetType: 'button',
        settings: {
          text: textContent,
          link: { url: href },
          ...baseSettings
        },
        elements: []
      };
      break;
      
    case 'img':
      const src = element.getAttribute('src') || '';
      const alt = element.getAttribute('alt') || '';
      elementorElement = {
        id: generateElementId(),
        elType: 'widget',
        widgetType: 'image',
        settings: {
          image: { url: src },
          image_alt: alt,
          ...baseSettings
        },
        elements: []
      };
      break;
      
    case 'div':
    case 'section':
      // Criar container para elementos estruturais
      const childElements: ElementorElement[] = [];
      
      // Processar elementos filhos
      Array.from(element.children).forEach(child => {
        const childElementor = htmlElementToElementor(child);
        if (childElementor) {
          childElements.push(childElementor);
        }
      });
      
      // Se não há filhos mas há texto, criar um widget de texto
      if (childElements.length === 0 && textContent) {
        childElements.push({
          id: generateElementId(),
          elType: 'widget',
          widgetType: 'text-editor',
          settings: {
            editor: textContent,
            ...baseSettings
          },
          elements: []
        });
      }
      
      elementorElement = {
        id: generateElementId(),
        elType: 'container',
        settings: {
          content_width: 'boxed',
          flex_direction: 'column',
          ...baseSettings
        },
        elements: childElements
      };
      break;
      
    default:
      // Para outros elementos, criar um widget de texto se houver conteúdo
      if (textContent) {
        elementorElement = {
          id: generateElementId(),
          elType: 'widget',
          widgetType: 'text-editor',
          settings: {
            editor: textContent,
            ...baseSettings
          },
          elements: []
        };
      } else {
        return null;
      }
  }
  
  return elementorElement;
};

/**
 * Transforma HTML em estrutura Elementor
 */
export const htmlToElementor = (htmlContent: string): ElementorElement[] => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return [];
  }
  
  try {
    // Criar um documento temporário para parsear o HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const body = doc.body;
    
    const elements: ElementorElement[] = [];
    
    // Processar todos os elementos filhos do body
    Array.from(body.children).forEach(element => {
      const elementorElement = htmlElementToElementor(element);
      if (elementorElement) {
        elements.push(elementorElement);
      }
    });
    
    // Se não encontrou elementos estruturados, tentar processar o texto diretamente
    if (elements.length === 0) {
      const textContent = body.textContent?.trim();
      if (textContent) {
        elements.push({
          id: generateElementId(),
          elType: 'widget',
          widgetType: 'text-editor',
          settings: {
            editor: textContent
          },
          elements: []
        });
      }
    }
    
    return elements;
  } catch (error) {
    console.error('Erro ao converter HTML para Elementor:', error);
    
    // Fallback: criar um elemento de texto simples
    return [{
      id: generateElementId(),
      elType: 'widget',
      widgetType: 'text-editor',
      settings: {
        editor: htmlContent.replace(/<[^>]*>/g, '') // Remove tags HTML
      },
      elements: []
    }];
  }
};

/**
 * Cria um container raiz para elementos Elementor
 */
export const wrapInContainer = (elements: ElementorElement[]): ElementorElement => {
  return {
    id: generateElementId(),
    elType: 'container',
    settings: {
      content_width: 'boxed',
      flex_direction: 'column',
      gap: { size: 20, unit: 'px' },
      padding: { top: 20, right: 20, bottom: 20, left: 20, unit: 'px' }
    },
    elements: elements
  };
};
