import React from 'react';
import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CartItem as CartItemType } from '@/store/cartStore';
import { useCartStore } from '@/store/cartStore';
import OptimizedDynamicIframe from '@/features/components/OptimizedDynamicIframe';

interface CartItemProps {
  item: CartItemType;
  getDesktopPreviewUrl: (component: any) => string;
}

export const CartItem: React.FC<CartItemProps> = ({ item, getDesktopPreviewUrl }) => {
  const { removeFromCart } = useCartStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getComponentTitle = (comp: any) => {
    if (typeof comp.title === 'string') {
      return comp.title;
    }
    return comp.title?.rendered || 'Untitled Component';
  };

  const componentTitle = getComponentTitle(item.component);
  const desktopPreviewUrl = getDesktopPreviewUrl(item.component);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-card border border-border rounded-lg p-3 flex items-start gap-3
        transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg' : 'opacity-100'}
      `}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0 border border-border/50">
        <OptimizedDynamicIframe 
          url={desktopPreviewUrl} 
          title={`Preview of ${componentTitle}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate">
          {componentTitle}
        </h4>
      </div>

      <button
        onClick={() => removeFromCart(item.id)}
        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
        title="Remover do carrinho"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
