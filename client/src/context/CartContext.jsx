import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE } from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState({
    items: [],
    subtotal: 0,
    totalItems: 0
  });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cartError, setCartError] = useState(null);

  // Fetch cart from backend (server-authoritative)
  const fetchCart = useCallback(async () => {
    if (!user) {
      setCart({ items: [], subtotal: 0, totalItems: 0 });
      return;
    }

    setLoading(true);
    setCartError(null);
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const resData = await response.json();
        setCart(resData.data || { items: [], subtotal: 0, totalItems: 0 });
      } else {
        setCart({ items: [], subtotal: 0, totalItems: 0 });
      }
    } catch (err) {
      console.warn('[CartContext] Fetch cart failed:', err.message);
      setCart({ items: [], subtotal: 0, totalItems: 0 });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Sync cart whenever authentication state changes
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Add Item to Cart (Catalog or Custom)
  const addToCart = async (itemPayload) => {
    if (!user) {
      return { success: false, requireAuth: true, message: 'Please sign in to add pizzas to your cart' };
    }

    setActionLoading(true);
    setCartError(null);
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(itemPayload)
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to add pizza to cart');
      }

      setCart(resData.data);
      return { success: true, message: resData.message };
    } catch (err) {
      setCartError(err.message);
      return { success: false, message: err.message };
    } finally {
      setActionLoading(false);
    }
  };

  // Update item quantity
  const updateQuantity = async (itemId, quantity) => {
    if (!user) return { success: false, requireAuth: true };

    setActionLoading(true);
    setCartError(null);
    try {
      const response = await fetch(`${API_BASE}/cart/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quantity })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to update item quantity');
      }

      setCart(resData.data);
      return { success: true };
    } catch (err) {
      setCartError(err.message);
      return { success: false, message: err.message };
    } finally {
      setActionLoading(false);
    }
  };

  // Remove single item from cart
  const removeFromCart = async (itemId) => {
    if (!user) return { success: false, requireAuth: true };

    setActionLoading(true);
    setCartError(null);
    try {
      const response = await fetch(`${API_BASE}/cart/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to remove item from cart');
      }

      setCart(resData.data);
      return { success: true };
    } catch (err) {
      setCartError(err.message);
      return { success: false, message: err.message };
    } finally {
      setActionLoading(false);
    }
  };

  // Clear entire cart
  const clearCart = async () => {
    if (!user) return { success: false };

    setActionLoading(true);
    setCartError(null);
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to clear cart');
      }

      setCart(resData.data);
      return { success: true };
    } catch (err) {
      setCartError(err.message);
      return { success: false, message: err.message };
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        actionLoading,
        cartError,
        fetchCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
