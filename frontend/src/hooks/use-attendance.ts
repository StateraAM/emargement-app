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

export async function validateAttendance(
  courseId: string,
  entries: AttendanceEntry[]
) {
  return api.post<AttendanceRecord[]>("/api/v1/attendance/validate", {
    course_id: courseId,
    entries,
  });
}
