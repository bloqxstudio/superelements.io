
import React from 'react';
import { OptimizedSkeleton } from '@/components/ui/optimized-skeleton';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface ComponentGridLoadingProps {
  variant: 'loading' | 'initializing' | 'applying-filters';
  count?: number;
  showCancel?: boolean;
  onCancel?: () => void;
}

const ComponentGridLoading: React.FC<ComponentGridLoadingProps> = ({
  variant,
  count = 12,
  showCancel = false,
  onCancel
}) => {
  const getMessage = () => {
    switch (variant) {
      case 'initializing':
        return 'Inicializando conexão...';
      case 'applying-filters':
        return 'Aplicando filtros...';
      default:
        return 'Carregando componentes...';
    }
  };

  return (
    <div className="space-y-6">
      {/* Loading Message */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
          <span className="text-muted-foreground">{getMessage()}</span>
        </div>
        
        {showCancel && onCancel && (
          <Button 
            onClick={onCancel} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        )}
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200/70">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gray-400/70"
          animate={{ x: ['-30%', '260%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Skeleton Grid */}
      <motion.div
        className="component-grid"
        variants={{
          hidden: { opacity: 1 },
          show: { opacity: 1, transition: { staggerChildren: 0.05 } },
        }}
        initial="hidden"
        animate="show"
      >
        {Array.from({ length: count }).map((_, index) => (
          <motion.div
            key={index}
            variants={{
              hidden: { opacity: 0.5, y: 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
            }}
          >
            <OptimizedSkeleton
              variant="card"
              className="animate-pulse"
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default ComponentGridLoading;
