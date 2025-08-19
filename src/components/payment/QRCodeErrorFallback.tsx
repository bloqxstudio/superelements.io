import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QRCodeErrorFallbackProps {
  className?: string;
  onRetry?: () => void;
}

export const QRCodeErrorFallback: React.FC<QRCodeErrorFallbackProps> = ({ 
  className,
  onRetry 
}) => {
  return (
    <div className={cn(
      "w-64 h-64 border-2 border-dashed border-red-300 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-950/30",
      className
    )}>
      <div className="text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <p className="text-red-700 dark:text-red-300 text-sm font-medium">
          Erro ao carregar QR Code
        </p>
        <p className="text-red-600 dark:text-red-400 text-xs">
          Use o código PIX abaixo
        </p>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
};