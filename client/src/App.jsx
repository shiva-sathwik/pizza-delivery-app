import { useState, useEffect, useCallback } from 'react';

function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  // Backend API URL from environment or default port 5000
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
    <div className="app-container">
      {/* Header Bar */}
      <header className="header">
        <div className="brand-badge">
          <div className="brand-icon" aria-hidden="true">🍕</div>
          <div className="brand-info">
            <h1>PizzaFlow</h1>
            <p>Delivery &amp; Inventory Management Platform</p>
          </div>
        </div>
        <div className="phase-pill">
          Step 3: Foundation
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-tag">
          <span>⚡</span> Full-Stack Internship Architecture
        </div>
        <h2 className="hero-title">
          Robust Foundation for <span className="hero-highlight">Scalable Pizza Logistics</span>
        </h2>
        <p className="hero-subtitle">
          Engineered with React, Node.js, Express, and MongoDB. Real-time connectivity verified and primed for module expansion.
        </p>
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

          {/* CORS & Network Status */}
          <div className="status-item">
            <span className="status-item-label">CORS Pipeline</span>
            <div className="status-badge-row">
              <span className={`pulse-dot ${isConnected ? 'online' : 'warning'}`} />
              <span className="status-value">
                {isConnected ? 'Authorized' : 'Checking'}
              </span>
            </div>
            <span className="status-detail">
              Client &harr; Server handshake OK
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
            <span>⚙️</span> Foundation Tech Stack
          </h3>
          <div className="tech-list">
            <div className="tech-item">
              <span className="tech-name"><span>⚛️</span> React.js (Vite)</span>
              <span className="tech-role">Frontend Client</span>
            </div>
            <div className="tech-item">
              <span className="tech-name"><span>🟢</span> Node.js &amp; Express</span>
              <span className="tech-role">REST API Server</span>
            </div>
            <div className="tech-item">
              <span className="tech-name"><span>🍃</span> MongoDB &amp; Mongoose</span>
              <span className="tech-role">Database &amp; ODM</span>
            </div>
            <div className="tech-item">
              <span className="tech-name"><span>🛡️</span> CORS &amp; Dotenv</span>
              <span className="tech-role">Security &amp; Config</span>
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
            <div className="roadmap-item">
              <span className="roadmap-status-dot pending" />
              <span>Step 4: User Authentication &amp; Email Verification</span>
              <span className="roadmap-tag upcoming">Upcoming</span>
            </div>
            <div className="roadmap-item">
              <span className="roadmap-status-dot pending" />
              <span>Step 5: Pizza Catalog &amp; Custom Pizza Builder</span>
              <span className="roadmap-tag upcoming">Upcoming</span>
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

      {/* Footer */}
      <footer className="footer">
        <p>
          Pizza Delivery &amp; Inventory Management App &bull; Built with <span>React &amp; Express</span> &bull; Step 3 Foundation
        </p>
      </footer>
    </div>
  );
}

export default App;
