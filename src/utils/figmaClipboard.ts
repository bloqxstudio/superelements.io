import { validateComponent } from './componentValidation';

interface FigmaNode {
  id: string;
  type: string;
  name: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: any[];
  strokes?: any[];
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
  cornerRadius?: number;
  strokeWeight?: number;
}

interface FigmaClipboardData {
  version: string;
  clipboard: {
    type: "FIGMA_NODES";
    nodes: FigmaNode[];
  };
}

/**
 * Generates a unique Figma-compatible ID
 */
const generateFigmaId = (): string => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Converts hex color to Figma RGB format
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
 * Maps Elementor widget types to Figma node types
 */
const mapElementorToFigmaType = (elType: string, widgetType?: string): string => {
  if (elType === 'widget') {
    switch (widgetType) {
      case 'text':
      case 'heading':
        return 'TEXT';
      case 'image':
        return 'RECTANGLE';
      case 'button':
        return 'FRAME';
      case 'spacer':
        return 'RECTANGLE';
      default:
        return 'FRAME';
    }
  }
  
  // Containers and sections become frames
  return 'FRAME';
};

/**
 * Extracts basic styling from Elementor settings
 */
const extractFigmaStyles = (settings: any) => {
  const styles: any = {};
  
  // Background color
  if (settings.background_color) {
    styles.fills = [{
      type: "SOLID",
      color: hexToFigmaColor(settings.background_color),
      opacity: 1
    }];
  } else {
    // Default white background for frames
    styles.fills = [{
      type: "SOLID",
      color: { r: 1, g: 1, b: 1 },
      opacity: 1
    }];
  }
  
  // Border
  if (settings.border_color && settings.border_width) {
    styles.strokes = [{
      type: "SOLID",
      color: hexToFigmaColor(settings.border_color),
      opacity: 1
    }];
    styles.strokeWeight = parseInt(settings.border_width) || 1;
  }
  
  // Corner radius
  if (settings.border_radius) {
    styles.cornerRadius = parseInt(settings.border_radius) || 0;
  }
  
  // Padding
  if (settings.padding) {
    const padding = settings.padding;
    if (typeof padding === 'object') {
      styles.paddingLeft = parseInt(padding.left) || 0;
      styles.paddingRight = parseInt(padding.right) || 0;
      styles.paddingTop = parseInt(padding.top) || 0;
      styles.paddingBottom = parseInt(padding.bottom) || 0;
    }
  }
  
  return styles;
};

/**
 * Converts a single Elementor element to Figma node
 */
const convertElementorElementToFigmaNode = (element: any, yOffset: number = 0): FigmaNode => {
  const figmaType = mapElementorToFigmaType(element.elType, element.widgetType);
  const styles = extractFigmaStyles(element.settings || {});
  
  const node: FigmaNode = {
    id: generateFigmaId(),
    type: figmaType,
    name: element.widgetType ? `${element.widgetType} Widget` : `${element.elType} Element`,
    absoluteBoundingBox: {
      x: 0,
      y: yOffset,
      width: 300, // Default width
      height: figmaType === 'TEXT' ? 40 : 100 // Default heights
    },
    constraints: {
      horizontal: "LEFT_RIGHT",
      vertical: "TOP"
    },
    ...styles
  };
  
  // Handle text content
  if (figmaType === 'TEXT' && element.settings) {
    if (element.settings.title || element.settings.text) {
      node.characters = element.settings.title || element.settings.text;
      node.style = {
        fontFamily: "Inter",
        fontSize: parseInt(element.settings.title_size) || 16,
        fontWeight: element.settings.title_weight === 'bold' ? 700 : 400,
        textAlignHorizontal: element.settings.align || "LEFT",
        textAlignVertical: "CENTER"
      };
      
      // Text-specific fills (color)
      if (element.settings.title_color || element.settings.color) {
        node.fills = [{
          type: "SOLID",
          color: hexToFigmaColor(element.settings.title_color || element.settings.color),
          opacity: 1
        }];
      }
    }
  }
  
  // Handle frame layout
  if (figmaType === 'FRAME') {
    node.layoutMode = "VERTICAL";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "FIXED";
    node.itemSpacing = 16;
    node.paddingLeft = node.paddingLeft || 16;
    node.paddingRight = node.paddingRight || 16;
    node.paddingTop = node.paddingTop || 16;
    node.paddingBottom = node.paddingBottom || 16;
  }
  
  // Convert children recursively
  if (element.elements && Array.isArray(element.elements)) {
    node.children = element.elements.map((child: any, index: number) => 
      convertElementorElementToFigmaNode(child, index * 120)
    );
    
    // Adjust frame height based on children
    if (node.children.length > 0 && node.absoluteBoundingBox) {
      const totalChildrenHeight = node.children.reduce((sum, child) => {
        return sum + (child.absoluteBoundingBox?.height || 100);
      }, 0);
      const spacing = (node.children.length - 1) * (node.itemSpacing || 16);
      const padding = (node.paddingTop || 16) + (node.paddingBottom || 16);
      node.absoluteBoundingBox.height = totalChildrenHeight + spacing + padding;
    }
  }
  
  return node;
};

