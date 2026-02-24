"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

// ---------- Types ----------

export interface AnalyticsSummary {
  total_students: number;
  total_courses: number;
  total_records: number;
  global_attendance_rate: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  trend: number; // percentage change vs previous period
}

export interface AttendanceTrendEntry {
  date: string;
  present: number;
  absent: number;
  late: number;
}

export interface CourseAnalytics {
  course_name: string;
  name?: string;
  attendance_rate: number;
  rate?: number;
  total_sessions: number;
  total_students: number;
}

export interface StudentAtRisk {
  student_id: string;
  student_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  attendance_rate: number;
  rate?: number;
  total_courses: number;
  absent: number;
}

export interface ProfessorAnalytics {
  professor_name: string;
  first_name?: string;
  last_name?: string;
  total_courses: number;
  courses_count?: number;
  average_attendance_rate: number;
}

// ---------- Hooks ----------

export function useAnalyticsSummary() {
  return useSWR<AnalyticsSummary>("analytics-summary", {
    fetcher: () => api.get<AnalyticsSummary>("/api/v1/analytics/summary"),
  });
}

export function useAttendanceTrends(period: "daily" | "weekly" | "monthly" = "daily") {
  return useSWR<AttendanceTrendEntry[]>(`analytics-trends-${period}`, {
    fetcher: () =>
      api.get<AttendanceTrendEntry[]>(`/api/v1/analytics/attendance-trends?period=${period}`),
  });
}

export function useCourseAnalytics() {
  return useSWR<CourseAnalytics[]>("analytics-courses", {
    fetcher: () => api.get<CourseAnalytics[]>("/api/v1/analytics/courses"),
  });
}

export function useStudentsAtRisk(threshold = 75) {
  return useSWR<StudentAtRisk[]>(`analytics-at-risk-${threshold}`, {
    fetcher: () =>
      api.get<StudentAtRisk[]>(`/api/v1/analytics/students-at-risk?threshold=${threshold}`),
  });
}

export function useProfessorAnalytics() {
  return useSWR<ProfessorAnalytics[]>("analytics-professors", {
    fetcher: () => api.get<ProfessorAnalytics[]>("/api/v1/analytics/professors"),
  });
}
