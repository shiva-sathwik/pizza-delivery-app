import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

const STAGES = [
  {
    key: 'ORDER_RECEIVED',
    title: 'Order Received',
    desc: 'Your payment is confirmed and our kitchen has accepted the ticket.',
    icon: '📥'
  },
  {
    key: 'IN_KITCHEN',
    title: 'Baking in Kitchen',
    desc: 'Our pizza masters are handcrafting your dough and baking your toppings to golden perfection.',
    icon: '👨‍🍳'
  },
  {
    key: 'SENT_TO_DELIVERY',
    title: 'Out for Delivery',
    desc: 'Your hot pizza is boxed in thermal insulated packaging and speeding to your door!',
    icon: '🛵'
  }
];

export default function OrderTrackingPage() {
  const { user, currentPath, navigate } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastPolled, setLastPolled] = useState(null);

  const pollIntervalRef = useRef(null);

  // Extract order ID from current pathname (/orders/:id)
  const pathParts = currentPath.split('?')[0].split('/');
  const orderId = pathParts[2] || '';

  const fetchOrder = useCallback(
    async (isPolling = false) => {
      if (!orderId) {
        setError('No order ID specified in route');
        setLoading(false);
        return;
      }

      if (!isPolling) setLoading(true);

      try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`, {
          method: 'GET',
          credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch order status');
        }

        setOrder(data.order);
        setLastPolled(new Date().toLocaleTimeString());
        setError(null);

        // If order has reached SENT_TO_DELIVERY, stop polling
        if (data.order?.status === 'SENT_TO_DELIVERY' && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch (err) {
        console.error('[OrderTracking] Polling error:', err.message);
        setError(err.message);
      } finally {
        if (!isPolling) setLoading(false);
      }
    },
    [orderId]
  );

  // Initial fetch and start 5-second polling
  useEffect(() => {
    fetchOrder(false);

    // Setup 5-second polling interval
    pollIntervalRef.current = setInterval(() => {
      fetchOrder(true);
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchOrder]);

  if (!user) {
    return (
      <div className="cart-page">
        <div className="card cart-auth-card">
          <span className="cart-empty-icon">🔒</span>
          <h2>Authentication Required</h2>
          <p>Please log in to track your order status in real time.</p>
          <button
            type="button"
            className="submit-btn"
            style={{ marginTop: '1.5rem' }}
            onClick={() => navigate(`/login?redirect=${currentPath}`)}
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div className="cart-loading-box" style={{ margin: '4rem auto', maxWidth: '500px' }}>
        <span className="loading-spinner">⏳</span>
        <h2>Connecting to Live Kitchen Feed...</h2>
        <p>Fetching real-time dispatch updates from server...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="card cart-auth-card" style={{ maxWidth: '600px', margin: '3rem auto' }}>
        <span className="cart-empty-icon">⚠️</span>
        <h2>Unable to Track Order</h2>
        <p style={{ color: 'var(--status-offline)', margin: '1rem 0' }}>{error}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button type="button" className="submit-btn" onClick={() => fetchOrder(false)}>
            Try Again 🔄
          </button>
          <button type="button" className="nav-btn" onClick={() => navigate('/orders')}>
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  const getStageIndex = (status) => {
    switch (status) {
      case 'ORDER_RECEIVED':
        return 0;
      case 'IN_KITCHEN':
        return 1;
      case 'SENT_TO_DELIVERY':
        return 2;
      default:
        return 0;
    }
  };

  const currentStageIndex = getStageIndex(order?.status);
  const isFinalStage = order?.status === 'SENT_TO_DELIVERY';

  return (
    <div className="order-tracking-container">
      {/* Header Bar */}
      <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <button
            type="button"
            className="link-btn"
            style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => navigate('/orders')}
          >
            ← Back to All Orders
          </button>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Live Order Tracker</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Order #{order?._id?.slice(-8).toUpperCase()} &bull; Real-time status synced via live kitchen feed
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="live-pulse-badge">
            <span className={`pulse-dot ${isFinalStage ? 'online' : 'active-pulse'}`} />
            <span>{isFinalStage ? 'Delivered Stage' : 'Live Polling Active (5s)'}</span>
          </div>

          <button
            type="button"
            className="refresh-btn"
            style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
            onClick={() => fetchOrder(false)}
          >
            <span>🔄</span> Sync Now
          </button>
        </div>
      </div>

      {/* Main 3-Step Visual Progress Tracker */}
      <div className="card tracker-card" style={{ marginBottom: '2rem' }}>
        <div className="tracker-steps-bar">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const isUpcoming = idx > currentStageIndex;

            return (
              <div
                key={stage.key}
                className={`tracker-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isUpcoming ? 'upcoming' : ''}`}
              >
                <div className="step-circle">
                  {isCompleted ? '✓' : stage.icon}
                </div>

                <div className="step-info">
                  <span className="step-number">Stage {idx + 1}</span>
                  <h3 className="step-title">{stage.title}</h3>
                  <p className="step-desc">{stage.desc}</p>
                </div>

                {idx < STAGES.length - 1 && (
                  <div className={`step-connector ${isCompleted ? 'filled' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="tracker-meta-footer">
          <span>
            <strong>Payment:</strong>{' '}
            <span style={{ color: 'var(--status-online)', fontWeight: 700 }}>
              {order?.payment?.status === 'PAID' ? '✓ Paid via Razorpay' : order?.payment?.status}
            </span>
          </span>
          <span>&bull;</span>
          <span>
            <strong>Order Placed:</strong>{' '}
            {new Date(order?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span>&bull;</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Last verified: {lastPolled || 'Just now'}
          </span>
        </div>
      </div>

      {/* Order Item Snapshot Breakdown */}
      <div className="tracker-details-grid">
        <div className="card order-items-card">
          <h3 className="section-title">Order Summary ({order?.items?.length} items)</h3>
          <div className="tracker-items-list">
            {order?.items?.map((item, idx) => (
              <div key={idx} className="tracker-item-row">
                <div className="tracker-item-main">
                  <span className="tracker-item-name">{item.name}</span>
                  <div className="tracker-item-specs">
                    <span>{item.base}</span> &bull; <span>{item.sauce}</span> &bull; <span>{item.cheese}</span>
                  </div>
                  {item.vegetables && item.vegetables.length > 0 && (
                    <div className="tracker-item-veggies">
                      Toppings: {item.vegetables.join(', ')}
                    </div>
                  )}
                </div>

                <div className="tracker-item-qty">
                  <span>x{item.quantity}</span>
                </div>

                <div className="tracker-item-price">
                  <span>₹{item.subtotal}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="tracker-totals-row">
            <span>Grand Total Paid</span>
            <span className="tracker-grand-total">₹{order?.total}</span>
          </div>
        </div>

        {/* Delivery & Security Information */}
        <div className="card tracker-side-card">
          <h3 className="section-title">Delivery Guarantee</h3>
          <div className="side-card-features">
            <div className="feature-row">
              <span>🍕</span>
              <div>
                <strong>Fresh Artisan Guarantee</strong>
                <p>Baked fresh to order with locally sourced 100% mozzarella and organic flour.</p>
              </div>
            </div>

            <div className="feature-row">
              <span>⏱️</span>
              <div>
                <strong>Fast Express Dispatch</strong>
                <p>Track your driver directly once order transitions to Sent to Delivery.</p>
              </div>
            </div>

            <div className="feature-row">
              <span>🔒</span>
              <div>
                <strong>Razorpay Test Security</strong>
                <p>Payment ID: <code>{order?.payment?.razorpayPaymentId || 'rzp_test'}</code></p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              type="button"
              className="submit-btn full-width-btn"
              onClick={() => navigate('/menu')}
            >
              Order Another Pizza 🍕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
