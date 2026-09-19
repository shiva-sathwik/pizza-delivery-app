import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminLoginPage() {
  const { adminLogin, navigate } = useAuth();
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
      return setError('Admin email and password are required');
    }

    setLoading(true);
    const result = await adminLogin(formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      navigate('/admin/test');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-card card admin-theme-card">
      <div className="auth-header">
        <div className="admin-badge-icon">🛡️</div>
        <h2>Administrator Portal</h2>
        <p className="admin-notice">
          RESTRICTED AREA &bull; Unauthorized access attempts are logged
        </p>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="admin-email">Admin Email</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            className="form-input"
            placeholder="admin@pizzaflow.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-password">Admin Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="submit-btn admin-btn" disabled={loading}>
          {loading ? 'Authenticating Admin...' : 'Log In as Administrator'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Not an administrator?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Return to User Login
          </button>
        </p>
      </div>
    </div>
  );
}
