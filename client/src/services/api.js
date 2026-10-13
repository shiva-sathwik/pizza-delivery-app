/**
 * PizzaFlow Centralized API Configuration & Reusable Client Service
 * Step 9B: Centralized API base URL and request utilities
 */

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Standard authenticated JSON API request wrapper
 * @param {string} endpoint - Relative path (e.g. '/pizzas') or full URL
 * @param {RequestInit} [options] - Standard fetch options
 * @returns {Promise<Response>}
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });
};

export default {
  API_BASE,
  apiRequest
};
