import React, { useEffect, useMemo, useRef, useState } from 'react';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

export const VIEWPORT_WIDTH: Record<PreviewViewport, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

// Roda dentro do iframe e avisa a página qual a altura do conteúdo. Mede o
// body: o scrollHeight do documento nunca fica menor que o próprio iframe, e
// uma seção mais baixa que a altura inicial ficaria com espaço em branco.
const HEIGHT_SCRIPT = `<script>(function(){function post(){parent.postMessage({type:'se-preview-height',height:document.body.scrollHeight},'*')}new ResizeObserver(post).observe(document.body);addEventListener('load',post);post()})()</script>`;

// Cabe uma landing page inteira; só segura algum conteúdo que cresça junto com o iframe.
const MAX_HEIGHT = 30000;

// Altura de tela usada para `vh`: o iframe cresce com o conteúdo, então o
// motor escreve vh como var(--se-vh) e o preview fixa o valor por device.
export const SCREEN_HEIGHT: Record<PreviewViewport | 'fluid', number> = {
  desktop: 900,
  tablet: 1024,
  mobile: 812,
  fluid: 900,
};

interface PreviewFrameProps {
  html: string;
  /** Device simulado; "fluid" usa a largura do container, sem escala nem moldura. */
  viewport: PreviewViewport | 'fluid';
  /** Legenda com a largura e a escala abaixo do preview. */
  showSize?: boolean;
}

/**
 * Mostra o documento gerado pelo motor num iframe isolado (sandbox sem
 * allow-same-origin), na largura real do device e escalado para caber.
 */
export const PreviewFrame: React.FC<PreviewFrameProps> = ({ html, viewport, showSize = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.type !== 'se-preview-height') return;
      // Algo que ainda cresça junto com o iframe (ex.: height em %) para no teto.
      setHeight(Math.min(MAX_HEIGHT, Math.max(80, Math.ceil(event.data.height))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const srcDoc = useMemo(
    () =>
      html
        .replace('</head>', `<style>:root{--se-vh:${SCREEN_HEIGHT[viewport] / 100}px}</style></head>`)
        .replace('</body>', `${HEIGHT_SCRIPT}</body>`),
    [html, viewport],
  );
  const fluid = viewport === 'fluid';
  const width = fluid ? containerWidth : VIEWPORT_WIDTH[viewport];
  const scale = !fluid && containerWidth ? Math.min(1, containerWidth / width) : 1;

  return (
    <div ref={containerRef} className="w-full">
      <div
        className={fluid ? 'overflow-hidden bg-white' : 'mx-auto overflow-hidden rounded-md border bg-white shadow-sm'}
        style={{ width: width * scale, height: height * scale }}
      >
        <iframe
          ref={iframeRef}
          title="Preview do componente"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{ width, height, border: 0, display: 'block', transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
      {!fluid && showSize && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {width}px · {Math.round(scale * 100)}%
        </p>
      )}
    </div>
  );
};
