import React, { memo, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useElementorDocument, type ElementorComponentSource } from './useElementorDocument';

// Largura de desktop em que a miniatura é desenhada antes de ser reduzida.
const VIRTUAL_WIDTH = 1400;

interface ElementorThumbnailProps extends ElementorComponentSource {
  component: any;
  title: string;
}

/**
 * Miniatura de um componente da biblioteca renderizada pelo motor Elementor.
 * Só busca o JSON quando o card chega perto da tela.
 */
export const ElementorThumbnail: React.FC<ElementorThumbnailProps> = memo(({ component, title, ...source }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const intersection = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          intersection.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    const resize = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    intersection.observe(el);
    resize.observe(el);
    return () => {
      intersection.disconnect();
      resize.disconnect();
    };
  }, []);

  const state = useElementorDocument(component, source, visible);

  const scale = size.width / VIRTUAL_WIDTH;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-white">
      {state.status === 'error' ? (
        <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
          Pré-visualização indisponível
        </div>
      ) : (
        !loaded && <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {state.status === 'ready' && scale > 0 && (
        <iframe
          title={title}
          srcDoc={state.document}
          sandbox="allow-scripts"
          tabIndex={-1}
          aria-hidden="true"
          onLoad={() => setLoaded(true)}
          className="absolute left-0 top-0 border-0"
          style={{
            width: VIRTUAL_WIDTH,
            height: size.height / scale,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}
    </div>
  );
});

ElementorThumbnail.displayName = 'ElementorThumbnail';
