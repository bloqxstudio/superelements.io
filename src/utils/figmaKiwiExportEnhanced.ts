
import { debugFigmaComponent, debugClipboardData } from './figmaDebugger';
import { extractElementorDataEnhanced } from './elementorDataExtractor';

interface FigmaMetadata {
  fileKey: string;
  pasteID: string;
  dataType: string;
  version: string;
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

const generateFigmaId = (): string => {
  return Math.random().toString(36).substr(2, 10);
};

const hexToFigmaColor = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
  if (!result) return { r: 0, g: 0, b: 0 };
  
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  };
};

const convertElementorToFigmaNode = (element: any, yOffset: number = 0): FigmaNode => {
  const settings = element.settings || {};
  const node: FigmaNode = {
    id: generateFigmaId(),
    type: element.elType === 'widget' && (element.widgetType === 'text' || element.widgetType === 'heading') ? 'TEXT' : 'FRAME',
    name: element.widgetType ? `${element.widgetType}` : `${element.elType}`,
    absoluteBoundingBox: {
      x: 0,
      y: yOffset,
      width: 320,
      height: element.elType === 'widget' && (element.widgetType === 'text' || element.widgetType === 'heading') ? 50 : 120
    },
    constraints: {
      horizontal: "LEFT_RIGHT",
      vertical: "TOP"
    }
  };

  if (node.type === 'TEXT') {
    node.characters = settings.title || settings.text || 'Text Element';
    node.style = {
      fontFamily: "Inter",
      fontSize: parseInt(settings.title_size) || (element.widgetType === 'heading' ? 24 : 16),
      fontWeight: element.widgetType === 'heading' ? 700 : 400,
      textAlignHorizontal: settings.align || "LEFT",
      textAlignVertical: "CENTER"
    };
    
    if (settings.title_color || settings.color) {
      node.fills = [{
        type: "SOLID",
        color: hexToFigmaColor(settings.title_color || settings.color),
        opacity: 1
      }];
    } else {
      node.fills = [{
        type: "SOLID",
        color: element.widgetType === 'heading' ? { r: 0.12, g: 0.16, b: 0.22 } : { r: 0.42, g: 0.45, b: 0.50 },
        opacity: 1
      }];
    }
  } else {
    // Frame configuration
    node.layoutMode = "VERTICAL";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "FIXED";
    node.itemSpacing = 16;
    node.paddingLeft = parseInt(settings.padding?.left) || 24;
    node.paddingRight = parseInt(settings.padding?.right) || 24;
    node.paddingTop = parseInt(settings.padding?.top) || 24;
    node.paddingBottom = parseInt(settings.padding?.bottom) || 24;
    
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
    
    if (settings.border_radius) {
      node.cornerRadius = parseInt(settings.border_radius) || 0;
    }
  }

  // Process children
  if (element.elements && Array.isArray(element.elements)) {
    node.children = element.elements.map((child: any, index: number) => 
      convertElementorToFigmaNode(child, index * 70)
    );
    
    if (node.children.length > 0) {
      const totalChildrenHeight = node.children.reduce((sum, child) => {
        return sum + child.absoluteBoundingBox.height;
      }, 0);
      const spacing = (node.children.length - 1) * (node.itemSpacing || 16);
      const padding = (node.paddingTop || 24) + (node.paddingBottom || 24);
      node.absoluteBoundingBox.height = totalChildrenHeight + spacing + padding;
    }
  }

  return node;
};

const createFigmaClipboardHTML = (nodes: FigmaNode[], componentTitle: string): string => {
  // Create proper Figma metadata
  const metadata: FigmaMetadata = {
    fileKey: generateFigmaId() + generateFigmaId(),
    pasteID: generateFigmaId() + generateFigmaId(),
    dataType: "scene",
    version: "1.0"
  };
  
  // Create the Figma scene structure
  const figmaScene = {
    version: "5.4",
    timestamp: Date.now(),
    document: {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [{
        id: "0:1",
        name: "Page 1",
        type: "CANVAS",
        children: nodes
      }]
    }
  };
  
  // Create binary-like buffer (simplified approach)
  const sceneString = JSON.stringify(figmaScene);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(sceneString);
  
  // Encode to base64
  const base64Meta = btoa(JSON.stringify(metadata));
  const base64Buffer = btoa(String.fromCharCode(...buffer));
  
  // Create HTML following the exact pattern used by Flowbase and other tools
  const html = `<div>
  <span data-metadata="<!--(figmeta)${base64Meta}(figmeta)-->"></span>
  <span data-buffer="<!--(figma)${base64Buffer}(figma)-->"></span>
  <p>${componentTitle}</p>
</div>`;
  
  // Debug the generated content
  debugClipboardData(html, metadata, buffer.length);
  
  return html;
};

export const copyComponentToFigmaKiwiEnhanced = async (component: any): Promise<void> => {
  try {
    console.log('🚀 Starting enhanced Figma copy process...');
    
    // Debug the component first
    debugFigmaComponent(component);
    
    // Extract Elementor data with enhanced detection
    const elementorResult = extractElementorDataEnhanced(component);
    
    if (!elementorResult.isValid) {
      throw new Error('No valid component data found for Figma conversion');
    }
    
    console.log(`📊 Using ${elementorResult.hasRealElementorData ? 'real' : 'fallback'} Elementor data from: ${elementorResult.source}`);
    
    // Convert to Figma nodes
    const figmaNodes = elementorResult.data.map((element, index) => 
      convertElementorToFigmaNode(element, index * 140)
    );
    
    // Create main frame
    const mainFrame: FigmaNode = {
      id: generateFigmaId(),
      type: "FRAME",
      name: component.title?.rendered || "WordPress Component",
      children: figmaNodes,
      absoluteBoundingBox: {
        x: 0,
        y: 0,
        width: 375,
        height: Math.max(200, figmaNodes.length * 140 + 48)
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
      cornerRadius: 12
    };
    
    // Create clipboard HTML
    const htmlContent = createFigmaClipboardHTML([mainFrame], component.title?.rendered || "WordPress Component");
    const fallbackText = `Component: ${component.title?.rendered || 'WordPress Component'} (${elementorResult.hasRealElementorData ? 'Elementor' : 'Generic'})`;
    
    // Copy to clipboard with multiple formats
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([fallbackText], { type: "text/plain" });
      
      const clipboardItem = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob
      });
      
      await navigator.clipboard.write([clipboardItem]);
      console.log('✅ Successfully copied to clipboard with HTML + text formats');
    } else {
      await navigator.clipboard.writeText(fallbackText);
      console.log('⚠️ Fallback: copied as plain text only');
    }
    
    console.log('🎉 Figma copy completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to copy to Figma:', error);
    throw new Error('Failed to copy to Figma: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const canConvertToFigmaKiwiEnhanced = (component: any): boolean => {
  if (!component) return false;
  
  const elementorResult = extractElementorDataEnhanced(component);
  return elementorResult.isValid;
};
