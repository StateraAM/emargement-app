"use client";
import { api } from "@/lib/api";

export interface AttendanceEntry {
  student_id: string;
  status: "present" | "absent" | "late";
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  status: string;
  signed_at: string | null;
  qr_signed_at: string | null;
}

export interface AttendanceStatus {
  validated: boolean;
  editable: boolean;
  deadline: string | null;
}

export async function validateAttendance(
  courseId: string,
  entries: AttendanceEntry[]
) {
  return api.post<AttendanceRecord[]>("/api/v1/attendance/validate", {
    course_id: courseId,
    entries,
  });
}

export async function getAttendanceStatus(courseId: string): Promise<AttendanceStatus> {
  return api.get<AttendanceStatus>(`/api/v1/attendance/${courseId}/status`);
}

export async function getAttendanceRecords(courseId: string): Promise<AttendanceRecord[]> {
  return api.get<AttendanceRecord[]>(`/api/v1/attendance/${courseId}`);
}

export async function updateAttendance(courseId: string, entries: AttendanceEntry[]): Promise<AttendanceRecord[]> {
  return api.put<AttendanceRecord[]>("/api/v1/attendance/validate", {
    course_id: courseId,
    entries,
  });
}
