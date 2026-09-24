import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import AdminTestPage from './pages/AdminTestPage';
import AdminInventoryPage from './pages/AdminInventoryPage';
import MenuPage from './pages/MenuPage';
import CustomPizzaPage from './pages/CustomPizzaPage';
import CartPage from './pages/CartPage';

// Navigation Bar Component with Real-time Auth Status & Cart Badge
function Navbar() {
  const { user, logout, currentPath, navigate } = useAuth();
  const { cart } = useCart();
  const currentBase = currentPath.split('?')[0];

  return (
    <nav className="navbar" aria-label="Main Navigation">
      <button className="nav-brand" onClick={() => navigate('/')}>
        <span className="nav-brand-logo" aria-hidden="true">🍕</span>
        <span className="nav-brand-name">PizzaFlow</span>
      </button>

      <div className="nav-links">
        <button
          className={`nav-btn ${currentBase === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          Home
        </button>

        <button
          className={`nav-btn ${currentBase === '/menu' ? 'active' : ''}`}
          onClick={() => navigate('/menu')}
        >
          Menu
        </button>

        <button
          className={`nav-btn ${currentBase === '/custom-pizza' ? 'active' : ''}`}
          onClick={() => navigate('/custom-pizza')}
        >
          Custom Builder
        </button>

        <button
          className={`nav-btn nav-cart-btn ${currentBase === '/cart' ? 'active' : ''}`}
          onClick={() => navigate('/cart')}
        >
          <span>🛒 Cart</span>
          {cart && cart.totalItems > 0 && (
            <span className="nav-cart-badge">{cart.totalItems}</span>
          )}
        </button>

        {user ? (
          <>
            <button
              className={`nav-btn ${currentBase === '/dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </button>
            {user.role === 'admin' && (
              <>
                <button
                  className={`nav-btn ${currentBase === '/admin/inventory' ? 'active' : ''}`}
                  style={{ color: '#fb923c' }}
                  onClick={() => navigate('/admin/inventory')}
                >
                  📦 Inventory
                </button>
                <button
                  className={`nav-btn ${currentBase === '/admin/test' ? 'active' : ''}`}
                  style={{ color: '#f87171' }}
                  onClick={() => navigate('/admin/test')}
                >
                  Admin Console
                </button>
              </>
            )}
            <div className="user-profile-pill" onClick={() => navigate('/dashboard')}>
              <span>👤</span>
              <span>{user.name}</span>
              <span className={`role-tag ${user.role}`}>{user.role}</span>
            </div>
            <button className="nav-btn" onClick={logout}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <button
              className={`nav-btn ${currentBase === '/login' ? 'active' : ''}`}
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
            <button
              className={`nav-btn nav-btn-primary ${currentBase === '/register' ? 'active' : ''}`}
              onClick={() => navigate('/register')}
            >
              Register
            </button>
            <button
              className={`nav-btn ${currentBase === '/admin/login' ? 'active' : ''}`}
              style={{ color: '#fca5a5', border: '1px solid rgba(230,57,70,0.3)' }}
              onClick={() => navigate('/admin/login')}
            >
              🛡️ Admin
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

// Foundation Home View (Step 3 + Step 4 status)
function HomeView() {
  const { navigate } = useAuth();
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const response = await fetch(`${API_URL}/health`);
      const elapsed = Math.round(performance.now() - startTime);
      setLatency(elapsed);

      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }

      const data = await response.json();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to connect to backend:', err);
      setError(err.message || 'Could not connect to the backend server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const isConnected = !!healthData && healthData.status === 'online';

  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-tag">
          <span>⚡</span> Full-Stack Internship Architecture
        </div>
        <h2 className="hero-title">
          Robust Foundation for <span className="hero-highlight">Scalable Pizza Logistics</span>
        </h2>
        <p className="hero-subtitle">
          Engineered with React, Node.js, Express, and MongoDB. Secure JWT authentication, role authorization, and email verification active.
        </p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="submit-btn" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }} onClick={() => navigate('/menu')}>
            🍕 Browse Pizza Menu
          </button>
          <button className="submit-btn" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }} onClick={() => navigate('/custom-pizza')}>
            ✨ Custom Pizza Builder
          </button>
          <button className="submit-btn admin-btn" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }} onClick={() => navigate('/admin/login')}>
            🛡️ Admin Console
          </button>
        </div>
      </section>

      {/* Backend Health & Connectivity Monitor */}
      <section className="card status-panel" aria-labelledby="status-title">
        <div className="panel-header">
          <div className="panel-title-group">
            <h2 id="status-title">Live System Connectivity</h2>
            <p>Direct communication monitor between React client and Express API</p>
          </div>
          <button 
            id="refresh-health-btn"
            className="refresh-btn" 
            onClick={checkHealth} 
            disabled={loading}
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Checking...' : 'Ping API'}</span>
          </button>
        </div>

        <div className="status-grid">
          {/* Backend Express Status */}
          <div className="status-item">
            <span className="status-item-label">Express Backend</span>
            <div className="status-badge-row">
              <span className={`pulse-dot ${isConnected ? 'online' : 'offline'}`} />
              <span className="status-value">
                {loading ? 'Pinging...' : isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
            <span className="status-detail">
              {isConnected ? `Port 5000 • ${latency}ms latency` : error || 'No connection'}
            </span>
          </div>

          {/* Database MongoDB Status */}
          <div className="status-item">
            <span className="status-item-label">MongoDB &amp; Mongoose</span>
            <div className="status-badge-row">
              <span className={`pulse-dot ${healthData?.database?.connected ? 'online' : 'warning'}`} />
              <span className="status-value">
                {loading ? 'Checking...' : healthData?.database?.status ? healthData.database.status.toUpperCase() : 'STANDBY'}
              </span>
            </div>
            <span className="status-detail">
              {healthData?.database?.connected 
                ? 'Active connection established' 
                : 'Mongoose configured (URI standby)'}
            </span>
          </div>

          {/* Authentication System Status */}
          <div className="status-item">
            <span className="status-item-label">Auth Engine</span>
            <div className="status-badge-row">
              <span className="pulse-dot online" />
              <span className="status-value">Active</span>
            </div>
            <span className="status-detail">
              JWT &bull; Bcrypt &bull; Nodemailer
            </span>
          </div>

          {/* Last Sync Timestamp */}
          <div className="status-item">
            <span className="status-item-label">Last Synchronized</span>
            <div className="status-badge-row">
              <span className="status-value">
                {lastChecked || 'Pending'}
              </span>
            </div>
            <span className="status-detail">
              {healthData?.uptime !== undefined ? `Server Uptime: ${healthData.uptime}s` : 'Awaiting heartbeat'}
            </span>
          </div>
        </div>

        {/* Live Payload Inspector */}
        <div className="endpoint-inspector">
          <div className="endpoint-header">
            <div className="endpoint-tag">
              <span className="method-get">GET</span>
              <span>{API_URL}/health</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Response Status: {isConnected ? '200 OK' : error ? 'Error' : 'Pending'}
            </span>
          </div>
          <pre className="json-viewer">
            {healthData ? JSON.stringify(healthData, null, 2) : error ? `Error: ${error}` : '// Awaiting server response...'}
          </pre>
        </div>
      </section>

      {/* Two-Column Grid: Architecture Stack & Project Roadmap */}
      <div className="details-grid">
        {/* Architecture Specs */}
        <section className="card" aria-labelledby="tech-stack-title">
          <h3 id="tech-stack-title" className="section-card-title">
            <span>⚙️</span> Authentication &amp; Platform Stack
          </h3>
          <div className="tech-list">
            <div className="tech-item">
              <span className="tech-name"><span>🔐</span> JWT &amp; HTTP-Only Cookie</span>
              <span className="tech-role">Stateless Auth</span>
            </div>
            <div className="tech-item">
              <span className="tech-name"><span>🛡️</span> Bcrypt.js Hashing</span>
              <span className="tech-role">Salted Passwords</span>
            </div>
            <div className="tech-item">
              <span className="tech-name"><span>📧</span> Nodemailer Service</span>
              <span className="tech-role">Email Verification</span>
            </div>
            <div className="tech-item">
              <span className="tech-name"><span>👑</span> Role Authorization</span>
              <span className="tech-role">User / Admin Guard</span>
            </div>
          </div>
        </section>

        {/* Internship Roadmap */}
        <section className="card" aria-labelledby="roadmap-title">
          <h3 id="roadmap-title" className="section-card-title">
            <span>🗺️</span> Implementation Milestones
          </h3>
          <div className="roadmap-list">
            <div className="roadmap-item current">
              <span className="roadmap-status-dot active" />
              <span>Step 3: Core Foundation Setup</span>
              <span className="roadmap-tag ready">Complete</span>
            </div>
            <div className="roadmap-item current">
              <span className="roadmap-status-dot active" />
              <span>Step 4: User &amp; Admin Authentication (4A-4I)</span>
              <span className="roadmap-tag ready">Complete</span>
            </div>
            <div className="roadmap-item current">
              <span className="roadmap-status-dot active" />
              <span>Step 5: Pizza Catalog &amp; Custom Pizza Builder &amp; Cart</span>
              <span className="roadmap-tag ready">Complete</span>
            </div>
            <div className="roadmap-item">
              <span className="roadmap-status-dot pending" />
              <span>Step 6: Orders &amp; Razorpay Payments</span>
              <span className="roadmap-tag upcoming">Upcoming</span>
            </div>
            <div className="roadmap-item">
              <span className="roadmap-status-dot pending" />
              <span>Step 7: Inventory Management &amp; Stock Alerts</span>
              <span className="roadmap-tag upcoming">Upcoming</span>
            </div>
            <div className="roadmap-item">
              <span className="roadmap-status-dot pending" />
              <span>Step 8: Real-Time Order Tracking (Socket.IO)</span>
              <span className="roadmap-tag upcoming">Upcoming</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// Router & Route Dispatcher
function AppContent() {
  const { currentPath } = useAuth();
  const basePath = currentPath.split('?')[0];

  const renderRoute = () => {
    switch (basePath) {
      case '/menu':
        return <MenuPage />;
      case '/custom-pizza':
        return <CustomPizzaPage />;
      case '/cart':
        return <CartPage />;
      case '/login':
        return <LoginPage />;
      case '/register':
        return <RegisterPage />;
      case '/admin/login':
        return <AdminLoginPage />;
      case '/forgot-password':
        return <ForgotPasswordPage />;
      case '/reset-password':
        return <ResetPasswordPage />;
      case '/verify-email':
        return <VerifyEmailPage />;
      case '/dashboard':
        return <DashboardPage />;
      case '/admin/inventory':
        return <AdminInventoryPage />;
      case '/admin/test':
        return <AdminTestPage />;
      case '/':
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      <main>
        {renderRoute()}
      </main>
      <footer className="footer">
        <p>
          Pizza Delivery &amp; Inventory Management Platform &bull; Step 6 Inventory &amp; Admin Foundation &bull; Built with <span>React &amp; Express</span>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}
