"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: string;
  role?: string;
}

export type Professor = User;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api
        .get<User>("/api/v1/auth/me")
        .then((u) => {
          setUser(u);
          api.setUserType(u.user_type);
        })
        .catch(() => api.clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ access_token: string }>(
      "/api/v1/auth/login",
      { email, password }
    );
    api.setToken(data.access_token);
    const u = await api.get<User>("/api/v1/auth/me");
    setUser(u);
    api.setUserType(u.user_type);
    return u;
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
  }, []);

  const professor = user;
  const isStudent = user?.user_type === "student";
  const isProfessor = user?.user_type === "professor";
  const isAdmin = user?.role === "admin";
  const isExternal = user?.user_type === "external";

  return {
    user,
    professor,
    loading,
    login,
    logout,
    isStudent,
    isProfessor,
    isAdmin,
    isExternal,
  };
}
