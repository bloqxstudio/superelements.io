
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Database, Layers, Filter } from 'lucide-react';

interface EmptyStateProps {
  type: 'initializing' | 'no-components' | 'no-matches';
  selectedCategories?: any[];
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, selectedCategories = [] }) => {
  const configs = {
    initializing: {
      icon: Database,
      iconBg: 'from-[#D2F525] to-[#A8CC02]',
      iconColor: 'text-black',
      title: 'Inicializando Carregamento',
      description: 'Preparando para carregar componentes sob demanda...'
    },
    'no-components': {
      icon: Layers,
      iconBg: 'from-gray-100 to-gray-200',
      iconColor: 'text-gray-400',
      title: 'Nenhum Componente Encontrado',
      description: 'Tente conectar a um site WordPress para explorar componentes.'
    },
    'no-matches': {
      icon: Filter,
      iconBg: 'from-orange-100 to-orange-200',
      iconColor: 'text-orange-500',
      title: 'Nenhuma Correspondência Encontrada',
      description: 'Nenhum componente encontrado para os filtros selecionados. Tente ajustar sua seleção.'
    }
  };

  const config = configs[type];
  const IconComponent = config.icon;

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md mx-auto space-y-6">
        <div className={`w-20 h-20 bg-gradient-to-br ${config.iconBg} rounded-2xl flex items-center justify-center mx-auto`}>
          <IconComponent className={`h-10 w-10 ${config.iconColor}`} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">{config.title}</h3>
          <p className="text-muted-foreground text-lg">
            {config.description}
          </p>
        </div>
        {type === 'no-matches' && (
          <div className="mt-4">
            <Badge variant="outline" className="text-sm">
              {selectedCategories.length} categorias selecionadas
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};
