"use client";
import { useAuth } from "@/hooks/use-auth";
import { useExternalDashboard, useExternalReports } from "@/hooks/use-external";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ExternalPage() {
  const { user, loading, logout, isExternal } = useAuth();
  const { data: dashboard } = useExternalDashboard();
  const { data: reports } = useExternalReports();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isExternal)) router.push("/login");
  }, [loading, user, isExternal, router]);

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Chargement...</p>
      </div>
    );
  }

  const { student, stats, history } = dashboard;

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <header className="bg-[var(--color-primary-dark)] text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h1
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Suivi de {student.first_name} {student.last_name}
              </h1>
              <p className="text-xs text-white/60">Espace tuteur / entreprise</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Deconnexion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]">
            <p className={`text-2xl font-bold ${stats.attendance_rate >= 75 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {stats.attendance_rate}%
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">Taux de presence</p>
          </div>
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]">
            <p className="text-2xl font-bold text-[var(--color-danger)]">{stats.absent}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">Absences</p>
          </div>
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]">
            <p className="text-2xl font-bold text-[var(--color-warning)]">{stats.late}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">Retards</p>
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-[var(--color-border-light)]">
            <h2 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-playfair)" }}>
              Historique des presences
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-left px-5 py-3 font-semibold">Cours</th>
                  <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Salle</th>
                  <th className="text-center px-5 py-3 font-semibold">Statut</th>
                  <th className="text-center px-5 py-3 font-semibold hidden md:table-cell">Signe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-5 py-3.5 text-[var(--color-text-muted)]">{h.course_date}</td>
                    <td className="px-5 py-3.5 font-semibold text-[var(--color-text)]">{h.course_name}</td>
                    <td className="px-5 py-3.5 text-[var(--color-text-muted)] hidden sm:table-cell">{h.room || "\u2014"}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                        h.status === "present"
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : h.status === "late"
                            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                            : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                      }`}>
                        {h.status === "present" ? "Present" : h.status === "late" ? "Retard" : "Absent"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-[var(--color-text-muted)] hidden md:table-cell">
                      {h.signed_at ? new Date(h.signed_at).toLocaleString("fr-FR") : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
              Aucun historique disponible
            </div>
          )}
        </div>

        {/* Monthly Reports */}
        {reports && reports.length > 0 && (
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border-light)]">
              <h2 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-playfair)" }}>
                Rapports mensuels
              </h2>
            </div>
            <div className="divide-y divide-[var(--color-border-light)]">
              {reports.map((r) => (
                <div key={r.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {new Date(r.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {r.attended}/{r.total_courses} cours — {r.attendance_rate !== null ? `${r.attendance_rate}%` : "N/A"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
