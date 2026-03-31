import { useState, useEffect } from "react";

function isValidTokenFormat(t: string): boolean {
  const isOldHex = /^[0-9a-f]{64}$/.test(t);
  return t.length > 30 && !isOldHex;
}

function isTokenExpired(t: string): boolean {
  try {
    const base64 = t.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const dotIdx = decoded.indexOf(".");
    if (dotIdx === -1) return true;
    const expiresAt = Number(decoded.slice(0, dotIdx));
    return !Number.isFinite(expiresAt) || Date.now() >= expiresAt;
  } catch {
    return true;
  }
}

function readStoredToken(): string | null {
  try {
    const stored = localStorage.getItem("adminToken");
    if (!stored) return null;
    if (!isValidTokenFormat(stored)) {
      localStorage.removeItem("adminToken");
      return null;
    }
    if (isTokenExpired(stored)) {
      localStorage.removeItem("adminToken");
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());

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

  const handleAuthError = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
    setSessionExpired(true);
  };

  return { token, login, logout, handleAuthError, isAuthenticated: !!token, sessionExpired };
}
