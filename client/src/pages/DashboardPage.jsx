import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, logout, navigate } = useAuth();

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
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
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
          <span className="status-detail">Normal Customer Access</span>
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
        <button className="submit-btn" style={{ flex: 1 }} onClick={() => navigate('/')}>
          View Platform Foundation
        </button>
        {user.role === 'admin' && (
          <button
            className="submit-btn admin-btn"
            style={{ flex: 1 }}
            onClick={() => navigate('/admin/test')}
          >
            Go to Admin Test Endpoint
          </button>
        )}
      </div>
    </div>
  );
}
