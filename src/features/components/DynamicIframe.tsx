import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers } from 'lucide-react';

interface DynamicIframeProps {
  url: string;
  title: string;
}

const DynamicIframe: React.FC<DynamicIframeProps> = ({ url, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1.0);
  const [loaded, setLoaded] = useState(false);
  
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // Desktop viewport dimensions
    const viewportWidth = 1400;
    const viewportHeight = 1050;
    
    // Calculate scale to fit both dimensions
    const scaleX = containerWidth / viewportWidth;
    const scaleY = containerHeight / viewportHeight;
    
    // Use the smaller scale to ensure content fits completely
    const newScale = Math.min(scaleX, scaleY, 1);
    
    setScale(Math.max(0.1, newScale));
  }, []);
  
  useEffect(() => {
    calculateScale();
    const resizeObserver = new ResizeObserver(calculateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [calculateScale]);
  
  const handleIframeLoad = () => {
    setLoaded(true);

    // Force desktop viewport in iframe
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
          // Remove ALL existing viewport meta tags
          const existingViewports = doc.querySelectorAll('meta[name="viewport"]');
          existingViewports.forEach(meta => meta.remove());

          // Add desktop viewport meta tag
          const viewportMeta = doc.createElement('meta');
          viewportMeta.name = 'viewport';
          viewportMeta.content = 'width=1400, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no';
          doc.head.appendChild(viewportMeta);

          // Desktop forcing CSS
          const style = doc.createElement('style');
          style.id = 'superelements-desktop-force';
          style.textContent = `
            /* Force desktop layout and remove margins */
            html, body { 
              width: 1400px !important; 
              min-width: 1400px !important; 
              max-width: 1400px !important;
              overflow-x: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            
            /* Force Elementor containers to desktop width */
            .elementor-container, 
            .elementor-row,
            .elementor-section,
            .elementor-section-wrap,
            .elementor-widget-wrap { 
              max-width: none !important; 
              width: 1400px !important; 
              min-width: 1400px !important;
              margin: 0 !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
            
            /* Override responsive breakpoints */
            @media screen and (max-width: 2000px) { 
              html, body, 
              .elementor-container, 
              .elementor-row,
              .elementor-section { 
                width: 1400px !important; 
                min-width: 1400px !important; 
                margin: 0 !important;
              } 
            }
            
            /* Hide mobile/tablet elements */
            .elementor-hidden-desktop { display: none !important; }
            .elementor-device-mobile { display: none !important; }
            .elementor-device-tablet { display: none !important; }
            .elementor-device-desktop { display: block !important; }
            
            /* Remove any container margins/paddings */
            .elementor-section .elementor-container {
              padding-left: 0 !important;
              padding-right: 0 !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
          `;
          doc.head.appendChild(style);

          // Force Elementor frontend to desktop mode
          const win = iframe.contentWindow as any;
          if (win) {
            // Set window dimensions
            Object.defineProperty(win, 'innerWidth', {
              value: 1400,
              writable: false
            });
            Object.defineProperty(win, 'screen', {
              value: {
                width: 1400,
                height: 1050,
                availWidth: 1400,
                availHeight: 1050
              },
              writable: false
            });

            // Override Elementor responsive detection
            if (win.elementorFrontend) {
              if (win.elementorFrontend.config && win.elementorFrontend.config.responsive) {
                win.elementorFrontend.config.responsive.activeBreakpoints = {};
                win.elementorFrontend.config.responsive.breakpoints = {};
              }
              if (win.elementorFrontend.getCurrentDeviceMode) {
                win.elementorFrontend.getCurrentDeviceMode = () => 'desktop';
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('Cannot modify iframe content due to CORS restrictions');
    }
  };

  // Skeleton placeholder matching OptimizedDynamicIframe
  const LoadingSkeleton = () => (
    <div className="w-full h-full bg-gray-50 p-4 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-2 mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
  
  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0 bg-white overflow-hidden">
      {!loaded && <LoadingSkeleton />}
      
      <iframe 
        ref={iframeRef} 
        src={url} 
        className="border-0 bg-white transition-opacity duration-300 absolute origin-top-left" 
        loading="lazy" 
        title={title} 
        style={{
          width: '1400px',
          height: '1050px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          top: 0,
          left: 0
        }} 
        onLoad={handleIframeLoad} 
        sandbox="allow-scripts allow-same-origin allow-forms" 
      />
    </div>
  );
};

export default DynamicIframe;
