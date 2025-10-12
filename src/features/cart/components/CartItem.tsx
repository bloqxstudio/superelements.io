import React from 'react';
import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CartItem as CartItemType } from '@/store/cartStore';
import { useCartStore } from '@/store/cartStore';
import OptimizedDynamicIframe from '@/features/components/OptimizedDynamicIframe';

interface CartItemProps {
  item: CartItemType;
  getDesktopPreviewUrl: (item: CartItemType) => string;
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
  const desktopPreviewUrl = getDesktopPreviewUrl(item);

  // Try to resolve highlight id from elementor data if available
  const resolveHighlightId = (comp: any): string | undefined => {
    try {
      const raw = comp?.meta?._elementor_data;
      if (!raw) return undefined;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(data) && data.length > 0) {
        // top-level element id
        if (data[0]?.id) return data[0].id;
        // fallback: first child id
        const firstWithId = JSON.stringify(data).match(/"id":"([^"]+)"/);
        return firstWithId ? firstWithId[1] : undefined;
      }
    } catch {}
    return undefined;
  };
  const highlightId = resolveHighlightId(item.component);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-card border border-border rounded-lg p-4 flex items-start gap-4
        transition-all duration-200 hover:border-primary/50 hover:shadow-md
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

      <div className="relative group">
        <div className="w-64 h-40 bg-muted rounded-lg overflow-hidden flex-shrink-0 border-2 border-border/50 shadow-sm transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg group-hover:scale-105">
          <OptimizedDynamicIframe 
            url={desktopPreviewUrl} 
            title={`Preview of ${componentTitle}`}
            highlightId={highlightId}
            isolateComponent={true}
          />
        </div>
        <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs font-medium px-2 py-1 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          Preview
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-base font-semibold text-foreground truncate">
          {componentTitle}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          Componente do Elementor
        </p>
      </div>

      <button
        onClick={() => removeFromCart(item.id)}
        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 hover:scale-110"
        title="Remover do carrinho"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};
