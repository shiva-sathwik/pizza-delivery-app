import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function DashboardPage() {
  const { user, logout, navigate } = useAuth();
  const { addToCart } = useCart();

  const [popularPizza, setPopularPizza] = useState(null);
  const [popularOrderCount, setPopularOrderCount] = useState(0);
  const [popularMessage, setPopularMessage] = useState('');
  const [popularLoading, setPopularLoading] = useState(true);
  const [addedNotice, setAddedNotice] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  }, [API_BASE]);

  const handleOrderPopular = async () => {
    if (!popularPizza) return;
    try {
      await addToCart({
        pizzaId: popularPizza._id,
        name: popularPizza.name,
        price: popularPizza.price,
        image: popularPizza.image,
        base: popularPizza.base || 'Thin Crust',
        sauce: popularPizza.sauce || 'Tomato Basil',
        cheese: popularPizza.cheese || 'Mozzarella',
        vegetables: popularPizza.vegetables || ['Basil']
      });
      setAddedNotice(true);
      setTimeout(() => {
        setAddedNotice(false);
        navigate('/cart');
      }, 800);
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
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔥</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Trending Recommendation
              </h3>
            </div>
            {popularPizza && (
              <span className="badge" style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.4)' }}>
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
                    border: '1px solid #334155'
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: '#f8fafc' }}>
                  {popularPizza.name}
                </h4>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {popularPizza.description || 'Deliciously crafted customer favorite, baked to perfection.'}
                </p>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#34d399' }}>
                  ₹{popularPizza.price}
                </span>
              </div>
              <div>
                <button
                  className="submit-btn"
                  style={{
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.9rem',
                    background: addedNotice ? '#10b981' : 'linear-gradient(135deg, #f97316, #ea580c)',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={handleOrderPopular}
                >
                  {addedNotice ? '✓ Added to Cart!' : '🛒 Order Now'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', color: '#94a3b8' }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {popularMessage || 'Popular picks will appear after customers place orders.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="endpoint-inspector" style={{ marginTop: '1.5rem' }}>
        <div className="endpoint-header">
          <span className="endpoint-tag">
            <span className="method-get">SESSION</span>
            <span>Decoded User Profile</span>
          </span>
        </div>
        <pre className="json-viewer">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="submit-btn" style={{ flex: 1 }} onClick={() => navigate('/menu')}>
          🍕 Order from Menu
        </button>
        <button className="submit-btn" style={{ flex: 1, background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }} onClick={() => navigate('/orders')}>
          📋 View My Orders
        </button>
        {user.role === 'admin' && (
          <>
            <button
              className="submit-btn"
              style={{ flex: 1, background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }}
              onClick={() => navigate('/admin/analytics')}
            >
              📊 Business Analytics
            </button>
            <button
              className="submit-btn"
              style={{ flex: 1, background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
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
