"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface Course {
  id: string;
  name: string;
  room: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  student_count: number;
}

export interface Student {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_alternance: boolean;
}

export function useTodayCourses() {
  return useSWR<Course[]>("courses-today", {
    fetcher: () => api.get<Course[]>("/api/v1/courses/today"),
  });
}

export function useCourseStudents(courseId: string | null) {
  return useSWR<Student[]>(
    courseId ? `course-students-${courseId}` : null,
    {
      fetcher: () => api.get<Student[]>(`/api/v1/courses/${courseId}/students`),
    }
  );
}
