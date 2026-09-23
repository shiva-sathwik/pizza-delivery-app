import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Default fallback options if network is slow
const DEFAULT_INGREDIENTS = {
  bases: [
    { id: 'thin-crust', name: 'Thin Crust', price: 120, description: 'Light, crispy artisan base baked to golden perfection' },
    { id: 'cheese-burst', name: 'Cheese Burst', price: 180, description: 'Crust overflowing with molten hot mozzarella' },
    { id: 'pan-crust', name: 'Pan Crust', price: 140, description: 'Fluffy, thick crust pan-baked with golden edges' },
    { id: 'multigrain-crust', name: 'Multigrain Crust', price: 160, description: 'Wholesome blend of oats, rye, and whole wheat' },
    { id: 'gluten-free-crust', name: 'Gluten-Free Crust', price: 170, description: 'Dedicated gluten-free recipe without compromising crunch' }
  ],
  sauces: [
    { id: 'san-marzano', name: 'Classic San Marzano Tomato', price: 40, description: 'Slow-simmered Italian plum tomatoes with fresh basil' },
    { id: 'spicy-peri-peri', name: 'Spicy Peri-Peri', price: 50, description: 'Fiery bird\'s eye chili infusion with smoky paprika' },
    { id: 'garlic-herb', name: 'Creamy Garlic & Herb', price: 60, description: 'Rich roasted garlic white sauce infused with oregano' },
    { id: 'smoky-bbq', name: 'Smoky Barbeque', price: 55, description: 'Sweet hickory-smoked barbeque sauce with molasses' },
    { id: 'basil-pesto', name: 'Basil Pesto', price: 65, description: 'Aromatic genovese basil, pine nuts, and extra virgin olive oil' }
  ],
  cheeses: [
    { id: 'mozzarella', name: '100% Mozzarella', price: 70, description: 'Classic stringy melt, delicate milky sweetness' },
    { id: 'sharp-cheddar', name: 'Sharp Cheddar', price: 80, description: 'Aged golden cheddar with a bold, tangy kick' },
    { id: 'smoked-gouda', name: 'Smoked Gouda', price: 90, description: 'Creamy Dutch gouda gently smoked with applewood' },
    { id: 'vegan-cheese', name: 'Vegan Dairy-Free Cheese', price: 95, description: 'Plant-based melt crafted from coconut and cashews' },
    { id: 'four-cheese-blend', name: 'Four Cheese Blend', price: 110, description: 'Mozzarella, Cheddar, Gouda, and shredded Parmesan' }
  ],
  vegetables: [
    { id: 'black-olives', name: 'Black Olives', price: 35 },
    { id: 'grilled-mushrooms', name: 'Grilled Mushrooms', price: 40 },
    { id: 'red-onions', name: 'Red Onions', price: 25 },
    { id: 'bell-peppers', name: 'Crisp Bell Peppers', price: 30 },
    { id: 'sweet-corn', name: 'Sweet Corn', price: 25 },
    { id: 'jalapenos', name: 'Pickled Jalapeños', price: 35 },
    { id: 'baby-spinach', name: 'Baby Spinach', price: 30 },
    { id: 'paneer-cubes', name: 'Paneer Cubes', price: 50 }
  ]
};

