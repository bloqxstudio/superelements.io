import React from 'react';
import { Copy, Trash2, ShoppingCart } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCartStore } from '@/store/cartStore';
import { useCartCopy } from '../hooks/useCartCopy';
import { CartItem } from './CartItem';
import { useConnectionsStore } from '@/store/connectionsStore';

export const CartDrawer: React.FC = () => {
  const { items, isOpen, closeCart, clearCart, reorderItems } = useCartStore();
  const { copyAllToClipboard, copying } = useCartCopy();
  const { getConnectionById } = useConnectionsStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      reorderItems(oldIndex, newIndex);
    }
  };

  const handleCopyAll = async () => {
    await copyAllToClipboard(items);
  };

  const handleClearCart = () => {
    if (window.confirm('Deseja realmente limpar o carrinho?')) {
      clearCart();
    }
  };

  // Helper to get desktop preview URL
  const getDesktopPreviewUrl = (component: any) => {
    const connectionId = component.connection_id;
    const connection = getConnectionById(connectionId);
    
    if (!connection) return '';
    
    const baseUrl = connection.base_url.replace(/\/$/, '');
    const previewField = connection.preview_field || 'link';
    const componentId = component.originalId || component.id;
    
    if (previewField === 'link' && component.link) {
      return component.link;
    }
    
    return `${baseUrl}/?p=${componentId}&elementor-preview=${componentId}&ver=1734155545`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho ({items.length} {items.length === 1 ? 'item' : 'itens'})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Carrinho vazio
            </h3>
            <p className="text-sm text-muted-foreground">
              Adicione componentes ao carrinho para copiá-los em massa
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 py-4">
                    {items.map((item) => (
                      <CartItem 
                        key={item.id} 
                        item={item}
                        getDesktopPreviewUrl={getDesktopPreviewUrl}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>

            <SheetFooter className="flex-col sm:flex-col gap-2 mt-4">
              <Button
                onClick={handleCopyAll}
                disabled={copying}
                className="w-full"
                size="lg"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copying ? 'Copiando...' : 'Copiar Tudo'}
              </Button>
              <Button
                onClick={handleClearCart}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Carrinho
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
