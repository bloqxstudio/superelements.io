import React, { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore, CartItem } from '@/store/cartStore';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Button } from '@/components/ui/button';

interface FullIframeProps {
  url: string;
  title: string;
}

const FullIframe: React.FC<FullIframeProps> = ({ url, title }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    try {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) return;
      const doc = iframe.contentDocument;

      // Esconde header/footer do WordPress
      const style = doc.createElement('style');
      style.textContent = `
        .elementor-location-header, .elementor-location-footer,
        header, footer, #wpadminbar, .site-header, .site-footer,
        .header-section, .footer-section { display: none !important; }
      `;
      doc.head.appendChild(style);

      const measure = () => {
        try {
          const h = doc.body.scrollHeight || doc.documentElement.scrollHeight;
          if (h > 100) setHeight(h);
        } catch {}
      };

      // Medições progressivas para aguardar imagens, fontes e JS tardio
      measure();
      setTimeout(measure, 300);
      setTimeout(measure, 800);
      setTimeout(measure, 1500);
      setTimeout(measure, 3000);
      setTimeout(measure, 5000);

      // ResizeObserver no body do iframe — detecta qualquer mudança de tamanho
      try {
        const ro = new (iframe.contentWindow as any).ResizeObserver(measure);
        ro.observe(doc.body);
      } catch {}
    } catch {}
  }, []);

  return (
    <div style={{ width: '100%', height }}>
      {!loaded && (
        <div
          style={{ height }}
          className="w-full bg-gray-100 animate-pulse flex items-center justify-center"
        >
          <span className="text-sm text-gray-400">Carregando...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        title={title}
        onLoad={handleLoad}
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{
          display: loaded ? 'block' : 'none',
          width: '100%',
          height,
          border: 'none',
        }}
      />
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

const CartPreview: React.FC = () => {
  const navigate = useNavigate();
  const { items } = useCartStore();
  const { getConnectionById } = useConnectionsStore();

  const getPreviewUrl = (item: CartItem): string => {
    const connection = getConnectionById(item.connectionId);
    if (!connection) return '';
    const base = connection.base_url.replace(/\/$/, '');
    const previewField = connection.preview_field || 'link';
    if (previewField === 'link' && item.component?.link) {
      return item.component.link;
    }
    const id = item.component?.originalId || item.component?.id || item.id;
    return `${base}/?p=${id}&elementor-preview=${id}`;
  };

  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="bg-white">
      {sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <ShoppingCart className="h-16 w-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">Carrinho vazio</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Adicione componentes ao carrinho na biblioteca para visualizar o projeto aqui.
          </p>
          <Button onClick={() => navigate('/componentes')} className="mt-2">
            Ir para Biblioteca
          </Button>
        </div>
      ) : (
        <div className="w-full">
          {sortedItems.map((item) => {
            const url = getPreviewUrl(item);
            const title = typeof item.component?.title === 'string'
              ? item.component.title
              : item.component?.title?.rendered ?? 'Componente';
            if (!url) return null;
            return <FullIframe key={item.id} url={url} title={title} />;
          })}
        </div>
      )}
    </div>
  );
};

export default CartPreview;
