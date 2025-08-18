
import { useState, createContext, useContext, ReactNode } from 'react';

export type ViewportType = 'desktop' | 'tablet' | 'mobile';

export const VIEWPORT_BREAKPOINTS = {
  desktop: 1200,
  tablet: 1024,
  mobile: 767,
} as const;

interface ViewportContextType {
  viewport: ViewportType;
  setViewport: (viewport: ViewportType) => void;
  getViewportWidth: () => number;
}

const ViewportContext = createContext<ViewportContextType | undefined>(undefined);

export const ViewportProvider = ({ children }: { children: ReactNode }) => {
  const [viewport, setViewport] = useState<ViewportType>('desktop');

  const getViewportWidth = () => {
    return VIEWPORT_BREAKPOINTS[viewport];
  };

  return (
    <ViewportContext.Provider value={{ viewport, setViewport, getViewportWidth }}>
      {children}
    </ViewportContext.Provider>
  );
};

export const useViewport = () => {
  const context = useContext(ViewportContext);
  if (context === undefined) {
    throw new Error('useViewport must be used within a ViewportProvider');
  }
  return context;
};
