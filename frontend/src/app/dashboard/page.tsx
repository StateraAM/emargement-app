"use client";
import { useAuth } from "@/hooks/use-auth";
import { useTodayCourses } from "@/hooks/use-courses";
import { CourseCard } from "@/components/course-card";
import { DashboardSkeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { professor, loading: authLoading, logout } = useAuth();
  const { data: courses, isLoading } = useTodayCourses();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !professor) router.push("/login");
  }, [authLoading, professor, router]);

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Emargement
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white/90">
                  {professor?.first_name} {professor?.last_name}
                </p>
              </div>
              <ThemeToggle />
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Quitter
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
        <div className="mb-6">
          <p className="text-sm text-[var(--color-text-muted)] capitalize">
            {today}
          </p>
          <h2
            className="text-2xl font-bold text-[var(--color-text)] mt-1"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Cours du jour
          </h2>
        </div>

        {courses && courses.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-border-light)] mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-[var(--color-text-muted)] font-medium">
              Aucun cours aujourd&apos;hui
            </p>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              Profitez de votre journee
            </p>
          </div>
        )}

        <div className="space-y-3 stagger-children">
          {courses?.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </main>
    </div>
  );
}
