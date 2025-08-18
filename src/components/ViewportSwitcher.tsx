
import React from 'react';
import { Button } from '@/components/ui/button';
import { useViewport, ViewportType } from '@/hooks/useViewport';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

const viewportConfig = {
  desktop: { icon: Monitor, label: 'Desktop', width: '1200px' },
  tablet: { icon: Tablet, label: 'Tablet', width: '1024px' },
  mobile: { icon: Smartphone, label: 'Mobile', width: '767px' },
} as const;

interface ViewportSwitcherProps {
  size?: 'sm' | 'default';
}

const ViewportSwitcher: React.FC<ViewportSwitcherProps> = ({ size = 'default' }) => {
  const { viewport, setViewport } = useViewport();

  return (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
      {Object.entries(viewportConfig).map(([key, config]) => {
        const viewportKey = key as ViewportType;
        const Icon = config.icon;
        const isActive = viewport === viewportKey;
        
        return (
          <Button
            key={viewportKey}
            variant={isActive ? 'default' : 'ghost'}
            size={size}
            onClick={() => setViewport(viewportKey)}
            className={`flex items-center gap-2 ${size === 'sm' ? 'h-8 px-3' : ''}`}
            title={`${config.label} (${config.width})`}
          >
            <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
            <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>
              {config.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
};

export default ViewportSwitcher;
