"use client";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useJustifications } from "@/hooks/use-justifications";
import { StudentHeader } from "@/components/student-header";
import { StudentSkeleton } from "@/components/skeleton";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

interface AttendanceRecord {
  id: string;
  course_name: string;
  course_date: string;
  room: string | null;
  status: string;
  signed_at: string | null;
  justification_status: string | null;
  justification_id: string | null;
  has_admin_comment: boolean;
}

function useAttendanceHistory() {
  return useSWR<AttendanceRecord[]>("student-attendance-history", {
    fetcher: () =>
      api.get<AttendanceRecord[]>("/api/v1/student/attendance-history"),
  });
}

interface StudentAnalytics {
  stats: { total_courses: number; attended: number; absent: number; late: number; rate: number };
  by_course: { course_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
  by_professor: { professor_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
}

function useStudentAnalytics() {
  return useSWR<StudentAnalytics>("student-analytics", {
    fetcher: () => api.get<StudentAnalytics>("/api/v1/student/analytics"),
  });
}

function formatDate(dateStr: string): string {
  // dateStr is "dd/MM/yyyy HH:mm" format from backend
  const [datePart] = dateStr.split(" ");
  const [day, month, year] = datePart.split("/");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case "present":
      return {
        text: "Present",
        className:
          "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]",
      };
    case "late":
      return {
        text: "En retard",
        className:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]",
      };
    case "absent":
      return {
        text: "Absent",
        className:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]",
      };
    default:
      return {
        text: status,
        className:
          "bg-[var(--color-border-light)] text-[var(--color-text-muted)]",
      };
  }
}

function justificationBadge(status: string): { text: string; className: string } {
  switch (status) {
    case "pending":
      return {
        text: "En attente",
        className:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]",
      };
    case "approved":
      return {
        text: "Approuvee",
        className:
          "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]",
      };
    case "rejected":
      return {
        text: "Refusee",
        className:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]",
      };
    default:
      return {
        text: status,
        className:
          "bg-[var(--color-border-light)] text-[var(--color-text-muted)]",
      };
  }
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<StudentSkeleton />}>
      <StudentDashboard />
    </Suspense>
  );
}

