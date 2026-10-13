import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { API_BASE } from '../services/api';

export default function HomePage() {
  const { user, navigate } = useAuth();
  const { addToCart } = useCart();

  const [popularPizza, setPopularPizza] = useState(null);
  const [popularOrderCount, setPopularOrderCount] = useState(0);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        setLoadingPopular(true);
        const res = await fetch(`${API_BASE}/pizzas/popular`);
        const json = await res.json();
        if (json.success && json.data) {
          setPopularPizza(json.data);
          setPopularOrderCount(json.orderCount || 0);
        } else {
          setPopularPizza(null);
        }
      } catch (err) {
        console.error('Failed to load popular pizza on homepage:', err);
      } finally {
        setLoadingPopular(false);
      }
    };

    fetchPopular();
  }, []);

  const handleOrderPopular = async () => {
    if (!popularPizza) return;
    try {
      const result = await addToCart({
        type: 'catalog',
        pizzaId: popularPizza._id,
        name: popularPizza.name,
        price: popularPizza.price,
        image: popularPizza.image,
        base: popularPizza.base || 'Thin Crust',
        sauce: popularPizza.sauce || 'Tomato Basil',
        cheese: popularPizza.cheese || 'Mozzarella',
        vegetables: popularPizza.vegetables || ['Basil']
      });
      if (result && result.success) {
        setAddedNotice(true);
        setTimeout(() => {
          setAddedNotice(false);
          navigate('/cart');
        }, 700);
      } else {
        navigate('/menu');
      }
    } catch {
      navigate('/menu');
    }
  };

  return (
    <div className="storefront-page">
      {/* Hero Storefront Section */}
      <section className="storefront-hero">
        <div className="hero-badge-pill">
          <span className="hero-badge-dot"></span>
          Freshly Baked &bull; Delivered Hot &bull; 100% Real Cheese
        </div>

        <h1 className="storefront-headline">
          Artisan Pizzas, <span className="highlight-text">Crafted With Passion</span>
        </h1>

        <p className="storefront-subheadline">
          Choose from authentic chef-curated recipes or build your own custom pizza with slow-fermented crusts, rich San Marzano sauces, and farm-fresh toppings.
        </p>

        <div className="storefront-cta-group">
          <button
            type="button"
            className="hero-cta-btn primary"
            onClick={() => navigate('/menu')}
          >
            🍕 Order Now
          </button>
          <button
            type="button"
            className="hero-cta-btn hero-cta-secondary"
            onClick={() => navigate('/custom-pizza')}
          >
            ✨ Build Your Pizza
          </button>
          {!user && (
            <button
              type="button"
              className="hero-cta-btn hero-cta-ghost"
              onClick={() => navigate('/login')}
            >
              Sign In to Order
            </button>
          )}
        </div>

        <div className="storefront-trust-bar">
          <div className="trust-item">
            <span>🔥</span> Stone-Oven Baked
          </div>
          <div className="trust-item">
            <span>🧀</span> 100% Premium Mozzarella
          </div>
          <div className="trust-item">
            <span>⚡</span> Real-time Live Tracking
          </div>
          <div className="trust-item">
            <span>💳</span> Secure Razorpay Payments
          </div>
        </div>
      </section>

      {/* Trending / Customer Recommendation Section */}
      <section className="storefront-section">
        <div className="section-header">
          <span className="section-badge">🔥 Customer Choice</span>
          <h2>Trending &amp; Popular Picks</h2>
          <p className="section-desc">
            Ordered the most by pizza lovers this week. Handcrafted with authentic ingredients.
          </p>
        </div>

        <div className="trending-showcase-card">
          {loadingPopular ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading popular recommendation...
            </div>
          ) : popularPizza ? (
            <div className="trending-content-grid">
              <div className="trending-image-box">
                <img
                  src={popularPizza.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80'}
                  alt={popularPizza.name}
                  className="trending-pizza-img"
                />
                <span className="trending-badge">
                  ⭐ Top Pick &bull; {popularOrderCount} orders
                </span>
              </div>
              <div className="trending-info-box">
                <div className="trending-header-row">
                  <div>
                    <div className="trending-category">Artisan Favorite</div>
                    <h3 className="trending-title">{popularPizza.name}</h3>
                  </div>
                  <span className="trending-orders-pill">
                    🔥 Trending Pick
                  </span>
                </div>

                <p className="trending-desc">
                  {popularPizza.description || 'Our highest-rated customer favorite, handcrafted with authentic ingredients and stone-baked to perfection.'}
                </p>

                <div className="trending-specs-grid">
                  <div className="spec-item">
                    <span className="spec-label">Crust</span>
                    <span className="spec-value">🌾 {popularPizza.base || 'Thin Crust'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Sauce</span>
                    <span className="spec-value">🍅 {popularPizza.sauce || 'Tomato Basil'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Cheese</span>
                    <span className="spec-value">🧀 {popularPizza.cheese || 'Mozzarella'}</span>
                  </div>
                </div>

                {Array.isArray(popularPizza.vegetables) && popularPizza.vegetables.length > 0 && (
                  <div className="trending-ingredient-tags">
                    {popularPizza.vegetables.map((v, i) => (
                      <span key={i} className="ing-tag">🌿 {v}</span>
                    ))}
                  </div>
                )}

                <div className="trending-action-row">
                  <div className="trending-price-display">
                    <span className="price-label">Price</span>
                    <span className="price-number">₹{popularPizza.price}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="trending-order-btn"
                      style={{
                        background: addedNotice ? '#10b981' : undefined
                      }}
                      onClick={handleOrderPopular}
                    >
                      {addedNotice ? '✓ Added to Cart!' : '🛒 Order This Pizza Now'}
                    </button>
                    <button
                      type="button"
                      className="hero-cta-btn hero-cta-secondary"
                      onClick={() => navigate('/menu')}
                    >
                      View Full Menu &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="recommendation-card-empty">
              <span className="empty-icon">🍕</span>
              <h3>Explore Our Signature Artisan Menu</h3>
              <p style={{ maxWidth: '520px', margin: '0.5rem auto 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Every pizza is baked fresh to order. Browse our classic Margheritas, fiery Pepperonis, and fresh veggie feasts.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="hero-cta-btn primary"
                  onClick={() => navigate('/menu')}
                >
                  Browse Menu Catalog
                </button>
                <button
                  type="button"
                  className="hero-cta-btn hero-cta-secondary"
                  onClick={() => navigate('/custom-pizza')}
                >
                  Launch Pizza Builder
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3 Core Value Pillars */}
      <section className="storefront-pillars-grid">
        <div className="pillar-card">
          <div className="pillar-icon">🌾</div>
          <h3>Pure Artisanal Crusts</h3>
          <p>
            Slow-fermented doughs prepared fresh daily, from crisp Thin Crust to hearty Stuffed &amp; Multigrain options.
          </p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon">🍅</div>
          <h3>Authentic Sauces &amp; Cheeses</h3>
          <p>
            Real San Marzano plum tomatoes, rich Cheddar, fresh Ricotta, and 100% melt-in-mouth Mozzarella.
          </p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon">⚡</div>
          <h3>Live Kitchen-to-Door Tracking</h3>
          <p>
            Watch your order progress from received to baking in the kitchen and dispatched out for delivery.
          </p>
        </div>
      </section>

      {/* Call to action banner */}
      <section className="storefront-cta-banner">
        <div className="banner-content">
          <h2>Ready for extraordinary pizza?</h2>
          <p>Explore chef-crafted artisan pizzas or create your custom masterpiece in seconds.</p>
        </div>
        <div className="banner-actions">
          <button
            type="button"
            className="hero-cta-btn primary"
            onClick={() => navigate('/menu')}
          >
            Order Now
          </button>
          <button
            type="button"
            className="hero-cta-btn hero-cta-secondary"
            onClick={() => navigate('/custom-pizza')}
          >
            Custom Builder
          </button>
        </div>
      </section>
    </div>
  );
}
