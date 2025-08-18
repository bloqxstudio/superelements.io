
import React from 'react';
import { ViewportType, VIEWPORT_BREAKPOINTS } from '@/hooks/useViewport';
import { cn } from '@/lib/utils';

interface DeviceMockupProps {
  viewport: ViewportType;
  children: React.ReactNode;
  className?: string;
}

const DeviceMockup: React.FC<DeviceMockupProps> = ({ viewport, children, className }) => {
  const width = VIEWPORT_BREAKPOINTS[viewport];
  
  const mockupStyles = {
    desktop: {
      container: 'bg-gray-800 p-4 rounded-lg shadow-2xl',
      screen: 'bg-white rounded border-2 border-gray-600',
      header: 'h-8 bg-gray-700 rounded-t flex items-center px-3 gap-2',
      dots: 'flex gap-1'
    },
    tablet: {
      container: 'bg-gray-900 p-6 rounded-[2rem] shadow-2xl',
      screen: 'bg-white rounded-lg border border-gray-700',
      header: 'h-6 bg-gray-800 rounded-t flex items-center justify-center',
      dots: 'w-8 h-1 bg-gray-600 rounded-full'
    },
    mobile: {
      container: 'bg-gray-900 p-4 rounded-[2rem] shadow-2xl relative',
      screen: 'bg-white rounded-lg border border-gray-700',
      header: 'h-6 bg-gray-800 rounded-t flex items-center justify-center',
      dots: 'w-6 h-1 bg-gray-600 rounded-full'
    }
  };

  const styles = mockupStyles[viewport];

  return (
    <div className={cn('flex justify-center', className)}>
      <div className={styles.container} style={{ width: 'fit-content' }}>
        {/* Device Header */}
        <div className={styles.header}>
          {viewport === 'desktop' ? (
            <div className={styles.dots}>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          ) : (
            <div className={styles.dots}></div>
          )}
        </div>
        
        {/* Device Screen */}
        <div 
          className={styles.screen}
          style={{ 
            width: `${width}px`,
            height: viewport === 'mobile' ? '600px' : '400px',
            maxWidth: '100%'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default DeviceMockup;
