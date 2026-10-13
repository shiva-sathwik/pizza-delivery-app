import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

const CATEGORIES = [
  { id: 'all', label: 'All Ingredients', icon: '📋' },
  { id: 'base', label: 'Bases & Crusts', icon: '🍞' },
  { id: 'sauce', label: 'Sauces', icon: '🍅' },
  { id: 'cheese', label: 'Cheeses', icon: '🧀' },
  { id: 'vegetable', label: 'Vegetables & Toppings', icon: '🥦' }
];

export default function AdminInventoryPage() {
  const { user, navigate } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Track inline edits per item: { [id]: { quantity, threshold } }
  const [editedValues, setEditedValues] = useState({});
  // Track save status per item: { [id]: boolean }
  const [savingIds, setSavingIds] = useState({});
  // Row-level feedback messages: { [id]: { type: 'success' | 'error', text: string } }
  const [rowFeedback, setRowFeedback] = useState({});

  // Fetch full inventory from backend
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/inventory`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: Failed to load inventory`);
      }

      setInventory(data.inventory || []);

      // Initialize edit buffer with server values
      const initialEdits = {};
      (data.inventory || []).forEach(item => {
        initialEdits[item._id] = {
          quantity: item.quantity,
          threshold: item.threshold
        };
      });
      setEditedValues(initialEdits);
    } catch (err) {
      console.error('[AdminInventory] Fetch error:', err.message);
      setError(err.message || 'Unable to retrieve inventory data from backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchInventory();
    }
  }, [user, fetchInventory]);

  // Handle local quantity or threshold change
  const handleValueChange = (id, field, value) => {
    const numValue = value === '' ? '' : Number(value);
    setEditedValues(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: numValue
      }
    }));

    // Clear feedback when user resumes typing
    if (rowFeedback[id]) {
      setRowFeedback(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Increment / Decrement Quantity
  const handleQuantityStep = (id, step) => {
    const current = editedValues[id]?.quantity ?? 0;
    const nextVal = Math.max(0, (typeof current === 'number' ? current : 0) + step);
    handleValueChange(id, 'quantity', nextVal);
  };

  // Save changes for a single item
  const handleSaveItem = async item => {
    const currentEdits = editedValues[item._id] || {};
    const targetQty = currentEdits.quantity !== '' ? Number(currentEdits.quantity) : item.quantity;
    const targetThreshold = currentEdits.threshold !== '' ? Number(currentEdits.threshold) : item.threshold;

    // Client-side pre-validation
    if (isNaN(targetQty) || targetQty < 0) {
      setRowFeedback(prev => ({
        ...prev,
        [item._id]: { type: 'error', text: 'Quantity cannot be negative' }
      }));
      return;
    }

    if (isNaN(targetThreshold) || targetThreshold < 0) {
      setRowFeedback(prev => ({
        ...prev,
        [item._id]: { type: 'error', text: 'Threshold cannot be negative' }
      }));
      return;
    }

    setSavingIds(prev => ({ ...prev, [item._id]: true }));
    setRowFeedback(prev => {
      const next = { ...prev };
      delete next[item._id];
      return next;
    });

    try {
      const response = await fetch(`${API_BASE}/inventory/${item._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          quantity: targetQty,
          threshold: targetThreshold
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update inventory item');
      }

      // Update main inventory state
      setInventory(prev =>
        prev.map(inv => (inv._id === item._id ? data.inventory : inv))
      );

      // Keep edit buffer in sync
      setEditedValues(prev => ({
        ...prev,
        [item._id]: {
          quantity: data.inventory.quantity,
          threshold: data.inventory.threshold
        }
      }));

      setRowFeedback(prev => ({
        ...prev,
        [item._id]: { type: 'success', text: 'Updated!' }
      }));

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setRowFeedback(prev => {
          const next = { ...prev };
          if (next[item._id]?.type === 'success') {
            delete next[item._id];
          }
          return next;
        });
      }, 3000);
    } catch (err) {
      setRowFeedback(prev => ({
        ...prev,
        [item._id]: { type: 'error', text: err.message }
      }));
    } finally {
      setSavingIds(prev => ({ ...prev, [item._id]: false }));
    }
  };

  // Helper to derive status based on current edits
  const getItemStatus = useCallback(item => {
    const edits = editedValues[item._id];
    const qty = edits && edits.quantity !== '' && !isNaN(edits.quantity)
      ? Number(edits.quantity)
      : item.quantity;
    const thr = edits && edits.threshold !== '' && !isNaN(edits.threshold)
      ? Number(edits.threshold)
      : item.threshold;

    if (qty === 0) return 'Out of Stock';
    if (qty <= thr) return 'Low Stock';
    return 'In Stock';
  }, [editedValues]);

  // Stock status pill styling helper
  const getStatusBadgeClass = status => {
    switch (status) {
      case 'Out of Stock':
        return 'stock-badge-out';
      case 'Low Stock':
        return 'stock-badge-low';
      case 'In Stock':
      default:
        return 'stock-badge-in';
    }
  };

  // Category pill badge styling helper
  const getCategoryBadgeClass = category => {
    switch (category) {
      case 'base':
        return 'cat-badge-base';
      case 'sauce':
        return 'cat-badge-sauce';
      case 'cheese':
        return 'cat-badge-cheese';
      case 'vegetable':
        return 'cat-badge-veg';
      default:
        return 'cat-badge-default';
    }
  };

  // Filtered Inventory List
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const currentStatus = getItemStatus(item);
        if (currentStatus !== statusFilter) {
          return false;
        }
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = item.item.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [inventory, activeCategory, statusFilter, searchTerm, getItemStatus]);

  // Metric aggregates
  const metrics = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    inventory.forEach(item => {
      const status = getItemStatus(item);
      if (status === 'Out of Stock') outOfStock++;
      else if (status === 'Low Stock') lowStock++;
      else inStock++;
    });

    return {
      total: inventory.length,
      inStock,
      lowStock,
      outOfStock
    };
  }, [inventory, getItemStatus]);

  // Check if an item has unsaved changes
  const hasUnsavedChanges = item => {
    const edits = editedValues[item._id];
    if (!edits) return false;
    return (
      edits.quantity !== item.quantity || edits.threshold !== item.threshold
    );
  };

  // Unauthenticated Guard
  if (!user) {
    return (
      <div className="auth-card card admin-theme-card" style={{ textAlign: 'center' }}>
        <div className="admin-badge-icon">🔒</div>
        <h2>Administrator Authentication Required</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 1.5rem' }}>
          Inventory stock management requires an authenticated administrator session.
        </p>
        <button className="submit-btn admin-btn" onClick={() => navigate('/admin/login')}>
          Go to Administrator Login
        </button>
      </div>
    );
  }

  // Non-Admin Role Guard (403 Forbidden)
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
            Your account ({user.email}) has role <code>{user.role}</code>. Only users with role <code>admin</code> are authorized to access Inventory Management.
          </p>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Backend authorization middleware strictly rejects unauthorized inventory access with HTTP 403.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
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
    <div className="inventory-page-container">
      {/* Page Header */}
      <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>📦</span>
            <div>
              <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Inventory &amp; Stock Management</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Monitor pizza ingredients, adjust quantities, configure low-stock thresholds, and track live status.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="refresh-btn"
            onClick={fetchInventory}
            disabled={loading}
            title="Reload latest inventory from backend"
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Stock'}</span>
          </button>
          <button
            className="refresh-btn"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}
            onClick={() => navigate('/admin/test')}
          >
            🛡️ Admin Console
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem' }}>
          <strong>Error Loading Inventory:</strong> {error}
          <button
            onClick={fetchInventory}
            style={{ marginLeft: '1rem', background: 'none', border: 'underline', color: 'inherit', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="inventory-metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Ingredients</span>
            <span className="metric-icon">📋</span>
          </div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-subtext">Across 4 Authoritative Categories</div>
        </div>

        <div className="metric-card in-stock-card">
          <div className="metric-header">
            <span className="metric-title">In Stock</span>
            <span className="metric-icon">🟢</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-online)' }}>
            {metrics.inStock}
          </div>
          <div className="metric-subtext">Operating above threshold</div>
        </div>

        <div className="metric-card low-stock-card">
          <div className="metric-header">
            <span className="metric-title">Low Stock Alert</span>
            <span className="metric-icon">⚠️</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-warning)' }}>
            {metrics.lowStock}
          </div>
          <div className="metric-subtext">Quantity &le; Threshold</div>
        </div>

        <div className="metric-card out-of-stock-card">
          <div className="metric-header">
            <span className="metric-title">Out of Stock</span>
            <span className="metric-icon">🚨</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-offline)' }}>
            {metrics.outOfStock}
          </div>
          <div className="metric-subtext">Quantity is 0</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="inventory-controls-card card">
        <div className="category-tabs-row">
          {CATEGORIES.map(cat => {
            const count =
              cat.id === 'all'
                ? inventory.length
                : inventory.filter(i => i.category === cat.id).length;
            return (
              <button
                key={cat.id}
                className={`category-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="category-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="search-filter-row">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search ingredient by name or category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                ✕
              </button>
            )}
          </div>

          <div className="status-filter-group">
            <span className="filter-label">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="status-select"
            >
              <option value="all">All Statuses</option>
              <option value="In Stock">In Stock Only</option>
              <option value="Low Stock">Low Stock Only</option>
              <option value="Out of Stock">Out of Stock Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table & Cards */}
      <div className="card inventory-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>⏳</span>
            <p style={{ color: 'var(--text-secondary)' }}>Loading inventory records from MongoDB...</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
            <h3 style={{ marginBottom: '0.5rem' }}>No ingredients match your criteria</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Try adjusting the category tab, clearing your search, or changing the status filter.
            </p>
            <button
              className="refresh-btn"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={() => {
                setActiveCategory('all');
                setSearchTerm('');
                setStatusFilter('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Current Stock</th>
                  <th style={{ textAlign: 'center' }}>Threshold</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => {
                  const currentEdits = editedValues[item._id] || {
                    quantity: item.quantity,
                    threshold: item.threshold
                  };
                  const status = getItemStatus(item);
                  const statusClass = getStatusBadgeClass(status);
                  const categoryClass = getCategoryBadgeClass(item.category);
                  const isSaving = savingIds[item._id];
                  const feedback = rowFeedback[item._id];
                  const isModified = hasUnsavedChanges(item);

                  return (
                    <tr key={item._id} className={isModified ? 'row-modified' : ''}>
                      {/* Item Name */}
                      <td className="item-name-cell">
                        <span className="table-item-name">{item.item}</span>
                      </td>

                      {/* Category */}
                      <td>
                        <span className={`category-pill ${categoryClass}`}>
                          {item.category.toUpperCase()}
                        </span>
                      </td>

                      {/* Derived Status */}
                      <td>
                        <span className={`stock-status-badge ${statusClass}`}>
                          <span className="status-indicator-dot" />
                          <span>{status}</span>
                        </span>
                      </td>

                      {/* Quantity Stepper & Input */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="quantity-stepper">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleQuantityStep(item._id, -1)}
                            disabled={isSaving || (currentEdits.quantity ?? 0) <= 0}
                            title="Decrease quantity by 1"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            className="stock-number-input"
                            value={currentEdits.quantity}
                            onChange={e => handleValueChange(item._id, 'quantity', e.target.value)}
                            disabled={isSaving}
                          />
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleQuantityStep(item._id, 1)}
                            disabled={isSaving}
                            title="Increase quantity by 1"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Threshold Input */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          className="stock-number-input threshold-input"
                          value={currentEdits.threshold}
                          onChange={e => handleValueChange(item._id, 'threshold', e.target.value)}
                          disabled={isSaving}
                        />
                      </td>

                      {/* Action & Feedback */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="actions-cell">
                          {feedback && (
                            <span className={`row-feedback-text ${feedback.type}`}>
                              {feedback.type === 'success' ? '✓ ' : '✗ '}
                              {feedback.text}
                            </span>
                          )}
                          <button
                            type="button"
                            className={`save-stock-btn ${isModified ? 'dirty' : ''}`}
                            onClick={() => handleSaveItem(item)}
                            disabled={isSaving || (!isModified && !feedback)}
                            title={isModified ? 'Save changes to database' : 'No changes to save'}
                          >
                            {isSaving ? 'Saving...' : isModified ? 'Save' : 'Saved'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="inventory-footer-note">
        <span>🛡️</span>
        <span>
          <strong>Admin Access Control:</strong> Modifications directly update inventory records via protected endpoints. Changes are validated to prevent negative stock and maintain data integrity.
        </span>
      </div>
    </div>
  );
}
