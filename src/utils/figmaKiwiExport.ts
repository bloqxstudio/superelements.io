
import { validateComponent } from './componentValidation';

interface FigmaMetadata {
  fileKey: string;
  pasteID: string;
  dataType: string;
}

interface FigmaNode {
  id: string;
  type: string;
  name: string;
  children?: FigmaNode[];
  absoluteBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: any[];
  strokes?: any[];
  cornerRadius?: number;
  constraints?: {
    horizontal: string;
    vertical: string;
  };
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  characters?: string;
  style?: any;
}

/**
 * Gera ID único para Figma
 */
const generateFigmaId = (): string => {
  return Math.random().toString(36).substr(2, 10);
};

/**
 * Converte hex para RGB Figma
 */
const hexToFigmaColor = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  };
};

/**
 * Converte elemento Elementor para nó Figma
 */
const convertElementorToFigmaNode = (element: any, yOffset: number = 0): FigmaNode => {
  const settings = element.settings || {};
  const node: FigmaNode = {
    id: generateFigmaId(),
    type: element.elType === 'widget' && element.widgetType === 'text' ? 'TEXT' : 'FRAME',
    name: element.widgetType ? `${element.widgetType} Widget` : `${element.elType} Element`,
    absoluteBoundingBox: {
      x: 0,
      y: yOffset,
      width: 300,
      height: element.elType === 'widget' && element.widgetType === 'text' ? 40 : 100
    },
    constraints: {
      horizontal: "LEFT_RIGHT",
      vertical: "TOP"
    }
  };

  // Configurar estilo baseado no tipo
  if (node.type === 'TEXT') {
    node.characters = settings.title || settings.text || 'Text Element';
    node.style = {
      fontFamily: "Inter",
      fontSize: parseInt(settings.title_size) || 16,
      fontWeight: settings.title_weight === 'bold' ? 700 : 400,
      textAlignHorizontal: settings.align || "LEFT",
      textAlignVertical: "CENTER"
    };
    
    if (settings.title_color || settings.color) {
      node.fills = [{
        type: "SOLID",
        color: hexToFigmaColor(settings.title_color || settings.color),
        opacity: 1
      }];
    }
  } else {
    // Frame styling
    node.layoutMode = "VERTICAL";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "FIXED";
    node.itemSpacing = 16;
    node.paddingLeft = 16;
    node.paddingRight = 16;
    node.paddingTop = 16;
    node.paddingBottom = 16;
    
    // Background
    if (settings.background_color) {
      node.fills = [{
        type: "SOLID",
        color: hexToFigmaColor(settings.background_color),
        opacity: 1
      }];
    } else {
      node.fills = [{
        type: "SOLID",
        color: { r: 1, g: 1, b: 1 },
        opacity: 1
      }];
    }
    
    // Border
    if (settings.border_color && settings.border_width) {
      node.strokes = [{
        type: "SOLID",
        color: hexToFigmaColor(settings.border_color),
        opacity: 1
      }];
    }
    
    if (settings.border_radius) {
      node.cornerRadius = parseInt(settings.border_radius) || 0;
    }
  }

  // Processar filhos
  if (element.elements && Array.isArray(element.elements)) {
    node.children = element.elements.map((child: any, index: number) => 
      convertElementorToFigmaNode(child, index * 60)
    );
    
    // Ajustar altura do frame baseado nos filhos
    if (node.children.length > 0) {
      const totalChildrenHeight = node.children.reduce((sum, child) => {
        return sum + child.absoluteBoundingBox.height;
      }, 0);
      const spacing = (node.children.length - 1) * (node.itemSpacing || 16);
      const padding = (node.paddingTop || 16) + (node.paddingBottom || 16);
      node.absoluteBoundingBox.height = totalChildrenHeight + spacing + padding;
    }
  }

  return node;
};

/**
 * Gera buffer Kiwi simulado (formato binário do Figma)
 */
const generateKiwiBuffer = (nodes: FigmaNode[]): ArrayBuffer => {
  // Simulação de um buffer Kiwi - na prática, isto seria gerado pelo Figma Plugin API
  const mockKiwiData = {
    version: 1,
    nodes: nodes,
    timestamp: Date.now()
  };
  
  const jsonString = JSON.stringify(mockKiwiData);
  const encoder = new TextEncoder();
  return encoder.encode(jsonString).buffer;
};

/**
 * Gera metadados Figma
 */
