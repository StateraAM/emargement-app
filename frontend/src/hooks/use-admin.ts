"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface AdminStats {
  total_students: number;
  total_professors: number;
  total_courses_today: number;
  global_attendance_rate: number;
  total_attendance_records: number;
  low_attendance_alerts: number;
}

export interface StudentWithAttendance {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_alternance: boolean;
  attendance_rate: number | null;
  total_courses: number;
  attended: number;
  absent: number;
  late: number;
}

export function useAdminStats() {
  return useSWR<AdminStats>("admin-stats", {
    fetcher: () => api.get<AdminStats>("/api/v1/admin/stats"),
  });
}

export interface ProfessorInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export function useAdminProfessors() {
  return useSWR<ProfessorInfo[]>("admin-professors", {
    fetcher: () => api.get<ProfessorInfo[]>("/api/v1/admin/professors"),
  });
}

export function useAdminStudents() {
  return useSWR<StudentWithAttendance[]>("admin-students", {
    fetcher: () =>
      api.get<StudentWithAttendance[]>("/api/v1/admin/students"),
  });
}

export interface AdminJustification {
  id: string;
  student_name: string;
  student_email: string;
  course_name: string;
  course_date: string;
  record_status: string;
  reason: string;
  file_urls: string[];
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  comment: string | null;
}

export function useAdminJustifications(status?: string) {
  const params = status ? `?status=${status}` : "";
  return useSWR<AdminJustification[]>(`admin-justifications-${status || "all"}`, {
    fetcher: () => api.get<AdminJustification[]>(`/api/v1/admin/justifications${params}`),
    refreshInterval: 15000,
  });
}

export async function reviewJustification(id: string, decision: string, comment?: string) {
  return api.put<{ ok: boolean; status: string }>(`/api/v1/admin/justifications/${id}/review`, {
    decision,
    comment,
  });
}
