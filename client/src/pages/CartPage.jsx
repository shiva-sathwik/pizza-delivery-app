import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { user, navigate } = useAuth();
  const { cart, loading, actionLoading, updateQuantity, removeFromCart, clearCart } = useCart();
  const [checkoutNotice, setCheckoutNotice] = useState(false);

  // If user is not authenticated, prompt to sign in
  if (!user) {
    return (
      <div className="cart-page">
        <div className="card cart-auth-card">
          <span className="cart-empty-icon">🔐</span>
          <h2>Your Cart is Waiting</h2>
          <p>Please log in or create an account to view and manage your shopping cart.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate('/login?redirect=/cart')}
            >
              Sign In to View Cart
            </button>
            <button
              type="button"
              className="nav-btn"
              style={{ border: '1px solid var(--border-subtle)' }}
              onClick={() => navigate('/menu')}
            >
              Browse Menu First
            </button>
          </div>
        </div>
      </div>
    );
  }

  const items = cart.items || [];
  const subtotal = cart.subtotal || 0;
  const totalItems = cart.totalItems || 0;

  const handleCheckoutClick = () => {
    setCheckoutNotice(true);
    setTimeout(() => {
      setCheckoutNotice(false);
    }, 6000);
  };

  return (
    <div className="cart-page">
      <div className="cart-header">
        <div className="hero-tag">
          <span>🛒</span> Shopping Cart
        </div>
        <h1 className="cart-title">
          Your Order <span className="hero-highlight">Overview</span>
        </h1>
        <p className="cart-subtitle">
          Review your selected catalog creations and custom artisan pizzas before proceeding to checkout.
        </p>
      </div>

      {loading && items.length === 0 ? (
        <div className="cart-loading-box">
          <span className="loading-spinner">⏳</span>
          <p>Synchronizing cart with server...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card cart-empty-card">
          <span className="cart-empty-icon">🍕</span>
          <h2>Your Cart is Empty</h2>
          <p>You haven't added any delicious pizzas yet. What are you craving today?</p>
          <div className="empty-cart-actions">
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate('/menu')}
            >
              📖 Browse Catalog Menu
            </button>
            <button
              type="button"
              className="submit-btn"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
              onClick={() => navigate('/custom-pizza')}
            >
              ✨ Build Custom Pizza
            </button>
          </div>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Items List */}
          <div className="cart-items-col">
            <div className="cart-items-header-bar">
              <span>{totalItems} item{totalItems !== 1 ? 's' : ''} in cart</span>
              <button
                type="button"
                className="link-btn-danger"
                onClick={clearCart}
                disabled={actionLoading}
              >
                Clear Cart 🗑️
              </button>
            </div>

            <div className="cart-items-list">
              {items.map((item) => {
                const itemSubtotal = Math.round(item.price * item.quantity * 100) / 100;
                return (
                  <div key={item._id} className="cart-item-card card">
                    <div className="item-meta-group">
                      <div className="item-badge-row">
                        <span className={`item-type-badge ${item.type}`}>
                          {item.type === 'custom' ? '✨ Custom Artisan' : '🍕 Classic Catalog'}
                        </span>
                        <span className="item-price-tag">₹{item.price} each</span>
                      </div>
                      <h3 className="item-name">{item.name}</h3>

                      <div className="item-recipe-specs">
                        <span><strong>Crust:</strong> {item.base}</span>
                        <span>&bull;</span>
                        <span><strong>Sauce:</strong> {item.sauce}</span>
                        <span>&bull;</span>
                        <span><strong>Cheese:</strong> {item.cheese}</span>
                      </div>

                      {item.vegetables && item.vegetables.length > 0 && (
                        <div className="item-veggies">
                          <strong>Toppings:</strong> {item.vegetables.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="item-controls-group">
                      {/* Quantity Stepper */}
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => updateQuantity(item._id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || actionLoading}
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="qty-number">{item.quantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => updateQuantity(item._id, item.quantity + 1)}
                          disabled={actionLoading}
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Subtotal */}
                      <div className="item-subtotal-box">
                        <span className="subtotal-label">Subtotal</span>
                        <span className="subtotal-val">₹{itemSubtotal}</span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        className="delete-item-btn"
                        onClick={() => removeFromCart(item._id)}
                        disabled={actionLoading}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart Summary Column */}
          <div className="cart-summary-col">
            <div className="card cart-summary-card sticky-summary">
              <h3 className="summary-title">Order Summary</h3>

              <div className="summary-rows">
                <div className="summary-row">
                  <span>Total Items</span>
                  <span>{totalItems}</span>
                </div>
                <div className="summary-row">
                  <span>Item Subtotal</span>
                  <span className="highlight-price">₹{subtotal}</span>
                </div>
                <div className="summary-row">
                  <span>Standard Delivery</span>
                  <span className="free-tag">FREE (Demo)</span>
                </div>
                <div className="summary-row divider-row" />
                <div className="summary-row grand-total-row">
                  <span>Grand Total</span>
                  <span className="grand-total-price">₹{subtotal}</span>
                </div>
              </div>

              {/* Notice Banner for Step 6 */}
              {checkoutNotice && (
                <div className="alert-banner alert-warning" style={{ marginTop: '1.25rem' }}>
                  <span>⏳</span>
                  <div>
                    <strong>Step 6 Milestone Upcoming</strong>
                    <p>
                      Payment Gateway (Razorpay) &amp; Order Processing will be implemented in Step 6.
                      Your cart items and server totals are securely prepared and ready!
                    </p>
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                className="submit-btn full-width-btn"
                onClick={handleCheckoutClick}
              >
                Proceed to Checkout 💳
              </button>

              <div className="cart-security-badge">
                <span>🔒</span>
                <span>Server-Verified Pricing &bull; User Isolated Session</span>
              </div>

              <div className="cart-back-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('/menu')}
                >
                  ← Continue Shopping Menu
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('/custom-pizza')}
                >
                  + Add Another Custom Pizza
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
