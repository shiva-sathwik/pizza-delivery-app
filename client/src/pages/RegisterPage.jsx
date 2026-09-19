import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, navigate } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!formData.name.trim()) {
      return setError('Full name is required');
    }
    if (!formData.email.trim()) {
      return setError('Email is required');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    const result = await register(formData.name, formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      setSuccessMessage(result.message || 'Registration successful! Please check your email to verify your account.');
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-card card">
      <div className="auth-header">
        <div className="auth-icon">🍕</div>
        <h2>Create an Account</h2>
        <p>Join PizzaFlow to order handcrafted artisanal pizzas</p>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}
      {successMessage && (
        <div className="alert-banner alert-success">
          <span>📧</span>
          <div>
            <strong>Action Required:</strong>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            name="name"
            type="text"
            className="form-input"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-input"
            placeholder="jane@example.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password (min 6 characters)</label>
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

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Already have an account?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Log In
          </button>
        </p>
      </div>
    </div>
  );
}
