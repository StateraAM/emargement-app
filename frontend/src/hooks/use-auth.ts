"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface Professor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export function useAuth() {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api
        .get<Professor>("/api/v1/auth/me")
        .then(setProfessor)
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
    const prof = await api.get<Professor>("/api/v1/auth/me");
    setProfessor(prof);
    return prof;
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setProfessor(null);
  }, []);

  return {
    professor,
    loading,
    login,
    logout,
    isAdmin: professor?.role === "admin",
  };
}
