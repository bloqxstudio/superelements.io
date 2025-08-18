
interface ElementorElement {
  elType: string;
  widgetType?: string;
  settings: any;
  elements?: ElementorElement[];
}

interface SVGElement {
  tag: string;
  attributes: Record<string, string>;
  children?: SVGElement[];
  content?: string;
}

/**
 * Converte cor hex para RGB
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
};

/**
 * Extrai estilos CSS do Elementor para SVG
 */
const extractSVGStyles = (settings: any): string => {
  const styles: string[] = [];
  
  // Background color
  if (settings.background_color) {
    const rgb = hexToRgb(settings.background_color);
    styles.push(`fill:rgb(${rgb.r},${rgb.g},${rgb.b})`);
  } else {
    styles.push('fill:rgb(255,255,255)');
  }
  
  // Border
  if (settings.border_color && settings.border_width) {
    const rgb = hexToRgb(settings.border_color);
    styles.push(`stroke:rgb(${rgb.r},${rgb.g},${rgb.b})`);
    styles.push(`stroke-width:${parseInt(settings.border_width) || 1}`);
  } else {
    styles.push('stroke:none');
  }
  
  return styles.join(';');
};

/**
 * Converte elemento Elementor para SVG
 */
const convertElementorElementToSVG = (
  element: ElementorElement, 
  x: number = 0, 
  y: number = 0, 
  width: number = 300, 
  height: number = 100
): SVGElement => {
  const settings = element.settings || {};
  const style = extractSVGStyles(settings);
  
  // Determinar tipo de elemento SVG baseado no widget Elementor
  if (element.elType === 'widget') {
    switch (element.widgetType) {
      case 'text':
      case 'heading':
        return {
          tag: 'text',
          attributes: {
            x: (x + 10).toString(),
            y: (y + height / 2 + 5).toString(),
            style: `font-family:Arial,sans-serif;font-size:${parseInt(settings.title_size) || 16}px;${settings.title_color ? `fill:${settings.title_color}` : 'fill:#000000'}`,
            'dominant-baseline': 'middle'
          },
          content: settings.title || settings.text || 'Text Element'
        };
        
      case 'button':
        const buttonElements: SVGElement[] = [
          {
            tag: 'rect',
            attributes: {
              x: x.toString(),
              y: y.toString(),
              width: width.toString(),
              height: height.toString(),
              rx: (parseInt(settings.border_radius) || 5).toString(),
              style: style
            }
          }
        ];
        
        // Adicionar texto do botão
        if (settings.text) {
          buttonElements.push({
            tag: 'text',
            attributes: {
              x: (x + width / 2).toString(),
              y: (y + height / 2 + 5).toString(),
              style: `font-family:Arial,sans-serif;font-size:${parseInt(settings.title_size) || 14}px;fill:${settings.title_color || '#ffffff'};text-anchor:middle`,
              'dominant-baseline': 'middle'
            },
            content: settings.text
          });
        }
        
        return {
          tag: 'g',
          attributes: {
            'data-widget-type': 'button'
          },
          children: buttonElements
        };
        
      case 'image':
        return {
          tag: 'rect',
          attributes: {
            x: x.toString(),
            y: y.toString(),
            width: width.toString(),
            height: height.toString(),
            style: 'fill:#f0f0f0;stroke:#cccccc;stroke-width:1',
            'data-widget-type': 'image'
          }
        };
        
      default:
        return {
          tag: 'rect',
          attributes: {
            x: x.toString(),
            y: y.toString(),
            width: width.toString(),
            height: height.toString(),
            style: style,
            'data-widget-type': element.widgetType || 'unknown'
          }
        };
    }
  }
  
  // Container ou section
  const containerChildren: SVGElement[] = [];
  let currentY = y + 20; // Padding top
  
  // Adicionar elementos filhos
  if (element.elements && Array.isArray(element.elements)) {
    element.elements.forEach((child, index) => {
      const childHeight = 60; // Altura padrão para elementos filhos
      const childSVG = convertElementorElementToSVG(
        child, 
        x + 20, // Padding left
        currentY, 
        width - 40, // Largura menos padding
        childHeight
      );
      containerChildren.push(childSVG);
      currentY += childHeight + 16; // Espaçamento entre elementos
    });
  }
  
  // Container principal
  const containerRect: SVGElement = {
    tag: 'rect',
    attributes: {
      x: x.toString(),
      y: y.toString(),
      width: width.toString(),
      height: Math.max(height, currentY - y + 20).toString(),
      style: style,
      'data-element-type': element.elType
    }
  };
  
  return {
    tag: 'g',
    attributes: {
      'data-element-type': element.elType
    },
    children: [containerRect, ...containerChildren]
  };
};

/**
 * Converte SVGElement para string XML
 */
