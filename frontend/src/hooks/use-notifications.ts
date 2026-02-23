"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  record_id?: string;
  created_at: string;
}

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    "student-notifications",
    {
      fetcher: () => api.get<Notification[]>("/api/v1/student/notifications"),
      refreshInterval: 30000,
    }
  );

  return {
    notifications: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useUnreadCount() {
  const { data, mutate } = useSWR<{ count: number }>(
    "student-unread-count",
    {
      fetcher: () =>
        api.get<{ count: number }>("/api/v1/student/notifications/unread-count"),
      refreshInterval: 30000,
    }
  );

  return {
    count: data?.count ?? 0,
    mutate,
  };
}

export async function markAsRead(id: string) {
  await api.patch(`/api/v1/student/notifications/${id}/read`);
}

export async function markAllAsRead() {
  await api.post("/api/v1/student/notifications/mark-all-read");
}
