import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  component: any;
  baseUrl: string;
  order: number;
  addedAt: Date;
  connectionId: string;
  postType: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  
  addToCart: (component: any, baseUrl: string, connectionId: string, postType: string) => void;
  removeFromCart: (componentId: string) => void;
  clearCart: () => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  isInCart: (componentId: string) => boolean;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addToCart: (component, baseUrl, connectionId, postType) => {
        const componentId = component.originalId || component.id;
        
        if (get().isInCart(componentId)) {
          return;
        }

        const items = get().items;
        const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : -1;

        set({
          items: [
            ...items,
            {
              id: componentId,
              component,
              baseUrl,
              order: maxOrder + 1,
              addedAt: new Date(),
              connectionId,
              postType,
            },
          ],
        });
      },

      removeFromCart: (componentId) => {
        set({
          items: get().items.filter(item => item.id !== componentId),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      reorderItems: (fromIndex, toIndex) => {
        const items = [...get().items];
        const [movedItem] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, movedItem);
        
        const reorderedItems = items.map((item, index) => ({
          ...item,
          order: index,
        }));

        set({ items: reorderedItems });
      },

      toggleCart: () => {
        set({ isOpen: !get().isOpen });
      },

      openCart: () => {
        set({ isOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false });
      },

      isInCart: (componentId) => {
        return get().items.some(item => item.id === componentId);
      },

      getItemCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'component-cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
