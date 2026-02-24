"use client";
import { useAuth } from "@/hooks/use-auth";
import { useCourseHistory } from "@/hooks/use-courses";
import { DashboardSkeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function CourseHistoryPage() {
  const { professor, loading: authLoading, logout } = useAuth();
  const { data: history, isLoading } = useCourseHistory();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !professor) router.push("/login");
  }, [authLoading, professor, router]);

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Retour"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Historique des cours
              </h1>
            </div>
            <div className="flex items-center gap-2">
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
        {!history || history.courses.length === 0 ? (
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-[var(--color-text-muted)] font-medium">
              Aucun historique disponible
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {history.total} cours au total
            </p>

            {/* Mobile card layout */}
            <div className="space-y-3 sm:hidden stagger-children">
              {history.courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/course/${course.id}`}
                  className="block bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 hover:shadow-md transition-all animate-scale-in"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-[var(--color-text)] text-sm">
                        {course.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {course.date} &middot; {course.room || "\u2014"}
                      </p>
                    </div>
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                        course.is_validated
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                          : "bg-[var(--color-border-light)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {course.is_validated ? "Valide" : "Non valide"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>{course.student_count} etud.</span>
                    <span className="text-[var(--color-success)]">
                      {course.present_count} P
                    </span>
                    <span className="text-[var(--color-danger)]">
                      {course.absent_count} A
                    </span>
                    <span className="text-[var(--color-warning)]">
                      {course.late_count} R
                    </span>
                    <span className="ml-auto text-[var(--color-text-muted)]">
                      {course.start_time} - {course.end_time}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden sm:block bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
                      <th className="text-left px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Cours
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Salle
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Etud.
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        P
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        A
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        R
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.courses.map((course) => (
                      <tr
                        key={course.id}
                        onClick={() => router.push(`/course/${course.id}`)}
                        className="border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-[var(--color-surface)] cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                          {course.date}
                        </td>
                        <td className="px-3 py-3 text-[var(--color-text)] font-medium">
                          {course.name}
                        </td>
                        <td className="px-3 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                          {course.room || "\u2014"}
                        </td>
                        <td className="px-3 py-3 text-center text-[var(--color-text-secondary)]">
                          {course.student_count}
                        </td>
                        <td className="px-3 py-3 text-center text-[var(--color-success)]">
                          {course.present_count}
                        </td>
                        <td className="px-3 py-3 text-center text-[var(--color-danger)]">
                          {course.absent_count}
                        </td>
                        <td className="px-3 py-3 text-center text-[var(--color-warning)]">
                          {course.late_count}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                              course.is_validated
                                ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                                : "bg-[var(--color-border-light)] text-[var(--color-text-muted)]"
                            }`}
                          >
                            {course.is_validated ? "Valide" : "Non valide"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
