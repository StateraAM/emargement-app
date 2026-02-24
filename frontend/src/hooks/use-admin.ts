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

export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor_type: string;
  actor_name: string;
  target_type: string;
  target_id: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useAuditLogs(eventType?: string, limit = 50) {
  const params = new URLSearchParams();
  if (eventType) params.set("event_type", eventType);
  params.set("limit", String(limit));
  return useSWR<AuditLogEntry[]>(`admin-audit-logs-${eventType || "all"}`, {
    fetcher: () => api.get<AuditLogEntry[]>(`/api/v1/admin/audit-logs?${params}`),
  });
}

export async function generateCertificate(studentId: string, startDate: string, endDate: string): Promise<Blob> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const resp = await fetch(`${API_URL}/api/v1/admin/exports/certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ student_id: studentId, start_date: startDate, end_date: endDate }),
  });
  if (!resp.ok) throw new Error("Failed to generate certificate");
  return resp.blob();
}

export async function generateCertificatesBulk(startDate: string, endDate: string): Promise<Blob> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const resp = await fetch(`${API_URL}/api/v1/admin/exports/certificates-bulk?start_date=${startDate}&end_date=${endDate}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!resp.ok) throw new Error("Failed to generate certificates");
  return resp.blob();
}

export interface StudentProfile {
  student: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_alternance: boolean;
  };
  stats: {
    total_courses: number;
    attended: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  by_course: { course_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
  by_professor: { professor_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
  recent_absences: { course_name: string; date: string; status: string; justification_status: string | null }[];
  justifications: { id: string; course_name: string; date: string; reason: string; status: string }[];
}

export function useStudentProfile(studentId: string) {
  return useSWR<StudentProfile>(studentId ? `admin-student-profile-${studentId}` : null, {
    fetcher: () => api.get<StudentProfile>(`/api/v1/admin/students/${studentId}/profile`),
  });
}

export interface ProfessorProfile {
  professor: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  stats: {
    total_courses_given: number;
    total_students: number;
    avg_attendance_rate: number;
  };
  courses: { course_name: string; date: string; room: string; student_count: number; attendance_rate: number }[];
  by_course_name: { course_name: string; total_sessions: number; avg_rate: number }[];
}

export function useProfessorProfile(professorId: string) {
  return useSWR<ProfessorProfile>(professorId ? `admin-professor-profile-${professorId}` : null, {
    fetcher: () => api.get<ProfessorProfile>(`/api/v1/admin/professors/${professorId}/profile`),
  });
}

export interface JustificationDetail {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  course_name: string;
  course_date: string;
  reason: string;
  file_urls: string[];
  status: string;
  created_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  comments: { id: string; author_type: string; author_name: string; message: string; created_at: string }[];
}

export function useJustificationDetail(justificationId: string) {
  return useSWR<JustificationDetail>(justificationId ? `admin-justification-${justificationId}` : null, {
    fetcher: () => api.get<JustificationDetail>(`/api/v1/admin/justifications/${justificationId}`),
  });
}

export async function addJustificationComment(justificationId: string, message: string) {
  return api.post<{ ok: boolean }>(`/api/v1/admin/justifications/${justificationId}/comment`, { message });
}

export interface AdminCourse {
  id: string;
  name: string;
  room: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  signed_count: number;
  is_validated: boolean;
}

export function useAdminCourses(date?: string) {
  const params = date ? `?date=${date}` : "";
  return useSWR<AdminCourse[]>(`admin-courses-${date || "today"}`, {
    fetcher: () => api.get<AdminCourse[]>(`/api/v1/admin/courses${params}`),
  });
}

export interface AdminCourseDetail {
  id: string;
  name: string;
  room: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  students: {
    student_id: string;
    student_name: string;
    status: string;
    signed_at: string | null;
    qr_signed_at: string | null;
    signature_data: string | null;
    signature_ip: string | null;
    signature_user_agent: string | null;
  }[];
}

export function useAdminCourseDetail(courseId: string) {
  return useSWR<AdminCourseDetail>(courseId ? `admin-course-detail-${courseId}` : null, {
    fetcher: () => api.get<AdminCourseDetail>(`/api/v1/admin/courses/${courseId}`),
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