/**
 * Extracts Elementor data from WordPress component
 */
const extractElementorDataForFigma = (component: any): any[] => {
  console.log('Extracting Elementor data for Figma conversion:', component);
  
  let elementorData = component._elementor_data || component.elementor_data;
  
  if (!elementorData && component.meta && component.meta._elementor_data) {
    elementorData = component.meta._elementor_data;
  }
  
  if (!elementorData) {
    console.log('No Elementor data found');
    return [];
  }

  // Parse if string
  if (typeof elementorData === 'string') {
    try {
      elementorData = JSON.parse(elementorData);
    } catch (error) {
      console.error('Failed to parse Elementor data:', error);
      return [];
    }
  }

  // Ensure array
  if (!Array.isArray(elementorData)) {
    elementorData = elementorData ? [elementorData] : [];
  }

  return elementorData;
};

/**
 * Main function to copy component to Figma format (JSON - fallback method)
 */
export const copyComponentToFigma = async (component: any): Promise<void> => {
  try {
    console.log('Starting JSON Figma copy for component:', component.title?.rendered);
    
    // Validate component
    const validation = validateComponent(component);
    if (!validation.isValid) {
      throw new Error(`Invalid component: ${validation.errors.join(', ')}`);
    }
    
    if (!validation.hasElementorData) {
      throw new Error('Component does not contain valid Elementor data');
    }
    
    // Extract Elementor data
    const elementorData = extractElementorDataForFigma(component);
    if (elementorData.length === 0) {
      throw new Error('No valid Elementor elements found');
    }
    
    // Convert to Figma nodes
    const figmaNodes = elementorData.map((element, index) => 
      convertElementorElementToFigmaNode(element, index * 200)
    );
    
    // Create main container frame
    const mainFrame: FigmaNode = {
      id: generateFigmaId(),
      type: "FRAME",
      name: component.title?.rendered || "Elementor Component",
      children: figmaNodes,
      absoluteBoundingBox: {
        x: 0,
        y: 0,
        width: 375,
        height: figmaNodes.length * 200 + 80
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
    
    // UPDATED: Use the exact format that Figma expects
    const figmaClipboard = {
      "version": "1.0",
      "clipboard": {
        "type": "FIGMA_NODES", 
        "nodes": [mainFrame]
      }
    };
    
    // Try multiple clipboard formats for better compatibility
    const jsonString = JSON.stringify(figmaClipboard);
    
    if (navigator.clipboard && window.ClipboardItem) {
      // Modern clipboard API with multiple formats
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([jsonString], { type: 'text/plain' }),
        'application/json': new Blob([jsonString], { type: 'application/json' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
    } else {
      // Fallback
      await navigator.clipboard.writeText(jsonString);
    }
    
    console.log('Successfully copied to Figma JSON format:', figmaClipboard);
    console.log('Total nodes converted:', figmaNodes.length);
    
  } catch (error) {
    console.error('Failed to copy component to Figma:', error);
    throw new Error('Failed to copy to Figma: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

/**
 * Validates if component can be converted to Figma
 */
export const canConvertToFigma = (component: any): boolean => {
  if (!component) return false;
  
  const validation = validateComponent(component);
  return validation.isValid && validation.hasElementorData;
};
