import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

export default function VerifyEmailPage() {
  const { navigate } = useAuth();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('No verification token provided. Please open the link directly from your confirmation email.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully! You can now log in.');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification token is invalid, expired, or has already been used.');
        }
      } catch {
        setStatus('error');
        setMessage('Failed to connect to the server to verify your email.');
      }
    };

    verifyToken();
  }, []);

  return (
    <div className="auth-card card">
      <div className="auth-header">
        <div className="auth-icon">
          {status === 'verifying' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </div>
        <h2>Email Verification</h2>
        <p>Activating your PizzaFlow customer account</p>
      </div>

      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
        {status === 'verifying' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="pulse-dot online" style={{ width: '20px', height: '20px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Validating your verification link with the server...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="alert-banner alert-success" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <span>🎉</span>
            <div>
              <strong>Account Activated!</strong>
              <p>{message}</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="alert-banner alert-error" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <span>⚠️</span>
            <div>
              <strong>Verification Failed</strong>
              <p>{message}</p>
            </div>
          </div>
        )}

        {status !== 'verifying' && (
          <button type="button" className="submit-btn" onClick={() => navigate('/login')}>
            Proceed to Login
          </button>
        )}
      </div>

      <div className="auth-footer">
        <p>
          Need a new verification link?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Sign In to Request
          </button>
        </p>
      </div>
    </div>
  );
}
