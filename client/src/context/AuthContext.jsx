import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname + window.location.search);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Navigate helper with history pushState
  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo(0, 0);
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch current user on application mount using HTTP-only cookie
  const checkAuth = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Session check failed or server unreachable:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // User Login
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, message: err.message };
    }
  };

  // Admin Login
  const adminLogin = async (email, password) => {
    setAuthError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Admin login failed');
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, message: err.message };
    }
  };

  // User Registration
  const register = async (name, email, password) => {
    setAuthError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      return { success: true, message: data.message, user: data.user };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, message: err.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('[AuthContext] Logout call encountered error:', err.message);
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        currentPath,
        navigate,
        login,
        adminLogin,
        register,
        logout,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
