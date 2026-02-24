"use client";
import { useAuth } from "@/hooks/use-auth";
import { useAdminCourseDetail } from "@/hooks/use-admin";
import { AdminSkeleton } from "@/components/skeleton";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function CourseDetailPage() {
  const { professor, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const { data: course } = useAdminCourseDetail(courseId);

  useEffect(() => {
    if (!loading && (!professor || !isAdmin)) router.push("/login");
  }, [loading, professor, isAdmin, router]);

  if (loading || !course) {
    return <AdminSkeleton />;
  }

  const startDate = new Date(course.start_time);
  const endDate = new Date(course.end_time);
  const formattedDate = startDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Retour au dashboard
      </Link>

      {/* Course Info Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
        <h1
          className="text-xl font-bold text-[var(--color-text)] mb-3"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {course.name}
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Salle {course.room}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{course.professor_name}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formattedDate}, {formattedTime}</span>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border-light)]">
          <h2
            className="text-lg font-bold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Etudiants ({course.students.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-semibold">Nom</th>
                <th className="text-center px-5 py-3 font-semibold">Statut</th>
                <th className="text-center px-5 py-3 font-semibold">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {course.students.map((s) => {
                const signedTime = s.signed_at || s.qr_signed_at;
                return (
                  <tr key={s.student_id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[var(--color-text)]">
                      {s.student_name}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                          s.status === "present"
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                            : s.status === "late"
                              ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                              : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                        }`}
                      >
                        {s.status === "present" ? "Present" : s.status === "late" ? "Retard" : "Absent"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {signedTime ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Signe a {new Date(signedTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          En attente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {course.students.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
            Aucun etudiant inscrit a ce cours
          </div>
        )}
      </div>
    </main>
  );
}
