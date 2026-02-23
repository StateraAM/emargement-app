"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface Justification {
  id: string;
  record_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
}

export function useJustifications() {
  const { data, error, isLoading, mutate } = useSWR<Justification[]>(
    "student-justifications",
    {
      fetcher: () =>
        api.get<Justification[]>("/api/v1/student/justifications"),
    }
  );

  return {
    justifications: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function submitJustification(
  recordId: string,
  reason: string,
  files: File[]
): Promise<Justification> {
  const formData = new FormData();
  formData.append("reason", reason);
  for (const file of files) {
    formData.append("files", file);
  }
  return api.postFormData<Justification>(
    `/api/v1/student/justify/${recordId}`,
    formData
  );
}