export default function CustomPizzaPage() {
  const { user, navigate } = useAuth();
  const { addToCart, actionLoading } = useCart();

  const [ingredients, setIngredients] = useState(DEFAULT_INGREDIENTS);
  const [selectedBase, setSelectedBase] = useState('Thin Crust');
  const [selectedSauce, setSelectedSauce] = useState('Classic San Marzano Tomato');
  const [selectedCheese, setSelectedCheese] = useState('100% Mozzarella');
  const [selectedVegetables, setSelectedVegetables] = useState(['Grilled Mushrooms', 'Crisp Bell Peppers']);
  const [quantity, setQuantity] = useState(1);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const res = await fetch(`${API_BASE}/pizzas/ingredients`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setIngredients(json.data);
          }
        }
      } catch (err) {
        console.warn('Could not fetch builder ingredients from API, using defaults:', err.message);
      }
    };
    loadIngredients();
  }, [API_BASE]);

  // Toggle vegetable selection
  const handleToggleVegetable = (vegName) => {
    setSelectedVegetables((prev) => {
      if (prev.includes(vegName)) {
        return prev.filter((v) => v !== vegName);
      } else {
        return [...prev, vegName];
      }
    });
  };

  // Frontend Estimated Calculation
  const estimatedUnitPrice = useMemo(() => {
    const baseObj = ingredients.bases.find((b) => b.name === selectedBase);
    const sauceObj = ingredients.sauces.find((s) => s.name === selectedSauce);
    const cheeseObj = ingredients.cheeses.find((c) => c.name === selectedCheese);

    const basePrice = baseObj ? baseObj.price : 0;
    const saucePrice = sauceObj ? sauceObj.price : 0;
    const cheesePrice = cheeseObj ? cheeseObj.price : 0;

    const vegPrice = selectedVegetables.reduce((acc, vName) => {
      const vObj = ingredients.vegetables.find((v) => v.name === vName);
      return acc + (vObj ? vObj.price : 0);
    }, 0);

    return basePrice + saucePrice + cheesePrice + vegPrice;
  }, [ingredients, selectedBase, selectedSauce, selectedCheese, selectedVegetables]);

  const estimatedTotal = estimatedUnitPrice * quantity;

  // Validation
  const isFormValid = !!selectedBase && !!selectedSauce && !!selectedCheese && quantity >= 1;

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login?redirect=/custom-pizza');
      return;
    }

    if (!isFormValid) {
      setStatusMessage({ type: 'error', text: 'Please ensure crust, sauce, and cheese are selected.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const result = await addToCart({
      type: 'custom',
      base: selectedBase,
      sauce: selectedSauce,
      cheese: selectedCheese,
      vegetables: selectedVegetables,
      quantity
    });

    setIsSubmitting(false);

    if (result.success) {
      setStatusMessage({ type: 'success', text: 'Custom pizza added to cart! Redirecting to cart...' });
      setTimeout(() => {
        navigate('/cart');
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: result.message || 'Failed to add custom pizza to cart.' });
    }
  };

  return (
    <div className="custom-builder-page">
      {/* Header */}
      <section className="builder-header">
        <div className="hero-tag">
          <span>⚙️</span> Interactive Custom Builder
        </div>
        <h1 className="builder-title">
          Build Your <span className="hero-highlight">Dream Pizza</span>
        </h1>
        <p className="builder-subtitle">
          Select every layer with total culinary control. Real-time ingredient pricing ensures transparent, server-verified ordering.
        </p>
      </section>

      {statusMessage && (
        <div className={`alert-banner ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ maxWidth: '900px', margin: '0 auto 1.5rem' }}>
          <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <div>{statusMessage.text}</div>
        </div>
      )}

      <div className="builder-layout">
        {/* Left Column: Selection Steps */}
        <div className="builder-steps-col">
          {/* STEP 1: Choose Crust */}
          <div className="builder-step-card card">
            <div className="step-header">
              <span className="step-num">1</span>
              <div>
                <h3 className="step-title">Choose Your Crust Base</h3>
                <p className="step-desc">Select 1 base crust (5 artisan styles available)</p>
              </div>
            </div>

            <div className="options-grid">
              {ingredients.bases.map((base) => {
                const isSelected = selectedBase === base.name;
                return (
                  <button
                    key={base.id || base.name}
                    type="button"
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedBase(base.name)}
                  >
                    <div className="option-header-row">
                      <span className="option-name">{base.name}</span>
                      <span className="option-price">+₹{base.price}</span>
                    </div>
                    <p className="option-desc">{base.description}</p>
                    <div className="selection-radio-indicator">
                      {isSelected ? '● Selected' : '○ Select'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Choose Sauce */}
          <div className="builder-step-card card">
            <div className="step-header">
              <span className="step-num">2</span>
              <div>
                <h3 className="step-title">Select Signature Sauce</h3>
                <p className="step-desc">Select 1 foundational flavor base</p>
              </div>
            </div>

            <div className="options-grid">
              {ingredients.sauces.map((sauce) => {
                const isSelected = selectedSauce === sauce.name;
                return (
                  <button
                    key={sauce.id || sauce.name}
                    type="button"
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSauce(sauce.name)}
                  >
                    <div className="option-header-row">
                      <span className="option-name">{sauce.name}</span>
                      <span className="option-price">+₹{sauce.price}</span>
                    </div>
                    <p className="option-desc">{sauce.description}</p>
                    <div className="selection-radio-indicator">
                      {isSelected ? '● Selected' : '○ Select'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Choose Cheese */}
          <div className="builder-step-card card">
            <div className="step-header">
              <span className="step-num">3</span>
              <div>
                <h3 className="step-title">Choose Melt &amp; Cheese Blend</h3>
                <p className="step-desc">Select 1 gourmet cheese foundation</p>
              </div>
            </div>

            <div className="options-grid">
              {ingredients.cheeses.map((cheese) => {
                const isSelected = selectedCheese === cheese.name;
                return (
                  <button
                    key={cheese.id || cheese.name}
                    type="button"
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedCheese(cheese.name)}
                  >
                    <div className="option-header-row">
                      <span className="option-name">{cheese.name}</span>
                      <span className="option-price">+₹{cheese.price}</span>
                    </div>
                    <p className="option-desc">{cheese.description}</p>
                    <div className="selection-radio-indicator">
                      {isSelected ? '● Selected' : '○ Select'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 4: Choose Vegetables & Toppings */}
          <div className="builder-step-card card">
            <div className="step-header">
              <span className="step-num">4</span>
              <div>
                <h3 className="step-title">Select Fresh Vegetables &amp; Toppings</h3>
                <p className="step-desc">Pick multiple toppings to customize your masterpiece</p>
              </div>
            </div>

            <div className="toppings-selection-grid">
              {ingredients.vegetables.map((veg) => {
                const isSelected = selectedVegetables.includes(veg.name);
                return (
                  <button
                    key={veg.id || veg.name}
                    type="button"
                    className={`topping-select-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => handleToggleVegetable(veg.name)}
                  >
                    <span className="veg-checkbox">{isSelected ? '☑' : '☐'}</span>
                    <span className="veg-title">{veg.name}</span>
                    <span className="veg-price">+₹{veg.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Summary & Price Breakdown Sticky Card */}
        <div className="builder-summary-col">
          <div className="builder-summary-card card sticky-summary">
            <div className="summary-banner">
              <h3>🍕 Custom Pizza Blueprint</h3>
              <span className="summary-badge">Authoritative Pricing</span>
            </div>

            {/* Visual Recipe Stack */}
            <div className="recipe-stack">
              <div className="stack-item">
                <span className="stack-label">Crust:</span>
                <span className="stack-value">{selectedBase}</span>
              </div>
              <div className="stack-item">
                <span className="stack-label">Sauce:</span>
                <span className="stack-value">{selectedSauce}</span>
              </div>
              <div className="stack-item">
                <span className="stack-label">Cheese:</span>
                <span className="stack-value">{selectedCheese}</span>
              </div>
              <div className="stack-item">
                <span className="stack-label">Toppings:</span>
                <span className="stack-value">
                  {selectedVegetables.length > 0
                    ? selectedVegetables.join(', ')
                    : 'None selected'}
                </span>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="builder-qty-row">
              <label htmlFor="custom-qty">Quantity:</label>
              <div className="qty-stepper">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span id="custom-qty" className="qty-number">{quantity}</span>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="price-breakdown">
              <div className="price-row">
                <span>Unit Pizza Price:</span>
                <span>₹{estimatedUnitPrice}</span>
              </div>
              <div className="price-row">
                <span>Quantity:</span>
                <span>× {quantity}</span>
              </div>
              <div className="price-row total-row">
                <span>Estimated Total:</span>
                <span className="total-amount">₹{estimatedTotal}</span>
              </div>
            </div>

            <div className="server-notice-box">
              <span>🛡️</span>
              <p>The backend recalculates and verifies prices automatically upon adding to cart.</p>
            </div>

            {/* Submit Action */}
            <button
              type="button"
              className="submit-btn full-width-btn"
              onClick={handleAddToCart}
              disabled={!isFormValid || isSubmitting || actionLoading}
            >
              {isSubmitting ? 'Verifying & Adding...' : `🛒 Add Custom Pizza (₹${estimatedTotal})`}
            </button>

            {!user && (
              <p className="auth-helper-note">
                Note: You will be prompted to sign in when adding to cart.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
