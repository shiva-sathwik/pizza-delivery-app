import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminAnalyticsPage() {
  const { user, navigate } = useAuth();
  const [period, setPeriod] = useState('weekly');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Test Alert state
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [testAlertMessage, setTestAlertMessage] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const fetchAnalytics = useCallback(async (selectedPeriod) => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/analytics?period=${selectedPeriod}`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch analytics');
      }

      setAnalyticsData(data.data);
    } catch (err) {
      console.error('[AdminAnalytics] Fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, API_BASE]);

  useEffect(() => {
    fetchAnalytics(period);
  }, [fetchAnalytics, period]);

  const handleTestAlert = async () => {
    setTestAlertLoading(true);
    setTestAlertMessage(null);
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/test-alert`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to dispatch test alert');
      }

      setTestAlertMessage({
        type: 'success',
        text: `✅ Test alert dispatched successfully! Included ${data.data?.count || 1} item(s) in email notification.`
      });
    } catch (err) {
      setTestAlertMessage({
        type: 'error',
        text: `❌ ${err.message}`
      });
    } finally {
      setTestAlertLoading(false);
      setTimeout(() => {
        setTestAlertMessage(null);
      }, 7000);
    }
  };

  if (!user) {
    return (
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-icon">🔒</div>
        <h2>Authentication Required</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 1.5rem' }}>
          Please sign in with administrator credentials to view analytics.
        </p>
        <button className="submit-btn" onClick={() => navigate('/admin/login')}>
          Admin Sign In
        </button>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-icon">⛔</div>
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 1.5rem' }}>
          You do not have permission to view administrator analytics.
        </p>
        <button className="submit-btn" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Format currency in Indian Rupees
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const timeline = analyticsData?.timeline || [];
  const maxRevenue = Math.max(...timeline.map((t) => t.revenue), 100);

  return (
    <div className="admin-analytics-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Page Header */}
      <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              📊 Business Analytics &amp; Insights
            </h1>
            <span className="badge" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
              Step 8
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.9rem' }}>
            Real-time sales performance, customer preferences, and automated inventory monitoring
          </p>
        </div>

        {/* Period Selector & Refresh */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="analytics-period-toggle" role="group" aria-label="Select Analytics Period">
            <button
              className={`period-btn ${period === 'daily' ? 'active' : ''}`}
              onClick={() => setPeriod('daily')}
            >
              📅 Daily (Today)
            </button>
            <button
              className={`period-btn ${period === 'weekly' ? 'active' : ''}`}
              onClick={() => setPeriod('weekly')}
            >
              🗓️ Weekly (Mon–Sun)
            </button>
            <button
              className={`period-btn ${period === 'monthly' ? 'active' : ''}`}
              onClick={() => setPeriod('monthly')}
            >
              📆 Monthly (This Month)
            </button>
          </div>

          <button
            className="refresh-btn"
            onClick={() => fetchAnalytics(period)}
            disabled={loading}
            title="Refresh analytics data"
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--danger)', margin: 0 }}>⚠️ {error}</p>
          <button className="submit-btn" style={{ marginTop: '0.75rem', padding: '0.5rem 1rem' }} onClick={() => fetchAnalytics(period)}>
            Retry
          </button>
        </div>
      )}

      {/* 6 Core Metric Tiles */}
      <div className="analytics-metrics-grid" style={{ marginBottom: '2rem' }}>
        {/* Metric 1: Total Orders */}
        <div className="metric-card card">
          <div className="metric-icon-bubble" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            📦
          </div>
          <div className="metric-content">
            <span className="metric-label">Total Orders</span>
            <span className="metric-value">{analyticsData ? analyticsData.totalOrders : '—'}</span>
            <span className="metric-subtext">Qualifying paid transactions</span>
          </div>
        </div>

        {/* Metric 2: Total Revenue */}
        <div className="metric-card card">
          <div className="metric-icon-bubble" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
            💰
          </div>
          <div className="metric-content">
            <span className="metric-label">Total Revenue</span>
            <span className="metric-value" style={{ color: '#34d399' }}>
              {analyticsData ? formatCurrency(analyticsData.totalRevenue) : '—'}
            </span>
            <span className="metric-subtext">Gross verified payments</span>
          </div>
        </div>

        {/* Metric 3: Pizzas Sold */}
        <div className="metric-card card">
          <div className="metric-icon-bubble" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}>
            🍕
          </div>
          <div className="metric-content">
            <span className="metric-label">Pizzas Sold</span>
            <span className="metric-value">{analyticsData ? analyticsData.pizzasSold : '—'}</span>
            <span className="metric-subtext">Catalog &amp; custom creations</span>
          </div>
        </div>

        {/* Metric 4: Average Order Value */}
        <div className="metric-card card">
          <div className="metric-icon-bubble" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' }}>
            📈
          </div>
          <div className="metric-content">
            <span className="metric-label">Average Order Value</span>
            <span className="metric-value">
              {analyticsData ? formatCurrency(analyticsData.averageOrderValue) : '—'}
            </span>
            <span className="metric-subtext">Revenue per order</span>
          </div>
        </div>

        {/* Metric 5: Most Ordered Pizza */}
        <div className="metric-card card">
          <div className="metric-icon-bubble" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
            🏆
          </div>
          <div className="metric-content">
            <span className="metric-label">Most Ordered Pizza</span>
            <span className="metric-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {analyticsData?.mostOrderedPizza ? analyticsData.mostOrderedPizza.title : 'None yet'}
            </span>
            <span className="metric-subtext">
              {analyticsData?.mostOrderedPizza
                ? `${analyticsData.mostOrderedPizza.count} sold in this period`
                : 'Awaiting customer orders'}
            </span>
          </div>
        </div>

        {/* Metric 6: Customer Favorite (Privacy protected: Name & order count only!) */}
        <div className="metric-card card">
          <div className="metric-icon-bubble" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
            ⭐
          </div>
          <div className="metric-content">
            <span className="metric-label">Customer Favorite</span>
            <span className="metric-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {analyticsData?.customerFavorite ? analyticsData.customerFavorite.name : 'None yet'}
            </span>
            <span className="metric-subtext">
              {analyticsData?.customerFavorite
                ? `${analyticsData.customerFavorite.orderCount} orders placed`
                : 'Awaiting customer orders'}
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Timeline Chart & Top Pizzas */}
      <div className="analytics-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Timeline Chart Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Revenue &amp; Order Timeline</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Trend across {period === 'weekly' ? 'the current calendar week' : period === 'monthly' ? 'this month' : 'today'}
              </p>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📉</div>
              <p>No sales activity recorded for this period yet.</p>
            </div>
          ) : (
            <div className="timeline-chart-wrapper">
              <div className="timeline-bars-container">
                {timeline.map((entry) => {
                  const barHeightPct = Math.round((entry.revenue / maxRevenue) * 100);
                  return (
                    <div key={entry.date} className="timeline-bar-column">
                      <div className="timeline-bar-tooltip">
                        <strong>{entry.date}</strong>
                        <div>Revenue: {formatCurrency(entry.revenue)}</div>
                        <div>Orders: {entry.orders}</div>
                      </div>
                      <div className="timeline-bar-track">
                        <div
                          className="timeline-bar-fill"
                          style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                        />
                      </div>
                      <span className="timeline-date-label">
                        {entry.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top Pizzas Breakdown Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 700 }}>Top Pizzas by Volume</h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Ranked by total quantity sold in this period
          </p>

          {!analyticsData?.topPizzas || analyticsData.topPizzas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍕</div>
              <p>No pizza sales recorded for this period yet.</p>
            </div>
          ) : (
            <div className="top-pizzas-list">
              {analyticsData.topPizzas.map((pizza, idx) => (
                <div key={pizza.title} className="top-pizza-row">
                  <div className="top-pizza-rank">#{idx + 1}</div>
                  <div className="top-pizza-info">
                    <span className="top-pizza-title">{pizza.title}</span>
                    <span className="top-pizza-revenue">{formatCurrency(pizza.revenue)} generated</span>
                  </div>
                  <div className="top-pizza-badge">
                    {pizza.count} sold
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Automated Low-Stock Alert System Console */}
      <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(26, 32, 48, 0.9), rgba(20, 24, 38, 0.9))', borderColor: 'rgba(249, 115, 22, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🚨</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Automated Inventory Monitoring &amp; Alert Engine
              </h3>
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '650px', lineHeight: 1.5 }}>
              Continuously inspects stock quantities against critical thresholds. Consolidates all low-stock ingredients into a single alert notification with automatic 24-hour spam-prevention cooldown.
            </p>
          </div>

          <button
            className="submit-btn"
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onClick={handleTestAlert}
            disabled={testAlertLoading}
          >
            <span>{testAlertLoading ? '⏳' : '📧'}</span>
            <span>{testAlertLoading ? 'Dispatching Test...' : 'Send Test Alert Email'}</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {testAlertMessage && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              background: testAlertMessage.type === 'success' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${testAlertMessage.type === 'success' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: testAlertMessage.type === 'success' ? '#34d399' : '#f87171'
            }}
          >
            {testAlertMessage.text}
          </div>
        )}

        {/* System Specs pills */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <div className="alert-spec-pill">
            <span className="spec-dot active" />
            <span>Cron Schedule: <strong>Every 6 Hours (0 */6 * * *)</strong></span>
          </div>
          <div className="alert-spec-pill">
            <span className="spec-dot active" />
            <span>Spam Cooldown: <strong>24 Hours</strong></span>
          </div>
          <div className="alert-spec-pill">
            <span className="spec-dot active" />
            <span>Consolidation: <strong>Single Email Batch</strong></span>
          </div>
          <div className="alert-spec-pill">
            <span className="spec-dot active" />
            <span>Safety: <strong>In-Memory Non-Mutating Test Mode</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
