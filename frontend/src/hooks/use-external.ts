"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface ExternalDashboard {
  student: {
    first_name: string;
    last_name: string;
    email: string;
    is_alternance: boolean;
  };
  stats: {
    total_courses: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  history: Array<{
    course_name: string;
    course_date: string;
    room: string | null;
    status: string;
    signed_at: string | null;
  }>;
}

export interface ExternalReport {
  id: string;
  month: string;
  total_courses: number;
  attended: number;
  absent: number;
  late: number;
  attendance_rate: number | null;
}

export function useExternalDashboard() {
  return useSWR<ExternalDashboard>("external-dashboard", {
    fetcher: () => api.get<ExternalDashboard>("/api/v1/external/dashboard"),
  });
}

export function useExternalReports() {
  return useSWR<ExternalReport[]>("external-reports", {
    fetcher: () => api.get<ExternalReport[]>("/api/v1/external/reports"),
  });
}
