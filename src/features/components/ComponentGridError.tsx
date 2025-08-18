
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';

interface ComponentGridErrorProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
  onForceReload?: () => void;
  canRetry?: boolean;
}

const ComponentGridError: React.FC<ComponentGridErrorProps> = ({ 
  error, 
  onRetry, 
  onCancel, 
  onForceReload,
  canRetry = true 
}) => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-red-700">Loading Failed</h3>
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
            {error}
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 justify-center">
            {canRetry && (
              <Button 
                onClick={onRetry}
                className="flex items-center gap-2"
                variant="default"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            
            <Button 
              onClick={onCancel}
              variant="outline"
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
          
          {onForceReload && (
            <div className="pt-2 border-t border-gray-200">
              <Button 
                onClick={onForceReload}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Force Reload Components
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Clear cache and reload from scratch
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComponentGridError;
