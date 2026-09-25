import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export default function OrdersPage() {
  const { user, navigate } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch order history');
      }

      setOrders(data.orders || []);
    } catch (err) {
      console.error('[OrdersPage] Error loading orders:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, API_BASE]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (!user) {
    return (
      <div className="cart-page">
        <div className="card cart-auth-card">
          <span className="cart-empty-icon">🔐</span>
          <h2>Authentication Required</h2>
          <p>Please log in to view your past orders and active delivery tracking.</p>
          <button
            type="button"
            className="submit-btn"
            style={{ marginTop: '1.5rem' }}
            onClick={() => navigate('/login?redirect=/orders')}
          >
            Sign In to View Orders
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ORDER_RECEIVED':
        return <span className="status-pill status-received">📥 Order Received</span>;
      case 'IN_KITCHEN':
        return <span className="status-pill status-kitchen">👨‍🍳 In Kitchen</span>;
      case 'SENT_TO_DELIVERY':
        return <span className="status-pill status-delivery">🛵 Out for Delivery</span>;
      default:
        return <span className="status-pill">{status}</span>;
    }
  };

  const getPaymentBadge = (payment) => {
    const status = payment?.status || 'PENDING';
    switch (status) {
      case 'PAID':
        return <span className="payment-pill payment-paid">✓ Paid (Razorpay)</span>;
      case 'REFUND_REQUIRED':
        return <span className="payment-pill payment-refund">⚠️ Refund Required</span>;
      case 'REFUNDED':
        return <span className="payment-pill payment-refunded">↩ Refunded</span>;
      default:
        return <span className="payment-pill payment-pending">⏳ {status}</span>;
    }
  };

  return (
    <div className="orders-page-container">
      <div className="panel-header" style={{ marginBottom: '2rem' }}>
        <div className="panel-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>📋</span>
            <div>
              <h1 style={{ fontSize: '1.85rem', margin: 0 }}>My Orders &amp; History</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Track your active orders in real time and review your previous pizza deliveries.
              </p>
            </div>
          </div>
        </div>

        <button
          className="refresh-btn"
          onClick={fetchOrders}
          disabled={loading}
          title="Refresh orders list"
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          <span>{loading ? 'Refreshing...' : 'Refresh Orders'}</span>
        </button>
      </div>

      {error && (
        <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem' }}>
          <strong>Error Loading Orders:</strong> {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="cart-loading-box">
          <span className="loading-spinner">⏳</span>
          <p>Retrieving your order records...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card cart-empty-card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <span className="cart-empty-icon">🍕</span>
          <h2>No Orders Placed Yet</h2>
          <p>Your order history is empty. Choose from our artisan catalog or craft your own custom pizza!</p>
          <div className="empty-cart-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate('/menu')}
            >
              📖 Browse Menu
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
        <div className="orders-list-grid">
          {orders.map((order) => {
            const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const totalItemCount = order.items.reduce((acc, it) => acc + (it.quantity || 1), 0);

            return (
              <div key={order._id} className="card order-card">
                <div className="order-card-header">
                  <div className="order-id-group">
                    <span className="order-label">ORDER ID</span>
                    <span className="order-id-val">#{order._id.slice(-8).toUpperCase()}</span>
                    <span className="order-date-text">{dateStr}</span>
                  </div>

                  <div className="order-badges-group">
                    {getPaymentBadge(order.payment)}
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                <div className="order-items-preview">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-preview-item">
                      <span className="preview-qty">{item.quantity}x</span>
                      <span className="preview-name">{item.name}</span>
                      <span className="preview-specs">
                        ({item.base} &bull; {item.sauce} &bull; {item.cheese})
                      </span>
                      <span className="preview-price">₹{item.subtotal}</span>
                    </div>
                  ))}
                </div>

                <div className="order-card-footer">
                  <div className="order-total-block">
                    <span className="total-label">Total ({totalItemCount} item{totalItemCount !== 1 ? 's' : ''}):</span>
                    <span className="total-val">₹{order.total}</span>
                  </div>

                  <button
                    type="button"
                    className="submit-btn"
                    style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                    onClick={() => navigate(`/orders/${order._id}`)}
                  >
                    Track Order Live 📍
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
