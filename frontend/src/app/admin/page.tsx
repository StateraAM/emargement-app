"use client";
import { useAuth } from "@/hooks/use-auth";
import { useAdminStats, useAdminStudents } from "@/hooks/use-admin";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const { professor, loading, logout, isAdmin } = useAuth();
  const { data: stats } = useAdminStats();
  const { data: students } = useAdminStudents();
  const router = useRouter();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && (!professor || !isAdmin)) router.push("/login");
  }, [loading, professor, isAdmin, router]);

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Chargement...</p>
      </div>
    );
  }

  const filteredStudents = students?.filter(
    (s) =>
      `${s.last_name} ${s.first_name} ${s.email}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="bg-[var(--color-primary-dark)] text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
            </div>
            <div>
              <h1
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Administration
              </h1>
              <p className="text-xs text-white/60">Tableau de bord</p>
            </div>
          </div>
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
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Deconnexion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 stagger-children">
          <StatCard
            label="Etudiants"
            value={stats.total_students}
            icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            accent={false}
          />
          <StatCard
            label="Cours aujourd'hui"
            value={stats.total_courses_today}
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            accent={false}
          />
          <StatCard
            label="Taux de presence"
            value={`${stats.global_attendance_rate}%`}
            icon="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z"
            accent={stats.global_attendance_rate >= 75}
            warning={stats.global_attendance_rate < 75}
          />
          <StatCard
            label="Alertes"
            value={stats.low_attendance_alerts}
            icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            accent={false}
            warning={stats.low_attendance_alerts > 0}
          />
        </div>

        {/* Students Table */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2
              className="text-lg font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Etudiants
            </h2>
            <div className="relative">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un etudiant..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] focus:outline-none w-full sm:w-64 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">Nom</th>
                  <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-center px-5 py-3 font-semibold hidden sm:table-cell">
                    Alt.
                  </th>
                  <th className="text-center px-5 py-3 font-semibold">
                    Pres.
                  </th>
                  <th className="text-center px-5 py-3 font-semibold">Abs.</th>
                  <th className="text-center px-5 py-3 font-semibold">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {filteredStudents?.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[var(--color-surface)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-[var(--color-text)]">
                        {s.last_name}
                      </span>{" "}
                      <span className="text-[var(--color-text-secondary)]">
                        {s.first_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--color-text-muted)] hidden md:table-cell">
                      {s.email}
                    </td>
                    <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                      {s.is_alternance ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">
                          &mdash;
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center text-[var(--color-success)] font-medium">
                      {s.attended}
                    </td>
                    <td className="px-5 py-3.5 text-center text-[var(--color-danger)] font-medium">
                      {s.absent}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {s.attendance_rate !== null ? (
                        <span
                          className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                            s.attendance_rate >= 80
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                              : s.attendance_rate >= 60
                                ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                                : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                          }`}
                        >
                          {s.attendance_rate}%
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">
                          &mdash;
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredStudents?.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
              Aucun etudiant trouve
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  warning,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)] transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            warning
              ? "bg-[var(--color-danger-bg)]"
              : accent
                ? "bg-[var(--color-success-bg)]"
                : "bg-[var(--color-primary)]/10"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={
              warning
                ? "var(--color-danger)"
                : accent
                  ? "var(--color-success)"
                  : "var(--color-primary)"
            }
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--color-text)]">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">
        {label}
      </p>
    </div>
  );
}
