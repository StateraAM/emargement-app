"use client";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationBell } from "@/components/notification-bell";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

interface AttendanceRecord {
  id: string;
  course_name: string;
  course_date: string;
  status: string;
  signed_at: string | null;
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

export default function StudentDashboard() {
  const { user, loading: authLoading, logout, isStudent } = useAuth();
  const { notifications } = useNotifications();
  const { data: history, isLoading: historyLoading } = useAttendanceHistory();
  const router = useRouter();

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
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white/90">
                  {user.first_name} {user.last_name}
                </p>
              </div>
              <NotificationBell />
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
                      <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Cours
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                        Signe
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => {
                      const status = statusLabel(record.status);
                      return (
                        <tr
                          key={record.id}
                          className="border-b border-[var(--color-border-light)] last:border-b-0"
                        >
                          <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                            {formatDate(record.course_date)}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text)] font-medium">
                            {record.course_name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}
                            >
                              {status.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
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
