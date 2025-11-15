
import React from 'react';

interface ScaledIframeProps {
  url: string;
  title: string;
  viewport: string;
}

const ScaledIframe: React.FC<ScaledIframeProps> = ({ url, title, viewport }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [scale, setScale] = React.useState(1);

  // Calculate scale based on container size
  const calculateScale = React.useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerWidth = container.offsetWidth - 32; // Account for padding
    const containerHeight = container.offsetHeight - 32;
    
    // Real iframe dimensions
    const realDimensions = getRealIframeDimensions();
    
    // Calculate scale to fit
    const scaleX = containerWidth / realDimensions.width;
    const scaleY = containerHeight / realDimensions.height;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    setScale(Math.max(0.1, newScale));
  }, [viewport]);

  React.useEffect(() => {
    const timer = setTimeout(calculateScale, 100);
    
    const resizeObserver = new ResizeObserver(calculateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [calculateScale]);

  const handleIframeLoad = () => {
    setLoaded(true);
    
    // Apply viewport-specific styles to iframe content
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
          // Remove existing viewport meta tags
          const existingViewports = doc.querySelectorAll('meta[name="viewport"]');
          existingViewports.forEach(meta => meta.remove());
          
          // Add viewport-specific meta tag
          const viewportMeta = doc.createElement('meta');
          viewportMeta.name = 'viewport';
          
          switch (viewport) {
            case 'mobile':
              viewportMeta.content = 'width=375, initial-scale=1.0, user-scalable=no';
              break;
            case 'tablet':
              viewportMeta.content = 'width=768, initial-scale=1.0, user-scalable=no';
              break;
            case 'desktop':
            default:
              viewportMeta.content = 'width=1400, initial-scale=1.0, user-scalable=no';
              break;
          }
          
          doc.head.appendChild(viewportMeta);
          
          // Apply viewport-specific CSS with real dimensions
          const style = doc.createElement('style');
          style.textContent = `
            html, body { 
              margin: 0 !important;
              padding: 0 !important;
              overflow-x: hidden !important;
              background: white !important;
            }
            
            ${viewport === 'mobile' ? `
              html, body {
                width: 375px !important;
                max-width: 375px !important;
                min-width: 375px !important;
              }
              .elementor-container,
              .elementor-row,
              .elementor-section {
                max-width: 375px !important;
                width: 375px !important;
                min-width: 375px !important;
              }
              .elementor-hidden-mobile { display: none !important; }
              .elementor-device-desktop,
              .elementor-device-tablet { display: none !important; }
              .elementor-device-mobile { display: block !important; }
            ` : viewport === 'tablet' ? `
              html, body {
                width: 768px !important;
                max-width: 768px !important;
                min-width: 768px !important;
              }
              .elementor-container,
              .elementor-row,
              .elementor-section {
                max-width: 768px !important;
                width: 768px !important;
                min-width: 768px !important;
              }
              .elementor-hidden-tablet { display: none !important; }
              .elementor-device-desktop,
              .elementor-device-mobile { display: none !important; }
              .elementor-device-tablet { display: block !important; }
            ` : `
              html, body {
                width: 1400px !important;
                max-width: 1400px !important;
                min-width: 1400px !important;
              }
              .elementor-container,
              .elementor-row,
              .elementor-section {
                max-width: 1400px !important;
                width: 1400px !important;
                min-width: 1400px !important;
              }
              .elementor-hidden-desktop { display: none !important; }
              .elementor-device-mobile,
              .elementor-device-tablet { display: none !important; }
              .elementor-device-desktop { display: block !important; }
            `}
          `;
          doc.head.appendChild(style);
          
          // Force window dimensions for Elementor detection
          const win = iframe.contentWindow as any;
          if (win) {
            const targetWidth = viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : 1400;
            Object.defineProperty(win, 'innerWidth', {
              value: targetWidth,
              writable: false
            });
            Object.defineProperty(win, 'outerWidth', {
              value: targetWidth, 
              writable: false
            });
          }
        }
      }
    } catch (error) {
      console.log('Cannot modify iframe content due to CORS restrictions');
    }
  };

  // Real iframe dimensions (what the content expects)
  const getRealIframeDimensions = () => {
    switch (viewport) {
      case 'mobile':
        return { width: 375, height: 600 };
      case 'tablet':
        return { width: 768, height: 600 };
      case 'desktop':
      default:
        return { width: 1400, height: 800 };
    }
  };

  const realDimensions = getRealIframeDimensions();

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center items-center p-4 overflow-hidden">
      <div 
        className="relative bg-white rounded shadow-lg"
        style={{
          width: `${realDimensions.width * scale}px`,
          height: `${realDimensions.height * scale}px`,
          transformOrigin: 'center'
        }}
      >
        <iframe
          ref={iframeRef}
          src={url}
          className="border-0 bg-white absolute top-0 left-0"
          title={title}
          style={{
            width: `${realDimensions.width}px`,
            height: `${realDimensions.height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
          onLoad={handleIframeLoad}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        {!loaded && (
          <div className="absolute inset-0 bg-gray-100 rounded flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScaledIframe;
