
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, Filter, RefreshCw } from 'lucide-react';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';

interface ComponentFiltersProps {
  onRefresh: () => void;
}

const ComponentFiltersComponent: React.FC<ComponentFiltersProps> = ({ onRefresh }) => {
  const { 
    connectionsData,
    selectedCategories, 
    selectCategory,
    hasActiveFilters,
    clearAllFilters
  } = useMultiConnectionData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all categories from connections data (memoizado)
  const allCategories = useMemo(() => 
    connectionsData.flatMap(conn => 
      conn.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        connectionId: conn.connectionId
      }))
    ), 
    [connectionsData]
  );

  // Remove duplicates (memoizado)
  const uniqueCategories = useMemo(() => 
    allCategories.filter((cat, index, self) => 
      index === self.findIndex(c => c.id === cat.id)
    ),
    [allCategories]
  );

  const toggleFilterVisibility = useCallback(() => {
    setIsFilterVisible(prev => !prev);
  }, []);

  const handleCategoryToggle = useCallback((categoryId: number, connectionId: string) => {
    selectCategory(connectionId, categoryId);
  }, [selectCategory]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Filter categories by search term (memoizado)
  const filteredCategories = useMemo(() => 
    uniqueCategories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [uniqueCategories, searchTerm]
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Filtros de Componentes
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRefresh}
              className="mr-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFilterVisibility}>
              <Filter className="h-4 w-4 mr-2" />
              {isFilterVisible ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`space-y-4 ${isFilterVisible ? '' : 'hidden'}`}>
        {/* Search Input */}
        <div className="relative">
          <Input
            type="search"
            placeholder="Buscar componentes..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchTerm('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 rounded-full hover:bg-accent text-muted-foreground"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Limpar Busca</span>
            </Button>
          )}
        </div>

        {/* Category Filters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Categorias</h4>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearAllFilters}>
                Limpar Todos
              </Button>
            )}
          </div>
          <Card className="border-none shadow-none">
            <CardContent className="p-0">
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {filteredCategories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategories.includes(category.id) ? 'default' : 'outline'}
                      className="w-full justify-start rounded-md text-sm"
                      onClick={() => handleCategoryToggle(category.id, category.connectionId)}
                    >
                      {category.name}
                      {selectedCategories.includes(category.id) && (
                        <Badge className="ml-auto">Selecionado</Badge>
                      )}
                    </Button>
                  ))}
                  {filteredCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria disponível.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoize para evitar re-renders quando props não mudam
const ComponentFilters = React.memo(ComponentFiltersComponent, (prevProps, nextProps) => {
  return prevProps.onRefresh === nextProps.onRefresh;
});

export default ComponentFilters;
