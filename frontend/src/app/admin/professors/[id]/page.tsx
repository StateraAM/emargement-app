"use client";
import { useAuth } from "@/hooks/use-auth";
import { useProfessorProfile } from "@/hooks/use-admin";
import { AdminSkeleton } from "@/components/skeleton";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function ProfessorProfilePage() {
  const { professor: currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const professorId = params.id as string;
  const { data: profile } = useProfessorProfile(professorId);

  useEffect(() => {
    if (!loading && (!currentUser || !isAdmin)) router.push("/login");
  }, [loading, currentUser, isAdmin, router]);

  if (loading || !profile) {
    return <AdminSkeleton />;
  }

  const { professor, stats } = profile;

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

      {/* Professor Header */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-lg">
            {professor.first_name[0]}{professor.last_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-playfair)" }}>
              {professor.first_name} {professor.last_name}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{professor.email}</p>
          </div>
          <span className={`inline-flex items-center justify-center min-w-[4rem] px-2.5 py-0.5 rounded-full text-xs font-bold ${
            professor.role === "admin"
              ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
              : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          }`}>
            {professor.role === "admin" ? "Admin" : "Professeur"}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]">
          <p className="text-2xl font-bold text-[var(--color-text)]">{stats.total_courses_given}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">Cours donnes</p>
        </div>
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]">
          <p className="text-2xl font-bold text-[var(--color-text)]">{stats.total_students}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">Etudiants total</p>
        </div>
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]">
          <p className={`text-2xl font-bold ${
            stats.avg_attendance_rate >= 80
              ? "text-[var(--color-success)]"
              : stats.avg_attendance_rate >= 60
                ? "text-[var(--color-warning)]"
                : "text-[var(--color-danger)]"
          }`}>{stats.avg_attendance_rate}%</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">Taux moyen</p>
        </div>
      </div>

      {/* Individual Courses Table */}
      <h2
        className="text-lg font-bold text-[var(--color-text)] mb-4"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Cours individuels
      </h2>
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Cours</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Salle</th>
                <th className="text-center px-4 py-3 font-semibold">Etudiants</th>
                <th className="text-center px-4 py-3 font-semibold">Taux</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {profile.courses.map((c, i) => (
                <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{c.date}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{c.course_name}</td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-muted)] hidden sm:table-cell">{c.room}</td>
                  <td className="px-4 py-3 text-center text-[var(--color-text)]">{c.student_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                        c.attendance_rate >= 80
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : c.attendance_rate >= 60
                            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                            : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                      }`}
                    >
                      {c.attendance_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {profile.courses.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">Aucun cours</div>
        )}
      </div>

      {/* Aggregated by Course Name */}
      <h2
        className="text-lg font-bold text-[var(--color-text)] mb-4"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Statistiques par matiere
      </h2>
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Matiere</th>
                <th className="text-center px-4 py-3 font-semibold">Sessions</th>
                <th className="text-center px-4 py-3 font-semibold">Taux moyen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {profile.by_course_name.map((c) => (
                <tr key={c.course_name} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{c.course_name}</td>
                  <td className="px-4 py-3 text-center text-[var(--color-text-muted)]">{c.total_sessions}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                        c.avg_rate >= 80
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : c.avg_rate >= 60
                            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                            : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                      }`}
                    >
                      {c.avg_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {profile.by_course_name.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">Aucune donnee</div>
        )}
      </div>
    </main>
  );
}
