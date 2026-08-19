import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

export interface CurrentUser {
  id: number;
  name: string;
  username: string;
  email: string;
  photo_url?: string | null;
  sector?: string | null;
  position?: string | null;
  role: string;
  status?: string;
  theme_preference?: string;
  created_at?: string;
  last_login?: string | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem("acolhimento_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem("acolhimento_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      localStorage.setItem("acolhimento_user", JSON.stringify(res.data));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (identifier: string, password: string) => {
    const res = await api.post("/auth/login", { identifier, password });
    localStorage.setItem("acolhimento_token", res.data.token);
    localStorage.setItem("acolhimento_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    api.post("/auth/logout").catch(() => {});
    localStorage.removeItem("acolhimento_token");
    localStorage.removeItem("acolhimento_user");
    setUser(null);
    window.location.href = "/login";
  };

  const hasRole = (...roles: string[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
