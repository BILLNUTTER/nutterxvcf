import { useState, useEffect } from "react";

function isValidTokenFormat(t: string): boolean {
  const isOldHex = /^[0-9a-f]{64}$/.test(t);
  return t.length > 30 && !isOldHex;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem("adminToken");
      if (stored && isValidTokenFormat(stored)) return stored;
      if (stored) localStorage.removeItem("adminToken");
    } catch {
      // ignore
    }
    return null;
  });

  // "expired" = kicked by a 401 mid-session (not a fresh visit)
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (token === null) {
      localStorage.removeItem("adminToken");
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem("adminToken", newToken);
    setToken(newToken);
    setSessionExpired(false);
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
    setSessionExpired(false);
  };

  // Call this whenever an admin API returns 401 — marks session as expired
  const handleAuthError = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
    setSessionExpired(true);
  };

  return { token, login, logout, handleAuthError, isAuthenticated: !!token, sessionExpired };
}
