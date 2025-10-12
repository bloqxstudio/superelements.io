import React, { useState } from 'react';
import { GripVertical, X, Maximize2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CartItem as CartItemType } from '@/store/cartStore';
import { useCartStore } from '@/store/cartStore';
import OptimizedDynamicIframe from '@/features/components/OptimizedDynamicIframe';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface CartItemProps {
  item: CartItemType;
  getDesktopPreviewUrl: (item: CartItemType) => string;
}

export const CartItem: React.FC<CartItemProps> = ({ item, getDesktopPreviewUrl }) => {
  const { removeFromCart } = useCartStore();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
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
        bg-card border border-border rounded-lg p-3 flex items-center gap-3
        transition-all duration-200 hover:border-primary/50 hover:shadow-md
        ${isDragging ? 'opacity-50 shadow-lg' : 'opacity-100'}
      `}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div 
            className="relative group cursor-pointer"
            onMouseEnter={() => setIsPopoverOpen(true)}
            onMouseLeave={() => setIsPopoverOpen(false)}
          >
            <div className="w-32 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0 border-2 border-border/50 shadow-sm transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg">
              <OptimizedDynamicIframe 
                url={desktopPreviewUrl} 
                title={`Preview of ${componentTitle}`}
                highlightId={highlightId}
                isolateComponent={true}
              />
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center">
              <Maximize2 className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          side="right" 
          align="start"
          className="w-[500px] h-[350px] p-2"
          onMouseEnter={() => setIsPopoverOpen(true)}
          onMouseLeave={() => setIsPopoverOpen(false)}
        >
          <div className="w-full h-full bg-muted rounded-lg overflow-hidden border border-border">
            <OptimizedDynamicIframe 
              url={desktopPreviewUrl} 
              title={`Expanded preview of ${componentTitle}`}
              highlightId={highlightId}
              isolateComponent={true}
            />
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-base font-semibold text-foreground">
          {componentTitle}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Componente do Elementor
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1 italic">
          Passe o mouse para expandir
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
