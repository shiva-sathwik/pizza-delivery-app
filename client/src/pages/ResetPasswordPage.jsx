import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const { navigate } = useAuth();
  const [token, setToken] = useState('');
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('No password reset token was detected in the URL. Please verify the link from your email.');
    }
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      return setError('Reset token is missing');
    }
    if (formData.password.length < 6) {
      return setError('New password must be at least 6 characters');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: formData.password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(data.message || 'Password has been reset successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card card">
      <div className="auth-header">
        <div className="auth-icon">🛡️</div>
        <h2>Set New Password</h2>
        <p>Choose a secure password for your account</p>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}
      {success && (
        <div className="alert-banner alert-success">
          <span>✅</span>
          <div>
            <strong>Success!</strong>
            <p>{success}</p>
          </div>
        </div>
      )}

      {!success ? (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New Password (min 6 characters)</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={!token}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={!token}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading || !token}>
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <button type="button" className="submit-btn" onClick={() => navigate('/login')}>
            Proceed to Login
          </button>
        </div>
      )}

      <div className="auth-footer">
        <p>
          Need assistance?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Return to Login
          </button>
        </p>
      </div>
    </div>
  );
}
