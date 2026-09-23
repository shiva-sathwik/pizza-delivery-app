import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import PizzaCard from '../components/PizzaCard';

export default function MenuPage() {
  const { navigate } = useAuth();
  const [pizzas, setPizzas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrust, setSelectedCrust] = useState('ALL');

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/pizzas`);
        if (!res.ok) {
          throw new Error(`Failed to load catalog (status ${res.status})`);
        }
        const data = await res.json();
        setPizzas(data.data || []);
      } catch (err) {
        console.error('Catalog fetch error:', err);
        setError(err.message || 'Could not load pizzas. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [API_BASE]);

  // Extract unique crusts for filter pills
  const crustOptions = useMemo(() => {
    const crusts = new Set();
    pizzas.forEach(p => {
      if (p.base) crusts.add(p.base);
    });
    return ['ALL', ...Array.from(crusts)];
  }, [pizzas]);

  // Filtered pizzas
  const filteredPizzas = useMemo(() => {
    return pizzas.filter(pizza => {
      const matchesSearch =
        !searchQuery ||
        pizza.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pizza.description && pizza.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pizza.vegetables && pizza.vegetables.some(v => v.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCrust =
        selectedCrust === 'ALL' || pizza.base === selectedCrust;

      return matchesSearch && matchesCrust;
    });
  }, [pizzas, searchQuery, selectedCrust]);

  return (
    <div className="menu-page">
      {/* Header Section */}
      <section className="menu-hero">
        <div className="hero-tag">
          <span>🍕</span> Handcrafted Artisan Pizzas
        </div>
        <h1 className="menu-title">
          Stone-Baked Crusts, <span className="hero-highlight">Authentic Flavors</span>
        </h1>
        <p className="menu-subtitle">
          Explore our handcrafted signature creations prepared fresh with premium San Marzano tomatoes, pure cheeses, and crisp market vegetables.
        </p>

        {/* Custom Pizza Builder CTA Banner */}
        <div className="builder-promo-banner">
          <div className="promo-text">
            <h4>Want your own recipe?</h4>
            <p>Choose your favorite crust, sauce, cheese, and toppings from scratch with live price calculation.</p>
          </div>
          <button
            type="button"
            className="submit-btn promo-btn"
            onClick={() => navigate('/custom-pizza')}
          >
            ✨ Build Custom Pizza
          </button>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="menu-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by pizza name, topping, or style..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {crustOptions.length > 1 && (
          <div className="filter-pills">
            {crustOptions.map((crust) => (
              <button
                key={crust}
                type="button"
                className={`filter-pill ${selectedCrust === crust ? 'active' : ''}`}
                onClick={() => setSelectedCrust(crust)}
              >
                {crust === 'ALL' ? 'All Styles' : crust}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Catalog View */}
      {loading ? (
        <div className="menu-loading-grid">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="pizza-skeleton-card">
              <div className="skeleton-img" />
              <div className="skeleton-content">
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert-banner alert-error" style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <span>⚠️</span>
          <div>
            <strong>Unable to Load Menu</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : filteredPizzas.length === 0 ? (
        <div className="menu-empty-card">
          <span className="empty-icon">🍕</span>
          <h3>No Pizzas Found</h3>
          <p>We couldn't find any pizzas matching "{searchQuery}".</p>
          <button
            type="button"
            className="submit-btn"
            style={{ marginTop: '1rem', width: 'auto' }}
            onClick={() => {
              setSearchQuery('');
              setSelectedCrust('ALL');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="pizza-grid">
          {filteredPizzas.map((pizza) => (
            <PizzaCard key={pizza._id} pizza={pizza} />
          ))}
        </div>
      )}
    </div>
  );
}
