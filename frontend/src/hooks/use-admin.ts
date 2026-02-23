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