const svgElementToString = (element: SVGElement, indent: number = 0): string => {
  const indentStr = '  '.repeat(indent);
  const attributes = Object.entries(element.attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  if (element.content) {
    return `${indentStr}<${element.tag} ${attributes}>${element.content}</${element.tag}>`;
  }
  
  if (element.children && element.children.length > 0) {
    const childrenStr = element.children
      .map(child => svgElementToString(child, indent + 1))
      .join('\n');
    return `${indentStr}<${element.tag} ${attributes}>\n${childrenStr}\n${indentStr}</${element.tag}>`;
  }
  
  return `${indentStr}<${element.tag} ${attributes} />`;
};

/**
 * Gera SVG completo a partir de dados Elementor
 */
const generateSVGFromElementorData = (elementorData: ElementorElement[], componentTitle: string): string => {
  const svgWidth = 375;
  let svgHeight = 100;
  const svgElements: SVGElement[] = [];
  
  let currentY = 20;
  
  elementorData.forEach((element, index) => {
    const elementHeight = 120; // Altura base para cada elemento
    const svgElement = convertElementorElementToSVG(
      element,
      20, // x margin
      currentY,
      svgWidth - 40, // width com margins
      elementHeight
    );
    
    svgElements.push(svgElement);
    currentY += elementHeight + 24; // Espaçamento entre elementos
  });
  
  svgHeight = Math.max(200, currentY + 20);
  
  // Criar metadados para o Figma
  const metadata = `
    <metadata>
      <figma:component name="${componentTitle}" type="elementor">
        <figma:properties>
          <figma:property name="source" value="elementor"/>
          <figma:property name="elements" value="${elementorData.length}"/>
        </figma:properties>
      </figma:component>
    </metadata>`;
  
  const svgContent = svgElements.map(el => svgElementToString(el, 1)).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" 
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:figma="http://www.figma.com/figma/ns">
  ${metadata}
  <!-- Background -->
  <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="8"/>
  
  <!-- Component Title -->
  <text x="20" y="40" style="font-family:Arial,sans-serif;font-size:16px;font-weight:bold;fill:#1f2937">${componentTitle}</text>
  
  <!-- Elements -->
${svgContent}
</svg>`;
};

/**
 * Copia SVG para clipboard
 */
const copySVGToClipboard = async (svgContent: string): Promise<void> => {
  try {
    // Tentar usar a nova Clipboard API com múltiplos formatos
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const clipboardItem = new ClipboardItem({
        'image/svg+xml': blob,
        'text/plain': new Blob([svgContent], { type: 'text/plain' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
    } else {
      // Fallback para navegadores mais antigos
      await navigator.clipboard.writeText(svgContent);
    }
  } catch (error) {
    console.error('Erro ao copiar SVG:', error);
    throw error;
  }
};

/**
 * Função principal para exportar componente como SVG para Figma
 */
export const copyComponentToFigmaAsSVG = async (component: any): Promise<void> => {
  try {
    console.log('Iniciando conversão SVG para Figma:', component.title?.rendered);
    
    // Extrair dados Elementor
    let elementorData = component._elementor_data || component.elementor_data;
    
    if (!elementorData && component.meta && component.meta._elementor_data) {
      elementorData = component.meta._elementor_data;
    }
    
    if (!elementorData) {
      throw new Error('Nenhum dado Elementor encontrado');
    }
    
    // Parse se for string
    if (typeof elementorData === 'string') {
      try {
        elementorData = JSON.parse(elementorData);
      } catch (error) {
        throw new Error('Falha ao parsear dados Elementor');
      }
    }
    
    // Garantir que é um array
    if (!Array.isArray(elementorData)) {
      elementorData = elementorData ? [elementorData] : [];
    }
    
    if (elementorData.length === 0) {
      throw new Error('Nenhum elemento Elementor válido encontrado');
    }
    
    // Gerar SVG
    const svgContent = generateSVGFromElementorData(
      elementorData,
      component.title?.rendered || 'Elementor Component'
    );
    
    // Copiar para clipboard
    await copySVGToClipboard(svgContent);
    
    console.log('SVG copiado com sucesso para Figma');
    console.log('Elementos convertidos:', elementorData.length);
    
  } catch (error) {
    console.error('Falha ao copiar como SVG para Figma:', error);
    throw new Error('Falha ao copiar como SVG: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
  }
};

/**
 * Verifica se o componente pode ser convertido para SVG
 */
export const canConvertToSVG = (component: any): boolean => {
  if (!component) return false;
  
  const elementorData = component._elementor_data || 
                       component.elementor_data || 
                       (component.meta && component.meta._elementor_data);
  
  if (!elementorData) return false;
  
  try {
    let data = elementorData;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    
    return Array.isArray(data) ? data.length > 0 : !!data;
  } catch {
    return false;
  }
};
