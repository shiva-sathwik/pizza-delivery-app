import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

export default function ForgotPasswordPage() {
  const { navigate } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      return setError('Please provide your email address');
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      setMessage(data.message || 'If an account with that email exists, a reset link has been dispatched.');
    } catch (err) {
      setError(err.message || 'Server error processing request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card card">
      <div className="auth-header">
        <div className="auth-icon">🔑</div>
        <h2>Reset Password</h2>
        <p>Enter your email to receive a secure password reset link</p>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}
      {message && (
        <div className="alert-banner alert-success">
          <span>📬</span>
          <div>
            <strong>Check Your Inbox:</strong>
            <p>{message}</p>
          </div>
        </div>
      )}

      {!message ? (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Registered Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Sending Link...' : 'Send Reset Link'}
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Did not receive the email? Check your spam folder or try again.
          </p>
          <button type="button" className="refresh-btn" onClick={() => setMessage(null)}>
            Send Another Request
          </button>
        </div>
      )}

      <div className="auth-footer">
        <p>
          Remember your password?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
}
