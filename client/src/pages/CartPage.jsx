import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Helper to load Razorpay checkout script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CartPage() {
  const { user, navigate } = useAuth();
  const { cart, loading, actionLoading, updateQuantity, removeFromCart, clearCart, fetchCart } = useCart();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [insufficientItems, setInsufficientItems] = useState(null);
  const [refundAlert, setRefundAlert] = useState(null);

  // Development/Test simulated payment modal state
  const [simulatorState, setSimulatorState] = useState({
    isOpen: false,
    orderData: null
  });

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  // Verify payment on server & finalize order
  const handleVerifyPayment = async (paymentResponse) => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    setRefundAlert(null);

    try {
      const response = await fetch(`${API_BASE}/orders/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(paymentResponse)
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle Post-Payment Stock Depletion Edge Case:
        if (data.refundRequired) {
          setRefundAlert(data.message);
          setCheckoutLoading(false);
          await fetchCart();
          return;
        }
        throw new Error(data.message || 'Payment signature verification failed');
      }

      // Success: Clear cart & navigate to live order tracking
      await fetchCart();
      setSimulatorState({ isOpen: false, orderData: null });
      navigate(`/orders/${data.order._id}`);
    } catch (err) {
      console.error('[CartCheckout] Verification error:', err.message);
      setCheckoutError(err.message || 'Payment verification failed');
      setCheckoutLoading(false);
    }
  };

  // Initiate Checkout Flow
  const handleProceedToCheckout = async () => {
    if (items.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError(null);
    setInsufficientItems(null);
    setRefundAlert(null);

    try {
      // 1. Create Razorpay Order on server (with pre-checkout inventory validation)
      const response = await fetch(`${API_BASE}/orders/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.insufficientItems) {
          setInsufficientItems(data.insufficientItems);
          throw new Error(data.message || 'Insufficient stock for selected ingredients');
        }
        throw new Error(data.message || 'Could not initiate checkout');
      }

      const { razorpayOrderId, amount, currency, keyId, isSimulated, devTestPaymentId, devTestSignature } = data;

      // 2. Check if we should open live Razorpay or Dev Simulator
      const isPlaceholder = !keyId || keyId.includes('placeholder') || isSimulated;

      if (isPlaceholder && import.meta.env.DEV) {
        // Development Test Payment Simulator Modal
        setSimulatorState({
          isOpen: true,
          orderData: {
            razorpayOrderId,
            amount,
            currency,
            keyId,
            devTestPaymentId,
            devTestSignature
          }
        });
        setCheckoutLoading(false);
        return;
      }

      // 3. Live Razorpay Modal
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK failed to load. Please check your internet connection.');
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'PizzaFlow Delivery',
        description: 'Artisan Pizza Order Payment (Test Mode)',
        order_id: razorpayOrderId,
        handler: async function (paymentRes) {
          await handleVerifyPayment({
            razorpay_order_id: paymentRes.razorpay_order_id,
            razorpay_payment_id: paymentRes.razorpay_payment_id,
            razorpay_signature: paymentRes.razorpay_signature
          });
        },
        modal: {
          ondismiss: function () {
            setCheckoutLoading(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: {
          color: '#ff6b35'
        }
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function (failRes) {
        setCheckoutError(`Payment failed: ${failRes.error.description || 'Transaction declined'}`);
        setCheckoutLoading(false);
      });
      razorpayInstance.open();
    } catch (err) {
      console.error('[CartCheckout] Checkout initiation error:', err.message);
      setCheckoutError(err.message || 'Failed to start checkout process');
      setCheckoutLoading(false);
    }
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
          {/* Items List Column */}
          <div className="cart-items-col">
            <div className="cart-items-header-bar">
              <span>{totalItems} item{totalItems !== 1 ? 's' : ''} in cart</span>
              <button
                type="button"
                className="link-btn-danger"
                onClick={clearCart}
                disabled={actionLoading || checkoutLoading}
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
                          disabled={item.quantity <= 1 || actionLoading || checkoutLoading}
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="qty-number">{item.quantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => updateQuantity(item._id, item.quantity + 1)}
                          disabled={actionLoading || checkoutLoading}
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
                        disabled={actionLoading || checkoutLoading}
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
                  <span className="free-tag">FREE (Launch Offer)</span>
                </div>
                <div className="summary-row divider-row" />
                <div className="summary-row grand-total-row">
                  <span>Grand Total</span>
                  <span className="grand-total-price">₹{subtotal}</span>
                </div>
              </div>

              {/* Error Alerts */}
              {checkoutError && (
                <div className="alert-banner alert-error" style={{ marginBottom: '1.25rem' }}>
                  <span>⚠️</span>
                  <div>
                    <strong>Checkout Error:</strong>
                    <p style={{ margin: 0 }}>{checkoutError}</p>
                  </div>
                </div>
              )}

              {/* Insufficient Stock Pre-Checkout Notice */}
              {insufficientItems && (
                <div className="alert-banner alert-error" style={{ marginBottom: '1.25rem' }}>
                  <span>🚨</span>
                  <div>
                    <strong>Stock Unavailable:</strong>
                    <p style={{ fontSize: '0.82rem', margin: '0.25rem 0' }}>
                      One or more ingredients are currently out of stock:
                    </p>
                    <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                      {insufficientItems.map((it, idx) => (
                        <li key={idx}>
                          <strong>{it.item}</strong> ({it.category}): Required {it.required}, Available {it.available}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Refund Notice Post-Depletion Alert */}
              {refundAlert && (
                <div className="alert-banner alert-warning" style={{ marginBottom: '1.25rem' }}>
                  <span>↩</span>
                  <div>
                    <strong>Payment Captured &bull; Full Refund Initiated:</strong>
                    <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>{refundAlert}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Our team has logged this refund in our system. You will receive an email confirmation.
                    </p>
                  </div>
                </div>
              )}

              {/* Proceed to Checkout Button */}
              <button
                type="button"
                className="submit-btn full-width-btn"
                onClick={handleProceedToCheckout}
                disabled={checkoutLoading || actionLoading}
              >
                {checkoutLoading ? 'Preparing Razorpay Checkout... ⏳' : 'Proceed to Checkout 💳'}
              </button>

              <div className="cart-security-badge">
                <span>🔒</span>
                <span>Razorpay Test Mode &bull; Server-Verified &bull; 100% Isolated</span>
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

      {/* Development / Test Mode Razorpay Simulator Modal */}
      {simulatorState.isOpen && (
        <div className="checkout-modal-backdrop">
          <div className="card checkout-modal-card">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.75rem' }}>💳</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Razorpay Test Mode Gateway</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                    Development &bull; Sandbox Test Simulator
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSimulatorState({ isOpen: false, orderData: null })}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="order-summary-box">
                <div className="summary-item">
                  <span>Merchant:</span>
                  <strong>PizzaFlow Artisan Kitchen</strong>
                </div>
                <div className="summary-item">
                  <span>Razorpay Order ID:</span>
                  <code style={{ fontSize: '0.78rem' }}>{simulatorState.orderData?.razorpayOrderId}</code>
                </div>
                {simulatorState.orderData?.devTestPaymentId && (
                  <div className="summary-item">
                    <span>Payment ID:</span>
                    <code style={{ fontSize: '0.78rem' }}>{simulatorState.orderData.devTestPaymentId}</code>
                  </div>
                )}
                <div className="summary-item">
                  <span>Customer Name:</span>
                  <strong>{user.name}</strong>
                </div>
                <div className="summary-item">
                  <span>Customer Email:</span>
                  <strong>{user.email}</strong>
                </div>
                <div className="summary-item total-highlight">
                  <span>Total Charge:</span>
                  <strong style={{ color: 'var(--status-online)', fontSize: '1.2rem' }}>
                    ₹{(simulatorState.orderData?.amount || 0) / 100}
                  </strong>
                </div>
              </div>

              <div className="test-credentials-note">
                <span>🛡️</span>
                <span>
                  <strong>Server-Side Verification:</strong> Clicking "Complete Test Payment" uses an authentic HMAC-SHA256 signature generated with the server's key secret matching this exact Order &amp; Payment ID.
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="submit-btn"
                style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                disabled={checkoutLoading}
                onClick={async () => {
                  try {
                    setCheckoutLoading(true);
                    setCheckoutError(null);

                    const orderId = simulatorState.orderData?.razorpayOrderId;
                    let payId = simulatorState.orderData?.devTestPaymentId;
                    let signature = simulatorState.orderData?.devTestSignature;

                    // If missing, request credentials from generate-test-payment endpoint
                    if (!payId || !signature) {
                      const genRes = await fetch(`${API_BASE}/orders/payment/generate-test-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ razorpay_order_id: orderId })
                      });
                      const genData = await genRes.json();
                      if (!genRes.ok) {
                        throw new Error(genData.message || 'Failed to generate test payment credentials');
                      }
                      payId = genData.razorpay_payment_id;
                      signature = genData.razorpay_signature;
                    }

                    // Forward exact matching order_id, payment_id, and signature to verification endpoint
                    await handleVerifyPayment({
                      razorpay_order_id: orderId,
                      razorpay_payment_id: payId,
                      razorpay_signature: signature
                    });
                  } catch (err) {
                    console.error('[Simulator] Test payment submission error:', err.message);
                    setCheckoutError(err.message || 'Failed to complete test payment');
                    setCheckoutLoading(false);
                  }
                }}
              >
                {checkoutLoading ? 'Verifying & Finalizing Ticket... ⏳' : 'Complete Test Payment 💳'}
              </button>

              <button
                type="button"
                className="nav-btn"
                style={{ flex: 1, border: '1px solid var(--border-subtle)' }}
                onClick={() => {
                  setSimulatorState({ isOpen: false, orderData: null });
                  setCheckoutError('Test payment cancelled by customer.');
                }}
              >
                Cancel ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
