"use client";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useJustifications } from "@/hooks/use-justifications";
import { StudentHeader } from "@/components/student-header";
import { useRouter, useSearchParams } from "next/navigation";
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
}

function useAttendanceHistory() {
  return useSWR<AttendanceRecord[]>("student-attendance-history", {
    fetcher: () =>
      api.get<AttendanceRecord[]>("/api/v1/student/attendance-history"),
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
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
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
          <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-text-muted)] text-sm">Chargement...</p>
        </div>
      }
    >
      <StudentDashboard />
    </Suspense>
  );
}

function StudentDashboard() {
  const { user, loading: authLoading, isStudent } = useAuth();
  const { notifications } = useNotifications();
  const { justifications } = useJustifications();
  const { data: history, isLoading: historyLoading } = useAttendanceHistory();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("justified") === "1") {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && (!user || !isStudent)) {
      router.push("/login");
    }
  }, [authLoading, user, isStudent, router]);

  if (authLoading || historyLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Chargement...</p>
      </div>
    );
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
      (record.status === "absent" || record.status === "late") &&
      !getJustificationStatus(record)
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <StudentHeader />

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
        {/* Success message */}
        {showSuccess && (
          <div className="mb-6 flex items-center gap-2 text-[var(--color-success)] text-sm bg-[var(--color-success-bg)] px-4 py-3 rounded-xl border border-[var(--color-success-border)] animate-fade-in">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span className="font-medium">
              Justification envoyee avec succes.
            </span>
          </div>
        )}

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
          <h2
            className="text-2xl font-bold text-[var(--color-text)] mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Historique de presence
          </h2>

          {!history || history.length === 0 ? (
            <div className="text-center py-10 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)]">
              <p className="text-sm text-[var(--color-text-muted)]">
                Aucun historique disponible
              </p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] overflow-hidden">
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
                    {history.map((record) => {
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
                            {record.room || "—"}
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
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {justStatus ? (
                              <span
                                className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${justificationBadge(justStatus).className}`}
                              >
                                {justificationBadge(justStatus).text}
                              </span>
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
                                —
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
          )}
        </section>
      </main>
    </div>
  );
}
