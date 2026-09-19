import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, navigate } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password) {
      return setError('Please enter both email and password');
    }

    setLoading(true);
    const result = await login(formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-card card">
      <div className="auth-header">
        <div className="auth-icon">🔐</div>
        <h2>Welcome Back</h2>
        <p>Log in to your PizzaFlow account</p>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <div className="label-row">
            <label htmlFor="password">Password</label>
            <button
              type="button"
              className="link-btn-subtle"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot Password?
            </button>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Logging In...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Don't have an account yet?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/register')}>
            Register Now
          </button>
        </p>
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <button
            type="button"
            className="link-btn-subtle"
            style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
            onClick={() => navigate('/admin/login')}
          >
            🛡️ Switch to Administrator Login
          </button>
        </div>
      </div>
    </div>
  );
}