function StudentDashboard() {
  const { user, loading: authLoading, isStudent } = useAuth();
  const { notifications } = useNotifications();
  const { justifications } = useJustifications();
  const { data: history, isLoading: historyLoading } = useAttendanceHistory();
  const { data: analytics } = useStudentAnalytics();
  const router = useRouter();
  const [filters, setFilters] = useState<Set<string>>(new Set(["absent", "late"]));
  const [statsOpen, setStatsOpen] = useState(false);

  const toggleFilter = (key: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && (!user || !isStudent)) {
      router.push("/login");
    }
  }, [authLoading, user, isStudent, router]);

  if (authLoading || historyLoading) {
    return <StudentSkeleton />;
  }

  if (!user) return null;

  const pendingSignatures = notifications.filter(
    (n) => n.type === "signature_request" && !n.is_read
  );

  const getJustificationStatus = (record: AttendanceRecord): string | null => {
    if (record.justification_status) return record.justification_status;
    const found = justifications.find((j) => j.record_id === record.id);
    return found?.status ?? null;
  };

  const canJustify = (record: AttendanceRecord): boolean => {
    return (
      record.status === "absent" &&
      !getJustificationStatus(record)
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <StudentHeader />

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
        {/* Pending Signatures */}
        <section className="mb-8">
          <h2
            className="text-2xl font-bold text-[var(--color-text)] mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Signatures en attente
          </h2>

          {pendingSignatures.length === 0 ? (
            <div className="text-center py-10 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)]">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-success-bg)] mb-3">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-success)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] font-medium">
                Aucune signature en attente
              </p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {pendingSignatures.map((notif) => (
                <div
                  key={notif.id}
                  className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-accent)]/30 p-5 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text)]">
                        {notif.title}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                        {notif.message}
                      </p>
                    </div>
                    <span className="shrink-0 ml-3 text-[11px] font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-white px-2.5 py-1 rounded-full">
                      A signer
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/student/sign/${notif.record_id}`)
                    }
                    className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97] transition-all"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Signer
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Attendance History */}
        <section>
          <div className="flex items-baseline gap-2 mb-4">
            <h2
              className="text-2xl font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Historique de presence
            </h2>
            {history && history.length > 0 && (
              <span className="text-sm text-[var(--color-text-muted)]">
                ({history.filter((r) => filters.has(r.status)).length} resultat{history.filter((r) => filters.has(r.status)).length > 1 ? "s" : ""})
              </span>
            )}
          </div>

          {history && history.length > 0 && (
            <div className="flex gap-2 mb-4">
              {([
                { key: "present", label: "Present", color: "success" },
                { key: "late", label: "En retard", color: "warning" },
                { key: "absent", label: "Absent", color: "danger" },
              ] as const).map(({ key, label, color }) => {
                const active = filters.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleFilter(key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                      active
                        ? `bg-[var(--color-${color}-bg)] text-[var(--color-${color})] border-[var(--color-${color}-border)]`
                        : "bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {!history || history.length === 0 ? (
            <div className="text-center py-10 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)]">
              <p className="text-sm text-[var(--color-text-muted)]">
                Aucun historique disponible
              </p>
            </div>
          ) : (
            <>
            {/* Mobile card layout */}
            <div className="space-y-3 sm:hidden stagger-children">
              {history.filter((r) => filters.has(r.status)).map((record) => {
                const status = statusLabel(record.status);
                const justStatus = getJustificationStatus(record);
                return (
                  <div
                    key={record.id}
                    className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 animate-scale-in"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-[var(--color-text)] text-sm">{record.course_name}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {formatDate(record.course_date)} {record.room ? `\u00B7 Salle ${record.room}` : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        {record.signed_at ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 12l2 2 4-4" />
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                            <span className="text-[var(--color-success)] font-medium">Signe</span>
                          </>
                        ) : (
                          <span>Non signe</span>
                        )}
                      </div>
                      <div className="ml-auto">
                        {justStatus ? (
                          record.justification_id ? (
                            justStatus === "pending" && record.has_admin_comment ? (
                              <button
                                onClick={() => router.push(`/student/justification/${record.justification_id}`)}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97] transition-all"
                              >
                                Justifier
                              </button>
                            ) : (
                              <button
                                onClick={() => router.push(`/student/justification/${record.justification_id}`)}
                                className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${justificationBadge(justStatus).className}`}
                              >
                                {justificationBadge(justStatus).text}
                              </button>
                            )
                          ) : (
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${justificationBadge(justStatus).className}`}
                            >
                              {justificationBadge(justStatus).text}
                            </span>
                          )
                        ) : canJustify(record) ? (
                          <button
                            onClick={() => router.push(`/student/justify/${record.id}`)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97] transition-all"
                          >
                            Justifier
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                        Statut
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Signe
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Justification
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.filter((r) => filters.has(r.status)).map((record) => {
                      const status = statusLabel(record.status);
                      const justStatus = getJustificationStatus(record);
                      return (
                        <tr
                          key={record.id}
                          className="border-b border-[var(--color-border-light)] last:border-b-0"
                        >
                          <td className="px-3 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                            {formatDate(record.course_date)}
                          </td>
                          <td className="px-3 py-3 text-[var(--color-text)] font-medium">
                            {record.course_name}
                          </td>
                          <td className="px-3 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                            {record.room || "\u2014"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}
                            >
                              {status.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {record.signed_at ? (
                              <svg
                                className="inline"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--color-success)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M9 12l2 2 4-4" />
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">
                                \u2014
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {justStatus ? (
                              record.justification_id ? (
                                justStatus === "pending" && record.has_admin_comment ? (
                                  <button
                                    onClick={() => router.push(`/student/justification/${record.justification_id}`)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97] transition-all"
                                  >
                                    Justifier
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => router.push(`/student/justification/${record.justification_id}`)}
                                    className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${justificationBadge(justStatus).className}`}
                                  >
                                    {justificationBadge(justStatus).text}
                                  </button>
                                )
                              ) : (
                                <span
                                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${justificationBadge(justStatus).className}`}
                                >
                                  {justificationBadge(justStatus).text}
                                </span>
                              )
                            ) : canJustify(record) ? (
                              <button
                                onClick={() =>
                                  router.push(`/student/justify/${record.id}`)
                                }
                                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97] transition-all"
                              >
                                Justifier
                              </button>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">
                                \u2014
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
        </section>

        {/* Analytics Section */}
        {analytics && (
          <section className="mt-8">
            <button
              onClick={() => setStatsOpen(!statsOpen)}
              className="flex items-center gap-2 w-full text-left mb-4"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${statsOpen ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <h2
                className="text-2xl font-bold text-[var(--color-text)]"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Mes statistiques
              </h2>
            </button>

            {statsOpen && (
              <div className="animate-fade-in">
                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: "Total cours", value: analytics.stats.total_courses },
                    { label: "Present", value: analytics.stats.attended, color: "success" },
                    { label: "Absent", value: analytics.stats.absent, color: "danger" },
                    { label: "En retard", value: analytics.stats.late, color: "warning" },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 text-center"
                    >
                      <p className={`text-2xl font-bold ${color ? `text-[var(--color-${color})]` : "text-[var(--color-text)]"}`}>
                        {value}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
                    </div>
                  ))}
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 text-center">
                    <p className="text-2xl font-bold">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                          analytics.stats.rate >= 80
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                            : analytics.stats.rate >= 60
                              ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                              : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]"
                        }`}
                      >
                        {analytics.stats.rate}%
                      </span>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Taux</p>
                  </div>
                </div>

                {/* By course table */}
                {analytics.by_course.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                      Par matiere
                    </h3>

                    {/* Mobile cards */}
                    <div className="space-y-3 sm:hidden">
                      {analytics.by_course.map((c) => (
                        <div
                          key={c.course_name}
                          className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-[var(--color-text)] text-sm">{c.course_name}</p>
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                c.rate >= 80
                                  ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                                  : c.rate >= 60
                                    ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                                    : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]"
                              }`}
                            >
                              {c.rate}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                            <span>{c.total} cours</span>
                            <span className="text-[var(--color-success)]">{c.attended} P</span>
                            <span className="text-[var(--color-danger)]">{c.absent} A</span>
                            <span className="text-[var(--color-warning)]">{c.late} R</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
                              <th className="text-left px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Matiere</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Total</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Present</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Absent</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Retard</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Taux</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.by_course.map((c) => (
                              <tr key={c.course_name} className="border-b border-[var(--color-border-light)] last:border-b-0">
                                <td className="px-3 py-3 text-[var(--color-text)] font-medium">{c.course_name}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-text-secondary)]">{c.total}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-success)]">{c.attended}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-danger)]">{c.absent}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-warning)]">{c.late}</td>
                                <td className="px-3 py-3 text-center">
                                  <span
                                    className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                      c.rate >= 80
                                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                                        : c.rate >= 60
                                          ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                                          : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]"
                                    }`}
                                  >
                                    {c.rate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* By professor table */}
                {analytics.by_professor.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                      Par professeur
                    </h3>

                    {/* Mobile cards */}
                    <div className="space-y-3 sm:hidden">
                      {analytics.by_professor.map((p) => (
                        <div
                          key={p.professor_name}
                          className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-[var(--color-text)] text-sm">{p.professor_name}</p>
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                p.rate >= 80
                                  ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                                  : p.rate >= 60
                                    ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                                    : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]"
                              }`}
                            >
                              {p.rate}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                            <span>{p.total} cours</span>
                            <span className="text-[var(--color-success)]">{p.attended} P</span>
                            <span className="text-[var(--color-danger)]">{p.absent} A</span>
                            <span className="text-[var(--color-warning)]">{p.late} R</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
                              <th className="text-left px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Professeur</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Total</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Present</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Absent</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Retard</th>
                              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Taux</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.by_professor.map((p) => (
                              <tr key={p.professor_name} className="border-b border-[var(--color-border-light)] last:border-b-0">
                                <td className="px-3 py-3 text-[var(--color-text)] font-medium">{p.professor_name}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-text-secondary)]">{p.total}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-success)]">{p.attended}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-danger)]">{p.absent}</td>
                                <td className="px-3 py-3 text-center text-[var(--color-warning)]">{p.late}</td>
                                <td className="px-3 py-3 text-center">
                                  <span
                                    className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                      p.rate >= 80
                                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                                        : p.rate >= 60
                                          ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                                          : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]"
                                    }`}
                                  >
                                    {p.rate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
