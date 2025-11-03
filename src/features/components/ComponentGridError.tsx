
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';

interface ComponentGridErrorProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
  onForceReload?: () => void;
  canRetry?: boolean;
  connectionName?: string;
  cachedComponentsCount?: number;
}

const ComponentGridError: React.FC<ComponentGridErrorProps> = ({ 
  error, 
  onRetry, 
  onCancel, 
  onForceReload,
  canRetry = true,
  connectionName,
  cachedComponentsCount = 0
}) => {
  const isNetworkError = error.includes('rede') || error.includes('network') || error.includes('conectar');
  const isTimeoutError = error.includes('Tempo limite') || error.includes('timeout');
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-red-700">
            {isNetworkError ? 'Problema de Conexão' : 'Erro ao Carregar'}
          </h3>
          {connectionName && (
            <p className="text-sm text-gray-600">
              Conexão: <strong>{connectionName}</strong>
            </p>
          )}
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
            {error}
          </p>
          
          {isNetworkError && (
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
              <p className="font-medium text-blue-800 mb-1">💡 Possíveis causas:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Servidor WordPress temporariamente indisponível</li>
                <li>Limite de taxa (rate limiting) atingido</li>
                <li>Problema temporário de rede</li>
              </ul>
            </div>
          )}
          
          {isTimeoutError && (
            <div className="text-sm text-gray-600 bg-amber-50 p-3 rounded border border-amber-200">
              <p className="font-medium text-amber-800 mb-1">⏱️ Servidor lento</p>
              <p className="text-amber-700">
                O servidor WordPress está demorando muito para responder. 
                Tente novamente em alguns minutos.
              </p>
            </div>
          )}
          
          {cachedComponentsCount > 0 && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200">
              <p className="font-medium">✅ {cachedComponentsCount} componentes disponíveis em cache</p>
              <p className="text-xs mt-1">Os dados em cache ainda podem ser visualizados</p>
            </div>
          )}
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
