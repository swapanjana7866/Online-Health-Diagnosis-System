import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, userService } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('carepath_user') || 'null');
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('carepath_token') || null);
  const [loading, setLoading] = useState(false);

  // Sync token and user to localStorage
  const signIn = useCallback((authData) => {
    // Envelope data could be under data or direct
    const payload = authData.data || authData;
    const receivedToken = payload.token;
    const receivedUser = payload.user;

    if (receivedToken) {
      setToken(receivedToken);
      localStorage.setItem('carepath_token', receivedToken);
    }
    if (receivedUser) {
      setUser(receivedUser);
      localStorage.setItem('carepath_user', JSON.stringify(receivedUser));
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('carepath_token');
    localStorage.removeItem('carepath_user');
  }, []);

  const updateUser = useCallback((updatedUserData) => {
    setUser((prev) => {
      const next = { ...prev, ...updatedUserData };
      localStorage.setItem('carepath_user', JSON.stringify(next));
      return next;
    });
  }, []);

  // Listen for unauthorized 401 session expiration
  useEffect(() => {
    const handleAuthExpired = () => {
      signOut();
    };

    window.addEventListener('carepath_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('carepath_auth_expired', handleAuthExpired);
  }, [signOut]);

  // Optionally revalidate current profile on initial mount if token exists
  useEffect(() => {
    if (token) {
      userService
        .getProfile()
        .then((res) => {
          if (res?.data?.user) {
            updateUser(res.data.user);
          }
        })
        .catch(() => {
          // Token might be expired or server unreachable
        });
    }
  }, [token, updateUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        setLoading,
        signIn,
        signOut,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
