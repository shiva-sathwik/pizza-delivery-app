import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { API_BASE } from '../services/api';

export default function DashboardPage() {
  const { user, logout, navigate } = useAuth();
  const { addToCart } = useCart();

  const [popularPizza, setPopularPizza] = useState(null);
  const [popularOrderCount, setPopularOrderCount] = useState(0);
  const [popularMessage, setPopularMessage] = useState('');
  const [popularLoading, setPopularLoading] = useState(true);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    const fetchPopularPizza = async () => {
      try {
        setPopularLoading(true);
        const res = await fetch(`${API_BASE}/pizzas/popular`);
        const json = await res.json();
        if (json.success && json.data) {
          setPopularPizza(json.data);
          setPopularOrderCount(json.orderCount || 0);
        } else {
          setPopularPizza(null);
          setPopularMessage(json.message || 'Popular picks will appear after customers place orders.');
        }
      } catch (err) {
        console.error('Failed to load popular pizza recommendation:', err);
        setPopularMessage('Popular picks will appear after customers place orders.');
      } finally {
        setPopularLoading(false);
      }
    };

    fetchPopularPizza();
  }, []);

  const handleOrderPopular = async () => {
    if (!popularPizza) return;
    try {
      const result = await addToCart({
        type: 'catalog',
        pizzaId: popularPizza._id,
        name: popularPizza.name,
        price: popularPizza.price,
        image: popularPizza.image,
        base: popularPizza.base || 'Thin Crust',
        sauce: popularPizza.sauce || 'Tomato Basil',
        cheese: popularPizza.cheese || 'Mozzarella',
        vegetables: popularPizza.vegetables || ['Basil']
      });
      if (result && result.success) {
        setAddedNotice(true);
        setTimeout(() => {
          setAddedNotice(false);
          navigate('/cart');
        }, 800);
      } else {
        navigate('/menu');
      }
    } catch (err) {
      console.error('Failed to add popular pizza to cart:', err);
      navigate('/menu');
    }
  };

  if (!user) {
    return (
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-icon">🔒</div>
        <h2>Authentication Required</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 1.5rem' }}>
          You must be logged in to view your account dashboard.
        </p>
        <button className="submit-btn" onClick={() => navigate('/login')}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div className="panel-header">
        <div>
          <h2>User Account Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Authenticated Customer Session &bull; Protected Route
          </p>
        </div>
        <button className="refresh-btn" onClick={logout}>
          Log Out
        </button>
      </div>

      <div className="status-grid" style={{ marginBottom: '2rem' }}>
        <div className="status-item">
          <span className="status-item-label">Account Holder</span>
          <span className="status-value">{user.name}</span>
          <span className="status-detail">{user.email}</span>
        </div>

        <div className="status-item">
          <span className="status-item-label">Account Role</span>
          <div className="status-badge-row">
            <span className="pulse-dot online" />
            <span className="status-value" style={{ textTransform: 'uppercase' }}>
              {user.role}
            </span>
          </div>
          <span className="status-detail">
            {user.role === 'admin' ? 'Administrator Privileges' : 'Normal Customer Access'}
          </span>
        </div>

        <div className="status-item">
          <span className="status-item-label">Email Verification</span>
          <div className="status-badge-row">
            <span className={`pulse-dot ${user.isEmailVerified ? 'online' : 'warning'}`} />
            <span className="status-value">
              {user.isEmailVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <span className="status-detail">
            {user.isEmailVerified ? 'Identity Confirmed' : 'Check Inbox'}
          </span>
        </div>

        <div className="status-item">
          <span className="status-item-label">Session Security</span>
          <div className="status-badge-row">
            <span className="pulse-dot online" />
            <span className="status-value">Active</span>
          </div>
          <span className="status-detail">Secured via HTTP-Only JWT</span>
        </div>
      </div>

      {/* Step 8 Customer Recommendation Widget */}
      <div className="recommendation-widget" style={{ marginBottom: '2rem' }}>
        <div className="recommendation-card" style={{
          background: '#FFFFFF',
          border: '1.5px solid var(--color-soft-green)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔥</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Trending Recommendation
              </h3>
            </div>
            {popularPizza && (
              <span className="badge" style={{ background: 'var(--color-pale-mint)', color: 'var(--color-forest)', border: '1px solid var(--color-soft-green)' }}>
                ⭐ Customer Favorite #{1} &bull; {popularOrderCount} orders
              </span>
            )}
          </div>

          {popularLoading ? (
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0' }}>Loading popular pick...</p>
          ) : popularPizza ? (
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {popularPizza.image && (
                <img
                  src={popularPizza.image}
                  alt={popularPizza.name}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '1px solid var(--border-subtle)'
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                  {popularPizza.name}
                </h4>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {popularPizza.description || 'Deliciously crafted customer favorite, baked to perfection.'}
                </p>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-forest)' }}>
                  ₹{popularPizza.price}
                </span>
              </div>
              <div>
                <button
                  type="button"
                  className={`dashboard-recommend-btn ${addedNotice ? 'added' : ''}`}
                  style={{
                    background: addedNotice ? 'var(--status-online)' : 'var(--color-forest)'
                  }}
                  onClick={handleOrderPopular}
                >
                  {addedNotice ? '✓ Added to Cart!' : '🛒 Order Now'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {popularMessage || 'Popular picks will appear after customers place orders.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-actions-grid">
        <button
          type="button"
          className="dashboard-action-btn"
          onClick={() => navigate('/menu')}
        >
          🍕 Order from Menu
        </button>
        <button
          type="button"
          className="dashboard-action-btn"
          onClick={() => navigate('/orders')}
        >
          📋 View My Orders
        </button>
        {user.role === 'admin' && (
          <>
            <button
              type="button"
              className="dashboard-action-btn"
              onClick={() => navigate('/admin/analytics')}
            >
              📊 Business Analytics
            </button>
            <button
              type="button"
              className="dashboard-action-btn"
              onClick={() => navigate('/admin/inventory')}
            >
              📦 Manage Inventory
            </button>
          </>
        )}
      </div>
    </div>
  );
}
