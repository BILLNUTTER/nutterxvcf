import { useState, useEffect } from "react";

// New token format is base64url (contains letters, digits, -, _).
// Old format was a 64-char lowercase hex string.
// Reject the old format so the user is prompted to re-login instead of
// seeing a confusing "Malformed admin token" error.
function isValidTokenFormat(t: string): boolean {
  // base64url tokens are typically ~80+ chars and contain at least one - or _
  // Old hex tokens are exactly 64 chars of [0-9a-f]
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

  useEffect(() => {
    if (token === null) {
      localStorage.removeItem("adminToken");
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem("adminToken", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
  };

  // Call this whenever an admin API returns 401 — clears stale/expired token
  const handleAuthError = () => {
    logout();
  };

  return { token, login, logout, handleAuthError, isAuthenticated: !!token };
}
