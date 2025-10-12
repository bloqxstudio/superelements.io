import React from 'react';
import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CartItem as CartItemType } from '@/store/cartStore';
import { useCartStore } from '@/store/cartStore';
import OptimizedDynamicIframe from '@/features/components/OptimizedDynamicIframe';

interface CartItemProps {
  item: CartItemType;
  index: number;
  getDesktopPreviewUrl: (item: CartItemType) => string;
}

export const CartItem: React.FC<CartItemProps> = ({ item, index, getDesktopPreviewUrl }) => {
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

  const getComponentTitle = (comp: any): string => {
    if (!comp) return 'Sem título';
    
    if (typeof comp.title === 'string') {
      return comp.title;
    }
    
    if (comp.title && typeof comp.title === 'object' && comp.title.rendered) {
      return comp.title.rendered;
    }
    
    return 'Componente sem nome';
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
        bg-card border border-border/50 rounded-lg overflow-hidden
        flex flex-col h-[280px] w-full
        transition-all duration-200 hover:border-primary/40 hover:shadow-lg
        ${isDragging ? 'opacity-50 shadow-lg' : 'opacity-100'}
      `}
    >
      {/* Header minimalista */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-foreground/90 truncate">
            {componentTitle}
          </span>
        </div>
        <button
          onClick={() => removeFromCart(item.id)}
          className="text-muted-foreground/70 hover:text-destructive transition-colors hover:scale-110 flex-shrink-0"
          title="Remover do carrinho"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview dominante */}
      <div className="flex-1 bg-muted/20 overflow-hidden">
        <OptimizedDynamicIframe 
          url={desktopPreviewUrl} 
          title={componentTitle}
          highlightId={highlightId}
          isolateComponent={true}
        />
      </div>
    </div>
  );
};
