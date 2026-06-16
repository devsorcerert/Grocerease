import { create } from 'zustand';
import api from '../utils/api';

interface CartItem {
  product_id: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  loading: boolean;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  loading: false,

  fetchCart: async () => {
    try {
      set({ loading: true });
      const response = await api.get('/cart');
      set({ items: response.data.items || [], loading: false });
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      set({ loading: false });
    }
  },

  addToCart: async (productId: string, quantity: number = 1) => {
    try {
      const response = await api.post('/cart/add', {
        product_id: productId,
        quantity,
      });
      set({ items: response.data.items || [] });
    } catch (error) {
      console.error('Failed to add to cart:', error);
      throw error;
    }
  },

  updateQuantity: async (productId: string, quantity: number) => {
    try {
      const response = await api.post('/cart/update', {
        product_id: productId,
        quantity,
      });
      set({ items: response.data.items || [] });
    } catch (error) {
      console.error('Failed to update cart:', error);
      throw error;
    }
  },

  removeItem: async (productId: string) => {
    try {
      await get().updateQuantity(productId, 0);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  },

  clearCart: async () => {
    try {
      await api.delete('/cart/clear');
    } catch (error) {
      console.error('Failed to clear cart:', error);
    } finally {
      set({ items: [], totalItems: 0, totalPrice: 0 });
    }
  },
}));
