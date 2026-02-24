"use client";
import { useAuth } from "@/hooks/use-auth";
import { useStudentProfile } from "@/hooks/use-admin";
import { AdminSkeleton } from "@/components/skeleton";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "course" | "professor" | "absences" | "justifications";

export default function StudentProfilePage() {
  const { professor, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { data: profile } = useStudentProfile(studentId);
  const [tab, setTab] = useState<Tab>("course");

  useEffect(() => {
    if (!loading && (!professor || !isAdmin)) router.push("/login");
  }, [loading, professor, isAdmin, router]);

  if (loading || !profile) {
    return <AdminSkeleton />;
  }

  const { student, stats } = profile;

  const tabs: { key: Tab; label: string }[] = [
    { key: "course", label: "Par matiere" },
    { key: "professor", label: "Par professeur" },
    { key: "absences", label: "Absences recentes" },
    { key: "justifications", label: "Justificatifs" },
  ];

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

      {/* Student Header */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-lg">
            {student.first_name[0]}{student.last_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-playfair)" }}>
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{student.email}</p>
          </div>
          {student.is_alternance && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Alternance
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Total cours" value={stats.total_courses} />
        <StatCard label="Present" value={stats.attended} color="success" />
        <StatCard label="Absent" value={stats.absent} color="danger" />
        <StatCard label="En retard" value={stats.late} color="warning" />
        <StatCard label="Taux" value={`${stats.attendance_rate}%`} color={stats.attendance_rate >= 80 ? "success" : stats.attendance_rate >= 60 ? "warning" : "danger"} />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border-light)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "course" && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Matiere</th>
                  <th className="text-center px-4 py-3 font-semibold">Total</th>
                  <th className="text-center px-4 py-3 font-semibold">Present</th>
                  <th className="text-center px-4 py-3 font-semibold">Absent</th>
                  <th className="text-center px-4 py-3 font-semibold">Retard</th>
                  <th className="text-center px-4 py-3 font-semibold">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {profile.by_course.map((c) => (
                  <tr key={c.course_name} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{c.course_name}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-muted)]">{c.total}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-success)] font-medium">{c.attended}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-danger)] font-medium">{c.absent}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-warning)] font-medium">{c.late}</td>
                    <td className="px-4 py-3 text-center">
                      <RateBadge rate={c.rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {profile.by_course.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">Aucune donnee</div>
          )}
        </div>
      )}

      {tab === "professor" && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Professeur</th>
                  <th className="text-center px-4 py-3 font-semibold">Total</th>
                  <th className="text-center px-4 py-3 font-semibold">Present</th>
                  <th className="text-center px-4 py-3 font-semibold">Absent</th>
                  <th className="text-center px-4 py-3 font-semibold">Retard</th>
                  <th className="text-center px-4 py-3 font-semibold">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {profile.by_professor.map((p) => (
                  <tr key={p.professor_name} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{p.professor_name}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-muted)]">{p.total}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-success)] font-medium">{p.attended}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-danger)] font-medium">{p.absent}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-warning)] font-medium">{p.late}</td>
                    <td className="px-4 py-3 text-center">
                      <RateBadge rate={p.rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {profile.by_professor.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">Aucune donnee</div>
          )}
        </div>
      )}

      {tab === "absences" && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Cours</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-center px-4 py-3 font-semibold">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold">Justificatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {profile.recent_absences.map((a, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{a.course_name}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{a.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                        a.status === "absent"
                          ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                          : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                      }`}>
                        {a.status === "absent" ? "Absent" : "En retard"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.justification_status ? (
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                          a.justification_status === "approved"
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                            : a.justification_status === "pending"
                              ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                              : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                        }`}>
                          {a.justification_status === "approved" ? "Approuve" : a.justification_status === "pending" ? "En attente" : "Refuse"}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {profile.recent_absences.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">Aucune absence recente</div>
          )}
        </div>
      )}

      {tab === "justifications" && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Cours</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Raison</th>
                  <th className="text-center px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {profile.justifications.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => router.push(`/admin/justifications/${j.id}`)}
                    className="hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{j.course_name}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{j.date}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text)]">
                      <span className="max-w-[200px] truncate block">{j.reason}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                        j.status === "approved"
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : j.status === "pending"
                            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                            : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                      }`}>
                        {j.status === "approved" ? "Approuve" : j.status === "pending" ? "En attente" : "Refuse"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {profile.justifications.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">Aucun justificatif</div>
          )}
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const bgClass = color === "success"
    ? "bg-[var(--color-success-bg)]"
    : color === "danger"
      ? "bg-[var(--color-danger-bg)]"
      : color === "warning"
        ? "bg-[var(--color-warning-bg)]"
        : "bg-[var(--color-primary)]/10";
  const textClass = color === "success"
    ? "text-[var(--color-success)]"
    : color === "danger"
      ? "text-[var(--color-danger)]"
      : color === "warning"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-text)]";

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl p-4 shadow-sm border border-[var(--color-border-light)]">
      <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold mb-2 ${bgClass} ${textClass}`}>
        {value}
      </div>
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}

function RateBadge({ rate }: { rate: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold ${
        rate >= 80
          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
          : rate >= 60
            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
            : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
      }`}
    >
      {rate}%
    </span>
  );
}
