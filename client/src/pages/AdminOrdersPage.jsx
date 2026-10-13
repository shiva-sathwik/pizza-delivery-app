import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

export default function AdminOrdersPage() {
  const { user, navigate } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState({});

  const fetchOrders = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/orders`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch admin orders');
      }

      setOrders(data.orders || []);
    } catch (err) {
      console.error('[AdminOrders] Fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setActionFeedback((prev) => ({ ...prev, [orderId]: null }));
    try {
      const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update order status');
      }

      // Update state immediately
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? data.order : o))
      );

      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'success', text: `Updated to ${newStatus}!` }
      }));

      setTimeout(() => {
        setActionFeedback((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }, 3000);
    } catch (err) {
      console.error('[AdminOrders] Status update error:', err.message);
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'error', text: err.message }
      }));
    } finally {
      setUpdatingId(null);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let received = 0;
    let kitchen = 0;
    let delivery = 0;
    let revenue = 0;

    orders.forEach((o) => {
      if (o.payment?.status === 'PAID') {
        revenue += o.total || 0;
      }
      if (o.status === 'ORDER_RECEIVED') received++;
      else if (o.status === 'IN_KITCHEN') kitchen++;
      else if (o.status === 'SENT_TO_DELIVERY') delivery++;
    });

    return {
      total: orders.length,
      received,
      kitchen,
      delivery,
      revenue
    };
  }, [orders]);

  // Filtered list
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  if (!user) {
    return (
      <div className="cart-page">
        <div className="card cart-auth-card">
          <span className="cart-empty-icon">🔒</span>
          <h2>Administrator Sign In Required</h2>
          <p>You must authenticate with administrator privileges to manage platform orders.</p>
          <button
            type="button"
            className="submit-btn admin-btn"
            style={{ marginTop: '1.5rem' }}
            onClick={() => navigate('/admin/login?redirect=/admin/orders')}
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="auth-card card" style={{ textAlign: 'center', borderColor: 'var(--status-offline)' }}>
        <div className="auth-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', borderColor: 'var(--status-offline)' }}>
          ⛔
        </div>
        <h2 style={{ color: 'var(--status-offline)' }}>403 Forbidden</h2>
        <div className="alert-banner alert-error" style={{ textAlign: 'left', margin: '1.5rem 0' }}>
          <strong>Access Denied:</strong>
          <p>
            Your account ({user.email}) has role <code>{user.role}</code>. Only users with role <code>admin</code> are authorized to access the Order Management console.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="submit-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <button className="submit-btn admin-btn" onClick={() => navigate('/admin/login')}>
            Switch to Admin Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-orders-container">
      {/* Header */}
      <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>👨‍💼</span>
            <div>
              <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Order Management Console</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Control live kitchen tickets, advance delivery stages, and oversee customer transactions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchOrders}
            disabled={loading}
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Orders'}</span>
          </button>

          <button
            type="button"
            className="refresh-btn"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}
            onClick={() => navigate('/admin/inventory')}
          >
            📦 Inventory Controls
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem' }}>
          <strong>Error Loading Orders:</strong> {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="inventory-metrics-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Orders</span>
            <span className="metric-icon">📋</span>
          </div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-subtext">All time customer orders</div>
        </div>

        <div className="metric-card low-stock-card">
          <div className="metric-header">
            <span className="metric-title">New Tickets</span>
            <span className="metric-icon">📥</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-warning)' }}>
            {metrics.received}
          </div>
          <div className="metric-subtext">Awaiting kitchen prep</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid var(--color-sage)' }}>
          <div className="metric-header">
            <span className="metric-title">In Kitchen</span>
            <span className="metric-icon">👨‍🍳</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--color-forest)' }}>
            {metrics.kitchen}
          </div>
          <div className="metric-subtext">Currently baking</div>
        </div>

        <div className="metric-card in-stock-card">
          <div className="metric-header">
            <span className="metric-title">Out for Delivery</span>
            <span className="metric-icon">🛵</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-online)' }}>
            {metrics.delivery}
          </div>
          <div className="metric-subtext">En route to customers</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid var(--color-forest)' }}>
          <div className="metric-header">
            <span className="metric-title">Total Revenue</span>
            <span className="metric-icon">💰</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--color-forest)' }}>
            ₹{metrics.revenue}
          </div>
          <div className="metric-subtext">Verified Razorpay Payments</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="inventory-controls-card card" style={{ marginBottom: '1.5rem', padding: '0.75rem 1.25rem' }}>
        <div className="category-tabs-row" style={{ border: 'none', padding: 0 }}>
          <button
            type="button"
            className={`category-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            <span>All Orders</span>
            <span className="category-tab-count">{metrics.total}</span>
          </button>

          <button
            type="button"
            className={`category-tab-btn ${statusFilter === 'ORDER_RECEIVED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ORDER_RECEIVED')}
          >
            <span>📥 Order Received</span>
            <span className="category-tab-count">{metrics.received}</span>
          </button>

          <button
            type="button"
            className={`category-tab-btn ${statusFilter === 'IN_KITCHEN' ? 'active' : ''}`}
            onClick={() => setStatusFilter('IN_KITCHEN')}
          >
            <span>👨‍🍳 In Kitchen</span>
            <span className="category-tab-count">{metrics.kitchen}</span>
          </button>

          <button
            type="button"
            className={`category-tab-btn ${statusFilter === 'SENT_TO_DELIVERY' ? 'active' : ''}`}
            onClick={() => setStatusFilter('SENT_TO_DELIVERY')}
          >
            <span>🛵 Sent to Delivery</span>
            <span className="category-tab-count">{metrics.delivery}</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card inventory-table-card">
        {loading && orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>⏳</span>
            <p style={{ color: 'var(--text-secondary)' }}>Loading platform orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>📋</span>
            <h3>No orders found for selected filter</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Orders will appear here as customers complete checkout.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Order Info</th>
                  <th>Customer</th>
                  <th>Items Snapshot</th>
                  <th>Payment</th>
                  <th>Current Status</th>
                  <th style={{ textAlign: 'right' }}>Advance Stage</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isUpdating = updatingId === order._id;
                  const feedback = actionFeedback[order._id];

                  return (
                    <tr key={order._id}>
                      {/* Order Info */}
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', display: 'block' }}>
                          #{order._id.slice(-8).toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                        <span style={{ display: 'block', fontWeight: 800, color: 'var(--color-forest)', marginTop: '0.25rem' }}>
                          ₹{order.total}
                        </span>
                      </td>

                      {/* Customer */}
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>
                          {order.user?.name || 'Customer'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {order.user?.email || 'N/A'}
                        </span>
                      </td>

                      {/* Items */}
                      <td>
                        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {order.items.map((it, idx) => (
                            <div key={idx} style={{ color: 'var(--text-secondary)' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{it.quantity}x</strong> {it.name}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td>
                        <span
                          className={`payment-pill ${
                            order.payment?.status === 'PAID'
                              ? 'payment-paid'
                              : order.payment?.status === 'REFUND_REQUIRED'
                              ? 'payment-refund'
                              : 'payment-pending'
                          }`}
                        >
                          {order.payment?.status || 'PENDING'}
                        </span>
                        {order.payment?.razorpayPaymentId && (
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                            {order.payment.razorpayPaymentId.slice(0, 14)}...
                          </span>
                        )}
                      </td>

                      {/* Order Status */}
                      <td>
                        <span
                          className={`status-pill ${
                            order.status === 'ORDER_RECEIVED'
                              ? 'status-received'
                              : order.status === 'IN_KITCHEN'
                              ? 'status-kitchen'
                              : 'status-delivery'
                          }`}
                        >
                          {order.status === 'ORDER_RECEIVED'
                            ? '📥 Order Received'
                            : order.status === 'IN_KITCHEN'
                            ? '👨‍🍳 In Kitchen'
                            : '🛵 Sent to Delivery'}
                        </span>
                      </td>

                      {/* Status Transition Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                          {feedback && (
                            <span className={`row-feedback-text ${feedback.type}`}>
                              {feedback.type === 'success' ? '✓ ' : '✗ '}
                              {feedback.text}
                            </span>
                          )}

                          {order.status === 'ORDER_RECEIVED' && (
                            <button
                              type="button"
                              className="submit-btn"
                              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--color-forest), var(--color-sage))' }}
                              onClick={() => handleUpdateStatus(order._id, 'IN_KITCHEN')}
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Updating...' : 'Move to Kitchen 👨‍🍳'}
                            </button>
                          )}

                          {order.status === 'IN_KITCHEN' && (
                            <button
                              type="button"
                              className="submit-btn"
                              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--color-sage), var(--color-forest))' }}
                              onClick={() => handleUpdateStatus(order._id, 'SENT_TO_DELIVERY')}
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Updating...' : 'Send to Delivery 🛵'}
                            </button>
                          )}

                          {order.status === 'SENT_TO_DELIVERY' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--status-online)', fontWeight: 600 }}>
                              ✓ Out for Delivery
                            </span>
                          )}

                          <button
                            type="button"
                            className="link-btn"
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => navigate(`/orders/${order._id}`)}
                          >
                            View Live Tracker 📍
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
