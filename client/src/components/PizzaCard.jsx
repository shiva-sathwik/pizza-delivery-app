import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function PizzaCard({ pizza }) {
  const { user, navigate } = useAuth();
  const { addToCart, actionLoading } = useCart();
  const [adding, setAdding] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login?redirect=/menu');
      return;
    }

    setAdding(true);
    const result = await addToCart({
      type: 'catalog',
      pizzaId: pizza._id,
      quantity: 1
    });

    setAdding(false);
    if (result.success) {
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 2000);
    }
  };

  const handleCustomize = () => {
    navigate('/custom-pizza');
  };

  return (
    <div className="pizza-card">
      <div className="pizza-image-container">
        <img
          src={pizza.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'}
          alt={pizza.name}
          className="pizza-card-img"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80';
          }}
        />
        <div className="pizza-price-badge">₹{pizza.price}</div>
        {pizza.isAvailable ? (
          <span className="pizza-avail-tag available">Fresh Daily</span>
        ) : (
          <span className="pizza-avail-tag soldout">Sold Out</span>
        )}
      </div>

      <div className="pizza-card-body">
        <h3 className="pizza-card-title">{pizza.name}</h3>
        <p className="pizza-card-desc">{pizza.description}</p>

        <div className="pizza-spec-row">
          <div className="pizza-spec-pill">
            <span className="spec-label">Crust:</span> {pizza.base}
          </div>
          <div className="pizza-spec-pill">
            <span className="spec-label">Sauce:</span> {pizza.sauce}
          </div>
          <div className="pizza-spec-pill">
            <span className="spec-label">Cheese:</span> {pizza.cheese}
          </div>
        </div>

        {pizza.vegetables && pizza.vegetables.length > 0 && (
          <div className="pizza-toppings-wrap">
            <span className="toppings-title">Toppings:</span>
            <div className="topping-chips">
              {pizza.vegetables.map((veg, i) => (
                <span key={i} className="topping-chip">
                  🌱 {veg}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pizza-card-actions">
          <button
            type="button"
            className={`pizza-btn add-btn ${addedNotice ? 'btn-success' : ''}`}
            onClick={handleAddToCart}
            disabled={!pizza.isAvailable || adding || actionLoading}
          >
            {addedNotice ? '✓ Added to Cart!' : adding ? 'Adding...' : '🛒 Add to Cart'}
          </button>

          <button
            type="button"
            className="pizza-btn customize-btn"
            onClick={handleCustomize}
            title="Create your own custom pizza"
          >
            ⚙️ Custom Builder
          </button>
        </div>
      </div>
    </div>
  );
}
