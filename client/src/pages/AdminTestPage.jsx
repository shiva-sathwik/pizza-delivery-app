import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminTestPage() {
  const { user, logout, navigate } = useAuth();
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const runAdminTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/test`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || 'Access Denied'}`);
      }

      setTestResult(data);
    } catch (err) {
      setError(err.message);
      setTestResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      runAdminTest();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="auth-card card admin-theme-card" style={{ textAlign: 'center' }}>
        <div className="admin-badge-icon">🔒</div>
        <h2>Administrator Authentication Required</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 1.5rem' }}>
          This route requires an authenticated administrator session.
        </p>
        <button className="submit-btn admin-btn" onClick={() => navigate('/admin/login')}>
          Go to Administrator Login
        </button>
      </div>
    );
  }

  // Normal user attempting to access admin route
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
            Your account ({user.email}) has role <code>{user.role}</code>. Only users with role <code>admin</code> are authorized to access this section.
          </p>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Backend authorization middleware strictly rejects this request with HTTP 403.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="submit-btn" onClick={() => navigate('/dashboard')}>
            Back to User Dashboard
          </button>
          <button className="submit-btn admin-btn" onClick={() => navigate('/admin/login')}>
            Switch to Admin Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card admin-theme-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="panel-header">
        <div>
          <h2>🛡️ Admin Authorization Test Console</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Testing Step 4F &amp; 4G: Role-based Authorization Middleware (`requireAdmin`)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="refresh-btn"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            onClick={() => navigate('/admin/inventory')}
          >
            📦 Inventory Management
          </button>
          <button className="refresh-btn" onClick={runAdminTest} disabled={loading}>
            {loading ? 'Pinging...' : 'Test GET /api/admin/test'}
          </button>
          <button className="refresh-btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={logout}>
            Log Out
          </button>
        </div>
      </div>

      <div className="status-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="status-item">
          <span className="status-item-label">Admin Name</span>
          <span className="status-value">{user.name}</span>
          <span className="status-detail">{user.email}</span>
        </div>

        <div className="status-item">
          <span className="status-item-label">Role Verification</span>
          <div className="status-badge-row">
            <span className="pulse-dot online" />
            <span className="status-value" style={{ color: '#ff6b35' }}>
              ADMINISTRATOR
            </span>
          </div>
          <span className="status-detail">Verified by requireAdmin</span>
        </div>

        <div className="status-item">
          <span className="status-item-label">Backend Handshake</span>
          <div className="status-badge-row">
            <span className={`pulse-dot ${testResult ? 'online' : error ? 'offline' : 'warning'}`} />
            <span className="status-value">
              {testResult ? '200 OK' : error ? 'Error' : 'Pending'}
            </span>
          </div>
          <span className="status-detail">GET /api/admin/test</span>
        </div>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}

      <div className="endpoint-inspector">
        <div className="endpoint-header">
          <span className="endpoint-tag">
            <span className="method-get">GET</span>
            <span>{API_BASE}/admin/test</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Protected with authenticate &amp; requireAdmin
          </span>
        </div>
        <pre className="json-viewer">
          {testResult ? JSON.stringify(testResult, null, 2) : error ? error : '// Running authorization test...'}
        </pre>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button className="link-btn" onClick={() => navigate('/')}>
          Return to Platform Home
        </button>
      </div>
    </div>
  );
}