const generateFigmaMetadata = (): FigmaMetadata => {
  return {
    fileKey: generateFigmaId(),
    pasteID: generateFigmaId(),
    dataType: "scene"
  };
};

/**
 * Cria HTML com dados Figma embebidos
 */
const createFigmaClipboardHTML = (
  metadata: FigmaMetadata, 
  buffer: ArrayBuffer, 
  fallbackText: string
): string => {
  const base64Meta = btoa(JSON.stringify(metadata));
  const uint8Array = new Uint8Array(buffer);
  const base64Buffer = btoa(String.fromCharCode(...uint8Array));
  
  return `
    <div>
      <span data-metadata="<!--(figmeta)${base64Meta}(figmeta)-->"></span>
      <span data-buffer="<!--(figma)${base64Buffer}(figma)-->"></span>
      <p>${fallbackText}</p>
    </div>
  `;
};

/**
 * Extrai dados Elementor do componente
 */
const extractElementorDataForKiwi = (component: any): any[] => {
  let elementorData = component._elementor_data || component.elementor_data;
  
  if (!elementorData && component.meta && component.meta._elementor_data) {
    elementorData = component.meta._elementor_data;
  }
  
  if (!elementorData) {
    return [];
  }

  if (typeof elementorData === 'string') {
    try {
      elementorData = JSON.parse(elementorData);
    } catch (error) {
      console.error('Failed to parse Elementor data:', error);
      return [];
    }
  }

  if (!Array.isArray(elementorData)) {
    elementorData = elementorData ? [elementorData] : [];
  }

  return elementorData;
};

/**
 * Função principal para copiar para Figma no formato Kiwi
 */
export const copyComponentToFigmaKiwi = async (component: any): Promise<void> => {
  try {
    console.log('Starting Kiwi Figma copy for component:', component.title?.rendered);
    
    // Validar componente
    const validation = validateComponent(component);
    if (!validation.isValid) {
      throw new Error(`Invalid component: ${validation.errors.join(', ')}`);
    }
    
    if (!validation.hasElementorData) {
      throw new Error('Component does not contain valid Elementor data');
    }
    
    // Extrair dados Elementor
    const elementorData = extractElementorDataForKiwi(component);
    if (elementorData.length === 0) {
      throw new Error('No valid Elementor elements found');
    }
    
    // Converter para nós Figma
    const figmaNodes = elementorData.map((element, index) => 
      convertElementorToFigmaNode(element, index * 120)
    );
    
    // Criar frame principal
    const mainFrame: FigmaNode = {
      id: generateFigmaId(),
      type: "FRAME",
      name: component.title?.rendered || "Elementor Component",
      children: figmaNodes,
      absoluteBoundingBox: {
        x: 0,
        y: 0,
        width: 375,
        height: figmaNodes.length * 120 + 80
      },
      constraints: {
        horizontal: "LEFT_RIGHT",
        vertical: "TOP"
      },
      layoutMode: "VERTICAL",
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "FIXED",
      itemSpacing: 24,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 24,
      paddingBottom: 24,
      fills: [{
        type: "SOLID",
        color: { r: 1, g: 1, b: 1 },
        opacity: 1
      }],
      cornerRadius: 8
    };
    
    // Gerar metadados e buffer
    const metadata = generateFigmaMetadata();
    const buffer = generateKiwiBuffer([mainFrame]);
    const fallbackText = `Component: ${component.title?.rendered || 'Elementor Component'}`;
    
    // Criar HTML com dados embebidos
    const htmlContent = createFigmaClipboardHTML(metadata, buffer, fallbackText);
    
    // Copiar para clipboard
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([fallbackText], { type: "text/plain" });
      
      const clipboardItem = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob
      });
      
      await navigator.clipboard.write([clipboardItem]);
    } else {
      // Fallback
      await navigator.clipboard.writeText(fallbackText);
    }
    
    console.log('Successfully copied to Figma Kiwi format');
    console.log('Metadata:', metadata);
    console.log('Buffer size:', buffer.byteLength);
    
  } catch (error) {
    console.error('Failed to copy component to Figma (Kiwi):', error);
    throw new Error('Failed to copy to Figma: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

/**
 * Verifica se o componente pode ser convertido
 */
export const canConvertToFigmaKiwi = (component: any): boolean => {
  if (!component) return false;
  
  const validation = validateComponent(component);
  return validation.isValid && validation.hasElementorData;
};
