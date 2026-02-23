"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const userType = api.getUserType();
    if (userType === "student") {
      router.replace("/student");
    } else if (userType === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
      <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
      <p className="text-[var(--color-text-muted)] text-sm">Redirection...</p>
    </div>
  );
}
